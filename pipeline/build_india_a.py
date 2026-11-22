"""India lens, Stage A (published data only).  Exploratory.

Question: how much does India use AI chat (Claude.ai) compared with what its income predicts, and
how does the mix of use differ from the world's?

Inputs
  data/raw/anthropic_economic_index_2026_06_26/aei_claude_ai_2026-06-26.csv  (country rows)
  data/raw/worldbank/*.json  (fetched by pipeline/fetch_worldbank.py; CC BY 4.0)
  data/processed/occupations.csv  (titles only, for the occupation tables)
  the benchmark list in this file (published figures read by hand in the sources)

Run from the repo root (after pipeline/fetch_worldbank.py):  uv run python pipeline/build_india_a.py
Outputs (data/processed/)
  india_a_country_data.csv         one row per AEI country: usage index, World Bank covariates, fitted values and residuals
  india_a_regressions.csv          cross-country OLS coefficients (robust SEs)
  india_a_india_summary.csv        India's actual vs predicted usage index, residual and rank, by model
  india_a_robustness.csv           the baseline regression and India's residual under alternative samples and outcomes
  india_a_composition_groups.csv   SOC major-group shares, India vs world
  india_a_composition_occupations.csv  detailed occupations: top by India share, over- and under-indexed
  india_a_composition_activities.csv   O*NET work activities (general and intermediate) and request topics, India vs world
  india_a_use_patterns.csv         work, personal and coursework use; automation and augmentation; India vs world and peers
  india_a_benchmarks.csv           published exposure figures for India (each read in the source)

Definitions
  - Anthropic Usage Index (usage_per_capita_index): a country's share of Claude.ai usage divided by its share of the
    world's working-age (15 to 64) population; 1.0 is proportional to population. Two monthly windows, April and May
    2026; the main outcome is the mean of the two (one window where only one is published).
  - Covariates are the latest World Bank value in 2022 to 2025 for each country (the year is in the country table).
  - Peers: AEI countries whose GDP per capita (PPP) is within a factor of 1.5 of India's.
  - Shares in the AEI are rounded to 0.01 point and no sampling intervals are published. April against May is the only
    gauge of noise, and both months are shown.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
WB = RAW / "worldbank"
AEI_FILE = RAW / "anthropic_economic_index_2026_06_26" / "aei_claude_ai_2026-06-26.csv"
APR, MAY = "2026-04-01", "2026-05-01"
PEER_FACTOR = 1.5
MIN_GROUP_SHARE = 0.25  # occupations and activities listed as over- or under-indexed need at least this share (pct) in India or the world

INDICATORS = {
    "NY.GDP.PCAP.PP.KD": "gdp_pc_ppp",
    "IT.NET.USER.ZS": "internet_pct",
    "SE.TER.ENRR": "tertiary_enrol_pct",
    "SL.SRV.EMPL.ZS": "services_emp_pct",
    "SL.AGR.EMPL.ZS": "agri_emp_pct",
    "SP.POP.1564.TO.ZS": "pop_1564_pct",
    "SP.POP.TOTL": "population",
}


# ----------------------------------------------------------------------------- loading
def load_worldbank():
    meta = json.loads((WB / "countries.json").read_text())[1]
    c = pd.DataFrame([{"iso3": x["id"], "country": x["name"], "region": x["region"]["value"].strip(),
                       "wb_income_group": x["incomeLevel"]["value"].strip()} for x in meta])
    c = c[c["region"] != "Aggregates"].set_index("iso3")
    out = c.copy()
    for code, name in INDICATORS.items():
        rows = json.loads((WB / f"{code}.json").read_text())[1]
        d = pd.DataFrame([{"iso3": r["countryiso3code"], "year": int(r["date"]), "value": r["value"]}
                          for r in rows if r["value"] is not None and r["countryiso3code"]])
        d = d[(d["year"] >= 2022) & (d["year"] <= 2025)].sort_values(["iso3", "year"]).groupby("iso3").tail(1).set_index("iso3")
        out[name] = d["value"]
        out[name + "_year"] = d["year"]
    return out


def load_aei():
    use = ["date_start", "geo_id", "geo_level", "category_name", "hierarchy_level", "metric_id", "value", "node_name", "node_external_id"]
    df = pd.read_csv(AEI_FILE, dtype={"node_external_id": str}, usecols=use)
    df = df[df["geo_id"].isin(set(df.loc[df["geo_level"] == "country", "geo_id"]) | {"GLOBAL"})]
    return df


def overall_wide(aei):
    """Country (and GLOBAL) overall metrics: one row per geo, columns metric__apr, metric__may, metric (mean)."""
    o = aei[aei["category_name"] == "overall"]
    p = o.pivot_table(index="geo_id", columns=["metric_id", "date_start"], values="value")
    cols = {}
    for m in p.columns.get_level_values(0).unique():
        a = p[(m, APR)] if (m, APR) in p.columns else pd.Series(np.nan, index=p.index)
        b = p[(m, MAY)] if (m, MAY) in p.columns else pd.Series(np.nan, index=p.index)
        cols[m + "__apr"] = a
        cols[m + "__may"] = b
        cols[m] = pd.concat([a, b], axis=1).mean(axis=1)
    return pd.DataFrame(cols)


# ----------------------------------------------------------------------------- regression pieces
def prepare_country_table(wb, ow):
    d = wb.join(ow[["usage_per_capita_index", "usage_per_capita_index__apr", "usage_per_capita_index__may",
                    "usage_pct", "usage_pct__apr", "usage_pct__may"]], how="inner")
    d = d.rename(columns={"usage_per_capita_index": "usage_index", "usage_per_capita_index__apr": "usage_index_apr",
                          "usage_per_capita_index__may": "usage_index_may", "usage_pct": "usage_pct_world",
                          "usage_pct__apr": "usage_pct_world_apr", "usage_pct__may": "usage_pct_world_may"})
    d = d[d.index != "GLOBAL"]
    d["ln_index"] = np.log(d["usage_index"])
    d["ln_gdp"] = np.log(d["gdp_pc_ppp"])
    d["net10"] = d["internet_pct"] / 10
    d["ter10"] = d["tertiary_enrol_pct"] / 10
    d["srv10"] = d["services_emp_pct"] / 10
    d["agr10"] = d["agri_emp_pct"] / 10
    d["wap"] = d["population"] * d["pop_1564_pct"] / 100
    d["ln_wap"] = np.log(d["wap"])
    d["ln_usage_pct"] = np.log(d["usage_pct_world"])
    return d


def fit_ols(formula, data, cov="HC1"):
    return smf.ols(formula, data).fit(cov_type=cov)


def india_row(res, data, depvar, name, extra=None):
    """India's actual, fitted and residual in a model fitted on `data` (India included), and its rank."""
    resid = res.resid
    fitted = res.fittedvalues
    if "IND" not in data.index:
        return None
    r = resid["IND"]
    order = resid.rank(ascending=False)
    row = {"model": name, "n": int(res.nobs), "actual_log": data.loc["IND", depvar], "fitted_log": fitted["IND"], "residual_log": r,
           "actual_over_predicted": float(np.exp(r)), "rank_of_residual_1_is_highest": int(order["IND"]),
           "percentile_of_residual": float((resid < r).mean() * 100), "residual_sd": float(np.sqrt(res.scale)),
           "standardized_residual": float(r / np.sqrt(res.scale))}
    if depvar == "ln_index":
        row["actual_index"] = float(np.exp(row["actual_log"]))
        row["predicted_index"] = float(np.exp(row["fitted_log"]))
    row.update(extra or {})
    return row


def loo_prediction(formula, data, depvar):
    """Fit without India, predict India with a 95% prediction interval (classical OLS)."""
    train = data.drop(index="IND")
    res = smf.ols(formula, train).fit()
    pr = res.get_prediction(data.loc[["IND"]]).summary_frame(alpha=0.05)
    return {"loo_predicted_log": float(pr["mean"].iloc[0]), "loo_pred_low_log": float(pr["obs_ci_lower"].iloc[0]),
            "loo_pred_high_log": float(pr["obs_ci_upper"].iloc[0]),
            "loo_residual_log": float(data.loc["IND", depvar] - pr["mean"].iloc[0])}


def tidy(res, model, n, extra=None):
    ci = res.conf_int()
    rows = []
    for t in res.params.index:
        rows.append({"model": model, "term": t, "coef": res.params[t], "se_robust": res.bse[t], "t": res.tvalues[t], "p": res.pvalues[t],
                     "ci_low": ci.loc[t, 0], "ci_high": ci.loc[t, 1], "n": n, "r2": res.rsquared, "adj_r2": res.rsquared_adj,
                     "se_type": res.cov_type, **(extra or {})})
    return rows


def build_regressions(d):
    base = d.dropna(subset=["ln_index", "ln_gdp"]).copy()
    full = d.dropna(subset=["ln_index", "ln_gdp", "net10", "ter10", "srv10"]).copy()
    models = [
        ("B0 GDP only, all countries with data", "ln_index ~ ln_gdp", base),
        ("C1 GDP only, common sample", "ln_index ~ ln_gdp", full),
        ("C2 + internet use", "ln_index ~ ln_gdp + net10", full),
        ("C3 + tertiary enrollment", "ln_index ~ ln_gdp + net10 + ter10", full),
        ("C4 + services share of employment", "ln_index ~ ln_gdp + net10 + ter10 + srv10", full),
    ]
    reg_rows, india_rows, fits = [], [], {}
    for name, f, data in models:
        res = fit_ols(f, data)
        reg_rows += tidy(res, name, int(res.nobs))
        row = india_row(res, data, "ln_index", name, loo_prediction(f, data, "ln_index"))
        india_rows.append(row)
        fits[name] = (res, data)
    return pd.DataFrame(reg_rows), pd.DataFrame(india_rows), fits, base, full


def robustness(d, base, full):
    rows = []

    def add(spec, data, formula, dep, note=""):
        res = fit_ols(formula, data)
        r = res.resid
        row = {"spec": spec, "outcome": dep, "n": int(res.nobs), "coef_ln_gdp": res.params["ln_gdp"], "se_robust": res.bse["ln_gdp"],
               "r2": res.rsquared, "note": note}
        if "IND" in data.index:
            row["india_residual_log"] = r["IND"]
            row["india_actual_over_predicted"] = float(np.exp(r["IND"]))
            row["india_rank_1_is_highest"] = int(r.rank(ascending=False)["IND"])
            row["india_percentile"] = float((r < r["IND"]).mean() * 100)
        rows.append(row)

    add("baseline: ln index on ln GDP per capita", base, "ln_index ~ ln_gdp", "ln_index")
    add("trim: drop 5 highest and 5 lowest index values", base.drop(base["ln_index"].nlargest(5).index.union(base["ln_index"].nsmallest(5).index).difference(["IND"])),
        "ln_index ~ ln_gdp", "ln_index")
    add("drop the 10 richest countries", base.drop(base["ln_gdp"].nlargest(10).index), "ln_index ~ ln_gdp", "ln_index")
    add("drop the 10 poorest countries", base.drop(base["ln_gdp"].nsmallest(10).index), "ln_index ~ ln_gdp", "ln_index")
    add("drop the United States", base.drop(index="USA"), "ln_index ~ ln_gdp", "ln_index")
    big = base[base["usage_pct_world"] >= 0.1]
    add("only countries with at least 0.1% of world usage", big, "ln_index ~ ln_gdp", "ln_index", "drops countries with the smallest samples")
    # April only, May only
    for lab, col in [("April 2026 only", "usage_index_apr"), ("May 2026 only", "usage_index_may")]:
        t = base.copy()
        t["ln_m"] = np.log(t[col])
        t = t.dropna(subset=["ln_m"])
        add(lab, t, "ln_m ~ ln_gdp", "ln_index", "index of one month" + ("; 7 countries lack an April value" if "apr" in col else ""))
    # usage share outcome with working-age population as a regressor
    t = base.dropna(subset=["ln_usage_pct", "ln_wap"])
    res = fit_ols("ln_usage_pct ~ ln_gdp + ln_wap", t)
    r = res.resid
    rows.append({"spec": "outcome is ln(share of world usage), regress on ln GDP per capita and ln working-age population", "outcome": "ln_usage_pct",
                 "n": int(res.nobs), "coef_ln_gdp": res.params["ln_gdp"], "se_robust": res.bse["ln_gdp"], "r2": res.rsquared,
                 "note": f"coefficient on ln working-age population {res.params['ln_wap']:.2f} (SE {res.bse['ln_wap']:.2f}); the index forces it to 1",
                 "india_residual_log": r["IND"], "india_actual_over_predicted": float(np.exp(r["IND"])),
                 "india_rank_1_is_highest": int(r.rank(ascending=False)["IND"]), "india_percentile": float((r < r["IND"]).mean() * 100)})
    add("HC3 standard errors", base, "ln_index ~ ln_gdp", "ln_index")
    res3 = smf.ols("ln_index ~ ln_gdp", base).fit(cov_type="HC3")
    rows[-1]["se_robust"] = res3.bse["ln_gdp"]
    rows[-1]["note"] = "HC3 standard error of the GDP coefficient; residuals are unchanged"
    # quadratic in log GDP
    bq = base.copy()
    bq["ln_gdp2"] = bq["ln_gdp"] ** 2
    resq = fit_ols("ln_index ~ ln_gdp + ln_gdp2", bq)
    r = resq.resid
    rows.append({"spec": "quadratic in ln GDP per capita", "outcome": "ln_index", "n": int(resq.nobs), "coef_ln_gdp": resq.params["ln_gdp"],
                 "se_robust": resq.bse["ln_gdp"], "r2": resq.rsquared, "note": f"squared term {resq.params['ln_gdp2']:.3f} (SE {resq.bse['ln_gdp2']:.3f})",
                 "india_residual_log": r["IND"], "india_actual_over_predicted": float(np.exp(r["IND"])),
                 "india_rank_1_is_highest": int(r.rank(ascending=False)["IND"]), "india_percentile": float((r < r["IND"]).mean() * 100)})
    # lower-middle-income countries only
    lm = base[base["wb_income_group"] == "Lower middle income"]
    add("World Bank lower-middle-income countries only", lm, "ln_index ~ ln_gdp", "ln_index")
    # other control sets
    add("full controls (C4), common sample", full, "ln_index ~ ln_gdp + net10 + ter10 + srv10", "ln_index")
    sv = d.dropna(subset=["ln_index", "ln_gdp", "srv10"])
    add("GDP plus services share of employment only (larger sample than C4)", sv, "ln_index ~ ln_gdp + srv10", "ln_index")
    ag = d.dropna(subset=["ln_index", "ln_gdp", "net10", "ter10", "agr10"])
    add("full controls with agriculture share in place of services share", ag, "ln_index ~ ln_gdp + net10 + ter10 + agr10", "ln_index")
    return pd.DataFrame(rows)


# ----------------------------------------------------------------------------- composition
def monthly(aei, geo, cat, lvl, metric="pct"):
    d = aei[(aei["geo_id"] == geo) & (aei["category_name"] == cat) & (aei["hierarchy_level"] == lvl) & (aei["metric_id"] == metric)].copy()
    if cat == "soc_occupation" and lvl == 0:
        d["node_external_id"] = d["node_external_id"].str[:7]  # O*NET-SOC to 6-digit SOC; shares add up
        d = d.groupby(["node_external_id", "date_start"], as_index=False).agg(value=("value", "sum"), node_name=("node_name", "first"))
    p = d.pivot_table(index="node_external_id", columns="date_start", values="value")
    for m in (APR, MAY):
        if m not in p:
            p[m] = np.nan
    names = d.drop_duplicates("node_external_id").set_index("node_external_id")["node_name"]
    return p[[APR, MAY]].rename(columns={APR: "apr", MAY: "may"}).assign(name=names)


def compare(aei, cat, lvl, geo_a="IND", geo_b="GLOBAL", metric="pct"):
    a = monthly(aei, geo_a, cat, lvl, metric).add_prefix("india_").rename(columns={"india_name": "name"})
    b = monthly(aei, geo_b, cat, lvl, metric).drop(columns="name").add_prefix("world_")
    t = a.join(b, how="outer")
    t["name"] = t["name"].fillna(monthly(aei, geo_b, cat, lvl, metric)["name"])
    t["india_share"] = t[["india_apr", "india_may"]].mean(axis=1)
    t["world_share"] = t[["world_apr", "world_may"]].mean(axis=1)
    t["both_published"] = t["india_share"].notna() & t["world_share"].notna()
    t["diff_pp"] = t["india_share"] - t["world_share"]
    t["ratio_india_to_world"] = np.where(t["both_published"] & (t["world_share"] > 0), t["india_share"] / t["world_share"], np.nan)
    # both months agree on the direction of the gap
    ok = t[["india_apr", "india_may", "world_apr", "world_may"]].notna().all(axis=1)
    same = np.sign(t["india_apr"] - t["world_apr"]) == np.sign(t["india_may"] - t["world_may"])
    t["direction_same_in_both_months"] = np.where(ok, np.where(same, "yes", "no"), "")
    return t.reset_index().rename(columns={"node_external_id": "node_id"})


def build_groups(aei):
    t = compare(aei, "soc_occupation", 1)
    cols = ["node_id", "name", "india_apr", "india_may", "india_share", "world_apr", "world_may", "world_share", "diff_pp",
            "ratio_india_to_world", "direction_same_in_both_months"]
    t = t[cols].rename(columns={"node_id": "major_group", "name": "major_group_name"})
    # India's own automation, augmentation and work-use by group
    extra = []
    for geo, tag in [("IND", "india"), ("GLOBAL", "world")]:
        for metric, short in [("collaboration_bucket_automation_pct", "automation"), ("use_case_work_pct", "work_use")]:
            m = aei[(aei["geo_id"] == geo) & (aei["category_name"] == "soc_occupation") & (aei["hierarchy_level"] == 1) & (aei["metric_id"] == metric)]
            s = m.groupby("node_external_id")["value"].mean().rename(f"{tag}_{short}_pct")
            extra.append(s)
    t = t.merge(pd.concat(extra, axis=1), left_on="major_group", right_index=True, how="left")
    return t.sort_values("india_share", ascending=False).round(3)


def build_occupations(aei):
    t = compare(aei, "soc_occupation", 0)
    occ = pd.read_csv(OUT / "occupations.csv", usecols=["soc", "title"]).set_index("soc")["title"]
    t["title"] = t["node_id"].map(occ).fillna(t["name"])
    both = t[t["both_published"] & (t[["india_share", "world_share"]].max(axis=1) >= MIN_GROUP_SHARE) & (t["world_share"] > 0) & (t["india_share"] > 0)].copy()
    top = t[t["india_share"].notna()].sort_values(["india_share", "node_id"], ascending=[False, True]).head(15).assign(list="top_by_india_share")
    over = both.sort_values(["ratio_india_to_world", "node_id"], ascending=[False, True]).head(15).assign(list="most_over_indexed")
    under = both.sort_values(["ratio_india_to_world", "node_id"], ascending=[True, True]).head(15).assign(list="most_under_indexed")
    out = pd.concat([top, over, under])
    out["rank_in_list"] = out.groupby("list").cumcount() + 1
    n_pub = int(t["india_share"].notna().sum())
    out["india_occupations_published"] = n_pub
    cols = ["list", "rank_in_list", "node_id", "title", "india_apr", "india_may", "india_share", "world_apr", "world_may", "world_share",
            "diff_pp", "ratio_india_to_world", "both_published", "direction_same_in_both_months", "india_occupations_published"]
    return out[cols].rename(columns={"node_id": "soc"}).round(3)


def build_activities(aei):
    parts = []
    for cat, lvl, label in [("onet", 3, "onet_general_work_activity"), ("onet", 2, "onet_intermediate_work_activity"), ("request", 2, "request_topic_major")]:
        t = compare(aei, cat, lvl)
        t["category"] = label
        t = t[t["both_published"]].copy()
        if label == "onet_intermediate_work_activity":
            keep = t[t[["india_share", "world_share"]].max(axis=1) >= MIN_GROUP_SHARE]
            top = pd.concat([keep.sort_values("ratio_india_to_world", ascending=False).head(10),
                             keep.sort_values("ratio_india_to_world", ascending=True).head(10)])
            t = top.drop_duplicates("node_id")
        parts.append(t)
    out = pd.concat(parts)
    cols = ["category", "node_id", "name", "india_apr", "india_may", "india_share", "world_apr", "world_may", "world_share", "diff_pp",
            "ratio_india_to_world", "direction_same_in_both_months"]
    return out[cols].sort_values(["category", "diff_pp"], ascending=[True, False]).round(3)


def build_use_patterns(ow, country):
    metrics = [
        ("usage_per_capita_index", "Anthropic Usage Index (1.0 = proportional to working-age population)"), ("usage_pct", "share of world Claude.ai usage (percent)"),
        ("use_case_work_pct", "work use (share of conversations)"), ("use_case_personal_pct", "personal use"),
        ("use_case_coursework_pct", "coursework use"), ("collaboration_bucket_automation_pct", "automation (share of conversations)"),
        ("collaboration_bucket_augmentation_pct", "augmentation"), ("collaboration_directive_pct", "directive"),
        ("collaboration_feedback_loop_pct", "feedback loop"), ("collaboration_task_iteration_pct", "task iteration"),
        ("collaboration_learning_pct", "learning"), ("collaboration_validation_pct", "validation"),
        ("collaboration_none_pct", "no collaboration pattern"), ("ai_autonomy_mean", "AI autonomy (1 to 5)"),
        ("multitasking_pct", "multitasking"), ("human_only_ability_pct", "a human could do it alone"),
        ("human_only_time_mean", "human-only time (hours)"), ("human_with_ai_time_mean", "time with AI (minutes)"),
        ("human_education_years_mean", "human education years needed"), ("ai_education_years_mean", "AI education years shown"),
    ]
    gdp = country["gdp_pc_ppp"]
    ind_gdp = gdp["IND"]
    peers = [i for i in country.index if i != "IND" and 1 / PEER_FACTOR <= gdp[i] / ind_gdp <= PEER_FACTOR]
    lmc = [i for i in country.index if i != "IND" and country.loc[i, "wb_income_group"] == "Lower middle income"]
    hic = [i for i in country.index if country.loc[i, "wb_income_group"] == "High income"]
    allc = [i for i in country.index if i != "IND"]
    rows = []
    for m, label in metrics:
        if m not in ow:
            continue
        v = ow[m]
        cv = v.reindex(allc).dropna()
        ln_gdp = np.log(gdp.reindex(cv.index))
        rank = v.reindex(country.index).dropna().rank(ascending=False)
        row = {"metric": m, "label": label,
               "india_apr": ow.loc["IND", m + "__apr"], "india_may": ow.loc["IND", m + "__may"], "india": ow.loc["IND", m],
               "world": ow.loc["GLOBAL", m],
               "peers_median": v.reindex(peers).median(), "peers_p25": v.reindex(peers).quantile(0.25), "peers_p75": v.reindex(peers).quantile(0.75),
               "peers_n": int(v.reindex(peers).notna().sum()),
               "lower_middle_income_median": v.reindex(lmc).median(), "high_income_median": v.reindex(hic).median(),
               "all_countries_median": cv.median(), "india_rank_of_n_1_is_highest": int(rank["IND"]), "n_countries": len(rank),
               "spearman_with_ln_gdp_across_countries": float(pd.Series(cv).rank().corr(ln_gdp.rank()))}
        rows.append(row)
    t = pd.DataFrame(rows)
    # derived speed-up: human-only minutes over with-AI minutes, ratio of means
    num = ow["human_only_time_mean"] * 60
    den = ow["human_with_ai_time_mean"]
    sp = (num / den)
    t = pd.concat([t, pd.DataFrame([{
        "metric": "speedup_ratio_of_means", "label": "human-only minutes over minutes with AI (ratio of means; model-estimated)",
        "india": sp["IND"], "india_apr": (ow.loc["IND", "human_only_time_mean__apr"] * 60 / ow.loc["IND", "human_with_ai_time_mean__apr"]),
        "india_may": (ow.loc["IND", "human_only_time_mean__may"] * 60 / ow.loc["IND", "human_with_ai_time_mean__may"]),
        "world": sp["GLOBAL"], "peers_median": sp.reindex(peers).median(), "peers_p25": sp.reindex(peers).quantile(0.25),
        "peers_p75": sp.reindex(peers).quantile(0.75), "peers_n": int(sp.reindex(peers).notna().sum()),
        "lower_middle_income_median": sp.reindex(lmc).median(), "high_income_median": sp.reindex(hic).median(),
        "all_countries_median": sp.reindex(allc).median(), "india_rank_of_n_1_is_highest": int(sp.reindex(country.index).dropna().rank(ascending=False)["IND"]),
        "n_countries": int(sp.reindex(country.index).notna().sum()), "spearman_with_ln_gdp_across_countries": np.nan}])], ignore_index=True)
    return t.round(3), peers


# ----------------------------------------------------------------------------- benchmarks (published figures)
# Each row was read by hand in the cited document on 2026-11-22 (page numbers are the printed page numbers). verified = "yes"
# means the figure was read in the document named in `source` (a primary document: the IMF, ILO and ICRIER PDFs, text-extracted
# and searched). verified = "no" means it was read only in a news report of the study; the primary document could not be read
# (the NITI Aayog PDF and page returned HTTP 403 to the fetch tool; the Great Lakes paper was not found). Those rows are not
# used as key numbers anywhere.
IMF = "IMF Staff Discussion Note SDN/2024/001, Gen-AI: Artificial Intelligence and the Future of Work (Cazzaniga and others, January 2024)"
IMF_URL = "https://www.imf.org/-/media/files/publications/sdn/2024/english/sdnea2024001.pdf"
ILO = "ILO Working Paper 140, Generative AI and Jobs: A Refined Global Index of Occupational Exposure (Gmyrek and others, May 2025)"
ILO_URL = "https://www.ilo.org/sites/default/files/2025-05/WP140_web.pdf"
ICR = "ICRIER, AI and Jobs: This Time Is No Different (Mishra and others, February 2026); a survey of IT firms, supported by OpenAI"
ICR_URL = "https://www.icrier.org/pdf/AI-and-Jobs.pdf"
BENCHMARKS = [
    # IMF
    ("India: share of employment in high-exposure occupations", "26", "percent of employment", IMF, IMF_URL,
     "Section II.2 'Cross-Country Differences', p. 8 (sentence on emerging markets, 41 percent in Brazil to 26 percent in India)", "yes"),
    ("Brazil: share of employment in high-exposure occupations (upper end of the emerging-market sample range)", "41", "percent of employment", IMF, IMF_URL,
     "Section II.2, p. 8, same sentence as the India figure", "yes"),
    ("Global: share of employment exposed to AI", "almost 40", "percent of employment", IMF, IMF_URL, "Executive Summary, p. 2; Section II.2, p. 7 ('about 40 percent')", "yes"),
    ("Advanced economies: share of jobs exposed to AI", "about 60", "percent of employment", IMF, IMF_URL, "Executive Summary, p. 2; Section II.2, p. 7", "yes"),
    ("Emerging market economies: overall exposure", "40", "percent of employment", IMF, IMF_URL,
     "Executive Summary, p. 2; the split is 16 percent high-exposure high-complementarity plus 24 percent high-exposure low-complementarity, Section II.2, pp. 7-8", "yes"),
    ("Low-income countries: overall exposure", "26", "percent of employment", IMF, IMF_URL,
     "Executive Summary, p. 2; the split is 8 plus 18 percent, Section II.2, p. 8. This 26 is the low-income average and is a different number from India's 26", "yes"),
    ("India: composition of employment behind the low exposure", "most workers are craftspeople, skilled agricultural workers and elementary workers, mostly low exposure",
     "text (no share given)", IMF, IMF_URL, "Section II.2, p. 8, paragraph before Figure 2", "yes"),
    ("India: survey behind the exposure estimate", "India Periodic Labour Force Survey, survey year 2019, sample 420,720", "survey, year, observations", IMF, IMF_URL,
     "Annex Table 1.1 note, p. 26; the India analysis uses ISCO-08 minor (3-digit) groups, 130 of them, footnote 4, p. 7", "yes"),
    ("Method: exposure and complementarity", "AI Occupational Exposure index (Felten, Raj and Seamans 2021) plus a potential complementarity index (Pizzinelli and others 2023); high and low split at the median",
     "method", IMF, IMF_URL, "Section II.1, p. 6 (thresholds 'represented by their median values'); Box 1, p. 24", "yes"),
    # ILO
    ("Global: share of workers in an occupation with some GenAI exposure", "24 (one in four)", "percent of employment", ILO, ILO_URL,
     "Abstract (p. 1) says one in four; closing discussion, p. 47 gives 24%", "yes"),
    ("Global: share of employment in the highest exposure gradient", "3.3", "percent of employment", ILO, ILO_URL, "Abstract, p. 1", "yes"),
    ("High-income countries: share of employment exposed", "34", "percent of employment", ILO, ILO_URL, "Abstract, p. 1; income-group discussion, p. 44", "yes"),
    ("Low-income countries: share of employment exposed", "11", "percent of employment", ILO, ILO_URL, "Abstract, p. 1; income-group discussion, p. 44", "yes"),
    ("India-specific exposure share", "none given", "n/a", ILO, ILO_URL, "The extracted full text of the working paper contains no mention of India", "yes"),
    # ICRIER
    ("India IT sector: firms surveyed", "651 firms in 10 cities, November 2025 to January 2026", "firms", ICR, ICR_URL, "Executive Summary, p. 8", "yes"),
    ("India IT sector: IT firms that have trained more than half their staff in AI skills", "4", "percent of firms", ICR, ICR_URL, "Executive Summary, p. 9", "yes"),
    ("India IT sector: firms expecting no major change in employment / expansion / decline", "44 / 28 / 27", "percent of firms", ICR, ICR_URL, "Executive Summary, p. 9", "yes"),
    ("India IT sector: employment effect found", "no evidence of large-scale job losses; hiring moderated, total sector employment kept growing",
     "text", ICR, ICR_URL, "Executive Summary, p. 8", "yes"),
    # news reports of studies whose primary documents could not be read
    ("NITI Aayog roadmap: new AI-enabled jobs that could be created", "up to 4", "million jobs within five years", "DD News report on the NITI Aayog roadmap (also stated in a Free Press Journal report)",
     "https://ddnews.gov.in/en/niti-aayog-unveils-roadmap-for-job-creation-in-the-ai-economy/",
     "article text; NITI Aayog's PDF (niti.gov.in) returned HTTP 403, so not checked against the report", "no"),
    ("NITI Aayog roadmap: worst-case tech services headcount, 2023 to 2031", "7.5-8 million to 6 million", "workers", "Free Press Journal report on the NITI Aayog roadmap (published 2026-03-13)",
     "https://www.freepressjournal.in/tech/indian-it-sector-job-loss-15-to-20-lakh-ai-niti-aayog", "article text; one outlet only; NITI Aayog's PDF not readable", "no"),
    ("Great Lakes Institute of Management paper: employed people in AI-exposed occupations, India, 2025", "24.6", "percent (ThePrint says of the working-age population; another outlet says of employed people aged 15-64)",
     "ThePrint report (11 October 2026) on a paper by Mahambare, Jadhav and Venugopalan", "https://theprint.in/feature/nearly-197-million-indian-workers-in-jobs-vulnerable-to-ai-automation-finds-great-lakes-institute-study/3068436/",
     "article text; the paper itself was not found; the exposure definition is not stated in the article", "no"),
    ("Great Lakes Institute of Management paper: workers in jobs with a high share of routine tasks", "about 197", "million workers", "ThePrint report (11 October 2026) on the same paper",
     "https://theprint.in/feature/nearly-197-million-indian-workers-in-jobs-vulnerable-to-ai-automation-finds-great-lakes-institute-study/3068436/", "article text; also in a second outlet (letsdatascience.com)", "no"),
]


def build_benchmarks():
    return pd.DataFrame(BENCHMARKS, columns=["claim", "value", "unit", "source", "url", "where_found", "verified"])


# ----------------------------------------------------------------------------- main
def main():
    wb = load_worldbank()
    aei = load_aei()
    ow = overall_wide(aei)
    d = prepare_country_table(wb, ow)

    regs, india, fits, base, full = build_regressions(d)
    rob = robustness(d, base, full)

    # fitted values and residuals for the chart table
    d["fitted_log_gdp_only"] = fits["B0 GDP only, all countries with data"][0].fittedvalues
    d["residual_log_gdp_only"] = fits["B0 GDP only, all countries with data"][0].resid
    d["fitted_log_full"] = fits["C4 + services share of employment"][0].fittedvalues
    d["residual_log_full"] = fits["C4 + services share of employment"][0].resid
    uses, peers = build_use_patterns(ow, d)
    d["peer_of_india"] = np.where(d.index.isin(peers), "yes", "no")
    d.loc["IND", "peer_of_india"] = "india"
    for c in ("fitted_log_gdp_only", "residual_log_gdp_only", "fitted_log_full", "residual_log_full"):
        d[c] = d[c].round(4)
    cols = ["country", "region", "wb_income_group", "peer_of_india", "usage_index", "usage_index_apr", "usage_index_may", "usage_pct_world",
            "gdp_pc_ppp", "gdp_pc_ppp_year", "internet_pct", "internet_pct_year", "tertiary_enrol_pct", "tertiary_enrol_pct_year",
            "services_emp_pct", "services_emp_pct_year", "agri_emp_pct", "pop_1564_pct", "population",
            "fitted_log_gdp_only", "residual_log_gdp_only", "fitted_log_full", "residual_log_full"]
    ctab = d[cols].copy().round({"usage_pct_world": 3, "usage_index": 3, "usage_index_apr": 3, "usage_index_may": 3, "gdp_pc_ppp": 0, "internet_pct": 1,
                                 "tertiary_enrol_pct": 1, "services_emp_pct": 1, "agri_emp_pct": 1, "pop_1564_pct": 1})
    for c in [c for c in ctab.columns if c.endswith("_year")]:
        ctab[c] = ctab[c].astype("Int64")
    ctab["population"] = ctab["population"].astype("Int64")
    ctab.index.name = "iso3"
    ctab.sort_values("usage_index", ascending=False).to_csv(OUT / "india_a_country_data.csv")

    regs[["coef", "se_robust", "t", "ci_low", "ci_high", "r2", "adj_r2"]] = regs[["coef", "se_robust", "t", "ci_low", "ci_high", "r2", "adj_r2"]].round(4)
    regs["p"] = regs["p"].map(lambda v: float(f"{v:.3g}"))
    regs.to_csv(OUT / "india_a_regressions.csv", index=False)
    india.round(4).to_csv(OUT / "india_a_india_summary.csv", index=False)
    rob.round(4).to_csv(OUT / "india_a_robustness.csv", index=False)
    build_groups(aei).to_csv(OUT / "india_a_composition_groups.csv", index=False)
    build_occupations(aei).to_csv(OUT / "india_a_composition_occupations.csv", index=False)
    build_activities(aei).to_csv(OUT / "india_a_composition_activities.csv", index=False)
    uses.to_csv(OUT / "india_a_use_patterns.csv", index=False)
    build_benchmarks().to_csv(OUT / "india_a_benchmarks.csv", index=False)
    print("peers:", len(peers), sorted(peers))
    for f in sorted(OUT.glob("india_a_*.csv")):
        print(f"{f.name}  {pd.read_csv(f).shape[0]} rows  {f.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
