# Model M6: macro and policy

Status: 2026-11-22. Code: `pipeline/m6_reference.py` (Python reference), `web/src/models/m6.ts` (what the website runs), `pipeline/build_m6.py` (calibration data and tables), `pipeline/fetch_pwt.py` (downloads). Tables: `data/processed/m6_*.csv`. Results and what to show: [findings-m6.md](findings-m6.md).

**These models give scenarios, not forecasts.** Each one answers "what follows if these assumptions hold", with the data used where data exist and a stated range where they do not. Nothing here predicts what AI will do to growth, wages or jobs.

## What the three models do

| | Model | Question | Main outputs |
|---|---|---|---|
| A | Solow growth with AI compute and a CES production function | If AI compute keeps growing, what happens to GDP, the wage and the labour share? | GDP, GDP per worker, wage, labour share, AI-owner income share, consumption, r minus g |
| B | Ideas production with research automation (Romer and Jones style) | Does growth stay constant, or accelerate, as AI does more of the research? | growth of ideas and GDP, regime (constant or explosive), year a growth cap is hit |
| C | Distribution, demand and policy | Do workers and owners spend differently, does demand fall short, and what do an automation tax and a basic income (UBI) do? | demand gap, UBI size, group consumption, welfare, welfare-maximising tax |

The models are linked, not merged. Model C takes the income shares of Model A year by year. Models A and B share the economy parameters (labour share, saving rate, depreciation, workforce growth, productivity growth, capital-to-output ratio). Model C does not feed back into A or B (see limits). All three run for 60 annual steps from a start year ("year 0", calibrated to recent data) and return arrays of 61 values.

## Model A: Solow growth with AI compute

Production, with `Bs` a constant that sets year-0 GDP to 1:

    Y_t = Bs * A_t * K_t^alpha * X_t^(1-alpha)
    X_t = [ (1-g) * L_t^rho + g * C_t^rho ]^(1/rho),   rho = (sigma - 1) / sigma

- `A_t = (1 + tfp_growth)^t` neutral productivity; `L_t = (1 + labour_growth)^t` workforce; `K_t` conventional capital.
- `C_t` is AI compute, an index with `C_0 = 1`. It grows at `g_t = g_0 * (1 - decay)^t`, where `g_0 = 2^(1/doubling_years) - 1`. Growth slows each year by `compute_growth_decay` (power, chips and money limit it). With decay 0 the doubling time never changes.
- `sigma` is the elasticity of substitution between labour and AI compute. Below 1 they are complements, above 1 substitutes, and at exactly 1 the function is Cobb-Douglas (handled as a limit).
- `alpha = 1 - labour_share0 - ai_share0` is the share of conventional capital. `g = ai_share0 / (labour_share0 + ai_share0)` is the weight of compute inside X. This normalisation makes the year-0 income shares equal the calibration values exactly.

Income shares (they sum to 1, checked numerically):

    labour share   = (1-alpha) (1-g) (L / X)^rho
    AI share       = (1-alpha) g (C / X)^rho
    capital share  = alpha

The wage per worker is `labour share * Y / L`. It equals the marginal product of labour (checked against a numerical derivative; the two agree to about 1e-10).

Capital accumulation and the cost of AI compute (no free lunch):

    r_t      = alpha * Y_t / K_t - depreciation           net return on conventional capital
    V_t      = AI share_t * Y_t / (r_t + ai_depreciation)   value of AI capital implied by its income
    I_AI,t   = V_t * max( (1 + g_t)(1 - ai_cost_decline) - 1 + ai_depreciation, 0 )
    I_K,t    = max( 0, saving_rate * Y_t - I_AI,t )
    K_t+1    = (1 - depreciation) K_t + I_K,t
    consumption_t = Y_t - I_AI,t - I_K,t

So AI compute is bought out of saving. The money value of the compute stock grows more slowly than the compute itself because each unit gets cheaper (`ai_cost_decline`). If AI spending exceeds total saving in some year, conventional investment is zero and the result flags `crowded_out = 1` for that year.

The simulation also runs the **frozen-compute counterfactual** (`a_frozen`): the same economy with `C_t = 1` forever. Charts compare the two.

**Calibration of the no-AI baseline.** `tfp_growth` and `k_output_ratio0` are solved (in `build_m6.py`, function `calibrate_baseline`) so that the frozen economy starts on a balanced growth path and grows at the observed 2003 to 2023 average growth rate of real GDP (USA 2.11% a year, India 6.15%). The solved `tfp_growth` (USA 0.70%, India 2.09%) is a residual of this model; it is not the same as Penn World Table's measured TFP growth (USA 0.45%, India 0.84%), because PWT's capital stock grows differently from what a one-line saving rule implies. The solved capital-to-output ratio (USA 3.29, India 2.80) differs from the PWT ratio (USA 3.36, India 3.69) for the same reason; for India the gap is large and should be read as a limit of the calibration.

## Model B: ideas production with research automation

    Y_t = Bs * K_t^alpha_B * (A_t L_t)^(1 - alpha_B),   alpha_B = 1 - labour_share0
    A_t+1 = A_t * (1 + g_t),   g_t = min( theta * R_t^lambda * A_t^(phi - 1), growth_cap )
    R_t   = (L_t/L_0)^(1 - a_t) * (K_t E_t / (K_0 E_0))^(a_t)
    E_t+1 = E_t * (1 + compute_boost)
    a_t   = a_0 + (a_end - a_0) * min(1, t / ramp_years)

- `A_t` is the stock of ideas. Researchers are proportional to the workforce. `R_t` combines researchers and AI compute: a share `a_t` of research tasks is done by compute (capital `K_t` times an efficiency factor `E_t`) and the rest by researchers, with equal weights across tasks. Dividing each input by its starting value means a change in `a_t` does not change research input at year 0.
- `theta` is set so that ideas growth at year 0 equals `tfp_growth / (1 - alpha_B)`, which makes the productivity growth of B match Model A.
- Capital accumulates as in Model A with the same saving rate.
- `phi` below 1 means ideas get harder to find as the stock grows (Jones 1995). `lambda` below 1 means duplication in research.

**Regimes.** For a constant AI share `a`, annual growth of ideas settles at

    g* = lambda (n + a * compute_boost) / (1 - phi - lambda * a)       (n = labour_growth)

if `phi + lambda * a < 1`. This is the Jones result, `lambda n / (1 - phi)`, when `a = 0`, and it rises as `a` rises. When `phi + lambda * a >= 1` the denominator reaches zero and growth accelerates without a finite limit (growth of ideas rises with the stock of ideas). The result reports `regime_index = phi + lambda * a_end`, a label (`constant growth` below 0.9, `near the edge` from 0.9 to 1, `explosive` at 1 or more), the AI share at which the switch occurs (`threshold_share = (1 - phi) / lambda`), and the curve `g*` against `a` (`bgp_growth`, null where explosive). The formula is for continuous time; the annual simulation differs from it by under 1% (a numerical run of 4,000 years converges to 4.82% against 4.78% from the formula in one test).

**Cap.** `growth_cap` (default 25% a year) stands in for physical, political and resource limits. Growth of ideas is cut off at the cap and the first year it binds is reported (`first_cap_year`; `hit_cap`). The cap is an assumption, not an estimate.

**Parameter `phi` calibration.** `phi` is solved so that, with no automation (`a = a_0`), the baseline grows at a constant rate given `lambda` and workforce growth: `phi = 1 - lambda * a_0 - lambda * n / g_0` (`solve_phi`; USA 0.394). `lambda` (0.75), the AI research shares, the ramp, `compute_boost` and the cap are assumptions with ranges, because no data pin them down. Model B is calibrated for a frontier economy; for the India preset it keeps the USA value of `phi`, and its outputs should not be read as India results.

## Model C: distribution, demand and policy

Two groups. A share `pi` (`owner_pop_share`) of people are capital owners; the rest are workers. Per unit of potential output `Y` (so `Y = 1`), with labour share `lab`, conventional capital share `cap` and AI share `ai` taken from Model A for the year:

    base      = (1 - tau)^e                      share of AI income that remains after the tax (e = tax_base_elasticity)
    taxed     = ai * base                        the rest is lost output
    revenue   = tau * taxed                      funds an equal payment (UBI) to every person
    cap_after = cap + taxed * (1 - tau)
    owners'  disposable income = w_o * cap_after + pi * revenue                      (w_o = owner_capital_income_share)
    workers' disposable income = lab + (1 - w_o) * cap_after + (1 - pi) * revenue
    potential output           = 1 - ai * (1 - base)

The two incomes add up to potential output (checked). Consumption is `mpc_workers` times workers' income plus `mpc_owners` times owners' income. Saving is potential output minus consumption.

**Demand gap (Say's law against Keynes).** Let `sigma0` be the saving rate at year 0 with no tax. Investment is

    I = nu * S + (1 - nu) * sigma0 * potential output       (nu = say_pass_through)
    gap = S - I = (1 - nu) * (S - sigma0 * potential output)

With `nu = 1` every dollar saved is invested (Say's law) and the gap is always zero. With `nu = 0` investment stays at its baseline share of output, so extra saving is a shortfall of demand. A positive gap is a shortfall as a share of potential output; a negative value is excess demand (shown signed; welfare treats negative gaps as zero). As labour income falls and owners' income rises, saving rises because owners spend less of each dollar, so the gap rises. A UBI moves income to workers, who spend more of it, so the gap falls. This is a first-round effect only: realised output is `potential - max(gap, 0)`, and both groups' consumption is scaled by `realised / potential`. A multiplier would amplify it and is not modelled.

**Welfare.** Per-person consumption of owners and workers is `c_o` and `c_w`. Utility is CRRA, `u(c) = c^(1-eta) / (1-eta)` (log if `eta = 1`). The welfare weight on an owner relative to a worker is `owner_welfare_weight`. Welfare is reported as the "equally distributed equivalent" consumption (the uniform consumption level that gives the same weighted welfare), as a percentage change from the no-tax case.

**Welfare-maximising tax.** At `eval_year`, the model tries every tax rate from 0 to 95% in steps of 1 point and reports the one with the highest welfare, together with the revenue-maximising rate and curves of revenue, gap, group consumption and welfare. The answer rests on these assumptions, all stated in the parameter table and all changeable: the weights on owners and workers, the curvature `eta`, how much of the AI income base disappears when taxed (`e`), who owns capital (`w_o`, `pi`), that compute growth is exogenous (a tax does not slow it), and that revenue is paid out as a flat UBI with no administration cost. With `e = 0` the best rate is the 95% upper end of the grid; with `e = 1.5` it can be 12% to 34% (see findings). The result is a property of the assumptions, not a policy recommendation.

## Parameters

All 29 parameters, with the USA calibration (the default in the code), the India calibration (the India preset), the slider range and the kind: **data** (read from a source), **derived** (solved or computed from data in `build_m6.py`) or **assumption** (no data; the range is a plausible range, not an estimate). The same table with help text is `data/processed/m6_parameters.csv`; `M6_PARAMS` in the TypeScript file carries label, help and unit for the sliders.

| Key | Meaning | USA | India | Range | Kind | Source or reason |
|---|---|---|---|---|---|---|
| **Shared: economy today** | | | | | | |
| `labour_share0` | Labour share of income today | 0.5885 | 0.5244 | 0.3 to 0.8 | data | PWT 11.0 labsh, mean 2013-2023 |
| `ai_share0` | AI compute share of income today | 0.007 | 0.002 | 0 to 0.05 | derived | Epoch AI data-centre capital cost (US sites, 2026 Q3) / US GDP (World Bank 2025), times PWT internal rate of return plus 20% depreciation; midpoint of tracked-only and all-chips bounds |
| `saving_rate` | Investment rate | 0.216 | 0.3286 | 0.05 to 0.5 | data | World Bank NE.GDI.TOTL.ZS, mean 2020-2024 |
| `depreciation` | Depreciation of conventional capital | 0.0445 | 0.0558 | 0.02 to 0.1 | data | PWT 11.0 delta, mean 2013-2023 |
| `labour_growth` | Growth of the workforce | 0.0093 | 0.0208 | -0.02 to 0.04 | data | PWT 11.0 emp, 2003-2023 log growth |
| `tfp_growth` | Productivity growth without AI | 0.007 | 0.0209 | 0 to 0.05 | derived | solved in build_m6.py (calibrate_baseline) so that frozen-compute GDP grows at the PWT 2003-2023 rate |
| `k_output_ratio0` | Capital-to-output ratio at start | 3.29 | 2.8 | 1 to 6 | derived | solved with tfp_growth: balanced growth path (K/Y = (s - AI investment) / (g + depreciation)) |
| **Model A** | | | | | | |
| `sigma` | How easily AI compute replaces labour | 1.25 | 1.25 | 0.2 to 4 | assumption | assumption; literature range 0.5-0.7 (Oberfield and Raval 2021), about 1.25 (Karabarbounis and Neiman 2014) |
| `compute_doubling_years` | AI compute doubling time at the start | 0.7 | 0.7 | 0.5 to 10 | data | Epoch AI chip sales, doubling time of cumulative H100e, 2025Q2-2026Q2 (m6_compute_growth.csv) |
| `compute_growth_decay` | Slowdown of compute growth | 0.2 | 0.2 | 0 to 0.3 | assumption | assumption |
| `ai_depreciation` | Depreciation of AI compute | 0.2 | 0.2 | 0.05 to 0.5 | assumption | assumption (about a five-year hardware life) |
| `ai_cost_decline` | Fall in cost per unit of compute | 0.26 | 0.26 | 0 to 0.6 | data | Epoch AI chip_types: H100e per chip price by release date (m6_compute_growth.csv) |
| **Model B** | | | | | | |
| `idea_spillover` | Do old ideas help new ones? (phi) | 0.394 | 0.394 | 0 to 1.1 | derived | solved in build_m6.py (solve_phi) so the no-AI economy is on a balanced growth path given lambda and workforce growth |
| `research_elasticity` | Weight of research input (lambda) | 0.75 | 0.75 | 0.2 to 1 | assumption | assumption |
| `ai_research_share0` | AI share of research today | 0.02 | 0.02 | 0 to 0.3 | assumption | assumption |
| `ai_research_share_end` | AI share of research at the end | 0.4 | 0.4 | 0 to 1 | assumption | assumption |
| `ai_research_ramp_years` | Years to reach that share | 30 | 30 | 5 to 60 | assumption | assumption |
| `compute_boost` | Extra growth of effective compute per unit of capital | 0.05 | 0.05 | 0 to 0.3 | assumption | assumption |
| `growth_cap` | Cap on yearly growth of ideas | 0.25 | 0.25 | 0.05 to 1 | assumption | assumption |
| **Model C** | | | | | | |
| `owner_pop_share` | Capital owners as a share of people | 0.1 | 0.1 | 0.01 to 0.4 | assumption | assumption (top decile) |
| `owner_capital_income_share` | Share of capital and AI income going to owners | 0.88 | 0.88 | 0.3 to 1 | data | Federal Reserve DFA via FRED WFRBST01122 + WFRBSN09149 (top 10% share of corporate equities and mutual fund shares, 2026 Q2) |
| `mpc_workers` | Spending out of wage income | 0.95 | 0.85 | 0.6 to 1 | assumption | assumption; US personal saving rate averaged about 7% in 2015-2025 (BEA PSAVERT) and lower-wealth households save less |
| `mpc_owners` | Spending out of capital and AI income | 0.58 | 0.476 | 0.2 to 0.95 | derived | solved in build_m6.py (solve_mpc_owners) so the baseline saving rate equals the World Bank gross domestic saving rate, 2020-2024 |
| `say_pass_through` | How much extra saving becomes investment | 0.5 | 0.5 | 0 to 1 | assumption | assumption |
| `crra` | Dislike of inequality (CRRA) | 1.5 | 1.5 | 0.2 to 4 | assumption | assumption |
| `owner_welfare_weight` | Welfare weight on an owner relative to a worker | 1 | 1 | 0.25 to 2 | assumption | assumption |
| `tax_rate` | Automation tax on AI income | 0 | 0 | 0 to 0.9 | assumption | policy choice |
| `tax_base_elasticity` | How much the tax shrinks the base | 0.5 | 0.5 | 0 to 1.5 | assumption | assumption |
| `eval_year` | Year at which policy is judged | 30 | 30 | 5 to 60 | assumption | policy choice |

## Calibration data

| Quantity | USA | India | World | Source and window |
|---|---|---|---|---|
| Labour share of GDP (PWT `labsh`) | 0.588 (0.568 in 2023) | 0.524 (0.533 in 2023) | 0.542 (0.534 in 2023) | Penn World Table 11.0, mean 2013 to 2023; world is GDP-weighted over 47 to 140 countries, depending on the year, covering 95% to 98% of world output |
| Capital share (1 minus labour share) | 0.412 | 0.476 | 0.458 | derived; includes land and rents |
| Depreciation rate | 0.0445 | 0.0558 | 0.0447 | PWT `delta`, 2013 to 2023 |
| Capital-to-output ratio | 3.36 | 3.69 | 4.54 | PWT `rnna / rgdpna`; the world figure sums national-price capital and output and is rough |
| Real internal rate of return | 0.079 | 0.118 | 0.085 | PWT `irr` |
| Real GDP growth, 2003 to 2023 (log) | 2.11% | 6.15% | 3.40% | PWT `rgdpna` |
| Employment growth, 2003 to 2023 | 0.93% | 2.08% | 1.39% | PWT `emp` |
| TFP growth, 2004 to 2023 mean | 0.45% | 0.84% | 0.52% | PWT `rtfpna` |
| Gross capital formation, % of GDP | 21.6 | 32.9 | 27.0 | World Bank NE.GDI.TOTL.ZS, 2020 to 2024 mean |
| Gross domestic saving, % of GDP | 18.4 | 30.7 | 27.8 | World Bank NY.GDS.TOTL.ZS, 2020 to 2024 mean |
| Household consumption, % of GDP | 67.6 | 58.4 | 55.4 | World Bank NE.CON.PRVT.ZS, 2020 to 2024 mean |
| Tax revenue (central government), % of GDP | 10.9 | 6.9 (2022 only) | 14.0 | World Bank GC.TAX.TOTL.GD.ZS, 2019 to 2024 |
| Top 10% share of corporate equities and mutual fund shares | 88.1% (2026 Q2) | not available | | Federal Reserve Distributional Financial Accounts via FRED (WFRBST01122 plus WFRBSN09149) |
| Top 1% and top 0.1% share of net worth | 32.5% and 15.0% (2026 Q2) | not available | | same release (WFRBST01134, WFRBSTP1300) |

**Why r minus g matters here.** Piketty's r versus g compares the return on capital (r) with the growth rate of the economy (g). With the PWT internal rate of return and the 2003 to 2023 growth rates, r minus g is about 5.8 points for the USA (7.9% against 2.1%) and 5.6 points for India (11.8% against 6.15%). Model A reports `r_net` (net return on conventional capital) and `growth` each year so the gap can be charted; it is a descriptive comparison, not a test of Piketty's claim.

**AI compute income share today (`ai_share0`).** No source reports the income of AI compute owners. It is derived in `build_m6.py` from Epoch AI data in three steps: (1) capital cost of the tracked US data centres at 2026 Q3 is $456 billion (2025 dollars), 1.5% of US GDP in 2025 ($30.8 trillion, World Bank); (2) tracked sites hold 38% of all AI chips shipped by Epoch's count (12.1 million of 31.6 million H100 equivalents at 2026 Q2), so scaling to all chips gives 3.9% of GDP as an upper bound; (3) multiplied by the required gross return (PWT internal rate of return 7.9% plus 20% hardware depreciation = 28%) this gives an AI income share of 0.41% (tracked sites only) to 1.09% (all chips priced like tracked US sites). The default, 0.7%, is the midpoint. It is rough. India has no data centre in the Epoch list, so its default (0.2%) is an assumption.

**Compute growth and efficiency.** From `data/processed/m6_compute_growth.csv` (log-linear fits with Newey-West standard errors, 2 lags; the intervals are narrow because the series are smooth and short, and they reflect fit error only, not the uncertainty in Epoch's chip estimates):

| Series | Window | Annual growth factor | Doubling time (years), interval |
|---|---|---|---|
| Cumulative AI chips shipped (H100e) | 2024 Q1 to 2026 Q2 (10 quarters) | 3.14 | 0.61 (0.57 to 0.65) |
| same | 2025 Q2 to 2026 Q2 (latest year, 5 points) | 2.58 | **0.73** (0.71 to 0.75) |
| same | 2024 Q2 to 2025 Q2 (year before) | 3.58 | 0.54 (0.53 to 0.56) |
| Nvidia chips only | 2022 Q1 to 2026 Q2 | 3.74 | 0.53 (0.49 to 0.57) |
| Chip shipments per quarter (flow) | 2024 Q1 to 2026 Q2 | 2.48 | 0.76 (0.70 to 0.84) |
| Chip spending per quarter (Epoch cost estimate) | 2024 Q1 to 2026 Q2 | 1.83 | 1.15 (1.09 to 1.20) |
| Tracked data-centre IT power | 2025 Q3 to 2026 Q3 | 3.07 | 0.62 (0.58 to 0.67) |
| Hardware performance per dollar | chips released 2018 to 2026 (26 types) | 1.36 | 2.24 (1.66 to 3.42) |
| Hardware performance per watt | chips released 2018 to 2026 (29 types) | 1.38 | 2.14 (1.85 to 2.52) |

The stock doubled in about 0.73 years in the year to mid 2026, slower than the 0.54 years in the year before: a mechanical slowing, because the base is large. The default `compute_doubling_years` is 0.7. `ai_cost_decline` = 1 − 1/1.36 = 26% a year. The tracked data centres drew 14.0 GW of IT power at 2026 Q3 (0.53 GW at 2024 Q1); Epoch's own projection (planned, not observed) reaches 38 GW by 2029.

**Coverage limits of the Epoch data.**
- The chip counts start in 2022 Q1 for Nvidia, 2022 Q4 for Google TPU and 2024 Q1 for AMD, Amazon Trainium, Huawei Ascend and Cambricon. Chips shipped before these dates are missing, and there is no data for other accelerators. The doubling times use only quarters in which all six designers report (from 2024 Q1) or Nvidia alone (2022 to 2026).
- "Stock" is cumulative shipments. No chips are retired, none are lost, and chips are not weighted by use. It is an upper bound on installed compute.
- Percentile bands in the files are Epoch's; the column `shipments_h100e_low_sum_p5` and `..._high_sum_p95` sums the bands across designers, which overstates the width.
- Epoch flags 2026 Q3 and 2026 Q4 as incomplete or forward-looking, so they are kept in the table with a note and excluded from every fit.
- The data-centre file has 96 sites (77 in the USA, none in India). It tracks sites that are large today, so growth in earlier years is overstated by selection. Projected values (from 2026 Q4) are marked "planned".
- Chip prices and thermal design power in `chip_types.csv` are approximate list values and cover 26 to 29 chip types.

**Labour-share series** (`m6_labour_share.csv`).
- Penn World Table `labsh` (labour compensation share of GDP, adjusted for the labour income of the self-employed): USA 0.637 in 2000 and 0.568 in 2023; world 0.597 in 1980, 0.574 in 2000, 0.534 in 2023. PWT's user guide says the series is assumed constant where it has no observation. Thirty-one of India's observations repeat the value of a neighbouring year (0.7526 for 1950 to 1975, 0.5335 for 2019 to 2023); they are flagged in the file and should not be read as annual measurements.
- ILO labour income share of GDP, modelled estimates (Nov. 2025 edition): USA 0.554 (2024), India 0.619 (2024), world 0.525 (2024). The level differs from PWT, most for India (PWT 0.53 against ILO 0.61 in 2023), because the two treat self-employed income differently. Values for 2025 and 2026 are model projections.
- US nonfarm business labor share (BLS, index 2017 = 100): 111.6 in 2000, 100.0 in 2019, 96.0 in 2025.
- US compensation of employees as a share of gross domestic income (BEA): 56.6% in 2000, 51.4% in 2024, 50.9% in 2025.

## Limits

1. **Scenarios, not forecasts.** The compute path is a user-set rate that slows by a fixed share each year, not a prediction.
2. **AI compute is exogenous.** Its growth is set by the user. Saving pays for it, but a tax, a shortage of power or a change in demand does not change how much compute is built.
3. **Smooth production function.** In Model A, more compute always raises the marginal product of labour (a property of the CES function), so wages rise in these scenarios even when the labour share falls. A fall in the wage itself, through displaced tasks, needs a task-based model (M4), not this one.
4. **Rough AI compute accounting.** AI capital is valued from its income, its price decline is a single rate, and investment is not tied to Epoch's spending data year by year. Epoch's chip spending is 0.22% of world GDP over the last four complete quarters ($260 billion against $118 trillion), and the capital cost of all tracked data centres rose by $356 billion in the year to 2026 Q3 (about 1.2% of US GDP). The model's AI investment at year 0 is 3.0% of GDP (falling to 0.5% by year 10 as compute growth slows), about two and a half times the data-centre figure.
5. **Calibration choices.** TFP growth and the capital-to-output ratio are solved to put the no-AI economy on a balanced growth path, so they differ from PWT's measured values (and strongly so for India). The labour share is a PWT series with imputed stretches. India's owner equity share, saving behaviour and AI compute income are assumptions.
6. **Model B is a frontier model.** The exponents `phi` and `lambda`, the AI research share path, `compute_boost` and the cap are assumptions. The explosion threshold depends mainly on `phi + lambda * a_end`, which the data do not identify. It is calibrated for the USA only.
7. **Model C is a snapshot.** It takes Model A's shares at each year, does not feed back, and ignores dynamic effects of a tax on saving and investment. The demand gap is a first-round effect with no multiplier, no interest-rate or price response and no unemployment. The two groups are stylised: owners are the top decile and hold 88% of capital income.
8. **Welfare results depend on judgments.** The optimal tax moves from 12% to 95% across plausible values of the base elasticity and inequality aversion (findings, table); it is not an estimate of the right tax.
9. **No international trade, government debt, money or prices.** There is one good, one country and no taxes other than the automation tax.
10. **Rounded defaults.** The defaults in the code are rounded versions of the solved values (`build_m6.py` warns if they drift apart).

## Check of the TypeScript against the Python

`uv run python pipeline/m6_reference.py --check` runs the TypeScript (`node`) on 16 scenarios: eight chosen to cover the parameter space (defaults; complements; strong substitutes with fast compute; Cobb-Douglas with no slowdown; research automation; tax with UBI and Keynesian demand; India-like; log utility with a high tax elasticity and owner weight 0.5) and the eight presets. For each it compares every number in the result (4,338 values per scenario) with the Python, and also compares parameter metadata (keys, group, minimum, maximum, step, default) and the presets.

Result on 2026-11-22: **all 16 scenarios agree; the largest relative error is 4.4e-14** (tolerance 1e-9). Parameter metadata and presets are identical. TypeScript run time is 0.17 to 0.98 ms per call (the first call includes start-up; later calls 0.17 to 0.5 ms), against the 5 ms limit. The checker was itself tested: comparing the TypeScript defaults with the Python at a different `sigma` gives a relative error of 0.16.

Other checks run during development (Python): income shares sum to 1 in every year for sigma 0.3, 1 and 3; the wage equals the numerical marginal product of labour; the simulated long-run growth in Model B converges to the formula; incomes in Model C sum to potential output and saving equals output minus consumption; the demand gap is zero with `nu = 1` and at year 0; welfare gain is zero with a zero tax; the frozen-compute baseline grows at the target rate with a constant capital-to-output ratio. `tsc --strict` and `eslint` pass on the TypeScript file.

## Literature (read for this work)

Only what the page or paper says in the places read is used. The abstract (or, for Karabarbounis and Neiman, the paper text) was fetched on 2026-11-22.

| Source | URL | What was read, and how it is used here |
|---|---|---|
| Jones (1995), "R&D-Based Models of Economic Growth", Journal of Political Economy 103(4) | https://econpapers.repec.org/RePEc:ucp:jpolec:v:103:y:1995:i:4:p:759-84 | Abstract: scale effects in R&D growth models conflict with time-series evidence; a modified Romer model has long-run growth that depends only on parameters usually taken as exogenous, including population growth. Basis of the ideas equation in Model B. |
| Aghion, Jones and Jones, "Artificial Intelligence and Economic Growth" (NBER WP 23928; book chapter 2019) | https://www.nber.org/papers/w23928 | Abstract: treats AI as the newest form of automation; asks about growth, factor shares, singularity and Baumol's cost disease. Only the abstract was read; the research-automation mechanism in Model B is a simple version in that spirit, not a replication. |
| Trammell and Korinek, "Economic Growth under Transformative AI" (NBER WP 31815) | https://www.nber.org/papers/w31815 | Abstract: full automation of production would raise growth and cut labour's share; automating R&D would speed the transition but may not bring it about alone; wage effects are ambiguous. Used for the framing of Models A and B. |
| Bloom, Jones, Van Reenen and Webb (2020), "Are Ideas Getting Harder to Find?", American Economic Review 110(4) | https://www.aeaweb.org/articles?id=10.1257/aer.20180338 | Abstract: research effort has risen while research productivity has fallen sharply. Supports `phi` below 1 as a prior. |
| Acemoglu and Restrepo, "The Race Between Machine and Man" (NBER WP 22252; AER 2018) | https://www.nber.org/papers/w22252 | Abstract: automation lowers employment and the labour share and can lower wages; new tasks do the opposite. Context for the labour share and for the limit that this model has no task creation. |
| Karabarbounis and Neiman, "The Global Decline of the Labor Share" (NBER WP 19136; QJE 2014) | https://www.nber.org/papers/w19136 (paper text: https://www.nber.org/system/files/working_papers/w19136/w19136.pdf) | Paper text: global corporate labour share fell 5 percentage points over 35 years; preferred elasticity of substitution between capital and labour about 1.25; a 25% fall in the relative price of investment explains about half the fall. Source for the default sigma of 1.25 (a capital-labour estimate, used here as a placeholder for compute). |
| Oberfield and Raval (2021), "Micro Data and Macro Technology", Econometrica 89(2) | https://www.econometricsociety.org/publications/econometrica/2021/03/01/micro-data-and-macro-technology | Abstract: aggregate elasticity of substitution between capital and labour in US manufacturing 0.5 to 0.7. Lower anchor for sigma. |
| Dynan, Skinner and Zeldes (2004), "Do the Rich Save More?", Journal of Political Economy (NBER WP 7906) | https://www.nber.org/papers/w7906 | Abstract: a strong positive relationship between saving rates and lifetime income. Supports a lower spending share for owners than for workers. |
| Jappelli and Pistaferri (2014), "Fiscal Policy and MPC Heterogeneity", AEJ: Macroeconomics 6(4) | https://www.aeaweb.org/articles?id=10.1257/mac.6.4.107 | Abstract: average MPC out of a transitory income change about 48% in Italian survey data; households with little cash on hand have a much higher MPC. Supports different spending shares by group; its MPC concept (transitory change) is not the same as the spending share of income used here. |
| Guerreiro, Rebelo and Teles (2022), "Should Robots Be Taxed?", Review of Economic Studies 89(1) | https://econpapers.repec.org/RePEc:oup:restud:v:89:y:2022:i:1:p:279-311. | Abstract: robot taxes are optimal while routine workers who cannot change occupation are in the labour force, and fall to zero afterwards. A reminder that the optimal automation tax depends on who is affected and for how long; Model C has no such dynamics. |
| Piketty (2015), "About Capital in the Twenty-First Century", AER Papers and Proceedings 105(5) | https://www.aeaweb.org/articles?id=10.1257/aer.p20151060 | Abstract: clarifies the role of "r > g" in the analysis of wealth inequality. Used only to define the r versus g comparison in Model A. |

Data licences: Penn World Table 11.0 (Feenstra, Inklaar and Timmer 2015, AER 105(10); Groningen Growth and Development Centre, doi 10.34894/FABVLR) is CC BY 4.0 per the DataverseNL record; Epoch AI data are CC BY (README in each zip); ILOSTAT data are CC BY 4.0 since 3 May 2023 (https://www.ilo.org/node/9321); World Bank WDI is CC BY 4.0; BLS, BEA and Federal Reserve series are US government statistics (via FRED, no key).

## Reproduce

    python3 -I pipeline/fetch_pwt.py                                   # PWT, ILO, FRED, World Bank macro files into data/raw/
    uv run python pipeline/build_m6.py                                 # tables in data/processed/m6_*.csv (deterministic)
    uv run python pipeline/m6_reference.py --check                     # TypeScript against Python

`build_m6.py` needs the Epoch zips from `pipeline/fetch.py`. It prints the calibration and warns if the defaults in `m6_reference.py` or the India preset no longer match it.
