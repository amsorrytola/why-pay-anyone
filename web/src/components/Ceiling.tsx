"use client";

import { useRef, useState } from "react";
import { useWidth } from "./charts";
import type { M4Params, M4Result } from "@/models/m4";

/**
 * The wage ceiling, drawn. Each column is one task, from the tasks people are best at (left) to the tasks
 * AI finds easiest (right). A column's height is what one unit of the task costs, in units of a person's cost at
 * their best task. Amber: done by a person. Cobalt: done by AI, so the cost is cut to the ceiling.
 * The hatched ghost above a cobalt column is what a person would have cost.
 */
export function CeilingChart(props: { p: M4Params; r: M4Result; height?: number; onRhoScale?: (factor: number) => void; intro?: boolean }) {
  const { p, r } = props;
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = props.height ?? 360;
  const narrow = w < 600;
  const m = { top: 34, right: 16, bottom: 58, left: 46 };
  const iw = w - m.left - m.right;
  const ih = h - m.top - m.bottom;
  const ymax = Math.max(1.15, Math.exp(p.theta) * 1.08);
  const x0 = -p.n;
  const span = 1 + p.n;
  const xOf = (i: number) => m.left + ((i - x0) / span) * iw;
  const yOf = (c: number) => m.top + ih - (Math.min(c, ymax) / ymax) * ih;
  const ai = r.R / r.w;
  const colW = Math.max(1.5, iw / r.tasks.length - 1.2);
  const dragRef = useRef<{ startY: number; startAi: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  if (!w) return <div ref={ref} style={{ height: h }} />;

  const yTicks = [0, 1, 2, 3, 4].filter((t) => t <= ymax);
  const feasibleStart = 1 - p.A;

  function onDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startAi: ai };
    setDragging(true);
  }
  function onMove(e: React.PointerEvent) {
    if (!dragRef.current || !props.onRhoScale) return;
    const dy = dragRef.current.startY - e.clientY; // up is positive
    const target = Math.max(0.004, dragRef.current.startAi + (dy / ih) * ymax);
    props.onRhoScale(target / ai);
    dragRef.current = { startY: e.clientY, startAi: target };
  }
  function onUp() {
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div ref={ref} className="w-full select-none">
      <svg width={w} height={h} role="img" aria-label="Chart of the cost of each task for a person and for AI. Tasks where AI is cheaper and capable are done by AI, so their cost is cut to the AI price.">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={w - m.right} y1={yOf(t)} y2={yOf(t)} stroke="var(--rule)" />
            <text x={m.left - 8} y={yOf(t) + 4} textAnchor="end" fontSize={12} fill="var(--ink-faint)" className="ui">
              {t === 0 ? "0" : `${t}×`}
            </text>
          </g>
        ))}

        {/* what AI can do */}
        <rect x={xOf(feasibleStart)} y={m.top} width={Math.max(0, w - m.right - xOf(feasibleStart))} height={ih} fill="var(--ai-soft)" opacity={0.55} />
        <text x={xOf(feasibleStart) + 8} y={m.top + 16} fontSize={12.5} fontWeight={600} fill="var(--ai-deep)" className="ui">
          Work AI can do
        </text>
        {p.n > 0 && (
          <g>
            <rect x={m.left} y={m.top} width={xOf(0) - m.left} height={ih} fill="var(--human-soft)" opacity={0.55} />
            <text x={m.left + 8} y={m.top + 16} fontSize={12.5} fontWeight={600} fill="var(--human-deep)" className="ui">
              New human-only tasks
            </text>
          </g>
        )}

        {r.tasks.map((t, j) => {
          const human = Math.exp(p.theta * t.i);
          const x = xOf(t.i) - colW / 2;
          if (t.automated) {
            return (
              <g key={j}>
                <rect x={x} y={yOf(human)} width={colW} height={Math.max(0, yOf(Math.min(human, ymax)) - 0)} fill="none" />
                <rect x={x} y={yOf(human)} width={colW} height={Math.max(0, yOf(ai) - yOf(human))} fill="var(--human)" opacity={0.38} />
                <rect x={x} y={yOf(ai)} width={colW} height={Math.max(0, yOf(0) - yOf(ai))} fill="var(--ai)" style={{ transition: "y 0.25s, height 0.25s" }} />
              </g>
            );
          }
          return <rect key={j} x={x} y={yOf(human)} width={colW} height={Math.max(0, yOf(0) - yOf(human))} fill="var(--human)" />;
        })}

        {/* the ceiling */}
        <g className={props.intro ? "ceiling-intro" : undefined} style={{ ["--from" as string]: "-90px" }}>
          <line x1={m.left} x2={w - m.right} y1={yOf(ai)} y2={yOf(ai)} stroke="var(--ai-deep)" strokeWidth={3} />
          <rect
            x={w - m.right - 150}
            y={yOf(ai) - 15}
            width={150}
            height={26}
            rx={13}
            fill="var(--ai-deep)"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
          />
          <text x={w - m.right - 75} y={yOf(ai) + 3} textAnchor="middle" fontSize={13} fontWeight={600} fill="#fff" className="ui" pointerEvents="none">
            ⇅ AI price: drag
          </text>
        </g>

        <line x1={m.left} x2={w - m.right} y1={yOf(0)} y2={yOf(0)} stroke="var(--ink)" />
        <text x={m.left} y={h - 30} fontSize={12.5} fill="var(--ink-soft)" className="ui">
          {narrow ? "People's best tasks" : "Tasks people are best at"}
        </text>
        <text x={w - m.right} y={h - 30} textAnchor="end" fontSize={12.5} fill="var(--ink-soft)" className="ui">
          {narrow ? "AI's easiest" : "Tasks AI finds easiest"}
        </text>
        <text x={m.left} y={h - 10} fontSize={12.5} fill="var(--ink-faint)" className="ui">
          {narrow ? "Cost per task (a person's best task = 1)" : "Height: cost of one unit of the task, in multiples of a person's cost at their best task"}
        </text>
      </svg>
    </div>
  );
}
