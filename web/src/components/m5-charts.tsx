"use client";

/**
 * Charts for the M5 (markets) page: firm shares as a stacked area you can scrub, hosts against lowest price,
 * and sparse revenue reports. All of them measure their width on the client first.
 */

import { useRef, useState } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { area, curveMonotoneX, line, stack, stackOffsetExpand } from "d3-shape";
import { useWidth } from "./charts";
import { logTicks, monthLabel, monthX, spreadY } from "./m1-shared";

type Num = ((v: number) => number) & { ticks: (n?: number) => number[]; invert: (v: number) => number };
const AXIS = "var(--ink-faint)";
const GRID = "var(--rule)";

/* ------------------------------------------------------------------ */
/* Firm shares, stacked to 100%                                        */
/* ------------------------------------------------------------------ */

export type ShareSeries = { id: string; label: string; color: string; values: number[] };

export function ShareArea(props: {
  months: string[];
  series: ShareSeries[];
  selected: number;
  onSelect: (i: number) => void;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = props.height ?? 360;
  const [hover, setHover] = useState<{ i: number; k: number } | null>(null);
  const pressed = useRef(false);
  const { months, series } = props;
  if (!w) return <div ref={ref} style={{ height: h }} />;

  const L = { top: 22, right: 12, bottom: 30, left: 46 };
  const direct = w >= 540;
  const rightPad = direct ? 120 : 10;
  const plotR = w - L.right - rightPad;
  const xs = months.map(monthX);
  const x = scaleLinear().domain([xs[0], xs[xs.length - 1]]).range([L.left, plotR]) as unknown as Num;
  const y = scaleLinear().domain([0, 1]).range([h - L.bottom, L.top]) as unknown as Num;
  const rows = months.map((_, i) => Object.fromEntries(series.map((s) => [s.id, s.values[i] ?? 0])));
  const st = stack<Record<string, number>>().keys(series.map((s) => s.id)).offset(stackOffsetExpand)(rows);
  const ar = area<[number, number]>()
    .x((_, i) => x(xs[i]))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(curveMonotoneX);
  const step = Math.max(1, Math.ceil(months.length / Math.max(2, Math.floor((plotR - L.left) / 84))));
  const ticks = months.map((m, i) => ({ m, i })).filter(({ i }) => (months.length - 1 - i) % step === 0);

  function locate(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    if (px < L.left - 6 || px > plotR + 6) return null;
    const i = Math.min(months.length - 1, Math.max(0, Math.round((x.invert(px) - xs[0]) * 12)));
    const v = y.invert(py);
    let k = -1;
    st.forEach((s, j) => {
      if (v >= s[i][0] && v <= s[i][1]) k = j;
    });
    return { i, k };
  }

  const sel = Math.min(months.length - 1, Math.max(0, props.selected));
  const hv = hover;
  const tip = hv
    ? series
        .map((s, j) => ({ s, j, v: st[j][hv.i][1] - st[j][hv.i][0] }))
        .sort((a, b) => b.v - a.v)
        .filter((r) => r.v > 0.0005)
        .slice(0, 8)
    : [];

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={props.ariaLabel}
        style={{ touchAction: "pan-y", cursor: "crosshair" }}
        onPointerMove={(e) => {
          const l = locate(e);
          setHover(l);
          if (l && pressed.current) props.onSelect(l.i);
        }}
        onPointerDown={(e) => {
          const l = locate(e);
          if (l) {
            pressed.current = true;
            props.onSelect(l.i);
          }
        }}
        onPointerUp={() => {
          pressed.current = false;
        }}
        onPointerLeave={() => {
          pressed.current = false;
          setHover(null);
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={L.left} x2={plotR} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={L.left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={AXIS} className="ui">
              {`${Math.round(t * 100)}%`}
            </text>
          </g>
        ))}
        {ticks.map(({ m, i }) => (
          <text key={m} x={x(xs[i])} y={h - 9} textAnchor="middle" fontSize={12} fill={AXIS} className="ui">
            {monthLabel(m)}
          </text>
        ))}
        {st.map((s, j) => {
          const last = s[s.length - 1];
          const mid = (y(last[0]) + y(last[1])) / 2;
          const dim = hv && hv.k >= 0 && hv.k !== j;
          return (
            <g key={series[j].id}>
              <path d={ar(s as unknown as [number, number][]) ?? ""} fill={series[j].color} fillOpacity={dim ? 0.45 : 0.9} stroke="var(--surface)" strokeWidth={0.75} />
              {direct && Math.abs(y(last[0]) - y(last[1])) > 13 && (
                <text x={plotR + 8} y={mid + 4} fontSize={12.5} fontWeight={600} fill="var(--ink)" className="ui">
                  {series[j].label}
                </text>
              )}
            </g>
          );
        })}
        {hv && <line x1={x(xs[hv.i])} x2={x(xs[hv.i])} y1={L.top} y2={h - L.bottom} stroke="var(--ink-soft)" strokeWidth={1} pointerEvents="none" />}
        <g pointerEvents="none">
          <line x1={x(xs[sel])} x2={x(xs[sel])} y1={L.top - 6} y2={h - L.bottom} stroke="var(--ink)" strokeWidth={2.25} />
          <rect x={x(xs[sel]) - 5} y={L.top - 12} width={10} height={10} rx={2} fill="var(--ink)" />
        </g>
      </svg>
      {!direct && (
        <ul className="ui mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.8rem]">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {hv && (
        <div
          className="ui pointer-events-none absolute z-10 rounded-[3px] border border-ink bg-surface px-2.5 py-1.5 text-[0.82rem]"
          style={{ left: Math.min(Math.max(8, w - 210), Math.max(L.left, x(xs[hv.i]) + 12)), top: L.top }}
        >
          <div className="font-semibold">{monthLabel(months[hv.i])}</div>
          {tip.map((r) => (
            <div key={r.s.id} className={`flex items-center gap-1.5 whitespace-nowrap ${r.j === hv.k ? "font-bold" : ""}`}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.s.color }} />
              {r.s.label}: <span className="num">{(r.v * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hosts against lowest price                                          */
/* ------------------------------------------------------------------ */

export type HostDot = { id: string; x: number; y: number; color: string; title: string; sub: string };

export function HostScatter(props: {
  dots: HostDot[];
  xDomain: [number, number];
  yDomain: [number, number];
  xTicks: number[];
  keys: { label: string; color: string }[];
  yFormat: (n: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = props.height ?? 400;
  const [hov, setHov] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  if (!w) return <div ref={ref} style={{ height: h }} />;
  const S = { top: 14, right: 14, bottom: 48, left: 58 };
  const x = scaleLog().domain(props.xDomain).range([S.left, w - S.right]) as unknown as Num;
  const y = scaleLog().domain(props.yDomain).range([h - S.bottom, S.top]) as unknown as Num;
  const yTicks = logTicks(props.yDomain[0], props.yDomain[1]);
  const showId = hov ?? sel;
  const shown = props.dots.find((d) => d.id === showId);
  return (
    <div ref={ref} className="relative w-full">
      <div className="ui mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.86rem] font-semibold" aria-hidden>
        {props.keys.map((k) => (
          <span key={k.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: k.color, opacity: 0.75 }} />
            {k.label}
          </span>
        ))}
      </div>
      <svg width={w} height={h} role="img" aria-label={props.ariaLabel}>
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={S.left} x2={w - S.right} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={S.left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={AXIS} className="ui">
              {props.yFormat(t)}
            </text>
          </g>
        ))}
        {props.xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={S.top} y2={h - S.bottom} stroke={GRID} strokeOpacity={0.5} />
            <text x={x(t)} y={h - S.bottom + 17} textAnchor="middle" fontSize={12} fill={AXIS} className="ui">
              {t}
            </text>
          </g>
        ))}
        <text x={(S.left + w - S.right) / 2} y={h - 6} textAnchor="middle" fontSize={13} fill="var(--ink-soft)" className="ui">
          Number of hosts (companies listing the model), log scale
        </text>
        <text transform={`translate(14 ${(S.top + h - S.bottom) / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill="var(--ink-soft)" className="ui">
          Lowest price, $ per million tokens (log)
        </text>
        {props.dots.map((d) => (
          <circle
            key={d.id}
            cx={x(d.x)}
            cy={y(d.y)}
            r={5}
            fill={d.color}
            fillOpacity={0.55}
            stroke={d.id === showId ? "var(--ink)" : "var(--surface)"}
            strokeWidth={d.id === showId ? 2 : 0.6}
            style={{ cursor: "pointer" }}
            onPointerEnter={() => setHov(d.id)}
            onPointerLeave={() => setHov(null)}
            onClick={() => setSel((s) => (s === d.id ? null : d.id))}
          />
        ))}
      </svg>
      {shown && (
        <div
          className="ui pointer-events-none absolute z-10 max-w-[250px] rounded-[3px] border border-ink bg-surface px-2.5 py-1.5 text-[0.82rem]"
          style={{ left: Math.min(Math.max(8, w - 260), Math.max(8, x(shown.x) + 12)), top: Math.max(4, y(shown.y) - 62) }}
        >
          <div className="font-semibold">{shown.title}</div>
          <div className="text-ink-soft">{shown.sub}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reported revenue run rates                                          */
/* ------------------------------------------------------------------ */

export type RevPoint = { t: number; v: number; note: string };
export type RevSeries = { id: string; label: string; color: string; points: RevPoint[] };

export function RevenueDots(props: { series: RevSeries[]; log: boolean; xDomain: [number, number]; yFormat: (n: number) => string; height?: number; ariaLabel: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = props.height ?? 340;
  const [hov, setHov] = useState<string | null>(null);
  if (!w) return <div ref={ref} style={{ height: h }} />;
  const R = { top: 14, right: 12, bottom: 30, left: 56 };
  const rightPad = w < 520 ? 70 : 96;
  const plotR = w - R.right - rightPad;
  const x = scaleLinear().domain(props.xDomain).range([R.left, plotR]) as unknown as Num;
  const all = props.series.flatMap((s) => s.points.map((p) => p.v));
  const vmax = all.length ? Math.max(...all) : 1;
  const vmin = all.length ? Math.min(...all) : 0.01;
  const yScale = props.log
    ? scaleLog().domain([Math.min(vmin * 0.6, 0.01), vmax * 1.6]).range([h - R.bottom, R.top])
    : scaleLinear().domain([0, vmax * 1.08]).range([h - R.bottom, R.top]).nice();
  const y = yScale as unknown as Num;
  const years: number[] = [];
  for (let yr = Math.ceil(props.xDomain[0]); yr <= Math.floor(props.xDomain[1]); yr++) years.push(yr);
  const ends = props.series.filter((s) => s.points.length > 0);
  const labelY = spreadY(
    ends.map((s) => ({ key: s.id, y: y(s.points[s.points.length - 1].v) })),
    16,
    R.top + 8,
    h - R.bottom - 4,
  );
  const dotKey = (s: RevSeries, i: number) => `${s.id}-${i}`;
  const shownEntry = props.series.flatMap((s) => s.points.map((p, i) => ({ s, p, k: dotKey(s, i) }))).find((e) => e.k === hov);
  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={h} role="img" aria-label={props.ariaLabel}>
        {(props.log ? logTicks((yScale.domain() as number[])[0], (yScale.domain() as number[])[1]) : y.ticks(5)).map((t) => (
          <g key={`y${t}`}>
            <line x1={R.left} x2={plotR} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={R.left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={AXIS} className="ui">
              {props.yFormat(t)}
            </text>
          </g>
        ))}
        {years.map((yr) => (
          <text key={yr} x={x(yr)} y={h - 9} textAnchor="middle" fontSize={12} fill={AXIS} className="ui">
            {yr}
          </text>
        ))}
        {props.series.map((s) => (
          <g key={s.id}>
            <path d={line<RevPoint>().x((p) => x(p.t)).y((p) => y(p.v))(s.points) ?? ""} fill="none" stroke={s.color} strokeWidth={1.25} strokeDasharray="3 4" opacity={0.7} />
            {s.points.map((p, i) => (
              <circle
                key={dotKey(s, i)}
                cx={x(p.t)}
                cy={y(p.v)}
                r={4.5}
                fill={s.color}
                stroke={dotKey(s, i) === hov ? "var(--ink)" : "var(--surface)"}
                strokeWidth={dotKey(s, i) === hov ? 2 : 1}
                style={{ cursor: "pointer" }}
                onPointerEnter={() => setHov(dotKey(s, i))}
                onPointerLeave={() => setHov(null)}
              />
            ))}
          </g>
        ))}
        {ends.map((s) => (
          <text key={`l${s.id}`} x={plotR + 8} y={(labelY.get(s.id) ?? 0) + 4} fontSize={13} fontWeight={600} fill="var(--ink)" className="ui">
            {s.label}
          </text>
        ))}
      </svg>
      {shownEntry && (
        <div
          className="ui pointer-events-none absolute z-10 max-w-[250px] rounded-[3px] border border-ink bg-surface px-2.5 py-1.5 text-[0.82rem]"
          style={{ left: Math.min(Math.max(8, w - 260), Math.max(8, x(shownEntry.p.t) - 120)), top: Math.max(4, y(shownEntry.p.v) - 58) }}
        >
          <div className="font-semibold">
            {shownEntry.s.label}: {props.yFormat(shownEntry.p.v)}
          </div>
          <div className="text-ink-soft">{shownEntry.p.note}</div>
        </div>
      )}
    </div>
  );
}
