"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useChatContext } from "./chat-context";

type Msg = { role: "user" | "assistant"; text: string };

const STARTERS = [
  "What does this page show?",
  "Why isn't the price of AI the binding constraint on wages?",
  "What is the Jevons paradox here?",
  "What are the biggest limits of this data?",
];

export function Chat() {
  const { page, state } = useChatContext();
  const onJourney = usePathname() === "/journey";
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      // never leave the panel waiting: give up after 35 seconds
      const res = await fetch("/api/chat", {
        signal: AbortSignal.timeout(35000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-6), page, state }),
      });
      if ((res.headers.get("content-type") ?? "").includes("application/json") || !res.body) {
        // limits and errors come back as a short JSON message
        const data = await res.json();
        setMsgs([...next, { role: "assistant", text: data.answer ?? "No answer came back. Try again in a moment." }]);
        return;
      }
      // the answer streams in; show it as it is written
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", text }]);
      }
      if (!text.trim()) setMsgs([...next, { role: "assistant", text: "No answer came back. Try again in a moment." }]);
    } catch {
      setMsgs([...next, { role: "assistant", text: "The chat could not be reached. The pages and charts still work; try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="chat-panel"
        className={`ui fixed ${onJourney ? "bottom-[5.25rem]" : "bottom-[max(1rem,env(safe-area-inset-bottom))]"} right-4 z-40 flex items-center gap-2 border border-ink bg-ink px-4 py-3 text-[0.95rem] font-semibold text-white transition-colors hover:bg-black sm:right-6`}
        style={{ borderRadius: "var(--radius)" }}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden className="shrink-0">
          <path d="M3 4.5h14v9H8l-4 3v-3H3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        {open ? "Close" : "Ask about this page"}
      </button>

      {open && (
        <section
          id="chat-panel"
          aria-label="Questions about this project"
          className="fixed inset-x-3 bottom-[5rem] top-[calc(var(--nav-h)+0.5rem)] z-40 flex flex-col overflow-hidden border border-ink bg-paper sm:inset-x-auto sm:right-6 sm:top-auto sm:h-[min(620px,78vh)] sm:w-[min(420px,calc(100vw-3rem))]"
          style={{ borderRadius: "var(--radius)" }}
        >
          <div className="border-b border-ink px-4 py-3">
            <h2 className="ui text-[1rem] font-bold">Questions about the project</h2>
            <p className="ui mt-0.5 text-[0.82rem] leading-snug text-ink-soft">
              Answers come from this site&apos;s findings and the dials on the page you have open. They can be wrong; check the figures and the data page.
            </p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[0.98rem] leading-relaxed">
            {msgs.length === 0 && (
              <div>
                <p className="ui text-[0.86rem] text-ink-soft">For example:</p>
                <ul className="mt-1">
                  {STARTERS.map((s) => (
                    <li key={s} className="border-b border-rule">
                      <button onClick={() => send(s)} className="ui w-full py-2 text-left text-[0.92rem] text-ai-deep hover:underline">
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ui ml-8 border-l-0 bg-paper-2 px-3 py-2 text-[0.95rem]" : "serif whitespace-pre-wrap text-[1rem]"}>
                {m.role === "user" ? <span className="block text-[0.78rem] font-semibold text-ink-soft">You asked</span> : null}
                {m.text.replace(/\*\*/g, "").replace(/^\s*[*-]\s+/gm, "")}
              </div>
            ))}
            {busy && msgs[msgs.length - 1]?.role !== "assistant" && <div className="ui text-[0.9rem] text-ink-soft">Looking it up&hellip;</div>}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-ink p-3"
          >
            <label htmlFor="chat-input" className="sr-only-ui">
              Your question
            </label>
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 600))}
              placeholder="Type a question"
              className="ui min-w-0 flex-1 border border-rule bg-surface px-3 py-2.5 text-[1rem] outline-none focus:border-ink"
              style={{ borderRadius: "var(--radius)" }}
            />
            <button disabled={busy || !input.trim()} className="btn btn-ink min-h-[44px] px-4 disabled:opacity-40">
              Ask
            </button>
          </form>
        </section>
      )}
    </>
  );
}
