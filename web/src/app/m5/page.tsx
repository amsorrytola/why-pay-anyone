"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PageHead, Section, Slider, Toggle, Segmented, PresetBar, Takeaway, Caveat, Figure, Stat } from "@/components/ui";
import { HBars, LineChart, type LineSeries } from "@/components/charts";
import { PriceChart, type PriceSeries } from "@/components/m1-charts";
import { usePageState } from "@/components/chat-context";
import { ShareArea, HostScatter, RevenueDots, type ShareSeries, type HostDot, type RevSeries } from "@/components/m5-charts";
import { IntervalPlot, PlayButton, usePlayer, monthLabel, monthX, signedPct } from "@/components/m1-shared";
import { int, pct0, pct1, usd } from "@/lib/format";
import concRaw from "@/data/m5_concentration_monthly.json";
import sharesRaw from "@/data/m5_firm_month_shares.json";
import dailyRaw from "@/data/m5_hhi_daily.json";
import hostCompRaw from "@/data/m5_host_competition.json";
import hostPriceRaw from "@/data/m5_host_prices.json";
import revRaw from "@/data/m5_epoch_revenue.json";

/* ---------------------------------------------------------------- */
/* Data                                                              */
/* ---------------------------------------------------------------- */

type Conc = {
  month: string;
  hhi: number;
  hhi_low: number;
  hhi_high: number;
  effective_firms: number;
  cr1: number;
  cr4: number;
  leader: string;
  firms_ge_1pct: number;
  n_firms: number;
  other_share_of_all: number;
  unattributed_share_of_top50: number;
  instability: number | null;
  new_firms_ge_1pct: number | null;
};
type Share = { month: string; firm: string; tokens_per_day: number; share: number };
type Daily = { date: string; hhi: number; cr1: number; hhi_7day: number | null };
type HostComp = { sample: string; dependent: string; coef_log_hosts: number; se: number; ci_low: number; ci_high: number; n_obs: number; n_models: number };
type HostPrice = { month: string; model: string; eci: number; access: string; n_hosts: number; n_listings: number; price_min: number; price_median: number; price_max: number };
type Rev = { company: string; date: string; revenue_usd: number; type: string; scope: string; confidence: string };

const CONC = (concRaw as unknown as Conc[]).slice().sort((a, b) => a.month.localeCompare(b.month));
const MONTHS = CONC.map((c) => c.month);
const N = MONTHS.length;
const SHARES = sharesRaw as unknown as Share[];
const DAILY = dailyRaw as unknown as Daily[];
const HC = hostCompRaw as unknown as HostComp[];
const HP = hostPriceRaw as unknown as HostPrice[];
const REV = revRaw as unknown as Rev[];

const SHARE_BY_MONTH = new Map<string, Map<string, number>>();
for (const r of SHARES) {
  const m = SHARE_BY_MONTH.get(r.month) ?? new Map<string, number>();
  m.set(r.firm, (m.get(r.firm) ?? 0) + r.share);
  SHARE_BY_MONTH.set(r.month, m);
}
const MAX_SHARE = Math.max(...SHARES.map((r) => r.share));

/* Named firms: the nine with the highest peak monthly share, stacked from the largest average share. */
const NAMED_COUNT = 9;
const peak = new Map<string, number>();
const mean = new Map<string, number>();
for (const r of SHARES) {
  peak.set(r.firm, Math.max(peak.get(r.firm) ?? 0, r.share));
  mean.set(r.firm, (mean.get(r.firm) ?? 0) + r.share / N);
}
const NAMED = [...peak.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, NAMED_COUNT)
  .map(([f]) => f)
  .sort((a, b) => (mean.get(b) ?? 0) - (mean.get(a) ?? 0));

/*
  Firm colours, defined once. A restrained set that avoids the site's three meaning colours
  (amber for people, cobalt for AI, plum for owners): greens, teal, brick, brown and slate.
*/
const FIRM_COLORS: Record<string, string> = {
  Google: "#3b8f5a",
  Anthropic: "#b4503c",
  DeepSeek: "#14808f",
  OpenAI: "#39425c",
  xAI: "#8a6a4f",
  Tencent: "#8ab04a",
  "Z.ai (Zhipu)": "#5b6b3a",
  Xiaomi: "#d9826a",
  MiniMax: "#5aa6a0",
};
const SPARE_COLORS = ["#7a8f86", "#a8846c", "#4d7f8c", "#9a9a6a", "#7f6f5a"];
const OTHER_COLOR = "#c3c8d8";
const OTHER_LABEL = "Other firms";
const firmColor = (f: string) => FIRM_COLORS[f] ?? (NAMED.includes(f) ? SPARE_COLORS[NAMED.indexOf(f) % SPARE_COLORS.length] : OTHER_COLOR);

const OPEN = "var(--ok)";
const CLOSED = "var(--ai)";
const UNCLEAR = "var(--ink-faint)";
const accessClass = (a: string) => (a.startsWith("Open weights") ? "open" : a === "API access" ? "closed" : "unclear");

const HOST_MONTHS = Array.from(new Set(HP.map((r) => r.month))).sort();
const NH = HOST_MONTHS.length;
const HP_BY_MONTH = new Map<string, HostPrice[]>();
for (const r of HP) {
  const a = HP_BY_MONTH.get(r.month) ?? [];
  a.push(r);
  HP_BY_MONTH.set(r.month, a);
}

/** Whole period, and each calendar year in the data, as month-index ranges (a year needs at least three months to chart). */
const RANGE_PRESETS = [
  { id: "all", label: "Whole period", from: 0, to: N - 1 },
  ...Array.from(new Set(MONTHS.map((m) => m.slice(0, 4)))).flatMap((y) => {
    const idx = MONTHS.map((m, i) => (m.startsWith(y) ? i : -1)).filter((i) => i >= 0);
    return idx.length >= 3 ? [{ id: y, label: y, from: idx[0], to: idx[idx.length - 1] }] : [];
  }),
];

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function dateToYear(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return y + (m - 1 + (day - 0.5) / daysIn(y, m)) / 12;
}

/** A fixed pseudo-random offset in [-0.5, 0.5) from a name, so overlapping dots spread out the same way on every render. */
function jitter(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000 - 0.5;
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};

const findHC = (group: "open" | "closed", dep: string) => HC.find((r) => r.sample.toLowerCase().startsWith(group) && r.dependent === dep);

/** Symmetric Cournot with demand P = 1 - Q and a constant marginal cost c. */
function cournot(n: number, c: number) {
  const P = (1 + n * c) / (n + 1);
  const Q = (n * (1 - c)) / (n + 1);
  return { P, Q, lerner: (P - c) / P, markup: (P - c) / c, elasticity: P / Q };
}

const markupOf = (hhi: number, eps: number) => {
  const L = hhi / 10000 / eps;
  return { L, markup: L / (1 - L) };
};
const pctText = (v: number) => (Math.abs(v) >= 10 ? `${v.toFixed(0)}%` : `${v.toFixed(1)}%`);

/* ---------------------------------------------------------------- */
/* Layout helpers                                                    */
/* ---------------------------------------------------------------- */

function Card(props: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[6px] border border-rule bg-surface px-4 py-3 sm:px-5 ${props.className ?? ""}`}>{props.children}</div>;
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function M5Page() {
  // shares and concentration
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(N - 1);
  const [sel, setSel] = useState(N - 1);
  const [showDaily, setShowDaily] = useState(false);
  // Cournot
  const [eps, setEps] = useState(2);
  const [nFirms, setNFirms] = useState(4);
  const [cost, setCost] = useState(0.2);
  // hosts
  const [kHosts, setKHosts] = useState(2);
  const [hMonth, setHMonth] = useState(NH - 1);
  // revenue
  const [revSel, setRevSel] = useState<string[]>(["Anthropic", "OpenAI"]);
  const [revAxis, setRevAxis] = useState<"log" | "linear">("log");

  const selC = Math.min(to, Math.max(from, sel));
  const player = usePlayer({ min: from, max: to, value: selC, onChange: setSel, ms: 700 });
  const hostPlayer = usePlayer({ min: 0, max: NH - 1, value: hMonth, onChange: setHMonth, ms: 650 });

  const months = useMemo(() => MONTHS.slice(from, to + 1), [from, to]);
  const cs = CONC[selC];

  /* ---- shares ---- */
  const areaSeries: ShareSeries[] = useMemo(() => {
    const named: ShareSeries[] = NAMED.map((f) => ({ id: f, label: f, color: firmColor(f), values: months.map((m) => SHARE_BY_MONTH.get(m)?.get(f) ?? 0) }));
    const other = months.map((m) => {
      let s = 0;
      SHARE_BY_MONTH.get(m)?.forEach((v, f) => {
        if (!NAMED.includes(f)) s += v;
      });
      return s;
    });
    return [...named, { id: "other", label: OTHER_LABEL, color: OTHER_COLOR, values: other }];
  }, [months]);

  const bars = useMemo(() => {
    const monthShares = SHARE_BY_MONTH.get(cs.month) ?? new Map<string, number>();
    const all = [...monthShares.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const top = all.slice(0, 9);
    const rest = all.slice(9);
    const items = top.map(([f, v]) => ({ label: f, value: v, color: firmColor(f) }));
    const restSum = rest.reduce((s, [, v]) => s + v, 0);
    if (rest.length) items.push({ label: `${rest.length} smaller firm${rest.length === 1 ? "" : "s"}`, value: restSum, color: OTHER_COLOR });
    return items;
  }, [cs.month]);

  /* ---- HHI lines ---- */
  const hhiSeries: PriceSeries[] = useMemo(() => {
    const monthly: PriceSeries = {
      id: "monthly",
      label: "Monthly HHI",
      color: "var(--owner)",
      width: 3,
      dots: true,
      points: months.map((m) => {
        const c = CONC[MONTHS.indexOf(m)];
        return { m, y: c.hhi, note: `allowing for models outside the top 50: ${int(c.hhi_low)} to ${int(c.hhi_high)}` };
      }),
      band: months.map((m) => {
        const c = CONC[MONTHS.indexOf(m)];
        return { m, lo: c.hhi_low, hi: c.hhi_high };
      }),
    };
    const out = [monthly];
    if (showDaily) {
      const lo = monthX(months[0]);
      const hi = monthX(months[months.length - 1]);
      out.push({
        id: "daily",
        label: "Daily, 7-day mean",
        color: "var(--ink-soft)",
        width: 1.5,
        points: DAILY.filter((d) => d.hhi_7day !== null)
          .map((d) => ({ m: d.date.slice(0, 7), x: dateToYear(d.date), y: d.hhi_7day as number, note: d.date }))
          .filter((p) => p.x >= lo && p.x <= hi),
      });
    }
    return out;
  }, [months, showDaily]);

  /* ---- extremes and summary numbers ---- */
  const stats = useMemo(() => {
    const minRow = CONC.reduce((a, b) => (b.hhi < a.hhi ? b : a));
    const maxRow = CONC.reduce((a, b) => (b.hhi > a.hhi ? b : a));
    const leaderChanges = CONC.filter((c, i) => i > 0 && c.leader !== CONC[i - 1].leader).length;
    const leaders = new Set(CONC.map((c) => c.leader));
    const inst = CONC.map((c) => c.instability).filter((v): v is number => v !== null);
    const meanInst = inst.reduce((s, v) => s + v, 0) / inst.length;
    const maxShift = Math.max(...CONC.map((c) => Math.max(Math.abs(c.hhi - c.hhi_low), Math.abs(c.hhi - c.hhi_high)) / c.hhi));
    const maxUnattr = Math.max(...CONC.map((c) => c.unattributed_share_of_top50));
    const ever1 = new Set(SHARES.filter((r) => r.share >= 0.01).map((r) => r.firm)).size;
    return { minRow, maxRow, leaderChanges, leaders: leaders.size, meanInst, maxShift, maxUnattr, ever1 };
  }, []);

  /* ---- Cournot / Lerner ---- */
  const mSel = markupOf(cs.hhi, eps);
  const mMin = markupOf(stats.minRow.hhi, eps);
  const mMax = markupOf(stats.maxRow.hhi, eps);
  const markupSeries: PriceSeries[] = useMemo(
    () => [
      {
        id: "markup",
        label: "Markup over cost",
        color: "var(--owner)",
        width: 3,
        dots: true,
        points: months.map((m) => ({ m, y: markupOf(CONC[MONTHS.indexOf(m)].hhi, eps).markup * 100, note: `HHI ${int(CONC[MONTHS.indexOf(m)].hhi)}` })),
      },
    ],
    [months, eps],
  );

  const curve = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ n: i + 1, ...cournot(i + 1, cost) })), [cost]);
  const cur = cournot(nFirms, cost);
  const mono = cournot(1, cost);
  const cournotSeries: LineSeries[] = [
    { id: "price", label: "Price", color: "var(--ink)", points: curve.map((c) => [c.n, c.P] as [number, number]) },
    { id: "output", label: "Output", color: "var(--ai)", points: curve.map((c) => [c.n, c.Q] as [number, number]) },
    { id: "margin", label: "Margin", color: "var(--owner)", points: curve.map((c) => [c.n, c.lerner] as [number, number]) },
  ];
  const effNearest = Math.min(12, Math.max(1, Math.round(cs.effective_firms)));

  /* ---- hosts ---- */
  const effect = (coef: number) => Math.pow(kHosts, coef) - 1;
  const hcOpenLow = findHC("open", "log lowest price");
  const hcOpenMed = findHC("open", "log median price");
  const hcOpenGap = findHC("open", "log (highest / lowest price)");
  const hcClosedLow = findHC("closed", "log lowest price");
  const hcClosedMed = findHC("closed", "log median price");
  const hcClosedGap = findHC("closed", "log (highest / lowest price)");
  const priceRows = [
    { r: hcOpenLow, label: "Open weights, lowest price", color: OPEN },
    { r: hcOpenMed, label: "Open weights, median price", color: OPEN },
    { r: hcClosedLow, label: "Closed, lowest price", color: CLOSED },
    { r: hcClosedMed, label: "Closed, median price", color: CLOSED },
  ].flatMap((x) => (x.r ? [{ id: x.label, label: `${x.label} (${x.r.n_models})`, est: effect(x.r.coef_log_hosts), lo: effect(x.r.ci_low), hi: effect(x.r.ci_high), color: x.color }] : []));
  const gapRows = [
    { r: hcOpenGap, label: "Open weights", color: OPEN },
    { r: hcClosedGap, label: "Closed", color: CLOSED },
  ].flatMap((x) => (x.r ? [{ id: x.label, label: `${x.label} (${x.r.n_models})`, est: Math.pow(kHosts, x.r.coef_log_hosts), lo: Math.pow(kHosts, x.r.ci_low), hi: Math.pow(kHosts, x.r.ci_high), color: x.color }] : []));
  const gapMax = Math.max(2, ...gapRows.map((g) => g.hi)) * 1.08;

  const hostMonth = HOST_MONTHS[hMonth];
  const hostRows = HP_BY_MONTH.get(hostMonth) ?? [];
  const hostDots: HostDot[] = hostRows.map((r) => {
    const cls = accessClass(r.access);
    return {
      id: r.model,
      x: r.n_hosts * (1 + 0.16 * jitter(r.model)),
      y: r.price_min,
      color: cls === "open" ? OPEN : cls === "closed" ? CLOSED : UNCLEAR,
      title: r.model,
      sub: `${r.access}; ${r.n_hosts} host${r.n_hosts === 1 ? "" : "s"}; lowest ${usd(r.price_min)}, highest ${usd(r.price_max)} per million tokens`,
    };
  });
  const openHP = hostRows.filter((r) => accessClass(r.access) === "open");
  const closedHP = hostRows.filter((r) => accessClass(r.access) === "closed");

  /* ---- revenue ---- */
  const companies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of REV) counts.set(r.company, (counts.get(r.company) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, []);
  const revColor = (c: string) => FIRM_COLORS[c] ?? SPARE_COLORS[companies.findIndex((x) => x[0] === c) % SPARE_COLORS.length];
  const revSeries: RevSeries[] = revSel
    .filter((c) => companies.some((x) => x[0] === c))
    .map((c) => ({
      id: c,
      label: c,
      color: revColor(c),
      points: REV.filter((r) => r.company === c)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => ({ t: dateToYear(r.date), v: r.revenue_usd / 1e9, note: `${r.date}: ${r.type}, confidence ${r.confidence.toLowerCase()}` })),
    }));
  const revTs = revSeries.flatMap((s) => s.points.map((p) => p.t));
  const revDomain: [number, number] = revTs.length ? [Math.min(...revTs) - 0.15, Math.max(...revTs) + 0.15] : [2023, 2027];
  const latestRev = useMemo(() => {
    return companies
      .map(([c, n]) => {
        const rows = REV.filter((r) => r.company === c).sort((a, b) => a.date.localeCompare(b.date));
        return { company: c, count: n, last: rows[rows.length - 1] };
      })
      .sort((a, b) => b.last.revenue_usd - a.last.revenue_usd);
  }, [companies]);
  const revFmt = (v: number) => (v >= 1 ? `$${+v.toPrecision(3)}B` : `$${Math.round(v * 1000)}M`);
  const anthropicN = REV.filter((r) => r.company === "Anthropic").length;
  const openaiN = REV.filter((r) => r.company === "OpenAI").length;

  usePageState("m5", {
    "months shown": `${MONTHS[from]} to ${MONTHS[to]}`,
    "selected month": cs.month,
    "HHI in the selected month": Math.round(cs.hhi),
    "equal-sized firms equivalent": +cs.effective_firms.toFixed(1),
    "largest firm in the selected month": `${cs.leader} (${pct0(cs.cr1)})`,
    "demand elasticity for the Lerner index": eps,
    "implied Lerner index, selected month": +mSel.L.toFixed(3),
    "implied markup over cost %, selected month": +(mSel.markup * 100).toFixed(1),
    "Cournot calculator firms": nFirms,
    "Cournot calculator marginal cost": cost,
    "hosts multiplied by": kHosts,
    "host scatter month": hostMonth,
    "daily 7-day HHI shown": showDaily,
  });

  const hostEffText = (r: HostComp | undefined) => (r ? `${signedPct(effect(r.coef_log_hosts))} (${signedPct(effect(r.ci_low))} to ${signedPct(effect(r.ci_high))})` : "");
  const clearEffect = (r: HostComp | undefined) => Boolean(r && (r.ci_low > 0 || r.ci_high < 0));

  return (
    <>
      <PageHead
        id="M5"
        title="Who sells the intelligence, and who has the power?"
        question="See who carries the tokens on OpenRouter, how concentrated that is, and what concentration would mean for markups. Then check whether sellers of the same model compete on price."
      />

      {/* ------------------------------------------------------------ */}
      <Section>
        <h2 className="mb-4">Who carries the tokens</h2>
        <Card>
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-3">
            <Slider label="From" value={from} min={0} max={Math.max(0, to - 2)} step={1} tone="owner" format={(v) => monthLabel(MONTHS[v])} onChange={(v) => setFrom(Math.min(v, to - 2))} />
            <Slider label="To" value={to} min={Math.min(N - 1, from + 2)} max={N - 1} step={1} tone="owner" format={(v) => monthLabel(MONTHS[v])} onChange={(v) => setTo(Math.max(v, from + 2))} />
            <div>
              <Slider label="Month to look at" value={selC} min={from} max={to} step={1} tone="owner" format={(v) => monthLabel(MONTHS[v])} onChange={setSel} />
              <PlayButton playing={player.playing} onClick={player.toggle} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <PresetBar
              presets={RANGE_PRESETS.map((r) => ({ id: r.id, label: r.label }))}
              active={RANGE_PRESETS.find((r) => r.from === from && r.to === to)?.id ?? ""}
              onPick={(id) => {
                const r = RANGE_PRESETS.find((x) => x.id === id);
                if (r) {
                  setFrom(r.from);
                  setTo(r.to);
                }
              }}
            />
          </div>
        </Card>

        <Card className="mt-5">
          <h3 className="ui mb-3 text-[1.1rem]">{monthLabel(cs.month)}</h3>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <Stat value={int(cs.hhi)} label="HHI of firm shares (0 to 10,000)" tone="owner" sub={`${int(cs.hhi_low)} to ${int(cs.hhi_high)} allowing for models outside the top 50`} />
            <Stat value={cs.effective_firms.toFixed(1)} label="Equal-sized firms with the same HHI" sub={`${cs.n_firms} firms have any tokens`} />
            <Stat value={pct0(cs.cr1)} label={`Share of the largest firm, ${cs.leader}`} sub={`top four firms: ${pct0(cs.cr4)}`} />
            <Stat value={cs.instability === null ? "n/a" : cs.instability.toFixed(2)} label="Share-change index since last month" sub={cs.instability === null ? "first month in the data" : "0 = no share moved, 1 = full turnover"} />
            <Stat value={String(cs.firms_ge_1pct)} label="Firms with at least 1% of tokens" sub={cs.new_firms_ge_1pct === null ? undefined : `${int(cs.new_firms_ge_1pct)} newly reached 1% this month`} />
          </div>
        </Card>

        <div className="mt-5 space-y-5">
          <Figure
            title="Share of tokens by firm"
            subtitle="Each band is a firm's share of the tokens of the top 50 models on OpenRouter that month. Anonymous pre-release models are left out. Click or drag across the chart to choose the month; hover to see shares."
            source="Source: OpenRouter (openrouter.ai/rankings), as of 2026-11-22. Licensed under CC BY 4.0. Firm = the model author's parent company."
          >
            <ShareArea
              months={months}
              series={areaSeries}
              selected={selC - from}
              onSelect={(i) => setSel(from + i)}
              ariaLabel={`Stacked area chart of firm shares of OpenRouter tokens from ${monthLabel(MONTHS[from])} to ${monthLabel(MONTHS[to])}. In ${monthLabel(cs.month)}, ${cs.leader} had the largest share, ${pct0(cs.cr1)}.`}
            />
          </Figure>

          <div className="grid gap-5 lg:grid-cols-2">
            <Figure
              title="How concentrated: the HHI over time"
              subtitle="HHI is 10,000 times the sum of squared shares. Higher means fewer, bigger firms. The dashed line at 1,800 is the level US merger guidelines call highly concentrated. The band shows the range if the tokens of models outside the top 50 are counted."
              source="Source: OpenRouter (openrouter.ai/rankings), as of 2026-11-22. Licensed under CC BY 4.0. Daily series: 7-day mean."
            >
              <div className="mb-2">
                <Toggle label="Add the daily series (7-day mean)" checked={showDaily} onChange={setShowDaily} />
              </div>
              <PriceChart
                months={months}
                series={hhiSeries}
                log={false}
                height={330}
                yFormat={(n) => int(n)}
                hlines={[{ y: 1800, label: "1,800" }]}
                markers={[{ m: cs.month, label: monthLabel(cs.month) }]}
                ariaLabel={`Line chart of the monthly HHI of firm shares, ${monthLabel(MONTHS[from])} to ${monthLabel(MONTHS[to])}. It is ${int(CONC[from].hhi)} at the start and ${int(CONC[to].hhi)} at the end.`}
              />
            </Figure>
            <Figure
              title={`Firm shares in ${monthLabel(cs.month)}`}
              subtitle="The nine largest firms that month, then the rest together. Bars use the same scale in every month, so you can watch them move. Grey bars are firms grouped as other firms in the area chart."
              source="Source: OpenRouter (openrouter.ai/rankings), as of 2026-11-22. Licensed under CC BY 4.0."
            >
              <HBars items={bars} format={pct1} max={Math.max(MAX_SHARE, ...bars.map((b) => b.value))} labelWidth={150} ariaLabel={`Bar chart of firm shares of tokens in ${monthLabel(cs.month)}`} />
            </Figure>
          </div>

          <Takeaway>
            <p>
              In {monthLabel(cs.month)}, <strong>{cs.leader}</strong> carried {pct0(cs.cr1)} of the tokens counted and the four largest firms {pct0(cs.cr4)}. The HHI of {int(cs.hhi)} is the concentration of about {cs.effective_firms.toFixed(1)} equal-sized firms.
            </p>
            <p>
              Across the {N} months the HHI went from {int(CONC[0].hhi)} to a low of {int(stats.minRow.hhi)} in {monthLabel(stats.minRow.month)}, then {int(CONC[N - 1].hhi)} in {monthLabel(CONC[N - 1].month)}. The largest firm changed {stats.leaderChanges} times, across {stats.leaders} different leaders, and the average share-change index is {stats.meanInst.toFixed(2)}. That is a market where positions move fast, which is some evidence that entry is easy. It is evidence about OpenRouter&apos;s users only.
            </p>
          </Takeaway>
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section>
        <h2 className="mb-4">What concentration would imply for markups</h2>
        <p className="mb-5 max-w-[68ch] text-ink-soft">
          In a Cournot market, where firms choose how much to sell, the average gap between price and marginal cost, as a share of price, is the HHI divided by the market&apos;s demand elasticity. That gap is the Lerner index. These numbers come from the model, not from anyone&apos;s accounts.
        </p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <fieldset className="rounded-[6px] border border-rule bg-surface px-4 py-3">
              <legend className="ui px-1 text-[1rem] font-bold" style={{ color: "var(--owner)" }}>
                Demand elasticity
              </legend>
              <Slider
                label="Market demand elasticity"
                value={eps}
                min={1}
                max={5}
                step={0.05}
                tone="owner"
                format={(v) => v.toFixed(2)}
                onChange={setEps}
                help="The percent fall in quantity demanded when the market price rises 1%. It must be above 1: a firm facing less than that would keep raising its price."
              />
              <PresetBar
                presets={[
                  { id: "1.5", label: "1.5" },
                  { id: "2", label: "2" },
                  { id: "3", label: "3" },
                  { id: "5", label: "5" },
                ]}
                active={String(eps)}
                onPick={(id) => setEps(Number(id))}
              />
              <p className="ui mt-3 text-[0.85rem] leading-snug text-ink-soft">The best estimate in the Prices lab is about {"−"}0.47, which is below 1 in size and so cannot be used here. You choose the elasticity.</p>
            </fieldset>
          </div>
          <div className="min-w-0 space-y-5">
            <Card>
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                <Stat value={`${pctText(mSel.markup * 100)}`} label={`Markup over cost, ${monthLabel(cs.month)} (HHI ${int(cs.hhi)})`} tone="owner" sub={`Lerner index ${mSel.L.toFixed(2)}`} />
                <Stat value={`${pctText(mMin.markup * 100)}`} label={`Least concentrated month, ${monthLabel(stats.minRow.month)} (HHI ${int(stats.minRow.hhi)})`} sub={`Lerner index ${mMin.L.toFixed(2)}`} />
                <Stat value={`${pctText(mMax.markup * 100)}`} label={`Most concentrated month, ${monthLabel(stats.maxRow.month)} (HHI ${int(stats.maxRow.hhi)})`} sub={`Lerner index ${mMax.L.toFixed(2)}`} />
              </div>
            </Card>
            <Figure
              title={`Markup over cost the HHI would imply, at elasticity ${eps.toFixed(2)}`}
              subtitle="Lerner index divided by one minus the Lerner index. Move the elasticity and the whole line moves; the shape comes from the HHI."
              source="Source: HHI from OpenRouter (openrouter.ai/rankings), as of 2026-11-22, CC BY 4.0. The markup is a model result, not a measured margin."
            >
              <PriceChart
                months={months}
                series={markupSeries}
                log={false}
                height={280}
                yFormat={(n) => `${Math.round(n)}%`}
                markers={[{ m: cs.month, label: monthLabel(cs.month) }]}
                ariaLabel={`Line chart of the Cournot-implied markup over cost at demand elasticity ${eps.toFixed(2)}. In ${monthLabel(cs.month)} it is ${pctText(mSel.markup * 100)}.`}
              />
            </Figure>
            <Takeaway>
              <p>
                At an elasticity of {eps.toFixed(2)}, the HHI of {int(cs.hhi)} in {monthLabel(cs.month)} implies a Lerner index of <strong>{mSel.L.toFixed(2)}</strong>: price about <strong>{pctText(mSel.markup * 100)}</strong> above marginal cost. In the least concentrated month ({monthLabel(stats.minRow.month)}) the figure is {pctText(mMin.markup * 100)}, and in the most concentrated ({monthLabel(stats.maxRow.month)}) it is {pctText(mMax.markup * 100)}.
              </p>
              <p>These are what a Cournot market with this concentration would charge, not measured margins. Real firms differ in cost, products differ, and the elasticity is a choice you make with the slider.</p>
            </Takeaway>
          </div>
        </div>

        {/* calculator */}
        <h3 className="ui mb-2 mt-10 text-[1.4rem]">Cournot and Bertrand with a straight-line demand curve</h3>
        <p className="mb-5 max-w-[68ch] text-ink-soft">
          Demand is price = 1 minus quantity, so the highest price anyone would pay is 1 and the most that could be sold is 1. Every firm has the same constant cost. Add firms and watch price, output and the margin move between monopoly and perfect competition.
        </p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <fieldset className="rounded-[6px] border border-rule bg-surface px-4 py-3">
              <legend className="ui px-1 text-[1rem] font-bold" style={{ color: "var(--ai-deep)" }}>
                The market
              </legend>
              <Slider label="Number of firms" value={nFirms} min={1} max={12} step={1} format={(v) => String(v)} onChange={setNFirms} help="1 is a monopoly. With equal shares the HHI is 10,000 divided by the number of firms." />
              <Slider label="Marginal cost" value={cost} min={0.05} max={0.9} step={0.05} tone="owner" format={(v) => v.toFixed(2)} onChange={setCost} help="The cost of serving one more unit, in the same units as price." />
              <button
                onClick={() => setNFirms(effNearest)}
                className="ui mt-2 rounded-full border border-rule px-3.5 py-1.5 text-[0.9rem] hover:border-ai hover:bg-ai-soft"
              >
                Use {effNearest} firms, the closest to {monthLabel(cs.month)}
              </button>
            </fieldset>
          </div>
          <div className="min-w-0 space-y-5">
            <Figure
              title="Price, output and margin as firms are added"
              subtitle="The bottom axis is the number of firms. Cournot competition: each firm picks its quantity, taking the others as given. The dashed lines mark the monopoly price and the cost. Perfect competition puts the price at cost."
              source="A textbook calculation with demand price = 1 minus quantity; no data. Margin is the Lerner index, (price minus cost) divided by price."
            >
              <LineChart
                series={cournotSeries}
                xDomain={[1, 12]}
                yDomain={[0, 1]}
                xTicks={11}
                height={320}
                rightPad={64}
                xFormat={(n) => String(Math.round(n))}
                yFormat={(n) => n.toFixed(1)}
                markers={[{ x: nFirms, label: `${nFirms} firm${nFirms === 1 ? "" : "s"}` }]}
                hlines={[
                  { y: mono.P, label: "Monopoly price" },
                  { y: cost, label: "Cost" },
                ]}
                ariaLabel={`Chart of Cournot price, output and margin for one to twelve firms at marginal cost ${cost.toFixed(2)}. With ${nFirms} firms the price is ${cur.P.toFixed(2)}.`}
              />
              <div className="mt-3 overflow-x-auto">
                <table className="ui w-full min-w-[30rem] border-collapse text-left text-[0.9rem]">
                  <caption className="sr-only-ui">Price, output and markup for monopoly, the chosen number of firms, and perfect competition</caption>
                  <thead>
                    <tr className="border-b border-rule text-ink-soft">
                      <th className="py-1.5 pr-3 font-semibold">Market</th>
                      <th className="py-1.5 pr-3 font-semibold">Price</th>
                      <th className="py-1.5 pr-3 font-semibold">Output</th>
                      <th className="py-1.5 pr-3 font-semibold">Markup over cost</th>
                      <th className="py-1.5 font-semibold">Margin (Lerner)</th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    <tr className="border-b border-rule/60">
                      <td className="py-1.5 pr-3 font-semibold">Monopoly (1 firm)</td>
                      <td className="pr-3">{mono.P.toFixed(3)}</td>
                      <td className="pr-3">{mono.Q.toFixed(3)}</td>
                      <td className="pr-3">{pctText(mono.markup * 100)}</td>
                      <td>{mono.lerner.toFixed(3)}</td>
                    </tr>
                    <tr className="border-b border-rule/60 bg-ai-soft/40">
                      <td className="py-1.5 pr-3 font-semibold">Cournot, {nFirms} firm{nFirms === 1 ? "" : "s"}</td>
                      <td className="pr-3">{cur.P.toFixed(3)}</td>
                      <td className="pr-3">{cur.Q.toFixed(3)}</td>
                      <td className="pr-3">{pctText(cur.markup * 100)}</td>
                      <td>{cur.lerner.toFixed(3)}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-3 font-semibold">Perfect competition</td>
                      <td className="pr-3">{cost.toFixed(3)}</td>
                      <td className="pr-3">{(1 - cost).toFixed(3)}</td>
                      <td className="pr-3">0%</td>
                      <td>0.000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Figure>
            <Takeaway title="Reading the calculator">
              <p>
                With {nFirms} equal firm{nFirms === 1 ? "" : "s"} (an HHI of {int(10000 / nFirms)}), Cournot competition puts the price at {cur.P.toFixed(2)}, between the monopoly price of {mono.P.toFixed(2)} and the competitive price of {cost.toFixed(2)}. Output is {cur.Q.toFixed(2)} against {(1 - cost).toFixed(2)} under perfect competition. At this equilibrium the market&apos;s demand elasticity is {cur.elasticity.toFixed(2)}{cur.elasticity > 1 ? ", above 1 as it must be." : ", which is not above 1, so a firm would want to raise its price: no such equilibrium would hold."}
              </p>
              <p>
                <strong>Bertrand competition</strong> is the contrasting case: firms set prices, and with identical products and the same cost, two firms are enough to push the price down to cost. Real AI sellers sit between the two, because products differ in quality, speed and trust, and capacity is limited. The next section looks at whether sellers of the same model do compete on price.
              </p>
            </Takeaway>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section>
        <h2 className="mb-4">Price competition among hosts</h2>
        <p className="mb-5 max-w-[68ch] text-ink-soft">
          Many models can be bought from several hosts: the model&apos;s own company and cloud resellers. If hosts compete on price, more hosts should push the lowest price down. The regressions below compare each model with itself over time, with month effects.
        </p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <fieldset className="rounded-[6px] border border-rule bg-surface px-4 py-3">
              <legend className="ui px-1 text-[1rem] font-bold" style={{ color: "var(--ai-deep)" }}>
                The number of hosts
              </legend>
              <Slider
                label="Multiply the number of hosts by"
                value={kHosts}
                min={1.25}
                max={8}
                step={0.05}
                format={(v) => `×${v.toFixed(2)}`}
                onChange={(v) => setKHosts(Math.round(v * 100) / 100)}
                toPos={Math.log}
                fromPos={Math.exp}
                help="2 means doubling: from 3 hosts to 6, say."
              />
              <PresetBar
                presets={[
                  { id: "1.5", label: "×1.5" },
                  { id: "2", label: "Double" },
                  { id: "4", label: "×4" },
                  { id: "8", label: "×8" },
                ]}
                active={String(kHosts)}
                onPick={(id) => setKHosts(Number(id))}
              />
            </fieldset>
          </div>
          <div className="min-w-0 space-y-5">
            <div className="grid gap-5">
              <Figure
                title={`Price when hosts are multiplied by ${kHosts.toFixed(kHosts % 1 === 0 ? 0 : 2)}`}
                subtitle="Percent change in the lowest and the median price across hosts. Dots are estimates, bars are 95% intervals; the number of models is in brackets."
                source="Source: Epoch AI (CC BY) for open-weights status; LiteLLM price file (list prices, month-end snapshots). Regression with model and month fixed effects."
              >
                <IntervalPlot
                  rows={priceRows}
                  domain={[-0.8, 0.3]}
                  ticks={[-0.8, -0.6, -0.4, -0.2, 0, 0.2]}
                  refs={[{ x: 0, label: "No change" }]}
                  format={(n) => signedPct(n)}
                  ariaLabel={`Estimated change in host prices when the number of hosts is multiplied by ${kHosts}. ${priceRows.map((r) => `${r.label}: ${signedPct(r.est)}`).join("; ")}.`}
                />
              </Figure>
              <Figure
                title="The gap between highest and lowest host price"
                subtitle={`The highest price divided by the lowest, multiplied by this factor when hosts are multiplied by ${kHosts.toFixed(kHosts % 1 === 0 ? 0 : 2)}. Above 1 means the gap widens.`}
                source="Source: as for the figure on the left."
              >
                <IntervalPlot
                  rows={gapRows}
                  domain={[0, gapMax]}
                  refs={[{ x: 1, label: "No change" }]}
                  format={(n) => `×${n.toFixed(2)}`}
                  ariaLabel={`Estimated change in the gap between the highest and lowest host price when hosts are multiplied by ${kHosts}. ${gapRows.map((r) => `${r.label}: times ${r.est.toFixed(2)}`).join("; ")}.`}
                />
              </Figure>
            </div>
            <Takeaway>
              <p>
                Multiplying the number of hosts by {kHosts.toFixed(kHosts % 1 === 0 ? 0 : 2)} goes with a lowest price {hostEffText(hcOpenLow)} for <strong>open-weights models</strong>, as Bertrand competition would predict.
                {hcClosedLow && !clearEffect(hcClosedLow) ? <> For <strong>closed models</strong> there is no clear effect ({hostEffText(hcClosedLow)}), because cloud resellers mostly list the same price as the model&apos;s maker.</> : <> For closed models the change is {hostEffText(hcClosedLow)}.</>}
              </p>
              <p>
                The gap between the highest and lowest price also widens as hosts are added{hcOpenGap ? <>: with hosts multiplied by {kHosts.toFixed(kHosts % 1 === 0 ? 0 : 2)}, the ratio of highest to lowest price is multiplied by {Math.pow(kHosts, hcOpenGap.coef_log_hosts).toFixed(1)} for open-weights models</> : null}. So hosts also differ from one another in speed, region and context length. These are associations within each model, not proven causes.
              </p>
            </Takeaway>
          </div>
        </div>

        {/* host scatter */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <fieldset className="rounded-[6px] border border-rule bg-surface px-4 py-3">
              <legend className="ui px-1 text-[1rem] font-bold" style={{ color: "var(--ai-deep)" }}>
                The month
              </legend>
              <Slider label="Month" value={hMonth} min={0} max={NH - 1} step={1} format={(v) => monthLabel(HOST_MONTHS[v])} onChange={setHMonth} />
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <PlayButton playing={hostPlayer.playing} onClick={hostPlayer.toggle} />
                <span className="ui text-[0.85rem] text-ink-soft">Steps through the months once.</span>
              </div>
            </fieldset>
          </div>
          <div className="min-w-0 space-y-5">
            <Figure
              title={`Hosts and lowest price, ${monthLabel(hostMonth)}`}
              subtitle="One dot per model. Dots are nudged sideways a little so that models with the same number of hosts do not hide each other. Click or tap a dot for its name."
              source="Source: Epoch AI (CC BY) for open-weights status; LiteLLM price file (list prices, month-end snapshots). A cross-section like this mixes big and small models; the regressions above compare each model with itself."
            >
              <HostScatter
                dots={hostDots}
                xDomain={[0.7, 30]}
                yDomain={[0.01, 100]}
                xTicks={[1, 2, 3, 5, 10, 20]}
                keys={[
                  { label: "Open weights", color: OPEN },
                  { label: "Closed (API access only)", color: CLOSED },
                ]}
                yFormat={(n) => (n >= 1 ? `$${n}` : `$${+n.toPrecision(2)}`)}
                ariaLabel={`Scatter of ${hostRows.length} models in ${monthLabel(hostMonth)}: number of hosts against lowest price per million tokens.`}
              />
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
                <Stat value={String(hostRows.length)} label={`Models with a price in ${monthLabel(hostMonth)}`} sub={`${openHP.length} open weights, ${closedHP.length} closed`} />
                <Stat value={openHP.length ? median(openHP.map((r) => r.n_hosts)).toFixed(1) : "none"} label="Median number of hosts, open weights" tone="ai" />
                <Stat value={closedHP.length ? median(closedHP.map((r) => r.n_hosts)).toFixed(1) : "none"} label="Median number of hosts, closed" tone="ai" />
                <Stat value={openHP.length ? usd(median(openHP.map((r) => r.price_min))) : "none"} label="Median lowest price, open weights" />
                <Stat value={closedHP.length ? usd(median(closedHP.map((r) => r.price_min))) : "none"} label="Median lowest price, closed" />
              </div>
            </Figure>
          </div>
        </div>
        <details className="ui mt-5 text-[0.92rem]">
          <summary className="cursor-pointer font-semibold">Show the regression numbers</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-rule text-ink-soft">
                  <th className="py-1.5 pr-3 font-semibold">Models</th>
                  <th className="py-1.5 pr-3 font-semibold">Dependent variable</th>
                  <th className="py-1.5 pr-3 font-semibold">Coefficient on log hosts</th>
                  <th className="py-1.5 pr-3 font-semibold">95% interval</th>
                  <th className="py-1.5 font-semibold">Observations (models)</th>
                </tr>
              </thead>
              <tbody className="num">
                {HC.map((r) => (
                  <tr key={`${r.sample}|${r.dependent}`} className="border-b border-rule/60">
                    <td className="py-1.5 pr-3">{r.sample}</td>
                    <td className="pr-3">{r.dependent}</td>
                    <td className="pr-3">{r.coef_log_hosts.toFixed(3)}</td>
                    <td className="pr-3">
                      {r.ci_low.toFixed(3)} to {r.ci_high.toFixed(3)}
                    </td>
                    <td>
                      {int(r.n_obs)} ({r.n_models})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section>
        <h2 className="mb-4">Revenue: what is reported, and why it is not used</h2>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <fieldset className="rounded-[6px] border border-rule bg-surface px-4 py-3">
              <legend className="ui px-1 text-[1rem] font-bold" style={{ color: "var(--ai-deep)" }}>
                Companies to show
              </legend>
              <div className="flex flex-wrap gap-2">
                {companies.map(([c, n]) => {
                  const on = revSel.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => setRevSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))}
                      aria-pressed={on}
                      className={`ui rounded-full border px-3 py-1 text-[0.88rem] transition-colors ${on ? "border-ink bg-ink text-paper" : "border-rule bg-surface hover:border-ai hover:bg-ai-soft"}`}
                    >
                      {c} <span className="opacity-70">({n})</span>
                    </button>
                  );
                })}
              </div>
              <p className="ui mt-2 text-[0.85rem] leading-snug text-ink-soft">The number in brackets is how many reports Epoch has for that company.</p>
              <div className="mt-3">
                <Segmented
                  label="Vertical axis"
                  value={revAxis}
                  onChange={setRevAxis}
                  options={[
                    { value: "log", label: "Log scale" },
                    { value: "linear", label: "Linear scale" },
                  ]}
                />
              </div>
            </fieldset>
          </div>
          <div className="min-w-0 space-y-5">
            <Figure
              title="Reported run rates, sparse"
              subtitle="Each dot is one report of annualised revenue. The dashed line only joins the reports; it does not show what happened between them."
              source="Source: Epoch AI (ai_companies data, CC BY). Reports differ in kind: annualised run rate, annual recurring revenue, or an interpolated period figure."
            >
              <RevenueDots
                series={revSeries}
                log={revAxis === "log"}
                xDomain={revDomain}
                yFormat={revFmt}
                ariaLabel={`Reported annualised revenue by company. ${revSeries.map((s) => `${s.label}: ${s.points.length} reports, latest ${revFmt(s.points[s.points.length - 1].v)}`).join("; ")}.`}
              />
            </Figure>
            <Figure title="Latest report for each company" source="Source: Epoch AI (CC BY). Dates are the dates of the reports, not of the underlying revenue.">
              <div className="overflow-x-auto">
                <table className="ui w-full min-w-[34rem] border-collapse text-left text-[0.9rem]">
                  <thead>
                    <tr className="border-b border-rule text-ink-soft">
                      <th className="py-1.5 pr-3 font-semibold">Company</th>
                      <th className="py-1.5 pr-3 font-semibold">Latest report</th>
                      <th className="py-1.5 pr-3 font-semibold">Amount</th>
                      <th className="py-1.5 pr-3 font-semibold">Kind</th>
                      <th className="py-1.5 pr-3 font-semibold">Confidence</th>
                      <th className="py-1.5 font-semibold">Reports</th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    {latestRev.map((r) => (
                      <tr key={r.company} className="border-b border-rule/60">
                        <td className="py-1.5 pr-3 font-semibold">{r.company}</td>
                        <td className="pr-3">{r.last.date}</td>
                        <td className="pr-3">{revFmt(r.last.revenue_usd / 1e9)}</td>
                        <td className="pr-3 font-normal">{r.last.type}</td>
                        <td className="pr-3 font-normal">{r.last.confidence}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Figure>
            <Takeaway title="Why revenue concentration is not computed">
              <p>
                Epoch&apos;s revenue file has {REV.length} reports for {companies.length} companies, mostly Anthropic ({anthropicN}) and OpenAI ({openaiN}), at irregular dates and with different definitions. Several large providers have none. A revenue-share HHI built from this would mostly reflect who happened to report, so it is left out. Token shares above are the substitute, and tokens are not revenue.
              </p>
            </Takeaway>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section className="grid gap-5 lg:grid-cols-2">
        <Caveat title="Read with care">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Shares are of tokens on OpenRouter, a router used by developers and apps. They are not the whole market, and tokens are not revenue or customers.</li>
            <li>
              Only the top 50 models each day are listed. Allowing for the rest moves the HHI by at most about {Math.round(stats.maxShift * 100)}%, which is the band on the HHI chart. Anonymous pre-release models are left out; they were up to {pct0(stats.maxUnattr)} of top-50 tokens in a month.
            </li>
            <li>A firm is the model author mapped to its parent company. The mapping is partial: some small authors still count as firms of their own. Token counts use each provider&apos;s own tokenizer.</li>
            <li>The Lerner and markup numbers are model-implied, not measured margins. They depend on the elasticity you choose, which has to be above 1, and they assume firms compete on quantity.</li>
            <li>Host prices are list prices from month-end snapshots of the LiteLLM file. More hosts can mean more choice, not only more competition, and the regressions show association, not cause.</li>
          </ul>
        </Caveat>
        <Caveat title="Concepts">
          <p>HHI, Cournot competition, Bertrand competition, Lerner index, market power, entry and contestability, network effects.</p>
          <details className="ui text-[0.92rem]">
            <summary className="cursor-pointer font-semibold text-ink">What these mean</summary>
            <dl className="mt-2 space-y-1.5">
              <div>
                <dt className="inline font-semibold">HHI: </dt>
                <dd className="inline">the sum of squared market shares, scaled to 10,000. One firm gives 10,000; ten equal firms give 1,000.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Cournot competition: </dt>
                <dd className="inline">firms choose quantities. More firms push price toward cost, but not all the way.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Bertrand competition: </dt>
                <dd className="inline">firms choose prices. With identical products, two firms can already push price to cost.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Lerner index: </dt>
                <dd className="inline">(price minus marginal cost) divided by price. Zero in perfect competition.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Market power: </dt>
                <dd className="inline">the ability to hold price above cost without losing the customers.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Entry and contestability: </dt>
                <dd className="inline">if new firms can enter easily, even a concentrated market may price near cost. {stats.ever1} firms reached 1% of tokens in some month here.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Network effects: </dt>
                <dd className="inline">a product gets more valuable as more people use it, which can lock in a leader. This data does not measure them.</dd>
              </div>
            </dl>
          </details>
        </Caveat>
      </Section>
    </>
  );
}
