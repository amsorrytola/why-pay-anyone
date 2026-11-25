"use client";

import { useMemo, type ReactNode } from "react";
import { area, line, curveMonotoneX } from "d3-shape";
import { useWidth } from "@/components/charts";

/** A tiny trend line that draws itself in as it scrolls into view. Values are plotted in order; set log for ratios that span orders of magnitude. */
export function Spark(props: { values: number[]; color?: string; height?: number; log?: boolean; label: string; fill?: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = props.height ?? 64;
  const color = props.color ?? "var(--ai)";
  const geo = useMemo(() => {
    const v = props.log ? props.values.map((x) => Math.log(Math.max(x, 1e-9))) : props.values;
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    const span = hi - lo || 1;
    const pts = v.map((x, i) => [(i / (v.length - 1)) * (w - 6) + 3, h - 6 - ((x - lo) / span) * (h - 12)] as [number, number]);
    const l = line().curve(curveMonotoneX)(pts) ?? "";
    const a = area<[number, number]>().x((d) => d[0]).y0(h).y1((d) => d[1]).curve(curveMonotoneX)(pts) ?? "";
    return { l, a, last: pts[pts.length - 1] };
  }, [props.values, props.log, w, h]);
  if (!w) return <div ref={ref} style={{ height: h }} />;
  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={h} role="img" aria-label={props.label} className="block overflow-visible">
        {props.fill !== false && <path d={geo.a} fill={color} fillOpacity={0.1} />}
        <path d={geo.l} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" pathLength={1} data-draw />
        <circle cx={geo.last[0]} cy={geo.last[1]} r={4.5} fill="var(--surface)" stroke={color} strokeWidth={2.5} />
      </svg>
    </div>
  );
}

/** A slow, endless strip of facts. Pauses on hover; reduced-motion users get a plain scrollable row. */
export function Marquee(props: { items: ReactNode[]; seconds?: number; label: string }) {
  return (
    <div className="marquee" role="region" aria-label={props.label}>
      <div className="marquee-track" style={{ ["--dur" as string]: `${props.seconds ?? 70}s` }}>
        {[0, 1].map((k) => (
          <ul key={k} aria-hidden={k === 1} className="flex shrink-0 items-center gap-12 pr-12">
            {props.items.map((it, i) => (
              <li key={i} className="whitespace-nowrap">
                {it}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
