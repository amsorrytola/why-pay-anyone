# India lens, Stage B: PLFS 2025 and AI exposure (exploratory)

Built by `pipeline/build_india_b.py` from India's Periodic Labour Force Survey 2025 (first-visit unit-level data, MoSPI), two BLS occupation crosswalks, the ILO's ISCO-08 titles, and the exposure scores already in `data/processed/occupations.csv` (Microsoft "Working with AI"; Anthropic Economic Index). Output tables are `data/processed/india_b_*.csv`. They hold aggregates only; the unit-level files stay in `data/raw/plfs_2025/` (git-ignored) and are never shared.

## Question
How many Indian workers are in occupations that AI is exposed to, who are they, and how do their pay and job protections compare with workers in less exposed occupations?

## Data
- **PLFS calendar year 2025, first-visit file** (catalog 284): 1,148,634 persons in 270,472 households, January to December 2025. Workers are persons in usual principal status 11, 12, 21, 31, 41 or 51 (own account, employer, unpaid family helper, regular wage, casual): 460,857 persons, 40.4% of the weight. Weights follow MoSPI's README: final weight = MULT / 100. The weights sum to 1.19 billion, so every figure here is a weighted **share**, never a headcount.
- **Occupation:** the three-digit NCO-2015 code (`ocu_pas`; `ocu_cws` for the occupation in the current weekly activity, used for pay).
- **Exposure scores:** the Microsoft applicability score (783 US occupations, from Copilot use) and the Anthropic usage ratio (usage share divided by employment share, 591 occupations; empty means not published). Each is converted to a percentile of the US workforce (employment-weighted mid-rank), so 0 is the least exposed US job and 100 the most. A group scoring 80 is more exposed than the jobs of 80% of US workers; by construction a third of US workers are above the 67th percentile.
- **Crosswalks (BLS):** ISCO-08 to SOC 2010 (1,125 rows, 441 four-digit codes to 878 SOC codes) and SOC 2010 to SOC 2018. For each three-digit ISCO-08 group the score is the US-employment-weighted mean over every US occupation linked to any of its four-digit codes. 128 groups get a Microsoft score; 109 an Anthropic score (kept only where the occupations with a published share cover at least half of the matched US employment).
- **NCO-2015 treated as ISCO-08 at three digits.** An assumption: NCO-2015 follows ISCO-08. Test: 99.97% of workers have a code that exists in ISCO-08 (the only exception with any weight is code 634, 0.03%). The titles shown are the ISCO-08 titles, and the biggest groups look right for India (crop growers, construction and farm labourers, shop sales). The same title can still mean different tasks in India.

## Method
Weighted shares and medians by exposure, occupation group, sector, sex, status and education; Indian workers split into weighted thirds by the Microsoft percentile; a weighted regression of log monthly pay for regular wage workers (current weekly status, earnings above 0) on the exposure percentile (scaled 0 to 1), adding sex, age and age squared, rural, education level, and state effects step by step, with standard errors clustered by first-stage unit (approximated from the region, stratum and FSU fields). Rank correlations across occupation groups.

## Results

| | Value |
|---|---|
| Average Indian worker's exposure (Microsoft), percentile of US workers | 28th (US average 50 by construction) |
| Share of Indian workers above the US top-third line (67th percentile) | 6.3% (US: 33%); 7.6% with equal weights across matched US occupations |
| Above the US median line / above the 80th percentile | 19.0% / 3.1% |
| In jobs below the US bottom-third line (33rd percentile) | 70.6% |
| Top-third share by sex | women 4.8%, men 6.9% |
| By sector | urban 14.0%, rural 3.0% |
| By type of work | regular wage 19.2%, self-employed 3.1%, unpaid family 0.8%, casual 0.3% |
| By schooling | graduates 26.4%, others 2.7% |
| Biggest NCO major groups (share of workers; mean exposure percentile) | skilled agricultural 33% (18), elementary 22% (10), services and sales 13% (55), craft 11% (26), professionals 6% (67), clerical 2% (75) |
| Thirds of Indian workers (cut points at US percentiles 18 and 28) | least exposed: 41% women, 82% rural, 4% graduates, 49% casual labour, median regular wage ₹12,000 a month. Most exposed: 25% women, 47% rural, 35% graduates, 50% in regular wage jobs, median regular wage ₹18,000 |
| Regular wage jobs with no written contract / no social security | least exposed third 68% / 63%; most exposed third 51% / 44% |
| Pay gap, a job scoring 75 against one scoring 25 (regular wage workers, n = 123,782) | 65% raw; 59% with sex, age and area; 5.4% adding education; 4.8% adding state (95% interval about 3% to 6%) |
| Agreement of the two measures across Indian occupation groups | rank correlation 0.54 (n = 106) |
| Median regular pay against exposure across occupation groups | rank correlation 0.43 (n = 121) |

**Reading.** Most Indian workers are in jobs that AI tools are used for or help with less than they are for the typical US job. The reason is the job mix: a third of workers are in farming and a fifth in elementary occupations. Among the minority in highly exposed jobs, most are urban, graduates and regular wage workers. Exposure goes with pay, but nearly all of that gap is the pay premium for schooling, so it is no measure of what AI does to pay. Exposed jobs are more formal, yet half of their regular wage workers still have no written contract.

**Comparison with Stage A.** The IMF's figure (26% of India's employment in high-exposure occupations) uses a different exposure definition and a different line, so it is not comparable with the 19% above the US median here. Both say that fewer Indian jobs are exposed than in advanced economies.

## Limits
- Exposure scores are measured in the US (Copilot use; Claude.ai conversations) and carried to India through occupation crosswalks that are many-to-many. They say which occupations' tasks AI is used for, not whether anyone loses a job, and an Indian worker with the same title may do different tasks, especially in farming and small trade.
- NCO-2015 is treated as ISCO-08 at three digits (see above).
- The Anthropic measure covers 79.2% of Indian workers (the rest are in occupations with no published share, mostly farm and trade work), so its averages are not comparable with the Microsoft measure and it is noisy for groups matched to one or two US occupations (crop growers score 57 on it against 20 on Microsoft's). It is a cross-check, not the headline.
- First-visit file only. Earnings are for the preceding calendar month for regular wage workers and the gross earnings of the last 30 days for the self-employed; the occupation behind earnings is the current weekly activity, while occupation, contract and social security elsewhere are the usual principal activity. 99.9% of regular wage workers and 99.5% of self-employed workers (current weekly status) report positive earnings and enter the pay comparisons; the few with zero or negative earnings are left out.
- The standard errors cluster on an approximate first-stage-unit identifier and ignore the survey's design weights beyond the multiplier, so the intervals are indicative.
- Associations in one year of data. The regression compares workers in different occupations and cannot say what AI does to pay.
- MoSPI notes that the unit-level data should not be used for variables other than the employment and unemployment indicators; this analysis uses occupation, pay and type of work, which are employment indicators.

## Data agreement obligations (the student's)
Non-commercial use only; the data stays with the applicant; no attempt to identify anyone; cite the source (done on the site and here); **email MoSPI (`nssunit.dsdd@mospi.gov.in`) a copy of any report or publication that uses the data**. A draft email is in the student's Gmail drafts.

## What the site shows
`/india`, Part 2: the exposure distribution with a movable line and filters (measure, sector, sex, type of work) from `india_b_cells.csv`; the largest groups above and below the line; a scatter of exposure against pay (`india_b_nco3.csv`); the thirds table (`india_b_thirds.csv`); the pay regression sentence (`india_b_regressions.csv`); and the caveats.
