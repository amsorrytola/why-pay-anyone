"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Slider, Stat, Section, Caveat } from "@/components/ui";
import { CeilingChart } from "@/components/Ceiling";
import { usePageState } from "@/components/chat-context";
import { M4_DEFAULTS, simulateM4, type M4Params } from "@/models/m4";
import { mult, pct0, compact } from "@/lib/format";
import fits from "@/data/m1_price_decline_fits.json";
import vol from "@/data/m1_volume_monthly.json";
import conc from "@/data/m5_concentration_monthly.json";

type Fit = { threshold: number; price_first: number; price_last: number; halving_time_months: number; annual_decline_pct: number };
type Vol = { month: string; all_tokens_per_day: number };
type Conc = { month: string; hhi: number; effective_firms: number };

const LENSES = [
  {
    href: "/m4",
    name: "Comparative advantage",
    text: "Even if AI is better at everything, people keep the tasks where they are relatively best, as long as AI capacity is limited.",
    tag: "Wages lab",
  },
  {
    href: "/m1",
    name: "The wage ceiling",
    text: "For a task AI can do, a person's pay cannot stay above what the AI costs. The price of that AI keeps falling.",
    tag: "Prices lab",
  },
  {
    href: "/m4",
    name: "Who buys the output",
    text: "If fewer people earn wages, who buys what is made? Workers and AI owners spend different shares of what they earn.",
    tag: "Wages lab",
  },
  {
    href: "/m1",
    name: "New tasks and Jevons",
    text: "Cheaper intelligence can raise total demand and create new work, as cheaper coal once raised total coal use.",
    tag: "Prices lab",
  },
  {
    href: "/m5",
    name: "Who owns the agents",
    text: "If a few providers sell the intelligence, they may keep much of the gain. Concentration, entry and price competition show how likely that is.",
    tag: "Markets lab",
  },
];

const LABS = [
  { id: "M1", href: "/m1", name: "Prices", q: "How fast is the price of a fixed level of AI capability falling, and does cheaper AI raise total spending?" },
  { id: "M2", href: "/m2", name: "Usage", q: "Which jobs does AI touch, and do independent measures agree?" },
  { id: "M3", href: "/m3", name: "Adoption", q: "Are firms using AI, and is it showing up in hiring?" },
  { id: "M4", href: "/m4", name: "Wages", q: "For a task AI can also do, what happens to pay, jobs and the labour share?" },
  { id: "M5", href: "/m5", name: "Markets", q: "Who sells the intelligence, and how concentrated is it?" },
  { id: "M6", href: "/m6", name: "Growth and policy", q: "What does this mean for growth, inequality, an automation tax and a basic income?" },
  { id: "IN", href: "/india", name: "India", q: "How does India's use of AI compare with what its income predicts?" },
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
  const fall = f120.price_first / f120.price_last;

  return (
    <>
      <section className="mx-auto max-w-[1180px] px-5 pb-8 pt-12 sm:pt-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-6">
          <div>
            <h1>Why pay anyone?</h1>
            <p className="mt-5 text-[1.3rem] leading-snug">
              An AI can already do a growing list of tasks for a few cents. If it does the work for less, why would anyone pay a person to do it?
            </p>
            <p className="mt-3 text-ink-soft">
              This is a lab for that question. It uses public data on prices, usage, jobs and markets, and a small model where you set every dial and watch pay, jobs and
              shares move. Start with the chart: drag the cobalt tab, or move the dials below it.
            </p>
          </div>

          <div className="min-w-0 self-start rounded-[6px] lg:col-start-2 lg:row-span-2 lg:row-start-1 border border-rule bg-surface p-4 sm:p-5">
            <CeilingChart p={p} r={r} height={400} intro onRhoScale={(fac) => set("rho", Math.min(3, Math.max(0.01, p.rho * fac)))} />
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
              <Stat value={r.unbounded ? "no limit" : mult(r.relWage)} label="Real pay, against a world without AI" tone="human" />
              <Stat value={pct0(r.labourShare)} label="Share of income paid as wages" tone="human" />
              <Stat value={pct0(r.aiShare)} label="Of tasks done by AI" tone="ai" />
            </div>
            <p className="ui mt-3 max-w-none text-[0.85rem] text-ink-soft">
              A stylised model, not a forecast. <Link href="/m4">Open the full wages lab</Link> for every dial.
            </p>
          </div>

          <div>
            <div className="mt-6 rounded-[6px] border border-rule bg-surface px-4 py-2">
              <Slider
                label="Price of AI"
                tone="ai"
                value={p.rho}
                min={0.01}
                max={3}
                step={0.001}
                toPos={Math.log10}
                fromPos={(x) => Math.pow(10, x)}
                onChange={(x) => set("rho", x)}
                format={(x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}% of wage`}
                help="All-in cost of a task done with AI, against what a person is paid for it."
              />
              <Slider label="Work AI can do" tone="ai" value={p.A} min={0} max={1} step={0.01} onChange={(x) => set("A", x)} format={pct0} help="Share of tasks AI handles well enough." />
              <Slider label="Swapping one task for another" tone="human" value={p.sigma} min={0.2} max={1.4} step={0.05} onChange={(x) => set("sigma", x)} format={(x) => x.toFixed(2)} help="Below 1, tasks complement each other. Above 1, they substitute." />
            </div>
          </div>
        </div>
      </section>

      <Section className="pt-10">
        <h2 className="max-w-[26ch]">Five ways to answer the question</h2>
        <p className="mt-3 text-ink-soft">Each lens is an old idea in economics, tested against new data.</p>
        <ul className="mt-6 divide-y divide-rule border-y border-rule">
          {LENSES.map((l) => (
            <li key={l.name} className="grid gap-2 py-5 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)_auto] sm:items-baseline sm:gap-8">
              <h3 className="ui text-[1.35rem]">{l.name}</h3>
              <p className="max-w-[62ch]">{l.text}</p>
              <Link href={l.href} className="ui whitespace-nowrap text-[1rem] font-semibold">
                {l.tag}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="pt-10">
        <h2 className="max-w-[26ch]">What the data already says</h2>
        <div className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Stat value={`${Math.round(fall).toLocaleString("en-US")}×`} label="Fall in the cheapest price of GPT-4-level capability" tone="ai" sub={`$${f120.price_first.toFixed(2)} to $${f120.price_last.toFixed(2)} per million tokens, Sep 2023 to Nov 2026`} />
            <p className="ui mt-2 text-[0.92rem] text-ink-soft">
              It halves about every {f120.halving_time_months.toFixed(1)} months. <Link href="/m1">See the prices lab</Link>.
            </p>
          </div>
          <div>
            <Stat value={`${Math.round(growth)}×`} label="Rise in daily AI tokens through OpenRouter" tone="human" sub={`${compact(v[0].all_tokens_per_day)} to ${compact(v[v.length - 1].all_tokens_per_day)} a day, Jan 2025 to Nov 2026`} />
            <p className="ui mt-2 text-[0.92rem] text-ink-soft">Usage grew far faster than prices fell, but a model&apos;s own price cuts do not explain it alone.</p>
          </div>
          <div>
            <Stat value={`${Math.round(cMin.effective_firms)} firms`} label="Equivalent number of equal-sized providers at the least concentrated point" tone="owner" sub={`${cMin.month}; ${Math.round(cEnd.effective_firms)} by ${cEnd.month}`} />
            <p className="ui mt-2 text-[0.92rem] text-ink-soft">
              The market opened up, then narrowed again. <Link href="/m5">See the markets lab</Link>.
            </p>
          </div>
        </div>
      </Section>

      <Section className="pt-10">
        <h2 className="max-w-[26ch]">The labs</h2>
        <ul className="mt-5 divide-y divide-rule border-y border-rule">
          {LABS.map((l) => (
            <li key={l.id}>
              <Link href={l.href} className="grid gap-1 py-4 no-underline hover:bg-ai-soft/50 sm:grid-cols-[3.5rem_minmax(0,220px)_minmax(0,1fr)] sm:items-baseline sm:gap-6 sm:px-2">
                <span className="ui font-semibold text-ai-deep">{l.id}</span>
                <span className="ui text-[1.15rem] font-bold text-ink">{l.name}</span>
                <span className="text-ink-soft">{l.q}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="pt-8">
        <Caveat title="What this is not">
          <p>
            It is not a forecast of jobs. Exposure scores say where AI is used, not who will lose work. Each dataset covers one platform or one country. The models are deliberately simple so every dial can be explained. The{" "}
            <Link href="/data">data page</Link> lists every source and its limits, and the chat panel can answer questions about any chart.
          </p>
        </Caveat>
      </Section>
    </>
  );
}
