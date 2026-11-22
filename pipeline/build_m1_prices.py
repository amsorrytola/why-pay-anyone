"""M1, part 1: the price of capability.

Joins Epoch AI's capability scores (Epoch Capabilities Index, ECI) to month-end snapshots
of the LiteLLM price file, then builds:
  - m1_models.csv              matched models: score, release date, access type, price keys
  - m1_model_prices.csv        model x month panel of list prices (US dollars per million tokens)
  - m1_price_of_capability.csv for each capability threshold and month, the cheapest price of any
                               model at or above that threshold (the "frontier price")
  - m1_price_decline_fits.csv  log-linear fit of each threshold's frontier price: halving time
  - m1_hedonic_index.csv       quality-adjusted price index (hedonic regression, time-dummy method)

Run from the repo root:  uv run python pipeline/build_m1_prices.py

Definitions
  - Blended price = (3 x input price + 1 x output price) / 4, per million tokens (a 3:1 input to
    output mix). Input and output prices are kept separately in the panel.
  - A model's price in a month = the lowest positive list price among LiteLLM entries that map to
    it (so for open-weights models it is the cheapest host). Entries that are fine-tunes, batch,
    priority, audio, image, realtime or embedding variants, experimental keys, and old
    per-character entries (whose per-token field is unreliable) are ignored.
  - Prices are list prices as recorded in LiteLLM's file at each month end, not transaction prices.
  - A model counts from the month of its release (Epoch's date) onward.
Name matching is by normalised model names (see canon()); matches are listed in m1_models.csv
so they can be checked.
"""
import glob
import io
import json
import re
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
EXCLUDE = ["ft:", "batch", "provisioned", "priority", "flex", "audio", "realtime", "tts", "transcribe",
           "image", "search", "embed", "moderation", "whisper", "video", "speech", "rerank"]
THRESHOLDS = [float(x) for x in np.arange(110, 172.6, 2.5)]


def canon(s, loose=False):
    s = str(s).lower().strip()
    s = re.sub(r"\(.*?\)", "", s)                      # drop parentheses such as "(Mar 2023)"
    s = s.split("/")[-1]
    s = re.sub(r"[-_@:]?20\d{2}[-_]?\d{2}[-_]?\d{2}$", "", s)   # trailing full dates
    if loose:
        s = re.sub(r"[-_:](latest|preview|beta|exp|experimental|instruct|chat|it|fp8|turbo|free)$", "", s)
        s = re.sub(r"[-_@]\d{4}$", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def load_epoch():
    z = zipfile.ZipFile(RAW / "epoch_ai" / "benchmark_data.zip")
    eci = pd.read_csv(io.BytesIO(z.read("epoch_capabilities_index/eci_scores.csv")))
    meta = pd.read_csv(io.BytesIO(z.read("model_metadata.csv")))
    return eci, meta


def load_snapshots():
    snaps = {}
    for f in sorted(glob.glob(str(RAW / "litellm_price_history" / "*.json"))):
        month = Path(f).name[:7]
        d = json.load(open(f))
        d.pop("sample_spec", None)
        snaps[month] = d
    return snaps


EXPERIMENTAL = re.compile(r"(^|[-_/@:.])exp(erimental)?([-_@:.]|$)")


def usable(key, v):
    if v.get("mode") not in ("chat", "responses", None):
        return False
    if any(w in key.lower() for w in EXCLUDE) or EXPERIMENTAL.search(key.lower()):
        return False
    # old Vertex entries priced per character carry a meaningless per-token field
    if v.get("input_cost_per_character") or v.get("output_cost_per_character"):
        return False
    i, o = v.get("input_cost_per_token"), v.get("output_cost_per_token")
    return bool(i and o and i > 0 and o > 0)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    eci, meta = load_epoch()
    snaps = load_snapshots()

    # index of LiteLLM keys by normalised name (exact and loose)
    exact, loose = {}, {}
    for d in snaps.values():
        for k, v in d.items():
            if usable(k, v):
                exact.setdefault(canon(k), set()).add(k)
                loose.setdefault(canon(k, True), set()).add(k)

    versions = meta.groupby("model_group").model_version.apply(list).to_dict()
    models = []
    for _, r in eci.iterrows():
        cands = [r["Display name"], r["Model"]]
        if isinstance(r["model_versions"], str):
            cands += re.split(r"[;,|]", r["model_versions"])
        for g in (r["Model"], r["Display name"]):
            cands += versions.get(g, [])
        keys = set()
        for c in cands:
            keys |= exact.get(canon(c), set())
        how = "exact"
        if not keys:
            for c in cands:
                keys |= loose.get(canon(c, True), set())
            how = "loose"
        if keys:
            models.append({"model": r["Display name"], "organization": r["Organization"], "access": r["Model accessibility"],
                           "release_date": r["date"][:10], "eci": r["eci"], "eci_low": r["eci_ci_low"], "eci_high": r["eci_ci_high"],
                           "match": how, "n_keys": len(keys), "litellm_keys": ";".join(sorted(keys)[:6]), "_keys": keys})
    m = pd.DataFrame(models)
    m["release_month"] = m["release_date"].str[:7]

    # model x month panel
    rows = []
    for month, d in snaps.items():
        for _, r in m.iterrows():
            if month < r["release_month"]:
                continue
            best = None
            for k in r["_keys"]:
                v = d.get(k)
                if v and usable(k, v):
                    i, o = v["input_cost_per_token"] * 1e6, v["output_cost_per_token"] * 1e6
                    b = (3 * i + o) / 4
                    if best is None or b < best[0]:
                        best = (b, i, o, k)
            if best:
                rows.append({"month": month, "model": r["model"], "blended": best[0], "input": best[1], "output": best[2], "cheapest_key": best[3]})
    panel = pd.DataFrame(rows).merge(m[["model", "eci", "access", "release_date"]], on="model")
    first_priced = panel.groupby("model").month.min().rename("first_price_month")
    last = panel[panel.month == panel.month.max()].set_index("model").blended.rename("price_now")
    m = m.merge(first_priced, on="model", how="left").merge(last, on="model", how="left")
    m["priced"] = m["first_price_month"].notna()
    m.drop(columns=["_keys", "release_month"]).round(4).to_csv(OUT / "m1_models.csv", index=False)
    panel.round(5).to_csv(OUT / "m1_model_prices.csv", index=False)

    # frontier price by capability threshold
    months = sorted(snaps)
    fr = []
    for t in THRESHOLDS:
        for month in months:
            p = panel[(panel.month == month) & (panel.eci >= t)]
            if len(p):
                c = p.loc[p.blended.idxmin()]
                fr.append({"threshold": t, "month": month, "price": c.blended, "input": c.input, "output": c.output,
                           "cheapest_model": c.model, "n_models": len(p)})
    fr = pd.DataFrame(fr)
    fr.round(5).to_csv(OUT / "m1_price_of_capability.csv", index=False)

    # log-linear declines
    fits = []
    for t, g in fr.groupby("threshold"):
        g = g.sort_values("month")
        if len(g) < 12:
            continue
        x = np.array([months.index(mm) for mm in g.month], dtype=float)
        y = np.log2(g.price.values)
        res = sm.OLS(y, sm.add_constant(x)).fit(cov_type="HAC", cov_kwds={"maxlags": 3})
        b, se = res.params[1], res.bse[1]
        fits.append({"threshold": t, "first_month": g.month.iloc[0], "months": len(g), "price_first": g.price.iloc[0], "price_last": g.price.iloc[-1],
                     "halvings_per_year": -12 * b, "se_halvings_per_year": 12 * se,
                     "halving_time_months": -1 / b if b < 0 else np.nan, "annual_decline_pct": 100 * (1 - 2 ** (12 * b)), "r2": res.rsquared})
    fits = pd.DataFrame(fits)
    fits.round(4).to_csv(OUT / "m1_price_decline_fits.csv", index=False)

    # hedonic (time-dummy) index
    h = panel.copy()
    h["lp"] = np.log10(h.blended)
    h["open_weights"] = h.access.str.startswith("Open weights").astype(int)
    res = smf.ols("lp ~ eci + open_weights + C(month)", data=h).fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(h.model)[0]})
    idx = [{"month": months[0], "index": 100.0, "low": 100.0, "high": 100.0}]
    for mm in months[1:]:
        key = f"C(month)[T.{mm}]"
        if key in res.params:
            b, se = res.params[key], res.bse[key]
            idx.append({"month": mm, "index": 100 * 10 ** b, "low": 100 * 10 ** (b - 1.96 * se), "high": 100 * 10 ** (b + 1.96 * se)})
    pd.DataFrame(idx).round(3).to_csv(OUT / "m1_hedonic_index.csv", index=False)

    print(f"ECI models: {len(eci)} | matched to a price entry: {len(m)} ({(m.match == 'exact').sum()} exact, {(m.match == 'loose').sum()} loose) | with a price in some month: {int(m.priced.sum())}")
    print(f"panel: {len(panel):,} model-months, {panel.model.nunique()} models, {panel.month.nunique()} months")
    print(f"hedonic: n={int(res.nobs)}, R2={res.rsquared:.2f}, ECI coefficient={res.params['eci']:.4f} log10 units per ECI point, open-weights={res.params['open_weights']:.2f}")
    print("\nFrontier-price fits (selected thresholds):")
    print(fits[fits.threshold.isin([115, 120, 130, 140, 150, 160])].round(2).to_string(index=False))
    print("\nHedonic index (every 6th month):")
    print(pd.DataFrame(idx).iloc[::6].round(1).to_string(index=False), "\n", pd.DataFrame(idx).iloc[[-1]].round(1).to_string(index=False, header=False))


if __name__ == "__main__":
    main()
