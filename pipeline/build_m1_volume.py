"""M1, part 2: usage volume against price (the Jevons question) and M5 inputs.

Joins OpenRouter's daily token totals to the model prices and capability scores built by
build_m1_prices.py, and builds:
  - m1_model_month_volume.csv  model x month: tokens per day, list price, capability score
  - m1_volume_monthly.csv      month totals: all tokens, matched tokens, tokens by capability tier,
                               implied spending at list prices, token-weighted price
  - m1_elasticity.csv          regressions of log tokens on log price (panel with model and month
                               fixed effects), plus the descriptive "spending index"

Run after build_m1_prices.py:  uv run python pipeline/build_m1_volume.py

Method notes
  - Tokens per day for a model in a month = its tokens on the days it appears in OpenRouter's
    top 50, summed and divided by the number of days with data that month. Days when a model is
    outside the top 50 count as zero, so small models are understated.
  - Only OpenRouter's own traffic is observed, and token counts follow each provider's tokenizer.
  - ':free' variants are in the total but are left out of the price analysis (their price is zero).
  - Implied spending = tokens per day x the model's blended list price. It is a proxy built from
    list prices, not what users actually paid.
  - Price elasticity is hard to identify here: list prices change rarely and usually when a new
    model arrives. The panel estimate uses only within-model price changes net of month effects;
    treat it as indicative, not causal.
"""
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
TIERS = [110, 120, 130, 140, 150]


def canon(s):
    s = str(s).lower().strip().split("/")[-1]
    s = re.sub(r":.*$", "", s)                                   # drop variant suffix such as :beta
    s = re.sub(r"[-_@]?20\d{2}[-_]?\d{2}[-_]?\d{2}$", "", s)
    s = re.sub(r"[-_](latest|preview|beta|exp|experimental|instruct|chat|it|fp8|turbo)$", "", s)
    s = re.sub(r"[-_@]\d{4}$", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


STOP = {"preview", "beta", "latest", "instruct", "chat", "it", "exp", "experimental", "fp8", "turbo", "free"}


def tokset(s):
    """Word-order-free name, so 'claude-4.6-sonnet' and 'claude-sonnet-4-6' match."""
    s = str(s).lower().strip().split("/")[-1]
    s = re.sub(r":.*$", "", s)
    s = re.sub(r"20\d{2}[-_]?\d{2}[-_]?\d{2}", " ", s)
    s = re.sub(r"(?<![0-9])\d{2}[-_]\d{2}$", " ", s)
    return "|".join(sorted(t for t in re.split(r"[^a-z0-9]+", s) if t and t not in STOP))


def main():
    models = pd.read_csv(OUT / "m1_models.csv")
    prices = pd.read_csv(OUT / "m1_model_prices.csv")
    d = json.load(open(RAW / "openrouter_rankings_daily" / "rankings_daily.json"))
    rk = pd.DataFrame(d["rows"])
    rk["tokens"] = rk.total_tokens.astype("int64")
    rk["month"] = rk.date.str[:7]

    n_days = rk.groupby("month").date.nunique()
    total = rk.groupby("month").tokens.sum() / n_days
    by_slug = rk[rk.model_permaslug != "other"].groupby(["month", "model_permaslug"]).tokens.sum().reset_index()
    by_slug["tokens_per_day"] = by_slug.tokens / by_slug.month.map(n_days)
    by_slug["free"] = by_slug.model_permaslug.str.contains(":free")

    # map OpenRouter names to Epoch/LiteLLM-matched models
    lookup, lookup_set = {}, {}
    for _, r in models[models.priced].iterrows():
        keys = str(r["litellm_keys"]).split(";")
        for n in {canon(r["model"])} | {canon(k) for k in keys}:
            lookup.setdefault(n, set()).add(r["model"])
        for n in {tokset(r["model"])} | {tokset(k) for k in keys}:
            lookup_set.setdefault(n, set()).add(r["model"])

    def find(slug):
        for table, key in ((lookup, canon(slug)), (lookup_set, tokset(slug))):   # exact name first, then word-order-free
            if key in table and len(table[key]) == 1:
                return next(iter(table[key]))
        return None

    by_slug["model"] = by_slug.model_permaslug.map(find)
    matched = by_slug.dropna(subset=["model"]).copy()
    matched = matched.groupby(["month", "model"], as_index=False).agg(tokens_per_day=("tokens_per_day", "sum"), free_share=("free", "mean"))
    paid = by_slug[~by_slug.free].dropna(subset=["model"]).groupby(["month", "model"], as_index=False).tokens_per_day.sum()

    mv = paid.merge(prices[["month", "model", "blended", "input", "output", "eci"]], on=["month", "model"], how="inner")
    mv["spend_per_day"] = mv.tokens_per_day * mv.blended / 1e6
    mv.round(4).to_csv(OUT / "m1_model_month_volume.csv", index=False)

    # monthly totals
    mon = pd.DataFrame({"month": total.index, "all_tokens_per_day": total.values})
    mon["top50_tokens_per_day"] = mon.month.map(by_slug.groupby("month").tokens_per_day.sum())
    mon["priced_tokens_per_day"] = mon.month.map(mv.groupby("month").tokens_per_day.sum())
    mon["coverage_of_all_pct"] = 100 * mon.priced_tokens_per_day / mon.all_tokens_per_day
    for t in TIERS:
        mon[f"tokens_eci_ge_{t}"] = mon.month.map(mv[mv.eci >= t].groupby("month").tokens_per_day.sum())
    mon["implied_spend_usd_per_day"] = mon.month.map(mv.groupby("month").spend_per_day.sum())
    mon["token_weighted_price"] = mon.implied_spend_usd_per_day / mon.priced_tokens_per_day * 1e6
    hed = pd.read_csv(OUT / "m1_hedonic_index.csv").set_index("month")["index"]
    mon["hedonic_index"] = mon.month.map(hed)
    mon.round(3).to_csv(OUT / "m1_volume_monthly.csv", index=False)

    # regressions
    res_rows = []
    pn = mv[(mv.tokens_per_day > 0) & (mv.blended > 0)].copy()
    pn["lt"], pn["lp"] = np.log(pn.tokens_per_day), np.log(pn.blended)
    cnt = pn.groupby("model").size()
    pn = pn[pn.model.isin(cnt[cnt >= 6].index)]
    chg = pn.sort_values(["model", "month"]).groupby("model").lp.apply(lambda s: (s.diff().abs() > 1e-6).sum())
    pn_chg = pn[pn.model.isin(chg[chg > 0].index)]
    for label, data in [("model and month fixed effects, all models with 6+ months", pn),
                        ("same, models whose price changed at least once", pn_chg)]:
        if data.model.nunique() < 5:
            continue
        r = smf.ols("lt ~ lp + C(model) + C(month)", data=data).fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(data.model)[0]})
        res_rows.append({"specification": label, "elasticity": r.params["lp"], "se": r.bse["lp"], "ci_low": r.params["lp"] - 1.96 * r.bse["lp"],
                         "ci_high": r.params["lp"] + 1.96 * r.bse["lp"], "n_obs": int(r.nobs), "n_models": data.model.nunique(),
                         "models_with_price_change": int((chg.reindex(data.model.unique()) > 0).sum())})
    pd.DataFrame(res_rows).round(4).to_csv(OUT / "m1_elasticity.csv", index=False)

    first, last = mon[mon.priced_tokens_per_day > 0].iloc[[0, -1]].to_dict("records")
    print(f"OpenRouter tokens/day: {mon.all_tokens_per_day.iloc[0]/1e9:.1f}B ({mon.month.iloc[0]}) -> {mon.all_tokens_per_day.iloc[-1]/1e9:.0f}B ({mon.month.iloc[-1]})")
    print(f"priced (matched, non-free) models: {mv.model.nunique()} | coverage of all tokens: first month {first['coverage_of_all_pct']:.1f}%, last month {last['coverage_of_all_pct']:.1f}%, mean {mon.coverage_of_all_pct.mean():.1f}%")
    print(f"token-weighted list price: ${first['token_weighted_price']:.2f}/M ({first['month']}) -> ${last['token_weighted_price']:.2f}/M ({last['month']})")
    print(f"implied spend/day (matched): ${first['implied_spend_usd_per_day']:,.0f} -> ${last['implied_spend_usd_per_day']:,.0f}; tokens x{last['priced_tokens_per_day']/first['priced_tokens_per_day']:.0f}, price x{last['token_weighted_price']/first['token_weighted_price']:.2f}, spend x{last['implied_spend_usd_per_day']/first['implied_spend_usd_per_day']:.1f}")
    print(pd.DataFrame(res_rows).round(3).to_string(index=False))
    print(mon[["month", "all_tokens_per_day", "coverage_of_all_pct", "token_weighted_price", "implied_spend_usd_per_day"]].iloc[::4].round(1).to_string(index=False))


if __name__ == "__main__":
    main()
