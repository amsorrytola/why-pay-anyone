"use client";

import { useMemo, useState } from "react";
import { PageHead, Section, Segmented, Takeaway, Caveat, Figure, Stat } from "@/components/ui";
import { HBars, LineChart, Scatter, fmtYear, type LineSeries, type Pt } from "@/components/charts";
import { usePageState } from "@/components/chat-context";
import { C } from "@/components/Concept";
import national from "@/data/m3_btos_national.json";
import q7groups from "@/data/m3_btos_q7_groups.json";
import adoption from "@/data/m3_btos_adoption_summary.json";
import snapshot from "@/data/m3_btos_snapshot_employment.json";
import sectorExp from "@/data/m3_btos_sector_exposure.json";
import corr from "@/data/m3_btos_exposure_correlation.json";
import aiShare from "@/data/m3_indeed_ai_share_monthly.json";
import eventCoefs from "@/data/m3_event_study_coefs.json";
import eventSummary from "@/data/m3_event_study_summary.json";
import groupPaths from "@/data/m3_event_study_group_paths.json";
import { monthToYear } from "@/lib/format";
import { signed } from "@/components/m1-shared";

type Nat = { ref_end: string; question_id: number; answer: string; estimate_pct: number; se_pct: number };
type Grp = { geo_type: string; geo_name: string; ref_end: string; estimate_pct: number; se_pct: number };
type Adopt = { geo_type: string; geo_name: string; question_id: number; answer: string; last4_mean: number; last4_ci_lo: number; last4_ci_hi: number };
type Snap = { geo_type: string; question_id: number; answer: string; mean_pct: number };
type SecExp = { sector_name: string; ms_exposure: number | null; q7_last4: number | null };
type Corr = { x: string; y: string; n_sectors: number; spearman_rho: number; p_value: number };
type Share = { country: string; month: string; ai_share_pct: number | null; ai_postings_index: number | null };
type Coef = { country: string; spec: string; month: string; pct: number; pct_lo: number; pct_hi: number };
type Summ = { country: string; spec: string; window: string; pct: number | null; pct_lo: number | null; pct_hi: number | null; perm_p: number | null; n_clusters: number | null };
type Path = { country: string; spec: string; group: string; month: string; postings_index_baseline_100: number };

const NAT = national as unknown as Nat[];
const Q7G = q7groups as unknown as Grp[];
const ADOPT = adoption as unknown as Adopt[];
const SNAP = snapshot as unknown as Snap[];
const SECEXP = sectorExp as unknown as SecExp[];
const CORR = corr as unknown as Corr[];
const SHARE = aiShare as unknown as Share[];
const COEF = eventCoefs as unknown as Coef[];
const SUMM = eventSummary as unknown as Summ[];
const PATHS = groupPaths as unknown as Path[];

const dateYear = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return y + (m - 1 + (day - 1) / 31) / 12;
};
const COUNTRIES = ["US", "GB", "CA", "AU", "DE", "FR"];
const SHARE_COUNTRIES = ["US", "GB", "CA", "AU", "DE", "FR", "IE", "IT", "NL"];
const COLORS: Record<string, string> = { US: "var(--ai)", GB: "#7a3db8", CA: "#c2410c", AU: "#17806a", DE: "#8a6d00", FR: "#c43d8a", IE: "#4a6b8a", IT: "#6b8f2e", NL: "#7d5a3c" };
const SPECS = [
  { value: "tercile_ms", label: "Microsoft score" },
  { value: "tercile_aei_rank", label: "Claude use rank" },
  { value: "tercile_ms_no_software", label: "Without software" },
  { value: "tercile_ms_no_tech", label: "Without tech jobs" },
  { value: "tercile_ms_new_postings", label: "New postings only (US)" },
];
const LAUNCH = dateYear("2022-11-30");

export default function M3Page() {
  const [geoType, setGeoType] = useState<"national" | "sector" | "size" | "state">("national");
  const [group, setGroup] = useState("");
  const [rankType, setRankType] = useState<"sector" | "size" | "state">("sector");
  const [shareCountries, setShareCountries] = useState<string[]>(["US", "GB", "CA"]);
  const [shareMode, setShareMode] = useState<"share" | "index">("share");
  const [country, setCountry] = useState("US");
  const [spec, setSpec] = useState("tercile_ms");

  const groups = useMemo(() => Array.from(new Set(Q7G.filter((g) => g.geo_type === geoType).map((g) => g.geo_name))).sort(), [geoType]);
  const activeGroup = group && groups.includes(group) ? group : groups[0];

  // adoption curves
  const curve: LineSeries[] = useMemo(() => {
    const out: LineSeries[] = [];
    const q7 = NAT.filter((r) => r.question_id === 7 && r.answer === "Yes").sort((a, b) => a.ref_end.localeCompare(b.ref_end));
    const q28 = NAT.filter((r) => r.question_id === 28 && r.answer === "Yes").sort((a, b) => a.ref_end.localeCompare(b.ref_end));
    out.push({
      id: "q7",
      label: "All firms: use AI now",
      color: "var(--ai)",
      points: q7.map((r) => [dateYear(r.ref_end), r.estimate_pct]),
      band: q7.map((r) => [dateYear(r.ref_end), r.estimate_pct - 1.96 * r.se_pct, r.estimate_pct + 1.96 * r.se_pct]),
    });
    if (geoType === "national") {
      out.push({ id: "q28", label: "Expect to use in 6 months", color: "var(--ink-soft)", dashed: true, width: 2, points: q28.map((r) => [dateYear(r.ref_end), r.estimate_pct]) });
    } else if (activeGroup) {
      const rows = Q7G.filter((g) => g.geo_type === geoType && g.geo_name === activeGroup).sort((a, b) => a.ref_end.localeCompare(b.ref_end));
      out.push({
        id: "g",
        label: activeGroup.length > 24 ? activeGroup.slice(0, 23) + "…" : activeGroup,
        color: "var(--human)",
        points: rows.map((r) => [dateYear(r.ref_end), r.estimate_pct]),
        band: rows.map((r) => [dateYear(r.ref_end), r.estimate_pct - 1.96 * r.se_pct, r.estimate_pct + 1.96 * r.se_pct]),
      });
    }
    return out;
  }, [geoType, activeGroup]);

  // ranking
  const ranking = useMemo(() => {
    const rows = ADOPT.filter((a) => a.geo_type === rankType && a.question_id === 7 && a.answer === "Yes" && a.last4_mean != null).sort((a, b) => b.last4_mean - a.last4_mean);
    const pick = rankType === "state" ? [...rows.slice(0, 10), ...rows.slice(-8)] : rows;
    return pick.map((r) => ({ label: r.geo_name, value: r.last4_mean, note: `${r.last4_ci_lo.toFixed(1)} to ${r.last4_ci_hi.toFixed(1)}`, color: rankType === "state" && rows.indexOf(r) >= 10 ? "var(--ink-faint)" : "var(--ai)" }));
  }, [rankType]);

  // hiring snapshot
  const snap = (q: number) =>
    ["Increased", "No change", "Decreased"].map((a) => ({
      label: a,
      value: SNAP.find((s) => s.geo_type === "national" && s.question_id === q && s.answer === a)?.mean_pct ?? 0,
      color: a === "Increased" ? "var(--ok)" : a === "Decreased" ? "var(--warn)" : "var(--rule)",
    }));
  const netOf = (q: number) => SNAP.find((s) => s.geo_type === "national" && s.question_id === q && s.answer.startsWith("Net"))?.mean_pct ?? 0;

  // exposure scatter
  const expPts: Pt[] = SECEXP.filter((s) => s.ms_exposure != null && s.q7_last4 != null).map((s) => ({
    id: s.sector_name,
    x: s.ms_exposure as number,
    y: s.q7_last4 as number,
    r: 7,
    color: "var(--ai)",
    label: s.sector_name,
    sub: `AI use ${(s.q7_last4 as number).toFixed(1)}% of firms`,
  }));
  const rho = CORR.find((c) => c.x === "ms_exposure");

  // postings AI share
  const shareSeries: LineSeries[] = useMemo(
    () =>
      shareCountries.map((c) => ({
        id: c,
        label: c,
        color: COLORS[c],
        points: SHARE.filter((r) => r.country === c && (shareMode === "share" ? r.ai_share_pct != null : r.ai_postings_index != null)).map((r) => [monthToYear(r.month), (shareMode === "share" ? r.ai_share_pct : r.ai_postings_index) as number]),
      })),
    [shareCountries, shareMode],
  );

  // event study
  const specOk = country === "US" || spec !== "tercile_ms_new_postings";
  const useSpec = specOk ? spec : "tercile_ms";
  const coefRows = COEF.filter((c) => c.country === country && c.spec === useSpec).sort((a, b) => a.month.localeCompare(b.month));
  const es: LineSeries[] = [
    {
      id: "gap",
      label: "Gap",
      color: "var(--ai)",
      points: coefRows.map((r) => [monthToYear(r.month), r.pct]),
      band: coefRows.map((r) => [monthToYear(r.month), r.pct_lo, r.pct_hi]),
      noLabel: true,
    },
  ];
  const path = (g: string): LineSeries => ({
    id: g,
    label: g === "high" ? "Most exposed third" : "Least exposed third",
    color: g === "high" ? "var(--ai)" : "var(--human-deep)",
    points: PATHS.filter((p) => p.country === country && p.spec === useSpec && p.group === g)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((p) => [monthToYear(p.month), p.postings_index_baseline_100]),
  });
  const sumRow = (w: string, sp = useSpec) => SUMM.find((s) => s.country === country && s.spec === sp && s.window === w);
  const head = sumRow("post_all");
  const before = SUMM.find((s) => s.country === "US" && s.spec === "tercile_ms" && s.window === "change_2022-06_to_2022-11_before_launch");
  const after = SUMM.find((s) => s.country === "US" && s.spec === "tercile_ms" && s.window === "change_2022-11_to_2023-11_after_launch");
  const placebo = SUMM.find((s) => s.country === country && s.spec === "placebo_tercile_ms");

  usePageState("m3", {
    "adoption view": geoType === "national" ? "national" : `${geoType}: ${activeGroup}`,
    "event study country": country,
    "event study measure": useSpec,
    "estimated gap in postings, exposed vs less exposed (%)": head?.pct != null ? +head.pct.toFixed(1) : "n/a",
  });

  const f1 = (n: number | null | undefined) => (n == null ? "n/a" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`);

  return (
    <>
      <PageHead
        id="M3"
        title="Are firms using AI, and is it showing up in hiring?"
        question="Surveys say how many firms use AI. Job postings say whether firms are hiring differently. Do the jobs most exposed to AI have fewer openings than the rest, and did that start with generative AI?"
      />

      <Section>
        <h2 className="mb-3">Adoption: how many firms use AI</h2>
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Segmented
            label="Which firms to show"
            options={[
              { value: "national", label: "All US firms" },
              { value: "sector", label: "By sector" },
              { value: "size", label: "By firm size" },
              { value: "state", label: "By state" },
            ]}
            value={geoType}
            onChange={(v) => {
              setGeoType(v);
              setGroup("");
            }}
          />
          {geoType !== "national" && (
            <label className="ui flex items-center gap-2 text-[0.95rem]">
              Compare with
              <select value={activeGroup} onChange={(e) => setGroup(e.target.value)} className="max-w-[16rem] rounded border border-rule bg-surface px-2 py-1.5">
                {groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Figure
            title="Share of US firms using AI in the last two weeks"
            subtitle="Census Business Trends and Outlook Survey, every two weeks. The band is a 95% range. The survey calls AI &quot;Super Intelligence or SI (formerly AI)&quot;. The share answering &quot;do not know&quot; jumped in the last two rounds, when new AI questions were added, so read the last few points with care."
            source="Source: US Census Bureau, Business Trends and Outlook Survey (public data). Only 26 fortnights of this question exist in the files, so one year of data."
          >
            <LineChart series={curve} height={340} xFormat={fmtYear} yFormat={(n) => `${n}%`} ariaLabel="Share of US firms using AI over time" />
          </Figure>
          <Figure title="Who adopts most" subtitle="Share of firms using AI, mean of the last four fortnights, with 95% range." source="US Census BTOS. States: ten highest and eight lowest.">
            <div className="mb-3">
              <Segmented label="Group by" options={[{ value: "sector", label: "Sector" }, { value: "size", label: "Firm size" }, { value: "state", label: "State" }]} value={rankType} onChange={setRankType} />
            </div>
            <HBars items={ranking} format={(v) => `${v.toFixed(1)}%`} ariaLabel="Share of firms using AI by group" labelWidth={220} rowHeight={24} />
          </Figure>
        </div>
        <div className="mt-5">
          <Takeaway>
            <p>
              About one in four US firms said in late 2026 that they use AI in some business function, up from about one in six a year earlier: roughly eight points a year, in a straight line so far. A year is too short to see the S-shape that <C id="diffusion">diffusion</C> usually takes.
            </p>
            <p>
              The gaps between groups are large and real: information and professional services lead, transport and food service trail, and big firms are well ahead of small ones. Sectors with more AI-exposed jobs adopt more (rank correlation {rho ? rho.spearman_rho.toFixed(2) : "0.66"} across {rho ? rho.n_sectors : 14} sectors).
            </p>
          </Takeaway>
        </div>
      </Section>

      <Section className="grid gap-5 lg:grid-cols-2">
        <Figure
          title="Are firms hiring more or fewer people because of AI?"
          subtitle="Share of firms saying AI changed their headcount or their hiring in the last six months. Only two survey rounds have this question, so it is a snapshot, not a trend."
          source="US Census BTOS, mean of two periods."
        >
          <h4 className="ui mb-1 text-[1rem]">Total headcount</h4>
          <HBars items={snap(9)} format={(v) => `${v.toFixed(1)}%`} max={100} ariaLabel="Effect of AI on headcount" labelWidth={110} rowHeight={24} />
          <h4 className="ui mb-1 mt-3 text-[1rem]">New hires</h4>
          <HBars items={snap(10)} format={(v) => `${v.toFixed(1)}%`} max={100} ariaLabel="Effect of AI on hiring" labelWidth={110} rowHeight={24} />
          <p className="ui mt-2 text-[0.88rem] text-ink-soft">
            Net: {signed(netOf(9), 1)} points for headcount, {signed(netOf(10), 1)} points for hiring. Most firms report no change.
          </p>
        </Figure>
        <Figure
          title="Sectors: how exposed to AI, and how much they use it"
          subtitle="Horizontal: employment-weighted Microsoft applicability score of the sector's main job categories (a rough match). Vertical: share of firms using AI."
          source="Sources: US Census BTOS; Microsoft Working with AI; BLS OEWS. Fourteen sectors have both."
        >
          <Scatter points={expPts} xLabel="AI applicability of the sector's jobs" yLabel="Firms using AI, %" xFormat={(n) => n.toFixed(2)} yFormat={(n) => `${n}%`} ariaLabel="Sectors: exposure against AI use" height={330} />
        </Figure>
      </Section>

      <Section>
        <h2 className="mb-3">Hiring: do exposed jobs have fewer openings?</h2>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Figure
            title="AI mentioned in job postings"
            subtitle="Share of Indeed postings that mention AI keywords such as machine learning or generative AI. India is not covered."
            source="Source: Indeed Hiring Lab AI tracker (CC BY 4.0), monthly means. The postings index (February 2020 = 100) times the share gives AI postings, so growth is not hidden by falling total postings."
          >
            <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Segmented label="Measure" options={[{ value: "share", label: "Share of postings" }, { value: "index", label: "AI postings index" }]} value={shareMode} onChange={setShareMode} />
              <div className="ui flex flex-wrap gap-x-3 gap-y-1 text-[0.9rem]">
                {SHARE_COUNTRIES.map((c) => (
                  <label key={c} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={shareCountries.includes(c)}
                      onChange={(e) => setShareCountries((s) => (e.target.checked ? [...s, c] : s.filter((x) => x !== c)))}
                      style={{ accentColor: COLORS[c] }}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <LineChart series={shareSeries} height={330} xFormat={fmtYear} yFormat={(n) => (shareMode === "share" ? `${n}%` : String(Math.round(n)))} ariaLabel="AI share of job postings by country" />
          </Figure>
          <div className="space-y-4">
            <div className="panel p-4">
              <h3 className="ui mb-3">Gap in openings, exposed against less exposed</h3>
              <div className="flex flex-wrap items-center gap-3 pb-3">
                <label className="ui flex items-center gap-2 text-[0.95rem]">
                  Country
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded border border-rule bg-surface px-2 py-1.5">
                    {COUNTRIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {SPECS.filter((s) => country === "US" || s.value !== "tercile_ms_new_postings").map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSpec(s.value)}
                    aria-pressed={useSpec === s.value}
                    className={`ui rounded-[3px] border px-3 py-1 text-[0.88rem] ${useSpec === s.value ? "border-ink bg-ink text-paper" : "border-rule bg-surface hover:border-ai hover:bg-ai-soft"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {head && head.pct != null && (
                <Stat value={f1(head.pct)} label="Openings in the most exposed third, against the least exposed" tone="ai" sub={`95% range ${f1(head.pct_lo)} to ${f1(head.pct_hi)}; shuffling test p = ${head.perm_p != null ? head.perm_p.toFixed(3) : "n/a"}`} />
              )}
              {placebo && placebo.pct != null && <p className="ui mt-3 text-[0.85rem] text-ink-soft">Placebo, a pretend launch in December 2021: {f1(placebo.pct)} (range {f1(placebo.pct_lo)} to {f1(placebo.pct_hi)}).</p>}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Figure
            title="Postings by job category, grouped by exposure to AI"
            subtitle="Seasonally adjusted postings, each category set to 100 at its January to October 2022 average, then averaged within the most and least exposed thirds."
            source="Source: Indeed Hiring Lab job postings tracker (CC BY 4.0); exposure from Microsoft Working with AI. Categories are matched to occupations by our judgement."
          >
            <LineChart series={[path("high"), path("low")]} height={320} xFormat={fmtYear} yFormat={(n) => String(Math.round(n))} hlines={[{ y: 100, label: "2022 average = 100" }]} markers={[{ x: LAUNCH, label: "ChatGPT launch" }]} ariaLabel="Job postings index for exposed and less exposed categories" />
          </Figure>
          <Figure
            title="The gap, month by month"
            subtitle="Difference in postings between the most and least exposed thirds, as a percent, against their 2022 average. The band is a 95% range."
            source="Event-study regression with errors clustered by job category; see the method note below."
          >
            <LineChart series={es} height={320} xFormat={fmtYear} yFormat={(n) => `${Math.round(n)}%`} hlines={[{ y: 0, label: "no gap" }]} markers={[{ x: LAUNCH, label: "ChatGPT launch" }]} ariaLabel="Estimated gap in postings by month" />
          </Figure>
        </div>

        <div className="mt-5">
          <Takeaway title="What this says, and what it does not">
            <p>
              Since 2022, postings in the third of job categories most exposed to AI have run about {head?.pct != null ? `${Math.abs(head.pct).toFixed(0)}%` : "a quarter"} below those in the least exposed third
              ({country === "US" ? "US" : country}, {head ? `range ${f1(head.pct_lo)} to ${f1(head.pct_hi)}` : ""}). It holds when software is dropped, when tech is dropped, with a different exposure measure and with new postings only.
            </p>
            <p>
              But the gap began opening in mid-2022, before ChatGPT launched. In the US it widened by {before?.pct != null ? f1(before.pct) : "about 11%"} between June and November 2022 and by {after?.pct != null ? f1(after.pct) : "about 16%"} in the year after, and the ranges overlap.
              Rising interest rates, the end of the pandemic hiring boom and tech layoffs all hit office and tech jobs at the same time. This is an <C id="event-study">event study</C> that shows a pattern, not proof that generative AI caused it.
            </p>
          </Takeaway>
        </div>
      </Section>

      <Section className="grid gap-5 lg:grid-cols-2">
        <Caveat title="Read with care">
          <ul className="ui list-disc space-y-1.5 pl-5 text-[0.95rem]">
            <li>Only 26 fortnights of the survey question exist, and its wording changed during the year. The headcount questions have two rounds.</li>
            <li>Indeed counts postings, not hires or jobs. The AI share depends on keywords. Canada&apos;s jump from 6% to 20% in a year is smooth in the data but unexplained.</li>
            <li>Exposure is a rough match of Indeed categories to US occupations, applied to every country. Scores measure where AI is used, not who loses a job.</li>
            <li>With 32 job categories, confidence ranges are approximate. India is not in any of these sources.</li>
          </ul>
        </Caveat>
        <Caveat title="Concepts used">
          <p>
            <C id="diffusion">Diffusion curve</C>, <C id="event-study">event study and difference-in-differences</C> (a baseline period, a before and after comparison, a placebo test, errors clustered by category and a shuffling test),
            labour-demand signals (vacancy postings), sampling error and suppression.
          </p>
        </Caveat>
      </Section>
    </>
  );
}
