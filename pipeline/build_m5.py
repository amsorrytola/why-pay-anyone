"""M5: market structure and power.

From OpenRouter's daily token totals (CC BY 4.0), Epoch AI's company revenue reports and the
host-price table built by build_m1_prices.py, this builds:
  - m5_firm_month_shares.csv    firm x month: tokens per day and share of attributed top-50 tokens
  - m5_concentration_monthly.csv  monthly HHI (with bounds), effective number of firms, CR1, CR4,
                                leader, number of firms with at least 1% share, instability index
  - m5_hhi_daily.csv            daily HHI and its 7-day mean (for the date slider)
  - m5_cournot_by_month.csv     the Cournot-implied Lerner index and markup, HHI / elasticity, for a
                                grid of market demand elasticities
  - m5_host_competition.csv     Bertrand-style test: do prices fall as more hosts sell the same model?
  - m5_epoch_revenue.csv        company revenue reports from Epoch (levels only; see the note below)

Run after build_m1_prices.py:  uv run python pipeline/build_m5.py

Definitions and choices
  - A "firm" is the model author mapped to its parent (FIRM below). Models published by 'stealth'
    and 'openrouter' are anonymous pre-release or routing models: they are excluded from the
    concentration measures and reported as a separate share.
  - Shares are of the tokens of the top 50 models listed each day (attributed firms only).
    OpenRouter also reports an "other" row for models outside the top 50; the HHI bounds treat
    that row as many tiny firms (lower bound) or as one firm (upper bound).
  - HHI = 10,000 x sum of squared shares (0 to 10,000). Effective number of firms = 10,000 / HHI.
  - Instability index = half the sum of absolute month-to-month share changes (0 to 1).
  - Cournot: with market demand elasticity e, the share-weighted average Lerner index
    (price - marginal cost) / price equals HHI / e (HHI as a fraction). It is only defined where
    e is above the HHI; the grid uses e from 1 to 5.
  - Revenue concentration is NOT computed: Epoch has revenue reports for only nine companies, with
    different dates and large gaps, and none for several large providers.
"""
import io
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

FIRM = {"meta-llama": "Meta", "meta": "Meta", "qwen": "Alibaba", "alibaba": "Alibaba", "z-ai": "Z.ai (Zhipu)",
        "moonshotai": "Moonshot AI", "x-ai": "xAI", "mistralai": "Mistral AI", "bytedance-seed": "ByteDance",
        "deepseek": "DeepSeek", "openai": "OpenAI", "anthropic": "Anthropic", "google": "Google", "tencent": "Tencent",
        "xiaomi": "Xiaomi", "minimax": "MiniMax", "nvidia": "NVIDIA", "stepfun": "StepFun"}
UNATTRIBUTED = {"stealth", "openrouter"}
ELASTICITIES = [1.0, 1.5, 2.0, 3.0, 5.0]


def hhi(shares):
    return 10000 * float((shares ** 2).sum())


def main():
    rk = pd.DataFrame(json.load(open(RAW / "openrouter_rankings_daily" / "rankings_daily.json"))["rows"])
    rk["tokens"] = rk.total_tokens.astype("int64")
    rk["month"] = rk.date.str[:7]
    other = rk[rk.model_permaslug == "other"].groupby("date").tokens.sum()
    top = rk[rk.model_permaslug != "other"].copy()
    top["author"] = top.model_permaslug.str.split("/").str[0]
    top["firm"] = top.author.map(lambda a: FIRM.get(a, a))
    top["attributed"] = ~top.author.isin(UNATTRIBUTED)

    # daily concentration
    att = top[top.attributed]
    daily_firm = att.groupby(["date", "firm"]).tokens.sum().reset_index()
    daily_firm["share"] = daily_firm.tokens / daily_firm.groupby("date").tokens.transform("sum")
    d = daily_firm.groupby("date").share.apply(hhi).rename("hhi").to_frame()
    d["cr1"] = daily_firm.groupby("date").share.max()
    d["hhi_7day"] = d.hhi.rolling(7, min_periods=3).mean()
    d.round(1).reset_index().to_csv(OUT / "m5_hhi_daily.csv", index=False)

    # monthly firm shares
    n_days = rk.groupby("month").date.nunique()
    fm = att.groupby(["month", "firm"]).tokens.sum().reset_index()
    fm["tokens_per_day"] = fm.tokens / fm.month.map(n_days)
    fm["share"] = fm.tokens_per_day / fm.groupby("month").tokens_per_day.transform("sum")
    fm[["month", "firm", "tokens_per_day", "share"]].round(6).to_csv(OUT / "m5_firm_month_shares.csv", index=False)

    wide = fm.pivot(index="month", columns="firm", values="share").fillna(0)
    top_tokens = top.groupby("month").tokens.sum()
    other_tokens = other.groupby(other.index.str[:7]).sum()
    unattr_tokens = top[~top.attributed].groupby("month").tokens.sum().reindex(wide.index).fillna(0)
    all_tokens = top_tokens + other_tokens
    rows = []
    prev = None
    first_seen = {}
    for month, s in wide.iterrows():
        s_pos = s[s > 0]
        o = float(other_tokens[month] / all_tokens[month])
        h = hhi(s)
        row = {"month": month, "hhi": h, "hhi_low": h * (1 - o) ** 2, "hhi_high": h * (1 - o) ** 2 + 10000 * o ** 2,
               "effective_firms": 10000 / h, "cr1": s.max(), "cr4": s.nlargest(4).sum(), "leader": s.idxmax(),
               "firms_ge_1pct": int((s >= 0.01).sum()), "n_firms": len(s_pos), "other_share_of_all": o,
               "unattributed_share_of_top50": float(unattr_tokens[month] / top_tokens[month]),
               "instability": 0.5 * float((s - prev).abs().sum()) if prev is not None else np.nan}
        for f in s[s >= 0.01].index:
            first_seen.setdefault(f, month)
        row["new_firms_ge_1pct"] = sum(1 for f in s[s >= 0.01].index if first_seen[f] == month)
        rows.append(row)
        prev = s
    mon = pd.DataFrame(rows)
    mon.loc[0, "new_firms_ge_1pct"] = np.nan          # the first month has no history, so no entrants are counted
    mon.round(4).to_csv(OUT / "m5_concentration_monthly.csv", index=False)

    # Cournot-implied Lerner index and markup
    c = []
    for _, r in mon.iterrows():
        for e in ELASTICITIES:
            L = (r.hhi / 10000) / e
            c.append({"month": r.month, "elasticity": e, "hhi": r.hhi, "lerner": L, "markup_over_cost_pct": 100 * (1 / (1 - L) - 1) if L < 1 else np.nan})
    pd.DataFrame(c).round(4).to_csv(OUT / "m5_cournot_by_month.csv", index=False)

    # Bertrand-style test with host prices
    hp = pd.read_csv(OUT / "m5_host_prices.csv")
    hp["lmin"], hp["lmed"] = np.log(hp.price_min), np.log(hp.price_median)
    hp["lnh"] = np.log(hp.n_hosts)
    hp["spread"] = np.log(hp.price_max / hp.price_min)
    res_rows = []
    for label, sub in [("open-weights models", hp[hp.access.str.startswith("Open weights")]), ("closed (API-access) models", hp[hp.access == "API access"])]:
        cnt = sub.groupby("model").size()
        sub = sub[sub.model.isin(cnt[cnt >= 6].index)]
        sub = sub[sub.groupby("model").n_hosts.transform("nunique") >= 2]          # model must vary in its number of hosts
        if sub.model.nunique() < 5:
            continue
        for dep, name in [("lmin", "log lowest price"), ("lmed", "log median price"), ("spread", "log (highest / lowest price)")]:
            r = smf.ols(f"{dep} ~ lnh + C(model) + C(month)", data=sub).fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(sub.model)[0]})
            res_rows.append({"sample": label, "dependent": name, "coef_log_hosts": r.params["lnh"], "se": r.bse["lnh"],
                             "ci_low": r.params["lnh"] - 1.96 * r.bse["lnh"], "ci_high": r.params["lnh"] + 1.96 * r.bse["lnh"],
                             "n_obs": int(r.nobs), "n_models": sub.model.nunique()})
    hc = pd.DataFrame(res_rows)
    hc.round(4).to_csv(OUT / "m5_host_competition.csv", index=False)

    # Epoch revenue reports (levels only)
    z = zipfile.ZipFile(RAW / "epoch_ai" / "ai_companies.zip")
    rv = pd.read_csv(io.BytesIO(z.read("ai_companies_revenue_reports.csv")))
    rv["revenue_usd"] = pd.to_numeric(rv["Annualized revenue (USD)"], errors="coerce")
    rv = rv.dropna(subset=["revenue_usd"])
    rv = rv.rename(columns={"Company": "company", "Date": "date", "Annualized revenue type": "type", "Scope": "scope", "Confidence": "confidence"})
    rv[["company", "date", "revenue_usd", "type", "scope", "confidence"]].sort_values(["company", "date"]).to_csv(OUT / "m5_epoch_revenue.csv", index=False)

    # print the headline numbers
    print(f"firms: {wide.shape[1]} | months: {len(mon)} | days: {len(d)}")
    print(mon[["month", "hhi", "hhi_low", "hhi_high", "effective_firms", "cr1", "cr4", "leader", "firms_ge_1pct", "instability", "new_firms_ge_1pct"]].round(2).iloc[::3].to_string(index=False))
    print("\nleader changes:", int((mon.leader != mon.leader.shift()).sum() - 1), "| leaders:", mon.leader.value_counts().to_dict())
    print("mean instability index: %.2f" % mon.instability.mean(), "| firms ever reaching 1%:", len(first_seen))
    print("HHI min/max (daily, 7-day mean):", round(d.hhi_7day.min()), "on", d.hhi_7day.idxmin(), "/", round(d.hhi_7day.max()), "on", d.hhi_7day.idxmax())
    print("\nhost competition:"); print(hc.round(3).to_string(index=False))
    print("\nmodels with 2+ hosts (latest month):", int((hp[hp.month == hp.month.max()].n_hosts >= 2).sum()), "of", int((hp.month == hp.month.max()).sum()))
    print("Epoch revenue reports with numbers:", len(rv), "companies:", rv.company.nunique())


if __name__ == "__main__":
    main()
