"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Slider, Stat, Section, Caveat } from "@/components/ui";
import { CeilingChart } from "@/components/Ceiling";
import { usePageState } from "@/components/chat-context";
import { SITE_LINKS } from "@/components/site";
import { M4_DEFAULTS, simulateM4, type M4Params } from "@/models/m4";
import { mult, pct0 } from "@/lib/format";
import fits from "@/data/m1_price_decline_fits.json";
import vol from "@/data/m1_volume_monthly.json";
import conc from "@/data/m5_concentration_monthly.json";
import agr from "@/data/m2_agreement.json";
import btosSum from "@/data/m3_btos_adoption_summary.json";
import ev from "@/data/m3_event_study_summary.json";
import indiaSummary from "@/data/india_b_summary.json";

type Fit = { threshold: number; price_first: number; price_last: number; halving_time_months: number };
type Vol = { month: string; all_tokens_per_day: number };
type Conc = { month: string; hhi: number; effective_firms: number };
type Agr = { measure_a: string; measure_b: string; sample: string; weighting: string; statistic: string; estimate: number };
type BtosSum = { geo_type: string; question_id: number; answer: string; first3_mean: number; latest_value: number };
type Ev = { country: string; spec: string; window: string; pct: number };
type Sum = { measure: string; scope: string; label: string; value: number };

const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
};

const IDEAS: { name: string; text: string; ch: string; href: string }[] = [
  { name: "Comparative advantage", text: "Even if AI is better at everything, people keep the tasks where they are relatively best, as long as AI capacity is limited.", ch: "Chapter 4", href: "/m4" },
  { name: "The wage ceiling", text: "For a task AI can do, a person's pay cannot stay above what the AI costs, and the price of that AI keeps falling.", ch: "Chapter 1", href: "/m1" },
  { name: "Who buys the output", text: "If fewer people earn wages, who buys what is made? Workers and owners of AI spend different shares of what they earn.", ch: "Chapter 4", href: "/m4" },
  { name: "New tasks and the Jevons paradox", text: "Cheaper intelligence can raise total demand and create new work, as cheaper coal once raised total coal use.", ch: "Chapter 1", href: "/m1" },
  { name: "Who owns the agents", text: "If a few providers sell the intelligence, they may keep much of the gain. Concentration, entry and price competition show how likely that is.", ch: "Chapter 5", href: "/m5" },
];

export default function Home() {
  const [p, setP] = useState<M4Params>({ ...M4_DEFAULTS, A: 0.5, rho: 0.3 });
  const r = useMemo(() => simulateM4(p), [p]);
  const set = <K extends keyof M4Params>(k: K, v: M4Params[K]) => setP((q) => ({ ...q, [k]: v }));
  usePageState("home", { "price of AI as share of wage": p.rho, "share of tasks AI can do": p.A, "elasticity between tasks": p.sigma, "labour share": +r.labourShare.toFixed(3), "real wage vs no-AI world": +r.relWage.toFixed(3) });

  const f120 = (fits as Fit[]).find((f) => f.threshold === 120)!;
  const v = vol as Vol[];
  const c = conc as Conc[];
  const growth = v[v.length - 1].all_tokens_per_day / v[0].all_tokens_per_day;
  const cMin = c.reduce((a, b) => (b.hhi < a.hhi ? b : a));
  const cEnd = c[c.length - 1];
  const agree = (agr as Agr[]).find((a) => a.measure_a === "ms_applicability" && a.measure_b === "aei_usage_ratio" && a.sample.startsWith("591") && a.statistic === "spearman" && a.weighting === "unweighted");
  const adopt = (btosSum as BtosSum[]).find((b) => b.geo_type === "national" && b.question_id === 7 && b.answer === "Yes");
  const postings = (ev as Ev[]).find((e) => e.country === "US" && e.spec === "tercile_ms" && e.window === "post_all");
  const india = (indiaSummary as Sum[]).find((x) => x.measure === "ms" && x.scope === "all" && x.label.startsWith("share of Indian workers above the US top-third"))?.value;

  const rows: { m: string; v: string; when: string; ch: string; href: string }[] = [
    { m: "Cheapest price of GPT-4-level AI, per million tokens", v: `$${f120.price_first.toFixed(2)} to $${f120.price_last.toFixed(3)}`, when: "Sep 2023 to Nov 2026", ch: "1", href: "/m1" },
    { m: "Time for that price to halve, on the trend", v: `${f120.halving_time_months.toFixed(1)} months`, when: "Same period", ch: "1", href: "/m1" },
    { m: "Daily AI tokens through OpenRouter", v: `${Math.round(growth)} times higher`, when: `${monthLabel(v[0].month)} to ${monthLabel(v[v.length - 1].month)}`, ch: "1", href: "/m1" },
    ...(agree ? [{ m: "Agreement of two measures of which jobs use AI (rank correlation)", v: agree.estimate.toFixed(2), when: "591 US occupations", ch: "2", href: "/m2" }] : []),
    ...(adopt ? [{ m: "US firms using AI to produce goods or services", v: `${Math.round(adopt.first3_mean)}% to ${Math.round(adopt.latest_value)}%`, when: "Nov 2025 to Nov 2026", ch: "3", href: "/m3" }] : []),
    ...(postings ? [{ m: "Job postings, most against least AI-exposed third of job types", v: `${postings.pct < 0 ? "\u2212" : ""}${Math.abs(Math.round(postings.pct))}%`, when: "Since ChatGPT (Dec 2022)", ch: "3", href: "/m3" }] : []),
    { m: "Equivalent number of equal-sized AI providers", v: `${Math.round(cMin.effective_firms)} to ${Math.round(cEnd.effective_firms)}`, when: `${monthLabel(cMin.month)} to ${monthLabel(cEnd.month)}`, ch: "5", href: "/m5" },
    ...(india !== undefined ? [{ m: "Indian workers in the most AI-exposed third of US jobs (US: 33%)", v: `${india.toFixed(1)}%`, when: "PLFS 2025", ch: "7", href: "/india" }] : []),
  ];

  const chapters = SITE_LINKS.filter((l) => l.n);

  return (
    <>
      {/* Title page */}
      <header className="mx-auto max-w-[1180px] px-5 pt-8 sm:px-8 sm:pt-12">
        <div className="rule-double pt-6 sm:pt-10">
          <h1 className="text-[clamp(3rem,10vw,6.4rem)] leading-[0.98] tracking-[-0.02em]">Why Pay Anyone?</h1>
          <p className="serif mt-3 text-[clamp(1.3rem,2.6vw,1.8rem)] italic leading-snug text-ink-soft">The economics of cheap intelligence</p>
          <p className="ui mt-5 border-t border-rule pt-3 text-[0.9rem] text-ink-soft">
            Lab Based Project, BS-MS Economics, IIT Roorkee. Industry track, Hello Agentic. November 2026.
          </p>
        </div>
      </header>

      <Section className="pt-8 sm:pt-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 className="text-[1.5rem]">Abstract</h2>
            <p className="mt-3 text-[1.12rem] leading-[1.65]">
              An AI can already do a growing list of tasks for a few cents. If it does the work for less, why would anyone pay a person to do it? This study answers with public data on the price of AI, where it is used, how firms adopt it, who sells it, and what it means for India, together with a small task model and a growth model whose every assumption you can change.
            </p>
            <p className="mt-3 text-[1.12rem] leading-[1.65]">
              The short answer: the price of AI is falling fast, but price is not what limits it. People keep the tasks where they are relatively best, real pay can rise while the share of income paid as wages falls, and who gains depends on who owns the AI.
            </p>
          </div>
          <div>
            <h2 className="text-[1.5rem]">How to read this</h2>
            <ul className="mt-3 border-t border-ink">
              <li className="border-b border-rule">
                <Link href="/journey" className="entry block py-3.5">
                  <span className="entry-title serif block text-[1.25rem] font-semibold">Guided reading</span>
                  <span className="ui block text-[0.92rem] text-ink-soft">Seven chapters in about eight minutes. Guess first, then see what the data says. Ends with your scorecard.</span>
                </Link>
              </li>
              <li className="border-b border-rule">
                <a href="#figure-1" className="entry block py-3.5">
                  <span className="entry-title serif block text-[1.25rem] font-semibold">The model, below</span>
                  <span className="ui block text-[0.92rem] text-ink-soft">Change the price of AI and the share of work it can do, and watch pay and the wage share move.</span>
                </a>
              </li>
              <li className="border-b border-rule">
                <a href="#contents" className="entry block py-3.5">
                  <span className="entry-title serif block text-[1.25rem] font-semibold">The full chapters</span>
                  <span className="ui block text-[0.92rem] text-ink-soft">Every dataset, dial and caveat, one question per chapter.</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section>
        <h2 className="tab-title ui text-[1.02rem] font-semibold leading-snug">Key figures</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="booktabs min-w-[34rem] text-[0.95rem]">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="r">
                  Value
                </th>
                <th scope="col">Period or sample</th>
                <th scope="col" className="r">
                  Chapter
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.m}>
                  <td>{x.m}</td>
                  <td className="r num">{x.v}</td>
                  <td className="text-ink-soft">{x.when}</td>
                  <td className="r">
                    <Link href={x.href}>{x.ch}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ui mt-2 text-[0.78rem] text-ink-faint">Sources: Epoch AI, LiteLLM, OpenRouter, Microsoft, Anthropic, US Census Bureau, Indeed Hiring Lab, MoSPI (PLFS). Details on the data page.</p>
      </Section>

      <Section className="scroll-mt-20" >
        <figure id="figure-1" className="rule-top scroll-mt-20 pt-3">
          <figcaption>
            <h3 className="fig-title ui text-[1.02rem] leading-snug">The ceiling on pay, task by task</h3>
            <p className="ui mt-1 max-w-[80ch] text-[0.88rem] leading-snug text-ink-soft">
              Each column is a task, from the tasks people are best at (left) to those AI finds easiest (right). Vermilion: done by a person. Blue: done by AI, its cost cut to the AI price. Drag the AI price, or use the dials.
            </p>
          </figcaption>
          <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <CeilingChart p={p} r={r} height={360} intro onRhoScale={(fac) => set("rho", Math.min(3, Math.max(0.01, p.rho * fac)))} />
            </div>
            <div>
              <div className="grid grid-cols-3 gap-3 border-b border-rule pb-4">
                <Stat value={r.unbounded ? "no limit" : mult(r.relWage)} label="Real pay vs no AI" tone="human" />
                <Stat value={pct0(r.labourShare)} label="Wage share of income" tone="human" />
                <Stat value={pct0(r.aiShare)} label="Tasks done by AI" tone="ai" />
              </div>
              <div className="mt-2">
                <Slider label="Price of AI" tone="ai" value={p.rho} min={0.01} max={3} step={0.001} toPos={Math.log10} fromPos={(x) => Math.pow(10, x)} onChange={(x) => set("rho", x)} format={(x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}% of a wage`} help="All-in cost of a task done with AI, against what a person is paid for it." />
                <Slider label="Work AI can do" tone="ai" value={p.A} min={0} max={1} step={0.01} onChange={(x) => set("A", x)} format={pct0} help="Share of tasks AI handles well enough." />
                <Slider label="How easily one task replaces another" tone="human" value={p.sigma} min={0.2} max={1.4} step={0.05} onChange={(x) => set("sigma", x)} format={(x) => x.toFixed(2)} help="Below 1, tasks complement each other. Above 1, they substitute." />
              </div>
            </div>
          </div>
          <p className="ui mt-4 border-t border-rule pt-2 text-[0.78rem] text-ink-faint">
            Source: the project&apos;s task model, after Acemoglu and Restrepo. A stylised model, not a forecast. <Link href="/m4">Every dial is in chapter 4</Link>.
          </p>
        </figure>
      </Section>

      <Section>
        <h2 id="contents" className="scroll-mt-24">
          Contents
        </h2>
        <ol className="mt-4 border-t border-ink">
          {chapters.map((l) => (
            <li key={l.href} className="border-b border-rule">
              <Link href={l.href} className="entry grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-x-4 py-4 sm:grid-cols-[3.5rem_14rem_minmax(0,1fr)]">
                <span className="serif text-[1.7rem] font-semibold leading-none text-human">{l.n}</span>
                <span className="entry-title serif text-[1.4rem] font-semibold leading-tight">{l.label}</span>
                <span className="ui col-start-2 text-[0.95rem] text-ink-soft sm:col-start-3">{l.q}</span>
              </Link>
            </li>
          ))}
          <li className="border-b border-rule">
            <Link href="/concepts" className="entry grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-x-4 py-4 sm:grid-cols-[3.5rem_14rem_minmax(0,1fr)]">
              <span />
              <span className="entry-title serif text-[1.4rem] leading-tight">Concepts</span>
              <span className="ui col-start-2 text-[0.95rem] text-ink-soft sm:col-start-3">61 economics ideas used in the study, in plain words, and how they connect.</span>
            </Link>
          </li>
          <li className="border-b border-ink">
            <Link href="/data" className="entry grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-x-4 py-4 sm:grid-cols-[3.5rem_14rem_minmax(0,1fr)]">
              <span />
              <span className="entry-title serif text-[1.4rem] leading-tight">Data and method</span>
              <span className="ui col-start-2 text-[0.95rem] text-ink-soft sm:col-start-3">Every source, its licence, what was done with it, and its limits.</span>
            </Link>
          </li>
        </ol>
      </Section>

      <Section>
        <h2>The argument in five ideas</h2>
        <dl className="mt-5 grid gap-x-12 gap-y-6 md:grid-cols-2">
          {IDEAS.map((i) => (
            <div key={i.name} className="border-t border-rule pt-3">
              <dt className="serif text-[1.25rem] font-semibold">{i.name}</dt>
              <dd className="mt-1 text-[1.02rem] leading-relaxed">
                {i.text}{" "}
                <Link href={i.href} className="ui whitespace-nowrap text-[0.92rem] font-semibold">
                  {i.ch}
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section>
        <Caveat title="What this is not">
          <p>
            It is not a forecast of jobs. Exposure scores say where AI is used, not who will lose work. Each dataset covers one platform or one country. The models are deliberately simple so that every dial can be explained. The <Link href="/data">data page</Link> lists every source and its limits, and the question panel can answer questions about any figure.
          </p>
        </Caveat>
      </Section>
    </>
  );
}
