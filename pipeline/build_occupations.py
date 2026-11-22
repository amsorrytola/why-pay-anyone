"""Build the occupation table used by M2 (where AI is used) and M4 (labour model).

One row per detailed occupation (6-digit SOC 2018) in the BLS May 2025 national
OEWS file, joined with:
  - Microsoft's AI applicability score,
  - the Anthropic Economic Index (Claude.ai, April and May 2026): the occupation's
    share of usage worldwide and in India, plus pct-weighted usage metrics.

Run from the repo root:  uv run python pipeline/build_occupations.py
Output: data/processed/occupations.csv

Notes on the join
  - The Economic Index uses 8-digit O*NET-SOC codes (e.g. 13-1041.00). Several can
    share one 6-digit SOC, so shares are summed and metrics are averaged weighted by
    usage share.
  - A missing Economic Index cell means "not published" (the data has minimum-sample
    thresholds), not zero. India's shares are therefore left empty where unpublished.
  - Usage is worldwide Claude.ai; employment and wages are US. The ratio below
    compares the two and is a descriptive index, not a causal measure.
"""
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed" / "occupations.csv"

AEI_METRICS = {
    "collaboration_bucket_automation_pct": "aei_automation_pct",
    "collaboration_bucket_augmentation_pct": "aei_augmentation_pct",
    "ai_autonomy_mean": "aei_ai_autonomy",
    "human_only_time_mean": "aei_human_only_hours",
    "human_with_ai_time_mean": "aei_with_ai_minutes",
    "use_case_work_pct": "aei_work_use_pct",
}


def load_oews():
    z = zipfile.ZipFile(RAW / "bls_oews" / "oesm25nat.zip")
    with z.open("oesm25nat/national_M2025_dl.xlsx") as f:
        df = pd.read_excel(f, sheet_name=0, dtype=str)
    df = df[df["O_GROUP"] == "detailed"].copy()
    for c in ["TOT_EMP", "H_MEAN", "A_MEAN", "A_MEDIAN"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")  # '*', '#' and '**' become NaN
    out = df.rename(columns={"OCC_CODE": "soc", "OCC_TITLE": "title", "TOT_EMP": "employment",
                             "H_MEAN": "hourly_mean", "A_MEAN": "annual_mean", "A_MEDIAN": "annual_median"})
    out = out[["soc", "title", "employment", "hourly_mean", "annual_mean", "annual_median"]]
    out["wage_bill"] = out["employment"] * out["annual_mean"]
    total_emp = out["employment"].sum()
    out["employment_share_pct"] = 100 * out["employment"] / total_emp
    return out


def load_microsoft():
    df = pd.read_csv(RAW / "microsoft_working_with_ai" / "ai_applicability_scores.csv")
    return df.rename(columns={"SOC Code": "soc", "ai_applicability_score": "ms_applicability"})[["soc", "ms_applicability"]]


def load_aei():
    p = RAW / "anthropic_economic_index_2026_06_26" / "aei_claude_ai_2026-06-26.csv"
    df = pd.read_csv(p, dtype={"node_external_id": str})
    df = df[(df["category_name"] == "soc_occupation") & (df["hierarchy_level"] == 0) & df["geo_id"].isin(["GLOBAL", "IND"])]
    df = df.assign(soc=df["node_external_id"].str[:7])
    n_months = df["date_start"].nunique()
    assert n_months == 2, n_months

    def share(geo, name):
        s = df[(df["geo_id"] == geo) & (df["metric_id"] == "pct")]
        s = s.groupby(["soc", "date_start"])["value"].sum().groupby("soc").mean()  # mean over the two months
        return s.rename(name)

    out = pd.concat([share("GLOBAL", "aei_global_share_pct"), share("IND", "aei_india_share_pct")], axis=1)

    # usage-weighted metrics, global, both months stacked
    g = df[df["geo_id"] == "GLOBAL"]
    w = g[g["metric_id"] == "pct"][["soc", "node_external_id", "date_start", "value"]].rename(columns={"value": "w"})
    cols = {}
    for metric, name in AEI_METRICS.items():
        m = g[g["metric_id"] == metric][["node_external_id", "date_start", "value"]]
        j = w.merge(m, on=["node_external_id", "date_start"])
        j = j[j["w"] > 0]
        cols[name] = (j["value"] * j["w"]).groupby(j["soc"]).sum() / j["w"].groupby(j["soc"]).sum()
    out = pd.concat([out, pd.DataFrame(cols)], axis=1)
    out.index.name = "soc"
    return out.reset_index()


def main():
    oews = load_oews()
    occ = oews.merge(load_microsoft(), on="soc", how="left").merge(load_aei(), on="soc", how="left")
    occ["aei_usage_ratio"] = occ["aei_global_share_pct"] / occ["employment_share_pct"]
    occ["aei_speedup"] = occ["aei_human_only_hours"] * 60 / occ["aei_with_ai_minutes"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    occ.round(6).to_csv(OUT, index=False)

    print(f"wrote {OUT.relative_to(ROOT)}: {len(occ)} occupations")
    print("with Microsoft score:", occ["ms_applicability"].notna().sum(),
          "| with Economic Index share:", occ["aei_global_share_pct"].notna().sum(),
          "| with India share:", occ["aei_india_share_pct"].notna().sum(),
          "| with wage bill:", occ["wage_bill"].notna().sum())
    print(f"Economic Index worldwide share covered by these occupations: {occ['aei_global_share_pct'].sum():.1f}%")
    print(f"Economic Index India share covered: {occ['aei_india_share_pct'].sum():.1f}%")


if __name__ == "__main__":
    main()
