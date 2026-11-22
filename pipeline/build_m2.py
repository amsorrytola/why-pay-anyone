"""Module M2 (where AI is used): do independent measures agree?  Exploratory.

Inputs
  data/processed/occupations.csv  (built by build_occupations.py)
  data/raw/onet_31_0/db_31_0_text.zip  (Job Zones, Work Activities)
  data/raw/anthropic_economic_index_2026_06_26/aei_claude_ai_2026-06-26.csv  (major-group rows,
      and monthly occupation shares for the stability check)

Run from the repo root:  uv run python pipeline/build_m2.py
Outputs (data/processed/)
  m2_agreement.csv      Spearman and Kendall (tau-b) between exposure measures, plain and
                        employment-weighted, with bootstrap 95% intervals
  m2_disagreement.csv   25 occupations in each direction with the largest percentile-rank gap
  m2_major_groups.csv   SOC major-group summary
  m2_regressions.csv    OLS with heteroskedasticity-robust SEs (and one Poisson PML check)
  m2_scatter.csv        one row per occupation for the scatter explorer
  m2_quirks.csv         data quirks the site should warn about
  m2_summary.csv        headline numbers and sample sizes

Definitions and choices
  - ms_applicability: Microsoft AI applicability score (Bing Copilot, 2024).
  - aei_global_share_pct: occupation's share of worldwide Claude.ai conversations (April and May
    2026), rounded to 0.01 point in the source. 0.00 is a published zero (below 0.005%); an empty
    cell is "not published". The 591 occupations with a published cell are the agreement sample.
  - aei_usage_ratio: share divided by the occupation's share of US employment (worldwide usage
    against US employment, so descriptive).
  - Rank gap: percentile rank (ties get the average rank) of the usage ratio minus percentile
    rank of the applicability score, over the 591 occupations that have both.
  - Weighted statistics use US employment as weights. Weighted Spearman is the weighted Pearson
    correlation of weighted mid-ranks; weighted Kendall is tau-b with pair weights w_i * w_j.
  - Bootstrap: resample occupations with replacement (B = 2000, fixed seed), percentile interval.
    The within-major-group Spearman interval uses the first 1000 of those resamples (speed).
    Single-threaded linear algebra is forced at the top so repeated runs give identical files.
"""
import os
import zipfile
from pathlib import Path

for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[_v] = "1"  # single-threaded linear algebra: same numbers on every run

import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
SEED = 20261122
B = 2000
AEI_FILE = RAW / "anthropic_economic_index_2026_06_26" / "aei_claude_ai_2026-06-26.csv"
SMALL_EMP = 10_000  # below this the usage ratio is too noisy for the headline disagreement lists


# ----------------------------------------------------------------------------- loading
def load_occupations():
    o = pd.read_csv(OUT / "occupations.csv")
    o["major_group"] = o["soc"].str[:2]
    return o


def load_onet_features(socs):
    """Job zone (mean over O*NET-SOC codes within a 6-digit SOC) and three work-activity importances."""
    z = zipfile.ZipFile(RAW / "onet_31_0" / "db_31_0_text.zip")
    jz = pd.read_csv(z.open("db_31_0_text/Job Zones.txt"), sep="\t")
    jz["soc"] = jz["O*NET-SOC Code"].str[:7]
    jz_soc = jz.groupby("soc")["Job Zone"].mean()
    wa = pd.read_csv(z.open("db_31_0_text/Work Activities.txt"), sep="\t")
    wa = wa[wa["Scale ID"] == "IM"].copy()
    wa["soc"] = wa["O*NET-SOC Code"].str[:7]
    imp = wa.pivot_table(index="soc", columns="Element ID", values="Data Value", aggfunc="mean")
    feats = pd.DataFrame(index=sorted(set(socs)))
    feats["job_zone"] = np.nan
    feats["job_zone_source"] = "none"
    codes = list(jz_soc.index)
    for soc in feats.index:
        if soc in jz_soc.index:
            feats.loc[soc, ["job_zone", "job_zone_source"]] = [jz_soc[soc], "exact"]
        elif soc.endswith("0"):  # an OEWS aggregate such as 13-1020 covers O*NET codes 13-102x
            sub = [c for c in codes if c.startswith(soc[:6])]
            if sub:
                feats.loc[soc, ["job_zone", "job_zone_source"]] = [jz_soc[sub].mean(), "prefix"]
    feats["onet_physical"] = imp[["4.A.3.a.1", "4.A.3.a.2"]].mean(axis=1).reindex(feats.index)  # general physical, handling objects
    feats["onet_computer"] = imp["4.A.3.b.1"].reindex(feats.index)  # working with computers
    feats["onet_public"] = imp["4.A.4.a.3"].reindex(feats.index)  # communicating with people outside the organization
    feats.index.name = "soc"
    return feats.reset_index()


def load_aei_raw():
    df = pd.read_csv(AEI_FILE, dtype={"node_external_id": str},
                     usecols=["date_start", "geo_id", "category_name", "hierarchy_level", "metric_id", "value", "node_name", "node_external_id"])
    df = df[(df["category_name"] == "soc_occupation") & df["geo_id"].isin(["GLOBAL", "IND"])]
    return df


def monthly_occupation_shares(aei):
    d = aei[(aei["geo_id"] == "GLOBAL") & (aei["hierarchy_level"] == 0) & (aei["metric_id"] == "pct")].copy()
    d["soc"] = d["node_external_id"].str[:7]
    m = d.groupby(["soc", "date_start"])["value"].sum().unstack("date_start")
    m.columns = ["apr", "may"]
    return m


def group_level(aei):
    g = aei[aei["hierarchy_level"] == 1].copy()
    g["major_group"] = g["node_external_id"].astype(str)
    want = {"pct": "share", "collaboration_bucket_automation_pct": "automation",
            "collaboration_bucket_augmentation_pct": "augmentation", "use_case_work_pct": "work_use"}
    g = g[g["metric_id"].isin(want)]
    g["m"] = g["metric_id"].map(want)
    t = g.groupby(["major_group", "geo_id", "m"])["value"].mean().unstack(["geo_id", "m"])  # mean of the two months
    t.columns = [f"{a.lower()}_{b}" for a, b in t.columns]
    names = g.drop_duplicates("major_group").set_index("major_group")["node_name"]
    t["major_group_name"] = names
    return t.reset_index()


# ----------------------------------------------------------------------------- statistics
def wmidrank(x, w):
    """Weighted mid-rank scaled to (0, 1): weight below plus half the weight tied, over total weight."""
    order = np.argsort(x, kind="mergesort")
    xs = x[order]
    ws = w[order]
    cw = np.concatenate([[0.0], np.cumsum(ws)])
    _, start, counts = np.unique(xs, return_index=True, return_counts=True)
    mid = (cw[start] + cw[start + counts]) / 2 / cw[-1]
    r = np.empty(len(x))
    r[order] = np.repeat(mid, counts)
    return r


def wspearman(x, y, w):
    rx, ry = wmidrank(x, w), wmidrank(y, w)
    mx, my = np.average(rx, weights=w), np.average(ry, weights=w)
    cov = np.average((rx - mx) * (ry - my), weights=w)
    vx = np.average((rx - mx) ** 2, weights=w)
    vy = np.average((ry - my) ** 2, weights=w)
    return cov / np.sqrt(vx * vy) if vx > 0 and vy > 0 else np.nan


def wkendall(x, y, w):
    sx = np.sign(x[:, None] - x[None, :])
    sy = np.sign(y[:, None] - y[None, :])
    num = w @ (sx * sy) @ w
    dx = w @ (sx * sx) @ w
    dy = w @ (sy * sy) @ w
    return num / np.sqrt(dx * dy) if dx > 0 and dy > 0 else np.nan


def partial_spearman(x, y, z):
    """Spearman correlation of x and y after removing the linear effect of the ranks of z."""
    rx, ry, rz = (stats.rankdata(v) for v in (x, y, z))
    Z = np.column_stack([np.ones(len(rz)), rz])
    ex = rx - Z @ np.linalg.lstsq(Z, rx, rcond=None)[0]
    ey = ry - Z @ np.linalg.lstsq(Z, ry, rcond=None)[0]
    return np.corrcoef(ex, ey)[0, 1]


def within_group_spearman(x, y, g):
    """Spearman correlation after removing each group's mean rank (ranks taken over all rows)."""
    rx, ry = stats.rankdata(x), stats.rankdata(y)
    df = pd.DataFrame({"rx": rx, "ry": ry, "g": g})
    ex = df["rx"] - df.groupby("g")["rx"].transform("mean")
    ey = df["ry"] - df.groupby("g")["ry"].transform("mean")
    return float(np.corrcoef(ex, ey)[0, 1])


def agreement_rows(label_a, label_b, d, a, b, sample, wcol="employment", seed_offset=0, do_partial=True):
    """All statistics for one pair of columns over the rows of d (complete cases)."""
    d = d.dropna(subset=[a, b]).reset_index(drop=True)
    x, y, w = d[a].to_numpy(float), d[b].to_numpy(float), d[wcol].to_numpy(float)
    n = len(d)
    rng = np.random.default_rng(SEED + seed_offset)
    idx = rng.integers(0, n, size=(B, n))
    ones = np.ones(n)
    rows = []

    def add(stat, weighting, fn, wt):
        est = fn(x, y, wt)
        boot = np.array([fn(x[i], y[i], wt[i]) for i in idx])
        lo, hi = np.nanpercentile(boot, [2.5, 97.5])
        rows.append({"measure_a": label_a, "measure_b": label_b, "sample": sample, "weighting": weighting, "statistic": stat,
                     "n": n, "estimate": round(est, 3), "ci_low": round(lo, 3), "ci_high": round(hi, 3)})

    add("spearman", "unweighted", lambda x, y, w: wspearman(x, y, ones[:len(x)]), ones)
    add("spearman", "employment", wspearman, w)
    add("kendall_tau_b", "unweighted", lambda x, y, w: wkendall(x, y, ones[:len(x)]), ones)
    add("kendall_tau_b", "employment", wkendall, w)
    if do_partial:
        dz = d.dropna(subset=["job_zone"]).reset_index(drop=True)
        xz, yz, zz = dz[a].to_numpy(float), dz[b].to_numpy(float), dz["job_zone"].to_numpy(float)
        nz = len(dz)
        idz = np.random.default_rng(SEED + seed_offset + 100).integers(0, nz, size=(B, nz))
        est = partial_spearman(xz, yz, zz)
        boot = np.array([partial_spearman(xz[i], yz[i], zz[i]) for i in idz])
        lo, hi = np.nanpercentile(boot, [2.5, 97.5])
        rows.append({"measure_a": label_a, "measure_b": label_b, "sample": sample + " with a job zone", "weighting": "unweighted",
                     "statistic": "partial_spearman_given_job_zone", "n": nz, "estimate": round(est, 3),
                     "ci_low": round(lo, 3), "ci_high": round(hi, 3)})
    if do_partial:
        gg = d["major_group"].to_numpy()
        est = within_group_spearman(x, y, gg)
        boot = np.array([within_group_spearman(x[i], y[i], gg[i]) for i in idx[:1000]])
        lo, hi = np.nanpercentile(boot, [2.5, 97.5])
        rows.append({"measure_a": label_a, "measure_b": label_b, "sample": sample, "weighting": "unweighted",
                     "statistic": "within_major_group_spearman", "n": n, "estimate": round(est, 3),
                     "ci_low": round(lo, 3), "ci_high": round(hi, 3)})
    return rows


# ----------------------------------------------------------------------------- pieces
def build_agreement(o):
    rows = []
    both = o[o["ms_applicability"].notna() & o["aei_global_share_pct"].notna()]
    pos = both[both["aei_global_share_pct"] > 0]
    # the two exposure measures
    rows += agreement_rows("ms_applicability", "aei_global_share_pct", both, "ms_applicability", "aei_global_share_pct",
                           "591 occupations with a published Claude.ai cell", seed_offset=1)
    rows += agreement_rows("ms_applicability", "aei_usage_ratio", both, "ms_applicability", "aei_usage_ratio",
                           "591 occupations with a published Claude.ai cell", seed_offset=1)
    rows += agreement_rows("ms_applicability", "aei_usage_ratio", pos, "ms_applicability", "aei_usage_ratio",
                           "423 occupations with positive usage share", seed_offset=2)
    # sensitivity: treat unpublished as zero
    allms = o[o["ms_applicability"].notna()].copy()
    allms["aei_share_missing_as_zero"] = allms["aei_global_share_pct"].fillna(0.0)
    allms["aei_ratio_missing_as_zero"] = allms["aei_share_missing_as_zero"] / allms["employment_share_pct"]
    rows += agreement_rows("ms_applicability", "aei_usage_ratio (unpublished set to 0)", allms, "ms_applicability",
                           "aei_ratio_missing_as_zero", "783 occupations with an applicability score (sensitivity)", seed_offset=3)
    # India's own occupation shares
    ind = o[o["ms_applicability"].notna() & o["aei_india_share_pct"].notna()]
    rows += agreement_rows("ms_applicability", "aei_india_share_pct", ind, "ms_applicability", "aei_india_share_pct",
                           "396 occupations with a published India cell", seed_offset=4)
    # automation share (only where usage is positive)
    au = o[o["ms_applicability"].notna() & o["aei_automation_pct"].notna()]
    rows += agreement_rows("ms_applicability", "aei_automation_pct", au, "ms_applicability", "aei_automation_pct",
                           "423 occupations with positive usage share", seed_offset=5)
    rows += agreement_rows("aei_usage_ratio", "aei_automation_pct", au, "aei_usage_ratio", "aei_automation_pct",
                           "423 occupations with positive usage share", seed_offset=5, do_partial=False)
    # employment vs the measures, as a reference for how much size matters
    rows += agreement_rows("employment", "aei_global_share_pct", both, "employment", "aei_global_share_pct",
                           "591 occupations with a published Claude.ai cell", seed_offset=6, do_partial=False)
    rows += agreement_rows("employment", "ms_applicability", both, "employment", "ms_applicability",
                           "591 occupations with a published Claude.ai cell", seed_offset=6, do_partial=False)
    return pd.DataFrame(rows)


def pct_rank(s):
    return s.rank(pct=True, method="average")


def add_ranks(o):
    both = o["ms_applicability"].notna() & o["aei_global_share_pct"].notna()
    o["ms_pct_rank"] = np.nan
    o["aei_ratio_pct_rank"] = np.nan
    o["aei_share_pct_rank"] = np.nan
    o.loc[both, "ms_pct_rank"] = pct_rank(o.loc[both, "ms_applicability"])
    o.loc[both, "aei_ratio_pct_rank"] = pct_rank(o.loc[both, "aei_usage_ratio"])
    o.loc[both, "aei_share_pct_rank"] = pct_rank(o.loc[both, "aei_global_share_pct"])
    o["rank_gap_ratio"] = o["aei_ratio_pct_rank"] - o["ms_pct_rank"]
    o["rank_gap_share"] = o["aei_share_pct_rank"] - o["ms_pct_rank"]
    return o


def hint(row, direction):
    """One-line, rule-based cue for the gap. These are data cues, not tested explanations."""
    cues = []
    if direction == "aei_above_ms":
        if "All Other" in row["title"]:
            cues.append("catch-all code that can absorb unclassified conversations")
        if row["employment"] < 50_000 and row["rank_gap_ratio"] - row["rank_gap_share"] >= 0.15:
            cues.append(f"small employment base ({int(row['employment']):,}) lifts the ratio rank")
        if pd.notna(row["aei_work_use_pct"]) and row["aei_work_use_pct"] < 40:
            cues.append(f"only {row['aei_work_use_pct']:.0f}% of its conversations are work use")
        if pd.notna(row["onet_physical"]) and row["onet_physical"] >= 3.5:
            cues.append("hands-on job; Claude.ai use is probably about information or study, not the job itself")
        if not cues:
            cues.append("no data cue; usage sits in tasks the applicability score weights lightly")
    else:
        if row["aei_global_share_pct"] == 0:
            cues.append("published Claude.ai share rounds to 0.00%")
        if pd.notna(row["onet_public"]) and row["onet_public"] >= 3.8 and row["major_group"] in ("41", "43", "39", "21"):
            cues.append("live customer or public contact work, done outside a chat window")
        if pd.notna(row["onet_physical"]) and row["onet_physical"] >= 3.5:
            cues.append("hands-on job")
        if not cues:
            cues.append("no data cue; applicable on paper, little observed Claude.ai use")
    return "; ".join(cues)


def build_disagreement(o):
    d = o[o["ms_pct_rank"].notna() & (o["employment"] >= SMALL_EMP)].copy()
    out = []
    for direction, asc in [("aei_above_ms", False), ("ms_above_aei", True)]:
        t = d.sort_values(["rank_gap_ratio", "soc"], ascending=[asc, True]).head(25).copy()
        t["direction"] = direction
        t["rank_in_direction"] = range(1, 26)
        t["hint"] = t.apply(lambda r: hint(r, direction), axis=1)
        out.append(t)
    t = pd.concat(out)
    cols = ["direction", "rank_in_direction", "soc", "title", "major_group_name", "job_zone", "employment", "ms_applicability",
            "ms_pct_rank", "aei_global_share_pct", "aei_usage_ratio", "aei_ratio_pct_rank", "rank_gap_ratio", "rank_gap_share", "hint"]
    t = t[cols].copy()
    for c in ["ms_pct_rank", "aei_ratio_pct_rank", "rank_gap_ratio", "rank_gap_share"]:
        t[c] = t[c].round(3)
    t["aei_usage_ratio"] = t["aei_usage_ratio"].round(3)
    t["job_zone"] = t["job_zone"].round(1)
    t["ms_applicability"] = t["ms_applicability"].round(3)
    return t


def build_groups(o, grp):
    total_emp = o["employment"].sum()
    total_wb = o["wage_bill"].sum()
    rows = []
    for g, d in o.groupby("major_group"):
        s = d[d["ms_applicability"].notna()]
        rows.append({
            "major_group": g,
            "n_occupations": len(d),
            "employment": int(d["employment"].sum()),
            "employment_share_pct": 100 * d["employment"].sum() / total_emp,
            "wage_bill_share_pct": 100 * d["wage_bill"].sum() / total_wb,
            "ms_applicability_emp_weighted": np.average(s["ms_applicability"], weights=s["employment"]),
            "ms_applicability_simple_mean": s["ms_applicability"].mean(),
            "ms_coverage_employment_pct": 100 * s["employment"].sum() / d["employment"].sum(),
            "n_occupations_positive_usage": int((d["aei_global_share_pct"] > 0).sum()),
            "detailed_usage_share_sum_pct": d["aei_global_share_pct"].sum(),
        })
    t = pd.DataFrame(rows).merge(grp, on="major_group", how="left")
    t = t.rename(columns={"global_share": "aei_usage_share_pct", "ind_share": "aei_india_usage_share_pct",
                          "global_automation": "aei_automation_pct", "global_augmentation": "aei_augmentation_pct",
                          "global_work_use": "aei_work_use_pct", "ind_automation": "aei_india_automation_pct",
                          "ind_augmentation": "aei_india_augmentation_pct", "ind_work_use": "aei_india_work_use_pct"})
    t["usage_to_employment_ratio"] = t["aei_usage_share_pct"] / t["employment_share_pct"]
    t["india_usage_to_employment_ratio"] = t["aei_india_usage_share_pct"] / t["employment_share_pct"]
    t["wage_bill_to_employment_ratio"] = t["wage_bill_share_pct"] / t["employment_share_pct"]
    cols = ["major_group", "major_group_name", "n_occupations", "employment", "employment_share_pct", "wage_bill_share_pct",
            "ms_applicability_emp_weighted", "ms_applicability_simple_mean", "ms_coverage_employment_pct",
            "aei_usage_share_pct", "aei_india_usage_share_pct", "usage_to_employment_ratio", "india_usage_to_employment_ratio",
            "aei_automation_pct", "aei_augmentation_pct", "aei_work_use_pct",
            "aei_india_automation_pct", "aei_india_augmentation_pct", "aei_india_work_use_pct",
            "n_occupations_positive_usage", "detailed_usage_share_sum_pct"]
    t = t[[c for c in cols if c in t.columns]]
    return t.round(3)


def group_agreement(grp_tbl):
    """Agreement across the 22 major groups (employment-weighted mean applicability vs usage-to-employment ratio)."""
    d = grp_tbl.dropna(subset=["ms_applicability_emp_weighted", "usage_to_employment_ratio"]).reset_index(drop=True)
    x = d["ms_applicability_emp_weighted"].to_numpy(float)
    y = d["usage_to_employment_ratio"].to_numpy(float)
    w = d["employment"].to_numpy(float)
    n = len(d)
    rng = np.random.default_rng(SEED + 7)
    idx = rng.integers(0, n, size=(B, n))
    ones = np.ones(n)
    rows = []
    for stat, wt, fn in [("spearman", "unweighted", lambda a, b, c: wspearman(a, b, np.ones(len(a)))),
                         ("spearman", "employment", wspearman),
                         ("kendall_tau_b", "unweighted", lambda a, b, c: wkendall(a, b, np.ones(len(a)))),
                         ("kendall_tau_b", "employment", wkendall)]:
        ww = w if wt == "employment" else ones
        est = fn(x, y, ww)
        boot = np.array([fn(x[i], y[i], ww[i]) for i in idx])
        lo, hi = np.nanpercentile(boot, [2.5, 97.5])
        rows.append({"measure_a": "ms_applicability (group mean)", "measure_b": "aei_usage_ratio (group)", "sample": f"{n} SOC major groups",
                     "weighting": wt, "statistic": stat, "n": n, "estimate": round(est, 3), "ci_low": round(lo, 3), "ci_high": round(hi, 3)})
    return pd.DataFrame(rows)


def tidy(res, model, dep, n, extra, sds, keep_prefix=("ms10", "ln_wage", "job_zone", "ln_emp")):
    ci = res.conf_int()
    rows = []
    for term in res.params.index:
        if not term.startswith(keep_prefix):
            continue
        rows.append({"model": model, "dependent": dep, "term": term, "coef": res.params[term], "se": res.bse[term],
                     "t_or_z": res.tvalues[term], "p": res.pvalues[term], "ci_low": ci.loc[term, 0], "ci_high": ci.loc[term, 1],
                     "effect_per_sd_of_term": res.params[term] * sds.get(term, np.nan), "n": n, **extra})
    return rows


def build_regressions(o):
    d = o.copy()
    d["ms10"] = d["ms_applicability"] / 0.1  # coefficient is per +0.1 of the applicability score
    d["ln_wage"] = np.log(d["annual_mean"])
    d["ln_emp"] = np.log(d["employment"])
    d["ln_ratio"] = np.log(d["aei_usage_ratio"].where(d["aei_usage_ratio"] > 0))
    d["grp"] = d["major_group"]
    base = d.dropna(subset=["ms10", "ln_wage", "job_zone"]).copy()
    rows = []

    def fit(formula, data, model, dep, weights=None, extra=None):
        mod = smf.wls(formula, data, weights=weights) if weights is not None else smf.ols(formula, data)
        res = mod.fit(cov_type="HC1")
        extra = dict(extra or {})
        extra.update({"r2": res.rsquared, "adj_r2": res.rsquared_adj, "cov": "HC1 robust"})
        gcols = [c for c in res.params.index if c.startswith("C(grp)")]
        if gcols:
            wt = res.wald_test(np.eye(len(res.params))[[list(res.params.index).index(c) for c in gcols]], scalar=True)
            extra["group_fe_wald_p"] = float(wt.pvalue)
            extra["n_groups"] = data["grp"].nunique()
        sds = {t: data[t].std() for t in ("ms10", "ln_wage", "job_zone", "ln_emp") if t in data}
        rows.extend(tidy(res, model, dep, int(res.nobs), extra, sds))
        return res

    # usage ratio (positive-usage occupations, common sample for M1 to M4)
    s = base[base["ln_ratio"].notna()].copy()
    fit("ln_ratio ~ ms10", s, "U1 applicability only", "ln(usage ratio)")
    fit("ln_ratio ~ ms10 + ln_wage + job_zone", s, "U2 + log wage, job zone", "ln(usage ratio)")
    fit("ln_ratio ~ ms10 + ln_wage + job_zone + C(grp)", s, "U3 + major-group effects", "ln(usage ratio)")
    fit("ln_ratio ~ ms10 + ln_wage + job_zone + ln_emp + C(grp)", s, "U4 + log employment", "ln(usage ratio)")
    fit("ln_ratio ~ ms10 + ln_wage + job_zone + C(grp)", s, "U3w employment-weighted (WLS)", "ln(usage ratio)", weights=s["employment"])
    # Poisson pseudo-ML on the share with log employment share as offset: keeps the published zeros
    z = base[base["aei_global_share_pct"].notna()].copy()
    mod = smf.glm("aei_global_share_pct ~ ms10 + ln_wage + job_zone + C(grp)", z, family=sm.families.Poisson(),
                  offset=np.log(z["employment_share_pct"]))
    res = mod.fit(cov_type="HC1")
    gcols = [c for c in res.params.index if c.startswith("C(grp)")]
    wt = res.wald_test(np.eye(len(res.params))[[list(res.params.index).index(c) for c in gcols]], scalar=True)
    sds = {t: z[t].std() for t in ("ms10", "ln_wage", "job_zone")}
    rows.extend(tidy(res, "P1 Poisson PML on share (offset ln employment share; keeps zeros)", "usage share (log link)", int(res.nobs),
                     {"r2": np.nan, "adj_r2": np.nan, "cov": "HC1 robust", "group_fe_wald_p": float(wt.pvalue), "n_groups": z["grp"].nunique()}, sds))
    # automation share, percentage points
    a = base[base["aei_automation_pct"].notna()].copy()
    fit("aei_automation_pct ~ ms10", a, "A1 applicability only", "automation share (pct points)")
    fit("aei_automation_pct ~ ms10 + ln_wage + job_zone", a, "A2 + log wage, job zone", "automation share (pct points)")
    fit("aei_automation_pct ~ ms10 + ln_wage + job_zone + C(grp)", a, "A3 + major-group effects", "automation share (pct points)")
    t = pd.DataFrame(rows)
    for c in ["coef", "se", "t_or_z", "ci_low", "ci_high", "effect_per_sd_of_term", "r2", "adj_r2"]:
        t[c] = t[c].astype(float).round(4)
    for c in ["p", "group_fe_wald_p"]:
        t[c] = t[c].astype(float).map(lambda v: float(f"{v:.3g}") if pd.notna(v) else v)  # 3 significant figures, so tiny p-values stay visible
    return t


def build_quirks(o, months, grp_tbl):
    q = []

    def add(soc, title, kind, detail):
        q.append({"soc": soc, "title": title, "quirk": kind, "detail": detail})

    pos = o[o["aei_global_share_pct"] > 0].sort_values("aei_global_share_pct", ascending=False)
    total_pub = o["aei_global_share_pct"].sum()
    # concentration
    top10 = pos.head(10)["aei_global_share_pct"].sum()
    add("", "All occupations", "concentration",
        f"The top 10 occupations hold {top10:.1f}% of usage (published detailed shares sum to {total_pub:.1f}%): "
        + "; ".join(f"{r['title']} {r['aei_global_share_pct']:.2f}" for _, r in pos.head(10).iterrows()))
    # catch-all and software developers
    r = o[o["soc"] == "15-1299"].iloc[0]
    sw = o[o["soc"] == "15-1252"].iloc[0]
    add(r["soc"], r["title"], "catch_all_code_ranks_first",
        f"Largest share of any occupation ({r['aei_global_share_pct']:.2f}%, {r['employment_share_pct']:.2f}% of US employment). "
        f"Software Developers (15-1252), the bigger job, gets {sw['aei_global_share_pct']:.2f}%. The data documentation does not explain this; "
        "one possibility is that coding conversations are coded to the catch-all. Treat computer occupations as one group")
    # tiny denominator
    hi = o[(o["aei_usage_ratio"] > 20)].sort_values("aei_usage_ratio", ascending=False)
    for _, r in hi.head(12).iterrows():
        add(r["soc"], r["title"], "ratio_inflated_by_small_employment",
            f"usage ratio {r['aei_usage_ratio']:.0f} (share {r['aei_global_share_pct']:.3f}% of worldwide usage vs {r['employment_share_pct']:.4f}% of US employment; {int(r['employment']):,} workers)")
    # librarians, counter clerks and other unexpected high shares
    unexpected = pos[(pos["aei_global_share_pct"] >= 1.0) & (pos["aei_usage_ratio"] >= 5)
                     & (~pos["soc"].str.startswith(("15-", "27-")))]
    for _, r in unexpected.iterrows():
        add(r["soc"], r["title"], "unexpectedly_high_share",
            f"{r['aei_global_share_pct']:.2f}% of usage with {int(r['employment']):,} US workers (ratio {r['aei_usage_ratio']:.1f}); "
            "the label comes from Anthropic's classification of conversations and may reflect general Q&A, not the job")
    # month-to-month stability
    mm = months.dropna()
    mm = mm[(mm["apr"] > 0) | (mm["may"] > 0)]
    rho = stats.spearmanr(mm["apr"], mm["may"])[0]
    both_big = mm[(mm["apr"] >= 0.2) & (mm["may"] >= 0.2)].copy()
    both_big["rel"] = (both_big["may"] / both_big["apr"]).apply(lambda v: max(v, 1 / v))
    worst = both_big["rel"].idxmax()
    add("", "All occupations", "two_months_only",
        f"Only April and May 2026 are available, so this is a cross-section. The two months' occupation shares correlate at Spearman {rho:.2f} "
        f"(n={len(mm)} occupations with any usage), and among the {len(both_big)} occupations with at least 0.2% in both months the largest change is a factor of "
        f"{both_big['rel'].max():.2f} ({o.set_index('soc')['title'].get(worst, worst)}). Sampling noise between windows is small; the quirks below are about how conversations are labeled")
    # one month only
    one = months[(months["apr"].isna()) ^ (months["may"].isna())]
    add("", "All occupations", "published_in_one_month_only",
        f"{len(one)} occupation codes have a cell in only one of the two months; occupations.csv averages over the months that exist")
    # zeros and missing
    n_zero = int((o["aei_global_share_pct"] == 0).sum())
    n_miss = int(o["aei_global_share_pct"].isna().sum())
    add("", "All occupations", "zero_is_not_missing",
        f"{n_zero} occupations have a published share of 0.00% (under 0.005%); {n_miss} have no published cell. Shares are rounded to 0.01 point, so ties at zero are common")
    add("", "All occupations", "unpublished_cells",
        f"{n_miss} of 830 occupations have no Claude.ai cell ({100 * o.loc[o['aei_global_share_pct'].isna(), 'employment'].sum() / o['employment'].sum():.1f}% of US employment); "
        f"{int(o['ms_applicability'].isna().sum())} have no Microsoft score ({100 * o.loc[o['ms_applicability'].isna(), 'employment'].sum() / o['employment'].sum():.1f}% of employment)")
    add("", "All occupations", "usage_metrics_need_positive_share",
        f"Automation, augmentation, autonomy and time metrics exist only for the {int(o['aei_automation_pct'].notna().sum())} occupations with positive usage")
    add("", "All occupations", "mixed_geographies",
        "Usage is worldwide Claude.ai (April and May 2026); employment and wages are US (May 2025). The ratio compares them and is not a US usage rate")
    nz = o[o["job_zone"].isna()]
    add("", "All occupations", "job_zone_missing",
        f"{len(nz)} occupations ({100 * nz['employment'].sum() / o['employment'].sum():.1f}% of employment) have no O*NET job zone (mostly 'All Other' codes and codes O*NET splits differently); they drop out of the regressions")
    return pd.DataFrame(q)


def build_scatter(o):
    cols = ["soc", "title", "major_group", "major_group_name", "employment", "annual_mean", "ms_applicability", "aei_global_share_pct",
            "aei_india_share_pct", "aei_usage_ratio", "aei_automation_pct", "job_zone", "ms_pct_rank", "aei_ratio_pct_rank", "rank_gap_ratio"]
    t = o[cols].copy()
    t["aei_status"] = np.where(o["aei_global_share_pct"].isna(), "not_published", np.where(o["aei_global_share_pct"] == 0, "zero", "positive"))
    t["small_employment"] = np.where(o["employment"] < SMALL_EMP, "yes", "no")
    for c, k in [("ms_applicability", 3), ("aei_usage_ratio", 3), ("aei_automation_pct", 2), ("job_zone", 1),
                 ("ms_pct_rank", 3), ("aei_ratio_pct_rank", 3), ("rank_gap_ratio", 3)]:
        t[c] = t[c].round(k)
    return t


def build_summary(o, agree, grp_tbl):
    rows = []

    def add(k, v, note=""):
        rows.append({"key": k, "value": v, "note": note})

    add("occupations_total", len(o), "detailed SOC 2018 occupations, BLS OEWS May 2025")
    add("with_ms_score", int(o["ms_applicability"].notna().sum()), "Microsoft applicability score")
    add("with_aei_published_cell", int(o["aei_global_share_pct"].notna().sum()), "Claude.ai worldwide share published (includes published zeros)")
    add("with_both", int((o["ms_applicability"].notna() & o["aei_global_share_pct"].notna()).sum()), "agreement sample")
    add("with_positive_usage", int((o["aei_global_share_pct"] > 0).sum()), "positive usage share; automation and time metrics exist for these")
    add("employment_share_pct_in_agreement_sample",
        round(100 * o.loc[o["ms_applicability"].notna() & o["aei_global_share_pct"].notna(), "employment"].sum() / o["employment"].sum(), 1), "")
    s = o[o["ms_applicability"].notna()]
    add("wage_bill_share_pct_ms_ge_0.3", round(100 * o.loc[o["ms_applicability"] >= 0.3, "wage_bill"].sum() / o["wage_bill"].sum(), 1),
        "share of the wage bill (of all 830 occupations; occupations without a score count in the denominator) in occupations with applicability of 0.3 or more")
    add("wage_bill_share_pct_ms_ge_0.3_of_scored", round(100 * o.loc[o["ms_applicability"] >= 0.3, "wage_bill"].sum() / s["wage_bill"].sum(), 1),
        "same, denominator = wage bill of scored occupations")
    add("employment_share_pct_ms_ge_0.3", round(100 * o.loc[o["ms_applicability"] >= 0.3, "employment"].sum() / o["employment"].sum(), 1), "")
    add("n_ms_ge_0.3", int((o["ms_applicability"] >= 0.3).sum()), "")
    add("published_detailed_share_sum_pct", round(o["aei_global_share_pct"].sum(), 2), "sum over the 591 cells; the rest is unpublished")
    add("smallest_employment_for_disagreement_list", SMALL_EMP, "occupations below this are left out of m2_disagreement.csv")
    add("bootstrap_reps", B, f"seed {SEED}")
    return pd.DataFrame(rows, dtype=object)


# ----------------------------------------------------------------------------- main
def main():
    o = load_occupations()
    feats = load_onet_features(o["soc"])
    o = o.merge(feats, on="soc", how="left")
    aei = load_aei_raw()
    months = monthly_occupation_shares(aei)
    grp = group_level(aei)

    o = add_ranks(o)
    names = grp.set_index("major_group")["major_group_name"]
    o["major_group_name"] = o["major_group"].map(names)

    groups = build_groups(o, grp)
    agree = pd.concat([build_agreement(o), group_agreement(groups)], ignore_index=True)
    dis = build_disagreement(o)
    reg = build_regressions(o)
    scatter = build_scatter(o)
    quirks = build_quirks(o, months, groups)
    summary = build_summary(o, agree, groups)

    agree.to_csv(OUT / "m2_agreement.csv", index=False)
    dis.to_csv(OUT / "m2_disagreement.csv", index=False)
    groups.to_csv(OUT / "m2_major_groups.csv", index=False)
    reg.to_csv(OUT / "m2_regressions.csv", index=False)
    scatter.to_csv(OUT / "m2_scatter.csv", index=False)
    quirks.to_csv(OUT / "m2_quirks.csv", index=False)
    summary.to_csv(OUT / "m2_summary.csv", index=False)
    for name, df in [("agreement", agree), ("disagreement", dis), ("major_groups", groups), ("regressions", reg),
                     ("scatter", scatter), ("quirks", quirks), ("summary", summary)]:
        size = (OUT / f"m2_{name}.csv").stat().st_size
        print(f"m2_{name}.csv  {len(df)} rows  {size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
