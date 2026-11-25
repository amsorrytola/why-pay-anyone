"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { area, line, stack, stackOffsetExpand, stackOffsetNone, curveMonotoneX } from "d3-shape";
import { bisector, extent, max, min } from "d3-array";

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0); // 0 until measured, so charts render on the client only and never mismatch server HTML
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(280, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}


/** On a log axis, label only 1-2-5 ticks (only powers of ten when narrow) so the labels never run together. */
function thinLog(ticks: number[], isLog: boolean | undefined, narrow: boolean) {
  if (!isLog) return ticks;
  const keep = narrow ? [1] : [1, 2, 5];
  const f = ticks.filter((v) => keep.includes(Number(Math.abs(v).toExponential(0)[0])));
  return f.length >= 2 ? f : ticks;
}

type NumScale = ((v: number) => number) & { ticks: (n?: number) => number[]; nice: () => unknown; invert: (v: number) => number };
const M = { top: 14, right: 12, bottom: 30, left: 52 };
const AXIS = "var(--ink-faint)";
const GRID = "var(--rule)";

export type LineSeries = {
  id: string;
  label: string;
  color: string;
  points: [number, number][];
  dashed?: boolean;
  width?: number;
  band?: [number, number, number][];
  noLabel?: boolean;
};

export function fmtYear(n: number) {
  const y = Math.floor(n);
  const m = Math.floor((n - y) * 12 + 0.01);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Math.min(11, m)]} ${y}`;
}

/** Spread labels vertically so they do not collide. */
function spread(items: { y: number; key: string }[], gap: number, lo: number, hi: number) {
  const s = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < s.length; i++) if (s[i].y - s[i - 1].y < gap) s[i].y = s[i - 1].y + gap;
  const over = s.length ? s[s.length - 1].y - hi : 0;
  if (over > 0) for (const it of s) it.y -= over;
  for (const it of s) it.y = Math.max(lo, it.y);
  return new Map(s.map((i) => [i.key, i.y]));
}

export function LineChart(props: {
  series: LineSeries[];
  height?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  log?: boolean;
  xFormat?: (n: number) => string;
  yFormat?: (n: number) => string;
  xTicks?: number;
  markers?: { x: number; label: string }[];
  hlines?: { y: number; label: string; color?: string }[];
  ariaLabel: string;
  rightPad?: number;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = props.height ?? 340;
  const rightPad = props.rightPad ?? Math.min(150, w * 0.22);
  const xf = props.xFormat ?? ((n: number) => String(n));
  const yf = props.yFormat ?? ((n: number) => String(n));
  const [hoverX, setHoverX] = useState<number | null>(null);

  const all = props.series.flatMap((s) => s.points);
  const xd = props.xDomain ?? (extent(all, (d) => d[0]) as [number, number]);
  const ys = [...all.map((d) => d[1]), ...props.series.flatMap((s) => (s.band ?? []).flatMap((b) => [b[1], b[2]]))].filter((v) => !props.log || v > 0);
  const yd: [number, number] = props.yDomain ?? [props.log ? (min(ys) as number) * 0.8 : Math.min(0, min(ys) as number), (max(ys) as number) * (props.log ? 1.25 : 1.06)];
  const x = scaleLinear().domain(xd).range([M.left, w - M.right - rightPad]);
  const y = (props.log ? scaleLog().domain(yd).range([h - M.bottom, M.top]) : scaleLinear().domain(yd).range([h - M.bottom, M.top]).nice()) as ReturnType<typeof scaleLinear>;
  const yTicks = thinLog(props.log ? (y as unknown as ReturnType<typeof scaleLog>).ticks(5) : y.ticks(5), props.log, h < 300 || w < 520);
  const xTicks = x.ticks(props.xTicks ?? Math.max(3, Math.floor(w / 110)));
  const ln = line<[number, number]>().x((d) => x(d[0])).y((d) => y(d[1]) as number).defined((d) => Number.isFinite(d[1]) && (!props.log || d[1] > 0));

  const labelY = spread(
    props.series.filter((s) => !s.noLabel && s.points.length).map((s) => ({ key: s.id, y: y(s.points[s.points.length - 1][1]) as number })),
    15,
    M.top + 6,
    h - M.bottom,
  );

  const hover = useMemo(() => {
    if (hoverX === null) return null;
    const rows = props.series
      .map((s) => {
        const b = bisector((d: [number, number]) => d[0]).center(s.points, hoverX);
        return { s, p: s.points[b] };
      })
      .filter((r) => r.p);
    return rows.length ? rows : null;
  }, [hoverX, props.series]);

  if (!w) return <div ref={ref} style={{ height: h }} />;
  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={props.ariaLabel}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = e.clientX - r.left;
          setHoverX(px >= M.left && px <= w - M.right - rightPad ? x.invert(px) : null);
        }}
        onMouseLeave={() => setHoverX(null)}
      >
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={w - M.right - rightPad} y1={y(t) as number} y2={y(t) as number} stroke={GRID} strokeWidth={1} />
            <text x={M.left - 8} y={(y(t) as number) + 4} textAnchor="end" fontSize={12} fill={AXIS} className="ui">
              {yf(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={`x${t}`} x={x(t)} y={h - 8} textAnchor="middle" fontSize={12} fill={AXIS} className="ui">
            {xf(t)}
          </text>
        ))}
        {props.hlines?.map((l) => (
          <g key={l.label}>
            <line x1={M.left} x2={w - M.right - rightPad} y1={y(l.y) as number} y2={y(l.y) as number} stroke={l.color ?? "var(--ink-soft)"} strokeDasharray="5 4" strokeWidth={1.25} />
            <text x={M.left + 4} y={(y(l.y) as number) - 5} fontSize={12} fill={l.color ?? "var(--ink-soft)"} className="ui">
              {l.label}
            </text>
          </g>
        ))}
        {props.markers?.map((m) => (
          <g key={m.label}>
            <line x1={x(m.x)} x2={x(m.x)} y1={M.top} y2={h - M.bottom} stroke="var(--ink-soft)" strokeDasharray="2 3" />
            <text x={x(m.x) + 5} y={M.top + 11} fontSize={12} fill="var(--ink-soft)" className="ui">
              {m.label}
            </text>
          </g>
        ))}
        {props.series.map((s) => (
          <g key={s.id}>
            {s.band && (
              <path
                d={
                  area<[number, number, number]>()
                    .x((d) => x(d[0]))
                    .y0((d) => y(d[1]) as number)
                    .y1((d) => y(d[2]) as number)(s.band) ?? ""
                }
                fill={s.color}
                opacity={0.14}
              />
            )}
            <path d={ln(s.points) ?? ""} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.5} strokeDasharray={s.dashed ? "6 4" : undefined} strokeLinejoin="round" strokeLinecap="round" {...(s.dashed ? {} : { pathLength: 1, "data-draw": "" })} />
            {!s.noLabel && s.points.length > 0 && (
              <text x={w - M.right - rightPad + 8} y={(labelY.get(s.id) ?? 0) + 4} fontSize={13} fontWeight={600} fill={s.color} className="ui">
                {s.label}
              </text>
            )}
          </g>
        ))}
        {hover && hoverX !== null && (
          <g pointerEvents="none">
            <line x1={x(hover[0].p[0])} x2={x(hover[0].p[0])} y1={M.top} y2={h - M.bottom} stroke="var(--ink)" strokeWidth={1} />
            {hover.map((r) => (
              <circle key={r.s.id} cx={x(r.p[0])} cy={y(r.p[1]) as number} r={4.5} fill="var(--surface)" stroke={r.s.color} strokeWidth={2.5} />
            ))}
          </g>
        )}
      </svg>
      {hover && (
        <div
          className="ui pointer-events-none absolute z-10 rounded border border-rule bg-surface px-2.5 py-1.5 text-[0.82rem] shadow-md"
          style={{ left: Math.min(w - 190, Math.max(M.left, x(hover[0].p[0]) + 12)), top: M.top }}
        >
          <div className="font-semibold">{xf(hover[0].p[0])}</div>
          {hover.map((r) => (
            <div key={r.s.id} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.s.color }} />
              {r.s.label}: <span className="num">{yf(r.p[1])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type Pt = { id: string; x: number; y: number; r?: number; color?: string; label?: string; sub?: string; dim?: boolean };

export function Scatter(props: {
  points: Pt[];
  height?: number;
  xLog?: boolean;
  yLog?: boolean;
  xLabel: string;
  yLabel: string;
  xFormat?: (n: number) => string;
  yFormat?: (n: number) => string;
  ariaLabel: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  guides?: ReactNode;
  onPick?: (id: string) => void;
  highlight?: string | null;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = props.height ?? 420;
  const [hov, setHov] = useState<string | null>(null);
  const xf = props.xFormat ?? ((n: number) => String(n));
  const yf = props.yFormat ?? ((n: number) => String(n));
  const pts = props.points;
  const xd = props.xDomain ?? (extent(pts, (p) => p.x) as [number, number]);
  const yd = props.yDomain ?? (extent(pts, (p) => p.y) as [number, number]);
  const left = 58;
  const x = (props.xLog ? scaleLog() : scaleLinear()).domain(xd).range([left, w - 14]) as unknown as NumScale;
  const y = (props.yLog ? scaleLog() : scaleLinear()).domain(yd).range([h - 44, 12]) as unknown as NumScale;
  if (!props.yLog) y.nice();
  if (!props.xLog) x.nice();
  const hp = pts.find((p) => p.id === (hov ?? props.highlight));
  if (!w) return <div ref={ref} style={{ height: h }} />;
  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={h} role="img" aria-label={props.ariaLabel}>
        {thinLog(y.ticks(5), props.yLog, w < 520).map((t) => (
          <g key={`y${t}`}>
            <line x1={left} x2={w - 14} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={AXIS} className="ui">
              {yf(t)}
            </text>
          </g>
        ))}
        {thinLog(x.ticks(Math.max(3, Math.floor(w / 100))), props.xLog, w < 520).map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={12} y2={h - 44} stroke={GRID} strokeOpacity={0.5} />
            <text x={x(t)} y={h - 26} textAnchor="middle" fontSize={12} fill={AXIS} className="ui">
              {xf(t)}
            </text>
          </g>
        ))}
        <text x={(left + w) / 2} y={h - 6} textAnchor="middle" fontSize={13} fill="var(--ink-soft)" className="ui">
          {props.xLabel}
        </text>
        <text transform={`translate(14 ${h / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill="var(--ink-soft)" className="ui">
          {props.yLabel}
        </text>
        {props.guides}
        {pts.map((p) => (
          <circle
            key={p.id}
            cx={x(p.x)}
            cy={y(p.y)}
            r={p.r ?? 4}
            fill={p.color ?? "var(--ai)"}
            fillOpacity={p.dim ? 0.12 : 0.62}
            stroke={p.id === (hov ?? props.highlight) ? "var(--ink)" : "var(--surface)"}
            strokeWidth={p.id === (hov ?? props.highlight) ? 2 : 0.6}
            onMouseEnter={() => setHov(p.id)}
            onMouseLeave={() => setHov(null)}
            onClick={() => props.onPick?.(p.id)}
            style={{ cursor: props.onPick ? "pointer" : "default" }}
          />
        ))}
      </svg>
      {hp && (
        <div className="ui pointer-events-none absolute z-10 max-w-[260px] rounded border border-rule bg-surface px-2.5 py-1.5 text-[0.82rem] shadow-md" style={{ left: Math.min(w - 270, Math.max(8, x(hp.x) + 10)), top: Math.max(4, y(hp.y) - 50) }}>
          <div className="font-semibold">{hp.label ?? hp.id}</div>
          {hp.sub && <div className="text-ink-soft">{hp.sub}</div>}
        </div>
      )}
    </div>
  );
}

export function HBars(props: {
  items: { label: string; value: number; color?: string; note?: string }[];
  format?: (n: number) => string;
  max?: number;
  labelWidth?: number;
  rowHeight?: number;
  ariaLabel: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const rh = props.rowHeight ?? 28;
  const lw = Math.min(props.labelWidth ?? 190, w * 0.42);
  const mx = props.max ?? (max(props.items, (d) => d.value) as number);
  const f = props.format ?? ((n: number) => String(n));
  const x = scaleLinear().domain([0, mx]).range([0, w - lw - 70]);
  if (!w) return <div ref={ref} style={{ height: props.items.length * rh + 4 }} />;
  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={props.items.length * rh + 4} role="img" aria-label={props.ariaLabel}>
        {props.items.map((d, i) => (
          <g key={d.label} transform={`translate(0 ${i * rh})`}>
            <text x={lw - 8} y={rh / 2 + 4} textAnchor="end" fontSize={13} fill="var(--ink)" className="ui">
              {d.label.length > Math.floor((lw - 10) / 7.4) ? d.label.slice(0, Math.max(5, Math.floor((lw - 10) / 7.4) - 1)) + "…" : d.label}
            </text>
            <rect x={lw} y={4} width={Math.max(1, x(Math.max(0, d.value)))} height={rh - 8} fill={d.color ?? "var(--ai)"} rx={2} />
            <text x={lw + Math.max(1, x(Math.max(0, d.value))) + 6} y={rh / 2 + 4} fontSize={12.5} fill="var(--ink-soft)" className="num">
              {f(d.value)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function StackedArea(props: {
  xs: number[];
  series: { id: string; label: string; color: string; values: number[] }[];
  normalize?: boolean;
  height?: number;
  xFormat?: (n: number) => string;
  yFormat?: (n: number) => string;
  ariaLabel: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = props.height ?? 340;
  const rightPad = Math.min(130, w * 0.2);
  const xf = props.xFormat ?? ((n: number) => String(n));
  const yf = props.yFormat ?? ((n: number) => (props.normalize ? `${Math.round(n * 100)}%` : String(n)));
  const rows = props.xs.map((_, i) => Object.fromEntries(props.series.map((s) => [s.id, s.values[i] ?? 0])));
  const st = stack<Record<string, number>>().keys(props.series.map((s) => s.id)).offset(props.normalize ? stackOffsetExpand : stackOffsetNone)(rows);
  const x = scaleLinear().domain(extent(props.xs) as [number, number]).range([M.left, w - M.right - rightPad]);
  const top = props.normalize ? 1 : (max(st[st.length - 1], (d) => d[1]) as number);
  const y = scaleLinear().domain([0, top]).range([h - M.bottom, M.top]);
  const ar = area<[number, number]>().x((_, i) => x(props.xs[i])).y0((d) => y(d[0])).y1((d) => y(d[1])).curve(curveMonotoneX);
  const [hi, setHi] = useState<number | null>(null);
  if (!w) return <div ref={ref} style={{ height: h }} />;
  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={props.ariaLabel}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const v = x.invert(e.clientX - r.left);
          setHi(bisector((d: number) => d).center(props.xs, v));
        }}
        onMouseLeave={() => setHi(null)}
      >
        {y.ticks(5).map((t) => (
          <g key={t}>
            <line x1={M.left} x2={w - M.right - rightPad} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={AXIS} className="ui">
              {yf(t)}
            </text>
          </g>
        ))}
        {x.ticks(Math.max(3, Math.floor(w / 110))).map((t) => (
          <text key={t} x={x(t)} y={h - 8} textAnchor="middle" fontSize={12} fill={AXIS} className="ui">
            {xf(t)}
          </text>
        ))}
        {st.map((s, i) => {
          const last = s[s.length - 1];
          const mid = (y(last[0]) + y(last[1])) / 2;
          return (
            <g key={s.key}>
              <path d={ar(s as unknown as [number, number][]) ?? ""} fill={props.series[i].color} fillOpacity={0.86} stroke="var(--surface)" strokeWidth={0.75} />
              {Math.abs(y(last[0]) - y(last[1])) > 12 && (
                <text x={w - M.right - rightPad + 8} y={mid + 4} fontSize={12.5} fontWeight={600} fill="var(--ink)" className="ui">
                  {props.series[i].label}
                </text>
              )}
            </g>
          );
        })}
        {hi !== null && <line x1={x(props.xs[hi])} x2={x(props.xs[hi])} y1={M.top} y2={h - M.bottom} stroke="var(--ink)" />}
      </svg>
      {hi !== null && (
        <div className="ui pointer-events-none absolute z-10 rounded border border-rule bg-surface px-2.5 py-1.5 text-[0.82rem] shadow-md" style={{ left: Math.min(w - 200, x(props.xs[hi]) + 12), top: M.top }}>
          <div className="font-semibold">{xf(props.xs[hi])}</div>
          {[...props.series]
            .map((s, i) => ({ s, v: st[i][hi][1] - st[i][hi][0] }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 6)
            .map(({ s, v }) => (
              <div key={s.id} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}: <span className="num">{props.normalize ? `${(v * 100).toFixed(1)}%` : yf(v)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
