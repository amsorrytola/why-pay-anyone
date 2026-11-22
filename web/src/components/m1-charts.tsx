"use client";

/**
 * Charts for the M1 (prices) page: the price-of-capability chart with model labels, and the month-by-month
 * scatter of every priced model. Both measure their width on the client first, so server and client markup match.
 */

import { useState, type ReactNode } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { area, curveStepBefore, line } from "d3-shape";
import { useWidth } from "./charts";
import { logTicks, monthLabel, monthTicks, monthX, placeLabels, spreadY, wrapText } from "./m1-shared";

type Num = ((v: number) => number) & { ticks: (n?: number) => number[]; invert: (v: number) => number };

const AXIS = "var(--ink-faint)";
const GRID = "var(--rule)";

/* ------------------------------------------------------------------ */
/* Price chart                                                         */
/* ------------------------------------------------------------------ */

/** One point. m is the month; x, when given, places the point exactly in time (years), for daily data. */
export type PricePoint = { m: string; y: number; note?: string; x?: number };
export type PriceSeries = {
  id: string;
  label: string;
  color: string;
  points: PricePoint[];
  band?: { m: string; lo: number; hi: number }[];
  dashed?: boolean;
  width?: number;
  /** Draw a small dot on every month. */
  dots?: boolean;
};

const PM = { top: 16, right: 12, bottom: 30, left: 56 };

export function PriceChart(props: {
  months: string[];
  series: PriceSeries[];
  log: boolean;
  yFormat: (n: number) => string;
  labels?: { id: string; m: string; y: number; text: string }[];
  markers?: { m: string; label: string }[];
  hlines?: { y: number; label: string }[];
  height?: number;
  ariaLabel: string;
  empty?: ReactNode;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = props.height ?? 380;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const { months, series, log } = props;
  if (!w) return <div ref={ref} style={{ height: h }} />;

  const hasData = series.some((s) => s.points.length > 0);
  if (!hasData || months.length < 2) {
    return (
      <div ref={ref} className="ui flex items-center justify-center rounded border border-dashed border-rule px-4 text-center text-ink-soft" style={{ height: h }}>
        {props.empty ?? "Nothing to show for these settings."}
      </div>
    );
  }

  const rightPad = w < 520 ? 84 : w < 760 ? 124 : 150;
  const plotR = w - PM.right - rightPad;
  const x0 = monthX(months[0]);
  const x1 = monthX(months[months.length - 1]);
  const x = scaleLinear().domain([x0, x1]).range([PM.left, plotR]) as unknown as Num;

  const vals = series
    .flatMap((s) => [...s.points.map((p) => p.y), ...(s.band ?? []).flatMap((b) => [b.lo, b.hi])])
    .filter((v) => Number.isFinite(v) && (!log || v > 0));
  const vmin = Math.min(...vals);
  const vmax = Math.max(...vals);
  const yScale = log
    ? scaleLog().domain([vmin * 0.7, Math.max(vmax * 1.5, vmin * 1.5)]).range([h - PM.bottom, PM.top])
    : scaleLinear().domain([0, vmax * 1.08]).range([h - PM.bottom, PM.top]).nice();
  const y = yScale as unknown as Num;
  const yDom = yScale.domain() as number[];
  const yTicks = log ? logTicks(yDom[0], yDom[1]) : y.ticks(5);
  const xTicks = monthTicks(months, Math.max(2, Math.floor((plotR - PM.left) / 84)));

  const lineGen = line<PricePoint>()
    .x((d) => x(d.x ?? monthX(d.m)))
    .y((d) => y(d.y))
    .defined((d) => Number.isFinite(d.y) && (!log || d.y > 0));

  // direct labels at the right end of each line
  const endLabels = series.filter((s) => s.points.length > 0);
  const maxChars = Math.floor((rightPad - 12) / 7.8);
  const wrapped = new Map(endLabels.map((s) => [s.id, wrapText(s.label, maxChars)]));
  const maxLines = Math.max(...endLabels.map((s) => wrapped.get(s.id)!.length));
  const labelY = spreadY(
    endLabels.map((s) => ({ key: s.id, y: y(s.points[s.points.length - 1].y) })),
    maxLines > 1 ? 32 : 17,
    PM.top + 8,
    h - PM.bottom - 6,
  );

  const placed = placeLabels(
    (props.labels ?? []).map((l) => ({ id: l.id, x: x(monthX(l.m)), y: y(l.y), text: l.text })),
    { x0: PM.left + 2, x1: plotR, y0: PM.top + 4, y1: h - PM.bottom - 2 },
  );

  const hm = hoverIdx !== null ? months[hoverIdx] : null;
  const hoverRows = hm
    ? series
        .map((s) => {
          if (s.points.some((p) => p.x !== undefined)) {
            // exact-time points (daily): take the one nearest the hovered month
            const hx = monthX(hm);
            let best: PricePoint | undefined;
            for (const p of s.points) if (p.x !== undefined && Math.abs(p.x - hx) < 0.5 / 12 && (!best || Math.abs(p.x - hx) < Math.abs((best.x as number) - hx))) best = p;
            return { s, p: best };
          }
          return { s, p: s.points.find((p) => p.m === hm) };
        })
        .filter((r) => r.p)
    : [];

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (px < PM.left - 6 || px > plotR + 6) {
      setHoverIdx(null);
      return;
    }
    const i = Math.round((x.invert(px) - x0) * 12);
    setHoverIdx(Math.min(months.length - 1, Math.max(0, i)));
  }

  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={h} role="img" aria-label={props.ariaLabel} style={{ touchAction: "pan-y" }} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHoverIdx(null)}>
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PM.left} x2={plotR} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={PM.left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={AXIS} className="ui">
              {props.yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x${t.m}`}>
            <line x1={x(monthX(t.m))} x2={x(monthX(t.m))} y1={h - PM.bottom} y2={h - PM.bottom + 4} stroke={AXIS} />
            <text x={x(monthX(t.m))} y={h - 9} textAnchor="middle" fontSize={12} fill={AXIS} className="ui">
              {t.label}
            </text>
          </g>
        ))}
        {props.hlines?.map((hl) => (
          <g key={hl.label}>
            <line x1={PM.left} x2={plotR} y1={y(hl.y)} y2={y(hl.y)} stroke="var(--ink-soft)" strokeDasharray="5 4" strokeWidth={1.25} />
            <text x={PM.left + 4} y={y(hl.y) - 5} fontSize={12} fill="var(--ink-soft)" className="ui">
              {hl.label}
            </text>
          </g>
        ))}
        {props.markers?.map((mk) => (
          <g key={mk.label}>
            <line x1={x(monthX(mk.m))} x2={x(monthX(mk.m))} y1={PM.top} y2={h - PM.bottom} stroke="var(--ink-soft)" strokeDasharray="2 3" />
            <text
              x={x(monthX(mk.m)) + (x(monthX(mk.m)) > plotR - 90 ? -5 : 5)}
              y={h - PM.bottom - 8}
              textAnchor={x(monthX(mk.m)) > plotR - 90 ? "end" : "start"}
              fontSize={12}
              fill="var(--ink-soft)"
              stroke="var(--surface)"
              strokeWidth={3}
              paintOrder="stroke"
              className="ui"
            >
              {mk.label}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.id}>
            {s.band && s.band.length > 1 && (
              <path
                d={
                  area<{ m: string; lo: number; hi: number }>()
                    .x((d) => x(monthX(d.m)))
                    .y0((d) => y(d.lo))
                    .y1((d) => y(d.hi))
                    .defined((d) => Number.isFinite(d.lo) && Number.isFinite(d.hi) && (!log || d.lo > 0))(s.band) ?? ""
                }
                fill={s.color}
                opacity={0.16}
              />
            )}
            <path d={lineGen(s.points) ?? ""} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.5} strokeDasharray={s.dashed ? "6 4" : undefined} strokeLinejoin="round" />
            {s.dots && s.points.map((p) => <circle key={p.m} cx={x(p.x ?? monthX(p.m))} cy={y(p.y)} r={2.4} fill={s.color} />)}
          </g>
        ))}
        {placed.map((l) => {
          const src = props.labels?.find((q) => q.id === l.id);
          return (
            <g key={l.id}>
              {src && <circle cx={x(monthX(src.m))} cy={y(src.y)} r={4} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.5} />}
              <text x={l.x} y={l.y} textAnchor={l.anchor} fontSize={12} fill="var(--ink)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" className="ui">
                {l.text}
              </text>
            </g>
          );
        })}
        {endLabels.map((s) => (
          <text key={`l${s.id}`} x={plotR + 8} y={(labelY.get(s.id) ?? 0) + 4} fontSize={13} fontWeight={600} fill={s.color === "var(--human)" ? "var(--human-deep)" : s.color} className="ui">
            {wrapped.get(s.id)!.map((ln2, i) => (
              <tspan key={i} x={plotR + 8} dy={i === 0 ? 0 : 14}>
                {ln2}
              </tspan>
            ))}
          </text>
        ))}
        {hm && (
          <g pointerEvents="none">
            <line x1={x(monthX(hm))} x2={x(monthX(hm))} y1={PM.top} y2={h - PM.bottom} stroke="var(--ink)" strokeWidth={1} />
            {hoverRows.map((r) => (
              <circle key={r.s.id} cx={x(monthX(hm))} cy={y(r.p!.y)} r={4.5} fill="var(--surface)" stroke={r.s.color} strokeWidth={2.5} />
            ))}
          </g>
        )}
      </svg>
      {hm && hoverRows.length > 0 && (
        <div
          className="ui pointer-events-none absolute z-10 max-w-[260px] rounded border border-rule bg-surface px-2.5 py-1.5 text-[0.82rem] shadow-md"
          style={{ left: Math.min(Math.max(8, w - 270), Math.max(PM.left, x(monthX(hm)) + 12)), top: PM.top }}
        >
          <div className="font-semibold">{monthLabel(hm)}</div>
          {hoverRows.map((r) => (
            <div key={r.s.id} className="mt-0.5">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.s.color }} />
                {r.s.label}: <span className="num">{props.yFormat(r.p!.y)}</span>
              </div>
              {r.p!.note && <div className="pl-3.5 text-ink-soft">{r.p!.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Model scatter                                                       */
/* ------------------------------------------------------------------ */

export type ScatterDot = { id: string; x: number; y: number; r: number; color: string; faint?: boolean; title: string; sub: string };
export type FrontierLine = { id: string; label: string; color: string; dashed?: boolean; pts: [number, number][] };

const SM = { top: 34, right: 14, bottom: 48, left: 58 };

export function ModelScatter(props: {
  dots: ScatterDot[];
  frontiers: FrontierLine[];
  labelIds: string[];
  bar: { x: number; y: number | null; label: string } | null;
  refs: { x: number; label: string }[];
  xDomain: [number, number];
  yDomain: [number, number];
  height?: number;
  ariaLabel: string;
  xLabel: string;
  yLabel: string;
  yFormat: (n: number) => string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = props.height ?? 440;
  const [hov, setHov] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  if (!w) return <div ref={ref} style={{ height: h }} />;

  const x = scaleLinear().domain(props.xDomain).range([SM.left, w - SM.right]) as unknown as Num;
  const y = scaleLog().domain(props.yDomain).range([h - SM.bottom, SM.top]) as unknown as Num;
  const yTicks = logTicks(props.yDomain[0], props.yDomain[1]);
  const xTicks = x.ticks(Math.max(3, Math.floor(w / 90)));
  const showId = hov ?? sel;
  const shown = props.dots.find((d) => d.id === showId);

  const labelItems = props.labelIds
    .map((id) => props.dots.find((d) => d.id === id))
    .filter((d): d is ScatterDot => Boolean(d))
    .map((d) => ({ id: d.id, x: x(d.x), y: y(d.y), text: d.title }));
  const placed = placeLabels(labelItems, { x0: SM.left + 2, x1: w - SM.right, y0: SM.top + 4, y1: h - SM.bottom - 2 });

  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={h} role="img" aria-label={props.ariaLabel}>
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={SM.left} x2={w - SM.right} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={SM.left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={AXIS} className="ui">
              {props.yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={SM.top} y2={h - SM.bottom} stroke={GRID} strokeOpacity={0.5} />
            <text x={x(t)} y={h - SM.bottom + 17} textAnchor="middle" fontSize={12} fill={AXIS} className="ui">
              {t}
            </text>
          </g>
        ))}
        <text x={(SM.left + w - SM.right) / 2} y={h - 6} textAnchor="middle" fontSize={13} fill="var(--ink-soft)" className="ui">
          {props.xLabel}
        </text>
        <text transform={`translate(14 ${(SM.top + h - SM.bottom) / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill="var(--ink-soft)" className="ui">
          {props.yLabel}
        </text>

        {props.refs.map((r) => (
          <g key={r.label}>
            <line x1={x(r.x)} x2={x(r.x)} y1={SM.top - 6} y2={h - SM.bottom} stroke="var(--ink-faint)" strokeDasharray="2 3" />
            <text x={x(r.x)} y={SM.top - 9} textAnchor="middle" fontSize={12} fill="var(--ink-soft)" className="ui">
              {r.label}
            </text>
          </g>
        ))}
        {props.bar && (
          <g>
            <line x1={x(props.bar.x)} x2={x(props.bar.x)} y1={SM.top - 20} y2={h - SM.bottom} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="6 4" />
            <text x={x(props.bar.x)} y={SM.top - 23} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--ink)" className="ui">
              {props.bar.label}
            </text>
            {props.bar.y !== null && <circle cx={x(props.bar.x)} cy={y(props.bar.y)} r={6} fill="none" stroke="var(--ink)" strokeWidth={2} />}
          </g>
        )}

        {props.frontiers.map((f) => {
          if (f.pts.length === 0) return null;
          const pts: [number, number][] = [[props.xDomain[0], f.pts[0][1]], ...f.pts];
          const d = line<[number, number]>().x((p) => x(p[0])).y((p) => y(p[1])).curve(curveStepBefore)(pts) ?? "";
          const last = f.pts[f.pts.length - 1];
          return (
            <g key={f.id}>
              <path d={d} fill="none" stroke={f.color} strokeWidth={2.25} strokeDasharray={f.dashed ? "6 4" : undefined} strokeLinejoin="round" />
              <text x={x(last[0]) - 6} y={y(last[1]) - 8} textAnchor="end" fontSize={12} fontWeight={600} fill={f.color} stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" className="ui">
                {f.label}
              </text>
            </g>
          );
        })}

        {props.dots.map((d) => (
          <g key={d.id} style={{ transform: `translate(${x(d.x)}px, ${y(d.y)}px)`, transition: "transform 450ms ease" }}>
            <circle
              r={d.r}
              fill={d.color}
              fillOpacity={d.faint ? 0.4 : 0.62}
              stroke={d.id === showId ? "var(--ink)" : "var(--surface)"}
              strokeWidth={d.id === showId ? 2 : 0.8}
              style={{ cursor: "pointer", transition: "r 450ms ease" }}
              onPointerEnter={() => setHov(d.id)}
              onPointerLeave={() => setHov(null)}
              onClick={() => setSel((s) => (s === d.id ? null : d.id))}
            />
          </g>
        ))}

        {placed.map((l) => (
          <text key={l.id} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={12} fill="var(--ink)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" className="ui" pointerEvents="none">
            {l.text}
          </text>
        ))}
      </svg>
      {shown && (
        <div
          className="ui pointer-events-none absolute z-10 max-w-[250px] rounded border border-rule bg-surface px-2.5 py-1.5 text-[0.82rem] shadow-md"
          style={{ left: Math.min(Math.max(8, w - 260), Math.max(8, x(shown.x) + 12)), top: Math.max(4, y(shown.y) - 62) }}
        >
          <div className="font-semibold">{shown.title}</div>
          <div className="text-ink-soft">{shown.sub}</div>
        </div>
      )}
    </div>
  );
}
