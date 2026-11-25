"use client";

import { useEffect, useRef, useState } from "react";
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-6), page, state }),
      });
      const data = await res.json();
      setMsgs([...next, { role: "assistant", text: data.answer ?? "No answer came back. Try again in a moment." }]);
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
        className="ui fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-ai-deep to-ai px-5 py-3.5 text-[1rem] font-semibold text-white shadow-[0_14px_34px_-10px_rgba(29,56,199,0.75)] transition-transform hover:-translate-y-0.5 sm:right-6"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="shrink-0">
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" fill="currentColor" />
        </svg>
        {open ? "Close chat" : "Ask the data"}
      </button>

      {open && (
        <section
          id="chat-panel"
          aria-label="Chat about this project"
          className="fixed inset-x-3 bottom-[5.25rem] top-[calc(var(--nav-h)+0.5rem)] z-40 flex flex-col overflow-hidden rounded-3xl border border-rule bg-surface shadow-[0_30px_80px_-20px_rgba(7,14,44,0.55)] sm:inset-x-auto sm:right-6 sm:top-auto sm:h-[min(640px,78vh)] sm:w-[min(430px,calc(100vw-3rem))]"
        >
          <div className="night on-night px-5 py-4">
            <h2 className="ui text-[1.08rem] font-bold tracking-tight">Ask about the project</h2>
            <p className="ui mt-1 text-[0.82rem] leading-snug text-on-night-soft">
              Answers use this site&apos;s own findings and the sliders on the page you have open. It can be wrong; check the charts and the data page.
            </p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[0.98rem] leading-relaxed">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="ui text-[0.88rem] text-ink-soft">Try one of these:</p>
                <div className="flex flex-col items-start gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="ui rounded-2xl border border-rule bg-paper px-3.5 py-2 text-left text-[0.9rem] transition-colors hover:border-ai hover:bg-ai-soft"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ui ml-10 rounded-2xl rounded-br-md bg-ai px-3.5 py-2.5 text-white"
                    : "ui mr-6 whitespace-pre-wrap rounded-2xl rounded-bl-md bg-paper-2 px-3.5 py-2.5"
                }
              >
                {m.text.replace(/\*\*/g, "").replace(/^\s*[*-]\s+/gm, "")}
              </div>
            ))}
            {busy && <div className="ui text-[0.9rem] text-ink-faint">Thinking about it…</div>}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-rule bg-paper p-3"
          >
            <label htmlFor="chat-input" className="sr-only-ui">
              Your question
            </label>
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 600))}
              placeholder="Ask a question"
              className="ui min-w-0 flex-1 rounded-full border border-rule bg-surface px-4 py-2.5 text-[1rem] outline-none focus:border-ai"
            />
            <button disabled={busy || !input.trim()} className="ui rounded-full bg-ai px-5 py-2.5 text-[1rem] font-semibold text-white disabled:opacity-40">
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
}
