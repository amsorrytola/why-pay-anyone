"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PageHead, Section, Slider, Toggle, Segmented, PresetBar, Takeaway, Caveat, Figure, Stat } from "@/components/ui";
import { usePageState } from "@/components/chat-context";
import { PriceChart, ModelScatter, type PriceSeries, type ScatterDot, type FrontierLine } from "@/components/m1-charts";
import { IntervalPlot, PlayButton, usePlayer, monthLabel, monthX, signed, signedPct, dollarTick } from "@/components/m1-shared";
import { compact, int, usd } from "@/lib/format";
import pocRaw from "@/data/m1_price_of_capability.json";
import fitsRaw from "@/data/m1_price_decline_fits.json";
import hedRaw from "@/data/m1_hedonic_index.json";
import modelsRaw from "@/data/m1_models.json";
import priceRaw from "@/data/m1_model_prices.json";
import volRaw from "@/data/m1_model_month_volume.json";
import volmRaw from "@/data/m1_volume_monthly.json";
import elasRaw from "@/data/m1_elasticity.json";

/* ---------------------------------------------------------------- */
/* Data                                                              */
/* ---------------------------------------------------------------- */

type Poc = { threshold: number; month: string; price: number; input: number; output: number; cheapest_model: string; n_models: number };
type Fit = { threshold: number; first_month: string; months: number; price_first: number; price_last: number; halvings_per_year: number; se_halvings_per_year: number; halving_time_months: number; annual_decline_pct: number; r2: number };
type Hed = { month: string; index: number; low: number; high: number };
type Mdl = { model: string; access: string; release_date: string; eci: number };
type MP = { month: string; model: string; blended: number; eci: number; access: string };
type MV = { month: string; model: string; tokens_per_day: number };
type Volm = { month: string; all_tokens_per_day: number; priced_tokens_per_day: number; coverage_of_all_pct: number; implied_spend_usd_per_day: number; hedonic_index: number };
type Elas = { specification: string; elasticity: number; se: number; ci_low: number; ci_high: number; n_obs: number; n_models: number; models_with_price_change: number };

const POC = pocRaw as unknown as Poc[];
const FITS = new Map((fitsRaw as unknown as Fit[]).map((f) => [f.threshold, f]));
const HED = new Map((hedRaw as unknown as Hed[]).map((h) => [h.month, h]));
const MODELS = modelsRaw as unknown as Mdl[];
const MP = priceRaw as unknown as MP[];
const MV = volRaw as unknown as MV[];
const VOLM = volmRaw as unknown as Volm[];
const ELAS = elasRaw as unknown as Elas[];

/** Epoch-scored models in the Epoch AI file (docs/research-plan.md, section M1); 212 of them are matched to a price. */
const EPOCH_SCORED = 258;

const MONTHS = Array.from(new Set(POC.map((r) => r.month))).sort();
const NM = MONTHS.length;
const THRESHOLDS = Array.from(new Set(POC.map((r) => r.threshold))).sort((a, b) => a - b);
const T_MIN = THRESHOLDS[0];
const T_MAX = THRESHOLDS[THRESHOLDS.length - 1];
const T_STEP = THRESHOLDS[1] - THRESHOLDS[0];

const BY_T = new Map<number, Poc[]>();
for (const r of POC) {
  const a = BY_T.get(r.threshold) ?? [];
  a.push(r);
  BY_T.set(r.threshold, a);
}
BY_T.forEach((a) => a.sort((p, q) => p.month.localeCompare(q.month)));

const MP_BY_MONTH = new Map<string, MP[]>();
for (const r of MP) {
  const a = MP_BY_MONTH.get(r.month) ?? [];
  a.push(r);
  MP_BY_MONTH.set(r.month, a);
}
const VOL_BY_MONTH = new Map<string, Map<string, number>>();
for (const r of MV) {
  const m = VOL_BY_MONTH.get(r.month) ?? new Map<string, number>();
  m.set(r.model, r.tokens_per_day);
  VOL_BY_MONTH.set(r.month, m);
}
const MAX_VOL = Math.max(...MV.map((r) => r.tokens_per_day));

// Named reference points: scores come from m1_models.json by exact model name.
const MODEL_BY_NAME = new Map(MODELS.map((m) => [m.model, m]));
const REF_DEFS = [
  { name: "GPT-3.5 Turbo (Nov 2023)", short: "GPT-3.5" },
  { name: "GPT-4 (Mar 2023)", short: "GPT-4" },
  { name: "Claude 3.5 Sonnet", short: "Claude 3.5 Sonnet" },
  { name: "GPT-5", short: "GPT-5" },
  { name: "GPT-5.5", short: "GPT-5.5" },
];
const REFS = REF_DEFS.flatMap((d) => {
  const m = MODEL_BY_NAME.get(d.name);
  if (!m) return [];
  // the step at or just below the model's score, so the model itself clears the bar
  const threshold = Math.min(T_MAX, Math.max(T_MIN, Math.floor(m.eci / T_STEP + 1e-9) * T_STEP));
  return [{ ...d, eci: m.eci, threshold, release: m.release_date }];
});
const REF_GPT4 = REFS.find((r) => r.short === "GPT-4");
const REF_GPT5 = REFS.find((r) => r.short === "GPT-5");
const DEFAULT_T = REF_GPT4?.threshold ?? 120;
const GPT5_IDX = REF_GPT5 ? Math.max(0, MONTHS.indexOf(REF_GPT5.release.slice(0, 7))) : Math.max(0, NM - 16);

const CLOSED = "var(--ai)";
const OPEN = "var(--ok)";
const UNCLEAR = "var(--ink-faint)";
const accessClass = (a: string) => (a.startsWith("Open weights") ? "open" : a === "API access" ? "closed" : "unclear");

/* ---------------------------------------------------------------- */
/* Small calculations                                                */
/* ---------------------------------------------------------------- */

/** Ordinary least squares of y on x. */
function ols(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  return { slope, mx, my };
}

/** Frontier of price against capability: the cheapest price at or above each score, as points (score, price) from low score to high. */
function frontier(ms: { eci: number; blended: number }[]): [number, number][] {
  const s = [...ms].sort((a, b) => b.eci - a.eci || a.blended - b.blended);
  let best = Infinity;
  const pts: [number, number][] = [];
  for (const m of s) {
    if (m.blended < best) {
      best = m.blended;
      pts.push([m.eci, m.blended]);
    }
  }
  return pts.reverse();
}

function cheapestAtBar(ms: MP[], bar: number, pred: (m: MP) => boolean): MP | null {
  let best: MP | null = null;
  for (const m of ms) if (m.eci >= bar && pred(m) && (!best || m.blended < best.blended)) best = m;
  return best;
}

const idxTick = (n: number) => (n >= 10 ? int(n) : String(+n.toPrecision(2)));
const ratioText = (r: number) => (r >= 10 ? int(r) : r.toFixed(1));

/* ---------------------------------------------------------------- */
/* Layout helpers                                                    */
/* ---------------------------------------------------------------- */

function ControlBox(props: { title: string; tone: "ai" | "human" | "owner"; children: ReactNode }) {
  const color = props.tone === "ai" ? "var(--ai-deep)" : props.tone === "human" ? "var(--human-deep)" : "var(--owner)";
  return (
    <fieldset className="rounded-[6px] border border-rule bg-surface px-4 py-3">
      <legend className="ui px-1 text-[1rem] font-bold" style={{ color }}>
        {props.title}
      </legend>
      {props.children}
    </fieldset>
  );
}

function Label(props: { children: ReactNode }) {
  return <p className="ui mt-2 text-[1rem] font-semibold">{props.children}</p>;
}

function Key(props: { color: string; children: ReactNode; ring?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-full" style={{ background: props.ring ? "transparent" : props.color, border: `2px solid ${props.color}` }} />
      {props.children}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function M1Page() {
  // main chart
  const [threshold, setThreshold] = useState(DEFAULT_T);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(NM - 1);
  const [axis, setAxis] = useState<"log" | "linear">("log");
  const [showHed, setShowHed] = useState(false);
  // scatter
  const [scMonth, setScMonth] = useState(NM - 1);
  const [showOpenFrontier, setShowOpenFrontier] = useState(true);
  // Jevons
  const [basis, setBasis] = useState<"all" | "priced">("all");
  const [jBase, setJBase] = useState(0);
  const elEst = ELAS[0];
  const [cut, setCut] = useState(50);
  const [elast, setElast] = useState(Math.round(elEst.elasticity * 100) / 100);

  const player = usePlayer({ min: 0, max: NM - 1, value: scMonth, onChange: setScMonth, ms: 650 });

  /* ---- main chart ---- */
  const main = useMemo(() => {
    const rows = BY_T.get(threshold) ?? [];
    const visMonths = MONTHS.slice(from, to + 1);
    const vis = rows.filter((r) => r.month >= MONTHS[from] && r.month <= MONTHS[to]);
    const fit = FITS.get(threshold) ?? null;
    const asIndex = showHed;

    // the trend line from the fitted slope, passed through the mean of the data (as least squares does)
    let trendAt: ((x: number) => number) | null = null;
    if (fit && rows.length >= 2) {
      const o = ols(rows.map((r) => monthX(r.month)), rows.map((r) => Math.log2(r.price)));
      trendAt = (x) => Math.pow(2, o.my - fit.halvings_per_year * (x - o.mx));
    }
    // a fresh fit over just the months on screen
    let live: { halvings: number; months: number | null } | null = null;
    if (vis.length >= 6) {
      const o = ols(vis.map((r) => monthX(r.month)), vis.map((r) => Math.log2(r.price)));
      live = { halvings: -o.slope, months: -o.slope > 0 ? 12 / -o.slope : null };
    }

    const baseMonth = vis.length ? vis[0].month : MONTHS[from];
    const basePrice = vis.length ? vis[0].price : 1;
    const fP = asIndex ? 100 / basePrice : 1;
    const baseHed = HED.get(baseMonth)?.index ?? 100;
    const fH = 100 / baseHed;

    const series: PriceSeries[] = [];
    if (vis.length) {
      series.push({
        id: "frontier",
        label: asIndex ? "Cheapest price (index)" : "Cheapest price",
        color: "var(--ai)",
        points: vis.map((r) => ({ m: r.month, y: r.price * fP, note: `${r.cheapest_model}; ${r.n_models} model${r.n_models === 1 ? "" : "s"} clear the bar` })),
        dots: true,
      });
      if (trendAt) {
        series.push({ id: "trend", label: "Trend", color: "var(--ink-soft)", dashed: true, width: 1.75, points: vis.map((r) => ({ m: r.month, y: trendAt!(monthX(r.month)) * fP })) });
      }
    }
    if (asIndex) {
      const hm = visMonths.map((m) => HED.get(m)).filter((h): h is Hed => Boolean(h));
      series.push({
        id: "hedonic",
        label: "Quality-adjusted index",
        color: "var(--human)",
        points: hm.map((h) => ({ m: h.month, y: h.index * fH, note: `95% interval ${(h.low * fH).toFixed(0)} to ${(h.high * fH).toFixed(0)}` })),
        band: hm.map((h) => ({ m: h.month, lo: h.low * fH, hi: h.high * fH })),
        width: 2.75,
      });
    }

    // label the model that holds the cheapest price wherever the holder changes
    const changes: { id: string; m: string; y: number; text: string; held: number }[] = [];
    let prev = "";
    vis.forEach((r) => {
      if (r.cheapest_model !== prev) {
        changes.push({ id: `${r.month}|${r.cheapest_model}`, m: r.month, y: r.price * fP, text: r.cheapest_model, held: 0 });
        prev = r.cheapest_model;
      }
    });
    changes.forEach((c, i) => {
      const next = changes[i + 1];
      const start = vis.findIndex((r) => r.month === c.m);
      const end = next ? vis.findIndex((r) => r.month === next.m) : vis.length;
      c.held = end - start;
    });
    const byHeld = [...changes].sort((a, b) => b.held - a.held);
    const lastChange = changes[changes.length - 1];
    const labelOrder = lastChange ? [lastChange, ...byHeld.filter((c) => c !== lastChange)] : [];

    const gpt5Month = REF_GPT5 ? REF_GPT5.release.slice(0, 7) : null;
    const markers = gpt5Month && visMonths.includes(gpt5Month) ? [{ m: gpt5Month, label: "GPT-5 released" }] : [];

    return { rows, vis, visMonths, fit, live, series, labelOrder, markers, asIndex, baseMonth, fH };
  }, [threshold, from, to, showHed]);

  const first = main.vis[0];
  const last = main.vis[main.vis.length - 1];
  const refHit = REFS.find((r) => r.threshold === threshold);
  const barText = refHit ? `${refHit.short}-level (score ${threshold.toFixed(1)} or more)` : `a score of ${threshold.toFixed(1)} or more`;
  const hedLast = HED.get(MONTHS[to]);
  const rangeActive = from === 0 && to === NM - 1 ? "all" : from === GPT5_IDX && to === NM - 1 ? "gpt5" : from === NM - 12 && to === NM - 1 ? "last12" : "";

  /* ---- scatter ---- */
  const sc = useMemo(() => {
    const month = MONTHS[scMonth];
    const ms = MP_BY_MONTH.get(month) ?? [];
    const vols = VOL_BY_MONTH.get(month);
    const dots: ScatterDot[] = ms
      .map((m) => {
        const v = vols?.get(m.model);
        const cls = accessClass(m.access);
        return {
          id: m.model,
          x: m.eci,
          y: m.blended,
          r: v ? 4 + 22 * Math.sqrt(v / MAX_VOL) : 3.6,
          color: cls === "open" ? OPEN : cls === "closed" ? CLOSED : UNCLEAR,
          faint: !v,
          title: m.model,
          sub: `${m.access}; score ${m.eci.toFixed(1)}; ${usd(m.blended)} per million tokens${v ? `; ${compact(v)} tokens a day` : ""}`,
        };
      })
      .sort((a, b) => b.r - a.r);
    const openMs = ms.filter((m) => accessClass(m.access) === "open");
    const closedMs = ms.filter((m) => accessClass(m.access) === "closed");
    const allBest = cheapestAtBar(ms, threshold, () => true);
    const openBest = cheapestAtBar(ms, threshold, (m) => accessClass(m.access) === "open");
    const closedBest = cheapestAtBar(ms, threshold, (m) => accessClass(m.access) === "closed");
    const topUsed = vols ? [...vols.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
    const frontiers: FrontierLine[] = [{ id: "all", label: "Frontier", color: "var(--ink)", pts: frontier(ms) }];
    if (showOpenFrontier) frontiers.push({ id: "open", label: "Open-weights frontier", color: OPEN, dashed: true, pts: frontier(openMs) });
    const labelIds = [...(allBest ? [allBest.model] : []), ...topUsed.map((t) => t[0])];
    return { month, ms, dots, openCount: openMs.length, closedCount: closedMs.length, allBest, openBest, closedBest, topUsed, frontiers, labelIds, hasVol: Boolean(vols) };
  }, [scMonth, threshold, showOpenFrontier]);

  /* ---- Jevons ---- */
  const jv = useMemo(() => {
    const rows = VOLM.slice(jBase);
    const b = rows[0];
    const l = rows[rows.length - 1];
    const tok = (r: Volm) => (basis === "all" ? r.all_tokens_per_day : r.priced_tokens_per_day);
    const series: PriceSeries[] = [
      {
        id: "tok",
        label: basis === "all" ? "Tokens a day" : "Tokens a day (matched)",
        color: "var(--ai)",
        dots: true,
        points: rows.map((r) => ({ m: r.month, y: (tok(r) / tok(b)) * 100, note: `${compact(tok(r))} tokens a day` })),
      },
      {
        id: "spend",
        label: "Implied spending",
        color: "var(--owner)",
        dots: true,
        points: rows.map((r) => ({ m: r.month, y: (r.implied_spend_usd_per_day / b.implied_spend_usd_per_day) * 100, note: `$${compact(r.implied_spend_usd_per_day)} a day` })),
      },
      {
        id: "price",
        label: "Quality-adjusted price",
        color: "var(--human)",
        dots: true,
        points: rows.map((r) => ({ m: r.month, y: (r.hedonic_index / b.hedonic_index) * 100, note: `index ${r.hedonic_index.toFixed(1)} (Sep 2023 = 100)` })),
      },
    ];
    const rq = tok(l) / tok(b);
    const rs = l.implied_spend_usd_per_day / b.implied_spend_usd_per_day;
    const rp = l.hedonic_index / b.hedonic_index;
    const impliedElasticity = Math.log(rq) / Math.log(rp);
    return { rows, b, l, series, rq, rs, rp, impliedElasticity };
  }, [basis, jBase]);

  const cutMult = 1 - cut / 100;
  const qMult = Math.pow(cutMult, elast);
  const sMult = cutMult * qMult;

  usePageState("m1", {
    "capability bar (Epoch index score)": threshold,
    "months shown": `${MONTHS[from]} to ${MONTHS[to]}`,
    "price axis": axis,
    "quality-adjusted index shown": showHed,
    "cheapest price at the bar in the last month shown ($ per million tokens)": last ? +last.price.toFixed(4) : "no model clears the bar",
    "cheapest model at the bar in the last month shown": last ? last.cheapest_model : "none",
    "halving time of that price, months (trend)": main.fit ? +main.fit.halving_time_months.toFixed(1) : "no trend fitted",
    "scatter month": MONTHS[scMonth],
    "index base month (Jevons panel)": VOLM[jBase].month,
    "tokens basis (Jevons panel)": basis,
    "price cut tried in the calculator (%)": cut,
    "elasticity tried in the calculator": elast,
  });

  const reset = () => {
    setThreshold(DEFAULT_T);
    setFrom(0);
    setTo(NM - 1);
    setAxis("log");
    setShowHed(false);
  };

  /* ---- text pieces ---- */
  const fallPct = first && last ? (1 - last.price / first.price) * 100 : 0;
  const fit = main.fit;
  const halfLo = fit ? 12 / (fit.halvings_per_year + 1.96 * fit.se_halvings_per_year) : null;
  const halfHi = fit && fit.halvings_per_year - 1.96 * fit.se_halvings_per_year > 0 ? 12 / (fit.halvings_per_year - 1.96 * fit.se_halvings_per_year) : null;
  const declineText = fit ? (fit.annual_decline_pct >= 99 ? fit.annual_decline_pct.toFixed(1) : fit.annual_decline_pct.toFixed(0)) : "";

  const coverageFirst = VOLM[0].coverage_of_all_pct;
  const coverageLast = VOLM[VOLM.length - 1].coverage_of_all_pct;
  const monthsAtBar = main.rows.length;

  return (
    <>
      <PageHead
        id="M1"
        title="How fast is the price of intelligence falling?"
        question="Pick a level of capability, such as GPT-4 or GPT-5, and see the cheapest price of any model that reaches it. Then check whether cheaper tokens bring more total spending."
      />

      {/* ------------------------------------------------------------ */}
      <Section>
        <h2 className="mb-4">The price of a fixed level of capability</h2>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <ControlBox title="The bar" tone="ai">
              <Slider
                label="Capability the model must reach"
                value={threshold}
                min={T_MIN}
                max={T_MAX}
                step={T_STEP}
                format={(v) => v.toFixed(1)}
                onChange={setThreshold}
                help="Epoch capability index score. A model clears the bar if its score is at least this. Higher is more capable."
              />
              <Label>Jump to a model you know</Label>
              <div className="mt-1.5">
                <PresetBar presets={REFS.map((r) => ({ id: r.short, label: `${r.short} (${r.eci.toFixed(1)})` }))} active={refHit?.short} onPick={(id) => setThreshold(REFS.find((r) => r.short === id)?.threshold ?? DEFAULT_T)} />
              </div>
              {refHit && (
                <p className="ui mt-2 text-[0.85rem] leading-snug text-ink-soft">
                  {refHit.name} scores {refHit.eci.toFixed(1)} in the Epoch data. The bar sits at {threshold.toFixed(1)}, the step at or just below that score, so the model itself clears it.
                </p>
              )}
            </ControlBox>

            <ControlBox title="The dates and the axis" tone="human">
              <Slider label="From" value={from} min={0} max={Math.max(0, to - 2)} step={1} tone="human" format={(v) => monthLabel(MONTHS[v])} onChange={(v) => setFrom(Math.min(v, to - 2))} />
              <Slider label="To" value={to} min={Math.min(NM - 1, from + 2)} max={NM - 1} step={1} tone="human" format={(v) => monthLabel(MONTHS[v])} onChange={(v) => setTo(Math.max(v, from + 2))} />
              <div className="mt-1">
                <PresetBar
                  presets={[
                    { id: "all", label: "Whole period" },
                    { id: "gpt5", label: "Since GPT-5" },
                    { id: "last12", label: "Last 12 months" },
                  ]}
                  active={rangeActive}
                  onPick={(id) => {
                    setFrom(id === "all" ? 0 : id === "gpt5" ? GPT5_IDX : NM - 12);
                    setTo(NM - 1);
                  }}
                />
              </div>
              <Label>Vertical axis</Label>
              <div className="mt-1.5">
                <Segmented
                  label="Vertical axis"
                  value={axis}
                  onChange={setAxis}
                  options={[
                    { value: "log", label: "Log scale" },
                    { value: "linear", label: "Linear scale" },
                  ]}
                />
              </div>
              <p className="ui mt-1.5 text-[0.85rem] leading-snug text-ink-soft">On a log scale each gridline is ten times the one below, so a steady percentage fall is a straight line.</p>
              <div className="mt-2">
                <Toggle
                  label="Add the quality-adjusted price index"
                  checked={showHed}
                  onChange={setShowHed}
                  help="Switches the chart to indexes, 100 in the first month shown, so that both lines share a scale."
                />
              </div>
            </ControlBox>
            <button onClick={reset} className="ui text-[0.95rem] underline">
              Reset these dials
            </button>
          </div>

          <div className="min-w-0 space-y-5">
            <Figure
              title={main.asIndex ? "Cheapest price and quality-adjusted index, both indexed" : `Cheapest price of any model with ${barText}`}
              subtitle={
                main.asIndex
                  ? `Both lines are 100 in ${monthLabel(main.baseMonth)}. The amber band is the 95% interval of the quality-adjusted index.`
                  : `Dollars per million tokens, 3 parts input to 1 part output. Each point is the cheapest list price in that month among all models that clear the bar; the label names the model that holds it.`
              }
              source="Source: Epoch AI (Epoch Capabilities Index, CC BY); prices from month-end snapshots of the LiteLLM price file (list prices, not what anyone paid)."
            >
              <PriceChart
                months={main.visMonths}
                series={main.series}
                log={axis === "log"}
                yFormat={main.asIndex ? idxTick : dollarTick}
                labels={main.labelOrder.map((c) => ({ id: c.id, m: c.m, y: c.y, text: c.text }))}
                markers={main.markers}
                ariaLabel={`Line chart of the cheapest price per million tokens of any model scoring at least ${threshold.toFixed(1)}, ${monthLabel(MONTHS[from])} to ${monthLabel(MONTHS[to])}${last ? `, from ${usd(first.price)} to ${usd(last.price)}` : ""}.`}
                empty={`No model scores ${threshold.toFixed(1)} or more in these months. Lower the bar or move the dates.`}
              />
              {main.asIndex && main.baseMonth !== "2023-09" && (
                <p className="ui mt-2 text-[0.85rem] text-ink-soft">The interval is the published one (September 2023 = 100) rescaled to start in {monthLabel(main.baseMonth)}, so it is wider than it should be near the start.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
                <Stat
                  value={fit ? `${fit.halving_time_months.toFixed(1)} months` : "no trend"}
                  label="Time for the cheapest price to halve, on the trend"
                  tone="ai"
                  sub={fit && halfLo ? `95% range ${halfLo.toFixed(1)} to ${halfHi ? halfHi.toFixed(1) : "no upper limit"} months` : `only ${monthsAtBar} month${monthsAtBar === 1 ? "" : "s"} of prices at this bar`}
                />
                <Stat
                  value={fit ? `${declineText}% a year` : "no trend"}
                  label="Fall in the cheapest price each year, on the trend"
                  tone="ai"
                  sub={fit ? `R² ${fit.r2.toFixed(2)} over ${fit.months} months (${monthLabel(fit.first_month)} on)` : "a trend needs about a year of prices"}
                />
                <Stat
                  value={last ? usd(last.price) : "none"}
                  label={last ? `Cheapest price in ${monthLabel(last.month)}` : "Cheapest price"}
                  sub={first && last && first !== last ? `${ratioText(first.price / last.price)} times lower than ${usd(first.price)} in ${monthLabel(first.month)}` : undefined}
                />
                {main.live && fit && (from !== 0 || to !== NM - 1) && (
                  <Stat
                    value={main.live.months ? `${main.live.months.toFixed(1)} months` : "no fall"}
                    label="Halving time in the months shown only"
                    sub="refitted here by least squares, no standard error"
                  />
                )}
              </div>
            </Figure>

            <Takeaway>
              {first && last ? (
                <p>
                  To get {barText}, the cheapest list price of any model was <strong>{usd(first.price)}</strong> per million tokens in {monthLabel(first.month)} and is <strong>{usd(last.price)}</strong> in {monthLabel(last.month)}
                  {first !== last ? <>, a fall of {fallPct >= 99.95 ? "more than 99.9" : fallPct.toFixed(fallPct >= 99 ? 1 : 0)}%</> : null}. {last.cheapest_model} holds the lowest price that month, and {last.n_models} model{last.n_models === 1 ? "" : "s"} clear the bar.
                  {fit ? <> On the trend the price halves about every {fit.halving_time_months.toFixed(1)} months.</> : <> There are too few months of prices at this bar to fit a trend.</>}
                </p>
              ) : (
                <p>No model clears this bar in the months shown. Lower the bar or widen the dates.</p>
              )}
              <p>
                Higher bars start later, because nothing cleared them earlier, and their fitted falls are faster but cover fewer months, so treat those trends with more care. The line can also jump when one new cheap model arrives, which is why the labels name the holder.
                {hedLast ? <> A second measure, the quality-adjusted index, compares like with like across all models. It stood at {hedLast.index.toFixed(0)} in {monthLabel(hedLast.month)} (September 2023 = 100, 95% interval {hedLast.low.toFixed(0)} to {hedLast.high.toFixed(0)}). Switch it on to compare the two.</> : null}
              </p>
            </Takeaway>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section>
        <h2 className="mb-4">Every priced model, month by month</h2>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <ControlBox title="The month" tone="ai">
              <Slider label="Month" value={scMonth} min={0} max={NM - 1} step={1} format={(v) => monthLabel(MONTHS[v])} onChange={setScMonth} />
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <PlayButton playing={player.playing} onClick={player.toggle} />
                <span className="ui text-[0.85rem] text-ink-soft">Steps through the months once. Pause any time.</span>
              </div>
              <div className="mt-3">
                <Toggle label="Draw the open-weights frontier too" checked={showOpenFrontier} onChange={setShowOpenFrontier} help="A dashed teal line: the cheapest price at or above each score, counting only open-weights models." />
              </div>
              <p className="ui mt-1 text-[0.85rem] leading-snug text-ink-soft">The dashed black line marks the capability bar from the dial above ({threshold.toFixed(1)}).</p>
            </ControlBox>
          </div>

          <div className="min-w-0 space-y-5">
            <Figure
              title={`Price against capability, ${monthLabel(sc.month)}`}
              subtitle="Each dot is a model with a list price that month. The black line is the frontier: the cheapest price of any model at or above each score. Click or tap a dot to pin its details."
              source="Source: Epoch AI (CC BY) for scores and access type; LiteLLM price file for prices. Dot size: OpenRouter (openrouter.ai/rankings), as of 2026-11-22. Licensed under CC BY 4.0."
            >
              <ModelScatter
                dots={sc.dots}
                frontiers={sc.frontiers}
                labelIds={sc.labelIds}
                bar={{ x: threshold, y: sc.allBest ? sc.allBest.blended : null, label: "Your bar" }}
                refs={REFS.filter((r) => r.short === "GPT-4" || r.short === "GPT-5").map((r) => ({ x: r.eci, label: r.short }))}
                xDomain={[60, 180]}
                yDomain={[0.01, 100]}
                xLabel="Epoch capability index (higher is more capable)"
                yLabel="Blended price, $ per million tokens (log)"
                yFormat={dollarTick}
                ariaLabel={`Scatter of ${sc.ms.length} priced models in ${monthLabel(sc.month)}: capability score against blended price. ${sc.openCount} are open weights and ${sc.closedCount} are closed.`}
              />
              <ul className="ui mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.85rem] text-ink-soft">
                <li>
                  <Key color={CLOSED}>Closed (API access only)</Key>
                </li>
                <li>
                  <Key color={OPEN}>Open weights</Key>
                </li>
                <li>
                  <Key color={UNCLEAR}>Access unclear</Key>
                </li>
                <li>Dot area: tokens a day on OpenRouter{sc.hasVol ? "; small dots have no usage figure" : " (figures begin in January 2025)"}</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
                <Stat value={String(sc.ms.length)} label={`Models with a price in ${monthLabel(sc.month)}`} sub={`${sc.openCount} open weights, ${sc.closedCount} closed`} />
                <Stat value={sc.allBest ? usd(sc.allBest.blended) : "none"} label={`Cheapest at or above ${threshold.toFixed(1)}, any model`} tone="ai" sub={sc.allBest?.model} />
                <Stat value={sc.openBest ? usd(sc.openBest.blended) : "none"} label="Cheapest open-weights model at the bar" sub={sc.openBest?.model} />
                <Stat value={sc.closedBest ? usd(sc.closedBest.blended) : "none"} label="Cheapest closed model at the bar" sub={sc.closedBest?.model} />
              </div>
              {sc.topUsed.length > 0 && (
                <p className="ui mt-3 text-[0.9rem] text-ink-soft">
                  Most used on OpenRouter that month: {sc.topUsed.map(([name, v]) => `${name} (${compact(v)} tokens a day)`).join("; ")}.
                </p>
              )}
            </Figure>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section>
        <h2 className="mb-4">Does a lower price bring more spending?</h2>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <ControlBox title="What to count" tone="owner">
              <Label>Which tokens</Label>
              <div className="mt-1.5">
                <Segmented
                  label="Which tokens to count"
                  value={basis}
                  onChange={setBasis}
                  options={[
                    { value: "all", label: "All OpenRouter tokens" },
                    { value: "priced", label: "Matched models only" },
                  ]}
                />
              </div>
              <p className="ui mt-1.5 text-[0.85rem] leading-snug text-ink-soft">The spending line always counts matched models only, because only they have a price. Their share of all tokens went from {coverageFirst.toFixed(0)}% to {coverageLast.toFixed(0)}%.</p>
              <Slider
                label="Set every line to 100 in"
                value={jBase}
                min={0}
                max={VOLM.length - 3}
                step={1}
                tone="owner"
                format={(v) => monthLabel(VOLM[v].month)}
                onChange={setJBase}
                help="Move the starting month to see how much of the change happened early or late."
              />
            </ControlBox>
          </div>

          <div className="min-w-0 space-y-5">
            <Figure
              title="Tokens, quality-adjusted price and implied spending"
              subtitle={`Each line is 100 in ${monthLabel(jv.b.month)} and the axis is logarithmic. Cobalt: OpenRouter tokens a day. Amber: the quality-adjusted price index. Plum: implied spending, which is tokens times list price for matched models.`}
              source="Source: OpenRouter (openrouter.ai/rankings), as of 2026-11-22. Licensed under CC BY 4.0. Prices: LiteLLM price file. Capability and quality adjustment: Epoch AI (CC BY). Implied spending is an upper bound."
            >
              <PriceChart
                months={jv.rows.map((r) => r.month)}
                series={jv.series}
                log
                height={340}
                yFormat={(n) => (n >= 1000 ? compact(n) : String(+n.toPrecision(3)))}
                ariaLabel={`Log-scale chart, each series equal to 100 in ${monthLabel(jv.b.month)}. By ${monthLabel(jv.l.month)} tokens are at ${int(jv.rq * 100)}, the quality-adjusted price at ${int(jv.rp * 100)} and implied spending at ${int(jv.rs * 100)}.`}
              />
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
                <Stat value={`${ratioText(jv.rq)}×`} label={`Tokens a day, ${monthLabel(jv.b.month)} to ${monthLabel(jv.l.month)}`} tone="ai" sub={basis === "all" ? "all OpenRouter tokens" : "matched models only"} />
                <Stat value={`${jv.rp.toFixed(2)}×`} label="Quality-adjusted price over the same months" tone="human" sub={`index ${jv.b.hedonic_index.toFixed(0)} to ${jv.l.hedonic_index.toFixed(0)} (Sep 2023 = 100)`} />
                <Stat value={`${ratioText(jv.rs)}×`} label="Implied spending, upper bound" tone="owner" sub="matched models, list prices" />
                <Stat value={signed(jv.impliedElasticity, 1)} label="Elasticity that would explain all the token growth" sub="if nothing but price had changed" />
              </div>
            </Figure>

            <div className="grid gap-5">
              <Figure
                title="What a model's own price cuts do to its use"
                subtitle="Elasticity: the percent change in tokens for a 1% change in price, comparing each model with itself over time. Dots are estimates, bars are 95% intervals."
                source="Source: OpenRouter (openrouter.ai/rankings), as of 2026-11-22, CC BY 4.0; LiteLLM price file. Regression of log tokens on log price with model and month fixed effects."
              >
                <IntervalPlot
                  rows={ELAS.map((e, i) => ({
                    id: e.specification,
                    label: `${i === 0 ? "All models with 6+ months" : "Only models whose price changed"} (${e.n_models})`,
                    est: e.elasticity,
                    lo: e.ci_low,
                    hi: e.ci_high,
                    color: "var(--ai)",
                  }))}
                  domain={[-1.6, 0.6]}
                  ticks={[-1.5, -1, -0.5, 0, 0.5]}
                  refs={[
                    { x: -1, label: "Spending flat" },
                    { x: 0, label: "No response" },
                  ]}
                  format={(n) => signed(n, 2)}
                  ariaLabel={`Elasticity estimates: ${ELAS.map((e) => `${signed(e.elasticity, 2)} with interval ${signed(e.ci_low, 2)} to ${signed(e.ci_high, 2)}`).join("; ")}.`}
                />
                <p className="ui mt-1 text-[0.85rem] leading-snug text-ink-soft">To the left of &minus;1, a price cut raises total spending (the Jevons case). To the right, spending falls.</p>
              </Figure>

              <Figure
                title="Try a price cut"
                subtitle="Set a price cut and an elasticity. Tokens bought change by (1 minus the cut) raised to the elasticity; spending is price times tokens."
                source="A calculation, not data. The estimate and its interval come from the regression on the left."
              >
                <Slider label="Price cut" value={cut} min={5} max={95} step={1} tone="owner" format={(v) => `${v}%`} onChange={setCut} />
                <Slider label="Elasticity" value={elast} min={-3} max={0.2} step={0.01} tone="owner" format={(v) => signed(v, 2)} onChange={setElast} />
                <div className="mt-1">
                  <PresetBar
                    presets={[
                      { id: "est", label: `Estimate (${signed(elEst.elasticity, 2)})` },
                      { id: "lo", label: `Low end (${signed(elEst.ci_low, 2)})` },
                      { id: "hi", label: `High end (${signed(elEst.ci_high, 2)})` },
                      { id: "one", label: "Exactly −1" },
                    ]}
                    active={
                      Math.abs(elast - Math.round(elEst.elasticity * 100) / 100) < 0.005 ? "est" : Math.abs(elast - Math.round(elEst.ci_low * 100) / 100) < 0.005 ? "lo" : Math.abs(elast - Math.round(elEst.ci_high * 100) / 100) < 0.005 ? "hi" : Math.abs(elast + 1) < 0.005 ? "one" : ""
                    }
                    onPick={(id) => setElast(id === "est" ? Math.round(elEst.elasticity * 100) / 100 : id === "lo" ? Math.round(elEst.ci_low * 100) / 100 : id === "hi" ? Math.round(elEst.ci_high * 100) / 100 : -1)}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                  <Stat value={`${qMult.toFixed(2)}×`} label="Tokens bought" tone="ai" sub={signedPct(qMult - 1)} />
                  <Stat value={`${sMult.toFixed(2)}×`} label="Total spending" tone="owner" sub={signedPct(sMult - 1)} />
                </div>
                <p className="ui mt-3 text-[0.9rem] text-ink-soft">
                  {sMult > 1.005 ? "Spending rises: the extra tokens more than pay for the lower price. This is the Jevons case." : sMult < 0.995 ? "Spending falls: the extra tokens do not make up for the lower price." : "Spending is about unchanged."}
                </p>
              </Figure>
            </div>

            <Takeaway title="An honest reading">
              <p>
                <strong>Within a model, the data does not show elasticity above 1.</strong> The estimate is {signed(elEst.elasticity, 2)}: a 10% price cut goes with about {(Math.abs(elEst.elasticity) * 10).toFixed(1)}% more tokens for the same model. The 95% interval runs from {signed(elEst.ci_low, 2)} to {signed(elEst.ci_high, 2)}, so it neither shows nor rules out a response near 1. Only {elEst.models_with_price_change} of {elEst.n_models} models changed price, which is why it is imprecise.
              </p>
              <p>
                <strong>Across the whole market, growth is consistent with Jevons but confounded.</strong> From {monthLabel(jv.b.month)} to {monthLabel(jv.l.month)} tokens rose {ratioText(jv.rq)} times while the quality-adjusted price fell to {jv.rp.toFixed(2)} of its level. Explaining that with price alone would need an elasticity of {signed(jv.impliedElasticity, 1)}, far outside the model-level estimate. Much of the growth is more users and new uses, which this data cannot separate from price.
              </p>
              <p>
                <strong>Implied spending is an upper bound.</strong> Tokens include cached prompt tokens, which are billed at a fraction of the list price. And the matched models&apos; share of all tokens rose from {coverageFirst.toFixed(0)}% to {coverageLast.toFixed(0)}%, which lifts the spending line on its own.
              </p>
            </Takeaway>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section className="grid gap-5 lg:grid-cols-2">
        <Caveat title="Read with care">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Prices are list prices recorded in the LiteLLM price file at each month end, not what anyone paid. They have not yet been cross-checked against providers&apos; own pricing pages, so the speed of the fall rests on one source.</li>
            <li>
              Models are joined to Epoch&apos;s scores by name. {MODELS.length} of {EPOCH_SCORED} scored models are matched to a price; a wrong match would put a price against the wrong score.
            </li>
            <li>Capability is one composite score. A model can clear a bar overall and still be weak at the task you care about.</li>
            <li>The usage figures are OpenRouter&apos;s own users only. About half of its tokens ({coverageLast.toFixed(0)}% in {monthLabel(VOLM[VOLM.length - 1].month)}, {coverageFirst.toFixed(0)}% in {monthLabel(VOLM[0].month)}) belong to models matched to a price.</li>
            <li>Tokens include cached prompt tokens, so implied spending is an upper bound. The elasticity rests on {elEst.models_with_price_change} models that changed price.</li>
          </ul>
        </Caveat>
        <Caveat title="Concepts">
          <p>Hedonic pricing, price index, Wright&apos;s law, Jevons paradox, price elasticity of demand, quality adjustment.</p>
          <details className="ui text-[0.92rem]">
            <summary className="cursor-pointer font-semibold text-ink">What these mean</summary>
            <dl className="mt-2 space-y-1.5">
              <div>
                <dt className="inline font-semibold">Hedonic pricing: </dt>
                <dd className="inline">explaining a price by the qualities of what is sold, here the capability score, so that quality can be held fixed.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Price index: </dt>
                <dd className="inline">one number that follows a price over time, set to 100 in a base month.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Quality adjustment: </dt>
                <dd className="inline">correcting a price comparison for what you get, so a better model at the same price counts as a price cut.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Wright&apos;s law: </dt>
                <dd className="inline">unit cost falls by a fixed share each time cumulative output doubles. The trend here is against time, not cumulative output, which we do not have.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Jevons paradox: </dt>
                <dd className="inline">when something gets cheaper to use, total use can rise enough that total spending rises.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Price elasticity of demand: </dt>
                <dd className="inline">the percent change in quantity bought for a 1% change in price. Below &minus;1, a price cut raises spending.</dd>
              </div>
            </dl>
          </details>
        </Caveat>
      </Section>
    </>
  );
}
