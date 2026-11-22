# Processed tables

Small derived tables the analysis and the website read. Each is built by a script in `pipeline/` from the raw files listed in `../SOURCES.md`.

## occupations.csv
Built by `pipeline/build_occupations.py`. One row per detailed occupation (830, SOC 2018) in the BLS May 2025 national OEWS file.

| Column | Meaning | Source |
|---|---|---|
| `soc`, `title` | 6-digit SOC code and occupation title | BLS OEWS |
| `employment` | US employment, May 2025 | BLS OEWS |
| `hourly_mean`, `annual_mean`, `annual_median` | Mean hourly wage, mean and median annual wage (US dollars); empty where BLS suppresses | BLS OEWS |
| `wage_bill` | `employment` × `annual_mean` | derived |
| `employment_share_pct` | Share of total employment in the 830 occupations, percent | derived |
| `ms_applicability` | Microsoft AI applicability score (0 to 1 scale as published), from Bing Copilot use, Jan–Sep 2024; empty for 47 occupations | Microsoft "Working with AI" |
| `aei_global_share_pct` | Occupation's share of worldwide Claude.ai usage, mean of April and May 2026, percent. Empty means not published, not zero | Anthropic Economic Index |
| `aei_india_share_pct` | Same for India. Empty means not published | Anthropic Economic Index |
| `aei_usage_ratio` | `aei_global_share_pct` ÷ `employment_share_pct`: usage share relative to the occupation's weight in US employment. Descriptive, mixes worldwide usage with US employment | derived |
| `aei_automation_pct`, `aei_augmentation_pct` | Share of the occupation's conversations coded as automation or augmentation, usage-weighted, worldwide | Anthropic Economic Index |
| `aei_ai_autonomy` | Mean degree of AI autonomy (1 to 5) | Anthropic Economic Index |
| `aei_human_only_hours`, `aei_with_ai_minutes`, `aei_speedup` | Estimated time for a human alone (hours), with AI (minutes), and the ratio (human-only minutes ÷ with-AI minutes). These are model-estimated, not measured | Anthropic Economic Index |
| `aei_work_use_pct` | Share of conversations coded as work use | Anthropic Economic Index |

The Economic Index codes are O*NET-SOC (8 digits); the first 7 characters give the 6-digit SOC. Where several O*NET codes share one SOC, shares are summed and metrics are averaged weighted by usage share.

## M1 tables (price of intelligence)
Built by `pipeline/build_m1_prices.py` and then `pipeline/build_m1_volume.py`. Prices are US dollars per million tokens; the blended price is (3 × input + output) ÷ 4. Capability is Epoch AI's Epoch Capabilities Index (ECI); higher means more capable (GPT-4, March 2023, scores about 122). Prices are list prices from month-end snapshots of the LiteLLM price file, not transaction prices.

| File | Contents |
|---|---|
| `m1_models.csv` | The 212 Epoch-scored models matched to a price entry (of 258): ECI with its interval, release date, access type, how the name was matched, the matching price keys, first month with a price, price now |
| `m1_model_prices.csv` | Model × month panel of list prices (input, output, blended) and the cheapest listing's key |
| `m1_price_of_capability.csv` | For each capability threshold (ECI 110 to 170 in steps of 2.5) and month: the cheapest price of any model at or above the threshold, which model, and how many models clear it |
| `m1_price_decline_fits.csv` | Log-linear fit of each threshold's frontier price: halvings per year, halving time in months, annual decline, R² (Newey-West standard errors) |
| `m1_hedonic_index.csv` | Quality-adjusted price index (September 2023 = 100) from a pooled regression of log price on ECI, an open-weights dummy and month dummies, with 95% intervals clustered by model |
| `m1_model_month_volume.csv` | Model × month: OpenRouter tokens per day (paid listings only), list price, ECI, implied spending per day |
| `m1_volume_monthly.csv` | Month totals: all OpenRouter tokens per day, tokens matched to a priced model, tokens by capability tier, implied spending, token-weighted price, hedonic index |
| `m1_elasticity.csv` | Panel regressions of log tokens on log price with model and month fixed effects |

Cautions: tokens are OpenRouter's own traffic and include prompt tokens (many cached, billed at a fraction), so implied spending is an upper bound; a model counts as "priced" only if its name matched an Epoch-scored model (about half of OpenRouter's tokens); within-model price changes are few, so the elasticity is imprecise.
