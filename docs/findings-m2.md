# M2 findings: do independent measures of AI use agree? (exploratory)

Built by `pipeline/build_m2.py` from `occupations.csv` (830 US occupations), O*NET 31.0 (job zones, work activities) and the Economic Index (EI) major-group rows.

## Question
Do the Microsoft AI applicability score (Bing Copilot, US, 2024) and the Claude.ai usage shares in the Anthropic Economic Index (worldwide, April and May 2026) rank occupations the same way, where do they differ, and what predicts usage?

## Method
- Agreement sample: 591 occupations with both measures. An EI cell of 0.00 is a published zero; an empty cell is unpublished.
- Spearman and Kendall tau-b, plain and weighted by US employment. Intervals are 95% bootstrap percentile intervals (2,000 resamples of occupations, fixed seed).
- Partial versions control for job zone, or remove each major group's mean rank.
- Disagreement: percentile rank of the usage ratio (usage share divided by employment share) minus percentile rank of applicability. The lists cover the 25 largest gaps in each direction among occupations with at least 10,000 workers.
- Regressions: OLS with HC1 robust errors. The outcome is log usage ratio (423 occupations with positive usage, 420 with wages and job zone) or the automation share. Regressors are applicability (per +0.1), log wage, job zone and major-group effects. A Poisson check keeps the zeros.

## Key numbers
| Measure pair | Spearman (95% CI) | Kendall |
|---|---|---|
| Applicability vs usage share, 591 occupations | 0.45 (0.38 to 0.52) | 0.33 |
| Applicability vs usage ratio, 591 | 0.47 (0.40 to 0.54) | 0.33 |
| Same, weighted by employment (share / ratio) | 0.54 (0.37 to 0.66) / 0.49 (0.36 to 0.60) | 0.39 / 0.34 |
| Positive-usage occupations only, 423 | 0.32 (0.23 to 0.41) | 0.22 |
| Controlling for job zone | 0.39 (0.31 to 0.46) | |
| Within major group | 0.28 (0.20 to 0.35) | |
| Across the 22 major groups | 0.80 (0.57 to 0.91) | 0.60 |
| Unpublished set to zero, 783 occupations (sensitivity) | 0.59 (0.54 to 0.63) | 0.43 |
| Applicability vs automation share, 423 | -0.21 (-0.30 to -0.11) | -0.14 |

**Reading.** The two measures agree moderately, and more at the level of whole job families than within them. Part of the agreement is the split between occupations with some usage and those with none, and it shrinks when we compare within groups. Employment weighting raises the share-based figure but widens the interval. More applicable occupations have a slightly lower automation share (more augmentation). Employment size is almost unrelated to applicability (rho -0.01), which is why the ratio is the cleaner comparison. Occupations scoring 0.3 or more on applicability number 93, hold 9.3% of employment and 10.6% of the wage bill.

**Major groups.** Computer and Mathematical is 3.4% of US employment and 23.9% of usage (ratio 7.1); Arts, Design and Media 1.3% and 13.3% (10.1); Educational Instruction and Library 5.9% and 12.3%; Life, Physical and Social Science 0.9% and 4.5%. Food Preparation, Transportation and Healthcare Support are 5% to 9% of employment each and 0.3% to 0.6% of usage. The automation share is highest in Protective Service (75%), Installation and Repair (69%), Construction (67%) and Computer (64%), and lowest in Legal (35%) and Arts and Media (36%). Work use is only 8% in Community and Social Service and Healthcare Practitioners, against 62% in Management.

**Regression.** Each +0.1 of applicability goes with about 2.1 times the usage ratio (coefficient 0.73, SE 0.12, 95% CI 0.49 to 0.97, with wage, job zone and group effects; R-squared 0.29). Log wage adds nothing once job zone is included (-0.13, SE 0.34). Job zone: +0.37 per zone (SE 0.19). Group effects are jointly significant (p about 2e-8). With log employment added, applicability falls to 0.56 and R-squared rises to 0.58; usage share scales with employment to the power 0.24. Weighted by employment the applicability coefficient is 0.59 (SE 0.31). The Poisson version, which keeps zeros, gives 0.82 (SE 0.14, n = 588). Automation share: -2.5 percentage points per +0.1 of applicability (SE 1.0), -3.0 per job zone (SE 1.1), R-squared 0.36.

**Disagreement.** Usage above applicability (for example Judicial Law Clerks, Stationary Engineers, Emergency Medicine Physicians, Chiropractors, Cardiologists): 14 of 25 have under 40% work use (health roles, where conversations are mostly personal), 7 are hands-on jobs, 5 have small employment bases. Applicability above usage: 19 of 25 have a published share of 0.00%. These include Customer Service Representatives (2.6 million workers, applicability in the 99th percentile, usage ratio in the 31st), Brokerage Clerks and Public Safety Telecommunicators. Hints in the CSV are rule-based cues, not tested explanations.

## Data quirks the site should warn about (`m2_quirks.csv`)
- The catch-all "Computer Occupations, All Other" has the largest share of any occupation (7.77% of usage, 0.28% of employment); Software Developers (1.69 million workers) gets 0.34%. Treat computer occupations as one group.
- The top 10 occupations hold 30.2% of usage. Librarians (4.1%, 134,000 workers), Counter and Rental Clerks, Library Technicians, Credit Counselors, Tutors and Word Processors rank high because of how conversations were labeled.
- Ratios above 20 are mostly small occupations (Mathematicians 762, 2,030 workers). Usage is worldwide and employment is US.
- 168 occupations are published at 0.00% and 239 (16.7% of employment) are unpublished; 47 have no Microsoft score. Automation, autonomy and time metrics exist only for the 423 with positive usage. 19 codes appear in only one month. 52 occupations have no job zone.
- April and May shares correlate at 0.99, so noise between the two windows is small. Only two months exist.

## Limits
Two platforms, two years, two user populations. Applicability measures what an assistant completed in 2024 Bing Copilot chats; EI measures 2026 Claude.ai conversations coded to occupations by Anthropic's classifier. Shares are rounded to 0.01 point. Regressions are descriptive and select on positive usage.

## What the site should show
| Chart | CSV | Columns |
|---|---|---|
| Scatter explorer (x applicability, y usage ratio on a log axis or usage share, size employment; India share as the country option) | `m2_scatter.csv` | `soc`, `title`, `major_group_name`, `employment`, `annual_mean`, `ms_applicability`, `aei_global_share_pct`, `aei_india_share_pct`, `aei_usage_ratio`, `aei_automation_pct`, `job_zone`, `aei_status`, `small_employment`, `rank_gap_ratio` |
| Agreement panel with intervals | `m2_agreement.csv` | `measure_a`, `measure_b`, `sample`, `weighting`, `statistic`, `n`, `estimate`, `ci_low`, `ci_high` |
| Occupations where measures disagree | `m2_disagreement.csv` | `direction`, `title`, `job_zone`, `ms_pct_rank`, `aei_ratio_pct_rank`, `rank_gap_ratio`, `hint` |
| Employment vs usage by major group; automation vs augmentation | `m2_major_groups.csv` | `major_group_name`, `employment_share_pct`, `aei_usage_share_pct`, `ms_applicability_emp_weighted`, `aei_automation_pct`, `aei_augmentation_pct`, `aei_work_use_pct` |
| Regression summary | `m2_regressions.csv` | `model`, `term`, `coef`, `se`, `ci_low`, `ci_high`, `n`, `r2` |
| Warning banner and per-occupation flags | `m2_quirks.csv`, `m2_summary.csv` | `quirk`, `detail`; `key`, `value` |

Wording to carry: "usage and applicability are different measures"; "exploratory".
