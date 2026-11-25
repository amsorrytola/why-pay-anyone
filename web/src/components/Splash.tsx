"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const KEY = "wpa-splash";

/**
 * The cover, once per browser session. The headline number of the study counts down, from the price of GPT-4-level
 * AI in September 2023 to its price in November 2026, while the price line falls; then the title appears and the
 * reader picks the guided reading or the report. A script in the layout hides it before paint once it has been
 * seen, and a noscript rule hides it without JavaScript.
 */
export function Splash(props: { from: number; to: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");
  const [price, setPrice] = useState(props.from);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (document.documentElement.dataset.splash === "seen") {
      setPhase("gone");
      return;
    }
    document.documentElement.style.overflow = "hidden";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    if (reduce) setPrice(props.to);
    else {
      const t0 = performance.now() + 450;
      const lf = Math.log(props.from);
      const lt = Math.log(props.to);
      const step = (t: number) => {
        const k = Math.max(0, Math.min(1, (t - t0) / 1800));
        const e = 1 - Math.pow(1 - k, 3);
        setPrice(Math.exp(lf + (lt - lf) * e));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    const focus = window.setTimeout(() => startRef.current?.focus({ preventScroll: true }), reduce ? 0 : 2000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(focus);
    };
  }, [props.from, props.to]);

  const close = (then?: () => void) => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
    setPhase("leaving");
    then?.();
    window.setTimeout(() => {
      document.documentElement.dataset.splash = "seen";
      document.documentElement.style.overflow = "";
      setPhase("gone");
    }, 450);
  };

  useEffect(() => {
    if (phase !== "show") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "gone") return null;
  const priceText = price >= 1 ? price.toFixed(2) : price.toFixed(3);

  return (
    <div id="splash" role="dialog" aria-modal="true" aria-label="Cover" className={`overflow-y-auto ${phase === "leaving" ? "splash-out" : ""}`}>
      <div className="mx-auto flex min-h-full max-w-[1180px] flex-col px-5 pb-8 pt-4 sm:px-8 sm:pt-6">
        <div className="ui flex items-center justify-between text-[0.86rem] text-ink-soft">
          <span>Lab Based Project, IIT Roorkee</span>
          <button type="button" onClick={() => close()} className="ui -mr-2 px-2 py-2 font-semibold text-ink underline-offset-4 hover:underline">
            Skip
          </button>
        </div>

        <div className="rule-double mt-2 grid flex-1 content-center gap-10 pb-8 pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-8">
          <div>
            <div className="num text-[clamp(3.6rem,14vw,8rem)] leading-none tracking-[-0.03em] text-ai" aria-live="off">
              ${priceText}
            </div>
            <p className="ui mt-3 max-w-[40ch] text-[0.95rem] leading-snug text-ink-soft">
              Cheapest price of GPT-4-level AI, per million tokens, from September 2023 to November 2026
            </p>
            <svg viewBox="0 0 400 130" className="mt-6 w-full max-w-[440px]" aria-hidden>
              <path d="M0 128 H400" stroke="var(--ink)" strokeWidth="1.5" />
              <path d="M2 12 H70 V40 H120 V66 H190 V92 H262 V108 H332 V118 H398" fill="none" stroke="var(--ai)" strokeWidth="3" strokeLinejoin="miter" pathLength={1} className="draw-path" style={{ ["--d" as string]: "450ms" }} />
            </svg>
          </div>

          <div>
            <h1 className="rise text-[clamp(2.8rem,8vw,5rem)] leading-[1]" style={{ ["--d" as string]: "1200ms" }}>
              Why Pay Anyone?
            </h1>
            <p className="serif rise mt-2 text-[1.3rem] italic text-ink-soft" style={{ ["--d" as string]: "1300ms" }}>
              The economics of cheap intelligence
            </p>
            <p className="rise mt-5 max-w-[46ch] text-[1.08rem] leading-relaxed" style={{ ["--d" as string]: "1450ms" }}>
              If an AI does the work for cents, why would anyone pay a person to do it? The guided reading asks you to guess first, then shows what the data says, chapter by chapter.
            </p>
            <div className="rise mt-7 flex flex-col gap-3 sm:flex-row" style={{ ["--d" as string]: "1650ms" }}>
              <button ref={startRef} type="button" onClick={() => close(() => router.push("/journey"))} className="btn btn-ink">
                Start the guided reading
              </button>
              <button type="button" onClick={() => close()} className="btn btn-ghost">
                Go to the report
              </button>
            </div>
            <p className="ui rise mt-4 text-[0.86rem] text-ink-soft" style={{ ["--d" as string]: "1750ms" }}>
              Seven short chapters, about eight minutes. You can leave at any point.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
