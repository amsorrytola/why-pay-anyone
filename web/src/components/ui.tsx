"use client";

import { useId, type ReactNode } from "react";

type Tone = "ai" | "human" | "owner" | "ok";
const TONE_VAR: Record<Tone, string> = { ai: "var(--ai)", human: "var(--human)", owner: "var(--owner)", ok: "var(--ok)" };

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
        <label htmlFor={id} className="ui text-[1rem] font-semibold">
          {label}
        </label>
        <output htmlFor={id} className="num text-[1.05rem]">
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
        <p id={`${id}-h`} className="ui -mt-0.5 text-[0.85rem] leading-snug text-ink-soft">
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
      <label htmlFor={id} className="ui flex cursor-pointer items-center gap-3 text-[1rem] font-semibold">
        <input id={id} type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} className="h-5 w-5 accent-[var(--ai)]" />
        {props.label}
      </label>
      {props.help && <p className="ui ml-8 text-[0.85rem] leading-snug text-ink-soft">{props.help}</p>}
    </div>
  );
}

export function Segmented<T extends string>(props: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={props.label} className="ui inline-flex rounded-full border border-rule bg-surface p-0.5 text-[0.92rem]">
      {props.options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={props.value === o.value}
          onClick={() => props.onChange(o.value)}
          className={`rounded-full px-3.5 py-1.5 transition-colors ${props.value === o.value ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}
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
          className={`ui rounded-full border px-3.5 py-1.5 text-[0.92rem] transition-colors ${
            props.active === p.id ? "border-ink bg-ink text-paper" : "border-rule bg-surface hover:border-ai hover:bg-ai-soft"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** A chart or table with a title, a plain-English reading and a source line. */
export function Figure(props: { title: string; subtitle?: string; source?: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`rounded-[6px] border border-rule bg-surface p-4 sm:p-5 ${props.className ?? ""}`}>
      <figcaption className="mb-3">
        <h3 className="ui">{props.title}</h3>
        {props.subtitle && <p className="ui mt-1 max-w-[70ch] text-[0.95rem] leading-snug text-ink-soft">{props.subtitle}</p>}
      </figcaption>
      {props.children}
      {props.source && <p className="ui mt-3 max-w-none text-[0.8rem] leading-snug text-ink-faint">{props.source}</p>}
    </figure>
  );
}

/** One number, with what it means. */
export function Stat(props: { value: string; label: string; tone?: Tone; sub?: string }) {
  const color = props.tone ? TONE_VAR[props.tone] : "var(--ink)";
  return (
    <div className="min-w-[8.5rem]">
      <div className="num text-[2rem] leading-none" style={{ color }}>
        {props.value}
      </div>
      <div className="ui mt-1 text-[0.9rem] leading-snug text-ink-soft">{props.label}</div>
      {props.sub && <div className="ui text-[0.78rem] text-ink-faint">{props.sub}</div>}
    </div>
  );
}

export function Takeaway(props: { children: ReactNode; title?: string }) {
  return (
    <aside className="border-l-[5px] border-human bg-human-soft/60 px-5 py-4">
      <h3 className="ui mb-1 text-[1.05rem]">{props.title ?? "What this says"}</h3>
      <div className="max-w-[68ch] space-y-2">{props.children}</div>
    </aside>
  );
}

export function Caveat(props: { children: ReactNode; title?: string }) {
  return (
    <aside className="border-l-[5px] border-rule bg-surface px-5 py-4 text-[1rem] text-ink-soft">
      <h3 className="ui mb-1 text-[1rem] text-ink">{props.title ?? "Read with care"}</h3>
      <div className="max-w-[68ch] space-y-2">{props.children}</div>
    </aside>
  );
}

export function PageHead(props: { id?: string; title: string; question: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-6 pt-12">
      {props.id && <p className="ui mb-2 text-[1rem] font-semibold text-ai-deep">Module {props.id}</p>}
      <h1 className="max-w-[18ch]">{props.title}</h1>
      <p className="mt-4 max-w-[60ch] text-[1.3rem] leading-snug text-ink-soft">{props.question}</p>
      {props.children}
    </div>
  );
}

export function Section(props: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-[1180px] px-5 py-6 ${props.className ?? ""}`}>{props.children}</section>;
}
