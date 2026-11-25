"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Slider, Stat, Section, Caveat } from "@/components/ui";
import { CeilingChart } from "@/components/Ceiling";
import { Marquee, Spark } from "@/components/viz";
import { usePageState } from "@/components/chat-context";
import { M4_DEFAULTS, simulateM4, type M4Params } from "@/models/m4";
import { mult, pct0, compact } from "@/lib/format";
import fits from "@/data/m1_price_decline_fits.json";
import prices from "@/data/m1_price_of_capability.json";
import vol from "@/data/m1_volume_monthly.json";
import conc from "@/data/m5_concentration_monthly.json";
import indiaSummary from "@/data/india_b_summary.json";

type Fit = { threshold: number; price_first: number; price_last: number; halving_time_months: number; annual_decline_pct: number };
type PriceRow = { threshold: number; month: string; price: number };
type Vol = { month: string; all_tokens_per_day: number };
type Conc = { month: string; hhi: number; effective_firms: number };
type Sum = { measure: string; scope: string; label: string; value: number };

type Tone = "ai" | "human" | "owner" | "ok";
const TONE_BG: Record<Tone, string> = { ai: "bg-ai-soft text-ai-deep", human: "bg-human-soft text-human-deep", owner: "bg-owner-soft text-owner", ok: "bg-ok-soft text-ok" };
const TONE_BAR: Record<Tone, string> = { ai: "bg-ai", human: "bg-human", owner: "bg-owner", ok: "bg-ok" };

function Glyph({ kind, tone }: { kind: string; tone: Tone }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${TONE_BG[tone]}`} aria-hidden>
      <svg width="24" height="24" viewBox="0 0 24 24">
        {kind === "advantage" && (
          <>
            <circle cx="9" cy="12" r="5.5" {...p} />
            <circle cx="15.5" cy="12" r="5.5" {...p} />
          </>
        )}
        {kind === "ceiling" && (
          <>
            <path d="M3 5h18" {...p} />
            <path d="M5 9c4 1 8 6 14 10" {...p} />
          </>
        )}
        {kind === "buyers" && (
          <>
            <path d="M5 8a8 8 0 0 1 14 0M19 16a8 8 0 0 1-14 0" {...p} />
            <path d="m19 4 .5 4.4-4.4.1M5 20l-.5-4.4 4.4-.1" {...p} />
          </>
        )}
        {kind === "jevons" && <path d="M5 19v-5M10 19V10M15 19V7M20 19V3" {...p} />}
        {kind === "owners" && (
          <>
            <path d="M12 3a9 9 0 1 0 9 9h-9z" {...p} />
            <path d="M15 3.6A9 9 0 0 1 20.4 9H15z" {...p} />
          </>
        )}
      </svg>
    </span>
  );
}

const LENSES: { href: string; name: string; text: string; tag: string; glyph: string; tone: Tone; span: string }[] = [
  {
    href: "/m4",
    name: "Comparative advantage",
    text: "Even if AI is better at everything, people keep the tasks where they are relatively best, as long as AI capacity is limited.",
    tag: "Wages lab",
    glyph: "advantage",
    tone: "human",
    span: "lg:col-span-2",
  },
  {
    href: "/m1",
    name: "The wage ceiling",
    text: "For a task AI can do, a person's pay cannot stay above what the AI costs. The price of that AI keeps falling.",
    tag: "Prices lab",
    glyph: "ceiling",
    tone: "ai",
    span: "lg:col-span-2",
  },
  {
    href: "/m4",
    name: "Who buys the output",
    text: "If fewer people earn wages, who buys what is made? Workers and AI owners spend different shares of what they earn.",
    tag: "Wages lab",
    glyph: "buyers",
    tone: "ok",
    span: "lg:col-span-2",
  },
  {
    href: "/m1",
    name: "New tasks and Jevons",
    text: "Cheaper intelligence can raise total demand and create new work, as cheaper coal once raised total coal use.",
    tag: "Prices lab",
    glyph: "jevons",
    tone: "ai",
    span: "lg:col-span-3",
  },
  {
    href: "/m5",
    name: "Who owns the agents",
    text: "If a few providers sell the intelligence, they may keep much of the gain. Concentration, entry and price competition show how likely that is.",
    tag: "Markets lab",
    glyph: "owners",
    tone: "owner",
    span: "lg:col-span-3",
  },
];

const LABS: { id: string; href: string; name: string; q: string; tone: Tone }[] = [
  { id: "M1", href: "/m1", name: "Prices", q: "How fast is the price of a fixed level of AI capability falling, and does cheaper AI raise total spending?", tone: "ai" },
  { id: "M2", href: "/m2", name: "Usage", q: "Which jobs does AI touch, and do independent measures agree?", tone: "ai" },
  { id: "M3", href: "/m3", name: "Adoption", q: "Are firms using AI, and is it showing up in hiring?", tone: "ok" },
  { id: "M4", href: "/m4", name: "Wages", q: "For a task AI can also do, what happens to pay, jobs and the labour share?", tone: "human" },
  { id: "M5", href: "/m5", name: "Markets", q: "Who sells the intelligence, and how concentrated is it?", tone: "owner" },
  { id: "M6", href: "/m6", name: "Growth and policy", q: "What does this mean for growth, inequality, an automation tax and a basic income?", tone: "owner" },
  { id: "IN", href: "/india", name: "India", q: "How does India's use of AI compare with what its income predicts, and how many Indian workers are in exposed jobs?", tone: "human" },
];

function Fact({ value, text }: { value: string; text: string }) {
  return (
    <span className="ui flex items-baseline gap-3 text-[0.98rem] text-on-night-soft">
      <b className="num text-[1.35rem] text-white">{value}</b>
      {text}
    </span>
  );
}

export default function Home() {
  const [p, setP] = useState<M4Params>({ ...M4_DEFAULTS, A: 0.5, rho: 0.3 });
  const r = useMemo(() => simulateM4(p), [p]);
  const set = <K extends keyof M4Params>(k: K, v: M4Params[K]) => setP((q) => ({ ...q, [k]: v }));
  usePageState("home", { "price of AI as share of wage": p.rho, "share of tasks AI can do": p.A, "elasticity between tasks": p.sigma, "labour share": +r.labourShare.toFixed(3), "real wage vs no-AI world": +r.relWage.toFixed(3) });

  const f120 = (fits as Fit[]).find((f) => f.threshold === 120)!;
  const priceSeries = (prices as PriceRow[]).filter((x) => x.threshold === 120).map((x) => x.price);
  const v = vol as Vol[];
  const c = conc as Conc[];
  const growth = v[v.length - 1].all_tokens_per_day / v[0].all_tokens_per_day;
  const cMin = c.reduce((a, b) => (b.hhi < a.hhi ? b : a));
  const cEnd = c[c.length - 1];
  const fall = f120.price_first / f120.price_last;
  const topThird = (indiaSummary as Sum[]).find((x) => x.measure === "ms" && x.scope === "all" && x.label.startsWith("share of Indian workers above the US top-third"))?.value ?? 6;

  const facts: ReactNode[] = [
    <Fact key="a" value={`$${f120.price_first.toFixed(2)} → $${f120.price_last.toFixed(2)}`} text="per million tokens, GPT-4-level capability, Sep 2023 to Nov 2026" />,
    <Fact key="b" value={`${Math.round(growth)}×`} text="more daily AI tokens on OpenRouter since Jan 2025" />,
    <Fact key="c" value={`${Math.round(f120.halving_time_months * 10) / 10} months`} text="for the price of that capability to halve" />,
    <Fact key="d" value={`${Math.round(topThird)}%`} text="of Indian workers in the most exposed third of US jobs" />,
    <Fact key="e" value={`${Math.round(cMin.effective_firms)} → ${Math.round(cEnd.effective_firms)}`} text="equal-sized providers, least to most recent concentration" />,
    <Fact key="f" value="61" text="economics ideas, old and new, in plain words" />,
  ];

  return (
    <>
      <section className="night on-night">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 pb-12 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:items-center lg:gap-14 lg:pb-16">
          <div>
            <h1 className="max-w-[9ch] text-[clamp(3.6rem,11.5vw,8.2rem)] leading-[0.92]">
              <span className="rise block" style={{ ["--d" as string]: "0ms" }}>
                Why pay
              </span>
              <span className="rise block" style={{ ["--d" as string]: "120ms" }}>
                anyone?
              </span>
            </h1>
            <p className="rise mt-6 max-w-[40ch] text-[1.2rem] leading-snug text-on-night sm:text-[1.35rem]" style={{ ["--d" as string]: "260ms" }}>
              An AI can already do a growing list of tasks for a few cents. If it does the work for less, why would anyone pay a person to do it?
            </p>
            <p className="rise mt-4 max-w-[46ch] text-[1.02rem] leading-relaxed text-on-night-soft" style={{ ["--d" as string]: "340ms" }}>
              This is a lab for that question: public data on prices, usage, jobs and markets, and a small model where you set every dial and watch pay, jobs and shares move.
            </p>
            <div className="rise mt-8 flex flex-wrap gap-3" style={{ ["--d" as string]: "420ms" }}>
              <a href="#model" className="btn btn-light">
                Play with the model
              </a>
              <Link href="/m1" className="btn btn-ghost">
                See the evidence
              </Link>
            </div>
          </div>

          <div id="model" className="panel min-w-0 scroll-mt-24 p-4 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] sm:p-6">
            <CeilingChart p={p} r={r} height={340} intro onRhoScale={(fac) => set("rho", Math.min(3, Math.max(0.01, p.rho * fac)))} />
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-rule pt-4">
              <Stat value={r.unbounded ? "no limit" : mult(r.relWage)} label="Real pay vs a world without AI" tone="human" />
              <Stat value={pct0(r.labourShare)} label="Share of income paid as wages" tone="human" />
              <Stat value={pct0(r.aiShare)} label="Of tasks done by AI" tone="ai" />
            </div>
            <div className="mt-3 border-t border-rule pt-1">
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
            <p className="ui mt-1 max-w-none text-[0.8rem] text-ink-faint">
              A stylised model, not a forecast. <Link href="/m4">Open the full wages lab</Link> for every dial.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 py-4">
          <Marquee items={facts} label="Headline figures from the project" seconds={80} />
        </div>
      </section>

      <Section className="pt-14 sm:pt-20">
        <h2 className="max-w-[20ch]">Five ways to answer the question</h2>
        <p className="mt-3 max-w-[54ch] text-ink-soft">Each lens is an old idea in economics, tested against new data.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {LENSES.map((l) => (
            <li key={l.name} className={l.span}>
              <Link href={l.href} data-reveal className="tile panel flex h-full flex-col gap-4 p-5 no-underline sm:p-6">
                <Glyph kind={l.glyph} tone={l.tone} />
                <div>
                  <h3 className="text-[1.2rem] text-ink">{l.name}</h3>
                  <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-soft">{l.text}</p>
                </div>
                <span className="ui mt-auto text-[0.92rem] font-semibold text-ai-deep">{l.tag}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <section className="mt-12 bg-paper-2 sm:mt-16">
        <div className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8 sm:py-20">
          <h2 className="max-w-[20ch]">What the data already says</h2>
          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            <div data-reveal className="panel flex flex-col p-5 sm:p-7">
              <Stat size="lg" value={`${Math.round(fall).toLocaleString("en-US")}×`} label="Fall in the cheapest price of GPT-4-level capability" tone="ai" sub={`$${f120.price_first.toFixed(2)} to $${f120.price_last.toFixed(2)} per million tokens, Sep 2023 to Nov 2026`} />
              <div className="mt-6">
                <Spark values={priceSeries} log color="var(--ai)" label="Price of GPT-4-level capability over time, on a log scale" />
              </div>
              <p className="ui mt-4 text-[0.92rem] text-ink-soft">
                It halves about every {f120.halving_time_months.toFixed(1)} months. <Link href="/m1">See the prices lab</Link>.
              </p>
            </div>
            <div data-reveal className="panel flex flex-col p-5 sm:p-7">
              <Stat size="lg" value={`${Math.round(growth)}×`} label="Rise in daily AI tokens through OpenRouter" tone="human" sub={`${compact(v[0].all_tokens_per_day)} to ${compact(v[v.length - 1].all_tokens_per_day)} a day, Jan 2025 to Nov 2026`} />
              <div className="mt-6">
                <Spark values={v.map((x) => x.all_tokens_per_day)} color="var(--human)" label="Daily AI tokens through OpenRouter, on a linear scale" />
              </div>
              <p className="ui mt-4 text-[0.92rem] text-ink-soft">Usage grew far faster than prices fell, but a model&apos;s own price cuts do not explain it alone.</p>
            </div>
            <div data-reveal className="panel flex flex-col p-5 sm:p-7">
              <Stat size="lg" value={`${Math.round(cMin.effective_firms)} firms`} label="Equivalent number of equal-sized providers at the least concentrated point" tone="owner" sub={`${cMin.month}; ${Math.round(cEnd.effective_firms)} by ${cEnd.month}`} />
              <div className="mt-6">
                <Spark values={c.map((x) => x.effective_firms)} color="var(--owner)" label="Equivalent number of equal-sized providers over time" />
              </div>
              <p className="ui mt-4 text-[0.92rem] text-ink-soft">
                The market opened up, then narrowed again. <Link href="/m5">See the markets lab</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section className="pt-14 sm:pt-20">
        <h2 className="max-w-[20ch]">The labs</h2>
        <p className="mt-3 max-w-[54ch] text-ink-soft">Six labs and an India lens. Each starts from one question, shows the data, then lets you change the assumptions.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LABS.map((l, i) => (
            <li key={l.id} className={i === LABS.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""}>
              <Link href={l.href} data-reveal className="tile panel group relative flex h-full flex-col overflow-hidden p-5 no-underline sm:p-6">
                <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${TONE_BAR[l.tone]}`} />
                <div className="flex items-baseline justify-between">
                  <span className="mono text-[0.85rem] font-medium text-ink-faint">{l.id}</span>
                  <span aria-hidden className="ui text-[1.2rem] text-ink-faint transition-transform group-hover:translate-x-1">
                    &rarr;
                  </span>
                </div>
                <h3 className="serif mt-3 text-[1.7rem] font-medium leading-tight text-ink">{l.name}</h3>
                <p className="mt-2 text-[0.96rem] leading-relaxed text-ink-soft">{l.q}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="pt-10 sm:pt-14">
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
