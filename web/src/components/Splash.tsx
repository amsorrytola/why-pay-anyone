"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/site";

const KEY = "wpa-splash";

/**
 * The opening screen, once per browser session. The price of GPT-4-level AI falls on a price board while the
 * question appears; then the reader picks the guided journey or explores alone. A script in the layout hides it
 * before paint when it has already been seen, so it never flashes on later pages.
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
      const t0 = performance.now() + 500;
      const lf = Math.log(props.from);
      const lt = Math.log(props.to);
      const step = (t: number) => {
        const k = Math.max(0, Math.min(1, (t - t0) / 1700));
        const e = 1 - Math.pow(1 - k, 3);
        setPrice(Math.exp(lf + (lt - lf) * e));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    const focus = window.setTimeout(() => startRef.current?.focus({ preventScroll: true }), reduce ? 0 : 1900);
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
    }, 600);
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
  const priceText = price >= 1 ? price.toFixed(2) : price >= 0.1 ? price.toFixed(3) : price.toFixed(3);

  return (
    <div id="splash" role="dialog" aria-modal="true" aria-label="Welcome" className={`night on-night flex flex-col ${phase === "leaving" ? "splash-out" : ""}`}>
      <div className="flex items-center justify-between px-5 pt-5 sm:px-8">
        <span className="pop flex items-center gap-2.5" style={{ ["--d" as string]: "80ms" }}>
          <LogoMark size={34} />
          <span className="ui text-[1.05rem] font-bold tracking-tight text-on-night">Why Pay Anyone?</span>
        </span>
        <button type="button" onClick={() => close()} className="ui rounded-full px-3 py-2 text-[0.92rem] font-medium text-on-night-soft hover:text-white">
          Skip
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col justify-center gap-10 px-5 pb-10 sm:px-8 lg:flex-row lg:items-center lg:gap-16">
        <div className="lg:w-[52%]">
          <p className="ui rise text-[0.95rem] font-semibold text-ai-glow" style={{ ["--d" as string]: "300ms" }}>
            The price of GPT-4-level AI, per million tokens
          </p>
          <div className="rise mt-3 flex items-end gap-4" style={{ ["--d" as string]: "380ms" }}>
            <span className="num text-[clamp(3.6rem,13vw,7.5rem)] leading-none text-white" aria-live="off">
              ${priceText}
            </span>
          </div>
          <p className="ui rise mt-3 text-[0.92rem] text-on-night-soft" style={{ ["--d" as string]: "460ms" }}>
            September 2023 to November 2026, cheapest model at that level
          </p>
          <svg viewBox="0 0 400 140" className="mt-6 w-full max-w-[460px]" aria-hidden>
            <path d="M4 14 H70 V42 H120 V70 H190 V96 H260 V114 H330 V126 H396" fill="none" stroke="var(--human)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="draw-path" style={{ ["--d" as string]: "500ms" }} />
            <path d="M4 136 H396" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="lg:w-[48%]">
          <h1 className="rise text-[clamp(3rem,9vw,5.6rem)] leading-[0.95]" style={{ ["--d" as string]: "1100ms" }}>
            Why pay anyone?
          </h1>
          <p className="rise mt-5 max-w-[42ch] text-[1.08rem] leading-relaxed text-on-night-soft sm:text-[1.2rem]" style={{ ["--d" as string]: "1300ms" }}>
            If an AI does the work for cents, why would anyone pay a person to do it? Guess first, then let real data answer, one chapter at a time.
          </p>
          <div className="rise mt-8 flex flex-col gap-3 sm:flex-row" style={{ ["--d" as string]: "1600ms" }}>
            <button ref={startRef} type="button" onClick={() => close(() => router.push("/journey"))} className="btn btn-light">
              Start the journey
            </button>
            <button type="button" onClick={() => close()} className="btn btn-ghost">
              Explore on my own
            </button>
          </div>
          <p className="ui rise mt-4 text-[0.85rem] text-on-night-soft/80" style={{ ["--d" as string]: "1700ms" }}>
            Seven short chapters, about eight minutes. You can leave at any point.
          </p>
        </div>
      </div>
    </div>
  );
}
