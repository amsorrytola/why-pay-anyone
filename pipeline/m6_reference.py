"""M6 reference implementation (Python) of the three macro and policy models.

The website runs the same equations in TypeScript (web/src/models/m6.ts). This file is the reference that the
TypeScript is checked against, and build_m6.py uses it to calibrate the parameters and to produce the preset results.
Equations, parameter table, calibration and limits are written up in docs/model-m6.md. Scenarios, not forecasts.

  (A) Solow growth with a CES production function between labour and AI compute (60 annual steps)
        Y = Bs * A_t * K^alpha * X^(1-alpha),   X = [(1-g) L^rho + g C^rho]^(1/rho),   rho = (sigma-1)/sigma
      L = (1+n)^t, C = AI compute index (grows at a rate that slows over time), alpha = 1 - labour share - AI share.
      Income shares: labour (1-alpha)(1-g)(L/X)^rho, AI (1-alpha) g (C/X)^rho, conventional capital alpha.
      Saving s*Y funds AI compute purchases first (V * (growth of value + depreciation)); the rest builds K.
  (B) Ideas production (Jones 1995 / Aghion-Jones-Jones 2019 style), research uses researchers and AI compute
        dA/A = theta * R^lambda * A^(phi-1),   R = (L/L0)^(1-a_t) * (K E/(K0 E0))^(a_t)
      a_t = share of research tasks done by AI compute (rises from a0 to a_end over ramp years).
      Long-run growth of ideas (if phi + lambda a < 1):  g = lambda (n + a gB) / (1 - phi - lambda a); at or above 1 it explodes.
  (C) Distribution, demand and policy: workers and capital owners with different spending rates, an automation tax
      on AI income that funds a universal basic income (UBI), an aggregate demand gap, and CRRA welfare.

Run `uv run python pipeline/m6_reference.py --check` to compare this file with the TypeScript on several scenarios.
Only the standard library is used here, so the check is easy to read.
"""
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
T = 60  # years simulated


# USA calibration (written by build_m6.py to m6_parameters.csv, column default_usa; build_m6.py warns if these drift).
USA = {
    "labour_share0": 0.5885,
    "ai_share0": 0.007,
    "saving_rate": 0.216,
    "depreciation": 0.0445,
    "labour_growth": 0.0093,
    "tfp_growth": 0.007,
    "k_output_ratio0": 3.29,
    "sigma": 1.25,
    "compute_doubling_years": 0.7,
    "compute_growth_decay": 0.20,
    "ai_depreciation": 0.20,
    "ai_cost_decline": 0.26,
    "idea_spillover": 0.394,
    "research_elasticity": 0.75,
    "ai_research_share0": 0.02,
    "ai_research_share_end": 0.40,
    "ai_research_ramp_years": 30,
    "compute_boost": 0.05,
    "growth_cap": 0.25,
    "owner_pop_share": 0.10,
    "owner_capital_income_share": 0.88,
    "mpc_workers": 0.95,
    "mpc_owners": 0.58,
    "say_pass_through": 0.5,
    "crra": 1.5,
    "owner_welfare_weight": 1.0,
    "tax_rate": 0.0,
    "tax_base_elasticity": 0.5,
    "eval_year": 30,
}

# (key, label, group, min, max, step, unit, display, kind, help); default = USA[key]. The check compares all of it with the TypeScript file.
def _p(key, label, group, lo, hi, step, unit, display, kind, help_):
    return dict(key=key, label=label, group=group, min=lo, max=hi, step=step, default=USA[key], unit=unit,
                display=display, kind=kind, help=help_)


PARAMS = [
    _p("labour_share0", "Labour share of income today", "economy", 0.30, 0.80, 0.005, "share of GDP", "percent", "data",
       "Share of GDP paid to workers at the start. USA: Penn World Table 11.0, average 2013 to 2023. India: 0.524 on the same basis."),
    _p("ai_share0", "AI compute share of income today", "economy", 0.0, 0.05, 0.001, "share of GDP", "percent", "derived",
       "Income earned by owners of AI hardware and data centres at the start, as a share of GDP. Derived from Epoch AI data centre costs under stated assumptions (about 0.4% to 1.1%); treat as rough."),
    _p("saving_rate", "Investment rate", "economy", 0.05, 0.50, 0.005, "share of GDP", "percent", "data",
       "Share of output invested each year (conventional capital plus AI compute). USA: gross capital formation, World Bank, 2020 to 2024 average. India: 0.346."),
    _p("depreciation", "Depreciation of conventional capital", "economy", 0.02, 0.10, 0.0025, "per year", "percent", "data",
       "Share of the capital stock that wears out each year. Penn World Table 11.0, average 2013 to 2023."),
    _p("labour_growth", "Growth of the workforce", "economy", -0.02, 0.04, 0.0005, "per year", "percent", "data",
       "Growth of employment each year. USA: Penn World Table, 2003 to 2023 average. India: 0.0208. Held constant for 60 years."),
    _p("tfp_growth", "Productivity growth without AI", "economy", 0.0, 0.05, 0.0005, "per year", "percent", "derived",
       "Neutral productivity growth. Solved so that, with AI compute frozen, the economy grows at its 2003 to 2023 average rate."),
    _p("k_output_ratio0", "Capital-to-output ratio at start", "economy", 1.0, 6.0, 0.05, "ratio", "number", "derived",
       "Conventional capital divided by one year of GDP. Set so the no-AI economy starts on a balanced growth path (the data value is about 3.4 for the USA)."),
    _p("sigma", "How easily AI compute replaces labour", "a_growth", 0.2, 4.0, 0.05, "elasticity", "number", "assumption",
       "Elasticity of substitution between labour and AI compute. Below 1 they are complements (compute makes workers more valuable); above 1 they are substitutes. Studies of capital and labour find about 0.5 to 0.7 (Oberfield and Raval) and about 1.25 (Karabarbounis and Neiman); there is no estimate for AI compute."),
    _p("compute_doubling_years", "AI compute doubling time at the start", "a_growth", 0.5, 10.0, 0.1, "years", "number", "data",
       "Years for the stock of AI compute to double at the start. Epoch AI chip sales: cumulative AI chips shipped (H100 equivalents) doubled in about 0.7 years in the year to mid 2026."),
    _p("compute_growth_decay", "Slowdown of compute growth", "a_growth", 0.0, 0.30, 0.005, "per year", "percent", "assumption",
       "How fast the growth rate of AI compute shrinks each year (power, chips and money limit it). 0 keeps the doubling time fixed for 60 years."),
    _p("ai_depreciation", "Depreciation of AI compute", "a_growth", 0.05, 0.50, 0.01, "per year", "percent", "assumption",
       "Share of AI hardware that must be replaced each year (about a five-year life)."),
    _p("ai_cost_decline", "Fall in cost per unit of compute", "a_growth", 0.0, 0.60, 0.01, "per year", "percent", "data",
       "How fast the cost of one unit of compute falls, so the money spent grows slower than the compute stock. Epoch AI chip data: hardware performance per dollar rises about 36% a year, so cost per unit falls about 26% a year."),
    _p("idea_spillover", "Do old ideas help new ones? (phi)", "b_ideas", 0.0, 1.1, 0.01, "number", "number", "derived",
       "Ideas production exponent on the stock of ideas. Below 1, each new idea is harder to find as the stock grows, so long-run growth depends on how fast research effort grows (Jones 1995); Bloom and coauthors (2020) find ideas are getting harder to find. Solved so the no-AI economy grows at a constant rate."),
    _p("research_elasticity", "Weight of research input (lambda)", "b_ideas", 0.2, 1.0, 0.05, "number", "number", "assumption",
       "Exponent on research input in ideas production. Below 1 means duplication or congestion in research."),
    _p("ai_research_share0", "AI share of research today", "b_ideas", 0.0, 0.30, 0.01, "share", "percent", "assumption",
       "Share of research tasks done by AI compute at the start."),
    _p("ai_research_share_end", "AI share of research at the end", "b_ideas", 0.0, 1.0, 0.01, "share", "percent", "assumption",
       "Share of research tasks done by AI compute after the ramp. Growth accelerates without limit once phi + lambda times this share reaches 1."),
    _p("ai_research_ramp_years", "Years to reach that share", "b_ideas", 5, 60, 1, "years", "number", "assumption",
       "Years over which the AI share of research rises in a straight line."),
    _p("compute_boost", "Extra growth of effective compute per unit of capital", "b_ideas", 0.0, 0.30, 0.005, "per year", "percent", "assumption",
       "Yearly gain in effective AI compute for the same capital (better chips and algorithms), held constant. Epoch AI chip data show hardware performance per dollar rising about 36% a year, which is the top of this range."),
    _p("growth_cap", "Cap on yearly growth of ideas", "b_ideas", 0.05, 1.0, 0.01, "per year", "percent", "assumption",
       "A stand-in for physical, political and resource limits: ideas growth is cut off here, and the run is flagged when it is reached."),
    _p("owner_pop_share", "Capital owners as a share of people", "c_policy", 0.01, 0.40, 0.01, "share", "percent", "assumption",
       "Share of households that live mainly on capital and AI income (about the top decile of wealth)."),
    _p("owner_capital_income_share", "Share of capital and AI income going to owners", "c_policy", 0.30, 1.0, 0.01, "share", "percent", "data",
       "US Federal Reserve Distributional Financial Accounts: the top 10% of households by wealth hold about 88% of corporate equities and mutual fund shares (2026 Q2). India has no comparable series; the same value is used."),
    _p("mpc_workers", "Spending out of wage income", "c_policy", 0.60, 1.0, 0.01, "share", "percent", "assumption",
       "Share of disposable income that worker households spend. Households with little cash on hand spend a much larger share of a change in income than wealthier households do (Jappelli and Pistaferri 2014)."),
    _p("mpc_owners", "Spending out of capital and AI income", "c_policy", 0.20, 0.95, 0.01, "share", "percent", "derived",
       "Share of disposable income that owner households spend. Solved so the baseline saving rate equals the national gross saving rate; richer households save a larger share (Dynan, Skinner and Zeldes 2004)."),
    _p("say_pass_through", "How much extra saving becomes investment", "c_policy", 0.0, 1.0, 0.05, "share", "percent", "assumption",
       "1 means Say's law: every dollar saved is invested, so demand never falls short. 0 means investment stays at its baseline share of output, so extra saving is a demand gap."),
    _p("crra", "Dislike of inequality (CRRA)", "c_policy", 0.2, 4.0, 0.1, "number", "number", "assumption",
       "Curvature of utility. 1 is log utility; higher values value a dollar to a poor household more."),
    _p("owner_welfare_weight", "Welfare weight on an owner relative to a worker", "c_policy", 0.25, 2.0, 0.05, "ratio", "number", "assumption",
       "1 counts every person equally. Below 1 gives owners less weight."),
    _p("tax_rate", "Automation tax on AI income", "c_policy", 0.0, 0.90, 0.01, "share", "percent", "assumption",
       "Tax rate on AI compute income. The revenue is paid out as an equal universal basic income to every person."),
    _p("tax_base_elasticity", "How much the tax shrinks the base", "c_policy", 0.0, 1.5, 0.05, "elasticity", "number", "assumption",
       "Taxed AI income is multiplied by (1 minus tax) to this power: less investment, offshoring or avoidance. 0 means no response; the lost income is treated as lost output."),
    _p("eval_year", "Year at which policy is judged", "c_policy", 5, 60, 1, "years from now", "number", "assumption",
       "The welfare-maximising tax and the policy table are computed at this year of the simulation."),
]
KEYS = [p["key"] for p in PARAMS]


def defaults():
    return {p["key"]: p["default"] for p in PARAMS}


def _full(params):
    out = defaults()
    if params:
        for k, v in params.items():
            if k in out:
                out[k] = v
    return out


# Named scenarios: a preset lists only the parameters it changes; everything else is the USA calibration above.
INDIA = {"labour_share0": 0.5244, "saving_rate": 0.3286, "depreciation": 0.0558, "labour_growth": 0.0208, "tfp_growth": 0.0209,
         "k_output_ratio0": 2.8, "ai_share0": 0.002, "mpc_workers": 0.85, "mpc_owners": 0.476}
PRESETS = {
    "USA baseline (calibrated)": dict(
        story="The USA calibration with every control at its default: AI compute keeps doubling about every year at first, then slows.",
        values={}),
    "India baseline (calibrated)": dict(
        story="India's labour share, saving rate, workforce growth and growth rate from the same data sources; little AI compute income today.",
        values=dict(INDIA)),
    "AI compute doubles every 2 years": dict(
        story="Steady compute growth with no slowdown, at about a third of the pace of the latest measured doubling.",
        values={"compute_doubling_years": 2.0, "compute_growth_decay": 0.0}),
    "Tasks complement (low substitution)": dict(
        story="Compute and workers are complements: more compute makes workers more productive and AI income stays small.",
        values={"sigma": 0.5}),
    "Tasks substitute (high substitution)": dict(
        story="Compute replaces labour easily: the labour share falls and AI owners take a large share of income.",
        values={"sigma": 2.5}),
    "Demand failure (Keynes), high substitution": dict(
        story="Compute replaces labour and investment does not absorb the extra saving of owners, so demand falls short of potential output.",
        values={"sigma": 2.5, "say_pass_through": 0.0}),
    "Automation tax 25 percent with UBI": dict(
        story="The same high-substitution world with a 25% tax on AI income paid out as an equal UBI.",
        values={"sigma": 2.5, "tax_rate": 0.25}),
    "Research automation": dict(
        story="AI does almost all research tasks within 20 years and compute per unit of capital keeps improving: growth of ideas accelerates.",
        values={"ai_research_share_end": 1.0, "ai_research_ramp_years": 20, "compute_boost": 0.2}),
}


# ---------------------------------------------------------------------------------------------------------------
# helpers shared by the models

def compute_path(p, frozen=False):
    """AI compute index C_t (C_0 = 1) and its yearly growth g_t, t = 0..T."""
    g0 = 2.0 ** (1.0 / p["compute_doubling_years"]) - 1.0
    c = [1.0]
    g = []
    for t in range(T + 1):
        gt = 0.0 if frozen else g0 * (1.0 - p["compute_growth_decay"]) ** t
        g.append(gt)
        if t < T:
            c.append(c[t] * (1.0 + gt))
    return c, g


def _ces(l, c, gamma, rho):
    if abs(rho) < 1e-9:
        return l ** (1.0 - gamma) * c ** gamma
    return ((1.0 - gamma) * l ** rho + gamma * c ** rho) ** (1.0 / rho)


# ---------------------------------------------------------------------------------------------------------------
# Model A

def simulate_a(p, frozen=False):
    lab0, ai0 = p["labour_share0"], p["ai_share0"]
    alpha = 1.0 - lab0 - ai0
    gamma = ai0 / (lab0 + ai0)
    sigma = p["sigma"]
    rho = (sigma - 1.0) / sigma
    n = p["labour_growth"]
    s = p["saving_rate"]
    delta = p["depreciation"]
    dC = p["ai_depreciation"]
    cost_decline = p["ai_cost_decline"]
    k = p["k_output_ratio0"]
    bs = k ** (-alpha)
    c_path, g_path = compute_path(p, frozen)
    out = {key: [] for key in ["gdp", "gdp_per_worker", "wage", "labour_share", "ai_share", "capital_share", "consumption",
                               "ai_invest_share", "k_invest_share", "k_output", "ai_capital_ratio", "r_net", "growth",
                               "compute_index", "crowded_out"]}
    for t in range(T + 1):
        l = (1.0 + n) ** t
        c = c_path[t]
        x = _ces(l, c, gamma, rho)
        a_t = (1.0 + p["tfp_growth"]) ** t
        y = bs * a_t * k ** alpha * x ** (1.0 - alpha)
        if abs(rho) < 1e-9:
            lab_sh = (1.0 - alpha) * (1.0 - gamma)
            ai_sh = (1.0 - alpha) * gamma
        else:
            lab_sh = (1.0 - alpha) * (1.0 - gamma) * (l / x) ** rho
            ai_sh = (1.0 - alpha) * gamma * (c / x) ** rho
        r_net = alpha * y / k - delta
        rho_ai = max(0.05, r_net + dC)
        v = ai_sh * y / rho_ai                                   # value of AI capital implied by its income
        g_v = (1.0 + g_path[t]) * (1.0 - cost_decline) - 1.0     # growth of the money value of the compute stock
        i_ai = v * max(g_v + dC, 0.0)
        i_k = max(0.0, s * y - i_ai)
        out["gdp"].append(y)
        out["gdp_per_worker"].append(y / l)
        out["wage"].append(lab_sh * y / l)
        out["labour_share"].append(lab_sh)
        out["ai_share"].append(ai_sh)
        out["capital_share"].append(alpha)
        out["consumption"].append(y - i_ai - i_k)
        out["ai_invest_share"].append(i_ai / y)
        out["k_invest_share"].append(i_k / y)
        out["k_output"].append(k / y)
        out["ai_capital_ratio"].append(v / y)
        out["r_net"].append(r_net)
        out["compute_index"].append(c)
        out["crowded_out"].append(1.0 if s * y < i_ai else 0.0)
        if t < T:
            k = (1.0 - delta) * k + i_k
    out["growth"] = [out["gdp"][t + 1] / out["gdp"][t] - 1.0 for t in range(T)] + [float("nan")]
    return out


def calibrate_baseline(p, target_growth, years=10, iters=60):
    """Solve tfp_growth and k_output_ratio0 so that the frozen-compute economy sits on a balanced growth path that
    grows at target_growth on average over the first `years` years. Returns (tfp_growth, k_output_ratio0)."""
    q = dict(p)
    k = p["saving_rate"] / (target_growth + p["depreciation"])
    g_a = 0.0
    for _ in range(8):
        q["k_output_ratio0"] = k
        lo, hi = -0.02, 0.10
        for _ in range(iters):
            mid = 0.5 * (lo + hi)
            q["tfp_growth"] = mid
            sim = simulate_a(q, frozen=True)
            gr = (sim["gdp"][years] / sim["gdp"][0]) ** (1.0 / years) - 1.0
            if gr < target_growth:
                lo = mid
            else:
                hi = mid
        g_a = 0.5 * (lo + hi)
        q["tfp_growth"] = g_a
        sim = simulate_a(q, frozen=True)
        ic = sim["ai_invest_share"][0]
        k = (p["saving_rate"] - ic) / (target_growth + p["depreciation"])
    return g_a, k


# ---------------------------------------------------------------------------------------------------------------
# Model B

def research_share_path(p):
    a0, a1, ramp = p["ai_research_share0"], p["ai_research_share_end"], p["ai_research_ramp_years"]
    return [a0 + (a1 - a0) * min(1.0, t / ramp) for t in range(T + 1)]


def bgp_growth(p, a):
    """Long-run growth of ideas for a constant AI research share a. None if it explodes (phi + lambda a >= 1)."""
    den = 1.0 - p["idea_spillover"] - p["research_elasticity"] * a
    if den <= 1e-9:
        return None
    return p["research_elasticity"] * (p["labour_growth"] + a * p["compute_boost"]) / den


def simulate_b(p, automate=True):
    alpha = 1.0 - p["labour_share0"]
    k0 = p["k_output_ratio0"]
    bs = k0 ** (-alpha)
    n, s, delta = p["labour_growth"], p["saving_rate"], p["depreciation"]
    phi, lam = p["idea_spillover"], p["research_elasticity"]
    cap = p["growth_cap"]
    g0 = p["tfp_growth"] / (1.0 - alpha)           # ideas growth at the start, so TFP growth matches Model A
    a_path = research_share_path(p) if automate else [p["ai_research_share0"]] * (T + 1)
    boost = p["compute_boost"] if automate else 0.0
    a_t, k, l, e = 1.0, k0, 1.0, 1.0
    out = {key: [] for key in ["gdp", "gdp_per_worker", "ideas", "growth_ideas", "growth_gdp", "ai_share_research", "k_output", "capped"]}
    first_cap = None
    for t in range(T + 1):
        y = bs * k ** alpha * (a_t * l) ** (1.0 - alpha)
        r = l ** (1.0 - a_path[t]) * (k * e / k0) ** a_path[t]
        g_raw = g0 * r ** lam * a_t ** (phi - 1.0)
        g = min(g_raw, cap)
        capped = g_raw >= cap
        if capped and first_cap is None:
            first_cap = t
        out["gdp"].append(y)
        out["gdp_per_worker"].append(y / l)
        out["ideas"].append(a_t)
        out["growth_ideas"].append(g)
        out["ai_share_research"].append(a_path[t])
        out["k_output"].append(k / y)
        out["capped"].append(1.0 if capped else 0.0)
        if t < T:
            k = (1.0 - delta) * k + s * y
            a_t = a_t * (1.0 + g)
            l = l * (1.0 + n)
            e = e * (1.0 + boost)
    out["growth_gdp"] = [out["gdp"][t + 1] / out["gdp"][t] - 1.0 for t in range(T)] + [float("nan")]
    out["first_cap_year"] = first_cap
    return out


def simulate_b_full(p):
    ai = simulate_b(p, True)
    base = simulate_b(p, False)
    a_end = p["ai_research_share_end"]
    threshold = (1.0 - p["idea_spillover"]) / p["research_elasticity"]
    regime_end = p["idea_spillover"] + p["research_elasticity"] * a_end
    grid = [i / 100.0 for i in range(101)]
    bgp = [bgp_growth(p, a) for a in grid]
    if regime_end >= 1.0 - 1e-9:
        regime = "explosive"
    elif regime_end >= 0.9:
        regime = "near the edge"
    else:
        regime = "constant growth"
    return dict(ai=ai, base=base, share_grid=grid, bgp_growth=bgp, threshold_share=threshold, regime_index=regime_end,
                regime=regime, exploded=regime == "explosive", hit_cap=ai["first_cap_year"] is not None,
                first_cap_year=ai["first_cap_year"])


# ---------------------------------------------------------------------------------------------------------------
# Model C

def _group_incomes(lab, cap_share, ai_share, tau, e, pi, own, y):
    """Disposable incomes of owners and workers, as amounts (y = potential output before the tax response)."""
    base = (1.0 - tau) ** e if tau < 1.0 else 0.0           # share of AI income left after the behavioural response
    taxed = ai_share * base
    revenue = tau * taxed * y
    cap_after = cap_share + taxed * (1.0 - tau)
    y_owners = own * cap_after * y + pi * revenue
    y_workers = lab * y + (1.0 - own) * cap_after * y + (1.0 - pi) * revenue
    potential = y * (1.0 - ai_share * (1.0 - base))
    return y_owners, y_workers, revenue, potential


def _baseline_saving_rate(p, lab, cap_share, ai_share):
    pi, own = p["owner_pop_share"], p["owner_capital_income_share"]
    mo, mw = p["mpc_owners"], p["mpc_workers"]
    ow = own * (cap_share + ai_share)
    wk = lab + (1.0 - own) * (cap_share + ai_share)
    return (1.0 - mo) * ow + (1.0 - mw) * wk


def _evaluate(p, lab, cap_share, ai_share, tau, sigma0):
    """One economy-year of Model C for a given tax rate. Amounts are per unit of potential output (y = 1)."""
    pi, own = p["owner_pop_share"], p["owner_capital_income_share"]
    mo, mw, nu = p["mpc_owners"], p["mpc_workers"], p["say_pass_through"]
    eta, beta = p["crra"], p["owner_welfare_weight"]
    yo, yw, rev, pot = _group_incomes(lab, cap_share, ai_share, tau, p["tax_base_elasticity"], pi, own, 1.0)
    cons_o, cons_w = mo * yo, mw * yw
    saving = pot - cons_o - cons_w
    invest = nu * saving + (1.0 - nu) * sigma0 * pot
    gap = saving - invest                                   # = (1 - nu) (saving - sigma0 * potential output)
    realized = pot - max(gap, 0.0)
    f = realized / pot
    co = cons_o * f / pi                                    # consumption per person, owners
    cw = cons_w * f / (1.0 - pi)                            # consumption per person, workers
    wt_o, wt_w = beta * pi, (1.0 - pi)
    if abs(eta - 1.0) < 1e-9:
        ede = math.exp((wt_o * math.log(co) + wt_w * math.log(cw)) / (wt_o + wt_w))
    else:
        ede = ((wt_o * co ** (1.0 - eta) + wt_w * cw ** (1.0 - eta)) / (wt_o + wt_w)) ** (1.0 / (1.0 - eta))
    return dict(revenue=rev, potential=pot, saving=saving, gap=gap, realized=realized, cons_owners=co, cons_workers=cw,
                ede=ede, income_owners=yo, income_workers=yw, saving_rate=saving / pot)


def simulate_c(p, a):
    pi = p["owner_pop_share"]
    lab0, ai0 = a["labour_share"][0], a["ai_share"][0]
    sigma0 = _baseline_saving_rate(p, lab0, a["capital_share"][0], ai0)
    tau_user = p["tax_rate"]
    paths = {k: [] for k in ["gap_no_tax", "gap_tax", "saving_rate_no_tax", "saving_rate_tax", "ubi_share_gdp", "ubi_share_worker_income",
                             "owner_income_share_no_tax", "owner_income_share_tax", "workers_consumption_gain_pct",
                             "owners_consumption_change_pct", "welfare_gain_pct"]}
    for t in range(T + 1):
        lab, cap, ai = a["labour_share"][t], a["capital_share"][t], a["ai_share"][t]
        e0 = _evaluate(p, lab, cap, ai, 0.0, sigma0)
        e1 = _evaluate(p, lab, cap, ai, tau_user, sigma0)
        paths["gap_no_tax"].append(e0["gap"] / e0["potential"])
        paths["gap_tax"].append(e1["gap"] / e1["potential"])
        paths["saving_rate_no_tax"].append(e0["saving_rate"])
        paths["saving_rate_tax"].append(e1["saving_rate"])
        paths["ubi_share_gdp"].append(e1["revenue"])
        paths["ubi_share_worker_income"].append(e1["revenue"] / (e1["income_workers"] / (1.0 - pi)))
        paths["owner_income_share_no_tax"].append(e0["income_owners"] / e0["potential"])
        paths["owner_income_share_tax"].append(e1["income_owners"] / e1["potential"])
        paths["workers_consumption_gain_pct"].append(100.0 * (e1["cons_workers"] / e0["cons_workers"] - 1.0))
        paths["owners_consumption_change_pct"].append(100.0 * (e1["cons_owners"] / e0["cons_owners"] - 1.0))
        paths["welfare_gain_pct"].append(100.0 * (e1["ede"] / e0["ede"] - 1.0))
    # welfare-maximising tax at the evaluation year
    ty = int(math.floor(min(max(p["eval_year"], 0), T) + 0.5))
    lab, cap, ai = a["labour_share"][ty], a["capital_share"][ty], a["ai_share"][ty]
    base = _evaluate(p, lab, cap, ai, 0.0, sigma0)
    rates = [i / 100.0 for i in range(0, 96)]
    rows = []
    best_i, best = 0, -1e18
    for i, tau in enumerate(rates):
        r = _evaluate(p, lab, cap, ai, tau, sigma0)
        gain = 100.0 * (r["ede"] / base["ede"] - 1.0)
        rows.append(dict(tax=tau, welfare_gain_pct=gain, revenue_pct_gdp=100.0 * r["revenue"] / r["potential"],
                         gap_pct=100.0 * r["gap"] / r["potential"],
                         workers_consumption_gain_pct=100.0 * (r["cons_workers"] / base["cons_workers"] - 1.0),
                         owners_consumption_change_pct=100.0 * (r["cons_owners"] / base["cons_owners"] - 1.0),
                         potential_pct=100.0 * r["potential"] / base["potential"]))
        if gain > best:
            best, best_i = gain, i
    revenue_peak = max(rows, key=lambda r: r["revenue_pct_gdp"])
    return dict(paths=paths, curve=rows, optimal_tax=rates[best_i], optimal_gain_pct=best, baseline_saving_rate=sigma0,
                eval_year=ty, revenue_peak_tax=revenue_peak["tax"], revenue_peak_pct_gdp=revenue_peak["revenue_pct_gdp"],
                gap_no_tax_at_eval=base["gap"] / base["potential"])


# ---------------------------------------------------------------------------------------------------------------

def simulate_m6(params=None):
    p = _full(params)
    a = simulate_a(p)
    a0 = simulate_a(p, frozen=True)
    b = simulate_b_full(p)
    c = simulate_c(p, a)
    return dict(params=p, a=a, a_frozen=a0, b=b, c=c)


def solve_mpc_owners(p, target_saving_rate):
    """mpc_owners such that the baseline saving rate (Model C, no tax) equals target_saving_rate."""
    lab0, ai0 = p["labour_share0"], p["ai_share0"]
    alpha = 1.0 - lab0 - ai0
    own, mw = p["owner_capital_income_share"], p["mpc_workers"]
    ow = own * (alpha + ai0)
    wk = lab0 + (1.0 - own) * (alpha + ai0)
    # target = (1 - mo) ow + (1 - mw) wk
    mo = 1.0 - (target_saving_rate - (1.0 - mw) * wk) / ow
    return mo


def solve_phi(p):
    """idea_spillover that puts the no-AI economy on a balanced growth path: g0 = lambda n / (1 - phi - lambda a0)."""
    alpha = 1.0 - p["labour_share0"]
    g0 = p["tfp_growth"] / (1.0 - alpha)
    return 1.0 - p["research_elasticity"] * p["ai_research_share0"] - p["research_elasticity"] * p["labour_growth"] / g0


# ---------------------------------------------------------------------------------------------------------------
# cross-check against the TypeScript

CHECK_SCENARIOS = {
    "defaults": {},
    "complements (sigma 0.5)": {"sigma": 0.5},
    "strong substitutes (sigma 3), fast compute": {"sigma": 3.0, "compute_doubling_years": 0.8, "compute_growth_decay": 0.05},
    "Cobb-Douglas (sigma 1), no slowdown": {"sigma": 1.0, "compute_growth_decay": 0.0, "compute_doubling_years": 2.0},
    "research automation (explosive)": {"ai_research_share_end": 0.9, "ai_research_ramp_years": 20, "compute_boost": 0.1},
    "tax 25 percent with UBI, Keynesian": {"tax_rate": 0.25, "say_pass_through": 0.0, "sigma": 2.0},
    "India-like": {"labour_share0": 0.524, "saving_rate": 0.346, "labour_growth": 0.0208, "tfp_growth": 0.02, "k_output_ratio0": 3.0,
                   "mpc_workers": 0.85, "mpc_owners": 0.42, "tax_rate": 0.1, "eval_year": 20},
    "log utility, high tax elasticity, owners weight 0.5": {"crra": 1.0, "tax_base_elasticity": 1.2, "owner_welfare_weight": 0.5, "sigma": 2.5, "eval_year": 45},
}


for _name, _spec in PRESETS.items():
    CHECK_SCENARIOS["preset: " + _name] = _spec["values"]


def _flatten(prefix, obj, out):
    if isinstance(obj, dict):
        for k in sorted(obj):
            _flatten(f"{prefix}.{k}" if prefix else k, obj[k], out)
    elif isinstance(obj, (list, tuple)):
        for i, v in enumerate(obj):
            _flatten(f"{prefix}[{i}]", v, out)
    elif isinstance(obj, bool):
        out[prefix] = 1.0 if obj else 0.0
    elif isinstance(obj, (int, float)):
        out[prefix] = float(obj)
    elif obj is None:
        out[prefix] = None
    else:
        out[prefix] = obj


NODE_SNIPPET = """
import { simulateM6, M6_PARAMS, M6_PRESETS } from %(path)s;
const scen = %(scen)s;
const out = {};
for (const [name, p] of Object.entries(scen)) {
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) simulateM6(p);
  const ms = (performance.now() - t0) / 20;
  out[name] = { result: simulateM6(p), ms };
}
console.log(JSON.stringify({ params: M6_PARAMS, presets: M6_PRESETS, scenarios: out }));
"""


def run_check(tol=1e-9, verbose=True):
    ts = ROOT / "web" / "src" / "models" / "m6.ts"
    code = NODE_SNIPPET % {"path": json.dumps(ts.as_uri()), "scen": json.dumps(CHECK_SCENARIOS)}
    res = subprocess.run(["node", "--no-warnings", "--input-type=module", "-e", code], capture_output=True, text=True, timeout=120)
    if res.returncode != 0:
        print(res.stderr)
        raise SystemExit("node failed")
    data = json.loads(res.stdout)
    report = []
    # parameter metadata must match
    ts_params = {q["key"]: q for q in data["params"]}
    meta_ok = True
    for q in PARAMS:
        t = ts_params.get(q["key"])
        if t is None or any(abs(t[f] - q[f]) > 1e-12 for f in ["min", "max", "step", "default"]) or t["group"] != q["group"]:
            meta_ok = False
            print("parameter mismatch:", q["key"])
    if set(ts_params) != set(KEYS):
        meta_ok = False
        print("parameter key sets differ:", set(ts_params) ^ set(KEYS))
    ts_presets = {q["name"]: q for q in data["presets"]}
    if list(ts_presets) != list(PRESETS) or any(ts_presets[k]["story"] != v["story"] or ts_presets[k]["values"] != v["values"] for k, v in PRESETS.items()):
        meta_ok = False
        print("preset mismatch between Python and TypeScript")
    for name, scen in CHECK_SCENARIOS.items():
        py = simulate_m6(scen)
        py.pop("params")
        flat_py, flat_ts = {}, {}
        _flatten("", py, flat_py)
        r = data["scenarios"][name]["result"]
        r.pop("params", None)
        _flatten("", r, flat_ts)
        # compare the numeric content that both sides define
        worst, worst_key, n = 0.0, "", 0
        missing = []
        for k, v in flat_py.items():
            if k not in flat_ts:
                missing.append(k)
                continue
            w = flat_ts[k]
            if v is None or w is None or (isinstance(v, float) and math.isnan(v)) or (isinstance(w, float) and math.isnan(w)):
                if not ((v is None or (isinstance(v, float) and math.isnan(v))) and (w is None or (isinstance(w, float) and math.isnan(w)))):
                    worst, worst_key = float("inf"), k
                continue
            if isinstance(v, str) or isinstance(w, str):
                if v != w:
                    worst, worst_key = float("inf"), k
                continue
            n += 1
            err = abs(v - w) / max(1.0, abs(v))
            if err > worst:
                worst, worst_key = err, k
        report.append(dict(scenario=name, compared=n, worst_rel_error=worst, worst_key=worst_key, missing=len(missing),
                           ms_per_call=data["scenarios"][name]["ms"], optimal_tax=py["c"]["optimal_tax"]))
    if verbose:
        print(f"parameter metadata and presets identical in Python and TypeScript: {meta_ok}")
        for r in report:
            print(f"  {r['scenario']:<55} values compared {r['compared']:>5}  worst relative error {r['worst_rel_error']:.2e}  "
                  f"({r['worst_key'][:40]})  missing {r['missing']}  TS {r['ms_per_call']:.3f} ms/call")
    ok = meta_ok and all(r["worst_rel_error"] < tol and r["missing"] == 0 for r in report)
    print("CHECK PASSED" if ok else "CHECK FAILED")
    return ok, report


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(0 if run_check()[0] else 1)
    res = simulate_m6()
    print(json.dumps({"optimal_tax": res["c"]["optimal_tax"], "gdp60": res["a"]["gdp"][-1], "labour_share60": res["a"]["labour_share"][-1]}))
