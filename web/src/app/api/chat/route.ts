import { KNOWLEDGE } from "@/content/knowledge";

export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
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

  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ answer: fallback(question, "The chat is not switched on for this copy of the site."), limited: true });

  const stateText = Object.entries(body.state ?? {})
    .slice(0, 24)
    .map(([k, v]) => `${String(k).slice(0, 40)}: ${String(v).slice(0, 30)}`)
    .join("; ");
  const system = `${KNOWLEDGE}\nCURRENT PAGE: ${String(body.page ?? "home").slice(0, 20)}. Dial settings and results on screen now: ${stateText || "none"}.`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: msgs.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig: { maxOutputTokens: 450, temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return Response.json({ answer: fallback(question, "The chat service is busy right now."), limited: true });
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
    return Response.json({ answer: text || fallback(question, "No answer came back.") });
  } catch {
    return Response.json({ answer: fallback(question, "The chat service did not answer in time.") });
  }
}
