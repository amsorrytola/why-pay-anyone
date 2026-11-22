"use client";

import { useMemo, useState } from "react";
import { PageHead, Section, Segmented, Toggle, Takeaway, Caveat, Figure, Stat } from "@/components/ui";
import { HBars, Scatter, type Pt } from "@/components/charts";
import { usePageState } from "@/components/chat-context";
import { C } from "@/components/Concept";
import scatterData from "@/data/m2_scatter.json";
import groupsData from "@/data/m2_major_groups.json";
import agreementData from "@/data/m2_agreement.json";
import disagreementData from "@/data/m2_disagreement.json";
import quirksData from "@/data/m2_quirks.json";
import { compact } from "@/lib/format";

type Occ = {
  soc: string;
  title: string;
  major_group: number;
  major_group_name: string;
  employment: number | null;
  annual_mean: number | null;
  ms_applicability: number | null;
  aei_global_share_pct: number | null;
  aei_india_share_pct: number | null;
  aei_usage_ratio: number | null;
  aei_automation_pct: number | null;
  job_zone: number | null;
  aei_status: string;
};
type Group = {
  major_group: number;
  major_group_name: string;
  employment_share_pct: number;
  ms_applicability_emp_weighted: number;
  aei_usage_share_pct: number;
  usage_to_employment_ratio: number;
  aei_automation_pct: number | null;
  aei_augmentation_pct: number | null;
  aei_india_automation_pct: number | null;
  aei_india_augmentation_pct: number | null;
};
type Agr = { measure_a: string; measure_b: string; sample: string; weighting: string; statistic: string; n: number; estimate: number; ci_low: number; ci_high: number };
type Dis = { direction: string; rank_in_direction: number; soc: string; title: string; ms_applicability: number; aei_global_share_pct: number; aei_usage_ratio: number; hint: string };
type Quirk = { soc: string | null; title: string; quirk: string; detail: string };

const OCC = scatterData as unknown as Occ[];
const GROUPS = groupsData as unknown as Group[];
const AGR = agreementData as unknown as Agr[];
const DIS = disagreementData as unknown as Dis[];
const QUIRKS = quirksData as unknown as Quirk[];

type Metric = "ratio" | "share" | "auto";
const METRICS: { value: Metric; label: string }[] = [
  { value: "ratio", label: "Use compared with jobs" },
  { value: "share", label: "Share of all AI use" },
  { value: "auto", label: "Automation share" },
];

export default function M2Page() {
  const [metric, setMetric] = useState<Metric>("ratio");
  const [group, setGroup] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [weighted, setWeighted] = useState(false);
  const [sizeByJobs, setSizeByJobs] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [india, setIndia] = useState(false);

  const points: Pt[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return OCC.filter((o) => o.ms_applicability != null)
      .map((o) => {
        const y = metric === "ratio" ? o.aei_usage_ratio : metric === "share" ? o.aei_global_share_pct : o.aei_automation_pct;
        if (y == null || (metric !== "auto" && y <= 0)) return null;
        const inGroup = group === "all" || o.major_group === group;
        const match = q.length > 1 && o.title.toLowerCase().includes(q);
        return {
          id: o.soc,
          x: o.ms_applicability as number,
          y,
          r: sizeByJobs ? Math.max(2.5, Math.min(14, Math.sqrt((o.employment ?? 0) / 4500))) : 4.5,
          color: match ? "var(--human)" : "var(--ai)",
          dim: !inGroup || (q.length > 1 && !match),
          label: o.title,
          sub: `${o.major_group_name}. ${o.employment ? compact(o.employment) + " jobs" : ""}`,
        } as Pt;
      })
      .filter(Boolean) as Pt[];
  }, [metric, group, query, sizeByJobs]);

  const sel = picked ? OCC.find((o) => o.soc === picked) : null;

  const headline = AGR.find(
    (a) => a.measure_a === "ms_applicability" && a.measure_b === "aei_usage_ratio" && a.sample.startsWith("591") && a.statistic === "spearman" && a.weighting === (weighted ? "employment" : "unweighted"),
  );
  const groupLevel = AGR.find((a) => a.sample.startsWith("22 SOC") && a.statistic === "spearman" && a.weighting === "unweighted");
  const autoRel = AGR.find((a) => a.measure_a === "ms_applicability" && a.measure_b === "aei_automation_pct" && a.statistic === "spearman" && a.weighting === "unweighted");

  const groupBars = useMemo(
    () =>
      [...GROUPS]
        .sort((a, b) => b.usage_to_employment_ratio - a.usage_to_employment_ratio)
        .map((g) => ({ label: g.major_group_name, value: g.usage_to_employment_ratio, color: g.usage_to_employment_ratio > 1 ? "var(--ai)" : "var(--rule)" })),
    [],
  );
  const autoBars = useMemo(
    () =>
      GROUPS.filter((g) => (india ? g.aei_india_automation_pct : g.aei_automation_pct) != null)
        .sort((a, b) => ((india ? b.aei_india_automation_pct : b.aei_automation_pct) ?? 0) - ((india ? a.aei_india_automation_pct : a.aei_automation_pct) ?? 0))
        .map((g) => ({ label: g.major_group_name, value: (india ? g.aei_india_automation_pct : g.aei_automation_pct) ?? 0, color: "var(--ai)" })),
    [india],
  );

  usePageState("m2", {
    "y axis": METRICS.find((m) => m.value === metric)!.label,
    "group filter": group === "all" ? "all" : (GROUPS.find((g) => g.major_group === group)?.major_group_name ?? ""),
    "selected occupation": sel?.title ?? "none",
    "rank correlation shown": headline ? +headline.estimate.toFixed(2) : 0,
  });

  const disUp = DIS.filter((d) => d.direction === "aei_above_ms").slice(0, 8);
  const disDown = DIS.filter((d) => d.direction !== "aei_above_ms").slice(0, 8);
  const quirk = (k: string) => QUIRKS.find((q) => q.quirk === k);

  return (
    <>
      <PageHead
        id="M2"
        title="Where is AI actually used?"
        question="Two independent measures say which jobs AI touches: what people ask Microsoft's Copilot, and what they ask Claude. Do they agree, and where do they split?"
      />

      <Section>
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Segmented label="What to plot on the vertical axis" options={METRICS} value={metric} onChange={setMetric} />
          <label className="ui flex items-center gap-2 text-[0.95rem]">
            Job family
            <select value={String(group)} onChange={(e) => setGroup(e.target.value === "all" ? "all" : Number(e.target.value))} className="rounded border border-rule bg-surface px-2 py-1.5">
              <option value="all">All</option>
              {GROUPS.map((g) => (
                <option key={g.major_group} value={g.major_group}>
                  {g.major_group_name}
                </option>
              ))}
            </select>
          </label>
          <label className="ui flex items-center gap-2 text-[0.95rem]">
            Find a job
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. translator" className="w-44 rounded border border-rule bg-surface px-2 py-1.5" />
          </label>
          <Toggle label="Size dots by jobs" checked={sizeByJobs} onChange={setSizeByJobs} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Figure
            title="Every US occupation: Copilot's applicability score against Claude's use"
            subtitle={
              metric === "ratio"
                ? "Left to right: how applicable Microsoft finds AI to the job. Up: how much more (or less) Claude is used for the job than the job's weight in US employment would suggest. Log scale."
                : metric === "share"
                  ? "Up: the job's share of worldwide Claude.ai use. Log scale."
                  : "Up: the share of Claude conversations coded as automation (the AI does the task) rather than augmentation (the AI helps a person). Only jobs with positive use."
            }
            source="Sources: Microsoft Working with AI (Bing Copilot use, Jan to Sep 2024, CC BY 4.0); Anthropic Economic Index (Claude.ai, April and May 2026, CC-BY); BLS OEWS May 2025. Click a dot for details."
          >
            <Scatter
              points={points}
              xLabel="Microsoft AI applicability score (0 to 1)"
              yLabel={metric === "ratio" ? "Claude use relative to jobs (log)" : metric === "share" ? "Share of Claude use, % (log)" : "Automation share, %"}
              yLog={metric !== "auto"}
              xFormat={(n) => n.toFixed(1)}
              yFormat={(n) => (metric === "ratio" ? (n >= 1 ? `${n}×` : `${n}×`) : metric === "share" ? `${n}%` : `${n}%`)}
              ariaLabel="Scatter plot of occupations: Microsoft applicability score against Claude usage"
              highlight={picked}
              onPick={setPicked}
              height={440}
            />
          </Figure>
          <div className="space-y-4">
            <div className="rounded-[6px] border border-rule bg-surface p-4">
              <h3 className="ui mb-2">{sel ? sel.title : "Pick a dot"}</h3>
              {sel ? (
                <dl className="ui space-y-1 text-[0.92rem]">
                  <div className="flex justify-between gap-3"><dt className="text-ink-soft">Job family</dt><dd className="text-right">{sel.major_group_name}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-soft">US jobs</dt><dd className="num">{sel.employment ? compact(sel.employment) : "n/a"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-soft">Mean pay a year</dt><dd className="num">{sel.annual_mean ? `$${compact(sel.annual_mean)}` : "n/a"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-soft">Microsoft applicability</dt><dd className="num">{sel.ms_applicability?.toFixed(2) ?? "n/a"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-soft">Share of Claude use</dt><dd className="num">{sel.aei_global_share_pct != null ? `${sel.aei_global_share_pct}%` : "not published"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-soft">Share in India</dt><dd className="num">{sel.aei_india_share_pct != null ? `${sel.aei_india_share_pct}%` : "not published"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-soft">Use vs jobs</dt><dd className="num">{sel.aei_usage_ratio != null ? `${sel.aei_usage_ratio.toFixed(1)}×` : "n/a"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-soft">Automation share</dt><dd className="num">{sel.aei_automation_pct != null ? `${Math.round(sel.aei_automation_pct)}%` : "n/a"}</dd></div>
                </dl>
              ) : (
                <p className="ui text-[0.92rem] text-ink-soft">Hover or click any dot to see the job, its pay and both measures. Search for a job above to light it up in amber.</p>
              )}
            </div>
            <div className="rounded-[6px] border border-rule bg-surface p-4">
              <Toggle label="Weight by number of jobs" checked={weighted} onChange={setWeighted} help="Big occupations count for more." />
              {headline && (
                <div className="mt-2">
                  <Stat value={headline.estimate.toFixed(2)} label="Rank correlation between the two measures" tone="ai" sub={`95% range ${headline.ci_low.toFixed(2)} to ${headline.ci_high.toFixed(2)}, ${headline.n} jobs`} />
                </div>
              )}
              {groupLevel && <p className="ui mt-3 text-[0.88rem] text-ink-soft">Across the 22 job families the correlation is {groupLevel.estimate.toFixed(2)}.</p>}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Takeaway>
            <p>
              The two measures broadly agree on which jobs AI touches, but only moderately: a rank correlation of about {headline ? headline.estimate.toFixed(2) : "0.5"} across jobs, and much stronger across job families
              ({groupLevel ? groupLevel.estimate.toFixed(2) : "0.8"}). They agree on the big picture (computer, writing and office work lead) and split on the details.
            </p>
            <p>
              Where they split is informative. Copilot users are mostly office workers asking for help with documents; Claude.ai users include students, developers and people exploring.
              Neither is a census of jobs, and neither says whether anyone loses work. <C id="cross-source-agreement">Exposure measures</C> show where AI is used, which is a different thing from <C id="automation-augmentation">displacement</C>.
            </p>
          </Takeaway>
        </div>
      </Section>

      <Section className="grid gap-5 lg:grid-cols-2">
        <Figure
          title="Which job families use AI more than their size suggests?"
          subtitle="Share of Claude use divided by the family's share of US jobs. Above 1 means the family uses it more than its weight."
          source="Anthropic Economic Index (Claude.ai, April and May 2026); BLS OEWS May 2025."
        >
          <HBars items={groupBars} format={(v) => `${v.toFixed(1)}×`} ariaLabel="Job families ranked by use of Claude relative to their share of jobs" labelWidth={210} rowHeight={26} />
        </Figure>
        <Figure
          title="Does AI do the task, or help the person?"
          subtitle="Share of conversations coded as automation, by job family. The rest is augmentation. Switch to India to compare."
          source="Anthropic Economic Index (Claude.ai). Only jobs with positive use have these metrics."
        >
          <div className="mb-3">
            <Segmented label="Where" options={[{ value: "world", label: "Worldwide" }, { value: "india", label: "India" }]} value={india ? "india" : "world"} onChange={(v) => setIndia(v === "india")} />
          </div>
          <HBars items={autoBars} format={(v) => `${Math.round(v)}%`} max={100} ariaLabel="Automation share by job family" labelWidth={210} rowHeight={26} />
          {autoRel && (
            <p className="ui mt-2 text-[0.88rem] text-ink-soft">
              Jobs Microsoft rates as more applicable tend to have a slightly lower automation share (rank correlation {autoRel.estimate.toFixed(2)}): in applicable jobs people more often work with the AI than hand the task over.
            </p>
          )}
        </Figure>
      </Section>

      <Section className="grid gap-5 lg:grid-cols-2">
        <Figure title="Claude is used far more than Copilot's score suggests" subtitle="Largest rank gaps, among jobs with at least 10,000 workers." source="Computed from the two measures; hints are our reading of the data.">
          <ul className="ui divide-y divide-rule text-[0.92rem]">
            {disUp.map((d) => (
              <li key={d.soc} className="py-2">
                <span className="font-semibold">{d.title}</span> <span className="text-ink-faint">(score {d.ms_applicability.toFixed(2)})</span>
                <div className="text-ink-soft">{d.hint}</div>
              </li>
            ))}
          </ul>
        </Figure>
        <Figure title="Copilot's score is high, Claude use is low" subtitle="Largest rank gaps in the other direction." source="Computed from the two measures; hints are our reading of the data.">
          <ul className="ui divide-y divide-rule text-[0.92rem]">
            {disDown.map((d) => (
              <li key={d.soc} className="py-2">
                <span className="font-semibold">{d.title}</span> <span className="text-ink-faint">(score {d.ms_applicability.toFixed(2)})</span>
                <div className="text-ink-soft">{d.hint}</div>
              </li>
            ))}
          </ul>
        </Figure>
      </Section>

      <Section className="grid gap-5 lg:grid-cols-2">
        <Caveat title="Read with care">
          <ul className="ui list-disc space-y-1.5 pl-5 text-[0.95rem]">
            <li>{quirk("two_months_only")?.detail.split(".")[0]}.</li>
            <li>{quirk("mixed_geographies")?.detail}.</li>
            <li>{quirk("unpublished_cells")?.detail}.</li>
            <li>{quirk("zero_is_not_missing")?.detail}.</li>
            <li>
              Some occupations rank oddly high: the catch-all code &quot;Computer Occupations, All Other&quot; has the largest share of use, while Software Developers has a small one. The release does not say why, so treat computer jobs as one group.
            </li>
          </ul>
        </Caveat>
        <Caveat title="Concepts used">
          <p>
            <C id="cross-source-agreement">Exposure measures</C>, rank correlation, <C id="automation-augmentation">automation versus augmentation</C>, <C id="measurement-error">single-platform bias</C>, diffusion and the digital divide.
          </p>
          <p>Each source covers one platform. Triangulating across them, and measuring how well they agree, is itself a result.</p>
        </Caveat>
      </Section>
    </>
  );
}
