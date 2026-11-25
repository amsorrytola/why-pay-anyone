"""Collect the numbers the presentation draws, from the website's own data files (web/src/data), into
presentation/deck/data.js. Every chart in the video uses the same data as the site and the report.

    .venv/bin/python -I presentation/deckdata.py
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "web" / "src" / "data"


def load(name):
    return json.loads((DATA / f"{name}.json").read_text())


def main() -> None:
    out = {}

    price = sorted((r for r in load("m1_price_of_capability") if r["threshold"] == 120), key=lambda r: r["month"])
    out["price"] = [[r["month"], r["price"], r["cheapest_model"].split(" (")[0]] for r in price]
    fit = next(r for r in load("m1_price_decline_fits") if r["threshold"] == 120)
    out["priceFit"] = {"halving": fit["halving_time_months"], "annualDecline": fit["annual_decline_pct"]}
    vol = load("m1_volume_monthly")
    out["volume"] = [[r["month"], r["all_tokens_per_day"]] for r in vol]
    e = load("m1_elasticity")[0]
    out["elasticity"] = {"est": e["elasticity"], "lo": e["ci_low"], "hi": e["ci_high"], "models": e["n_models"]}

    sc = [r for r in load("m2_scatter") if r["ms_applicability"] is not None and r["aei_status"] is not None and r["aei_global_share_pct"] is not None]
    out["scatter"] = [[r["ms_applicability"], r["aei_usage_ratio"] or 0, r["employment"] or 0, r["major_group"]] for r in sc]
    out["groups"] = [[g["major_group_name"], g["employment_share_pct"], g["aei_usage_share_pct"], g["ms_applicability_emp_weighted"]] for g in load("m2_major_groups")]

    out["btos"] = [[r["ref_end"], r["estimate_pct"]] for r in load("m3_btos_national") if r["question_id"] == 7 and r["answer"] == "Yes"]
    paths = [r for r in load("m3_event_study_group_paths") if r["country"] == "US" and r["spec"] == "tercile_ms"]
    out["postings"] = {g: [[r["month"], r["postings_index_baseline_100"]] for r in paths if r["group"] == g] for g in ("high", "low")}
    s = next(r for r in load("m3_event_study_summary") if r["country"] == "US" and r["spec"] == "tercile_ms" and r["window"] == "post_all")
    out["eventStudy"] = {"pct": s["pct"], "lo": s["pct_lo"], "hi": s["pct_hi"], "p": s["perm_p"]}

    out["hhi"] = [[r["month"], r["hhi"], r["leader"], r["cr1"]] for r in load("m5_concentration_monthly") if r["month"] <= "2026-10"]
    h = load("m5_host_competition")[0]
    out["hosts"] = {"coef": h["coef_log_hosts"], "lo": h["ci_low"], "hi": h["ci_high"], "models": h["n_models"]}

    # Labour share at year 30 by the elasticity of substitution between compute and labour (docs/findings-m6.md)
    out["labourShareBySigma"] = [[0.5, 59.5], [1.0, 58.9], [1.25, 57.3], [2.0, 48.6], [3.0, 37.3]]
    out["labourShareToday"] = 58.8

    nco = [r for r in load("india_b_nco3") if r.get("ms_pct") is not None]
    out["indiaOcc"] = [[r["ms_pct"], r["share_of_workers_pct"], r["label"]] for r in nco]
    summ = {(r["measure"], r["scope"], r["label"].split(",")[0]): r["value"] for r in load("india_b_summary")}
    out["india"] = {
        "meanPct": summ[("ms", "all", "mean percentile of Indian workers (US workers = 50)")],
        "topThird": summ[("ms", "all", "share of Indian workers above the US top-third line")],
        "urban": summ[("ms", "sector:urban", "share above the US top-third line")],
        "rural": summ[("ms", "sector:rural", "share above the US top-third line")],
        "grad": summ[("ms", "education:graduate_or_above", "share above the US top-third line")],
        "nongrad": summ[("ms", "education:below_graduate", "share above the US top-third line")],
    }
    regs = {r["spec"]: r["pct_change_25_to_75"] for r in load("india_b_regressions")}
    out["india"]["payRaw"] = regs["none"]
    out["india"]["payControlled"] = regs["plus_education_state"]
    thirds = {r["third"]: r for r in load("india_b_thirds")}
    out["india"]["noContractHigh"] = thirds["high"]["regular_no_written_contract_pct"]
    out["india"]["noContractLow"] = thirds["low"]["regular_no_written_contract_pct"]

    (HERE / "deck").mkdir(exist_ok=True)
    (HERE / "deck" / "data.js").write_text(
        "// Made by presentation/deckdata.py from web/src/data. Do not edit by hand.\n"
        f"window.DATA = {json.dumps(out, separators=(',', ':'))};\n"
    )
    print({k: (len(v) if isinstance(v, list) else "ok") for k, v in out.items()})
    print(out["india"])


if __name__ == "__main__":
    main()
