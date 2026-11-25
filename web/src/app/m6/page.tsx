"use client";

import { useMemo, useState } from "react";
import { PageHead, Section, Segmented, Slider, PresetBar, Takeaway, Caveat, Figure, Stat } from "@/components/ui";
import { LineChart, StackedArea, type LineSeries } from "@/components/charts";
import { usePageState } from "@/components/chat-context";
import { C } from "@/components/Concept";
import { M6_DEFAULTS, M6_GROUPS, M6_PARAMS, M6_PRESETS, m6ParamsForPreset, simulateM6, type M6Params, type M6ParamMeta } from "@/models/m6";

type Tab = "a" | "b" | "c";
const TABS: { value: Tab; label: string }[] = [
  { value: "a", label: "A. Growth and who gets the income" },
  { value: "b", label: "B. Ideas and research" },
  { value: "c", label: "C. Demand, tax and basic income" },
];
const GROUP_OF: Record<Tab, string> = { a: "a_growth", b: "b_ideas", c: "c_policy" };

const yearsOf = (a: number[]) => a.map((v, i) => [i, v] as [number, number]).filter((p) => Number.isFinite(p[1]));
const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;

function ParamSlider(props: { m: M6ParamMeta; value: number; onChange: (v: number) => void }) {
  const { m } = props;
  const pctDisplay = m.display === "percent";
  return (
    <Slider
      label={m.label}
      value={props.value}
      min={m.min}
      max={m.max}
      step={m.step}
      onChange={props.onChange}
      tone={m.group === "c_policy" ? "owner" : m.group === "b_ideas" ? "human" : "ai"}
      format={(v) => (pctDisplay ? `${(v * 100).toFixed(m.step < 0.01 ? 1 : 0)}%` : v.toFixed(m.step < 0.1 ? 2 : 1))}
      help={`${m.help}${m.kind === "assumption" ? " (An assumption: no data fixes it.)" : ""}`}
    />
  );
}

export default function M6Page() {
  const [tab, setTab] = useState<Tab>("a");
  const [p, setP] = useState<M6Params>(M6_DEFAULTS);
  const [preset, setPreset] = useState(M6_PRESETS[0].name);
  const r = useMemo(() => simulateM6(p), [p]);
  const set = (k: keyof M6Params, v: number) => {
    setP((q) => ({ ...q, [k]: v }));
    setPreset("");
  };

  const a = r.a;
  const f = r.a_frozen;
  const yr = Math.min(60, Math.max(10, Math.round(p.eval_year)));
  const gdpGain = a.gdp_per_worker[yr] / f.gdp_per_worker[yr] - 1;

  usePageState("m6", {
    tab: tab,
    "scenario": preset || "custom",
    "elasticity between labour and AI compute": p.sigma,
    "compute doubling time (years)": p.compute_doubling_years,
    "labour share at year 30": +a.labour_share[30].toFixed(3),
    "automation tax": p.tax_rate,
    "growth regime": r.b.regime,
  });

  const aSeries: LineSeries[] = [
    { id: "gdp", label: "GDP per worker", color: "var(--ai)", points: yearsOf(a.gdp_per_worker) },
    { id: "frozen", label: "Compute frozen", color: "var(--ink-faint)", dashed: true, points: yearsOf(f.gdp_per_worker) },
    { id: "wage", label: "Wage per worker", color: "var(--human)", points: yearsOf(a.wage) },
  ];
  const bSeries: LineSeries[] = [
    { id: "ai", label: "AI does research", color: "var(--ai)", points: yearsOf(r.b.ai.growth_ideas).map(([x, y]) => [x, y * 100] as [number, number]) },
    { id: "base", label: "Automation off", color: "var(--ink-faint)", dashed: true, points: yearsOf(r.b.base.growth_ideas).map(([x, y]) => [x, y * 100] as [number, number]) },
  ];
  const bgp: LineSeries = {
    id: "bgp",
    label: "Long-run growth",
    color: "var(--human-deep)",
    noLabel: true,
    points: r.b.share_grid.map((s, i) => [s, r.b.bgp_growth[i]] as [number, number | null]).filter((q): q is [number, number] => q[1] != null).map(([x, y]) => [x * 100, y * 100] as [number, number]),
  };
  const c = r.c;
  const gapSeries: LineSeries[] = [
    { id: "nt", label: "No tax", color: "var(--owner)", points: yearsOf(c.paths.gap_no_tax).map(([x, y]) => [x, y * 100] as [number, number]) },
    { id: "t", label: "Tax + basic income", color: "var(--ok)", points: yearsOf(c.paths.gap_tax).map(([x, y]) => [x, y * 100] as [number, number]) },
  ];
  const curveW: LineSeries = { id: "w", label: "Welfare gain", color: "var(--ok)", noLabel: true, points: c.curve.map((q) => [q.tax * 100, q.welfare_gain_pct] as [number, number]) };
  const curveR: LineSeries = { id: "rev", label: "Tax revenue, % of GDP", color: "var(--owner)", noLabel: true, points: c.curve.map((q) => [q.tax * 100, q.revenue_pct_gdp] as [number, number]) };

  const groupParams = M6_PARAMS.filter((m) => m.group === GROUP_OF[tab]);
  const econParams = M6_PARAMS.filter((m) => m.group === "economy");

  return (
    <>
      <PageHead
        id="M6"
        title="Growth, inequality and policy"
        question="What happens to growth, income shares and demand as compute does more of the work? Three small models you can steer: growth with AI compute as a new input, growth when AI does research, and what an automation tax with a basic income does to demand and welfare."
      />

      <Section>
        <div className="mb-4 space-y-3">
          <PresetBar
            presets={M6_PRESETS.map((q) => ({ id: q.name, label: q.name }))}
            active={preset}
            onPick={(id) => {
              setP(m6ParamsForPreset(id));
              setPreset(id);
            }}
          />
          {preset && <p className="ui text-[0.95rem] text-ink-soft">{M6_PRESETS.find((q) => q.name === preset)?.story}</p>}
          <Segmented label="Which model" options={TABS} value={tab} onChange={setTab} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <fieldset className="panel px-4 py-3">
              <legend className="ui px-1 text-[1rem] font-bold">{M6_GROUPS.find((g) => g.id === GROUP_OF[tab])?.label}</legend>
              <p className="ui mb-1 text-[0.85rem] text-ink-soft">{M6_GROUPS.find((g) => g.id === GROUP_OF[tab])?.blurb}</p>
              {groupParams.map((m) => (
                <ParamSlider key={m.key} m={m} value={p[m.key]} onChange={(v) => set(m.key, v)} />
              ))}
            </fieldset>
            <details className="panel px-4 py-3">
              <summary className="ui cursor-pointer text-[1rem] font-bold">Economy today (calibrated from data)</summary>
              <div className="mt-2">
                {econParams.map((m) => (
                  <ParamSlider key={m.key} m={m} value={p[m.key]} onChange={(v) => set(m.key, v)} />
                ))}
              </div>
            </details>
            <button
              onClick={() => {
                setP(M6_DEFAULTS);
                setPreset(M6_PRESETS[0].name);
              }}
              className="ui text-[0.95rem] underline"
            >
              Reset all dials
            </button>
          </div>

          <div className="min-w-0 space-y-5">
            {tab === "a" && (
              <>
                <Figure title="GDP per worker and wages over 60 years" subtitle="Both in units of today's GDP per worker. The dashed line is the same economy if AI compute stayed where it is today." source="Model A: Solow growth with a CES mix of labour and AI compute. Calibrated to Penn World Table 11.0 and Epoch AI compute data. A scenario, not a forecast.">
                  <LineChart series={aSeries} height={340} xFormat={(n) => `Year ${n}`} yFormat={(n) => `${n.toFixed(1)}×`} ariaLabel="GDP per worker and wage over time" rightPad={190} />
                  <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
                    <Stat value={`${a.gdp_per_worker[yr].toFixed(1)}×`} label={`GDP per worker in year ${yr}`} tone="ai" sub={`${gdpGain >= 0 ? "+" : ""}${(gdpGain * 100).toFixed(0)}% against frozen compute`} />
                    <Stat value={pct(a.labour_share[yr])} label={`Labour share of income, year ${yr}`} tone="human" sub={`today ${pct(a.labour_share[0])}`} />
                    <Stat value={pct(a.ai_share[yr])} label="Income of AI compute owners" tone="owner" />
                    <Stat value={`${(a.r_net[yr] * 100).toFixed(1)}%`} label="Return on capital" sub={`growth ${(a.growth[Math.min(yr, 59)] * 100).toFixed(1)}%`} />
                  </div>
                </Figure>
                <Figure title="Who gets the income" subtitle="Share of GDP paid to workers, to owners of AI compute and to owners of other capital." source="Model A, same scenario.">
                  <StackedArea
                    xs={a.labour_share.map((_, i) => i)}
                    series={[
                      { id: "l", label: "Workers", color: "var(--human)", values: a.labour_share },
                      { id: "k", label: "Other capital", color: "var(--ink-faint)", values: a.capital_share },
                      { id: "c", label: "AI compute owners", color: "var(--owner)", values: a.ai_share },
                    ]}
                    normalize
                    height={300}
                    xFormat={(n) => `Year ${n}`}
                    ariaLabel="Shares of income over time"
                  />
                </Figure>
                <Takeaway>
                  <p>
                    How AI compute and workers fit together (<C id="ces">the elasticity of substitution</C>) decides the story. Below 1, compute makes workers more productive and the labour share barely moves. Above 1, compute replaces workers: output per worker rises faster, but a growing share of income goes to the owners of compute.
                    Compare <C id="piketty">the return on capital with growth</C> in the last stat: the wider the gap, the faster wealth concentrates.
                  </p>
                </Takeaway>
              </>
            )}
            {tab === "b" && (
              <>
                <Figure title="Growth of ideas when AI does research" subtitle="Annual growth of the stock of ideas, in percent. Research automation lets compute substitute for researchers." source="Model B: ideas production after Jones (1995) and Aghion, Jones and Jones (2019). A scenario, not a forecast.">
                  <LineChart series={bSeries} height={320} xFormat={(n) => `Year ${n}`} yFormat={(n) => `${n.toFixed(1)}%`} ariaLabel="Growth of ideas over time" rightPad={190} />
                  <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
                    <Stat value={r.b.regime} label="Regime" tone={r.b.exploded ? "owner" : "ai"} />
                    <Stat value={pct(r.b.threshold_share)} label="AI share of research at which growth explodes" />
                    <Stat value={r.b.first_cap_year != null ? `Year ${r.b.first_cap_year}` : "never"} label="Growth hits the cap we impose" />
                  </div>
                </Figure>
                <Figure title="Long-run growth against the AI share of research" subtitle="Where each share leads in the long run. The curve ends where growth becomes explosive." source="Model B, balanced growth path.">
                  <LineChart series={[bgp]} height={280} xFormat={(n) => `${n}%`} yFormat={(n) => `${n.toFixed(1)}%`} ariaLabel="Long-run growth against AI share of research" rightPad={110} />
                </Figure>
                <Takeaway>
                  <p>
                    This is <C id="endogenous-growth">endogenous growth</C> with a twist: when AI can do research tasks, ideas help produce more ideas without needing more researchers, and growth can accelerate instead of staying constant. Whether it does depends on how much each new idea builds on the last. The thresholds here come from assumed parameters, not data, so read the pattern, not the number.
                  </p>
                </Takeaway>
              </>
            )}
            {tab === "c" && (
              <>
                <Figure title="Does spending keep up with output?" subtitle="Demand shortfall as a percent of potential output. Owners of AI compute save more than workers, so if investment does not absorb the saving, spending falls short." source="Model C: two household groups with different spending rates, an automation tax paid out as an equal basic income.">
                  <LineChart series={gapSeries} height={300} xFormat={(n) => `Year ${n}`} yFormat={(n) => `${n.toFixed(1)}%`} ariaLabel="Demand shortfall over time with and without tax" rightPad={190} />
                </Figure>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Figure title="What tax rate is best?" subtitle={`Welfare gain from the tax, in percent, by tax rate on AI income (year ${c.eval_year}). The peak is the best rate under these assumptions.`} source="Model C. Welfare is CRRA utility summed over workers and owners with the weights set in the dials.">
                    <LineChart series={[curveW]} height={260} xFormat={(n) => `${n}%`} yFormat={(n) => `${n.toFixed(1)}%`} ariaLabel="Welfare gain by tax rate" hlines={[{ y: 0, label: "no change" }]} rightPad={20} />
                    <div className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
                      <Stat value={pct(c.optimal_tax)} label="Best tax rate" tone="ok" sub={`welfare ${c.optimal_gain_pct >= 0 ? "+" : ""}${c.optimal_gain_pct.toFixed(1)}%`} />
                      <Stat value={`${c.gap_no_tax_at_eval.toFixed(1)}%`} label="Shortfall with no tax" tone="owner" />
                    </div>
                  </Figure>
                  <Figure title="How much does the tax raise?" subtitle="Revenue as a percent of GDP. It peaks, then falls as the tax base shrinks." source="Model C, with the tax-base elasticity set in the dials.">
                    <LineChart series={[curveR]} height={260} xFormat={(n) => `${n}%`} yFormat={(n) => `${n.toFixed(1)}%`} ariaLabel="Tax revenue by tax rate" rightPad={20} />
                    <div className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
                      <Stat value={pct(c.revenue_peak_tax)} label="Rate that raises the most" sub={`${c.revenue_peak_pct_gdp.toFixed(1)}% of GDP`} />
                    </div>
                  </Figure>
                </div>
                <Takeaway>
                  <p>
                    Under <C id="says-law">Say&apos;s law</C> spending always catches up with output. Under Keynes it can fall short when income moves to people who spend less (<C id="propensity-to-consume">the marginal propensity to consume</C> differs by group). An <C id="automation-tax">automation tax</C> paid out as a <C id="ubi">basic income</C> moves income back to people who spend more, so it closes part of the shortfall. Whether it raises welfare depends on how much the tax discourages investment: that is the tax-base dial.
                  </p>
                </Takeaway>
              </>
            )}
          </div>
        </div>
      </Section>

      <Section className="grid gap-5 lg:grid-cols-2">
        <Caveat title="Read with care">
          <ul className="ui list-disc space-y-1.5 pl-5 text-[0.95rem]">
            <li>These are scenarios built to make an argument visible. They are not forecasts. Each dial marked as an assumption has no data behind it, only a plausible range.</li>
            <li>Calibration comes from Penn World Table 11.0 (labour share, capital, saving), World Bank series and Epoch AI data on AI chips and data centres; the compute stock is shipments, not use.</li>
            <li>The India preset changes the labour share, saving rate, workforce growth and growth rate to India&apos;s values; India&apos;s AI compute income today is tiny.</li>
            <li>The full equations, the parameter table and a cross-check between the browser model and a Python reference are in the model note in the repository.</li>
          </ul>
        </Caveat>
        <Caveat title="Concepts used">
          <p>
            <C id="solow">Solow growth</C>, <C id="ces">CES production</C>, <C id="endogenous-growth">endogenous growth</C> (ideas production), <C id="labour-share">labour share</C>, <C id="piketty">return on capital against growth</C>, <C id="says-law">Say&apos;s law</C> versus Keynes, <C id="propensity-to-consume">marginal propensity to consume</C>, <C id="automation-tax">automation tax</C>, <C id="ubi">basic income</C> and <C id="welfare">welfare</C>. The <C id="gini">Gini coefficient</C> is the usual one-number measure of inequality; here we show income shares between workers and owners instead.
          </p>
        </Caveat>
      </Section>
    </>
  );
}
