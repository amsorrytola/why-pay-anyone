"use client";

import { useMemo, useState } from "react";
import { PageHead, Section, Slider, Toggle, PresetBar, Takeaway, Caveat, Figure, Stat } from "@/components/ui";
import { CeilingChart } from "@/components/Ceiling";
import { HBars } from "@/components/charts";
import { usePageState } from "@/components/chat-context";
import { M4_DEFAULTS, M4_PARAMS, M4_PRESETS, simulateM4, type M4Params } from "@/models/m4";
import { mult, pct0, usd } from "@/lib/format";
import occupations from "@/data/occupations.json";
import poc from "@/data/m1_price_of_capability.json";

type Occ = { soc: string; title: string; employment: number | null; hourly_mean: number | null; wage_bill: number | null; ms_applicability: number | null };
const OCC = occupations as unknown as Occ[];

const GROUPS: { id: "ai" | "work" | "demand"; title: string; tone: "ai" | "human" | "owner" }[] = [
  { id: "ai", title: "The AI side", tone: "ai" },
  { id: "work", title: "The human side", tone: "human" },
  { id: "demand", title: "Who buys, and policy", tone: "owner" },
];

function latestPrice(threshold: number) {
  const rows = (poc as { threshold: number; month: string; price: number }[]).filter((r) => r.threshold === threshold);
  rows.sort((a, b) => a.month.localeCompare(b.month));
  return rows[rows.length - 1];
}

export default function M4Page() {
  const [p, setP] = useState<M4Params>(M4_DEFAULTS);
  const [active, setActive] = useState<string>("today");
  const [tokensPerHour, setTokensPerHour] = useState(1_000_000);
  const r = useMemo(() => simulateM4(p), [p]);
  const set = <K extends keyof M4Params>(k: K, v: M4Params[K]) => {
    setP((q) => ({ ...q, [k]: v }));
    setActive("");
  };

  usePageState("m4", {
    "price of AI as share of wage": p.rho,
    "share of tasks AI can do": p.A,
    "compute scarcity": p.eta,
    "people's edge": p.theta,
    "elasticity between tasks": p.sigma,
    "new tasks": p.n,
    "real wage vs no-AI world": +r.relWage.toFixed(3),
    "labour share": +r.labourShare.toFixed(3),
    "tasks done by AI": +r.aiShare.toFixed(3),
    "demand gap": +r.demandGap.toFixed(3),
  });

  // data panel: pay-weighted exposure and the token calculator
  const exposure = useMemo(() => {
    const rows = OCC.filter((o) => o.ms_applicability != null && o.wage_bill != null);
    const wb = rows.reduce((s, o) => s + (o.wage_bill as number), 0);
    const w = rows.reduce((s, o) => s + (o.wage_bill as number) * (o.ms_applicability as number), 0) / wb;
    const top = rows
      .map((o) => ({ label: o.title, value: ((o.wage_bill as number) * (o.ms_applicability as number)) / 1e9 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
    const withHourly = OCC.filter((o) => o.hourly_mean != null && o.employment != null);
    const hourly = withHourly.reduce((s, o) => s + (o.hourly_mean as number) * (o.employment as number), 0) / withHourly.reduce((s, o) => s + (o.employment as number), 0);
    return { weighted: w, top, hourly };
  }, []);
  const price120 = latestPrice(120);
  const price150 = latestPrice(150);
  const [priceChoice, setPriceChoice] = useState<"120" | "150">("120");
  const pricePerM = priceChoice === "120" ? price120.price : price150.price;
  const costPerHour = (tokensPerHour / 1e6) * pricePerM;
  const tokenRho = costPerHour / exposure.hourly;

  const binding = r.ia <= 1 - p.A + 0.015;
  const noAI = r.aiShare < 0.005;

  return (
    <>
      <PageHead
        id="M4"
        title="What does a person cost once AI can do the task?"
        question="If an AI does a task for a fraction of a person's pay, who keeps the work? Set the dials of a small task model and watch pay, jobs and shares move."
      />

      <Section>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            {GROUPS.map((g) => (
              <fieldset key={g.id} className="rounded-[6px] border border-rule bg-surface px-4 py-3">
                <legend className="ui px-1 text-[1rem] font-bold" style={{ color: g.tone === "ai" ? "var(--ai-deep)" : g.tone === "human" ? "var(--human-deep)" : "var(--owner)" }}>
                  {g.title}
                </legend>
                {M4_PARAMS.filter((m) => m.group === g.id).map((m) => (
                  <Slider
                    key={m.key}
                    label={m.label}
                    value={p[m.key] as number}
                    min={m.min}
                    max={m.max}
                    step={m.step}
                    tone={g.tone}
                    help={m.help}
                    onChange={(v) => set(m.key, v as never)}
                    toPos={m.log ? Math.log10 : undefined}
                    fromPos={m.log ? (x) => Math.pow(10, x) : undefined}
                    format={(v) => (m.unit.startsWith("%") ? `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}% ${m.unit.slice(2)}`.trim() : v.toFixed(m.step < 0.1 ? 2 : 1))}
                  />
                ))}
                {g.id === "demand" && <Toggle label="Let demand fall short" checked={p.keynes} onChange={(v) => set("keynes", v)} help="Off: spending always catches up with output (Say's law). On: a shortfall cuts jobs (Keynes)." />}
              </fieldset>
            ))}
            <button
              onClick={() => {
                setP(M4_DEFAULTS);
                setActive("today");
              }}
              className="ui text-[0.95rem] underline"
            >
              Reset all dials
            </button>
          </div>

          <div className="min-w-0 space-y-5">
            <PresetBar
              presets={M4_PRESETS}
              active={active}
              onPick={(id) => {
                const pr = M4_PRESETS.find((x) => x.id === id)!;
                setP({ ...M4_DEFAULTS, ...pr.p });
                setActive(id);
              }}
            />
            {active && <p className="ui -mt-2 text-[0.95rem] text-ink-soft">{M4_PRESETS.find((x) => x.id === active)?.note}</p>}

            <Figure
              title="The ceiling on pay, task by task"
              subtitle="Drag the AI price tab up or down. Wherever a person would cost more than AI and AI can do the task, the task switches to AI and its cost is cut to the ceiling."
              source="A stylised model, not a forecast. Based on the task framework of Acemoglu and Restrepo; see the method notes below."
            >
              <CeilingChart p={p} r={r} onRhoScale={(f) => set("rho", Math.min(3, Math.max(0.01, p.rho * f)))} />
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
                <Stat value={r.unbounded ? "no limit" : mult(r.relWage)} label="Real pay, against a world without AI" tone="human" />
                <Stat value={pct0(r.labourShare)} label="Share of income paid as wages" tone="human" sub={`${pct0(r.aiIncomeShare)} goes to AI owners`} />
                <Stat value={pct0(r.aiShare)} label="Of tasks done by AI" tone="ai" />
                <Stat value={pct0(r.demandGap)} label="Spending shortfall" tone="owner" sub={p.keynes ? "cutting jobs" : "not cutting jobs"} />
                <Stat value={r.unbounded ? "no limit" : mult(r.workerIncomeRel)} label="Workers' income incl. basic income" tone="owner" />
              </div>
              {r.unbounded && (
                <p className="ui mt-3 rounded bg-ai-soft px-3 py-2 text-[0.92rem]">
                  At these settings the model has no finite answer: tasks substitute so easily, and AI is so cheap, that output per worker has no upper limit. Raise the AI price or lower the elasticity between tasks.
                </p>
              )}
            </Figure>

            <Takeaway>
              {noAI ? (
                <p>At this price AI is not cheaper than a person on any task it can do, so nothing changes. Pull the AI price down to see where the switch starts.</p>
              ) : binding ? (
                <p>
                  Here the price of AI is <strong>not</strong> what limits AI. It is already cheaper than a person on every task it can do, so lowering the price further
                  changes who does the work not at all. What matters is how much work AI can do, and how well tasks substitute for one another.
                </p>
              ) : (
                <p>
                  Here the price of AI <strong>does</strong> set the ceiling: AI takes only the tasks where people cost more than it does, so the wage a person can
                  earn at the margin equals the AI price adjusted for how good people are at that task. Lower the price and the ceiling comes down with it.
                </p>
              )}
              <p>
                Real pay can rise while the labour share falls: cheaper tasks raise output, but a bigger share of income goes to whoever owns the AI. Whether cheaper AI lifts or cuts the labour share depends on
                whether tasks are complements (elasticity below 1) or substitutes (above 1).
              </p>
            </Takeaway>
          </div>
        </div>
      </Section>

      <Section>
        <h2 className="mb-4">Does the price of tokens even bind today?</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Figure
            title="Tokens per hour of work, against pay per hour"
            subtitle="Estimate what an hour of a person's work costs in AI tokens. The result is the lowest the 'all-in price of AI' dial could be if only tokens cost anything."
            source={`Prices: cheapest listed price of any model at that capability level in ${price120.month} (LiteLLM price file, Epoch capability index). Wages: BLS OEWS, May 2025, employment-weighted mean hourly wage.`}
          >
            <Slider
              label="Tokens needed for an hour of work"
              value={tokensPerHour}
              onChange={setTokensPerHour}
              min={10_000}
              max={20_000_000}
              step={1}
              toPos={Math.log10}
              fromPos={(x) => Math.round(Math.pow(10, x))}
              format={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`)}
              help="A long agent session can use millions of tokens (reading, trying, checking). This is an assumption, not a measurement."
            />
            <div className="ui my-3 flex gap-3 text-[0.95rem]">
              <label className="flex items-center gap-1.5">
                <input type="radio" name="lvl" checked={priceChoice === "120"} onChange={() => setPriceChoice("120")} className="accent-[var(--ai)]" />
                GPT-4-level model ({usd(price120.price)}/M)
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="lvl" checked={priceChoice === "150"} onChange={() => setPriceChoice("150")} className="accent-[var(--ai)]" />
                GPT-5-level model ({usd(price150.price)}/M)
              </label>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Stat value={usd(costPerHour)} label="AI tokens for one hour of work" tone="ai" />
              <Stat value={usd(exposure.hourly)} label="Average pay per hour, US" tone="human" />
              <Stat value={tokenRho < 0.001 ? "<0.1%" : `${(tokenRho * 100).toFixed(1)}%`} label="Tokens as a share of pay" />
            </div>
            <button onClick={() => set("rho", Math.min(3, Math.max(0.01, tokenRho * 10)))} className="ui mt-3 rounded-full border border-rule px-3.5 py-1.5 text-[0.9rem] hover:border-ai hover:bg-ai-soft">
              Set the all-in price to 10 times this
            </button>
            <p className="ui mt-2 text-[0.85rem] text-ink-soft">The all-in price also has to cover checking the work, fixing errors and integration. Ten times the token cost is a guess that leaves AI still far cheaper than a person.</p>
          </Figure>

          <Figure
            title="Where the pay is in work AI could do"
            subtitle="Annual pay (billions of dollars) in each occupation, multiplied by its Microsoft AI applicability score. Pay-weighted, the US figure is near 18% of tasks."
            source="Sources: Microsoft Working with AI (applicability, Bing Copilot use Jan to Sep 2024); BLS OEWS May 2025 (wages). Applicability measures where AI is used, not whether jobs will disappear."
          >
            <HBars items={exposure.top.map((t) => ({ ...t, color: "var(--ai)" }))} format={(v) => `$${v.toFixed(0)}B`} ariaLabel="Occupations ranked by pay in tasks AI can do" labelWidth={200} />
            <button onClick={() => set("A", +exposure.weighted.toFixed(2))} className="ui mt-3 rounded-full border border-rule px-3.5 py-1.5 text-[0.9rem] hover:border-ai hover:bg-ai-soft">
              Set &quot;work AI can do&quot; to the US data ({pct0(exposure.weighted)})
            </button>
          </Figure>
        </div>
      </Section>

      <Section className="grid gap-5 lg:grid-cols-2">
        <Caveat title="How the model works">
          <p>
            Tasks run from those people are best at to those AI finds easiest. A person&apos;s productivity falls steadily along that line. AI can do the top share of tasks and costs the same for each. Every task goes to the cheaper option, and the wage adjusts until one unit of labour is fully employed. Output combines the tasks with a standard constant-elasticity aggregator.
          </p>
          <p>
            Spending falls short of output by (spending rate of workers minus spending rate of AI owners) times the owners&apos; share of income, reduced by any automation tax paid to workers. That is the whole demand side: investment is assumed to keep up with output.
          </p>
        </Caveat>
        <Caveat title="What this model leaves out">
          <p>
            One kind of worker and one wage, so it says nothing about who within the workforce loses. Full employment unless the demand switch is on. No transition costs, no learning, no unions or laws. The real-pay number compares two worlds, not two years. Treat every result as a scenario for thinking, not a forecast.
          </p>
          <p>
            Concepts used: comparative advantage, the task-based model, elasticity of substitution, the labour share, Say&apos;s law versus Keynes, marginal propensity to consume, automation tax and basic income.
          </p>
        </Caveat>
      </Section>
    </>
  );
}
