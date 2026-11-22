# Findings M6: macro and policy

Status: 2026-11-22. Method, equations, parameters, checks: [model-m6.md](model-m6.md). Tables: `data/processed/m6_*.csv`. **Scenarios, not forecasts.**

## Calibration (USA and India)

| | USA | India | Source |
|---|---|---|---|
| Labour share of GDP | 58.8% (56.8% in 2023) | 52.4% (53.3% in 2023) | Penn World Table 11.0, mean 2013 to 2023 |
| Depreciation; capital-to-output | 4.45%; 3.36 | 5.58%; 3.69 | PWT |
| GDP growth; employment growth (2003 to 2023) | 2.11%; 0.93% | 6.15%; 2.08% | PWT |
| Investment rate; gross saving rate | 21.6%; 18.4% | 32.9%; 30.7% | World Bank, 2020 to 2024 mean |
| Return on capital r; r minus g | 7.9%; 5.8 points | 11.8%; 5.6 points | PWT internal rate of return against growth |
| Top 10% share of equities | 88.1% (2026 Q2) | no data | Federal Reserve DFA via FRED |
| AI compute share of income | 0.7% (range 0.4 to 1.1%) | 0.2% (assumed) | derived from Epoch data-centre costs |

Solved, not measured: no-AI productivity growth (USA 0.70%, India 2.09%) and capital-to-output (3.29, 2.80) put the economy on a balanced growth path at observed growth, so they differ from PWT's measured values. Owners' spending share (0.58, 0.48) is solved to match the World Bank saving rate. Workers' spending share (0.95, 0.85), owners as 10% of people, and all Model B and policy parameters are assumptions with ranges.

## What the data say

**Compute is growing very fast, and the growth is slowing.** Epoch AI counts 31.6 million H100 equivalents of AI chips shipped through 2026 Q2 (6.3 million in that quarter; chips shipped before 2022 are not counted). The cumulative stock grew 3.1 times a year since 2024 Q1 (doubling in 0.61 years) and 2.6 times in the latest year (0.73 years). The 96 data centres Epoch tracks went from 0.53 GW IT power (2024 Q1) to 14.0 GW (2026 Q3), doubling in about 0.6 years. Hardware performance per dollar rises about 36% a year (per watt 38%). The default doubling time is 0.7 years, slowing 20% a year (AI compute is 475 times today's level after 60 years); range 0.5 to 10 years. Epoch covers only some designers and sites, so these are rough.

**The labour share has fallen, but the data cannot tie it to AI.** US PWT labour share: 63.7% (2000), 56.8% (2023); BLS nonfarm business index down 14% from 2000 to 2025; BEA compensation share 56.6% (2000), 50.9% (2025). World (GDP-weighted PWT): 59.7% (1980), 53.4% (2023). These falls began long before AI compute grew. Karabarbounis and Neiman attribute about half of a 5-point global fall to cheaper investment goods (elasticity of substitution near 1.25). PWT and ILO disagree in level, most for India (53% against 61% in 2023), and India's PWT series is partly imputed.

## What the models show (year 30 unless stated; "frozen" = AI compute held at today's level)

| Preset | GDP (today = 1) | Labour share | AI share | Wage vs frozen | Demand gap |
|---|---|---|---|---|---|
| USA baseline | 2.07 (3.94 at yr 60); 12.6% above frozen at yr 60 | 58.8% to 57.3% | 0.7% to 2.2% | +7.9% | 0.2% of potential |
| AI compute doubles every 2 years (no slowdown) | 2.33 (19.0 at yr 60); 5.4x frozen at yr 60 | 54.6%; 35.4% at yr 60 | 4.9%; 24.1% at yr 60 | +15.5% (3.3x at yr 60) | 0.7% |
| Tasks complement (sigma 0.5) | 1.89 (3.56); 1.8% above frozen | rises to 59.5% | about 0% | +2.7% | slight excess demand |
| Tasks substitute (sigma 2.5) | 2.88 (5.55); 58% above frozen | 42.4% | 17.1% | +10.8% | 2.7% (5.3% if investment does not respond) |
| Automation tax 25% with UBI | as above | owners' income share 50.7% to 46.8% | | | 2.7% to 2.0%; UBI 3.7% of GDP |
| India baseline | 6.22 (growth fitted to trend); 3.7% above frozen | 52.4% to 52.0% | 0.2% to 0.6% | +2.6% | 0.07% |

- **A (Solow with CES).** The labour share falls only if compute substitutes for labour (sigma above 1): at year 30 it is 59.5% for sigma 0.5, 58.9% at 1, 57.3% at 1.25, 48.6% at 2, 37.3% at 3. Wages rise in every preset because a smooth production function lifts labour's marginal product when compute grows; what falls is labour's share of a larger output. Whether wages themselves fall needs a task-displacement model (M4).
- **B (ideas).** Default (AI does 2% of research tasks, rising to 40% over 30 years): ideas growth rises from 1.2% to 2.0% (year 30) and 2.9% (year 60), a constant-growth regime settling near 7%. The regime flips when phi + lambda times the AI research share reaches 1, here at an AI share of 81%. "Research automation" (share to 100% in 20 years, compute efficiency +20% a year): ideas growth 2.4% in year 10, 17% in year 20, hitting the 25% cap in year 26. After the cap the path is set by the cap, an assumption. The threshold depends on exponents the data do not pin down.
- **C (demand and policy).** Owners spend less of each dollar (0.58 against 0.95), so income shifting to AI owners raises saving. If investment absorbs it (Say's law) nothing follows; if not, demand falls short. The 25% tax pays a UBI of 3.7% of GDP at year 30, raising workers' consumption 6.1% and cutting owners' 9.0%, narrowing the gap from 2.7% to 2.0% of potential and raising welfare 5.3% (equivalent consumption). The welfare-maximising rate under defaults is 61% (gain 8.7%). **This depends heavily on assumptions:** with sigma 2.5, the best rate across the base elasticity (0, 0.25, 0.5, 1, 1.5) and inequality aversion (0.5 to 3) is 95%, 70 to 78%, 50 to 64%, 26 to 45% and 12 to 34%. It is not a policy recommendation.

## Limits

Compute growth is a user-set path and the tax does not slow it. One good, one country; no prices, money or trade. Model C is a one-year snapshot with a first-round demand gap and no multiplier. India's AI income share and spending behaviour are assumptions. Model B is calibrated for a frontier economy only. Epoch coverage (selected sites, shipments not installed stock) and the Model B cap are in model-m6.md.

## What the website should show

- **Charts.** (1) AI compute index and GDP with and without compute growth (log axis). (2) Stacked income shares (labour, AI, capital) with PWT, ILO and BLS labour-share data points at year 0. (3) Wage and GDP per worker against the frozen path. (4) r and g over time. (5) Ideas growth path with the cap line, plus long-run growth against AI research share with the threshold marked and a regime badge. (6) Demand gap over time with and without the tax. (7) Welfare and revenue against the tax rate with the optimum marked. (8) Consumption of workers and owners.
- **Default controls.** Sigma, compute doubling time and slowdown; AI research share at the end and ramp years; tax rate, how much saving becomes investment, spending shares of the two groups. Economy-today parameters in an "advanced" group, each tagged data, derived or assumption from `kind`. A USA/India switch uses the presets.
- **Presets (8).** USA baseline; India baseline; AI compute doubles every 2 years; Tasks complement; Tasks substitute; Demand failure (Keynes); Automation tax 25% with UBI; Research automation. Show each `story`, a "scenario, not forecast" label, a warning when AI spending exceeds saving (`crowded_out`), and a note that constant-doubling values after year 30 reflect billion-fold compute growth.

## Concepts illustrated

Solow growth model; CES production and the elasticity of substitution; Romer and Jones ideas production (returns to the idea stock, scale effects); research automation and the explosion threshold; Say's law against Keynesian demand failure; marginal propensity to consume across income groups; labour share; Piketty's r versus g; automation tax; universal basic income; CRRA utility and inequality aversion; tax-base response (Laffer-type effect).
