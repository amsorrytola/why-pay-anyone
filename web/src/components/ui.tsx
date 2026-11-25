"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type Tone = "ai" | "human" | "owner" | "ok";
const TONE_VAR: Record<Tone, string> = { ai: "var(--ai)", human: "var(--human)", owner: "var(--owner)", ok: "var(--ok)" };
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
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="ui text-[0.95rem] font-semibold leading-tight">
          {label}
        </label>
        <output htmlFor={id} className={`num shrink-0 text-[1rem] ${TONE_TEXT[tone]}`}>
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
    <div className="py-1.5">
      <label htmlFor={id} className="ui flex cursor-pointer items-start gap-3 text-[0.95rem] font-semibold">
        <input id={id} type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} className="mt-[3px] h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--ink)]" />
        <span>{props.label}</span>
      </label>
      {props.help && <p className="ui ml-[1.875rem] text-[0.84rem] leading-snug text-ink-soft">{props.help}</p>}
    </div>
  );
}

/** A set of mutually exclusive options, drawn as joined tabs on a rule. */
export function Segmented<T extends string>(props: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={props.label} className="hscroll ui inline-flex max-w-full border border-ink text-[0.9rem]" style={{ borderRadius: "var(--radius)" }}>
      {props.options.map((o, i) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={props.value === o.value}
          onClick={() => props.onChange(o.value)}
          className={`min-h-[40px] shrink-0 whitespace-nowrap px-3.5 py-1.5 font-semibold transition-colors ${i > 0 ? "border-l border-ink" : ""} ${
            props.value === o.value ? "bg-ink text-white" : "bg-surface text-ink hover:bg-paper-2"
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
    <div className="flex flex-wrap gap-2">
      {props.presets.map((p) => (
        <button
          key={p.id}
          onClick={() => props.onPick(p.id)}
          aria-pressed={props.active === p.id}
          className={`ui min-h-[38px] border px-3 py-1 text-[0.88rem] font-semibold transition-colors ${
            props.active === p.id ? "border-ink bg-ink text-white" : "border-rule bg-surface text-ink hover:border-ink"
          }`}
          style={{ borderRadius: "var(--radius)" }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ figures and notes */

/** A numbered figure, set like a statistical report: a heavy rule, "Figure n." and title, units, the chart, then the source. */
export function Figure(props: { title: string; subtitle?: string; source?: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`rule-top min-w-0 pt-3 ${props.className ?? ""}`}>
      <figcaption className="mb-4">
        <h3 className="fig-title ui text-[1.02rem] leading-snug">{props.title}</h3>
        {props.subtitle && <p className="ui mt-1 max-w-[78ch] text-[0.88rem] leading-snug text-ink-soft">{props.subtitle}</p>}
      </figcaption>
      {props.children}
      {props.source && (
        <p className="ui mt-3 max-w-none border-t border-rule pt-2 text-[0.78rem] leading-snug text-ink-faint">
          {props.source.startsWith("Source") ? props.source : `Source: ${props.source}`}
        </p>
      )}
    </figure>
  );
}

/** Count a number between values when it changes, so a dial visibly moves the result. Keeps the text as is when it cannot parse a number. */
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
  const cur = useRef(target);
  useEffect(() => {
    if (!parsed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cur.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const from = cur.current;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 320);
      const v = from + (target - from) * (1 - Math.pow(1 - k, 3));
      cur.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, parsed === null]);
  if (!parsed) return value;
  const body = shown.toLocaleString("en-US", { minimumFractionDigits: parsed.decimals, maximumFractionDigits: parsed.decimals, useGrouping: parsed.grouped });
  return `${parsed.prefix}${body}${parsed.suffix}`;
}

/** One number and what it means. */
export function Stat(props: { value: string; label: string; tone?: Tone; sub?: string; size?: "md" | "lg" }) {
  const text = useCountedText(props.value);
  const big = props.size === "lg";
  return (
    <div className="min-w-0">
      <div className={`num leading-none ${props.tone ? TONE_TEXT[props.tone] : "text-ink"} ${big ? "text-[2.6rem] sm:text-[3rem]" : "text-[1.9rem] sm:text-[2.15rem]"}`} aria-label={props.value}>
        {text}
      </div>
      <div className="ui mt-1.5 text-[0.88rem] leading-snug text-ink">{props.label}</div>
      {props.sub && <div className="ui mt-0.5 text-[0.78rem] leading-snug text-ink-faint">{props.sub}</div>}
    </div>
  );
}

/** The reading of a figure: a boxed note, set in the text face. */
export function Takeaway(props: { children: ReactNode; title?: string }) {
  return (
    <aside className="border border-ink bg-surface p-5 sm:p-6" style={{ borderRadius: "var(--radius)" }}>
      <h3 className="ui mb-2 text-[0.95rem] font-bold">{props.title ?? "What this shows"}</h3>
      <div className="serif max-w-[68ch] space-y-3 text-[1.06rem] leading-[1.62] text-ink">{props.children}</div>
    </aside>
  );
}

/** Limits and definitions, set like notes at the foot of a table. */
export function Caveat(props: { children: ReactNode; title?: string }) {
  return (
    <aside className="h-fit border-t border-ink pt-3">
      <h3 className="ui mb-1.5 text-[0.92rem] font-bold">{props.title ?? "Notes and limits"}</h3>
      <div className="ui max-w-[72ch] space-y-2 text-[0.92rem] leading-relaxed text-ink-soft">{props.children}</div>
    </aside>
  );
}

/** On a phone the dials and the result are far apart, so the key numbers stay pinned under the masthead while the reader moves the dials. */
export function StickyReadout(props: { items: { value: string; label: string; tone?: Tone }[] }) {
  return (
    <div className="sticky top-[var(--nav-h)] z-30 -mx-5 mb-4 border-b border-ink bg-paper px-5 py-2 lg:hidden" aria-label="Live result">
      <div className="grid grid-cols-3 gap-2">
        {props.items.slice(0, 3).map((it) => (
          <div key={it.label} className="min-w-0">
            <div className={`num truncate text-[1.2rem] leading-tight ${it.tone ? TONE_TEXT[it.tone] : "text-ink"}`}>{it.value}</div>
            <div className="ui truncate text-[0.72rem] leading-tight text-ink-soft">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page structure */

const CHAPTER: Record<string, string> = { M1: "1", M2: "2", M3: "3", M4: "4", M5: "5", M6: "6" };

/** A chapter opener: the chapter number set large in the margin, the question as the title, and the standfirst. */
export function PageHead(props: { id?: string; title: string; question: string; children?: ReactNode }) {
  const n = props.id ? CHAPTER[props.id] : undefined;
  return (
    <header className="mx-auto max-w-[1180px] px-5 pb-8 pt-8 sm:px-8 sm:pb-12 sm:pt-12">
      <div className="rule-double grid gap-x-8 pt-6 sm:pt-8 md:grid-cols-[7rem_minmax(0,1fr)]">
        {n ? (
          <div aria-hidden className="serif text-[4.5rem] font-semibold leading-[0.8] text-human sm:text-[6.5rem]">
            {n}
          </div>
        ) : (
          <div aria-hidden className="hidden md:block" />
        )}
        <div className="mt-3 md:mt-0">
          <h1 className="max-w-[20ch]">{props.title}</h1>
          <p className="serif mt-4 max-w-[58ch] text-[1.2rem] italic leading-snug text-ink-soft sm:text-[1.32rem]">{props.question}</p>
          {props.children}
        </div>
      </div>
    </header>
  );
}

export function Section(props: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-[1180px] px-5 py-6 sm:px-8 sm:py-9 ${props.className ?? ""}`}>{props.children}</section>;
}
