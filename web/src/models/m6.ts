/*
  M6: macro and policy. Three linked, simple models of what cheap AI compute does to growth, the labour share,
  demand and policy. Pure functions: no imports, no DOM, no randomness. Scenarios, not forecasts.
  Equations, parameter table, calibration and limits: docs/model-m6.md. Reference implementation in Python (used to
  check this file on eight scenarios): pipeline/m6_reference.py. Calibration data: data/processed/m6_*.csv.

  A. Solow growth with AI compute. Y = Bs A_t K^a X^(1-a), X = [(1-g) L^r + g C^r]^(1/r), r = (sigma-1)/sigma,
     where L is the workforce, C is AI compute (grows at a rate that slows over time) and K is conventional capital.
     Saving funds AI compute first, the rest builds K. Output: GDP, wage, income shares, consumption, r minus g.
  B. Ideas production (Jones 1995; Aghion, Jones and Jones 2019). dA/A = theta R^lambda A^(phi-1), where research R
     uses researchers and AI compute and a rising share a of research tasks is done by AI compute. Long-run growth is
     lambda (n + a b) / (1 - phi - lambda a); it explodes when phi + lambda a reaches 1.
  C. Distribution, demand and policy. Workers and capital owners spend different shares of income; extra saving is a
     demand gap unless investment absorbs it (Say's law). An automation tax on AI income funds an equal basic income;
     CRRA welfare picks the tax rate that is best under the stated assumptions.

  Conventions
  - Years run 0 to 60 (year 0 is the calibration year). Every array in a result has 61 entries.
  - Shares and rates are fractions (0.5 = 50 percent). A parameter with display "percent" is shown to users as value x 100 with a % sign.
  - GDP, wages and consumption are in units of year-0 GDP (year-0 GDP = 1).
  - Names ending in _pct are in percent; names ending in _share or without a suffix are fractions.
  - A parameter's kind says where its default comes from: "data" (read from a source), "derived" (solved or computed
    from data in pipeline/build_m6.py) or "assumption" (no data; the range is a plausible range, not an estimate).
*/

export type M6Group = "economy" | "a_growth" | "b_ideas" | "c_policy";
export type M6Kind = "data" | "derived" | "assumption";

export const M6_KEYS = [
  "labour_share0",
  "ai_share0",
  "saving_rate",
  "depreciation",
  "labour_growth",
  "tfp_growth",
  "k_output_ratio0",
  "sigma",
  "compute_doubling_years",
  "compute_growth_decay",
  "ai_depreciation",
  "ai_cost_decline",
  "idea_spillover",
  "research_elasticity",
  "ai_research_share0",
  "ai_research_share_end",
  "ai_research_ramp_years",
  "compute_boost",
  "growth_cap",
  "owner_pop_share",
  "owner_capital_income_share",
  "mpc_workers",
  "mpc_owners",
  "say_pass_through",
  "crra",
  "owner_welfare_weight",
  "tax_rate",
  "tax_base_elasticity",
  "eval_year",
] as const;
export type M6Key = (typeof M6_KEYS)[number];
export type M6Params = Record<M6Key, number>;

export type M6ParamMeta = {
  key: M6Key;
  label: string;
  group: M6Group;
  min: number;
  max: number;
  step: number;
  default: number; // USA calibration
  unit: string;
  display: "percent" | "number";
  kind: M6Kind;
  help: string;
};

/** Slider metadata. Defaults are the USA calibration; M6_PRESETS holds the India calibration and the named scenarios. */
export const M6_PARAMS: M6ParamMeta[] = [
  { key: "labour_share0", label: "Labour share of income today", group: "economy", min: 0.3, max: 0.8, step: 0.005, default: 0.5885, unit: "share of GDP", display: "percent", kind: "data",
    help: "Share of GDP paid to workers at the start. USA: Penn World Table 11.0, average 2013 to 2023. India: 0.524 on the same basis." },
  { key: "ai_share0", label: "AI compute share of income today", group: "economy", min: 0.0, max: 0.05, step: 0.001, default: 0.007, unit: "share of GDP", display: "percent", kind: "derived",
    help: "Income earned by owners of AI hardware and data centres at the start, as a share of GDP. Derived from Epoch AI data centre costs under stated assumptions (about 0.4% to 1.1%); treat as rough." },
  { key: "saving_rate", label: "Investment rate", group: "economy", min: 0.05, max: 0.5, step: 0.005, default: 0.216, unit: "share of GDP", display: "percent", kind: "data",
    help: "Share of output invested each year (conventional capital plus AI compute). USA: gross capital formation, World Bank, 2020 to 2024 average. India: 0.346." },
  { key: "depreciation", label: "Depreciation of conventional capital", group: "economy", min: 0.02, max: 0.1, step: 0.0025, default: 0.0445, unit: "per year", display: "percent", kind: "data",
    help: "Share of the capital stock that wears out each year. Penn World Table 11.0, average 2013 to 2023." },
  { key: "labour_growth", label: "Growth of the workforce", group: "economy", min: -0.02, max: 0.04, step: 0.0005, default: 0.0093, unit: "per year", display: "percent", kind: "data",
    help: "Growth of employment each year. USA: Penn World Table, 2003 to 2023 average. India: 0.0208. Held constant for 60 years." },
  { key: "tfp_growth", label: "Productivity growth without AI", group: "economy", min: 0.0, max: 0.05, step: 0.0005, default: 0.007, unit: "per year", display: "percent", kind: "derived",
    help: "Neutral productivity growth. Solved so that, with AI compute frozen, the economy grows at its 2003 to 2023 average rate." },
  { key: "k_output_ratio0", label: "Capital-to-output ratio at start", group: "economy", min: 1.0, max: 6.0, step: 0.05, default: 3.29, unit: "ratio", display: "number", kind: "derived",
    help: "Conventional capital divided by one year of GDP. Set so the no-AI economy starts on a balanced growth path (the data value is about 3.4 for the USA)." },
  { key: "sigma", label: "How easily AI compute replaces labour", group: "a_growth", min: 0.2, max: 4.0, step: 0.05, default: 1.25, unit: "elasticity", display: "number", kind: "assumption",
    help: "Elasticity of substitution between labour and AI compute. Below 1 they are complements (compute makes workers more valuable); above 1 they are substitutes. Studies of capital and labour find about 0.5 to 0.7 (Oberfield and Raval) and about 1.25 (Karabarbounis and Neiman); there is no estimate for AI compute." },
  { key: "compute_doubling_years", label: "AI compute doubling time at the start", group: "a_growth", min: 0.5, max: 10.0, step: 0.1, default: 0.7, unit: "years", display: "number", kind: "data",
    help: "Years for the stock of AI compute to double at the start. Epoch AI chip sales: cumulative AI chips shipped (H100 equivalents) doubled in about 0.7 years in the year to mid 2026." },
  { key: "compute_growth_decay", label: "Slowdown of compute growth", group: "a_growth", min: 0.0, max: 0.3, step: 0.005, default: 0.2, unit: "per year", display: "percent", kind: "assumption",
    help: "How fast the growth rate of AI compute shrinks each year (power, chips and money limit it). 0 keeps the doubling time fixed for 60 years." },
  { key: "ai_depreciation", label: "Depreciation of AI compute", group: "a_growth", min: 0.05, max: 0.5, step: 0.01, default: 0.2, unit: "per year", display: "percent", kind: "assumption",
    help: "Share of AI hardware that must be replaced each year (about a five-year life)." },
  { key: "ai_cost_decline", label: "Fall in cost per unit of compute", group: "a_growth", min: 0.0, max: 0.6, step: 0.01, default: 0.26, unit: "per year", display: "percent", kind: "data",
    help: "How fast the cost of one unit of compute falls, so the money spent grows slower than the compute stock. Epoch AI chip data: hardware performance per dollar rises about 36% a year, so cost per unit falls about 26% a year." },
  { key: "idea_spillover", label: "Do old ideas help new ones? (phi)", group: "b_ideas", min: 0.0, max: 1.1, step: 0.01, default: 0.394, unit: "number", display: "number", kind: "derived",
    help: "Ideas production exponent on the stock of ideas. Below 1, each new idea is harder to find as the stock grows, so long-run growth depends on how fast research effort grows (Jones 1995); Bloom and coauthors (2020) find ideas are getting harder to find. Solved so the no-AI economy grows at a constant rate." },
  { key: "research_elasticity", label: "Weight of research input (lambda)", group: "b_ideas", min: 0.2, max: 1.0, step: 0.05, default: 0.75, unit: "number", display: "number", kind: "assumption",
    help: "Exponent on research input in ideas production. Below 1 means duplication or congestion in research." },
  { key: "ai_research_share0", label: "AI share of research today", group: "b_ideas", min: 0.0, max: 0.3, step: 0.01, default: 0.02, unit: "share", display: "percent", kind: "assumption",
    help: "Share of research tasks done by AI compute at the start." },
  { key: "ai_research_share_end", label: "AI share of research at the end", group: "b_ideas", min: 0.0, max: 1.0, step: 0.01, default: 0.4, unit: "share", display: "percent", kind: "assumption",
    help: "Share of research tasks done by AI compute after the ramp. Growth accelerates without limit once phi + lambda times this share reaches 1." },
  { key: "ai_research_ramp_years", label: "Years to reach that share", group: "b_ideas", min: 5, max: 60, step: 1, default: 30, unit: "years", display: "number", kind: "assumption",
    help: "Years over which the AI share of research rises in a straight line." },
  { key: "compute_boost", label: "Extra growth of effective compute per unit of capital", group: "b_ideas", min: 0.0, max: 0.3, step: 0.005, default: 0.05, unit: "per year", display: "percent", kind: "assumption",
    help: "Yearly gain in effective AI compute for the same capital (better chips and algorithms), held constant. Epoch AI chip data show hardware performance per dollar rising about 36% a year, which is the top of this range." },
  { key: "growth_cap", label: "Cap on yearly growth of ideas", group: "b_ideas", min: 0.05, max: 1.0, step: 0.01, default: 0.25, unit: "per year", display: "percent", kind: "assumption",
    help: "A stand-in for physical, political and resource limits: ideas growth is cut off here, and the run is flagged when it is reached." },
  { key: "owner_pop_share", label: "Capital owners as a share of people", group: "c_policy", min: 0.01, max: 0.4, step: 0.01, default: 0.1, unit: "share", display: "percent", kind: "assumption",
    help: "Share of households that live mainly on capital and AI income (about the top decile of wealth)." },
  { key: "owner_capital_income_share", label: "Share of capital and AI income going to owners", group: "c_policy", min: 0.3, max: 1.0, step: 0.01, default: 0.88, unit: "share", display: "percent", kind: "data",
    help: "US Federal Reserve Distributional Financial Accounts: the top 10% of households by wealth hold about 88% of corporate equities and mutual fund shares (2026 Q2). India has no comparable series; the same value is used." },
  { key: "mpc_workers", label: "Spending out of wage income", group: "c_policy", min: 0.6, max: 1.0, step: 0.01, default: 0.95, unit: "share", display: "percent", kind: "assumption",
    help: "Share of disposable income that worker households spend. Households with little cash on hand spend a much larger share of a change in income than wealthier households do (Jappelli and Pistaferri 2014)." },
  { key: "mpc_owners", label: "Spending out of capital and AI income", group: "c_policy", min: 0.2, max: 0.95, step: 0.01, default: 0.58, unit: "share", display: "percent", kind: "derived",
    help: "Share of disposable income that owner households spend. Solved so the baseline saving rate equals the national gross saving rate; richer households save a larger share (Dynan, Skinner and Zeldes 2004)." },
  { key: "say_pass_through", label: "How much extra saving becomes investment", group: "c_policy", min: 0.0, max: 1.0, step: 0.05, default: 0.5, unit: "share", display: "percent", kind: "assumption",
    help: "1 means Say's law: every dollar saved is invested, so demand never falls short. 0 means investment stays at its baseline share of output, so extra saving is a demand gap." },
  { key: "crra", label: "Dislike of inequality (CRRA)", group: "c_policy", min: 0.2, max: 4.0, step: 0.1, default: 1.5, unit: "number", display: "number", kind: "assumption",
    help: "Curvature of utility. 1 is log utility; higher values value a dollar to a poor household more." },
  { key: "owner_welfare_weight", label: "Welfare weight on an owner relative to a worker", group: "c_policy", min: 0.25, max: 2.0, step: 0.05, default: 1.0, unit: "ratio", display: "number", kind: "assumption",
    help: "1 counts every person equally. Below 1 gives owners less weight." },
  { key: "tax_rate", label: "Automation tax on AI income", group: "c_policy", min: 0.0, max: 0.9, step: 0.01, default: 0.0, unit: "share", display: "percent", kind: "assumption",
    help: "Tax rate on AI compute income. The revenue is paid out as an equal universal basic income to every person." },
  { key: "tax_base_elasticity", label: "How much the tax shrinks the base", group: "c_policy", min: 0.0, max: 1.5, step: 0.05, default: 0.5, unit: "elasticity", display: "number", kind: "assumption",
    help: "Taxed AI income is multiplied by (1 minus tax) to this power: less investment, offshoring or avoidance. 0 means no response; the lost income is treated as lost output." },
  { key: "eval_year", label: "Year at which policy is judged", group: "c_policy", min: 5, max: 60, step: 1, default: 30, unit: "years from now", display: "number", kind: "assumption",
    help: "The welfare-maximising tax and the policy table are computed at this year of the simulation." },
];

export type M6Preset = { name: string; story: string; values: Partial<M6Params> };

/** Named scenarios: each lists only the parameters it changes from the USA calibration. */
export const M6_PRESETS: M6Preset[] = [
  { name: "USA baseline (calibrated)",
    story: "The USA calibration with every control at its default: AI compute keeps doubling about every year at first, then slows.",
    values: {  } },
  { name: "India baseline (calibrated)",
    story: "India's labour share, saving rate, workforce growth and growth rate from the same data sources; little AI compute income today.",
    values: { labour_share0: 0.5244, saving_rate: 0.3286, depreciation: 0.0558, labour_growth: 0.0208, tfp_growth: 0.0209, k_output_ratio0: 2.8, ai_share0: 0.002, mpc_workers: 0.85, mpc_owners: 0.476 } },
  { name: "AI compute doubles every 2 years",
    story: "Steady compute growth with no slowdown, at about a third of the pace of the latest measured doubling.",
    values: { compute_doubling_years: 2.0, compute_growth_decay: 0.0 } },
  { name: "Tasks complement (low substitution)",
    story: "Compute and workers are complements: more compute makes workers more productive and AI income stays small.",
    values: { sigma: 0.5 } },
  { name: "Tasks substitute (high substitution)",
    story: "Compute replaces labour easily: the labour share falls and AI owners take a large share of income.",
    values: { sigma: 2.5 } },
  { name: "Demand failure (Keynes), high substitution",
    story: "Compute replaces labour and investment does not absorb the extra saving of owners, so demand falls short of potential output.",
    values: { sigma: 2.5, say_pass_through: 0.0 } },
  { name: "Automation tax 25 percent with UBI",
    story: "The same high-substitution world with a 25% tax on AI income paid out as an equal UBI.",
    values: { sigma: 2.5, tax_rate: 0.25 } },
  { name: "Research automation",
    story: "AI does almost all research tasks within 20 years and compute per unit of capital keeps improving: growth of ideas accelerates.",
    values: { ai_research_share_end: 1.0, ai_research_ramp_years: 20, compute_boost: 0.2 } },
];

export const M6_DEFAULTS: M6Params = Object.fromEntries(M6_PARAMS.map((q) => [q.key, q.default])) as M6Params;

export const M6_GROUPS: { id: M6Group; label: string; blurb: string }[] = [
  { id: "economy", label: "Economy today", blurb: "Starting point, from Penn World Table, World Bank and Epoch AI data." },
  { id: "a_growth", label: "A. Growth with AI compute", blurb: "Solow growth: labour, capital and AI compute in a CES production function." },
  { id: "b_ideas", label: "B. Ideas and research automation", blurb: "Does growth stay constant, or accelerate, as AI does more of the research?" },
  { id: "c_policy", label: "C. Demand, distribution and policy", blurb: "Workers and owners spend differently; an automation tax can fund a basic income." },
];

/** Parameters for a preset: the USA calibration with the preset's overrides applied. */
export function m6ParamsForPreset(name: string): M6Params {
  const preset = M6_PRESETS.find((q) => q.name === name);
  return { ...M6_DEFAULTS, ...(preset ? preset.values : {}) } as M6Params;
}

// ---------------------------------------------------------------------------------------------------------------
// result types

export type M6ModelA = {
  gdp: number[]; // output, 1 = today
  gdp_per_worker: number[];
  wage: number[]; // labour income per worker
  labour_share: number[];
  ai_share: number[]; // income of the owners of AI compute, share of GDP
  capital_share: number[]; // conventional capital, share of GDP
  consumption: number[];
  ai_invest_share: number[]; // spending on AI compute, share of GDP
  k_invest_share: number[]; // spending on conventional capital, share of GDP
  k_output: number[];
  ai_capital_ratio: number[]; // value of AI capital divided by GDP
  r_net: number[]; // net return on conventional capital
  growth: number[]; // GDP growth; last element is NaN
  compute_index: number[]; // AI compute, 1 = today
  crowded_out: number[]; // 1 when AI spending exceeds total saving
};

export type M6ModelB = {
  gdp: number[];
  gdp_per_worker: number[];
  ideas: number[];
  growth_ideas: number[];
  growth_gdp: number[];
  ai_share_research: number[];
  k_output: number[];
  capped: number[];
  first_cap_year: number | null;
};

export type M6CurvePoint = {
  tax: number;
  welfare_gain_pct: number;
  revenue_pct_gdp: number;
  gap_pct: number;
  workers_consumption_gain_pct: number;
  owners_consumption_change_pct: number;
  potential_pct: number;
};

export type M6ModelC = {
  paths: {
    gap_no_tax: number[]; // demand gap, share of potential output (positive = shortfall)
    gap_tax: number[];
    saving_rate_no_tax: number[];
    saving_rate_tax: number[];
    ubi_share_gdp: number[]; // revenue of the automation tax, share of potential output
    ubi_share_worker_income: number[];
    owner_income_share_no_tax: number[];
    owner_income_share_tax: number[];
    workers_consumption_gain_pct: number[];
    owners_consumption_change_pct: number[];
    welfare_gain_pct: number[];
  };
  curve: M6CurvePoint[];
  optimal_tax: number;
  optimal_gain_pct: number;
  baseline_saving_rate: number;
  eval_year: number;
  revenue_peak_tax: number;
  revenue_peak_pct_gdp: number;
  gap_no_tax_at_eval: number;
};

export type M6Result = {
  params: M6Params;
  a: M6ModelA;
  a_frozen: M6ModelA; // same economy with AI compute held at today's level
  b: {
    ai: M6ModelB;
    base: M6ModelB; // research automation switched off
    share_grid: number[];
    bgp_growth: (number | null)[]; // long-run growth of ideas for each AI research share; null = explosive
    threshold_share: number;
    regime_index: number;
    regime: "constant growth" | "near the edge" | "explosive";
    exploded: boolean;
    hit_cap: boolean;
    first_cap_year: number | null;
  };
  c: M6ModelC;
};

export const M6_YEARS = 60;
const T = M6_YEARS;

// ---------------------------------------------------------------------------------------------------------------
// helpers

function fullParams(params?: Partial<M6Params>): M6Params {
  const out = { ...M6_DEFAULTS };
  if (params) {
    for (const k of M6_KEYS) {
      const v = params[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
  }
  return out;
}

function computePath(p: M6Params, frozen: boolean): { c: number[]; g: number[] } {
  const g0 = Math.pow(2, 1 / p.compute_doubling_years) - 1;
  const c = [1];
  const g: number[] = [];
  for (let t = 0; t <= T; t++) {
    const gt = frozen ? 0 : g0 * Math.pow(1 - p.compute_growth_decay, t);
    g.push(gt);
    if (t < T) c.push(c[t] * (1 + gt));
  }
  return { c, g };
}

function ces(l: number, c: number, gamma: number, rho: number): number {
  if (Math.abs(rho) < 1e-9) return Math.pow(l, 1 - gamma) * Math.pow(c, gamma);
  return Math.pow((1 - gamma) * Math.pow(l, rho) + gamma * Math.pow(c, rho), 1 / rho);
}

// ---------------------------------------------------------------------------------------------------------------
// Model A: Solow growth with a CES production function between labour and AI compute

function simulateA(p: M6Params, frozen: boolean): M6ModelA {
  const lab0 = p.labour_share0;
  const ai0 = p.ai_share0;
  const alpha = 1 - lab0 - ai0;
  const gamma = ai0 / (lab0 + ai0);
  const rho = (p.sigma - 1) / p.sigma;
  const n = p.labour_growth;
  const s = p.saving_rate;
  const delta = p.depreciation;
  const dC = p.ai_depreciation;
  const costDecline = p.ai_cost_decline;
  let k = p.k_output_ratio0;
  const bs = Math.pow(k, -alpha);
  const { c: cPath, g: gPath } = computePath(p, frozen);
  const out: M6ModelA = {
    gdp: [], gdp_per_worker: [], wage: [], labour_share: [], ai_share: [], capital_share: [], consumption: [], ai_invest_share: [],
    k_invest_share: [], k_output: [], ai_capital_ratio: [], r_net: [], growth: [], compute_index: [], crowded_out: [],
  };
  for (let t = 0; t <= T; t++) {
    const l = Math.pow(1 + n, t);
    const c = cPath[t];
    const x = ces(l, c, gamma, rho);
    const a = Math.pow(1 + p.tfp_growth, t);
    const y = bs * a * Math.pow(k, alpha) * Math.pow(x, 1 - alpha);
    let labSh: number;
    let aiSh: number;
    if (Math.abs(rho) < 1e-9) {
      labSh = (1 - alpha) * (1 - gamma);
      aiSh = (1 - alpha) * gamma;
    } else {
      labSh = (1 - alpha) * (1 - gamma) * Math.pow(l / x, rho);
      aiSh = (1 - alpha) * gamma * Math.pow(c / x, rho);
    }
    const rNet = (alpha * y) / k - delta;
    const rhoAi = Math.max(0.05, rNet + dC);
    const v = (aiSh * y) / rhoAi; // value of AI capital implied by its income
    const gV = (1 + gPath[t]) * (1 - costDecline) - 1; // growth of the money value of the compute stock
    const iAi = v * Math.max(gV + dC, 0);
    const iK = Math.max(0, s * y - iAi);
    out.gdp.push(y);
    out.gdp_per_worker.push(y / l);
    out.wage.push((labSh * y) / l);
    out.labour_share.push(labSh);
    out.ai_share.push(aiSh);
    out.capital_share.push(alpha);
    out.consumption.push(y - iAi - iK);
    out.ai_invest_share.push(iAi / y);
    out.k_invest_share.push(iK / y);
    out.k_output.push(k / y);
    out.ai_capital_ratio.push(v / y);
    out.r_net.push(rNet);
    out.compute_index.push(c);
    out.crowded_out.push(s * y < iAi ? 1 : 0);
    if (t < T) k = (1 - delta) * k + iK;
  }
  for (let t = 0; t < T; t++) out.growth.push(out.gdp[t + 1] / out.gdp[t] - 1);
  out.growth.push(Number.NaN);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Model B: ideas production with research automation

function researchSharePath(p: M6Params): number[] {
  const a0 = p.ai_research_share0;
  const a1 = p.ai_research_share_end;
  const ramp = p.ai_research_ramp_years;
  const out: number[] = [];
  for (let t = 0; t <= T; t++) out.push(a0 + (a1 - a0) * Math.min(1, t / ramp));
  return out;
}

/** Long-run growth of ideas for a constant AI research share a; null if phi + lambda a >= 1 (growth explodes). */
function bgpGrowth(p: M6Params, a: number): number | null {
  const den = 1 - p.idea_spillover - p.research_elasticity * a;
  if (den <= 1e-9) return null;
  return (p.research_elasticity * (p.labour_growth + a * p.compute_boost)) / den;
}

function simulateB(p: M6Params, automate: boolean): M6ModelB {
  const alpha = 1 - p.labour_share0;
  const k0 = p.k_output_ratio0;
  const bs = Math.pow(k0, -alpha);
  const n = p.labour_growth;
  const s = p.saving_rate;
  const delta = p.depreciation;
  const phi = p.idea_spillover;
  const lam = p.research_elasticity;
  const cap = p.growth_cap;
  const g0 = p.tfp_growth / (1 - alpha); // ideas growth at the start, so TFP growth matches Model A
  const aPath = automate ? researchSharePath(p) : new Array<number>(T + 1).fill(p.ai_research_share0);
  const boost = automate ? p.compute_boost : 0;
  let a = 1;
  let k = k0;
  let l = 1;
  let e = 1;
  let firstCap: number | null = null;
  const out: M6ModelB = {
    gdp: [], gdp_per_worker: [], ideas: [], growth_ideas: [], growth_gdp: [], ai_share_research: [], k_output: [], capped: [], first_cap_year: null,
  };
  for (let t = 0; t <= T; t++) {
    const y = bs * Math.pow(k, alpha) * Math.pow(a * l, 1 - alpha);
    const r = Math.pow(l, 1 - aPath[t]) * Math.pow((k * e) / k0, aPath[t]);
    const gRaw = g0 * Math.pow(r, lam) * Math.pow(a, phi - 1);
    const g = Math.min(gRaw, cap);
    const capped = gRaw >= cap;
    if (capped && firstCap === null) firstCap = t;
    out.gdp.push(y);
    out.gdp_per_worker.push(y / l);
    out.ideas.push(a);
    out.growth_ideas.push(g);
    out.ai_share_research.push(aPath[t]);
    out.k_output.push(k / y);
    out.capped.push(capped ? 1 : 0);
    if (t < T) {
      k = (1 - delta) * k + s * y;
      a = a * (1 + g);
      l = l * (1 + n);
      e = e * (1 + boost);
    }
  }
  for (let t = 0; t < T; t++) out.growth_gdp.push(out.gdp[t + 1] / out.gdp[t] - 1);
  out.growth_gdp.push(Number.NaN);
  out.first_cap_year = firstCap;
  return out;
}

function simulateBFull(p: M6Params): M6Result["b"] {
  const ai = simulateB(p, true);
  const base = simulateB(p, false);
  const aEnd = p.ai_research_share_end;
  const threshold = (1 - p.idea_spillover) / p.research_elasticity;
  const regimeEnd = p.idea_spillover + p.research_elasticity * aEnd;
  const grid: number[] = [];
  const bgp: (number | null)[] = [];
  for (let i = 0; i <= 100; i++) {
    grid.push(i / 100);
    bgp.push(bgpGrowth(p, i / 100));
  }
  const regime = regimeEnd >= 1 - 1e-9 ? "explosive" : regimeEnd >= 0.9 ? "near the edge" : "constant growth";
  return {
    ai, base, share_grid: grid, bgp_growth: bgp, threshold_share: threshold, regime_index: regimeEnd, regime,
    exploded: regime === "explosive", hit_cap: ai.first_cap_year !== null, first_cap_year: ai.first_cap_year,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Model C: distribution, demand and policy

type GroupIncomes = { owners: number; workers: number; revenue: number; potential: number };

function groupIncomes(lab: number, capShare: number, aiShare: number, tau: number, e: number, pi: number, own: number): GroupIncomes {
  const base = tau < 1 ? Math.pow(1 - tau, e) : 0; // share of AI income left after the behavioural response
  const taxed = aiShare * base;
  const revenue = tau * taxed;
  const capAfter = capShare + taxed * (1 - tau);
  return {
    owners: own * capAfter + pi * revenue,
    workers: lab + (1 - own) * capAfter + (1 - pi) * revenue,
    revenue,
    potential: 1 - aiShare * (1 - base),
  };
}

function baselineSavingRate(p: M6Params, lab: number, capShare: number, aiShare: number): number {
  const own = p.owner_capital_income_share;
  const ow = own * (capShare + aiShare);
  const wk = lab + (1 - own) * (capShare + aiShare);
  return (1 - p.mpc_owners) * ow + (1 - p.mpc_workers) * wk;
}

type Eval = {
  revenue: number; potential: number; saving: number; gap: number; realized: number; cons_owners: number; cons_workers: number;
  ede: number; income_owners: number; income_workers: number; saving_rate: number;
};

function evaluate(p: M6Params, lab: number, capShare: number, aiShare: number, tau: number, sigma0: number): Eval {
  const pi = p.owner_pop_share;
  const mo = p.mpc_owners;
  const mw = p.mpc_workers;
  const nu = p.say_pass_through;
  const eta = p.crra;
  const beta = p.owner_welfare_weight;
  const inc = groupIncomes(lab, capShare, aiShare, tau, p.tax_base_elasticity, pi, p.owner_capital_income_share);
  const consO = mo * inc.owners;
  const consW = mw * inc.workers;
  const saving = inc.potential - consO - consW;
  const invest = nu * saving + (1 - nu) * sigma0 * inc.potential;
  const gap = saving - invest; // = (1 - nu)(saving - sigma0 * potential output)
  const realized = inc.potential - Math.max(gap, 0);
  const f = realized / inc.potential;
  const co = (consO * f) / pi; // consumption per person, owners
  const cw = (consW * f) / (1 - pi); // consumption per person, workers
  const wtO = beta * pi;
  const wtW = 1 - pi;
  let ede: number;
  if (Math.abs(eta - 1) < 1e-9) ede = Math.exp((wtO * Math.log(co) + wtW * Math.log(cw)) / (wtO + wtW));
  else ede = Math.pow((wtO * Math.pow(co, 1 - eta) + wtW * Math.pow(cw, 1 - eta)) / (wtO + wtW), 1 / (1 - eta));
  return {
    revenue: inc.revenue, potential: inc.potential, saving, gap, realized, cons_owners: co, cons_workers: cw, ede,
    income_owners: inc.owners, income_workers: inc.workers, saving_rate: saving / inc.potential,
  };
}

function simulateC(p: M6Params, a: M6ModelA): M6ModelC {
  const pi = p.owner_pop_share;
  const sigma0 = baselineSavingRate(p, a.labour_share[0], a.capital_share[0], a.ai_share[0]);
  const tauUser = p.tax_rate;
  const paths: M6ModelC["paths"] = {
    gap_no_tax: [], gap_tax: [], saving_rate_no_tax: [], saving_rate_tax: [], ubi_share_gdp: [], ubi_share_worker_income: [],
    owner_income_share_no_tax: [], owner_income_share_tax: [], workers_consumption_gain_pct: [], owners_consumption_change_pct: [],
    welfare_gain_pct: [],
  };
  for (let t = 0; t <= T; t++) {
    const lab = a.labour_share[t];
    const cap = a.capital_share[t];
    const ai = a.ai_share[t];
    const e0 = evaluate(p, lab, cap, ai, 0, sigma0);
    const e1 = evaluate(p, lab, cap, ai, tauUser, sigma0);
    paths.gap_no_tax.push(e0.gap / e0.potential);
    paths.gap_tax.push(e1.gap / e1.potential);
    paths.saving_rate_no_tax.push(e0.saving_rate);
    paths.saving_rate_tax.push(e1.saving_rate);
    paths.ubi_share_gdp.push(e1.revenue);
    paths.ubi_share_worker_income.push(e1.revenue / (e1.income_workers / (1 - pi)));
    paths.owner_income_share_no_tax.push(e0.income_owners / e0.potential);
    paths.owner_income_share_tax.push(e1.income_owners / e1.potential);
    paths.workers_consumption_gain_pct.push(100 * (e1.cons_workers / e0.cons_workers - 1));
    paths.owners_consumption_change_pct.push(100 * (e1.cons_owners / e0.cons_owners - 1));
    paths.welfare_gain_pct.push(100 * (e1.ede / e0.ede - 1));
  }
  // welfare-maximising tax at the evaluation year
  const ty = Math.floor(Math.min(Math.max(p.eval_year, 0), T) + 0.5);
  const lab = a.labour_share[ty];
  const cap = a.capital_share[ty];
  const ai = a.ai_share[ty];
  const base = evaluate(p, lab, cap, ai, 0, sigma0);
  const curve: M6CurvePoint[] = [];
  let bestI = 0;
  let best = -1e18;
  for (let i = 0; i < 96; i++) {
    const tau = i / 100;
    const r = evaluate(p, lab, cap, ai, tau, sigma0);
    const gain = 100 * (r.ede / base.ede - 1);
    curve.push({
      tax: tau,
      welfare_gain_pct: gain,
      revenue_pct_gdp: (100 * r.revenue) / r.potential,
      gap_pct: (100 * r.gap) / r.potential,
      workers_consumption_gain_pct: 100 * (r.cons_workers / base.cons_workers - 1),
      owners_consumption_change_pct: 100 * (r.cons_owners / base.cons_owners - 1),
      potential_pct: (100 * r.potential) / base.potential,
    });
    if (gain > best) {
      best = gain;
      bestI = i;
    }
  }
  let peak = curve[0];
  for (const row of curve) if (row.revenue_pct_gdp > peak.revenue_pct_gdp) peak = row;
  return {
    paths, curve, optimal_tax: curve[bestI].tax, optimal_gain_pct: best, baseline_saving_rate: sigma0, eval_year: ty,
    revenue_peak_tax: peak.tax, revenue_peak_pct_gdp: peak.revenue_pct_gdp, gap_no_tax_at_eval: base.gap / base.potential,
  };
}

// ---------------------------------------------------------------------------------------------------------------

/**
 * Run all three linked models for one set of parameters. Pure and deterministic; takes well under 5 ms.
 * Missing or non-finite parameters fall back to the USA calibration. Scenarios, not forecasts.
 */
export function simulateM6(params?: Partial<M6Params>): M6Result {
  const p = fullParams(params);
  const a = simulateA(p, false);
  const aFrozen = simulateA(p, true);
  const b = simulateBFull(p);
  const c = simulateC(p, a);
  return { params: p, a, a_frozen: aFrozen, b, c };
}
