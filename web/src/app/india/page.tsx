"use client";

import { useMemo, useState } from "react";
import { PageHead, Section, Segmented, Takeaway, Caveat, Figure, Stat } from "@/components/ui";
import { Scatter, useWidth, type Pt } from "@/components/charts";
import { usePageState, type PageState } from "@/components/chat-context";
import IndiaB from "@/components/india-b";
import { C } from "@/components/Concept";
import countryData from "@/data/india_a_country_data.json";
import summaryData from "@/data/india_a_india_summary.json";
import regData from "@/data/india_a_regressions.json";
import groupsData from "@/data/india_a_composition_groups.json";
import useData from "@/data/india_a_use_patterns.json";
import benchData from "@/data/india_a_benchmarks.json";

type Country = {
  iso3: string;
  country: string;
  region: string;
  wb_income_group: string;
  peer_of_india: string;
  usage_index: number;
  gdp_pc_ppp: number;
  fitted_log_gdp_only: number;
};
type Summary = {
  model: string;
  n: number;
  actual_log: number;
  fitted_log: number;
  residual_log: number;
  actual_over_predicted: number;
  rank_of_residual_1_is_highest: number;
  percentile_of_residual: number;
  standardized_residual: number;
  actual_index: number;
  predicted_index: number;
  loo_pred_low_log: number;
  loo_pred_high_log: number;
};
type Reg = { model: string; term: string; coef: number };
type Group = { major_group_name: string; india_share: number; world_share: number; diff_pp: number; ratio_india_to_world: number };
type Use = { metric: string; label: string; india: number; world: number; peers_median: number; peers_p25: number; peers_p75: number };
type Bench = { claim: string; value: string | number; unit: string; source: string; url: string; where_found: string; verified: string };

const COUNTRIES = countryData as unknown as Country[];
const SUMMARY = summaryData as unknown as Summary[];
const REG = regData as unknown as Reg[];
const GROUPS = groupsData as unknown as Group[];
const USE = useData as unknown as Use[];
const BENCH = benchData as unknown as Bench[];

const MODELS = [
  { value: "B0", label: "Income only" },
  { value: "C2", label: "+ internet use" },
  { value: "C3", label: "+ college enrolment" },
  { value: "C4", label: "+ services jobs" },
];

function Dumbbell(props: { rows: { label: string; a: number; b: number }[]; aLabel: string; bLabel: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const rh = 26;
  const lw = Math.min(250, w * 0.42);
  const mx = Math.max(...props.rows.flatMap((r) => [r.a, r.b])) * 1.08;
  const x = (v: number) => lw + (v / mx) * (w - lw - 24);
  if (!w) return <div ref={ref} style={{ height: props.rows.length * rh + 30 }} />;
  return (
    <div ref={ref}>
      <svg width={w} height={props.rows.length * rh + 30} role="img" aria-label={`${props.aLabel} compared with ${props.bLabel} by job family`}>
        <g transform="translate(0 4)">
          <circle cx={lw} cy={8} r={5} fill="var(--human)" />
          <text x={lw + 10} y={12} fontSize={12.5} className="ui" fill="var(--ink-soft)">{props.aLabel}</text>
          <circle cx={lw + 70} cy={8} r={5} fill="var(--ai)" />
          <text x={lw + 80} y={12} fontSize={12.5} className="ui" fill="var(--ink-soft)">{props.bLabel}</text>
        </g>
        {props.rows.map((r, i) => (
          <g key={r.label} transform={`translate(0 ${30 + i * rh})`}>
            <text x={lw - 10} y={rh / 2 + 3} textAnchor="end" fontSize={13} className="ui" fill="var(--ink)">
              {r.label.length > 34 ? r.label.slice(0, 33) + "…" : r.label}
            </text>
            <line x1={x(Math.min(r.a, r.b))} x2={x(Math.max(r.a, r.b))} y1={rh / 2} y2={rh / 2} stroke="var(--rule)" strokeWidth={3} />
            <circle cx={x(r.b)} cy={rh / 2} r={5} fill="var(--ai)" />
            <circle cx={x(r.a)} cy={rh / 2} r={5} fill="var(--human)" />
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function IndiaPage() {
  const [model, setModel] = useState("B0");
  const [partTwo, setPartTwo] = useState<PageState>({});
  const s = SUMMARY.find((m) => m.model.startsWith(model)) ?? SUMMARY[0];
  const b0 = REG.filter((r) => r.model.startsWith("B0"));
  const a = b0.find((r) => r.term === "Intercept")?.coef ?? 0;
  const bcoef = b0.find((r) => r.term === "ln_gdp")?.coef ?? 1;
  const india = COUNTRIES.find((c) => c.iso3 === "IND")!;

  const points: Pt[] = useMemo(() => {
    const base = COUNTRIES.map((c) => ({
      id: c.iso3,
      x: c.gdp_pc_ppp,
      y: c.usage_index,
      r: c.iso3 === "IND" ? 9 : c.peer_of_india === "yes" ? 6 : 4.5,
      color: c.iso3 === "IND" ? "var(--human)" : c.peer_of_india === "yes" ? "var(--ai)" : "var(--ink-faint)",
      dim: false,
      label: c.country,
      sub: `Usage index ${c.usage_index.toFixed(2)}; GDP per person $${Math.round(c.gdp_pc_ppp).toLocaleString("en-US")}`,
    })) as Pt[];
    const xs = COUNTRIES.map((c) => c.gdp_pc_ppp);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    const line: Pt[] = Array.from({ length: 70 }, (_, i) => {
      const gx = Math.exp(Math.log(lo) + ((Math.log(hi) - Math.log(lo)) * i) / 69);
      return { id: `fit${i}`, x: gx, y: Math.exp(a + bcoef * Math.log(gx)), r: 1.6, color: "var(--ink)", label: "Income-only fit", sub: "What income alone predicts" } as Pt;
    });
    const pred: Pt = { id: "pred", x: india.gdp_pc_ppp, y: s.predicted_index, r: 9, color: "var(--human-soft)", label: "India as predicted", sub: `Predicted index ${s.predicted_index.toFixed(2)} (${s.model})` };
    return [...line, pred, ...base];
  }, [a, bcoef, india, s]);

  usePageState("india", { ...partTwo, "model": s.model, "India usage index": s.actual_index, "predicted by model": s.predicted_index, "India vs prediction": +s.actual_over_predicted.toFixed(2), "rank among countries": s.rank_of_residual_1_is_highest, "countries": s.n });

  const dumb = useMemo(
    () =>
      [...GROUPS]
        .sort((x, y) => y.world_share - x.world_share)
        .map((g) => ({ label: g.major_group_name, a: g.india_share, b: g.world_share })),
    [],
  );
  const SHOW = ["India: share of employment in high-exposure", "Advanced economies", "Emerging market economies", "Global: share of employment exposed to AI", "Low-income countries: overall", "India IT sector: employment effect", "India IT sector: firms surveyed"];
  const verified = BENCH.filter((x) => String(x.verified).toLowerCase() === "yes" && SHOW.some((s) => x.claim.startsWith(s)));
  const useRow = (k: string) => USE.find((u) => u.metric === k);
  const work = useRow("use_case_work_pct");
  const personal = useRow("use_case_personal_pct");
  const course = useRow("use_case_coursework_pct");
  const auto = useRow("collaboration_bucket_automation_pct");

  return (
    <>
      <PageHead
        title="India: who uses AI, and whose jobs does it touch?"
        question="Part 1 asks whether India uses AI more or less than its income predicts. Part 2 uses India's own labour survey to count how many workers hold jobs that AI is exposed to."
      />

      <Section>
        <h2 className="mb-3">Part 1. How does India use AI, compared with what its income predicts?</h2>
        <p className="mb-4 max-w-[68ch]">Richer countries use AI more. Is India above or below the line that income alone would draw, and does it use AI differently from the rest of the world?</p>
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Segmented label="What the prediction takes into account" options={MODELS} value={model} onChange={setModel} />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Figure
            title="Claude usage per person against income, 120 countries"
            subtitle="Each dot is a country. Up: usage relative to the country's share of working-age people (1.0 means use in proportion to population). Right: income per person. The line is what income alone predicts. Amber is India; the pale ring is where the chosen prediction puts India. Blue dots are income peers."
            source="Sources: Anthropic Economic Index (Claude.ai, April and May 2026, CC-BY); World Bank (GDP per capita PPP, latest year). Claude.ai covers one company's products."
          >
            <Scatter
              points={points}
              xLog
              yLog
              xLabel="GDP per person, PPP dollars (log scale)"
              yLabel="Claude usage index (log scale)"
              xFormat={(n) => `$${n >= 1000 ? `${Math.round(n / 1000)}k` : n}`}
              yFormat={(n) => n.toString()}
              ariaLabel="Scatter of countries: income per person against Claude usage index, with India highlighted"
              highlight="IND"
              height={440}
            />
          </Figure>
          <div className="space-y-4">
            <div className="panel p-4">
              <Stat value={s.actual_index.toFixed(2)} label="India's usage index, 2026 (Apr and May)" tone="human" />
              <div className="mt-4">
                <Stat value={s.predicted_index.toFixed(2)} label={`What this model predicts (${MODELS.find((m) => m.value === model)?.label.toLowerCase()})`} tone="ai" />
              </div>
              <div className="mt-4">
                <Stat value={`${Math.round(s.actual_over_predicted * 100)}%`} label="India's use as a share of the prediction" sub={`Rank ${s.rank_of_residual_1_is_highest} of ${s.n} by gap from prediction (1 is furthest above)`} />
              </div>
              <p className="ui mt-3 text-[0.85rem] text-ink-soft">
                The gap is {s.standardized_residual >= 0 ? "above" : "below"} the line by {Math.abs(s.standardized_residual).toFixed(2)} standard deviations of the spread across countries: {Math.abs(s.standardized_residual) < 1 ? "well within the normal scatter" : "unusually far"}.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <Takeaway>
            <p>
              On income alone, India uses Claude at about {Math.round(SUMMARY[0].actual_over_predicted * 100)}% of what its income predicts, which is on the low side but inside the normal scatter among countries. Add the share of jobs in services and India sits on the line
              ({Math.round((SUMMARY.find((m) => m.model.startsWith("C4"))?.actual_over_predicted ?? 1) * 100)}% of the prediction). So the gap says less about India than about how a country&apos;s job mix and internet use shape who uses AI.
            </p>
            <p>
              India&apos;s share of worldwide Claude.ai use is about 7%, but its working-age population is much larger, hence an index near 0.3. This is a <C id="digital-divide">digital divide</C> story as much as an AI one.
            </p>
          </Takeaway>
        </div>
      </Section>

      <Section className="grid gap-5 lg:grid-cols-2">
        <Figure
          title="What India uses Claude for, against the world"
          subtitle="Share of each country's use by job family (the job the conversation is about). Amber: India. Blue: worldwide."
          source="Anthropic Economic Index (Claude.ai). Only published cells."
        >
          <Dumbbell rows={dumb} aLabel="India" bLabel="World" />
        </Figure>
        <div className="space-y-5">
          <Figure title="Work, personal and study use" subtitle="Share of conversations, with the middle half of 23 income peers as a range." source="Anthropic Economic Index (Claude.ai), April and May 2026.">
            <ul className="ui space-y-3 text-[0.95rem]">
              {[
                ["Work use", work],
                ["Personal use", personal],
                ["Coursework", course],
                ["Automation (the AI does the task)", auto],
              ].map(([label, row]) => {
                const r = row as Use | undefined;
                if (!r) return null;
                return (
                  <li key={String(label)}>
                    <div className="flex justify-between gap-3">
                      <span>{String(label)}</span>
                      <span className="num">
                        India {r.india.toFixed(0)}% · world {r.world.toFixed(0)}% · peers {r.peers_p25.toFixed(0)} to {r.peers_p75.toFixed(0)}%
                      </span>
                    </div>
                    <div className="relative mt-1 h-2 rounded bg-rule/60">
                      <div className="absolute top-0 h-2 rounded bg-ai/30" style={{ left: `${r.peers_p25}%`, width: `${Math.max(1, r.peers_p75 - r.peers_p25)}%` }} />
                      <div className="absolute -top-0.5 h-3 w-1.5 rounded bg-human" style={{ left: `${r.india}%` }} />
                      <div className="absolute -top-0.5 h-3 w-1 rounded bg-ink" style={{ left: `${r.world}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="ui mt-3 text-[0.85rem] text-ink-soft">Amber tick: India. Black tick: world. Blue band: the middle half of income peers.</p>
          </Figure>
        </div>
      </Section>

      <Section className="grid gap-5 lg:grid-cols-2">
        <Figure
          title="What published studies say about India"
          subtitle="Figures we could read in the source and check. Each links to the document."
          source="Collected for this project; see the method note. Studies use different definitions of exposure, so numbers are not comparable across rows."
        >
          {verified.length ? (
            <ul className="ui divide-y divide-rule text-[0.92rem]">
              {verified.map((b) => (
                <li key={b.claim} className="py-2">
                  <div className="font-semibold">{b.claim}</div>
                  <div>
                    <span className="num">{b.value}</span> <span className="text-ink-soft">{b.unit}</span>
                  </div>
                  <a href={b.url} className="text-[0.85rem]">{b.source}</a>
                  <div className="text-[0.8rem] text-ink-faint">{b.where_found}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui text-[0.95rem] text-ink-soft">No published figure for India has been verified against its source yet, so none is shown. Nothing is quoted from memory.</p>
          )}
        </Figure>
        <Caveat title="What Part 1 can and cannot say">
          <p>
            Part 1 shows how much people in India use one AI product, not which jobs are exposed. Part 2 below answers the exposure question with India&apos;s Periodic Labour Force Survey.
          </p>
          <p>
            Concepts: <C id="digital-divide">digital divide</C>, income elasticity of demand, <C id="lewis">the Lewis dual-economy model</C> and services-led growth, offshoring.
          </p>
        </Caveat>
      </Section>

      <IndiaB onState={setPartTwo} />

      <Section>
        <Caveat title="Read with care">
          <ul className="ui list-disc space-y-1.5 pl-5 text-[0.95rem]">
            <li>Part 1: the index measures use of one company&apos;s products. English-language, student and developer use may weigh more in India than the working population.</li>
            <li>Two months of data. Income is measured in purchasing-power dollars in the latest year with data, which differs by country.</li>
            <li>A country falling below a line is a description, not a failure: the line is just the average of the other countries.</li>
          </ul>
        </Caveat>
      </Section>
    </>
  );
}
