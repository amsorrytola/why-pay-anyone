"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type Tone = "ai" | "human" | "owner" | "ok";
const TONE_VAR: Record<Tone, string> = { ai: "var(--ai)", human: "var(--human)", owner: "var(--owner)", ok: "var(--ok)" };
const TONE_PILL: Record<Tone, string> = {
  ai: "bg-ai-soft text-ai-deep",
  human: "bg-human-soft text-human-deep",
  owner: "bg-owner-soft text-owner",
  ok: "bg-ok-soft text-ok",
};
const TONE_TEXT: Record<Tone, string> = { ai: "text-ai", human: "text-human-deep", owner: "text-owner", ok: "text-ok" };

/* ------------------------------------------------------------------ controls */

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  help?: string;
  tone?: Tone;
  /** Optional mapping so a slider can be logarithmic: pos is the slider position, value the real value. */
  toPos?: (v: number) => number;
  fromPos?: (p: number) => number;
}) {
  const id = useId();
  const { label, value, min, max, step, onChange, format, help, tone = "ai", toPos, fromPos } = props;
  const pos = toPos ? toPos(value) : value;
  const lo = toPos ? toPos(min) : min;
  const hi = toPos ? toPos(max) : max;
  const pct = ((pos - lo) / (hi - lo)) * 100;
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="ui text-[0.98rem] font-semibold leading-tight">
          {label}
        </label>
        <output htmlFor={id} className={`num shrink-0 rounded-full px-3 py-0.5 text-[0.92rem] ${TONE_PILL[tone]}`}>
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={toPos ? lo : min}
        max={toPos ? hi : max}
        step={toPos ? (hi - lo) / 400 : step}
        value={pos}
        style={{ ["--pct" as string]: `${pct}%`, ["--fill" as string]: TONE_VAR[tone] }}
        onChange={(e) => {
          const p = Number(e.target.value);
          onChange(fromPos ? fromPos(p) : p);
        }}
        aria-describedby={help ? `${id}-h` : undefined}
      />
      {help && (
        <p id={`${id}-h`} className="ui -mt-1 text-[0.84rem] leading-snug text-ink-soft">
          {help}
        </p>
      )}
    </div>
  );
}

export function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  const id = useId();
  return (
    <div className="py-2">
      <label htmlFor={id} className="ui flex cursor-pointer items-center gap-3 text-[0.98rem] font-semibold">
        <input id={id} type="checkbox" role="switch" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} className="peer sr-only" />
        <span
          aria-hidden
          className="relative h-7 w-12 shrink-0 rounded-full bg-rule transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-ai peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ai"
        />
        {props.label}
      </label>
      {props.help && <p className="ui ml-[3.75rem] text-[0.84rem] leading-snug text-ink-soft">{props.help}</p>}
    </div>
  );
}

export function Segmented<T extends string>(props: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={props.label} className="hscroll ui inline-flex max-w-full rounded-full border border-rule bg-paper-2 p-1 text-[0.92rem]">
      {props.options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={props.value === o.value}
          onClick={() => props.onChange(o.value)}
          className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 font-medium transition-all ${
            props.value === o.value ? "bg-ink text-white shadow-[0_4px_12px_-4px_rgba(13,24,56,0.6)]" : "text-ink-soft hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PresetBar(props: { presets: { id: string; label: string }[]; onPick: (id: string) => void; active?: string }) {
  return (
    <div className="hscroll -mx-1 flex gap-2 px-1 pb-1 sm:flex-wrap">
      {props.presets.map((p) => (
        <button
          key={p.id}
          onClick={() => props.onPick(p.id)}
          aria-pressed={props.active === p.id}
          className={`ui min-h-[40px] shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-[0.92rem] font-medium transition-all ${
            props.active === p.id ? "border-ink bg-ink text-white shadow-[0_4px_12px_-4px_rgba(13,24,56,0.6)]" : "border-rule bg-surface text-ink-soft hover:-translate-y-0.5 hover:border-ai hover:text-ai-deep"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ cards and callouts */

export function Figure(props: { title: string; subtitle?: string; source?: string; children: ReactNode; className?: string }) {
  return (
    <figure data-reveal className={`panel min-w-0 p-4 sm:p-6 ${props.className ?? ""}`}>
      <figcaption className="mb-4">
        <h3 className="ui text-[1.12rem]">{props.title}</h3>
        {props.subtitle && <p className="ui mt-1.5 max-w-[72ch] text-[0.92rem] leading-snug text-ink-soft">{props.subtitle}</p>}
      </figcaption>
      {props.children}
      {props.source && <p className="ui mt-4 max-w-none border-t border-rule pt-3 text-[0.78rem] leading-snug text-ink-faint">{props.source}</p>}
    </figure>
  );
}

/** Count a number up (or between values) so a figure that changes feels alive. Keeps the text the same when it cannot parse a number. */
function parseValue(s: string) {
  const m = s.match(/^([^0-9]*?)([0-9][0-9,]*\.?[0-9]*)([\s\S]*)$/);
  if (!m) return null;
  const num = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  const decimals = m[2].includes(".") ? m[2].split(".")[1].length : 0;
  return { prefix: m[1], num, decimals, grouped: m[2].includes(","), suffix: m[3] };
}

function useCountedText(value: string) {
  const parsed = parseValue(value);
  const target = parsed?.num ?? 0;
  const [shown, setShown] = useState(target);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  const cur = useRef(target);

  useEffect(() => {
    if (!parsed) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const run = (from: number, to: number, ms: number) => {
      cancelAnimationFrame(raf);
      if (reduce) {
        cur.current = to;
        setShown(to);
        return;
      }
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        const e = 1 - Math.pow(1 - k, 3);
        const v = from + (to - from) * e;
        cur.current = v;
        setShown(v);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    if (!seen.current) {
      const el = ref.current;
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            seen.current = true;
            io.disconnect();
            run(0, target, 1100);
          }
        },
        { threshold: 0.4 },
      );
      io.observe(el);
      return () => {
        io.disconnect();
        cancelAnimationFrame(raf);
      };
    }
    run(cur.current, target, 380);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, parsed === null]);

  if (!parsed) return { ref, text: value };
  const body = shown.toLocaleString("en-US", { minimumFractionDigits: parsed.decimals, maximumFractionDigits: parsed.decimals, useGrouping: parsed.grouped });
  return { ref, text: `${parsed.prefix}${body}${parsed.suffix}` };
}

/** One number, with what it means. */
export function Stat(props: { value: string; label: string; tone?: Tone; sub?: string; size?: "md" | "lg" }) {
  const { ref, text } = useCountedText(props.value);
  const big = props.size === "lg";
  return (
    <div ref={ref} className="min-w-0">
      <div className={`num leading-none ${props.tone ? TONE_TEXT[props.tone] : "text-ink"} ${big ? "text-[3rem] sm:text-[3.6rem]" : "text-[2.15rem] sm:text-[2.5rem]"}`} aria-label={props.value}>
        {text}
      </div>
      <div className="ui mt-1.5 text-[0.9rem] leading-snug text-ink-soft">{props.label}</div>
      {props.sub && <div className="ui mt-0.5 text-[0.78rem] leading-snug text-ink-faint">{props.sub}</div>}
    </div>
  );
}

export function Takeaway(props: { children: ReactNode; title?: string }) {
  return (
    <aside data-reveal className="relative overflow-hidden rounded-[var(--radius)] border border-ai/20 bg-gradient-to-br from-ai-soft/80 via-white to-white p-5 pl-7 sm:p-7 sm:pl-9">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-ai" />
      <h3 className="ui mb-2 flex items-center gap-2 text-[0.95rem] font-semibold text-ai-deep">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
          <path d="M2 11 6 7l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {props.title ?? "What this says"}
      </h3>
      <div className="serif max-w-[66ch] space-y-3 text-[1.1rem] leading-[1.6] text-ink">{props.children}</div>
    </aside>
  );
}

export function Caveat(props: { children: ReactNode; title?: string }) {
  return (
    <aside data-reveal className="panel-tint h-fit p-5 sm:p-6">
      <h3 className="ui mb-2 flex items-center gap-2 text-[0.95rem] font-semibold text-ink">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-warn">
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 4.6v4.2M8 11v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {props.title ?? "Read with care"}
      </h3>
      <div className="ui max-w-[68ch] space-y-2 text-[0.96rem] leading-relaxed text-ink-soft">{props.children}</div>
    </aside>
  );
}


/** On a phone the dials and the result are far apart, so keep the key numbers pinned under the nav while the reader moves the dials. Hidden on wide screens, where both are in view. */
export function StickyReadout(props: { items: { value: string; label: string; tone?: Tone }[] }) {
  return (
    <div className="sticky top-[var(--nav-h)] z-30 -mx-5 mb-4 border-b border-rule bg-paper/95 px-5 py-2 backdrop-blur lg:hidden" aria-label="Live result">
      <div className="grid grid-cols-3 gap-2">
        {props.items.slice(0, 3).map((it) => (
          <div key={it.label} className="min-w-0 text-center">
            <div className={`num truncate text-[1.25rem] leading-tight ${it.tone ? TONE_TEXT[it.tone] : "text-ink"}`}>{it.value}</div>
            <div className="ui truncate text-[0.68rem] leading-tight text-ink-faint">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page structure */

export function PageHead(props: { id?: string; title: string; question: string; children?: ReactNode }) {
  return (
    <header className="night on-night overflow-hidden">
      {props.id && (
        <span aria-hidden className="ghost-numeral absolute -bottom-4 right-3 text-[8.5rem] sm:-bottom-8 sm:right-10 sm:text-[17rem]">
          {props.id}
        </span>
      )}
      <div className="relative mx-auto max-w-[1200px] px-5 pb-12 pt-10 sm:px-8 sm:pb-20 sm:pt-16">
        {props.id && (
          <p className="ui rise mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-[0.85rem] font-semibold text-on-night backdrop-blur" style={{ ["--d" as string]: "0ms" }}>
            <span className="pulse-dot h-2 w-2 rounded-full bg-ai-glow" />
            Module {props.id.replace("M", "")} of 6
          </p>
        )}
        <h1 className="rise max-w-[17ch]" style={{ ["--d" as string]: "80ms" }}>
          {props.title}
        </h1>
        <p className="rise mt-5 max-w-[54ch] text-[1.12rem] leading-relaxed text-on-night-soft sm:text-[1.25rem]" style={{ ["--d" as string]: "200ms" }}>
          {props.question}
        </p>
        {props.children}
      </div>
    </header>
  );
}

export function Section(props: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-[1200px] px-5 py-6 sm:px-8 sm:py-9 ${props.className ?? ""}`}>{props.children}</section>;
}
