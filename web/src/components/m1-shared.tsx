"use client";

/**
 * Small pieces shared by the M1 (prices) and M5 (markets) pages: month helpers, a play button for month sliders,
 * a label placer for charts, and a dot-and-interval plot for regression estimates.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { useWidth } from "./charts";
import { monthToYear } from "@/lib/format";

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-03" to "Mar 2025". */
export const monthLabel = (m: string) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Position of a month on a time axis (middle of the month, in years). */
export const monthX = monthToYear;

/** Month ticks for an axis: the finest calendar step (1, 2, 3, 6 or 12 months) that fits in maxTicks labels. */
export function monthTicks(months: string[], maxTicks: number): { m: string; label: string }[] {
  for (const step of [1, 2, 3, 6, 12]) {
    const picked = months.filter((m) => (Number(m.slice(5, 7)) - 1) % step === 0);
    if (picked.length >= 1 && picked.length <= maxTicks) return picked.map((m) => ({ m, label: monthLabel(m) }));
  }
  const ends = months.length > 1 ? [months[0], months[months.length - 1]] : months;
  return ends.map((m) => ({ m, label: monthLabel(m) }));
}

/** A number with a real minus sign and an explicit plus sign. */
export function signed(n: number, digits = 2) {
  const s = Math.abs(n).toFixed(digits);
  if (n < 0 && Number(s) !== 0) return `−${s}`;
  return n > 0 && Number(s) !== 0 ? `+${s}` : s;
}

/** A percent change with a real minus sign, for example "−29%". */
export function signedPct(n: number, digits = 0) {
  const s = (Math.abs(n) * 100).toFixed(digits);
  if (n < 0 && Number(s) !== 0) return `−${s}%`;
  return n > 0 && Number(s) !== 0 ? `+${s}%` : `${s}%`;
}

/** Axis label for a price in dollars per million tokens. */
export function dollarTick(n: number) {
  if (n >= 1000) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `$${+n.toPrecision(3)}`;
}

/** Tidy ticks for a log axis: powers of ten, with 2 and 5 added when the axis spans only a decade or two. */
export function logTicks(lo: number, hi: number): number[] {
  const e0 = Math.floor(Math.log10(lo));
  const e1 = Math.ceil(Math.log10(hi));
  const pick = (mults: number[]) => {
    const out: number[] = [];
    for (let e = e0; e <= e1; e++) {
      for (const m of mults) {
        const v = +(m * Math.pow(10, e)).toPrecision(12);
        if (v >= lo * 0.9999 && v <= hi * 1.0001) out.push(v);
      }
    }
    return out;
  };
  const wide = pick([1]);
  if (wide.length >= 4) return wide;
  const mid = pick([1, 2, 5]);
  return mid.length >= 3 ? mid : pick([1, 2, 3, 4, 5, 6, 7, 8, 9]);
}

/** Break a label into lines of at most maxChars characters, at spaces and hyphens. */
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.match(/[^ -]+[ -]?/g) ?? [text];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else cur += w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

/** Spread labels vertically so they do not collide. */
export function spreadY(items: { y: number; key: string }[], gap: number, lo: number, hi: number) {
  const s = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < s.length; i++) if (s[i].y - s[i - 1].y < gap) s[i].y = s[i - 1].y + gap;
  const over = s.length ? s[s.length - 1].y - hi : 0;
  if (over > 0) for (const it of s) it.y -= over;
  for (const it of s) it.y = Math.max(lo, it.y);
  return new Map(s.map((i) => [i.key, i.y]));
}

type Box = { x0: number; x1: number; y0: number; y1: number };
export type PlacedLabel = { id: string; x: number; y: number; anchor: "start" | "end"; text: string };

/**
 * Put a text label beside each point without overlapping other labels or points, in priority order.
 * Items that find no free spot are left out (they are still available on hover).
 */
export function placeLabels(items: { id: string; x: number; y: number; text: string }[], bounds: Box, charW = 6.4): PlacedLabel[] {
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const pointBoxes = items.map((it) => ({ x0: it.x - 5, x1: it.x + 5, y0: it.y - 5, y1: it.y + 5 }));
  const taken: Box[] = [];
  const out: PlacedLabel[] = [];
  const spots: { dx: number; dy: number; anchor: "start" | "end" }[] = [
    { dx: 8, dy: -8, anchor: "start" },
    { dx: 8, dy: 17, anchor: "start" },
    { dx: -8, dy: -8, anchor: "end" },
    { dx: -8, dy: 17, anchor: "end" },
    { dx: 8, dy: -23, anchor: "start" },
    { dx: 8, dy: 32, anchor: "start" },
    { dx: -8, dy: -23, anchor: "end" },
    { dx: -8, dy: 32, anchor: "end" },
  ];
  items.forEach((it, i) => {
    const w = it.text.length * charW + 4;
    for (const s of spots) {
      const tx = it.x + s.dx;
      const ty = it.y + s.dy;
      const box: Box = s.anchor === "start" ? { x0: tx, x1: tx + w, y0: ty - 11, y1: ty + 4 } : { x0: tx - w, x1: tx, y0: ty - 11, y1: ty + 4 };
      if (box.x0 < bounds.x0 || box.x1 > bounds.x1 || box.y0 < bounds.y0 || box.y1 > bounds.y1) continue;
      if (taken.some((t) => hit(t, box))) continue;
      if (pointBoxes.some((p, j) => j !== i && hit(p, box))) continue;
      taken.push(box);
      out.push({ id: it.id, x: tx, y: ty, anchor: s.anchor, text: it.text });
      break;
    }
  });
  return out;
}

/**
 * Step a month slider forward on a timer, only after the reader presses play.
 * Stops at the last month; pressing play at the end starts again from the first month.
 */
export function usePlayer(opts: { min: number; max: number; value: number; onChange: (v: number) => void; ms?: number }) {
  const { min, max, value, onChange, ms = 700 } = opts;
  const [playing, setPlaying] = useState(false);
  const valueRef = useRef(value);
  const changeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    changeRef.current = onChange;
  });
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = valueRef.current + 1;
      if (next > max) {
        setPlaying(false);
        return;
      }
      changeRef.current(next);
      if (next >= max) setPlaying(false);
    }, ms);
    return () => window.clearInterval(id);
  }, [playing, max, ms]);
  const toggle = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (valueRef.current >= max) changeRef.current(min);
    setPlaying(true);
  }, [playing, max, min]);
  return { playing, toggle };
}

export function PlayButton(props: { playing: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.playing}
      className="ui inline-flex items-center gap-2 rounded-[3px] border border-ink bg-ink px-4 py-1.5 text-[0.95rem] font-semibold text-paper transition-colors hover:bg-ai-deep hover:border-ai-deep"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">
        {props.playing ? (
          <>
            <rect x="1.5" y="1" width="3.2" height="10" />
            <rect x="7.3" y="1" width="3.2" height="10" />
          </>
        ) : (
          <path d="M2 1 L11 6 L2 11 Z" />
        )}
      </svg>
      {props.playing ? "Pause" : (props.label ?? "Play")}
    </button>
  );
}

export type IntervalRow = { id: string; label: string; est: number; lo: number; hi: number; color: string };

/** Estimates as dots with 95% intervals, one row each, with optional vertical reference lines. */
export function IntervalPlot(props: {
  rows: IntervalRow[];
  domain: [number, number];
  format: (n: number) => string;
  ticks?: number[];
  refs?: { x: number; label: string }[];
  ariaLabel: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const padL = 10;
  const padR = 14;
  const x = scaleLinear().domain(props.domain).range([padL, Math.max(padL + 20, w - padR)]);
  const ticks = props.ticks ?? x.ticks(Math.max(3, Math.floor(w / 80)));
  if (!w) return <div ref={ref} style={{ height: props.rows.length * 54 + 56 }} />;
  const clampX = (v: number) => x(Math.min(props.domain[1], Math.max(props.domain[0], v)));
  return (
    <div ref={ref} className="relative w-full pt-6" role="group" aria-label={props.ariaLabel}>
      <svg className="pointer-events-none absolute left-0 top-0 h-full w-full" aria-hidden="true">
        {ticks.map((t) => (
          <line key={`g${t}`} x1={x(t)} x2={x(t)} y1={22} y2="100%" stroke="var(--rule)" strokeOpacity={0.6} />
        ))}
        {props.refs?.map((r) => (
          <g key={r.label}>
            <line x1={x(r.x)} x2={x(r.x)} y1={18} y2="100%" stroke="var(--ink-soft)" strokeDasharray="4 3" />
            <text x={x(r.x)} y={12} textAnchor="middle" fontSize={12} fill="var(--ink-soft)" className="ui">
              {r.label}
            </text>
          </g>
        ))}
      </svg>
      {props.rows.map((r) => (
        <div key={r.id} className="relative pb-1">
          <div className="ui flex flex-wrap items-baseline justify-between gap-x-3 px-[10px] text-[0.9rem] leading-tight">
            <span className="font-semibold">
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-baseline" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="num whitespace-nowrap text-[0.9rem]">
              {props.format(r.est)} <span className="font-normal text-ink-soft">({props.format(r.lo)} to {props.format(r.hi)})</span>
            </span>
          </div>
          <svg width={w} height={22} aria-hidden="true">
            <line x1={clampX(r.lo)} x2={clampX(r.hi)} y1={11} y2={11} stroke={r.color} strokeWidth={3.5} strokeLinecap="round" opacity={0.5} />
            <line x1={clampX(r.lo)} x2={clampX(r.lo)} y1={5} y2={17} stroke={r.color} strokeWidth={2} />
            <line x1={clampX(r.hi)} x2={clampX(r.hi)} y1={5} y2={17} stroke={r.color} strokeWidth={2} />
            <circle cx={clampX(r.est)} cy={11} r={6.5} fill={r.color} stroke="var(--surface)" strokeWidth={2} />
          </svg>
        </div>
      ))}
      <svg width={w} height={24} aria-hidden="true">
        {ticks.map((t) => (
          <text key={`t${t}`} x={x(t)} y={16} textAnchor="middle" fontSize={12} fill="var(--ink-faint)" className="ui">
            {props.format(t)}
          </text>
        ))}
      </svg>
    </div>
  );
}
