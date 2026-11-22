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
        className="ui fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[1rem] font-semibold text-paper shadow-[0_6px_20px_rgba(17,26,53,0.35)] transition-transform hover:-translate-y-0.5"
      >
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-human" />
        {open ? "Close chat" : "Ask the data"}
      </button>

      {open && (
        <section
          id="chat-panel"
          aria-label="Chat about this project"
          className="fixed bottom-20 right-5 z-40 flex h-[min(620px,78vh)] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-md border border-rule bg-surface shadow-[0_18px_50px_rgba(17,26,53,0.28)]"
        >
          <div className="border-b border-rule bg-ai-soft px-4 py-3">
            <h2 className="ui text-[1.05rem] font-bold">Ask about the project</h2>
            <p className="ui mt-0.5 text-[0.85rem] leading-snug text-ink-soft">
              Answers use this site&apos;s own findings and the sliders on the page you have open. It can be wrong; check the charts and the data page.
            </p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[0.98rem] leading-relaxed">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="ui text-[0.9rem] text-ink-soft">Try one of these:</p>
                <div className="flex flex-col items-start gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="ui rounded-full border border-rule bg-paper px-3 py-1.5 text-left text-[0.9rem] hover:border-ai hover:bg-ai-soft"
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
                    ? "ml-8 rounded-md bg-ink px-3 py-2 text-paper"
                    : "mr-4 whitespace-pre-wrap rounded-md bg-paper px-3 py-2"
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
            className="flex gap-2 border-t border-rule p-3"
          >
            <label htmlFor="chat-input" className="sr-only-ui">
              Your question
            </label>
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 600))}
              placeholder="Ask a question"
              className="ui min-w-0 flex-1 rounded border border-rule bg-paper px-3 py-2 text-[1rem] outline-none focus:border-ai"
            />
            <button
              disabled={busy || !input.trim()}
              className="ui rounded bg-ai px-4 py-2 text-[1rem] font-semibold text-white disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
}
