import { KNOWLEDGE } from "@/content/knowledge";

export const maxDuration = 30;

// The answer is streamed as it is written. Providers are tried in order, so a busy one does not stop the chat:
// Gemini 2.5 Flash with thinking off (first words in about 1.5 s, accurate), Gemini 2.5 Flash-Lite (faster, less
// careful), MiniMax (about 4 s, it thinks first), then the newer Gemini model, which is often overloaded.
// A provider that has not started answering by its deadline is skipped before anything is shown.
const FAST_MODEL = process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash";
const LITE_MODEL = process.env.GEMINI_LITE_MODEL || "gemini-2.5-flash-lite";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || "MiniMax-M3.1-Flash";
const PER_IP_LIMIT = Number(process.env.CHAT_PER_IP_PER_10MIN || 14);
const DAILY_CAP = Number(process.env.CHAT_DAILY_CAP || 500);
const MAX_MESSAGES = 6;
const MAX_CHARS = 600;

// Best-effort limits kept in memory (per server instance). The hard spend cap lives in the provider console.
const ipHits = new Map<string, number[]>();
let dayKey = "";
let dayCount = 0;

const FALLBACKS: { keys: RegExp; answer: string }[] = [
  { keys: /jevons/i, answer: "The Jevons paradox says that when a resource gets cheaper to use, total use can rise by more than the saving. On the Prices page, usage of AI tokens grew about 480 times while the price of GPT-4-level capability fell about 1,000 times, so spending rose. But the estimate of how much usage responds to a model's own price cut is only about -0.47 and imprecise, so the growth is not proof of the paradox: new users and new uses also drive it." },
  { keys: /binding|bind|price of ai|token/i, answer: "On the Wages page, a million tokens for an hour of work cost well under 1% of an hour's pay (about 0.3% at GPT-5 level), so the price of tokens is not what holds AI back. What binds is how much work AI can do well enough, how much checking it needs, and how easily tasks substitute for each other." },
  { keys: /limit|caveat|weak/i, answer: "The biggest limits: each usage dataset covers one platform; exposure scores are not job-loss forecasts; prices are list prices from one source; OpenRouter users are not the whole market; and the models are simplified scenarios, not forecasts. The Data page lists every source and its limits." },
];

function clientIp(req: Request) {
  const f = req.headers.get("x-forwarded-for");
  return (f ? f.split(",")[0].trim() : req.headers.get("x-real-ip")) || "unknown";
}

function fallback(q: string, why: string) {
  const hit = FALLBACKS.find((f) => f.keys.test(q));
  return hit ? hit.answer : `${why} The charts and pages work without the chat; the Data page lists every source, and the page you have open explains its own numbers.`;
}

export async function POST(req: Request) {
  let body: { messages?: { role: string; text: string }[]; page?: string; state?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ answer: "That request could not be read." }, { status: 400 });
  }
  const msgs = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role === "user" ? "user" : "model", text: m.text.slice(0, MAX_CHARS) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return Response.json({ answer: "Ask a question to start." }, { status: 400 });
  const question = msgs[msgs.length - 1].text;

  // rate limits
  const now = Date.now();
  const ip = clientIp(req);
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) {
    dayKey = today;
    dayCount = 0;
  }
  if (hits.length >= PER_IP_LIMIT) return Response.json({ answer: fallback(question, "You have reached the limit of questions for now (about 14 every 10 minutes)."), limited: true });
  if (dayCount >= DAILY_CAP) return Response.json({ answer: fallback(question, "The chat has reached its daily limit."), limited: true });
  hits.push(now);
  ipHits.set(ip, hits);
  dayCount++;

  const geminiKey = process.env.GEMINI_API_KEY;
  const minimaxKey = process.env.MINIMAX_API_KEY || process.env.MINIMAX_API;
  if (!geminiKey && !minimaxKey) return Response.json({ answer: fallback(question, "The chat is not switched on for this copy of the site."), limited: true });

  const stateText = Object.entries(body.state ?? {})
    .slice(0, 24)
    .map(([k, v]) => `${String(k).slice(0, 40)}: ${String(v).slice(0, 30)}`)
    .join("; ");
  const system = `${KNOWLEDGE}\nCURRENT PAGE: ${String(body.page ?? "home").slice(0, 20)}. Dial settings and results on screen now: ${stateText || "none"}.`;

  type Provider = { name: string; firstTokenMs: number; open: (signal: AbortSignal) => AsyncGenerator<string> };
  const providers: Provider[] = [];
  if (geminiKey) {
    providers.push({ name: FAST_MODEL, firstTokenMs: 4000, open: (sig) => streamGemini(geminiKey, FAST_MODEL, system, msgs, sig, { thinkingConfig: { thinkingBudget: 0 } }) });
    providers.push({ name: LITE_MODEL, firstTokenMs: 4000, open: (sig) => streamGemini(geminiKey, LITE_MODEL, system, msgs, sig) });
  }
  if (minimaxKey) providers.push({ name: MINIMAX_MODEL, firstTokenMs: 10000, open: (sig) => streamMinimax(minimaxKey, system, msgs, sig) });
  if (geminiKey && MODEL !== FAST_MODEL) providers.push({ name: MODEL, firstTokenMs: 6000, open: (sig) => streamGemini(geminiKey, MODEL, system, msgs, sig) });

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      for (const p of providers) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), p.firstTokenMs);
        try {
          for await (const chunk of p.open(ctrl.signal)) {
            if (!chunk) continue;
            if (!sent) clearTimeout(timer);
            sent = true;
            controller.enqueue(enc.encode(chunk));
          }
          clearTimeout(timer);
          if (sent) break;
        } catch {
          clearTimeout(timer);
          if (sent) {
            controller.enqueue(enc.encode(" …"));
            break;
          }
          // nothing shown yet: try the next provider
        }
      }
      if (!sent) controller.enqueue(enc.encode(fallback(question, "The chat service is busy right now.")));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}

type Msg = { role: string; text: string };

/** Read a server-sent-events body and yield the JSON of each `data:` line. */
async function* sse(res: Response): AsyncGenerator<unknown> {
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        yield JSON.parse(data);
      } catch {
        // ignore a partial or non-JSON line
      }
    }
  }
}

async function* streamGemini(key: string, model: string, system: string, msgs: Msg[], signal: AbortSignal, extra: Record<string, unknown> = {}) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: msgs.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { maxOutputTokens: 450, temperature: 0.3, ...extra },
    }),
    signal,
  });
  for await (const ev of sse(res)) {
    const parts = (ev as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts ?? [];
    yield parts.map((p) => p.text ?? "").join("");
  }
}

async function* streamMinimax(key: string, system: string, msgs: Msg[], signal: AbortSignal) {
  const res = await fetch("https://api.minimax.io/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      stream: true,
      reasoning_effort: "low",
      max_tokens: 900,
      temperature: 0.3,
      messages: [{ role: "system", content: system }, ...msgs.map((m) => ({ role: m.role === "model" ? "assistant" : "user", content: m.text }))],
    }),
    signal,
  });
  // only the answer is shown; the model's reasoning (reasoning_content) is skipped
  for await (const ev of sse(res)) {
    yield (ev as { choices?: { delta?: { content?: string } }[] })?.choices?.[0]?.delta?.content ?? "";
  }
}
