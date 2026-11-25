"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Spark } from "@/components/viz";
import { CeilingChart } from "@/components/Ceiling";
import { Slider } from "@/components/ui";
import { usePageState } from "@/components/chat-context";
import { M4_DEFAULTS, simulateM4, type M4Params } from "@/models/m4";
import { m6ParamsForPreset, simulateM6 } from "@/models/m6";
import { monthToYear, compact, mult, pct0 } from "@/lib/format";
import fits from "@/data/m1_price_decline_fits.json";
import prices from "@/data/m1_price_of_capability.json";
import vol from "@/data/m1_volume_monthly.json";
import agr from "@/data/m2_agreement.json";
import btosSum from "@/data/m3_btos_adoption_summary.json";
import btos from "@/data/m3_btos_national.json";
import ev from "@/data/m3_event_study_summary.json";
import conc from "@/data/m5_concentration_monthly.json";
import indiaB from "@/data/india_b_summary.json";

/* ------------------------------------------------------------------ the facts, all read from the project's own tables */

type Fit = { threshold: number; price_first: number; price_last: number; halving_time_months: number };
type PriceRow = { threshold: number; month: string; price: number };
type Vol = { month: string; all_tokens_per_day: number };
type Agr = { measure_a: string; measure_b: string; sample: string; weighting: string; statistic: string; estimate: number; ci_low: number; ci_high: number };
type BtosSum = { geo_type: string; question_id: number; answer: string; first3_mean: number; latest_value: number };
type Btos = { geo_type: string; question_id: number; answer: string; period: number; ref_end: string; estimate_pct: number };
type Ev = { country: string; spec: string; window: string; pct: number; pct_lo: number; pct_hi: number };
type Conc = { month: string; hhi: number; effective_firms: number; leader: string; cr1: number };
type Sum = { measure: string; scope: string; label: string; value: number };

const F120 = (fits as Fit[]).find((f) => f.threshold === 120)!;
const PRICE_SERIES = (prices as PriceRow[]).filter((x) => x.threshold === 120).map((x) => [monthToYear(x.month), x.price] as [number, number]);
const V = vol as Vol[];
const TOKEN_GROWTH = V[V.length - 1].all_tokens_per_day / V[0].all_tokens_per_day;
const AGREE = (agr as Agr[]).find((a) => a.measure_a === "ms_applicability" && a.measure_b === "aei_usage_ratio" && a.sample.startsWith("591") && a.statistic === "spearman" && a.weighting === "unweighted")!;
const AGREE_FAM = (agr as Agr[]).find((a) => a.sample.startsWith("22 SOC") && a.statistic === "spearman" && a.weighting === "unweighted");
const ADOPT = (btosSum as BtosSum[]).find((b) => b.geo_type === "national" && b.question_id === 7 && b.answer === "Yes")!;
const ADOPT_ROWS = (btos as Btos[]).filter((b) => b.question_id === 7 && b.answer === "Yes").sort((a, b) => a.period - b.period);
const POSTINGS = (ev as Ev[]).find((e) => e.country === "US" && e.spec === "tercile_ms" && e.window === "post_all")!;
const C = conc as Conc[];
const C_MIN = C.reduce((a, b) => (b.effective_firms > a.effective_firms ? b : a));
const C_END = C[C.length - 1];
const IND = indiaB as Sum[];
const INDIA_TOP = IND.find((x) => x.measure === "ms" && x.scope === "all" && x.label.startsWith("share of Indian workers above the US top-third"))!.value;
const INDIA_URBAN = IND.find((x) => x.measure === "ms" && x.scope === "sector:urban" && x.label.startsWith("share above"))!.value;
const INDIA_RURAL = IND.find((x) => x.measure === "ms" && x.scope === "sector:rural" && x.label.startsWith("share above"))!.value;

const monthName = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`;
};
const usd = (v: number) => (v >= 1 ? `$${v.toFixed(2)}` : v >= 0.1 ? `$${v.toFixed(2)}` : `$${v.toFixed(3)}`);

/* ------------------------------------------------------------------ steps */

const CHAPTERS = ["Start", "Prices", "Usage", "Adoption", "Wages", "Markets", "Policy", "India", "Your answer"];
const STEPS = [
  { id: "start", ch: 0 },
  { id: "price", ch: 1 },
  { id: "jevons", ch: 1 },
  { id: "agree", ch: 2 },
  { id: "adopt", ch: 3 },
  { id: "postings", ch: 3 },
  { id: "wages", ch: 4 },
  { id: "firms", ch: 5 },
  { id: "policy", ch: 6 },
  { id: "india", ch: 7 },
  { id: "score", ch: 8 },
] as const;
type StepId = (typeof STEPS)[number]["id"];

type Verdict = "spot" | "close" | "off";
type GuessSpec = { min: number; max: number; log?: boolean; step: number; start: number; actual: number; fmt: (v: number) => string; verdict: (g: number) => Verdict; miss: (g: number) => string; label: string };

const byRatio = (g: number, a: number): Verdict => {
  const r = Math.max(g / a, a / g);
  return r <= 1.6 ? "spot" : r <= 4 ? "close" : "off";
};
const byGap = (g: number, a: number, t1: number, t2: number): Verdict => {
  const d = Math.abs(g - a);
  return d <= t1 ? "spot" : d <= t2 ? "close" : "off";
};

const GUESS: Record<"price" | "agree" | "adopt" | "firms" | "india", GuessSpec> = {
  price: {
    label: "Cheapest GPT-4-level price, Nov 2026",
    min: 0.003,
    max: 30,
    log: true,
    step: 0.001,
    start: 3,
    actual: F120.price_last,
    fmt: usd,
    verdict: (g) => byRatio(g, F120.price_last),
    miss: (g) => `${Math.round(Math.max(g / F120.price_last, F120.price_last / g))}× ${g > F120.price_last ? "too high" : "too low"}`,
  },
  agree: {
    label: "Agreement of the two job rankings",
    min: 0,
    max: 1,
    step: 0.01,
    start: 0.5,
    actual: AGREE.estimate,
    fmt: (v) => v.toFixed(2),
    verdict: (g) => byGap(g, AGREE.estimate, 0.08, 0.2),
    miss: (g) => `${Math.abs(g - AGREE.estimate).toFixed(2)} ${g > AGREE.estimate ? "too high" : "too low"}`,
  },
  adopt: {
    label: "US firms using AI",
    min: 0,
    max: 80,
    step: 1,
    start: 40,
    actual: ADOPT.latest_value,
    fmt: (v) => `${Math.round(v)}%`,
    verdict: (g) => byGap(g, ADOPT.latest_value, 4, 10),
    miss: (g) => `${Math.round(Math.abs(g - ADOPT.latest_value))} points ${g > ADOPT.latest_value ? "too high" : "too low"}`,
  },
  firms: {
    label: "Equal-sized AI providers, Nov 2026",
    min: 1,
    max: 25,
    step: 1,
    start: 12,
    actual: C_END.effective_firms,
    fmt: (v) => `${Math.round(v)}`,
    verdict: (g) => byGap(g, C_END.effective_firms, 1.5, 4),
    miss: (g) => `${Math.round(Math.abs(g - C_END.effective_firms))} ${g > C_END.effective_firms ? "too many" : "too few"}`,
  },
  india: {
    label: "Indian workers in the most exposed third of US jobs",
    min: 0,
    max: 60,
    step: 1,
    start: 30,
    actual: INDIA_TOP,
    fmt: (v) => `${Math.round(v)}%`,
    verdict: (g) => byGap(g, INDIA_TOP, 3, 8),
    miss: (g) => `${Math.round(Math.abs(g - INDIA_TOP))} points ${g > INDIA_TOP ? "too high" : "too low"}`,
  },
};

type ChoiceSpec = { label: string; options: { k: string; text: string }[]; correct: string };

/* ------------------------------------------------------------------ small parts */

function Gate(props: { open: boolean; children: ReactNode; hint?: string }) {
  return (
    <div className="relative">
      <div className="gate" data-locked={!props.open}>
        {props.children}
      </div>
      {!props.open && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
          <span className="ui border border-ink bg-paper px-3 py-1.5 text-[0.9rem] font-semibold text-ink">{props.hint ?? "Lock in your answer to see the data"}</span>
        </div>
      )}
    </div>
  );
}

function VerdictChip({ v, text }: { v: Verdict | "right" | "wrong"; text?: string }) {
  const map = {
    spot: ["border-ok bg-ok text-white", "Spot on"],
    close: ["border-owner bg-owner-soft text-ink", "Close"],
    off: ["border-ink bg-paper text-ink", "Off"],
    right: ["border-ok bg-ok text-white", "Right"],
    wrong: ["border-ink bg-paper text-ink", "Not quite"],
  } as const;
  const [cls, label] = map[v];
  return (
    <span className={`ui inline-flex shrink-0 items-center border px-2 py-0.5 text-[0.82rem] font-bold ${cls}`} style={{ borderRadius: "var(--radius)" }}>
      {text ?? label}
    </span>
  );
}

function GuessControl(props: { spec: GuessSpec; locked?: number; onLock: (v: number) => void; children?: ReactNode }) {
  const { spec } = props;
  const [v, setV] = useState(spec.start);
  const [shown, setShown] = useState(false);
  const val = props.locked ?? v;
  const toPos = (x: number) => (spec.log ? Math.log10(x) : x);
  const fromPos = (p: number) => (spec.log ? Math.pow(10, p) : p);
  const lo = toPos(spec.min);
  const hi = toPos(spec.max);
  const pctOf = (x: number) => ((toPos(Math.min(spec.max, Math.max(spec.min, x))) - lo) / (hi - lo)) * 100;
  useEffect(() => {
    if (props.locked === undefined) return;
    const t = window.setTimeout(() => setShown(true), 60);
    return () => window.clearTimeout(t);
  }, [props.locked]);
  const verdict = props.locked !== undefined ? spec.verdict(props.locked) : null;

  return (
    <div className="border border-ink bg-paper-2 p-5 sm:p-6" style={{ borderRadius: "var(--radius)" }} data-noswipe>
      <div className="ui text-[0.85rem] font-semibold text-ink-soft">{props.locked === undefined ? "Your guess" : "You guessed"}</div>
      <div className="num mt-1 text-[3rem] leading-none text-human-deep sm:text-[3.4rem]">{spec.fmt(val)}</div>
      {props.locked === undefined ? (
        <>
          <input
            type="range"
            className="range mt-4"
            aria-label={spec.label}
            min={lo}
            max={hi}
            step={spec.log ? (hi - lo) / 400 : spec.step}
            value={toPos(v)}
            onChange={(e) => setV(fromPos(Number(e.target.value)))}
            style={{ ["--pct" as string]: `${pctOf(v)}%`, ["--fill" as string]: "var(--human)" }}
          />
          <div className="ui mt-1 flex justify-between text-[0.78rem] text-ink-soft">
            <span>{spec.fmt(spec.min)}</span>
            <span>{spec.fmt(spec.max)}</span>
          </div>
          <button type="button" onClick={() => props.onLock(spec.log ? v : Math.round(v / spec.step) * spec.step)} className="btn btn-ink mt-5 w-full sm:w-auto">
            Lock in my guess
          </button>
        </>
      ) : (
        <>
          <div className="relative mt-7 h-12" aria-hidden>
            <div className="absolute inset-x-0 top-[22px] h-[2px] bg-ink" />
            <div className="marker absolute top-0 -translate-x-1/2 text-center" style={{ left: `${pctOf(props.locked)}%` }}>
              <span className="mx-auto block h-4 w-4 rounded-full border-2 border-paper-2 bg-human" style={{ marginTop: 15 }} />
              <span className="ui mt-1 block whitespace-nowrap text-[0.76rem] font-bold text-human-deep">You</span>
            </div>
            <div className="marker absolute top-0 -translate-x-1/2 text-center" style={{ left: `${pctOf(shown ? spec.actual : props.locked)}%` }}>
              <span className="mx-auto block h-4 w-4 border-2 border-paper-2 bg-ai" style={{ marginTop: 15 }} />
              <span className="ui mt-1 block whitespace-nowrap text-[0.76rem] font-bold text-ai">Data</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {verdict && <VerdictChip v={verdict} />}
            <span className="ui text-[0.95rem] text-ink">
              The data says <b className="num">{spec.fmt(spec.actual)}</b>
              {verdict === "off" || verdict === "close" ? <span className="text-ink-soft">; you were {spec.miss(props.locked)}</span> : null}
            </span>
          </div>
          {props.children && <div className="serif mt-4 space-y-3 border-t border-rule pt-3 text-[1.02rem] leading-relaxed text-ink">{props.children}</div>}
        </>
      )}
    </div>
  );
}

function ChoiceControl(props: { spec: ChoiceSpec; locked?: string; onLock: (k: string) => void; children?: ReactNode }) {
  const { spec, locked } = props;
  return (
    <div className="space-y-2.5" data-noswipe role="group" aria-label={spec.label}>
      {spec.options.map((o) => {
        const isPick = locked === o.k;
        const isRight = o.k === spec.correct;
        const state = locked === undefined ? "idle" : isRight ? "right" : isPick ? "wrong" : "dim";
        return (
          <button
            key={o.k}
            type="button"
            disabled={locked !== undefined}
            onClick={() => props.onLock(o.k)}
            className={`ui flex w-full items-center justify-between gap-3 border px-4 py-3.5 text-left text-[1rem] font-semibold transition-colors ${
              state === "idle"
                ? "border-ink bg-paper text-ink hover:bg-paper-2"
                : state === "right"
                  ? "border-ok bg-ok-soft text-ink"
                  : state === "wrong"
                    ? "border-ink bg-paper text-ink"
                    : "border-rule bg-paper text-ink-faint"
            }`}
            style={{ borderRadius: "var(--radius)" }}
          >
            <span className={state === "wrong" ? "line-through decoration-ink/50" : undefined}>{o.text}</span>
            {state === "right" && <VerdictChip v="right" text={isPick ? "Your call, right" : "The data"} />}
            {state === "wrong" && <VerdictChip v="wrong" text="Your call" />}
          </button>
        );
      })}
      {locked !== undefined && props.children && <div className="journey-step serif mt-4 space-y-3 border-t border-rule pt-3 text-[1.02rem] leading-relaxed text-ink">{props.children}</div>}
    </div>
  );
}

function Deeper({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="ui inline-block text-[0.95rem] font-semibold">
      {label}
    </Link>
  );
}

function Frame(props: { kicker: string; title: string; intro: ReactNode; control?: ReactNode; visual?: ReactNode }) {
  const n = props.kicker.match(/Chapter (\d)/)?.[1];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:items-start lg:gap-14">
      <div>
        <p className="sr-only-ui">{props.kicker}</p>
        <div className="flex items-start gap-4">
          {n && (
            <span aria-hidden className="serif text-[3.4rem] font-semibold leading-[0.82] text-human sm:text-[4.2rem]">
              {n}
            </span>
          )}
          <h2 className="text-[clamp(1.9rem,4.4vw,3rem)] leading-[1.06]">{props.title}</h2>
        </div>
        <div className="serif mt-5 max-w-[56ch] space-y-3 text-[1.08rem] leading-relaxed text-ink sm:text-[1.14rem]">{props.intro}</div>
        {props.control && <div className="mt-7">{props.control}</div>}
      </div>
      {props.visual && <div className="lg:sticky lg:top-[calc(var(--nav-h)+5.5rem)]">{props.visual}</div>}
    </div>
  );
}

function Card(props: { title: string; sub?: string; children: ReactNode; source?: string }) {
  return (
    <figure className="rule-top bg-paper pt-3">
      <figcaption>
        <h3 className="ui text-[1rem] font-bold leading-snug">{props.title}</h3>
        {props.sub && <p className="ui mt-1 text-[0.86rem] leading-snug text-ink-soft">{props.sub}</p>}
      </figcaption>
      <div className="mt-4">{props.children}</div>
      {props.source && <p className="ui mt-4 border-t border-rule pt-2 text-[0.76rem] leading-snug text-ink-faint">Source: {props.source}</p>}
    </figure>
  );
}

function Bars(props: { rows: { label: string; value: number; max: number; color: string; text: string }[] }) {
  return (
    <ul className="space-y-4">
      {props.rows.map((r) => (
        <li key={r.label}>
          <div className="ui flex justify-between gap-3 text-[0.92rem]">
            <span className="text-ink">{r.label}</span>
            <span className="num text-ink">{r.text}</span>
          </div>
          <div className="mt-1.5 h-3 bg-paper-2">
            <div className="h-full transition-[width] duration-700" style={{ width: `${Math.max(1.5, (r.value / r.max) * 100)}%`, background: r.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ the journey */

const STORE = "wpa-journey";
type Answers = Partial<Record<StepId, number | string>>;

export default function Journey() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [play, setPlay] = useState<M4Params>({ ...M4_DEFAULTS, A: 0.5, rho: 0.3 });
  const [scenario, setScenario] = useState(2);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const visualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? "{}");
      if (s && typeof s === "object") setAnswers(s);
    } catch {}
    const h = parseInt(window.location.hash.slice(1), 10);
    if (Number.isFinite(h) && h >= 0 && h < STEPS.length) setStep(h);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(answers));
    } catch {}
  }, [answers]);

  const go = useCallback(
    (n: number) => {
      const t = Math.max(0, Math.min(STEPS.length - 1, n));
      if (t === step) return;
      setDir(t > step ? 1 : -1);
      setStep(t);
      window.history.replaceState(null, "", `#${t}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [step],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.key === "ArrowRight") go(step + 1);
      if (e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step]);

  const lock = (id: StepId, v: number | string) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    if (window.innerWidth < 1024) window.setTimeout(() => visualRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 450);
  };

  const r = useMemo(() => simulateM4(play), [play]);
  const base = useMemo(() => simulateM4({ ...M4_DEFAULTS, A: 0.5, rho: 0.3 }), []);
  const worlds = useMemo(
    () =>
      [
        { name: "Tasks complement (low substitution)", label: "AI helps workers" },
        { name: "USA baseline (calibrated)", label: "US calibration" },
        { name: "Tasks substitute (high substitution)", label: "AI replaces workers" },
        { name: "Demand failure (Keynes), high substitution", label: "Replaces workers, demand falls short" },
      ].map((w) => {
        const res = simulateM6(m6ParamsForPreset(w.name));
        return { ...w, tax: res.c.optimal_tax, gain: res.c.optimal_gain_pct };
      }),
    [],
  );

  const cur = STEPS[step];
  usePageState("journey", {
    step: step + 1,
    chapter: CHAPTERS[cur.ch],
    ...Object.fromEntries(Object.entries(answers).map(([k, v]) => [`answer ${k}`, typeof v === "number" ? +v.toFixed(3) : v])),
  });

  const jevonsCorrect = TOKEN_GROWTH >= 100 ? "100" : TOKEN_GROWTH >= 10 ? "10" : TOKEN_GROWTH >= 1 ? "1" : "fell";
  const postingsCorrect = POSTINGS.pct_hi < 0 ? "lower" : POSTINGS.pct_lo > 0 ? "higher" : "same";
  const wagesCorrect = base.relWage > 1.05 ? "higher" : base.relWage < 0.95 ? "lower" : "same";
  const comp = worlds[0];
  const sub = worlds[2];
  const policyCorrect = comp.gain < 0.5 && sub.gain > 1 ? "depends" : sub.gain > 1 ? "always" : "never";

  const CHOICES: Record<"jevons" | "postings" | "wages" | "policy", ChoiceSpec> = {
    jevons: {
      label: "Change in daily AI use",
      options: [
        { k: "fell", text: "It fell" },
        { k: "1", text: "It rose, but less than 10 times" },
        { k: "10", text: "It rose 10 to 100 times" },
        { k: "100", text: "It rose more than 100 times" },
      ],
      correct: jevonsCorrect,
    },
    postings: {
      label: "Postings in AI-exposed jobs",
      options: [
        { k: "higher", text: "Higher than in the least exposed jobs" },
        { k: "same", text: "About the same" },
        { k: "lower", text: "Lower than in the least exposed jobs" },
      ],
      correct: postingsCorrect,
    },
    wages: {
      label: "Real pay",
      options: [
        { k: "lower", text: "Lower than without AI" },
        { k: "same", text: "About the same" },
        { k: "higher", text: "Higher than without AI" },
      ],
      correct: wagesCorrect,
    },
    policy: {
      label: "Automation tax",
      options: [
        { k: "always", text: "Yes, by a lot, whatever AI does" },
        { k: "depends", text: "Only when AI replaces workers" },
        { k: "never", text: "No, it never helps" },
      ],
      correct: policyCorrect,
    },
  };

  const num = (k: StepId) => (typeof answers[k] === "number" ? (answers[k] as number) : undefined);
  const str = (k: StepId) => (typeof answers[k] === "string" ? (answers[k] as string) : undefined);

  const gateVisual = (open: boolean, node: ReactNode, hint?: string) => (
    <div ref={visualRef} className="scroll-mt-[calc(var(--nav-h)+4.5rem)]">
      <Gate open={open} hint={hint}>
        {node}
      </Gate>
    </div>
  );

  let body: ReactNode = null;
  switch (cur.id) {
    case "start":
      body = (
        <Frame
          kicker="Guided reading"
          title="Before the data, your instinct."
          intro={
            <>
              <p>
                Each chapter asks one question about AI and the economy. Make a guess or a call, lock it in, and the project&apos;s data answers. At the end you get a scorecard and the short answer to the big question.
              </p>
              <p>Use the buttons below, the arrow keys, or swipe. Every chapter links to its full lab if you want to go deeper.</p>
            </>
          }
          control={
            <button type="button" onClick={() => go(1)} className="btn btn-ink">
              Begin with prices
            </button>
          }
          visual={
            <ol className="border-t border-ink">
              {CHAPTERS.slice(1, 8).map((c, i) => (
                <li key={c}>
                  <button type="button" onClick={() => go(STEPS.findIndex((s) => s.ch === i + 1))} className="entry flex w-full items-baseline gap-4 border-b border-rule py-3 text-left">
                    <span className="serif w-7 shrink-0 text-[1.5rem] font-semibold leading-none text-human">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="entry-title serif block text-[1.2rem] font-semibold">{c}</span>
                      <span className="ui block text-[0.88rem] text-ink-soft">
                        {
                          [
                            "How cheap did intelligence get, and did use explode?",
                            "Do two AI companies agree on which jobs use AI?",
                            "How many firms use AI, and is hiring changing?",
                            "What happens to pay when AI can do the task?",
                            "How many companies sell the intelligence?",
                            "Does taxing AI income help?",
                            "How many Indian workers are exposed?",
                          ][i]
                        }
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          }
        />
      );
      break;

    case "price":
      body = (
        <Frame
          kicker="Chapter 1 of 7, Prices"
          title="How cheap did GPT-4-level AI get?"
          intro={
            <p>
              In September 2023 the cheapest model as capable as GPT-4 cost <b>{usd(F120.price_first)}</b> per million tokens, roughly 750,000 words of text. What did the cheapest model at that level cost in November 2026?
            </p>
          }
          control={
            <GuessControl spec={GUESS.price} locked={num("price")} onLock={(v) => lock("price", v)}>
              <p>
                That is <b>{Math.round(F120.price_first / F120.price_last).toLocaleString("en-US")} times cheaper</b> in a little over three years. The price of a fixed level of capability halved about every {F120.halving_time_months.toFixed(1)} months.
              </p>
              <Deeper href="/m1" label="Go deeper in the Prices lab" />
            </GuessControl>
          }
          visual={gateVisual(
            num("price") !== undefined,
            <Card title="Cheapest price of GPT-4-level capability" sub="Dollars per million tokens, log scale. Each step down is a new cheaper model." source="Epoch AI capability scores; list prices from the LiteLLM price file.">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="num text-[1.6rem] leading-none text-ink">{usd(F120.price_first)}</div>
                  <div className="ui mt-1 text-[0.8rem] text-ink-faint">September 2023</div>
                </div>
                <div className="text-right">
                  <div className="num text-[1.6rem] leading-none text-ai">{usd(F120.price_last)}</div>
                  <div className="ui mt-1 text-[0.8rem] text-ink-faint">November 2026</div>
                </div>
              </div>
              <div className="mt-4">
                <Spark values={PRICE_SERIES.map((x) => x[1])} log color="var(--ai)" height={200} label="Cheapest price of GPT-4-level AI over time, log scale" />
              </div>
              <p className="ui mt-3 text-[0.85rem] text-ink-soft">
                {Math.round(F120.price_first / F120.price_last).toLocaleString("en-US")} times cheaper. On this log scale each equal step down is the same percentage cut.
              </p>
            </Card>,
          )}
        />
      );
      break;

    case "jevons":
      body = (
        <Frame
          kicker="Chapter 1 of 7, Prices"
          title="When AI got cheaper, did people use more of it?"
          intro={
            <p>
              This is the Jevons question: when coal got cheaper in the 1800s, Britain burned more coal, not less. From January 2025 to November 2026, how did daily AI use through OpenRouter change?
            </p>
          }
          control={
            <ChoiceControl spec={CHOICES.jevons} locked={str("jevons")} onLock={(k) => lock("jevons", k)}>
              <p>
                Daily tokens rose <b>{Math.round(TOKEN_GROWTH)} times</b>, from {compact(V[0].all_tokens_per_day)} to {compact(V[V.length - 1].all_tokens_per_day)} a day. Use grew far faster than prices fell, but a model&apos;s own price cuts explain only part of it: new users and new uses drive the rest.
              </p>
              <Deeper href="/m1" label="See the spending test in the Prices lab" />
            </ChoiceControl>
          }
          visual={gateVisual(
            str("jevons") !== undefined,
            <Card title="Daily AI tokens through OpenRouter" sub={`January 2025 to November 2026, ${compact(V[0].all_tokens_per_day)} to ${compact(V[V.length - 1].all_tokens_per_day)} a day`} source="OpenRouter rankings (CC BY 4.0). One platform's traffic, not the whole market.">
              <div className="num text-[3rem] leading-none text-human-deep">{Math.round(TOKEN_GROWTH)}×</div>
              <div className="mt-5">
                <Spark values={V.map((x) => x.all_tokens_per_day)} color="var(--human)" height={150} label="Daily tokens over time" />
              </div>
            </Card>,
          )}
        />
      );
      break;

    case "agree":
      body = (
        <Frame
          kicker="Chapter 2 of 7, Usage"
          title="Do two AI companies agree on which jobs use AI?"
          intro={
            <p>
              Microsoft measured which jobs Copilot helps with. Anthropic measured what people ask Claude about. Rank 591 US occupations both ways: how closely do the two rankings match? 0 means no relation, 1 means the same order.
            </p>
          }
          control={
            <GuessControl spec={GUESS.agree} locked={num("agree")} onLock={(v) => lock("agree", v)}>
              <p>
                The rank correlation is {AGREE.estimate.toFixed(2)} (95% range {AGREE.ci_low.toFixed(2)} to {AGREE.ci_high.toFixed(2)}). Across 22 job families it is {AGREE_FAM?.estimate.toFixed(2)}: they agree on the big picture, computer, writing and office work lead, and split on the details.
              </p>
              <Deeper href="/m2" label="Find any job in the Usage lab" />
            </GuessControl>
          }
          visual={gateVisual(
            num("agree") !== undefined,
            <Card title="How well the two rankings agree" sub="Spearman rank correlation, from 0 (none) to 1 (same order)" source="Microsoft Working with AI (CC BY 4.0); Anthropic Economic Index (CC BY).">
              <Bars
                rows={[
                  { label: "Across 591 occupations", value: AGREE.estimate, max: 1, color: "var(--ai)", text: AGREE.estimate.toFixed(2) },
                  ...(AGREE_FAM ? [{ label: "Across 22 job families", value: AGREE_FAM.estimate, max: 1, color: "var(--ai-deep)", text: AGREE_FAM.estimate.toFixed(2) }] : []),
                  ...(num("agree") !== undefined ? [{ label: "Your guess", value: num("agree") as number, max: 1, color: "var(--human)", text: (num("agree") as number).toFixed(2) }] : []),
                ]}
              />
            </Card>,
          )}
        />
      );
      break;

    case "adopt":
      body = (
        <Frame
          kicker="Chapter 3 of 7, Adoption"
          title="How many US firms use AI?"
          intro={
            <p>
              Every two weeks the US Census Bureau asks firms whether they used AI to produce goods or services. What share said yes in the latest survey, the two weeks to {monthName(ADOPT_ROWS[ADOPT_ROWS.length - 1].ref_end.slice(0, 7))}?
            </p>
          }
          control={
            <GuessControl spec={GUESS.adopt} locked={num("adopt")} onLock={(v) => lock("adopt", v)}>
              <p>
                {Math.round(ADOPT.latest_value)}% said yes, up from about {Math.round(ADOPT.first3_mean)}% in the first surveys of the series ({monthName(ADOPT_ROWS[0].ref_end.slice(0, 7))}). Steady, not explosive.
              </p>
              <Deeper href="/m3" label="Compare sectors and states in the Adoption lab" />
            </GuessControl>
          }
          visual={gateVisual(
            num("adopt") !== undefined,
            <Card title="US firms using AI, last two weeks" sub={`${ADOPT_ROWS.length} surveys, ${monthName(ADOPT_ROWS[0].ref_end.slice(0, 7))} to ${monthName(ADOPT_ROWS[ADOPT_ROWS.length - 1].ref_end.slice(0, 7))}`} source="US Census Bureau, Business Trends and Outlook Survey.">
              <div className="num text-[3rem] leading-none text-ok">{Math.round(ADOPT.latest_value)}%</div>
              <div className="mt-5">
                <Spark values={ADOPT_ROWS.map((x) => x.estimate_pct)} color="var(--ok)" height={150} label="Share of firms using AI over time" />
              </div>
            </Card>,
          )}
        />
      );
      break;

    case "postings":
      body = (
        <Frame
          kicker="Chapter 3 of 7, Adoption"
          title="Are AI-exposed jobs being hired less?"
          intro={
            <p>
              Indeed counts job postings by type of work. Compare the third of job categories most exposed to AI with the third least exposed, since ChatGPT launched in late 2022. Postings in the most exposed third are&hellip;
            </p>
          }
          control={
            <ChoiceControl spec={CHOICES.postings} locked={str("postings")} onLock={(k) => lock("postings", k)}>
              <p>
                About <b>{Math.round(Math.abs(POSTINGS.pct))}% lower</b> (95% range {Math.round(Math.abs(POSTINGS.pct_hi))}% to {Math.round(Math.abs(POSTINGS.pct_lo))}% lower). But the gap began opening before ChatGPT launched, so this is a pattern, not proof that AI caused it.
              </p>
              <Deeper href="/m3" label="See the event study in the Adoption lab" />
            </ChoiceControl>
          }
          visual={gateVisual(
            str("postings") !== undefined,
            <Card title="Job postings since ChatGPT, most against least exposed" sub="Difference in postings, percent, with the 95% range" source="Indeed Hiring Lab job postings (CC BY 4.0); exposure from Microsoft's measure.">
              <svg viewBox="0 0 320 150" className="w-full" role="img" aria-label={`Postings in the most exposed third are ${Math.round(Math.abs(POSTINGS.pct))} percent lower`}>
                <line x1="20" x2="300" y1="40" y2="40" stroke="var(--ink-faint)" strokeDasharray="4 4" />
                <text x="300" y="32" textAnchor="end" fontSize="12" fill="var(--ink-soft)" className="ui">Least exposed third = 0</text>
                {(() => {
                  const y = (p: number) => 40 + (-p / 40) * 100;
                  return (
                    <g>
                      <rect x="120" y="40" width="80" height={y(POSTINGS.pct) - 40} rx="6" fill="var(--ai)" />
                      <line x1="160" x2="160" y1={y(POSTINGS.pct_hi)} y2={y(POSTINGS.pct_lo)} stroke="var(--ink)" strokeWidth="2" />
                      <line x1="150" x2="170" y1={y(POSTINGS.pct_lo)} y2={y(POSTINGS.pct_lo)} stroke="var(--ink)" strokeWidth="2" />
                      <line x1="150" x2="170" y1={y(POSTINGS.pct_hi)} y2={y(POSTINGS.pct_hi)} stroke="var(--ink)" strokeWidth="2" />
                      <text x="210" y={y(POSTINGS.pct) + 4} fontSize="20" fontWeight="700" fill="var(--ai-deep)" className="num">
                        {"\u2212"}{Math.abs(Math.round(POSTINGS.pct))}%
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </Card>,
          )}
        />
      );
      break;

    case "wages":
      body = (
        <Frame
          kicker="Chapter 4 of 7, Wages"
          title="AI can do half the tasks at 30% of a wage. What happens to pay?"
          intro={
            <p>
              In the project&apos;s task model, each task goes to whoever does it cheaper, a person or an AI. Compared with a world without AI, real pay for people is&hellip;
            </p>
          }
          control={
            <ChoiceControl spec={CHOICES.wages} locked={str("wages")} onLock={(k) => lock("wages", k)}>
              <p>
                In the model real pay rises to <b>{mult(base.relWage)}</b> its no-AI level, because cheap AI makes everything people buy cheaper. But the share of income paid as wages falls to <b>{pct0(base.labourShare)}</b>. Pay and the wage share can move in opposite directions.
              </p>
              <p>Now set the dials yourself and watch the chart.</p>
              <div className="panel p-4">
                <Slider label="Price of AI" tone="ai" value={play.rho} min={0.01} max={3} step={0.001} toPos={Math.log10} fromPos={(x) => Math.pow(10, x)} onChange={(x) => setPlay((q) => ({ ...q, rho: x }))} format={(x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}% of wage`} />
                <Slider label="Work AI can do" tone="ai" value={play.A} min={0} max={1} step={0.01} onChange={(x) => setPlay((q) => ({ ...q, A: x }))} format={pct0} />
              </div>
              <Deeper href="/m4" label="Every dial is in the Wages lab" />
            </ChoiceControl>
          }
          visual={gateVisual(
            str("wages") !== undefined,
            <Card title="The ceiling on pay, task by task" sub="Red: done by a person. Blue: done by AI, its cost cut to the AI price. Drag the AI price tab.">
              <CeilingChart p={play} r={r} height={300} onRhoScale={(f) => setPlay((q) => ({ ...q, rho: Math.min(3, Math.max(0.01, q.rho * f)) }))} />
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-rule pt-4">
                <div>
                  <div className="num text-[1.7rem] leading-none text-human-deep">{r.unbounded ? "no limit" : mult(r.relWage)}</div>
                  <div className="ui mt-1 text-[0.8rem] text-ink-soft">Real pay vs no AI</div>
                </div>
                <div>
                  <div className="num text-[1.7rem] leading-none text-human-deep">{pct0(r.labourShare)}</div>
                  <div className="ui mt-1 text-[0.8rem] text-ink-soft">Wage share</div>
                </div>
                <div>
                  <div className="num text-[1.7rem] leading-none text-ai">{pct0(r.aiShare)}</div>
                  <div className="ui mt-1 text-[0.8rem] text-ink-soft">Tasks done by AI</div>
                </div>
              </div>
            </Card>,
            "Make your call to open the model",
          )}
        />
      );
      break;

    case "firms":
      body = (
        <Frame
          kicker="Chapter 5 of 7, Markets"
          title="How many companies really sell the intelligence?"
          intro={
            <p>
              Measure the market for AI models on OpenRouter by share of tokens. If it were split among equal-sized firms, how many firms would give the same concentration in November 2026?
            </p>
          }
          control={
            <GuessControl spec={GUESS.firms} locked={num("firms")} onLock={(v) => lock("firms", v)}>
              <p>
                About <b>{C_END.effective_firms.toFixed(1)}</b> (HHI {Math.round(C_END.hhi).toLocaleString("en-US")}), with {C_END.leader} the largest at {Math.round(C_END.cr1 * 100)}%. In {monthName(C_MIN.month)} it was {C_MIN.effective_firms.toFixed(1)}: the market opened up, then narrowed again. The leader changed several times.
              </p>
              <Deeper href="/m5" label="Watch shares month by month in the Markets lab" />
            </GuessControl>
          }
          visual={gateVisual(
            num("firms") !== undefined,
            <Card title="Equivalent number of equal-sized providers" sub="1 divided by the Herfindahl index of token shares, by firm, monthly" source="OpenRouter rankings (CC BY 4.0), top 50 models per day.">
              <div className="num text-[3rem] leading-none text-owner">{C_END.effective_firms.toFixed(1)}</div>
              <div className="mt-5">
                <Spark values={C.map((x) => x.effective_firms)} color="var(--owner)" height={150} label="Equivalent number of firms over time" />
              </div>
            </Card>,
          )}
        />
      );
      break;

    case "policy":
      body = (
        <Frame
          kicker="Chapter 6 of 7, Policy"
          title="Should AI income be taxed to pay everyone a basic income?"
          intro={
            <p>
              In the growth model, a tax on AI owners&apos; income is paid out to everyone in equal shares. Set at its best rate, does that make people better off?
            </p>
          }
          control={
            <ChoiceControl spec={CHOICES.policy} locked={str("policy")} onLock={(k) => lock("policy", k)}>
              <p>
                It depends on how AI and workers relate. When AI helps workers, the best tax gains almost nothing ({comp.gain.toFixed(1)}% of welfare). When AI replaces workers, the best tax, about {Math.round(sub.tax * 100)}%, gains {sub.gain.toFixed(1)}%, and {worlds[3].gain.toFixed(1)}% if demand also falls short. Pick a world on the right.
              </p>
              <Deeper href="/m6" label="Set every assumption in the Growth and policy lab" />
            </ChoiceControl>
          }
          visual={gateVisual(
            str("policy") !== undefined,
            <Card title="Welfare gain from the best automation tax" sub="Percent, in four model worlds. Tap a world." source="Project growth model (M6); scenarios, not forecasts.">
              <div className="hscroll -mx-1 flex gap-2 px-1 pb-3" data-noswipe>
                {worlds.map((w, i) => (
                  <button key={w.name} type="button" onClick={() => setScenario(i)} className={`ui shrink-0 whitespace-nowrap border px-3 py-1.5 text-[0.85rem] font-semibold ${scenario === i ? "border-ink bg-ink text-white" : "border-rule text-ink hover:border-ink"}`}
                    style={{ borderRadius: "var(--radius)" }}>
                    {w.label}
                  </button>
                ))}
              </div>
              <Bars rows={worlds.map((w, i) => ({ label: w.label, value: Math.max(0, w.gain), max: Math.max(...worlds.map((x) => x.gain)), color: i === scenario ? "var(--owner)" : "var(--rule)", text: `${w.gain.toFixed(1)}%` }))} />
              <p className="ui mt-4 border-t border-rule pt-3 text-[0.9rem] text-ink">
                <b>{worlds[scenario].label}:</b> best tax {Math.round(worlds[scenario].tax * 100)}% of AI income, welfare gain {worlds[scenario].gain.toFixed(1)}%.
              </p>
            </Card>,
          )}
        />
      );
      break;

    case "india":
      body = (
        <Frame
          kicker="Chapter 7 of 7, India"
          title="How many Indian workers are in the jobs AI touches most?"
          intro={
            <p>
              Take the third of US jobs most exposed to AI, by Microsoft&apos;s measure. One in three US workers is in them by definition. Using India&apos;s labour force survey (PLFS 2025), what share of India&apos;s workers are in the same kinds of jobs?
            </p>
          }
          control={
            <GuessControl spec={GUESS.india} locked={num("india")} onLock={(v) => lock("india", v)}>
              <p>
                About <b>{Math.round(INDIA_TOP)}%</b>. Crop growing, farm and construction labour and small shop work dominate India&apos;s job mix, and AI applies least to work done with hands. Urban workers {Math.round(INDIA_URBAN)}%, rural {Math.round(INDIA_RURAL)}%.
              </p>
              <Deeper href="/india" label="Filter by sector, sex and type of work on the India page" />
            </GuessControl>
          }
          visual={gateVisual(
            num("india") !== undefined,
            <Card title="Workers in the most exposed third of US jobs" sub="Share of all workers" source="PLFS 2025 first-visit unit-level data (MoSPI); exposure from Microsoft. Own calculations.">
              <Bars
                rows={[
                  { label: "United States, by definition", value: 33.3, max: 40, color: "var(--ai)", text: "33%" },
                  { label: "India, all workers", value: INDIA_TOP, max: 40, color: "var(--human)", text: `${INDIA_TOP.toFixed(1)}%` },
                  { label: "India, urban", value: INDIA_URBAN, max: 40, color: "var(--human-deep)", text: `${INDIA_URBAN.toFixed(1)}%` },
                  { label: "India, rural", value: INDIA_RURAL, max: 40, color: "var(--human-deep)", text: `${INDIA_RURAL.toFixed(1)}%` },
                ]}
              />
            </Card>,
          )}
        />
      );
      break;

    case "score": {
      const gs = (["price", "agree", "adopt", "firms", "india"] as const).map((k) => ({ k, spec: GUESS[k], g: num(k) }));
      const cs = (["jevons", "postings", "wages", "policy"] as const).map((k) => ({ k, spec: CHOICES[k], c: str(k) }));
      const good = gs.filter((x) => x.g !== undefined && x.spec.verdict(x.g) !== "off").length;
      const answeredG = gs.filter((x) => x.g !== undefined).length;
      const right = cs.filter((x) => x.c === x.spec.correct).length;
      const answeredC = cs.filter((x) => x.c !== undefined).length;
      body = (
        <Frame
          kicker="Conclusion"
          title="So, why pay anyone?"
          intro={
            <ol className="space-y-4">
              {[
                ["Because AI can do only some of the work.", "People keep the tasks where they are relatively best. As AI makes the rest cheaper, those tasks are worth more."],
                ["Because price is not what holds AI back.", "A million tokens for an hour of work cost well under 1% of average pay. What binds is how much work AI can do well, and how easily tasks substitute."],
                ["But who gains is a choice.", "If AI replaces workers and a few firms sell it, owners take more of the income. Taxes, competition and new tasks decide how it is shared."],
              ].map(([a, b], i) => (
                <li key={a} className="flex gap-4">
                  <span className="serif w-7 shrink-0 text-[1.8rem] font-semibold leading-none text-human">{i + 1}</span>
                  <span>
                    <b className="block">{a}</b>
                    {b}
                  </span>
                </li>
              ))}
            </ol>
          }
          control={
            <div className="flex flex-wrap gap-3">
              <Link href="/m1" className="btn btn-ink">
                Read chapter 1
              </Link>
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  go(0);
                }}
                className="btn btn-ghost"
              >
                Start again
              </button>
            </div>
          }
          visual={
            <div className="rule-top pt-3">
              <h3 className="ui text-[1.05rem] font-bold">Your scorecard</h3>
              <p className="ui mt-1 text-[0.9rem] text-ink-soft">
                {answeredG + answeredC === 0
                  ? "You skipped every question. Go back and guess; it is more fun."
                  : `Spot on or close on ${good} of ${answeredG} guesses, and ${right} of ${answeredC} calls right.`}
              </p>
              <ul className="mt-4 divide-y divide-rule">
                {gs.map(({ k, spec, g }) => {
                  const v = g !== undefined ? spec.verdict(g) : null;
                  return (
                    <li key={k} className="ui flex items-center justify-between gap-3 py-2.5 text-[0.9rem]">
                      <span className="min-w-0">
                        <span className="block text-ink">{spec.label}</span>
                        <span className="block text-[0.8rem] text-ink-faint">
                          You {g !== undefined ? spec.fmt(g) : "skipped"}, data {spec.fmt(spec.actual)}
                        </span>
                      </span>
                      <span className={`shrink-0 border border-transparent px-2 py-0.5 text-[0.78rem] font-bold ${v === "spot" ? "bg-ok-soft text-ok" : v === "close" ? "bg-human-soft text-human-deep" : "bg-paper-2 text-ink-soft"}`}>
                        {v === "spot" ? "Spot on" : v === "close" ? "Close" : v === "off" ? "Off" : "Skipped"}
                      </span>
                    </li>
                  );
                })}
                {cs.map(({ k, spec, c }) => (
                  <li key={k} className="ui flex items-center justify-between gap-3 py-2.5 text-[0.9rem]">
                    <span className="min-w-0">
                      <span className="block text-ink">{spec.label}</span>
                      <span className="block truncate text-[0.8rem] text-ink-faint">Data: {spec.options.find((o) => o.k === spec.correct)?.text}</span>
                    </span>
                    <span className={`shrink-0 border border-transparent px-2 py-0.5 text-[0.78rem] font-bold ${c === undefined ? "bg-paper-2 text-ink-soft" : c === spec.correct ? "bg-ok-soft text-ok" : "bg-paper-2 text-ink-soft"}`}>
                      {c === undefined ? "Skipped" : c === spec.correct ? "Right" : "Not quite"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          }
        />
      );
      break;
    }
  }

  const nextLabel = step === 0 ? "Begin" : step === STEPS.length - 2 ? "See my scorecard" : step === STEPS.length - 1 ? "Read chapter 1" : "Next";
  const answered = cur.id !== "start" && cur.id !== "score" && answers[cur.id] !== undefined;
  const needsAnswer = cur.id !== "start" && cur.id !== "score" && !answered;

  return (
    <div
      className="min-h-[calc(100dvh-var(--nav-h))] overflow-x-clip bg-paper"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-noswipe],input,button,a,svg")) return;
        touch.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const t = touch.current;
        touch.current = null;
        if (!t || e.pointerType === "mouse") return;
        const dx = e.clientX - t.x;
        const dy = e.clientY - t.y;
        if (Math.abs(dx) > 70 && Math.abs(dy) < 50) go(step + (dx < 0 ? 1 : -1));
      }}
    >
      <nav aria-label="Chapters" className="sticky top-[var(--nav-h)] z-30 border-b border-ink bg-paper">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-5 py-3 sm:px-8">
          <ol className="flex flex-1 gap-1.5">
            {CHAPTERS.map((c, i) => {
              const first = STEPS.findIndex((s) => s.ch === i);
              return (
                <li key={c} className="min-w-0 flex-1">
                  <button type="button" onClick={() => go(first)} aria-current={cur.ch === i ? "step" : undefined} aria-label={`Chapter: ${c}`} className="block w-full text-left">
                    <span className={`block h-[5px] transition-colors duration-500 ${i < cur.ch ? "bg-ink" : i === cur.ch ? "bg-human" : "bg-rule"}`} />
                    <span className={`ui mt-1.5 hidden truncate text-[0.76rem] lg:block ${i === cur.ch ? "font-bold text-ink" : "text-ink-soft"}`}>{c}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <span className="ui whitespace-nowrap text-[0.82rem] text-ink-soft">
            {step + 1} / {STEPS.length}
          </span>
        </div>
      </nav>

      <div key={step} className="journey-step mx-auto max-w-[1200px] px-5 pb-36 pt-8 sm:px-8 sm:pt-14" style={{ ["--dir" as string]: String(dir) }}>
        {body}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-paper pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="btn btn-ghost min-h-[44px] px-5 disabled:opacity-30">
            Back
          </button>
          <span className="ui hidden text-[0.85rem] text-ink-soft md:block">{needsAnswer ? "Lock in an answer, or skip ahead" : "Arrow keys and swipes work too"}</span>
          {step === STEPS.length - 1 ? (
            <Link href="/m1" className="btn btn-ink min-h-[44px] px-6">
              {nextLabel}
            </Link>
          ) : (
            <button type="button" onClick={() => go(step + 1)} className={`btn min-h-[44px] px-6 ${needsAnswer ? "btn-ghost" : "btn-ink"}`}>
              {needsAnswer ? "Skip" : nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
