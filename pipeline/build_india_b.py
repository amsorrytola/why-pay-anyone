"""India Stage B: PLFS 2025 (first-visit microdata) x occupation-level AI exposure.

What it does
1. Builds an AI-exposure score for each 3-digit ISCO-08 occupation group by walking
   ISCO-08 -> SOC 2010 -> SOC 2018 (BLS crosswalks) and averaging the exposure of the matching
   US occupations, weighted by US employment (BLS OEWS May 2025).
   Two measures: Microsoft "Working with AI" applicability, and Anthropic Economic Index usage
   relative to employment. Each is turned into a percentile of the US workforce (0 = least exposed,
   100 = most exposed), so "top third" has the same meaning for both.
2. Treats PLFS NCO-2015 3-digit codes as ISCO-08 3-digit codes (NCO-2015 follows ISCO-08; this is
   an assumption, tested by coverage below).
3. Weights PLFS persons by MULT/100 (MoSPI README) and tabulates workers, pay and informality by
   exposure group.

Inputs (raw files are never committed): data/raw/plfs_2025/csv/CPERV1.csv,
data/raw/bls_isco_soc/*, data/raw/ilo_isco08/ISCO-08_EN.csv, data/processed/occupations.csv.
Outputs: data/processed/india_b_*.csv  (aggregates only, no unit-level records).

Run: .venv/bin/python -I pipeline/build_india_b.py
"""
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

MEASURES = ["ms", "aei", "ms_eq"]
MEASURE_NAMES = {
    "ms": "Microsoft applicability (Copilot use)",
    "aei": "Anthropic usage relative to employment (Claude.ai)",
    "ms_eq": "Microsoft, equal weight across matched US occupations (robustness)",
}
STATUS_GROUPS = {11: "self", 12: "self", 21: "family", 31: "regular", 41: "casual", 51: "casual"}
MIN_GROUP_N = 30   # smallest sample size for an occupation group to appear
MIN_CELL_N = 10    # smallest sample size for a cell in the interactive table


# ----------------------------------------------------------------------------- helpers
def wmean(x, w):
    m = x.notna() & w.notna()
    return float((x[m] * w[m]).sum() / w[m].sum()) if m.any() else np.nan


def wquantile(x, w, q):
    m = x.notna() & w.notna()
    x, w = x[m].to_numpy(), w[m].to_numpy()
    o = np.argsort(x)
    x, w = x[o], w[o]
    c = np.cumsum(w) / w.sum()
    return float(np.interp(q, c, x))


def pct_rank(value, ref_values, ref_weights):
    """Employment-weighted mid-rank percentile (0-100) of `value` among reference values."""
    below = ref_weights[ref_values < value].sum()
    equal = ref_weights[ref_values == value].sum()
    return 100.0 * (below + 0.5 * equal) / ref_weights.sum()


# ----------------------------------------------------------------------------- 1. exposure by ISCO-08 3-digit
def build_exposure():
    occ = pd.read_csv(ROOT / "data/processed/occupations.csv", dtype={"soc": str})
    occ["emp"] = occ["employment"].astype(float)
    occ["emp_share"] = occ["employment_share_pct"].astype(float)
    occ["aei_share"] = occ["aei_global_share_pct"].astype(float)

    isco = pd.read_excel(RAW / "bls_isco_soc/ISCO_SOC_Crosswalk.xls", header=6, dtype=str, engine="xlrd")
    isco = isco.rename(columns={"ISCO-08 Code": "isco4", "2010 SOC Code": "soc2010"})
    isco = isco[isco["isco4"].notna() & isco["soc2010"].notna()].copy()
    isco["isco4"] = isco["isco4"].str.strip().str.zfill(4)
    isco["isco3"] = isco["isco4"].str[:3]
    isco["soc2010"] = isco["soc2010"].str.strip()

    cw = pd.read_excel(RAW / "bls_isco_soc/soc_2010_to_2018_crosswalk.xlsx", header=8, dtype=str)
    cw = cw.rename(columns={"2010 SOC Code": "soc2010", "2018 SOC Code": "soc"})
    cw = cw[cw["soc2010"].notna() & cw["soc"].notna()][["soc2010", "soc"]].drop_duplicates()
    cw["soc2010"] = cw["soc2010"].str.strip()
    cw["soc"] = cw["soc"].str.strip()

    edges = isco[["isco3", "soc2010"]].drop_duplicates().merge(cw, on="soc2010", how="left")
    unmapped_2010 = edges["soc"].isna().sum()
    edges = edges.dropna(subset=["soc"])[["isco3", "soc"]].drop_duplicates()
    edges = edges.merge(occ[["soc", "emp", "emp_share", "ms_applicability", "aei_share"]], on="soc", how="inner")

    # US reference distributions (SOC level, employment weighted)
    ref_ms = occ[occ["ms_applicability"].notna() & (occ["emp"] > 0)]
    occ["aei_ratio"] = occ["aei_share"] / occ["emp_share"]
    ref_aei = occ[occ["aei_ratio"].notna() & (occ["emp"] > 0)]

    rows = []
    for g, e in edges.groupby("isco3"):
        r = {"isco3": g, "n_soc_matched": len(e), "us_emp_matched": e["emp"].sum()}
        em = e[e["ms_applicability"].notna()]
        if len(em) and em["emp"].sum() > 0:
            r["ms_score"] = (em["emp"] * em["ms_applicability"]).sum() / em["emp"].sum()
            r["ms_pct"] = pct_rank(r["ms_score"], ref_ms["ms_applicability"], ref_ms["emp"])
            r["ms_score_eq"] = em["ms_applicability"].mean()
            r["ms_pct_eq"] = pct_rank(r["ms_score_eq"], ref_ms["ms_applicability"], ref_ms["emp"])
            r["n_soc_ms"] = len(em)
        ea = e[e["aei_share"].notna()]
        # need the occupations with a published Anthropic share to cover at least half of matched employment
        if len(ea) and ea["emp"].sum() >= 0.5 * e["emp"].sum():
            r["aei_ratio"] = ea["aei_share"].sum() / ea["emp_share"].sum()
            r["aei_pct"] = pct_rank(r["aei_ratio"], ref_aei["aei_ratio"], ref_aei["emp"])
            r["n_soc_aei"] = len(ea)
        rows.append(r)
    ex = pd.DataFrame(rows)

    iso = pd.read_csv(RAW / "ilo_isco08/ISCO-08_EN.csv", dtype=str, encoding="cp1252")
    iso = iso[iso["ISCO_version"].str.strip() == "ISCO-08"]   # the file also holds older ISCO versions
    lab = iso[["minor", "minor_label", "major", "major_label"]].drop_duplicates("minor").rename(
        columns={"minor": "isco3", "minor_label": "label"})
    ex = ex.merge(lab, on="isco3", how="left")
    print(f"ISCO 3-digit groups with an exposure score: {ex['ms_pct'].notna().sum()} (Microsoft), "
          f"{ex['aei_pct'].notna().sum()} (Anthropic); "
          f"SOC-2010 codes with no 2018 match: {unmapped_2010}")
    return ex


# ----------------------------------------------------------------------------- 2. PLFS
def load_plfs(ex):
    cols = ["st", "sec", "sex", "age", "gedu_lvl", "pas", "ocu_pas", "job_pas", "ssec_pas", "acws", "ocu_cws",
            "ern_reg", "ern_self", "mult", "bstrm", "mfsu", "nss_reg"]
    d = pd.read_csv(RAW / "plfs_2025/csv/CPERV1.csv", usecols=cols, dtype=str)
    for c in ["sec", "sex", "age", "pas", "acws", "job_pas", "ssec_pas", "ern_reg", "ern_self", "mult"]:
        d[c] = pd.to_numeric(d[c], errors="coerce")
    d["w"] = d["mult"] / 100.0                      # MoSPI README: Final Weight = MULT / 100
    d["ocu_pas"] = d["ocu_pas"].str.strip().str.zfill(3)
    d["ocu_cws"] = d["ocu_cws"].str.strip().str.zfill(3)
    d["cluster"] = d["nss_reg"] + "-" + d["sec"].astype(str) + "-" + d["bstrm"].str.strip() + "-" + d["mfsu"].str.strip()
    d["female"] = (d["sex"] == 2).astype(int)
    d["rural"] = (d["sec"] == 1).astype(int)
    d["status"] = d["pas"].map(STATUS_GROUPS)

    ex2 = ex.set_index("isco3")
    for m, col in [("ms", "ms_pct"), ("aei", "aei_pct"), ("ms_eq", "ms_pct_eq")]:
        d[f"{m}_pas"] = d["ocu_pas"].map(ex2[col])
        d[f"{m}_cws"] = d["ocu_cws"].map(ex2[col])
    return d


# ----------------------------------------------------------------------------- 3. analysis
def main():
    ex = build_exposure()
    d = load_plfs(ex)
    n_all = len(d)
    print("persons:", n_all, " weight sum (bn):", round(d["w"].sum() / 1e9, 3))

    wk = d[d["pas"].isin(STATUS_GROUPS)].copy()          # usual principal status workers
    print("workers (usual principal status):", len(wk), " share of weight:", round(wk["w"].sum() / d["w"].sum(), 4))

    # coverage and the NCO = ISCO assumption
    codes = set(ex["isco3"])
    wk["code_in_isco"] = wk["ocu_pas"].isin(codes)
    cov_code = wmean(wk["code_in_isco"].astype(float), wk["w"])
    cov = {m: wmean(wk[f"{m}_pas"].notna().astype(float), wk["w"]) for m in MEASURES}
    print("share of workers whose 3-digit code exists in ISCO-08 with an exposure row:", round(cov_code, 4))
    print("share of workers with each exposure measure:", {k: round(v, 4) for k, v in cov.items()})
    unmatched = (wk[~wk["code_in_isco"]].groupby("ocu_pas")["w"].sum() / wk["w"].sum()).sort_values(ascending=False)
    print("largest NCO 3-digit codes not found in ISCO-08:\n", unmatched.head(8).round(4).to_string())

    # ---- occupation-group table
    def agg_group(g):
        s = g["w"].sum()
        r = {
            "n_workers_sample": len(g),
            "share_of_workers_pct": 100 * s / wk["w"].sum(),
            "female_share_pct": 100 * wmean(g["female"].astype(float), g["w"]),
            "rural_share_pct": 100 * wmean(g["rural"].astype(float), g["w"]),
        }
        for st in ["self", "family", "regular", "casual"]:
            r[f"{st}_share_pct"] = 100 * g.loc[g["status"] == st, "w"].sum() / s
        return pd.Series(r)

    grp = wk.groupby("ocu_pas").apply(agg_group, include_groups=False).reset_index().rename(columns={"ocu_pas": "nco3"})
    # pay by occupation (current weekly status occupation)
    reg = d[d["acws"].isin([31, 71, 72]) & (d["ern_reg"] > 0)]
    selfe = d[d["acws"].isin([11, 12, 61, 62]) & (d["ern_self"] > 0)]
    pay_reg = reg.groupby("ocu_cws").apply(
        lambda g: pd.Series({"n_regular_earners": len(g), "median_monthly_pay_regular": wquantile(g["ern_reg"], g["w"], 0.5)}),
        include_groups=False).reset_index().rename(columns={"ocu_cws": "nco3"})
    grp = grp.merge(pay_reg, on="nco3", how="left")
    grp = grp.merge(ex.rename(columns={"isco3": "nco3"})[
        ["nco3", "label", "major", "major_label", "ms_score", "ms_pct", "aei_ratio", "aei_pct",
         "n_soc_matched", "n_soc_ms", "n_soc_aei"]], on="nco3", how="left")
    grp_out = grp[grp["n_workers_sample"] >= MIN_GROUP_N].copy()
    dropped = 100 * (1 - grp_out["share_of_workers_pct"].sum() / 100)
    print(f"occupation groups shown: {len(grp_out)} of {len(grp)}; workers in the small groups left out: {dropped:.2f}%")
    grp_out.loc[grp_out["n_regular_earners"] < MIN_GROUP_N, "median_monthly_pay_regular"] = np.nan
    grp_out.sort_values("share_of_workers_pct", ascending=False).round(4).to_csv(OUT / "india_b_nco3.csv", index=False)

    # ---- cells for the interactive page: occupation x sector x sex x status, shares of all workers
    wk["sex_g"] = np.where(wk["sex"] == 2, "f", "m")
    wk["sec_g"] = np.where(wk["sec"] == 1, "rural", "urban")
    cells = wk.groupby(["ocu_pas", "sec_g", "sex_g", "status"]).agg(n=("w", "size"), w=("w", "sum")).reset_index()
    cells["share_pct"] = 100 * cells["w"] / wk["w"].sum()
    kept = cells[(cells["n"] >= MIN_CELL_N) & cells["ocu_pas"].isin(set(grp_out["nco3"]))].copy()
    print(f"cells kept: {len(kept)} of {len(cells)}; weight share kept: {kept['w'].sum() / wk['w'].sum():.4f}")
    kept = kept.rename(columns={"ocu_pas": "nco3"})[["nco3", "sec_g", "sex_g", "status", "n", "share_pct"]]
    kept["share_pct"] = kept["share_pct"].round(5)
    kept.to_csv(OUT / "india_b_cells.csv", index=False)

    # ---- headline summary by measure
    rows = []
    def add(measure, scope, value, label, extra=None):
        r = {"measure": measure, "scope": scope, "label": label, "value": value}
        if extra:
            r.update(extra)
        rows.append(r)

    for m in MEASURES:
        col = f"{m}_pas"
        g = wk[wk[col].notna()]
        w = g["w"]
        add(m, "all", wmean(g[col], w), "mean percentile of Indian workers (US workers = 50)")
        add(m, "all", 100 * wmean((g[col] > 100 * 2 / 3).astype(float), w), "share of Indian workers above the US top-third line, percent (US = 33.3)")
        add(m, "all", 100 * wmean((g[col] < 100 / 3).astype(float), w), "share of Indian workers below the US bottom-third line, percent (US = 33.3)")
        add(m, "all", 100 * wmean((g[col] > 50).astype(float), w), "share of Indian workers above the US median line, percent (US = 50)")
        add(m, "all", 100 * wmean((g[col] > 80).astype(float), w), "share of Indian workers above the US 80th-percentile line, percent (US = 20)")
        add(m, "all", 100 * cov[m], "share of Indian workers whose occupation has a score, percent")
        for key, mask, name in [
            ("sex", g["sex"] == 2, "women"), ("sex", g["sex"] == 1, "men"),
            ("sector", g["sec"] == 1, "rural"), ("sector", g["sec"] == 2, "urban"),
        ] + [("status", g["status"] == s, s) for s in ["self", "family", "regular", "casual"]]:
            h = g[mask]
            add(m, f"{key}:{name}", wmean(h[col], h["w"]), "mean percentile")
            add(m, f"{key}:{name}", 100 * wmean((h[col] > 100 * 2 / 3).astype(float), h["w"]), "share above the US top-third line, percent")
        # by education: graduate or above (codes 12, 13)
        edu_hi = pd.to_numeric(g["gedu_lvl"], errors="coerce").isin([12, 13])
        add(m, "education:graduate_or_above", wmean(g.loc[edu_hi, col], g.loc[edu_hi, "w"]), "mean percentile")
        add(m, "education:graduate_or_above", 100 * wmean((g.loc[edu_hi, col] > 100 * 2 / 3).astype(float), g.loc[edu_hi, "w"]), "share above the US top-third line, percent")
        add(m, "education:below_graduate", wmean(g.loc[~edu_hi, col], g.loc[~edu_hi, "w"]), "mean percentile")
        add(m, "education:below_graduate", 100 * wmean((g.loc[~edu_hi, col] > 100 * 2 / 3).astype(float), g.loc[~edu_hi, "w"]), "share above the US top-third line, percent")
    pd.DataFrame(rows).round(4).to_csv(OUT / "india_b_summary.csv", index=False)

    # ---- Indian workers split into thirds by the Microsoft percentile; pay and informality by third
    base = "ms"
    g = wk[wk[f"{base}_pas"].notna()].copy()
    q1, q2 = wquantile(g[f"{base}_pas"], g["w"], 1 / 3), wquantile(g[f"{base}_pas"], g["w"], 2 / 3)
    g["third"] = np.where(g[f"{base}_pas"] <= q1, "low", np.where(g[f"{base}_pas"] <= q2, "middle", "high"))
    print("Indian-worker third cut points (US percentile):", round(q1, 1), round(q2, 1))
    d["ms_third"] = np.where(d["ms_cws"] <= q1, "low", np.where(d["ms_cws"] <= q2, "middle", "high"))
    edu_num = pd.to_numeric(g["gedu_lvl"], errors="coerce")
    prow = []
    for t in ["low", "middle", "high"]:
        h = g[g["third"] == t]
        reg_w = h[h["status"] == "regular"]
        r = {
            "third": t, "n_workers_sample": len(h),
            "share_of_workers_pct": 100 * h["w"].sum() / g["w"].sum(),
            "women_share_pct": 100 * wmean(h["female"].astype(float), h["w"]),
            "rural_share_pct": 100 * wmean(h["rural"].astype(float), h["w"]),
            "graduate_share_pct": 100 * wmean(edu_num[h.index].isin([12, 13]).astype(float), h["w"]),
            "regular_wage_share_pct": 100 * h.loc[h["status"] == "regular", "w"].sum() / h["w"].sum(),
            "self_employed_share_pct": 100 * h.loc[h["status"] == "self", "w"].sum() / h["w"].sum(),
            "casual_share_pct": 100 * h.loc[h["status"] == "casual", "w"].sum() / h["w"].sum(),
            "unpaid_family_share_pct": 100 * h.loc[h["status"] == "family", "w"].sum() / h["w"].sum(),
            "regular_no_written_contract_pct": 100 * wmean((reg_w["job_pas"] == 1).astype(float), reg_w["w"]),
            "regular_no_social_security_pct": 100 * wmean((reg_w["ssec_pas"] == 8).astype(float), reg_w["w"]),
        }
        pr = d[(d["ms_third"] == t) & d["acws"].isin([31, 71, 72]) & (d["ern_reg"] > 0)]
        ps = d[(d["ms_third"] == t) & d["acws"].isin([11, 12, 61, 62]) & (d["ern_self"] > 0)]
        r["n_regular_earners"] = len(pr)
        r["regular_pay_median"] = wquantile(pr["ern_reg"], pr["w"], 0.5)
        r["regular_pay_mean"] = wmean(pr["ern_reg"], pr["w"])
        r["n_self_earners"] = len(ps)
        r["self_income_median"] = wquantile(ps["ern_self"], ps["w"], 0.5)
        r["third_lower_cut"] = {"low": 0.0, "middle": q1, "high": q2}[t]
        r["third_upper_cut"] = {"low": q1, "middle": q2, "high": 100.0}[t]
        prow.append(r)
    pd.DataFrame(prow).round(3).to_csv(OUT / "india_b_thirds.csv", index=False)

    # ---- major groups
    mg = wk.assign(nco1=wk["ocu_pas"].str[0]).groupby("nco1").apply(
        lambda h: pd.Series({
            "share_of_workers_pct": 100 * h["w"].sum() / wk["w"].sum(),
            "mean_ms_pct": wmean(h["ms_pas"], h["w"]),
            "mean_aei_pct": wmean(h["aei_pas"], h["w"]),
            "women_share_pct": 100 * wmean(h["female"].astype(float), h["w"]),
        }), include_groups=False).reset_index()
    names = pd.read_csv(RAW / "ilo_isco08/ISCO-08_EN.csv", dtype=str, encoding="cp1252")
    names = names[names["ISCO_version"].str.strip() == "ISCO-08"][["major", "major_label"]].drop_duplicates()
    mg = mg.merge(names.rename(columns={"major": "nco1", "major_label": "major_group"}), on="nco1", how="left")
    mg.round(3).to_csv(OUT / "india_b_major_groups.csv", index=False)

    # ---- regressions: monthly pay of regular wage workers vs exposure
    regs = []
    r = d[d["acws"].isin([31, 71, 72]) & (d["ern_reg"] > 0) & d["ms_cws"].notna()].copy()
    r["lpay"] = np.log(r["ern_reg"])
    r["x"] = r["ms_cws"] / 100.0
    r["age"] = r["age"].astype(float)
    r["age2"] = r["age"] ** 2 / 100
    specs = {
        "none": "lpay ~ x",
        "sex_age_sector": "lpay ~ x + female + age + age2 + rural",
        "plus_education": "lpay ~ x + female + age + age2 + rural + C(gedu_lvl)",
        "plus_education_state": "lpay ~ x + female + age + age2 + rural + C(gedu_lvl) + C(st)",
    }
    for name, f in specs.items():
        fit = smf.wls(f, data=r, weights=r["w"]).fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(r["cluster"])[0]})
        b, se = fit.params["x"], fit.bse["x"]
        regs.append({"outcome": "log monthly pay, regular wage workers", "spec": name, "coef_per_full_range": b, "se": se,
                     "ci_low": b - 1.96 * se, "ci_high": b + 1.96 * se, "pct_change_25_to_75": 100 * (np.exp(0.5 * b) - 1), "n": int(fit.nobs)})
    # share of high exposure by sex among regular wage workers is in the summary; also a sample-size line
    pd.DataFrame(regs).round(4).to_csv(OUT / "india_b_regressions.csv", index=False)
    print(pd.DataFrame(regs).round(3).to_string())

    # ---- agreement of the two measures across Indian occupation groups, and exposure vs pay across groups
    t = grp_out.dropna(subset=["ms_pct", "aei_pct"])
    rho_m, _ = spearmanr(t["ms_pct"], t["aei_pct"])
    t2 = grp_out.dropna(subset=["ms_pct", "median_monthly_pay_regular"])
    rho_p, _ = spearmanr(t2["ms_pct"], t2["median_monthly_pay_regular"])
    extra = pd.DataFrame([
        {"stat": "spearman_ms_vs_aei_across_occupation_groups", "value": rho_m, "n": len(t)},
        {"stat": "spearman_ms_vs_median_regular_pay_across_occupation_groups", "value": rho_p, "n": len(t2)},
        {"stat": "share_workers_code_in_isco08_pct", "value": 100 * cov_code, "n": len(wk)},
        {"stat": "persons_in_file", "value": n_all, "n": n_all},
        {"stat": "workers_usual_principal_status", "value": len(wk), "n": len(wk)},
        {"stat": "weight_sum_billion", "value": d["w"].sum() / 1e9, "n": n_all},
        {"stat": "third_cut_low_to_middle_us_pct", "value": q1, "n": len(g)},
        {"stat": "third_cut_middle_to_high_us_pct", "value": q2, "n": len(g)},
    ])
    extra.round(4).to_csv(OUT / "india_b_checks.csv", index=False)
    print(extra.round(3).to_string())

    ex.round(4).to_csv(OUT / "india_b_exposure_by_isco3.csv", index=False)
    print(pd.DataFrame(prow).round(2).T.to_string())
    print(pd.DataFrame(rows).query("scope=='all'").round(2).to_string())


if __name__ == "__main__":
    main()
