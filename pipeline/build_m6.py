"""M6: macro and policy. Calibration data for the three models in docs/model-m6.md.

Reads (raw files; fetch them first with `python3 -I pipeline/fetch_pwt.py`; the Epoch files come from fetch.py):
  data/raw/epoch_ai/ai_chip_sales.zip, data_centers.zip           Epoch AI, CC BY
  data/raw/pwt/pwt110.xlsx                                         Penn World Table 11.0, CC BY 4.0
  data/raw/ilo_labour_share/ilo_labour_income_share_gdp.csv       ILOSTAT, CC BY 4.0
  data/raw/fred_macro/*.csv                                        BLS, BEA and Federal Reserve series via FRED
  data/raw/worldbank_macro/*.json                                  World Bank WDI, CC BY 4.0

Writes (data/processed/):
  m6_compute_stock.csv         quarterly AI chip shipments and cumulative stock (H100 equivalents), power, spending
  m6_datacenter_capacity.csv   quarterly capacity of the data centres Epoch tracks (MW, H100e, capital cost)
  m6_compute_growth.csv        growth rates and doubling times (compute stock, shipments, data-centre power, chip efficiency)
  m6_labour_share.csv          labour-share series: PWT, ILO, BLS (US nonfarm business), BEA (US compensation share)
  m6_macro_calibration.csv     annual macro panel for the USA, India and the world: PWT plus World Bank variables
  m6_parameters.csv            every model parameter: range, USA and India defaults, kind (data, derived, assumption), source
  m6_preset_results.csv        key numbers from each preset scenario (from the Python reference model)

Run:  uv run python pipeline/build_m6.py          (deterministic; no network)

Definitions and choices
  - Compute stock = cumulative chip shipments in H100 equivalents (Epoch's H100e, 8-bit performance relative to an H100)
    since 2022 Q1 for Nvidia, 2022 Q4 for Google TPU and 2024 Q1 for AMD, Amazon Trainium, Huawei Ascend and Cambricon.
    It is a count of chips shipped, with no retirements, so it is an upper bound of the installed stock; chips shipped
    before 2022 are not in it. A quarter counts as complete when all six designers report it (through 2026 Q2).
  - Doubling times come from log-linear fits with Newey-West (2 lags) standard errors, using only complete quarters.
  - Labour share: PWT labsh is the share of labour compensation in GDP at current national prices (it adjusts for
    self-employed income); the ILO series is the national-accounts based labour income share and differs in level.
  - World aggregate of labsh: GDP-weighted (PWT cgdpo) mean over countries that report it in that year.
  - Levels are 2013 to 2023 averages (PWT) or 2020 to 2024 averages (World Bank); growth rates are 2003 to 2023.
"""
import io
import json
import math
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm

import m6_reference as ref

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
LAST_COMPLETE_QUARTER = "2026Q2"      # all six chip designers report through this quarter
RETRIEVED = pd.Timestamp("2026-11-22")  # date the Epoch files were downloaded (data/manifest.json)


# ---------------------------------------------------------------------------------------------------------------
# helpers

def hac_fit(x, y, maxlags=2):
    """OLS of y on x with Newey-West standard errors. Returns slope, se, (lo, hi), r2."""
    X = sm.add_constant(np.asarray(x, float))
    r = sm.OLS(np.asarray(y, float), X).fit(cov_type="HAC", cov_kwds={"maxlags": maxlags})
    b, se = float(r.params[1]), float(r.bse[1])
    return b, se, (b - 1.96 * se, b + 1.96 * se), float(r.rsquared)


def doubling(slope):
    return math.log(2) / slope if slope > 0 else float("nan")


def fit_row(series, window, x_years, values, unit, note=""):
    """Log-linear fit of `values` on `x_years`. Returns a row with growth and doubling time."""
    values = np.asarray(values, float)
    ok = values > 0
    b, se, (lo, hi), r2 = hac_fit(np.asarray(x_years)[ok], np.log(values[ok]))
    return {"series": series, "window": window, "n_points": int(ok.sum()), "unit": unit,
            "log_growth_per_year": b, "annual_growth_factor": math.exp(b), "doubling_years": doubling(b),
            "doubling_years_ci_low": doubling(hi) if hi > 0 else float("nan"),
            "doubling_years_ci_high": doubling(lo) if lo > 0 else float("inf"), "r2": r2, "note": note}


def wb_series(ind):
    j = json.load(open(RAW / "worldbank_macro" / f"{ind}.json"))
    rows = [{"area": r["countryiso3code"], "year": int(r["date"]), "value": r["value"]} for r in j[1] if r["value"] is not None]
    return pd.DataFrame(rows).pivot(index="year", columns="area", values="value").sort_index()


def fred(sid):
    d = pd.read_csv(RAW / "fred_macro" / f"{sid}.csv", parse_dates=["observation_date"])
    return d.set_index("observation_date")[sid].astype(float)


# ---------------------------------------------------------------------------------------------------------------
# 1. AI compute and data centres (Epoch AI)

def build_compute():
    z = zipfile.ZipFile(RAW / "epoch_ai" / "ai_chip_sales.zip")
    t = pd.read_csv(io.BytesIO(z.read("timelines_by_chip.csv")))
    t["q"] = pd.PeriodIndex(pd.to_datetime(t["End date"]), freq="Q")
    h = "Compute estimate in H100e (median)"
    flows = t.pivot_table(index="q", columns="Chip manufacturer", values=h, aggfunc="sum").fillna(0.0)
    designers = list(flows.columns)
    first_q = {d: str(t[t["Chip manufacturer"] == d].q.min()) for d in designers}
    q = pd.DataFrame(index=flows.index)
    q["quarter"] = [str(i) for i in flows.index]
    q["quarter_end"] = [i.end_time.normalize().strftime("%Y-%m-%d") for i in flows.index]
    q["n_designers_reporting"] = (t.groupby("q")["Chip manufacturer"].nunique()).reindex(flows.index).values
    q["complete"] = (q["quarter"] <= LAST_COMPLETE_QUARTER) & ((q["n_designers_reporting"] == len(designers)) | (q["quarter"] < "2024Q1"))
    q["shipments_h100e"] = flows.sum(axis=1).values
    for d in designers:
        q[f"shipments_h100e_{d.lower()}"] = flows[d].values
    q["shipments_h100e_low_sum_p5"] = t.pivot_table(index="q", columns="Chip manufacturer", values="H100e (5th percentile)", aggfunc="sum").sum(axis=1).values
    q["shipments_h100e_high_sum_p95"] = t.pivot_table(index="q", columns="Chip manufacturer", values="H100e (95th percentile)", aggfunc="sum").sum(axis=1).values
    q["cumulative_h100e"] = q["shipments_h100e"].cumsum()
    q["cumulative_h100e_nvidia_only"] = flows["Nvidia"].cumsum().values
    tdp = t.pivot_table(index="q", columns="Chip manufacturer", values="Total TDP (W)", aggfunc="sum").fillna(0.0).sum(axis=1)
    q["shipments_tdp_mw"] = (tdp / 1e6).values
    q["cumulative_tdp_mw"] = q["shipments_tdp_mw"].cumsum()
    q["spending_usd_bn"] = (t.pivot_table(index="q", columns="Chip manufacturer", values="Cost Estimate (USD)", aggfunc="sum").sum(axis=1) / 1e9).values
    q["cumulative_growth_yoy"] = q["cumulative_h100e"] / q["cumulative_h100e"].shift(4) - 1.0
    q["shipments_growth_yoy"] = q["shipments_h100e"] / q["shipments_h100e"].shift(4) - 1.0
    q["note"] = np.where(q["quarter"] < "2024Q1", "only Nvidia (and Google TPU from 2022Q4) are in the data; AMD, Amazon, Huawei and Cambricon start in 2024Q1",
                         np.where(q["complete"], "", "partial or forward-looking quarter (Epoch flags it incomplete); not used in fits"))
    q = q.reset_index(drop=True)
    # the cumulative column includes the incomplete quarters; keep them visible but flagged
    q.round(4).to_csv(OUT / "m6_compute_stock.csv", index=False)

    # data centres: forward-fill each site's timeline to quarter ends
    zd = zipfile.ZipFile(RAW / "epoch_ai" / "data_centers.zip")
    tl = pd.read_csv(io.BytesIO(zd.read("data_center_timelines.csv")), parse_dates=["Date"])
    dcs = pd.read_csv(io.BytesIO(zd.read("data_centers.csv")))
    country = dcs.set_index("Name")["Country"]
    tl["country"] = tl["Data center"].map(country)
    rows = []
    for per in pd.period_range("2021Q1", "2030Q4", freq="Q"):
        qe = per.end_time.normalize()
        sub = tl[tl.Date <= qe].sort_values("Date").groupby("Data center").tail(1)
        us = sub[sub.country == "United States"]
        rows.append({"quarter": str(per), "quarter_end": qe.strftime("%Y-%m-%d"),
                     "status": "observed" if qe <= RETRIEVED else "planned (Epoch projection)",
                     "n_sites_tracked": len(sub), "n_sites_operating": int((sub["IT power (MW)"] > 0).sum()),
                     "it_power_mw": sub["IT power (MW)"].sum(), "facility_power_mw": sub["Power (MW)"].sum(),
                     "h100e": sub["H100 equivalents"].sum(), "capital_cost_usd_bn_2025": sub["Total capital cost (2025 USD billions)"].sum(),
                     "compute_cost_usd_bn_2025": sub["Compute cost (2025 USD billions)"].sum(),
                     "it_power_mw_us": us["IT power (MW)"].sum(), "capital_cost_usd_bn_2025_us": us["Total capital cost (2025 USD billions)"].sum()})
    dc = pd.DataFrame(rows)
    dc["it_power_growth_yoy"] = dc["it_power_mw"] / dc["it_power_mw"].shift(4) - 1.0
    dc.loc[dc.it_power_mw.shift(4) <= 0, "it_power_growth_yoy"] = np.nan
    dc.round(3).to_csv(OUT / "m6_datacenter_capacity.csv", index=False)

    # growth and doubling times
    qq = q.copy()
    qq["t"] = [pd.Period(x, "Q").start_time.year + (pd.Period(x, "Q").quarter - 1) / 4 for x in qq.quarter]
    comp = qq[qq.complete]
    fits = []

    def window(df, a, b):
        return df[(df.quarter >= a) & (df.quarter <= b)]

    for lab, (a, b) in {"2024Q1-2026Q2 (all six designers)": ("2024Q1", "2026Q2"), "2025Q2-2026Q2 (latest year)": ("2025Q2", "2026Q2"),
                        "2024Q2-2025Q2 (year before)": ("2024Q2", "2025Q2")}.items():
        w = window(comp, a, b)
        fits.append(fit_row("AI chip stock (cumulative shipments, H100e)", lab, w.t, w.cumulative_h100e, "H100e",
                            "cumulative shipments; no retirements"))
    w = window(comp, "2022Q1", "2026Q2")
    fits.append(fit_row("Nvidia chip stock only (cumulative H100e)", "2022Q1-2026Q2", w.t, w.cumulative_h100e_nvidia_only, "H100e",
                        "one designer, longest consistent coverage"))
    w = window(comp, "2024Q1", "2026Q2")
    fits.append(fit_row("AI chip shipments per quarter (H100e)", "2024Q1-2026Q2", w.t, w.shipments_h100e, "H100e per quarter", "flow, not stock"))
    w = window(comp, "2024Q1", "2026Q2")
    fits.append(fit_row("AI chip stock power (cumulative TDP)", "2024Q1-2026Q2", w.t, w.cumulative_tdp_mw, "MW", "chip thermal design power, not data-centre power"))
    w = window(comp, "2024Q1", "2026Q2")
    fits.append(fit_row("AI chip spending per quarter (Epoch cost estimate)", "2024Q1-2026Q2", w.t, w.spending_usd_bn, "USD bn per quarter", "chip purchase cost only"))
    d = dc.copy()
    d["t"] = [pd.Period(x, "Q").start_time.year + (pd.Period(x, "Q").quarter - 1) / 4 for x in d.quarter]
    obs = d[(d.status == "observed") & (d.quarter <= "2026Q3")]
    for lab, (a, b) in {"2024Q1-2026Q3": ("2024Q1", "2026Q3"), "2025Q3-2026Q3 (latest year)": ("2025Q3", "2026Q3")}.items():
        w = obs[(obs.quarter >= a) & (obs.quarter <= b)]
        fits.append(fit_row("Tracked data-centre IT power", lab, w.t, w.it_power_mw, "MW",
                            "96 sites tracked by Epoch; early growth is overstated because only sites that are large today are listed"))
        fits.append(fit_row("Tracked data-centre H100 equivalents", lab, w.t, w.h100e, "H100e", "same sites"))

    # chip efficiency (hardware performance per dollar and per watt, by release date)
    zc = pd.read_csv(io.BytesIO(z.read("chip_types.csv")))
    zc["rel"] = pd.to_datetime(zc["Release date"], errors="coerce")
    zc["year"] = zc.rel.dt.year + (zc.rel.dt.day_of_year - 1) / 365.25
    zc["h_per_usd"] = zc["H100e"] / zc["Cost per chip (approx.)"]
    watt = zc["TDP (W) (from ML Hardware (linked))"].fillna(zc["Unofficial estimated TDP (W)"])
    zc["h_per_w"] = zc["H100e"] / watt
    for col, name, unit in [("h_per_usd", "Hardware performance per dollar (H100e per chip price)", "H100e per USD"),
                            ("h_per_w", "Hardware performance per watt (H100e per chip TDP)", "H100e per W")]:
        w = zc[(zc[col] > 0) & zc.year.notna()]
        fits.append(fit_row(name, f"chips released {int(w.year.min())} to {int(w.year.max())}", w.year, w[col], unit,
                            f"{len(w)} chip types; list-price and TDP approximations from Epoch"))
    fit_df = pd.DataFrame(fits)
    fit_df.round(4).to_csv(OUT / "m6_compute_growth.csv", index=False)

    # numbers other parts need
    last = q[q.quarter == LAST_COMPLETE_QUARTER].iloc[0]
    info = {
        "cum_h100e_last": float(last.cumulative_h100e), "last_quarter": LAST_COMPLETE_QUARTER,
        "doubling_latest_year": float(fit_df.iloc[1].doubling_years), "doubling_since_2024": float(fit_df.iloc[0].doubling_years),
        "doubling_dc_power_latest": float(fit_df[(fit_df.series == "Tracked data-centre IT power") & fit_df.window.str.contains("latest")].doubling_years.iloc[0]),
        "perf_per_usd_factor": float(fit_df[fit_df.series.str.startswith("Hardware performance per dollar")].annual_growth_factor.iloc[0]),
        "perf_per_watt_factor": float(fit_df[fit_df.series.str.startswith("Hardware performance per watt")].annual_growth_factor.iloc[0]),
        "dc_h100e_last_complete": float(dc[dc.quarter == LAST_COMPLETE_QUARTER].h100e.iloc[0]),
        "dc_it_power_mw_2026q3": float(dc[dc.quarter == "2026Q3"].it_power_mw.iloc[0]),
        "dc_cap_us_2026q3": float(dc[dc.quarter == "2026Q3"].capital_cost_usd_bn_2025_us.iloc[0]),
        "dc_cap_all_2026q3": float(dc[dc.quarter == "2026Q3"].capital_cost_usd_bn_2025.iloc[0]),
        "chip_spend_last4_usd_bn": float(q[(q.quarter > "2025Q2") & (q.quarter <= LAST_COMPLETE_QUARTER)].spending_usd_bn.sum()),
        "first_quarter_by_designer": first_q,
    }
    return info, fit_df, q, dc


# ---------------------------------------------------------------------------------------------------------------
# 2. Labour share and macro calibration

def load_pwt():
    d = pd.read_excel(RAW / "pwt" / "pwt110.xlsx", sheet_name="Data")
    return d.sort_values(["countrycode", "year"]).reset_index(drop=True)


def build_labour_share(pwt):
    rows = []

    def add(series, area, year, value, unit, source, note=""):
        rows.append({"series": series, "area": area, "year": int(year), "value": float(value), "unit": unit, "source": source, "note": note})

    for c in ["USA", "IND", "CHN"]:
        s = pwt[pwt.countrycode == c].dropna(subset=["labsh"]).reset_index(drop=True)
        rep = (s.labsh == s.labsh.shift(1)) | (s.labsh == s.labsh.shift(-1))     # identical to a neighbouring year
        for i, r in s.iterrows():
            add("PWT labsh", c, r.year, r.labsh, "share of GDP", "Penn World Table 11.0",
                "same value as a neighbouring year: PWT assumes the share constant where it has no observation (flag i_labsh2 in the labour detail file)" if rep[i] else "")
    w = pwt.dropna(subset=["labsh", "cgdpo"])
    wsum = pwt.dropna(subset=["cgdpo"]).groupby("year").cgdpo.sum()
    for yr, g in w.groupby("year"):
        add("PWT labsh", "World (GDP-weighted)", yr, np.average(g.labsh, weights=g.cgdpo), "share of GDP", "Penn World Table 11.0",
            f"cgdpo-weighted mean over {len(g)} countries covering {100 * g.cgdpo.sum() / wsum[yr]:.0f}% of world output")
    ilo = pd.read_csv(RAW / "ilo_labour_share" / "ilo_labour_income_share_gdp.csv")
    names = ilo.drop_duplicates("REF_AREA").set_index("REF_AREA")["Reference area"].to_dict()
    for _, r in ilo.iterrows():
        yr = int(r["TIME_PERIOD"])
        add("ILO labour income share", names[r["REF_AREA"]] if r["REF_AREA"] != "X01" else "World", yr, r["OBS_VALUE"] / 100.0, "share of GDP",
            "ILOSTAT modelled estimates, Nov. 2025", "ILO modelled estimate; later years are model projections" if yr >= 2025 else "ILO modelled estimate")
    bls = fred("PRS85006173")
    ann = bls.groupby(bls.index.year).agg(["mean", "count"])
    for yr, r in ann.iterrows():
        if r["count"] == 4:
            add("BLS nonfarm business labor share", "USA", yr, r["mean"], "index 2017=100", "BLS via FRED (PRS85006173)", "annual mean of four quarters")
    bea = fred("A4002E1A156NBEA")
    for dt, v in bea.items():
        add("BEA compensation of employees, share of gross domestic income", "USA", dt.year, v / 100.0, "share of GDI", "BEA via FRED (A4002E1A156NBEA)")
    df = pd.DataFrame(rows)
    df.round(5).to_csv(OUT / "m6_labour_share.csv", index=False)
    return df


def _growth(s, a, b):
    return (math.log(s.loc[b]) - math.log(s.loc[a])) / (b - a)


def build_macro(pwt):
    wbs = {k: wb_series(v) for k, v in {
        "gdp_growth_wb": "NY.GDP.MKTP.KD.ZG", "gross_saving_pct_gdp": "NY.GNS.ICTR.ZS", "gross_domestic_saving_pct_gdp": "NY.GDS.TOTL.ZS",
        "gross_capital_formation_pct_gdp": "NE.GDI.TOTL.ZS", "household_consumption_pct_gdp": "NE.CON.PRVT.ZS",
        "tax_revenue_pct_gdp": "GC.TAX.TOTL.GD.ZS", "real_interest_rate_pct": "FR.INR.RINR", "gdp_current_usd": "NY.GDP.MKTP.CD",
        "population_growth_wb_pct": "SP.POP.GROW"}.items()}
    rows = []
    for c in ["USA", "IND"]:
        s = pwt[pwt.countrycode == c].set_index("year")
        years = sorted(set(s.index) | set(wbs["gdp_current_usd"].index))
        s = s.reindex(years)
        d = pd.DataFrame(index=pd.Index(years, name="year"))
        d["area"] = c
        d["gdp_rgdpna_musd2021"] = s.rgdpna
        d["population_m"] = s["pop"]
        d["employment_m"] = s.emp
        d["labour_share"] = s.labsh
        d["capital_share"] = 1 - s.labsh
        d["depreciation"] = s.delta
        d["capital_output_ratio"] = s.rnna / s.rgdpna
        d["internal_rate_of_return"] = s.irr
        d["investment_share_pwt"] = s.csh_i
        d["tfp_rtfpna"] = s.rtfpna
        d["gdp_growth"] = np.log(s.rgdpna).diff()
        d["employment_growth"] = np.log(s.emp).diff()
        d["population_growth"] = np.log(s["pop"]).diff()
        d["tfp_growth"] = np.log(s.rtfpna).diff()
        d["capital_growth"] = np.log(s.rnna).diff()
        for k, v in wbs.items():
            d[k] = v[c].reindex(d.index) if c in v else np.nan
        rows.append(d.reset_index())
    # world: PWT aggregates over countries with data
    g = pwt.dropna(subset=["rgdpna", "rnna", "emp", "pop"]).copy()
    out = []
    for yr, x in g.groupby("year"):
        out.append({"year": yr, "area": "WLD", "gdp_rgdpna_musd2021": x.rgdpna.sum(), "population_m": x["pop"].sum(), "employment_m": x.emp.sum(),
                    "capital_output_ratio": x.rnna.sum() / x.rgdpna.sum()})
    wd = pd.DataFrame(out).set_index("year")
    lab = pwt.dropna(subset=["labsh", "cgdpo"]).groupby("year").apply(lambda x: np.average(x.labsh, weights=x.cgdpo), include_groups=False)
    wd["labour_share"] = lab
    wd["capital_share"] = 1 - wd.labour_share
    dl = pwt.dropna(subset=["delta", "rnna"]).groupby("year").apply(lambda x: np.average(x.delta, weights=x.rnna), include_groups=False)
    wd["depreciation"] = dl
    irr = pwt.dropna(subset=["irr", "rnna"]).groupby("year").apply(lambda x: np.average(x.irr, weights=x.rnna), include_groups=False)
    wd["internal_rate_of_return"] = irr
    # growth of the world on a constant sample of countries (those present in both years)
    tfp = pwt.dropna(subset=["rtfpna"]).set_index(["year", "countrycode"]).rtfpna
    gg, eg, pg, tg = {}, {}, {}, {}
    for yr in wd.index[1:]:
        a = g[g.year == yr].set_index("countrycode")
        b = g[g.year == yr - 1].set_index("countrycode")
        common = a.index.intersection(b.index)
        gg[yr] = math.log(a.loc[common].rgdpna.sum() / b.loc[common].rgdpna.sum())
        eg[yr] = math.log(a.loc[common].emp.sum() / b.loc[common].emp.sum())
        pg[yr] = math.log(a.loc[common]["pop"].sum() / b.loc[common]["pop"].sum())
        cm = [c for c in common if (yr, c) in tfp.index and (yr - 1, c) in tfp.index]
        if cm:
            w = b.loc[cm].rgdpna
            tg[yr] = float(np.average([math.log(tfp[(yr, c)] / tfp[(yr - 1, c)]) for c in cm], weights=w))
    wd["gdp_growth"], wd["employment_growth"], wd["population_growth"], wd["tfp_growth"] = pd.Series(gg), pd.Series(eg), pd.Series(pg), pd.Series(tg)
    wd = wd.reindex(sorted(set(wd.index) | set(wbs["gdp_current_usd"].index)))
    wd.index.name = "year"
    for k, v in wbs.items():
        wd[k] = v["WLD"].reindex(wd.index) if "WLD" in v else np.nan
    rows.append(wd.reset_index())
    macro = pd.concat(rows, ignore_index=True)
    cols = ["area", "year"] + [c for c in macro.columns if c not in ("area", "year")]
    macro = macro[cols].sort_values(["area", "year"])
    macro.round(5).to_csv(OUT / "m6_macro_calibration.csv", index=False)
    return macro


# ---------------------------------------------------------------------------------------------------------------
# 3. calibration of the model parameters

def country_calibration(macro, area, info, p_base):
    m = macro[macro.area == area].set_index("year")
    lv = m.loc[2013:2023]
    cal = {
        "labour_share0": float(lv.labour_share.mean()), "depreciation": float(lv.depreciation.mean()),
        "labour_growth": float((math.log(m.loc[2023, "employment_m"]) - math.log(m.loc[2003, "employment_m"])) / 20),
        "gdp_growth_target": float((math.log(m.loc[2023, "gdp_rgdpna_musd2021"]) - math.log(m.loc[2003, "gdp_rgdpna_musd2021"])) / 20),
        "saving_rate": float(m.loc[2020:2024, "gross_capital_formation_pct_gdp"].mean() / 100),
        "gross_saving_rate": float(m.loc[2020:2024, "gross_domestic_saving_pct_gdp"].mean() / 100),
        "k_output_data": float(lv.capital_output_ratio.mean()), "tfp_growth_pwt": float((math.log(m.loc[2023, "tfp_rtfpna"]) - math.log(m.loc[2003, "tfp_rtfpna"])) / 20),
        "irr": float(lv.internal_rate_of_return.mean()),
    }
    return cal


def solve_country(cal, p_base, ai_share0):
    p = dict(p_base)
    p.update(labour_share0=cal["labour_share0"], depreciation=cal["depreciation"], labour_growth=cal["labour_growth"],
             saving_rate=cal["saving_rate"], ai_share0=ai_share0)
    g_a, k0 = ref.calibrate_baseline(p, cal["gdp_growth_target"])
    p["tfp_growth"], p["k_output_ratio0"] = g_a, k0
    p["idea_spillover"] = ref.solve_phi(p)
    return p


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    info, fits, chips, dcs = build_compute()
    pwt = load_pwt()
    lab = build_labour_share(pwt)
    macro = build_macro(pwt)

    base = ref.defaults()
    us_cal = country_calibration(macro, "USA", info, base)
    in_cal = country_calibration(macro, "IND", info, base)

    # AI compute income share today (USA): capital in tracked US data centres, scaled to GDP and priced at the required return
    gdp_us = float(macro[(macro.area == "USA") & (macro.year == 2025)].gdp_current_usd.iloc[0]) / 1e9
    v_low = info["dc_cap_us_2026q3"] / gdp_us                                      # tracked US sites only
    coverage = info["dc_h100e_last_complete"] / info["cum_h100e_last"]             # tracked sites' share of all chips shipped
    v_high = v_low / coverage                                                      # all chips assumed to be priced like tracked US sites
    required = us_cal["irr"] + base["ai_depreciation"]
    ai_low, ai_high = v_low * required, v_high * required
    ai_mid = round(0.5 * (ai_low + ai_high), 3)
    info.update(ai_capital_gdp_low=v_low, ai_capital_gdp_high=v_high, coverage=coverage, required_return=required,
                ai_share_low=ai_low, ai_share_high=ai_high, ai_share_default=ai_mid)

    us = solve_country(us_cal, base, ai_mid)
    us["mpc_owners"] = ref.solve_mpc_owners(us, us_cal["gross_saving_rate"])
    # data-based defaults that are not solved: compute doubling time, cost decline, owners' equity share
    own_q = fred("WFRBST01122").index.intersection(fred("WFRBSN09149").index).max()
    own_share = (fred("WFRBST01122")[own_q] + fred("WFRBSN09149")[own_q]) / 100.0
    us["compute_doubling_years"] = info["doubling_latest_year"]
    us["ai_cost_decline"] = 1.0 - 1.0 / info["perf_per_usd_factor"]
    us["owner_capital_income_share"] = own_share
    info["owner_equity_share"], info["owner_equity_quarter"] = own_share, str(own_q.date())
    ind_base = dict(base, mpc_workers=0.85)
    ind = solve_country(in_cal, ind_base, 0.002)
    ind["mpc_workers"] = 0.85
    ind["mpc_owners"] = ref.solve_mpc_owners(ind, in_cal["gross_saving_rate"])

    # parameters table
    src = {
        "labour_share0": "PWT 11.0 labsh, mean 2013-2023", "ai_share0": "Epoch AI data-centre capital cost (US sites, 2026 Q3) / US GDP (World Bank 2025), times PWT internal rate of return plus 20% depreciation; midpoint of tracked-only and all-chips bounds",
        "saving_rate": "World Bank NE.GDI.TOTL.ZS, mean 2020-2024", "depreciation": "PWT 11.0 delta, mean 2013-2023", "labour_growth": "PWT 11.0 emp, 2003-2023 log growth",
        "tfp_growth": "solved in build_m6.py (calibrate_baseline) so that frozen-compute GDP grows at the PWT 2003-2023 rate",
        "k_output_ratio0": "solved with tfp_growth: balanced growth path (K/Y = (s - AI investment) / (g + depreciation))",
        "sigma": "assumption; literature range 0.5-0.7 (Oberfield and Raval 2021), about 1.25 (Karabarbounis and Neiman 2014)",
        "compute_doubling_years": "Epoch AI chip sales, doubling time of cumulative H100e, 2025Q2-2026Q2 (m6_compute_growth.csv)",
        "compute_growth_decay": "assumption", "ai_depreciation": "assumption (about a five-year hardware life)",
        "ai_cost_decline": "Epoch AI chip_types: H100e per chip price by release date (m6_compute_growth.csv)",
        "idea_spillover": "solved in build_m6.py (solve_phi) so the no-AI economy is on a balanced growth path given lambda and workforce growth",
        "research_elasticity": "assumption", "ai_research_share0": "assumption", "ai_research_share_end": "assumption", "ai_research_ramp_years": "assumption",
        "compute_boost": "assumption", "growth_cap": "assumption", "owner_pop_share": "assumption (top decile)",
        "owner_capital_income_share": "Federal Reserve DFA via FRED WFRBST01122 + WFRBSN09149 (top 10% share of corporate equities and mutual fund shares, 2026 Q2)",
        "mpc_workers": "assumption; US personal saving rate averaged about 7% in 2015-2025 (BEA PSAVERT) and lower-wealth households save less",
        "mpc_owners": "solved in build_m6.py (solve_mpc_owners) so the baseline saving rate equals the World Bank gross domestic saving rate, 2020-2024",
        "say_pass_through": "assumption", "crra": "assumption", "owner_welfare_weight": "assumption", "tax_rate": "policy choice", "tax_base_elasticity": "assumption",
        "eval_year": "policy choice",
    }
    rows = []
    for q in ref.PARAMS:
        k = q["key"]
        rows.append({"key": k, "label": q["label"], "group": q["group"], "kind": q["kind"], "unit": q["unit"], "min": q["min"], "max": q["max"],
                     "step": q["step"], "default_usa": q["default"], "default_india": ref.INDIA.get(k, q["default"]),
                     "calibrated_usa": us.get(k, np.nan), "calibrated_india": ind.get(k, np.nan), "source": src[k], "help": q["help"]})
    par = pd.DataFrame(rows)
    par.loc[par.kind == "assumption", ["calibrated_usa", "calibrated_india"]] = np.nan          # assumptions have no calibrated value
    par.loc[par.key == "ai_share0", "calibrated_india"] = np.nan
    par.loc[par.key == "idea_spillover", "calibrated_india"] = np.nan                            # Model B is calibrated for the frontier only
    par.round(5).to_csv(OUT / "m6_parameters.csv", index=False)

    # preset results
    res_rows = []
    for name, spec in ref.PRESETS.items():
        out = ref.simulate_m6(spec["values"])
        a, fr, b, c = out["a"], out["a_frozen"], out["b"], out["c"]
        ev = c["eval_year"]
        metrics = {
            "A gdp multiple at year 30 (today = 1)": a["gdp"][30], "A gdp multiple at year 60": a["gdp"][60],
            "A gdp at year 60 relative to frozen-compute path": a["gdp"][60] / fr["gdp"][60],
            "A wage at year 30 relative to frozen-compute path": a["wage"][30] / fr["wage"][30],
            "A wage at year 60 relative to frozen-compute path": a["wage"][60] / fr["wage"][60],
            "A labour share today": a["labour_share"][0], "A labour share at year 30": a["labour_share"][30], "A labour share at year 60": a["labour_share"][60],
            "A AI income share at year 30": a["ai_share"][30], "A AI income share at year 60": a["ai_share"][60],
            "A consumption at year 30 relative to frozen-compute path": a["consumption"][30] / fr["consumption"][30],
            "A GDP growth, years 1-10 average": (a["gdp"][10] / a["gdp"][0]) ** 0.1 - 1,
            "A crowded-out years (AI spending above saving)": sum(a["crowded_out"]),
            "B long-run regime index (phi + lambda a_end)": b["regime_index"], "B regime": b["regime"],
            "B ideas growth at year 30": b["ai"]["growth_ideas"][30], "B ideas growth at year 60": b["ai"]["growth_ideas"][60],
            "B GDP at year 60 relative to no-automation path": b["ai"]["gdp"][60] / b["base"]["gdp"][60],
            "B year ideas growth hits the cap (blank if never)": b["first_cap_year"],
            "C baseline saving rate": c["baseline_saving_rate"], "C evaluation year": ev,
            "C demand gap without tax at evaluation year (% of potential)": 100 * c["paths"]["gap_no_tax"][ev],
            "C demand gap with tax at evaluation year (% of potential)": 100 * c["paths"]["gap_tax"][ev],
            "C UBI at evaluation year (% of GDP)": 100 * c["paths"]["ubi_share_gdp"][ev],
            "C welfare change from the chosen tax at evaluation year (%)": c["paths"]["welfare_gain_pct"][ev],
            "C welfare-maximising tax rate": c["optimal_tax"], "C welfare gain at that rate (%)": c["optimal_gain_pct"],
            "C revenue-maximising tax rate": c["revenue_peak_tax"],
        }
        for k, v in metrics.items():
            res_rows.append({"preset": name, "metric": k, "value": v if not isinstance(v, float) else round(v, 5)})
    pd.DataFrame(res_rows).to_csv(OUT / "m6_preset_results.csv", index=False)

    # consistency of the defaults hard-coded in m6_reference.py with the calibration
    drift = []
    loose = {"compute_doubling_years": 0.05, "ai_cost_decline": 0.01, "owner_capital_income_share": 0.005}
    for q in ref.PARAMS:
        k = q["key"]
        if k in us and abs(us[k] - q["default"]) > loose.get(k, max(0.002 * abs(q["default"]), 0.0006)):
            drift.append((k, q["default"], round(us[k], 5)))

    for k, v in ref.INDIA.items():
        if abs(ind[k] - v) > max(0.002 * abs(v), 0.0006):
            drift.append(("India preset " + k, v, round(ind[k], 5)))

    # ---- report
    print("COMPUTE (Epoch AI)")
    print(fits[["series", "window", "n_points", "annual_growth_factor", "doubling_years", "doubling_years_ci_low", "doubling_years_ci_high"]].round(2).to_string(index=False))
    last = chips[chips.quarter == LAST_COMPLETE_QUARTER].iloc[0]
    print(f"cumulative H100e through {LAST_COMPLETE_QUARTER}: {last.cumulative_h100e / 1e6:.1f} million; quarterly shipments {last.shipments_h100e / 1e6:.2f} million; "
          f"chip spend last 4 quarters ${info['chip_spend_last4_usd_bn']:.0f} bn")
    print(f"tracked data centres (2026Q3): {info['dc_it_power_mw_2026q3'] / 1000:.1f} GW IT power; capital cost ${info['dc_cap_all_2026q3']:.0f} bn (US ${info['dc_cap_us_2026q3']:.0f} bn); "
          f"tracked H100e / shipped H100e = {coverage:.2f}")
    print(f"top 10% share of corporate equities and mutual fund shares ({info['owner_equity_quarter']}): {100 * info['owner_equity_share']:.1f}%")
    print(f"AI compute income share: tracked-only {100 * ai_low:.2f}% , all-chips {100 * ai_high:.2f}% , default {100 * ai_mid:.1f}%")
    print("\nCALIBRATION")
    for nm, cal, p in [("USA", us_cal, us), ("India", in_cal, ind)]:
        print(nm, {k: round(v, 4) for k, v in cal.items()})
        print("   solved:", {k: round(p[k], 4) for k in ["ai_share0", "tfp_growth", "k_output_ratio0", "idea_spillover", "mpc_owners", "mpc_workers"]})
    wl = lab[(lab.series == "PWT labsh") & (lab.area == "World (GDP-weighted)")].set_index("year").value
    print(f"world labsh (PWT, GDP-weighted): 1980 {wl[1980]:.3f}, 2000 {wl[2000]:.3f}, 2023 {wl[2023]:.3f}")
    if drift:
        print("\nUPDATE DEFAULTS in m6_reference.py and m6.ts (calibration differs from hard-coded value):")
        for d in drift:
            print("  ", d)
    else:
        print("\nhard-coded USA defaults agree with the calibration")
    return info, us, ind


if __name__ == "__main__":
    main()
