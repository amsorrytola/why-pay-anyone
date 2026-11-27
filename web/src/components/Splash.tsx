"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SITE_LINKS } from "@/components/site";

export type SplashPoint = { month: string; price: number; model: string };

const DRAW_DELAY = 550;
const DRAW_MS = 2500;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmtMonth = (m: string) => {
  const [y, mo] = m.split("-");
  return `${MONTHS[Number(mo) - 1]} ${y}`;
};
const fmtPrice = (p: number) => (p >= 1 ? p.toFixed(2) : p.toFixed(3));
const fmtRatio = (r: number) => (r < 10 ? r.toFixed(1) : Math.round(r).toLocaleString("en-US"));
const cleanModel = (m: string) => m.replace(/\s*\(.*\)\s*$/, "");
const ease = (k: number) => 0.5 - Math.cos(Math.PI * k) / 2;

type Vertex = { x: number; y: number; c: number };
type Geo = {
  w: number;
  h: number;
  top: number;
  bot: number;
  base: number;
  lmax: number;
  lmin: number;
  v: Vertex[];
  drops: Vertex[];
  total: number;
  X: (i: number) => number;
  Y: (p: number) => number;
};

/** The step line of the cheapest price, in pixels for a stage of w by h, with the cumulative length at each corner. */
function geometry(series: SplashPoint[], w: number, h: number, labelH: number): Geo {
  const n = series.length;
  const prices = series.map((s) => s.price);
  const lmax = Math.log(Math.max(...prices));
  const lmin = Math.log(Math.min(...prices));
  const base = h - 24;
  const top = Math.max(h * 0.25, labelH + 28);
  const bot = Math.min(h * 0.9, base - 16);
  const X = (i: number) => (i / (n - 1)) * w;
  const Y = (p: number) => top + ((lmax - Math.log(p)) / (lmax - lmin)) * (bot - top);
  const v: Vertex[] = [{ x: 0, y: Y(prices[0]), c: 0 }];
  const drops: Vertex[] = [];
  const push = (x: number, y: number) => {
    const a = v[v.length - 1];
    v.push({ x, y, c: a.c + Math.hypot(x - a.x, y - a.y) });
  };
  for (let i = 1; i < n; i++) {
    push(X(i), Y(prices[i - 1]));
    if (prices[i] !== prices[i - 1]) {
      push(X(i), Y(prices[i]));
      drops.push(v[v.length - 1]);
    }
  }
  return { w, h, top, bot, base, lmax, lmin, v, drops, total: v[v.length - 1].c, X, Y };
}

/**
 * The cover, shown on every visit. The cheapest price of GPT-4-level AI draws itself month by month, from
 * September 2023 to November 2026, as a falling staircase; the price rides the tip of the line and counts down
 * as it falls. When the line lands, the title appears in the space the fall has emptied and the reader picks
 * the guided reading or the page they came for. A click on the chart skips to the end; Esc or Skip closes it.
 */
/** Pages that people open from a direct link (an email, the report's title page): they open straight away, without the cover. */
const NO_COVER = new Set(["/presentation", "/report"]);

export function Splash({ series }: { series: SplashPoint[] }) {
  const router = useRouter();
  const path = usePathname();
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");
  const [done, setDone] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number; lh: number } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const dotsRef = useRef<SVGGElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLSpanElement>(null);
  const metaRef = useRef<HTMLSpanElement>(null);
  const ratioRef = useRef<HTMLSpanElement>(null);
  const startRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const progress = useRef(0);
  const raf = useRef(0);

  const geo = useMemo(() => (size ? geometry(series, size.w, size.h, size.lh) : null), [series, size]);
  const first = series[0];
  const last = series[series.length - 1];

  /** Draws the line up to fraction p of its length and moves the price label with its tip. */
  const paint = useCallback(
    (p: number) => {
      const g = geo;
      const line = lineRef.current;
      const label = labelRef.current;
      if (!g || !line || !label || !(g.w > 0) || !(g.total > 0)) return;
      const s = p * g.total;
      let d = `M0 ${g.v[0].y.toFixed(1)}`;
      let hx = 0;
      let hy = g.v[0].y;
      for (let k = 1; k < g.v.length; k++) {
        const a = g.v[k - 1];
        const b = g.v[k];
        if (b.c <= s) {
          d += `L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
          hx = b.x;
          hy = b.y;
          continue;
        }
        const f = (s - a.c) / (b.c - a.c);
        hx = a.x + (b.x - a.x) * f;
        hy = a.y + (b.y - a.y) * f;
        d += `L${hx.toFixed(1)} ${hy.toFixed(1)}`;
        break;
      }
      line.setAttribute("d", d);
      headRef.current?.setAttribute("transform", `translate(${hx.toFixed(1)} ${hy.toFixed(1)})`);
      const dots = dotsRef.current?.children;
      if (dots) g.drops.forEach((dr, k) => dots[k]?.setAttribute("opacity", dr.c <= s + 0.5 ? "1" : "0"));

      const price = Math.exp(g.lmax - ((hy - g.top) / (g.bot - g.top)) * (g.lmax - g.lmin));
      const mi = Math.min(series.length - 1, Math.max(0, Math.floor((hx / g.w) * (series.length - 1) + 1e-6)));
      if (priceRef.current) priceRef.current.textContent = `$${fmtPrice(price)}`;
      if (metaRef.current) metaRef.current.textContent = `${fmtMonth(series[mi].month)}, ${cleanModel(series[mi].model)}`;
      const ratio = first.price / price;
      if (ratioRef.current) {
        ratioRef.current.textContent = `${fmtRatio(ratio)} times cheaper than in ${fmtMonth(first.month)}`;
        ratioRef.current.style.visibility = ratio > 1.05 ? "visible" : "hidden";
      }
      if (startRef.current) startRef.current.style.opacity = hx > 190 || p >= 1 ? "1" : "0";

      // The label sits above and to the right of the tip, clear of every part of the line already drawn under it.
      const lw = label.offsetWidth;
      const lh = label.offsetHeight;
      const lx = Math.max(0, Math.min(hx + 18, g.w - lw));
      let floor = hy;
      for (const q of g.v) if (q.c <= s && q.x >= lx - 6 && q.x <= lx + lw + 6) floor = Math.min(floor, q.y);
      let ly = Math.max(2, floor - lh - 16);
      const t = titleRef.current;
      if (p >= 1 && t && getComputedStyle(t).position === "absolute") {
        const tb = t.offsetTop + t.offsetHeight + 14;
        if (lx + lw > t.offsetLeft && ly < tb) ly = Math.max(ly, Math.min(tb, floor - lh - 4));
      }
      label.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
      label.style.opacity = "1";
    },
    [geo, series, first]
  );

  const finish = useCallback(() => {
    cancelAnimationFrame(raf.current);
    progress.current = 1;
    paint(1);
    setDone(true);
  }, [paint]);

  // Measure the stage, and measure it again when the window changes size.
  useEffect(() => {
    if (document.documentElement.dataset.splash === "seen" || NO_COVER.has(window.location.pathname)) {
      setPhase("gone");
      return;
    }
    document.documentElement.style.overflow = "hidden";
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setSize({ w: el.clientWidth, h: el.clientHeight, lh: labelRef.current?.offsetHeight ?? 90 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Run the drawing once the stage has a size; after a resize, repaint where it was.
  useEffect(() => {
    if (!geo) return;
    if (progress.current >= 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    const t0 = performance.now() + (progress.current > 0 ? 0 : DRAW_DELAY) - progress.current * DRAW_MS;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / DRAW_MS));
      progress.current = k;
      paint(ease(k));
      if (k < 1) raf.current = requestAnimationFrame(step);
      else setDone(true);
    };
    paint(ease(progress.current));
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [geo, paint, finish]);

  // Once the title is in, place the label clear of it and give the start button focus.
  useEffect(() => {
    if (!done) return;
    paint(1);
    const id = window.setTimeout(() => primaryRef.current?.focus({ preventScroll: true }), 700);
    return () => window.clearTimeout(id);
  }, [done, paint]);

  const close = useCallback((then?: () => void) => {
    cancelAnimationFrame(raf.current);
    setPhase("leaving");
    then?.();
    window.setTimeout(() => {
      document.documentElement.dataset.splash = "seen";
      document.documentElement.style.overflow = "";
      setPhase("gone");
    }, 450);
  }, []);

  useEffect(() => {
    if (phase !== "show") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, close]);

  if (phase === "gone" || NO_COVER.has(path)) return null;

  const here = SITE_LINKS.find((l) => l.href === path);
  const onJourney = path === "/journey";
  const primaryText = onJourney ? "Continue the guided reading" : "Start the guided reading";
  const secondaryText =
    path === "/" || onJourney ? "Go to the report" : here ? `Continue to ${here.n ? `chapter ${here.n}, ${here.label}` : here.label}` : "Continue to this page";
  const primary = () => close(onJourney ? undefined : () => router.push("/journey"));
  const secondary = () => close(onJourney ? () => router.push("/") : undefined);
  const ratio = first.price / last.price;
  const years = geo
    ? series.map((s, i) => ({ s, i })).filter(({ s }) => s.month.endsWith("-01")).map(({ s, i }) => ({ x: geo.X(i), label: s.month.slice(0, 4) }))
    : [];
  const grid = geo ? [10, 1, 0.1].filter((p) => geo.Y(p) > geo.top - 4 && geo.Y(p) < geo.bot) : [];

  return (
    <div
      id="splash"
      role="dialog"
      aria-modal="true"
      aria-labelledby="splash-title"
      className={`overflow-y-auto ${phase === "leaving" ? "splash-out" : ""}`}
    >
      <div className="mx-auto flex min-h-full max-w-[1280px] flex-col px-5 pb-5 pt-3 sm:px-8 lg:h-full lg:min-h-[600px]">
        <div className="ui rise flex items-center justify-between text-[0.86rem] text-ink-soft">
          <span>Lab Based Project, IIT Roorkee</span>
          <button type="button" onClick={() => close()} className="ui -mr-2 px-2 py-2 font-semibold text-ink underline-offset-4 hover:underline">
            Skip
          </button>
        </div>
        <div className="rule-double rule-draw" style={{ ["--d" as string]: "150ms" }} />

        <p className="sr-only">
          The cheapest price of AI at about GPT-4 level fell from ${fmtPrice(first.price)} per million tokens in {fmtMonth(first.month)} to $
          {fmtPrice(last.price)} in {fmtMonth(last.month)}, about {fmtRatio(ratio)} times cheaper.
        </p>

        <div className="relative mt-4 lg:min-h-0 lg:flex-1">
          <div
            ref={stageRef}
            onClick={() => !done && finish()}
            className="relative h-[clamp(240px,40vh,460px)] select-none lg:absolute lg:inset-0 lg:h-auto"
            aria-hidden
          >
            {geo && (
              <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${geo.w} ${geo.h}`}>
                {grid.map((p, i) => (
                  <g key={p} className="rise" style={{ ["--d" as string]: `${250 + i * 80}ms` }}>
                    <line x1={0} x2={geo.w} y1={geo.Y(p)} y2={geo.Y(p)} stroke="var(--rule)" strokeWidth={1} />
                    <text x={0} y={geo.Y(p) - 6} className="ui" fontSize={12} fill="var(--ink-faint)">
                      {p >= 1 ? `$${p}` : `$${p.toFixed(2)}`}
                      {i === 0 && geo.w >= 1000 ? " per million tokens" : ""}
                    </text>
                  </g>
                ))}
                <g className="rise" style={{ ["--d" as string]: "300ms" }}>
                  <line x1={0} x2={geo.w} y1={geo.base} y2={geo.base} stroke="var(--ink)" strokeWidth={1} />
                  {years.map((y) => (
                    <g key={y.label}>
                      <line x1={y.x} x2={y.x} y1={geo.base} y2={geo.base + 5} stroke="var(--ink)" />
                      <text x={y.x} y={geo.base + 18} textAnchor="middle" className="ui" fontSize={12} fill="var(--ink-soft)">
                        {y.label}
                      </text>
                    </g>
                  ))}
                </g>
                <path ref={lineRef} d="" fill="none" stroke="var(--ai)" strokeWidth={3} strokeLinejoin="miter" strokeLinecap="square" />
                <g ref={dotsRef}>
                  {geo.drops.map((dr) => (
                    <circle key={dr.c} cx={dr.x} cy={dr.y} r={3.5} fill="var(--paper)" stroke="var(--ai)" strokeWidth={2} opacity={0} className="splash-dot" />
                  ))}
                </g>
                <g ref={headRef} transform={`translate(0 ${geo.v[0].y})`}>
                  {!done && <circle r={6} fill="var(--ai)" className="splash-ping" />}
                  <circle r={6} fill="var(--ai)" stroke="var(--paper)" strokeWidth={2} />
                </g>
              </svg>
            )}

            <div
              ref={startRef}
              className="ui pointer-events-none absolute left-0 text-[0.8rem] leading-tight text-ink-soft transition-opacity duration-500"
              style={{ top: geo ? geo.v[0].y - 44 : 0, opacity: 0 }}
            >
              <span className="num block text-[1.05rem] text-ink">${fmtPrice(first.price)}</span>
              {fmtMonth(first.month)}, {cleanModel(first.model)}
            </div>

            <div ref={labelRef} className="pointer-events-none absolute left-0 top-0 whitespace-nowrap bg-paper py-1 pr-2 will-change-transform" style={{ opacity: 0 }}>
              <span ref={priceRef} className="num block text-[clamp(2.1rem,min(6vw,8.5vh),5rem)] leading-[0.95] tracking-[-0.03em] text-ai">
                ${fmtPrice(first.price)}
              </span>
              <span ref={metaRef} className="ui mt-1.5 block text-[0.8rem] text-ink-soft sm:text-[0.88rem]">
                {fmtMonth(first.month)}, {cleanModel(first.model)}
              </span>
              <span ref={ratioRef} className="ui block text-[0.8rem] font-bold text-ink sm:text-[0.88rem]" style={{ visibility: "hidden" }}>
                1 time cheaper
              </span>
            </div>
          </div>

          <div ref={titleRef} className="splash-title mt-6 lg:absolute lg:right-0 lg:top-0 lg:mt-0 lg:w-[47%] lg:bg-paper lg:pb-4 lg:pl-7 lg:pt-1" data-ready={done}>
            <h1 id="splash-title" className="text-[clamp(2.6rem,min(6.4vw,10vh),5.6rem)] leading-[1.02] tracking-[-0.015em]">
              {["Why", "Pay", "Anyone?"].map((w, i) => (
                <span key={w}>
                  <span className="word">
                    <span style={{ ["--d" as string]: `${i * 110}ms` }}>{w}</span>
                  </span>
                  {i < 2 ? " " : ""}
                </span>
              ))}
            </h1>
            <p data-a className="serif mt-2 text-[1.3rem] italic text-ink-soft" style={{ ["--d" as string]: "300ms" }}>
              The economics of cheap intelligence
            </p>
            <p data-a className="mt-4 max-w-[44ch] text-[1.06rem] leading-relaxed lg:[@media(max-height:740px)]:hidden" style={{ ["--d" as string]: "420ms" }}>
              If an AI does the work for cents, why would anyone pay a person to do it? Guess first, then see what the data says, chapter by chapter.
            </p>
            <div data-a className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap" style={{ ["--d" as string]: "540ms" }}>
              <button ref={primaryRef} type="button" onClick={primary} className="btn btn-ink" tabIndex={done ? 0 : -1}>
                {primaryText}
              </button>
              <button type="button" onClick={secondary} className="btn btn-ghost" tabIndex={done ? 0 : -1}>
                {secondaryText}
              </button>
            </div>
            <p data-a className="ui mt-3 text-[0.86rem] text-ink-soft" style={{ ["--d" as string]: "620ms" }}>
              Seven short chapters, about eight minutes. You can leave at any point.
            </p>
          </div>
        </div>

        <p className="ui rise mt-5 max-w-none border-t border-rule pt-2 text-[0.78rem] leading-snug text-ink-faint" style={{ ["--d" as string]: "400ms" }}>
          The cheapest AI model at about GPT-4 level (Epoch Capabilities Index of 120 or more), list price in US dollars per million tokens, monthly, log
          scale. Data: Epoch AI; LiteLLM price file. Chapter 1 has the details.
        </p>
      </div>
    </div>
  );
}
