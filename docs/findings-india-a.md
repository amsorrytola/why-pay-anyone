# India lens, Stage A: findings (exploratory)

Built by `pipeline/fetch_worldbank.py` and `pipeline/build_india_a.py` from published data only. Nothing uses PLFS microdata (that is Stage B).

## Question
How much does India use AI chat compared with what its income predicts, how does the mix of use differ from the world's, and what do published studies say about exposure of Indian jobs?

## Data
- Anthropic Economic Index, release 2026-06-26, Claude.ai: 121 countries, April and May 2026. Outcome: the Anthropic Usage Index (usage share divided by working-age population share; 1.0 is proportional), averaged over the two months. Taiwan has no World Bank data, leaving 120 countries.
- World Bank World Development Indicators (CC BY 4.0, licence statement read on worldbank.org, saved in `data/raw/worldbank/LICENCE_NOTE.txt`): latest value in 2022 to 2025 for GDP per capita (PPP, constant 2021 international dollars; 2025 for nearly all), internet use, tertiary enrollment, services and agriculture employment shares, population. Tertiary enrollment is missing for 14 countries, so the full-controls sample is 106.
- Peers: the 23 AEI countries with GDP per capita within a factor of 1.5 of India's.
- Benchmarks: IMF, ILO and ICRIER documents were read as PDFs (pages are in the CSV). NITI Aayog's PDF returned HTTP 403 and the Great Lakes paper was not found, so those rows are from news reports and marked `verified = no`.

## Method
OLS of the log usage index on log GDP per capita, then adding internet use, tertiary enrollment and services share, with HC1 robust errors. India's residual is shown in sample and out of sample (fit without India, 95% prediction interval). Robustness: trimming, dropping rich or poor countries, April or May alone, log share of world usage with log working-age population as a regressor, alternative controls. Composition compares published cells for both India and the world, in both months.

## Key numbers
| | Value |
|---|---|
| India's share of world Claude.ai usage | 7.0% (6.92 April, 7.12 May); second of 120 after the US (about 20.6%) |
| India's Usage Index | 0.305 (0.31, 0.30); 100th of 120. Peers' median 0.43 (quartiles 0.24 to 0.54); lower-middle-income median 0.32; all-country median 0.93; high-income median 2.4 |
| Income elasticity (GDP only, n = 120) | 0.96, 95% CI 0.88 to 1.04; R-squared 0.81 |
| India vs GDP-only line | predicted 0.43; actual is 0.71 of predicted (residual -0.34 log points); 94th of 120; standardized -0.71. Out of sample, 95% prediction interval for India's index is 0.17 to 1.11 |
| With internet, tertiary and services controls (n = 106) | GDP coefficient 0.59 (SE 0.08); services +0.21 per 10 points (SE 0.05); tertiary +0.06 per 10 points (SE 0.03); internet not significant. India's residual +0.08 (1.08 times predicted), 49th of 106 |
| India's residual across checks | -0.25 (April) to -0.40 (May); -0.38 trimmed; -0.33 and -0.31 dropping richest or poorest ten; +0.04 with log usage share as outcome (population elasticity 0.91, SE 0.03, instead of fixed at 1); +0.07 with services share added; -0.05 with agriculture share instead |
| Work, personal, coursework use | India 44.5, 34.6, 21.0 percent; world 44.4, 39.3, 16.2; peers 40.1, 30.8, 28.5 |
| Automation share | India 52.5% vs world 48.8%, peers 51.6% (quartiles 50.1 to 52.9) |

**Reading.** India's usage per head is low because its income is low. Against the income-only line it is about 30% below prediction, but that is inside the ordinary scatter (residual spread about 0.47 log points) and it disappears once employment structure is controlled for or population is allowed to enter freely. We cannot say India over- or under-uses for its income. It is below the median of comparable-income countries (15 of 23 peers have a higher index).

**Composition.** Against the world, India's usage leans to computing (26.6% vs 23.9%) and education (14.4% vs 12.3%), and away from arts and media (11.7 vs 13.3), sales (7.5 vs 8.7), healthcare practitioners (2.6 vs 3.1) and legal (0.6 vs 1.0). By request topic, Education and Learning is 18.8% vs 12.9% and Software Development 16.9% vs 11.8%; Hobbies and Lifestyle 5.4% vs 8.9%. By work activity, Training and Teaching Others is 5.3% vs 3.1%, Working with Computers 12.6% vs 9.4%, Getting Information 9.7% vs 12.5%. Over-indexed occupations are mostly education roles (K-12 and postsecondary administrators, substitute teachers, tutors); under-indexed include interpreters and translators (0.46 of the world's share), lawyers and general office clerks. April and May agree on the direction of 21 of 22 group gaps; month-to-month moves are about one point or less, but the release has no sampling intervals.

**Published benchmarks (verified in the documents).** IMF SDN/2024/001: high-exposure employment is 26 percent in India, the low end of the emerging-market range (Brazil 41 percent) (p. 8). Averages are about 40 percent globally, about 60 percent in advanced economies, 40 percent in emerging markets and 26 percent in low-income countries (p. 2; the equal 26 for India and for low-income countries is a coincidence). The India figure uses the 2019 PLFS at the 3-digit occupation level; exposure is the Felten, Raj and Seamans index with a complementarity index, split at median values (pp. 6, 7, 24, 26). The IMF text attributes India's low figure to its occupational mix (craft, skilled agricultural and elementary workers). ILO Working Paper 140 gives only global and income-group figures (24 percent with some exposure; 34 percent in high-income, 11 percent in low-income countries) and no India figure. ICRIER (February 2026, 651 IT firms) finds no sign of large-scale job losses in India's IT sector; 4 percent of firms have trained over half their staff in AI. These measure different things and should not be set side by side as one number.

## Limits
- One company's products. Claude.ai conversations are not a census of AI use in India.
- The index counts conversations, not people. India's mix is tilted to students and developers (coursework, education and software topics); we do not observe language or occupation, so any English-language effect is a guess.
- Shares are rounded to 0.01 point; no confidence intervals; small countries (index below 0.1) are noisy. Two months only.
- GDP per capita is PPP; India's PPP conversion is uncertain and many 2025 values are estimates. Services and agriculture shares are modeled. Covariate years are not matched to the AEI months.
- A cross-country regression of 106 to 120 points shows association only. Services share also proxies for development, so do not read its effect on India's residual as a cause.
- Usage is not exposure. Stage A does not measure which Indian jobs AI touches (needs PLFS, Stage B). Occupation labels come from Anthropic's classifier (substitute teachers are 2.8% of Indian usage).
- NITI Aayog and Great Lakes figures are unverified against the originals and are not used above.

## What the site should show
| Chart | CSV | Columns |
|---|---|---|
| Income vs usage scatter, India highlighted, controls toggle | `india_a_country_data.csv` | `country`, `gdp_pc_ppp`, `usage_index`, `peer_of_india`, `fitted_log_gdp_only`, `residual_log_gdp_only`, `fitted_log_full`, `residual_log_full` (full columns empty for 14 countries) |
| Actual vs predicted by model, with interval | `india_a_india_summary.csv` | `model`, `actual_index`, `predicted_index`, `residual_log`, `rank_of_residual_1_is_highest`, `n`, `loo_pred_low_log`, `loo_pred_high_log` |
| Does the gap survive? | `india_a_robustness.csv` | `spec`, `india_residual_log`, `india_rank_1_is_highest`, `n` |
| Coefficients | `india_a_regressions.csv` | `model`, `term`, `coef`, `se_robust`, `ci_low`, `ci_high`, `n`, `r2` |
| Usage by occupation group, India vs world | `india_a_composition_groups.csv` | `major_group_name`, `india_share`, `world_share`, `ratio_india_to_world`, `india_apr`, `india_may` |
| Over- and under-indexed occupations | `india_a_composition_occupations.csv` | `list`, `title`, `india_share`, `world_share`, `ratio_india_to_world` |
| Work activities and request topics | `india_a_composition_activities.csv` | `category`, `name`, `india_share`, `world_share`, `diff_pp` |
| Work, personal, coursework, automation vs world and peers | `india_a_use_patterns.csv` | `label`, `india`, `world`, `peers_median`, `peers_p25`, `peers_p75`, `lower_middle_income_median`, `high_income_median` |
| Benchmarks table (show `verified = yes`; show `no` only with a warning) | `india_a_benchmarks.csv` | `claim`, `value`, `unit`, `source`, `url`, `where_found`, `verified` |

Wording to carry: "usage in Claude.ai, April and May 2026"; "usage index, not exposure"; "one company's products"; "exploratory".
