"use client";

import { useEffect, useMemo, useState } from "react";
import { Section, Segmented, Slider, Takeaway, Caveat, Figure, Stat } from "@/components/ui";
import { Scatter, useWidth, type Pt } from "@/components/charts";
import { C } from "@/components/Concept";
import type { PageState } from "@/components/chat-context";
import cellsData from "@/data/india_b_cells.json";
import occData from "@/data/india_b_nco3.json";
import thirdsData from "@/data/india_b_thirds.json";
import regData from "@/data/india_b_regressions.json";
import summaryData from "@/data/india_b_summary.json";
import checksData from "@/data/india_b_checks.json";

type Cell = { nco3: string; sec_g: string; sex_g: string; status: string; n: number; share_pct: number };
type Occ = {
  nco3: string;
  label: string;
  share_of_workers_pct: number;
  ms_pct: number | null;
  aei_pct: number | null;
  median_monthly_pay_regular: number | null;
  n_soc_matched: number | null;
};
type Third = {
  third: string;
  share_of_workers_pct: number;
  women_share_pct: number;
  rural_share_pct: number;
  graduate_share_pct: number;
  regular_wage_share_pct: number;
  self_employed_share_pct: number;
  casual_share_pct: number;
  unpaid_family_share_pct: number;
  regular_no_written_contract_pct: number;
  regular_no_social_security_pct: number;
  regular_pay_median: number;
  self_income_median: number;
  third_lower_cut: number;
  third_upper_cut: number;
};
type Reg = { spec: string; coef_per_full_range: number; ci_low: number; ci_high: number; pct_change_25_to_75: number; n: number };
type Sum = { measure: string; scope: string; label: string; value: number };
type Check = { stat: string; value: number; n: number };

const CELLS = cellsData as unknown as Cell[];
const OCC = occData as unknown as Occ[];
const THIRDS = thirdsData as unknown as Third[];
const REG = regData as unknown as Reg[];
const SUM = summaryData as unknown as Sum[];
const CHECKS = checksData as unknown as Check[];

const LABEL = new Map(OCC.map((o) => [o.nco3, o.label]));
const sv = (measure: string, scope: string, start: string) => SUM.find((r) => r.measure === measure && r.scope === scope && r.label.startsWith(start))?.value ?? NaN;
const check = (stat: string) => CHECKS.find((c) => c.stat === stat)?.value ?? NaN;
const rupee = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

type Measure = "ms" | "aei";
type Sector = "all" | "rural" | "urban";
type Sex = "all" | "f" | "m";
type Status = "all" | "regular" | "casual" | "self" | "family";

const MEASURES: { value: Measure; label: string }[] = [
  { value: "ms", label: "Microsoft (Copilot use)" },
  { value: "aei", label: "Anthropic (Claude.ai use)" },
];
const SECTORS: { value: Sector; label: string }[] = [
  { value: "all", label: "Rural and urban" },
  { value: "rural", label: "Rural" },
  { value: "urban", label: "Urban" },
];
const SEXES: { value: Sex; label: string }[] = [
  { value: "all", label: "Women and men" },
  { value: "f", label: "Women" },
  { value: "m", label: "Men" },
];
const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "All workers" },
  { value: "regular", label: "Regular wage" },
  { value: "casual", label: "Casual labour" },
  { value: "self", label: "Self-employed" },
  { value: "family", label: "Unpaid family help" },
];

function Bins(props: { shares: number[]; line: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = 250;
  const left = 44;
  const top = 18;
  const bottom = 36;
  const peak = Math.max(...props.shares, 10);
  const maxV = Math.max(20, Math.ceil(peak / 10) * 10);
  if (!w) return <div ref={ref} style={{ height: h }} />;
  const bw = (w - left - 8) / 10;
  const y = (v: number) => top + (h - top - bottom) * (1 - v / maxV);
  const ticks = [0, maxV / 2, maxV];
  return (
    <div ref={ref}>
      <svg width={w} height={h} role="img" aria-label="Share of Indian workers in each tenth of the US exposure scale, compared with 10 percent for the US workforce">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={w - 8} y1={y(t)} y2={y(t)} stroke="var(--rule)" />
            <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} className="ui" fill="var(--ink-faint)">
              {t}%
            </text>
          </g>
        ))}
        {props.shares.map((v, i) => {
          const exposed = i * 10 >= props.line;
          return (
            <g key={i}>
              <rect x={left + i * bw + 4} y={y(v)} width={bw - 8} height={Math.max(0, y(0) - y(v))} fill="var(--human)" fillOpacity={exposed ? 0.95 : 0.35} />
              <text x={left + i * bw + bw / 2} y={y(v) - 5} textAnchor="middle" fontSize={11.5} className="num" fill="var(--ink-soft)">
                {v >= 10 ? Math.round(v) : v.toFixed(1)}
              </text>
              <text x={left + i * bw + bw / 2} y={h - 18} textAnchor="middle" fontSize={11.5} className="ui" fill="var(--ink-soft)">
                {i * 10}–{i * 10 + 10}
              </text>
            </g>
          );
        })}
        <line x1={left} x2={w - 8} y1={y(10)} y2={y(10)} stroke="var(--ai)" strokeWidth={2} strokeDasharray="6 4" />
        <text x={w - 10} y={y(10) - 6} textAnchor="end" fontSize={12.5} className="ui" fill="var(--ai-deep)">
          US workforce: 10% each
        </text>
        <text x={(left + w) / 2} y={h - 2} textAnchor="middle" fontSize={12.5} className="ui" fill="var(--ink-soft)">
          Exposure of the job, as a percentile of US workers (0 least, 100 most)
        </text>
      </svg>
    </div>
  );
}

export default function IndiaB(props: { onState: (s: PageState) => void }) {
  const { onState } = props;
  const [measure, setMeasure] = useState<Measure>("ms");
  const [line, setLine] = useState(67);
  const [sector, setSector] = useState<Sector>("all");
  const [sex, setSex] = useState<Sex>("all");
  const [status, setStatus] = useState<Status>("all");

  const score = useMemo(() => new Map(OCC.map((o) => [o.nco3, measure === "ms" ? o.ms_pct : o.aei_pct])), [measure]);

  const calc = useMemo(() => {
    const byOcc = new Map<string, number>();
    let total = 0;
    for (const c of CELLS) {
      if (sector !== "all" && c.sec_g !== sector) continue;
      if (sex !== "all" && c.sex_g !== sex) continue;
      if (status !== "all" && c.status !== status) continue;
      byOcc.set(c.nco3, (byOcc.get(c.nco3) ?? 0) + c.share_pct);
      total += c.share_pct;
    }
    let scored = 0;
    let above = 0;
    const bins = Array<number>(10).fill(0);
    const rows: { nco3: string; label: string; share: number; s: number }[] = [];
    for (const [k, v] of byOcc) {
      const s = score.get(k);
      if (s == null) continue;
      scored += v;
      if (s > line) above += v;
      bins[Math.min(9, Math.floor(s / 10))] += v;
      rows.push({ nco3: k, label: LABEL.get(k) ?? k, share: (100 * v) / total, s });
    }
    const aboveRows = rows.filter((r) => r.s > line).sort((a, b) => b.share - a.share).slice(0, 6);
    const belowRows = rows.filter((r) => r.s <= line).sort((a, b) => b.share - a.share).slice(0, 6);
    return {
      total,
      coverage: total ? (100 * scored) / total : 0,
      aboveShare: scored ? (100 * above) / scored : 0,
      bins: bins.map((b) => (scored ? (100 * b) / scored : 0)),
      aboveRows,
      belowRows,
    };
  }, [sector, sex, status, line, score]);

  const who = [
    sector === "all" ? "" : sector === "rural" ? "rural " : "urban ",
    status === "all" ? "workers" : STATUSES.find((s) => s.value === status)!.label.toLowerCase() + " workers",
    sex === "all" ? "" : sex === "f" ? " (women)" : " (men)",
  ].join("");

  useEffect(() => {
    onState({
      "Part 2 exposure measure": measure === "ms" ? "Microsoft" : "Anthropic",
      "Part 2 line (US percentile)": line,
      "Part 2 workers shown": who,
      "Part 2 share of them above the line (%)": +calc.aboveShare.toFixed(1),
      "Part 2 share of them with a score (%)": +calc.coverage.toFixed(0),
    });
  }, [measure, line, who, calc.aboveShare, calc.coverage, onState]);

  const points: Pt[] = useMemo(
    () =>
      OCC.filter((o) => (measure === "ms" ? o.ms_pct : o.aei_pct) != null && o.median_monthly_pay_regular != null && o.median_monthly_pay_regular > 0).map((o) => {
        const s = (measure === "ms" ? o.ms_pct : o.aei_pct) as number;
        return {
          id: o.nco3,
          x: s,
          y: o.median_monthly_pay_regular as number,
          r: 3 + Math.sqrt(o.share_of_workers_pct) * 3.4,
          color: s > line ? "var(--ai)" : "var(--human)",
          label: o.label,
          sub: `${o.share_of_workers_pct.toFixed(1)}% of Indian workers; median pay ${rupee(o.median_monthly_pay_regular as number)} a month; exposure ${s.toFixed(0)}`,
        } as Pt;
      }),
    [measure, line],
  );

  const low = THIRDS.find((t) => t.third === "low")!;
  const mid = THIRDS.find((t) => t.third === "middle")!;
  const high = THIRDS.find((t) => t.third === "high")!;
  const rawReg = REG.find((r) => r.spec === "none")!;
  const fullReg = REG.find((r) => r.spec === "plus_education_state")!;
  const pctChange = (b: number) => 100 * (Math.exp(0.5 * b) - 1);
  const crops = OCC.find((o) => o.nco3 === "611");
  const womenShare = sv("ms", "sex:women", "share above");
  const menShare = sv("ms", "sex:men", "share above");
  const rows: [string, (t: Third) => string][] = [
    ["Share of Indian workers", (t) => `${t.share_of_workers_pct.toFixed(0)}%`],
    ["Women", (t) => `${t.women_share_pct.toFixed(0)}%`],
    ["Live in rural areas", (t) => `${t.rural_share_pct.toFixed(0)}%`],
    ["Graduates", (t) => `${t.graduate_share_pct.toFixed(0)}%`],
    ["Regular wage or salary jobs", (t) => `${t.regular_wage_share_pct.toFixed(0)}%`],
    ["Casual labour", (t) => `${t.casual_share_pct.toFixed(0)}%`],
    ["Self-employed", (t) => `${t.self_employed_share_pct.toFixed(0)}%`],
    ["Regular wage jobs with no written contract", (t) => `${t.regular_no_written_contract_pct.toFixed(0)}%`],
    ["Regular wage jobs with no social security", (t) => `${t.regular_no_social_security_pct.toFixed(0)}%`],
    ["Median pay in a regular wage job, per month", (t) => rupee(t.regular_pay_median)],
  ];

  return (
    <>
      <Section>
        <h2 className="mb-3">Part 2. Which Indian jobs does AI touch, and who holds them?</h2>
        <p className="max-w-[68ch]">
          Part 1 used usage data. This part uses India&apos;s own labour force survey: the Periodic Labour Force Survey of 2025, about 460,000 working people. Each person&apos;s occupation is matched to how exposed that occupation is to AI in
          US data, so we can count how many Indian workers sit in highly exposed jobs. Exposure is on a percentile scale: a job scoring 80 is more exposed than the jobs of 80% of US workers. Move the line and the filters to see
          who is above it.
        </p>
      </Section>

      <Section>
        <div className="mb-4 grid gap-x-8 gap-y-2 lg:grid-cols-2">
          <div className="space-y-3">
            <Segmented label="Exposure measure" options={MEASURES} value={measure} onChange={setMeasure} />
            <Slider
              label="A job counts as exposed above this US percentile"
              value={line}
              min={0}
              max={95}
              step={1}
              onChange={setLine}
              tone="ai"
              format={(v) => `${v}`}
              help={`In the US workforce about ${100 - line}% of workers are above this line by construction.`}
            />
          </div>
          <div className="space-y-3">
            <Segmented label="Where" options={SECTORS} value={sector} onChange={setSector} />
            <Segmented label="Who" options={SEXES} value={sex} onChange={setSex} />
            <Segmented label="Type of work" options={STATUSES} value={status} onChange={setStatus} />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Figure
            title={`Where India's ${who} sit on the US exposure scale`}
            subtitle="Bars: share of these Indian workers in each tenth of the scale. The dashed line is the US workforce, which by construction has 10% in each tenth. Dark bars are above your line."
            source="Source: Periodic Labour Force Survey, calendar year 2025, first-visit unit-level data, MoSPI (National Statistics Office), Microdata Library catalog 284; exposure from Microsoft and Anthropic. Own calculations; only aggregated results are shown."
          >
            <Bins shares={calc.bins} line={line} />
          </Figure>
          <div className="space-y-4">
            <div className="rounded-[6px] border border-rule bg-surface p-4">
              <Stat value={`${calc.aboveShare.toFixed(1)}%`} label={`of India's ${who} are in jobs above the line`} tone="human" />
              <div className="mt-4">
                <Stat value={`${100 - line}%`} label="of US workers, by construction" tone="ai" />
              </div>
              <p className="ui mt-3 text-[0.85rem] text-ink-soft">
                {calc.coverage.toFixed(0)}% of these workers have an occupation with a score
                {measure === "aei" ? ". Anthropic publishes a share for only some occupations, mostly office and professional ones, so this measure leaves out about a fifth of Indian workers" : ""}.
              </p>
              {measure === "aei" && crops && (
                <p className="ui mt-2 text-[0.85rem] text-ink-soft">
                  Treat this measure as a cross-check. A group matched to only a few US occupations rests on those few: crop growers score {crops.aei_pct?.toFixed(0)} here and {crops.ms_pct?.toFixed(0)} on the Microsoft measure.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Figure title="Biggest groups above the line" subtitle={`Share of India's ${who}`}>
            <ul className="ui divide-y divide-rule text-[0.92rem]">
              {calc.aboveRows.length ? (
                calc.aboveRows.map((r) => (
                  <li key={r.nco3} className="flex justify-between gap-3 py-1.5">
                    <span>{r.label}</span>
                    <span className="num whitespace-nowrap">
                      {r.share.toFixed(1)}% <span className="text-ink-faint">· score {r.s.toFixed(0)}</span>
                    </span>
                  </li>
                ))
              ) : (
                <li className="py-2 text-ink-soft">No occupation group is above this line for the chosen workers.</li>
              )}
            </ul>
          </Figure>
          <Figure title="Biggest groups below the line" subtitle={`Share of India's ${who}`}>
            <ul className="ui divide-y divide-rule text-[0.92rem]">
              {calc.belowRows.map((r) => (
                <li key={r.nco3} className="flex justify-between gap-3 py-1.5">
                  <span>{r.label}</span>
                  <span className="num whitespace-nowrap">
                    {r.share.toFixed(1)}% <span className="text-ink-faint">· score {r.s.toFixed(0)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Figure>
        </div>

        <div className="mt-5">
          <Takeaway>
            <p>
              Measured with the Microsoft scores, only about {sv("ms", "all", "share of Indian workers above the US top-third").toFixed(0)}% of Indian workers are in the most exposed third of US jobs, against 33% of US workers, and about{" "}
              {sv("ms", "all", "share of Indian workers below the US bottom-third").toFixed(0)}% are in jobs less exposed than the least exposed third of US jobs. The average Indian worker sits at the {sv("ms", "all", "mean percentile").toFixed(0)}th percentile of US exposure. The reason is the
              job mix: crop growing, farm and construction labour and small shop work are the biggest groups, and AI applies least to work done with hands and in the field. This is the <C id="lewis">dual economy</C> showing up in AI exposure.
            </p>
            <p>
              Women are {womenShare < menShare ? "less" : "more"} exposed than men ({womenShare.toFixed(0)}% against {menShare.toFixed(0)}% in the top third; women are {low.women_share_pct.toFixed(0)}% of the least exposed third of workers), and urban workers are far more exposed than rural ones (
              {sv("ms", "sector:urban", "share above").toFixed(0)}% against {sv("ms", "sector:rural", "share above").toFixed(0)}%). Among graduates {sv("ms", "education:graduate_or_above", "share above").toFixed(0)}% are in the top third, against{" "}
              {sv("ms", "education:below_graduate", "share above").toFixed(0)}% of other workers.
            </p>
          </Takeaway>
        </div>
      </Section>

      <Section className="grid gap-5 lg:grid-cols-2">
        <Figure
          title="Exposure and pay across occupation groups"
          subtitle="Each bubble is a three-digit occupation group, sized by its share of Indian workers. Cobalt: above your line. Amber: below. Pay is the median monthly pay of regular wage workers in the group."
          source="Source: PLFS 2025 (MoSPI), exposure from the measure chosen above. Groups with at least 30 regular-wage earners in the sample."
        >
          <Scatter
            points={points}
            yLog
            xDomain={[0, 100]}
            xLabel="Exposure of the job (US percentile)"
            yLabel="Median monthly pay, rupees (log scale)"
            xFormat={(n) => `${n}`}
            yFormat={(n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)}
            ariaLabel="Scatter of Indian occupation groups: exposure to AI against median monthly pay"
            height={400}
          />
        </Figure>
        <div className="space-y-5">
          <Figure
            title="Thirds of Indian workers by exposure"
            subtitle={`Workers ranked by the Microsoft measure and split into three equal groups. The cut points fall at US percentile ${mid.third_lower_cut.toFixed(0)} and ${high.third_lower_cut.toFixed(0)}, because most Indian jobs bunch at the low end.`}
          >
            <div className="overflow-x-auto">
              <table className="ui w-full text-[0.9rem]">
                <thead>
                  <tr className="border-b border-rule text-left">
                    <th className="py-1.5 pr-2 font-semibold"> </th>
                    <th className="px-2 py-1.5 text-right font-semibold">Least exposed</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Middle</th>
                    <th className="py-1.5 pl-2 text-right font-semibold">Most exposed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {rows.map(([name, f]) => (
                    <tr key={name}>
                      <td className="py-1.5 pr-2">{name}</td>
                      <td className="num px-2 py-1.5 text-right">{f(low)}</td>
                      <td className="num px-2 py-1.5 text-right">{f(mid)}</td>
                      <td className="num py-1.5 pl-2 text-right">{f(high)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ui mt-2 text-[0.8rem] text-ink-faint">Pay is earnings in the preceding calendar month. Contract and social security refer to the usual principal activity.</p>
          </Figure>
        </div>
      </Section>

      <Section>
        <Takeaway title="Exposure goes with pay, mostly because it goes with schooling">
          <p>
            Across regular wage workers, a job scoring 75 on the exposure scale pays about {pctChange(rawReg.coef_per_full_range).toFixed(0)}% more per month than one scoring 25. Once we compare people of the same sex, age, schooling, area
            and state, the gap shrinks to about {pctChange(fullReg.coef_per_full_range).toFixed(0)}% (interval {pctChange(fullReg.ci_low).toFixed(0)}% to {pctChange(fullReg.ci_high).toFixed(0)}%). So most of the pay premium of exposed jobs is the
            premium of education, a <C id="skill-biased-change">skill-biased</C> pattern, and it is a description, not a cause.
          </p>
          <p>
            Exposed jobs are also the more formal ones: in the most exposed third {high.regular_wage_share_pct.toFixed(0)}% of workers hold regular wage jobs, against {low.regular_wage_share_pct.toFixed(0)}% in the least exposed third. Yet even there{" "}
            {high.regular_no_written_contract_pct.toFixed(0)}% of regular wage workers have no written contract and {high.regular_no_social_security_pct.toFixed(0)}% have no social security. Exposure does not mean the same thing for a worker with
            few protections.
          </p>
        </Takeaway>
      </Section>

      <Section>
        <Caveat title="How this was built, and what it cannot say">
          <ul className="ui list-disc space-y-1.5 pl-5 text-[0.95rem]">
            <li>
              The exposure scores come from US data (Microsoft&apos;s Copilot study and Anthropic&apos;s Claude.ai data) and are matched to India through two official crosswalks (occupation codes ISCO-08 to US SOC 2010 to SOC 2018). We treat India&apos;s
              three-digit occupation codes (NCO-2015) as the international ones (ISCO-08); {check("share_workers_code_in_isco08_pct").toFixed(2)}% of workers have a code that exists in ISCO-08, but the same title can mean different tasks in India, especially in farming and small trade.
            </li>
            <li>Exposure is not job loss. It says how much of an occupation&apos;s work AI tools are used for or could help with, not whether anyone is replaced. The two measures agree only partly (rank correlation {check("spearman_ms_vs_aei_across_occupation_groups").toFixed(2)} across occupation groups).</li>
            <li>The Anthropic measure covers about 79% of Indian workers and can be noisy for groups matched to only one or two US occupations, so the Microsoft measure is the default. Using an equal weight across matched US occupations instead of employment weights changes the top-third share from {sv("ms", "all", "share of Indian workers above the US top-third").toFixed(1)}% to {sv("ms_eq", "all", "share of Indian workers above the US top-third").toFixed(1)}%.</li>
            <li>
              The survey file is the first visit of each household over 2025; every figure is a weighted share (weight = multiplier ÷ 100, as MoSPI instructs), not a headcount. Earnings are for the previous month for regular wage workers and gross
              earnings over the last 30 days for the self-employed.
            </li>
            <li>These are associations in one year of data. The results use PLFS only for employment indicators (occupation, pay, type of work) as its data agreement allows, and MoSPI is credited as the source.</li>
          </ul>
        </Caveat>
      </Section>
    </>
  );
}
