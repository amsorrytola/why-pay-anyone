/*
  M4: the labour model ("why pay anyone?"). A small task-based model in the spirit of Acemoglu and Restrepo.

  Tasks i run from -n to 1. A person's productivity at task i is exp(-theta * i): people are best at the low-index
  tasks and relatively worse at high-index tasks, which are the ones AI is best at (comparative advantage).
  AI can do a share A of the tasks (the highest-index ones, i >= 1 - A). New tasks (i < 0) are tasks only
  people can do. Doing one unit of task i costs
      a person: w * exp(theta * i)        (w is the wage, to be found)
      AI:       R                          (R = rho * w0 * (1 + eta * share of tasks on AI))
  where w0 is the wage in a world without AI use, rho is the AI cost as a share of that wage, and eta makes
  compute scarce: the more tasks run on AI, the dearer it gets. Each task goes to the cheaper option. Final output
  combines tasks with a CES aggregator (elasticity of substitution sigma between tasks). One person-unit of labour is
  supplied; the wage adjusts so that the price of the final good is 1.

  Closed forms (sigma != 1), with I(a) = (exp(k a) - exp(-k n)) / k and k = theta (1 - sigma):
      price index:   P^(1-sigma) = w^(1-sigma) I(i_a) + (1 - i_a) R^(1-sigma) = 1
      output:        Y = w^sigma / I(i_a)
      labour share:  s = w^(1-sigma) I(i_a)
  Demand side: if investment is a fixed share of output and workers spend a share cL of their income and owners of AI
  spend a share cK, spending falls short of output by (cL - cK)(1 - s)(1 - tau), where tau is an automation tax on AI
  income that is paid out to workers.
  Scenarios, not forecasts.
*/

export type M4Params = {
  rho: number; // AI cost of a task as a share of the pre-AI wage
  A: number; // share of tasks AI can do
  theta: number; // how much worse people are at AI-friendly tasks
  sigma: number; // elasticity of substitution between tasks
  n: number; // new tasks only people can do (mass added to the task range)
  eta: number; // compute scarcity
  cL: number; // share of income workers spend
  cK: number; // share of income owners spend
  tau: number; // automation tax on AI income, paid to workers
  keynes: boolean; // if true, a demand shortfall cuts employment
};

export type ParamMeta = {
  key: keyof M4Params;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  help: string;
  log?: boolean;
  group: "ai" | "work" | "demand";
};

export const M4_DEFAULTS: M4Params = { rho: 0.3, A: 0.18, theta: 1.5, sigma: 0.8, n: 0, eta: 1, cL: 0.9, cK: 0.5, tau: 0, keynes: false };

export const M4_PARAMS: ParamMeta[] = [
  { key: "rho", label: "All-in price of AI", min: 0.01, max: 3, step: 0.001, unit: "% of wage", log: true, group: "ai", help: "What it costs to get a task done with AI, including checking, integration and errors, as a share of what a person is paid for it. Tokens alone cost far less than this (see the calculator)." },
  { key: "A", label: "Work AI can do", min: 0, max: 1, step: 0.01, unit: "% of tasks", group: "ai", help: "The share of tasks AI can do well enough. The Microsoft data puts the pay-weighted US figure near 18%." },
  { key: "eta", label: "Compute scarcity", min: 0, max: 10, step: 0.1, unit: "", group: "ai", help: "How fast AI gets dearer as more tasks run on it. At 0, AI has unlimited supply at a fixed price." },
  { key: "theta", label: "People's edge at human tasks", min: 0, max: 3, step: 0.05, unit: "", group: "work", help: "How much better people are at the tasks AI finds hard. Zero means people and AI are equally good at everything." },
  { key: "sigma", label: "Swapping one task for another", min: 0.2, max: 3, step: 0.05, unit: "", group: "work", help: "Below 1, tasks are complements: cheap AI tasks make the remaining human tasks more valuable. Above 1, they are substitutes." },
  { key: "n", label: "New human-only tasks", min: 0, max: 0.6, step: 0.01, unit: "", group: "work", help: "Tasks that did not exist before and only people can do. They add work for people (reinstatement)." },
  { key: "cL", label: "Spending out of wages", min: 0.5, max: 1, step: 0.01, unit: "", group: "demand", help: "The share of wage income that workers spend." },
  { key: "cK", label: "Spending out of AI profits", min: 0, max: 1, step: 0.01, unit: "", group: "demand", help: "The share of AI income that owners spend. Owners usually save more." },
  { key: "tau", label: "Automation tax", min: 0, max: 0.9, step: 0.01, unit: "% of AI income", group: "demand", help: "A tax on AI income, paid out to workers as a basic income." },
];

export const M4_PRESETS: { id: string; label: string; p: Partial<M4Params>; note: string }[] = [
  { id: "today", label: "Today", p: {}, note: "AI can do about 18% of tasks, and getting a task done with AI costs about 30% of what a person is paid for it." },
  { id: "cheaper", label: "AI price falls 10 times", p: { rho: 0.03 }, note: "Ten times cheaper AI. Because tasks here are complements, spending on the now-cheap tasks shrinks, so the labour share rises. Compare with the substitutes case." },
  { id: "half", label: "AI can do half the work", p: { A: 0.5 }, note: "What AI can do, not what it costs, is what moves wages and shares the most." },
  { id: "substitutes", label: "Tasks are easy substitutes", p: { A: 0.5, sigma: 1.8, rho: 1 }, note: "When tasks substitute easily, money flows to the cheapest way of doing each one, and the labour share falls hard." },
  { id: "newtasks", label: "New tasks appear", p: { A: 0.5, n: 0.3 }, note: "New human-only tasks add work for people. Output is higher than without them, but each task's pay is shared among more tasks." },
  { id: "scarce", label: "Compute stays scarce", p: { A: 0.5, eta: 8, rho: 0.6 }, note: "When AI gets dearer as it spreads, it stops short of all it could do, and people keep the tasks where they have a comparative advantage." },
  { id: "tax", label: "Automation tax with basic income", p: { A: 0.5, tau: 0.4, keynes: true }, note: "With demand allowed to fall short, a tax on AI income paid to workers shrinks the gap between what is made and what is bought." },
];

function Iint(a: number, k: number, n: number) {
  return Math.abs(k) < 1e-9 ? a + n : (Math.exp(k * a) - Math.exp(-k * n)) / k;
}

export type M4Task = { i: number; humanCost: number; automated: boolean; feasible: boolean };

export type M4Result = {
  w: number;
  w0: number;
  R: number;
  ia: number; // tasks with index >= ia run on AI
  aiShare: number; // share of the original task range run on AI
  relWage: number;
  relOutput: number;
  labourShare: number;
  aiIncomeShare: number;
  demandGap: number;
  employment: number;
  workerIncomeRel: number;
  ceilingAtEdge: number; // R divided by people's productivity at the AI-friendliest task
  unbounded: boolean; // true when AI is so cheap and tasks so substitutable that output per worker has no finite answer
  tasks: M4Task[];
};

export function simulateM4(p: M4Params): M4Result {
  const sigma = Math.abs(p.sigma - 1) < 1e-3 ? 1.001 : p.sigma;
  const k = p.theta * (1 - sigma);
  const n = p.n;
  const w0 = Math.pow(Iint(1, k, n), -1 / (1 - sigma));
  const I0 = Iint(1, k, n);
  const Y0 = Math.pow(w0, sigma) / I0;

  const solveW = (R: number) => {
    const iaOf = (w: number) => {
      const istar = p.theta < 1e-6 ? (R < w ? -Infinity : Infinity) : Math.log(R / w) / p.theta;
      return Math.min(1, Math.max(1 - p.A, istar));
    };
    // price level of the final good as a function of the wage; the wage is the one that makes it 1
    const priceLevel = (w: number) => {
      const ia = iaOf(w);
      const v = Math.pow(w, 1 - sigma) * Iint(ia, k, n) + (1 - ia) * Math.pow(R, 1 - sigma);
      return Math.pow(v, 1 / (1 - sigma));
    };
    let lo = Math.log(w0 * 1e-4);
    let hi = Math.log(w0 * 1e4);
    const unbounded = priceLevel(Math.exp(hi)) < 1;
    for (let it = 0; it < 90 && !unbounded; it++) {
      const mid = (lo + hi) / 2;
      if (priceLevel(Math.exp(mid)) < 1) lo = mid;
      else hi = mid;
    }
    const w = Math.exp(unbounded ? hi : (lo + hi) / 2);
    return { w, ia: iaOf(w), unbounded };
  };

  let u = p.A * 0.5;
  let sol = { w: w0, ia: 1, unbounded: false };
  let R = p.rho * w0;
  for (let it = 0; it < 60; it++) {
    R = p.rho * w0 * (1 + p.eta * u);
    sol = solveW(R);
    const uNew = 1 - sol.ia;
    if (Math.abs(uNew - u) < 1e-7) {
      u = uNew;
      break;
    }
    u = 0.5 * u + 0.5 * uNew;
  }
  R = p.rho * w0 * (1 + p.eta * u);
  sol = solveW(R);
  const { w, ia } = sol;
  const Ia = Iint(ia, k, n);
  const Y = Math.pow(w, sigma) / Ia;
  const s = Math.min(1, Math.max(0, Math.pow(w, 1 - sigma) * Ia));
  const gap = Math.max(0, (p.cL - p.cK) * (1 - s) * (1 - p.tau));
  const employment = p.keynes ? Math.max(0, 1 - gap) : 1;
  const capIncome = Y * (1 - s);
  const transfer = p.tau * capIncome;
  const tasks: M4Task[] = [];
  const N = 90;
  for (let j = 0; j <= N; j++) {
    const i = -n + ((1 + n) * j) / N;
    const humanCost = w * Math.exp(p.theta * i);
    const feasible = i >= 1 - p.A;
    tasks.push({ i, humanCost, feasible, automated: i >= ia - 1e-9 && feasible });
  }
  return {
    w,
    w0,
    R,
    ia,
    aiShare: 1 - ia,
    relWage: w / w0,
    relOutput: (Y * employment) / Y0,
    labourShare: s,
    aiIncomeShare: 1 - s,
    demandGap: gap,
    employment,
    workerIncomeRel: (w * employment + transfer) / w0,
    ceilingAtEdge: R / Math.exp(-p.theta),
    unbounded: sol.unbounded,
    tasks,
  };
}
