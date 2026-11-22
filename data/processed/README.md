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

## M5 tables (market structure)
Built by `pipeline/build_m5.py` (after `build_m1_prices.py`). A firm is the model author mapped to its parent (for example `meta` and `meta-llama` to Meta, `qwen` to Alibaba). Models from `stealth` and `openrouter` are anonymous and excluded from concentration. Shares are of the top-50 models' tokens on OpenRouter; HHI runs from 0 to 10,000.

| File | Contents |
|---|---|
| `m5_firm_month_shares.csv` | Firm × month: tokens per day and share of attributed top-50 tokens |
| `m5_concentration_monthly.csv` | Monthly HHI with lower and upper bounds (allowing for models outside the top 50), effective number of firms, largest-firm and top-four shares, leader, firms with at least 1% share, new firms reaching 1%, share-change (instability) index, share of anonymous models |
| `m5_hhi_daily.csv` | Daily HHI, top share, and 7-day mean |
| `m5_cournot_by_month.csv` | For each month and demand elasticity of 1, 1.5, 2, 3, 5: the Cournot-implied Lerner index (HHI ÷ elasticity) and markup over marginal cost |
| `m5_host_prices.csv` | Model × month: number of hosts and listings, lowest, median and highest list price per million blended tokens (from the LiteLLM snapshots) |
| `m5_host_competition.csv` | Regressions of the lowest, median and spread of price on the log number of hosts, with model and month fixed effects, for open-weights and closed models |
| `m5_epoch_revenue.csv` | Annualised revenue reports from Epoch AI (levels only; too sparse to compute concentration) |

Cautions: OpenRouter's users are not the whole market; token counts use each provider's tokenizer; tokens are not revenue.

## M2 tables (where AI is used)
Built by `pipeline/build_m2.py`. Column lists, definitions and the reading of each table are in [../../docs/findings-m2.md](../../docs/findings-m2.md). Files: `m2_scatter.csv` (one row per occupation, for the explorer), `m2_agreement.csv` (rank correlations with bootstrap intervals), `m2_disagreement.csv` (largest rank gaps with rule-based hints), `m2_major_groups.csv`, `m2_regressions.csv`, `m2_quirks.csv` (data warnings), `m2_summary.csv`.

## M3 tables (adoption in the economy)
Built by `pipeline/build_m3.py` (after `pipeline/fetch_indeed.py`). Details in [../../docs/findings-m3.md](../../docs/findings-m3.md). Files: `m3_btos_*` (Census BTOS tidy tables by geography, adoption summaries, dispersion, trend, snapshot of the headcount questions, sector exposure), `m3_indeed_*` (AI share of postings, aggregate and sector posting indices), `m3_category_exposure.csv` and `m3_category_soc_map.csv` (the judged crosswalk from Indeed categories to occupations), `m3_event_study_*` (event-study coefficients, group paths, summary by specification and country).

## India Stage A tables
Built by `pipeline/fetch_worldbank.py` and `pipeline/build_india_a.py`. Details in [../../docs/findings-india-a.md](../../docs/findings-india-a.md). Files: `india_a_country_data.csv` (120 countries: usage index, income and controls, fitted values), `india_a_india_summary.csv`, `india_a_regressions.csv`, `india_a_robustness.csv`, `india_a_composition_*.csv` (India against the world by job family, occupation and activity), `india_a_use_patterns.csv`, `india_a_benchmarks.csv` (published figures with a `verified` flag).

## M6 tables (macro and policy)
Built by `pipeline/build_m6.py` (after `pipeline/fetch_pwt.py`). Method, equations and checks are in [../../docs/model-m6.md](../../docs/model-m6.md); results in [../../docs/findings-m6.md](../../docs/findings-m6.md). Files: `m6_compute_stock.csv` and `m6_compute_growth.csv` (Epoch AI chip shipments in H100 equivalents and growth and doubling times), `m6_datacenter_capacity.csv` (tracked data-centre power), `m6_labour_share.csv` (labour share by source: Penn World Table, ILO, BLS, BEA), `m6_macro_calibration.csv` (series behind the USA and India calibration), `m6_parameters.csv` (every model parameter with its value, source and kind: data, derived or assumption), `m6_preset_results.csv` (outputs of the eight presets, used to check the browser model against a Python reference).
