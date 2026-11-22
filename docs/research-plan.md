# Research plan

Status: draft v2, 2026-11-22, revised after the files were downloaded and opened. What each file actually contains is in [../data/SOURCES.md](../data/SOURCES.md).

## Main research question

> Given how fast the price of AI capability is falling and where AI is already used, how much of the wage bill is exposed to a falling "wage ceiling", and what does a task-based model imply for wages, the labour share, demand and who captures the gains?

The idea behind the question: for any task an AI can do, the wage a person can earn is capped by what the AI substitute costs. As that cost falls, the cap falls. Whether people still get paid depends on (a) comparative advantage while compute is scarce, (b) new tasks that cheaper intelligence creates, (c) whether demand holds up when wage income falls, and (d) who owns the agents.

## How the five lenses map to the modules

| Lens | Economics | Module |
|---|---|---|
| Comparative advantage | Ricardo, opportunity cost, scarcity of compute | M4 |
| Wage ceiling | Acemoglu–Restrepo task model, CES, derived demand | M4 |
| Demand side | Say's law vs Keynes, marginal propensity to consume, labour share | M6 |
| New tasks and Jevons | Jevons paradox, reinstatement, Baumol | M1, M4 |
| Who owns the agents | Market power, Cournot/Bertrand, HHI, Coase, UBI, automation tax | M5, M6 |

## Modules

Rule for every module: real data, one headline model, one slider panel, one plain-English takeaway. If the data for a part is not available, that part is dropped.

### M1. Price of intelligence
- **Question:** how fast has the price of reaching a fixed capability level fallen, and when the price falls, does total spending rise (elasticity above 1) or fall?
- **Data:** Epoch AI capability data (the Epoch Capabilities Index and individual benchmarks); a price history from 39 month-end snapshots of the LiteLLM price file (2023-09 to 2026-11), to be cross-checked against provider pricing pages (Wayback Machine) and today's prices from the OpenRouter models API; OpenRouter daily token volumes (needs an API key) for the elasticity part.
- **Method:** for each capability threshold, the cheapest model that clears it at each date gives a price-of-capability series (this needs model names matched between the price file and Epoch's data); a chained (Fisher) price index; a log-linear trend and a Wright's-law fit; elasticity of volume with respect to price.
- **Controls:** benchmark, capability threshold, date range.
- **First look (2026-11-22, exploratory, not final):**
  - 212 of Epoch's 258 scored models match a list price in 39 monthly snapshots (3,094 model-months).
  - The cheapest price of GPT-4-level capability (ECI 120 or more) falls from $37.50 per million tokens (September 2023, GPT-4) to about $0.03 (November 2026, an open-weights model at its cheapest host). A log-linear fit halves it about every 3.8 months, roughly an 89% fall a year. Other thresholds give halving times of 2.6 to 4.4 months, but the highest thresholds have fewer months of data.
  - A hedonic index (holding the capability score fixed) puts the quality-adjusted price in November 2026 at about 14% of September 2023, 95% interval 6% to 32%.
  - OpenRouter's reported tokens per day rise about 480 times from January 2025 to November 2026, and the token-weighted list price of priced models stays near $1 per million tokens, because usage shifts toward more capable models (quality upgrading). Implied spending at list prices rises about 2,800 times, an upper bound because cached prompt tokens cost less.
  - A panel regression with model and month fixed effects gives a price elasticity of about -0.47 (95% interval -1.03 to +0.09, 58 models; 27 of them changed price). So within-model price cuts do not show an elasticity beyond 1 in absolute value. The overall growth in spending is consistent with Jevons-type behaviour, but it is also driven by new users and uses, so it is not proof.
- **Known limits:** prices are list prices recorded by LiteLLM's maintainers, not transaction prices; name matching joins Epoch's scores to price entries (matches are listed in `m1_models.csv` for checking); about half of OpenRouter's tokens belong to models that could be matched; the capability score is one composite index.
- **Drop if:** a price history cannot be cross-checked from at least two sources for the models used (the prices come from one source, LiteLLM's history; a spot check of four OpenAI prices against OpenAI's archived pricing pages found three exact matches and one version mismatch, and other providers could not be checked, so the speed-of-decline claims are labelled as based on LiteLLM list prices). The elasticity part stays as an imprecise estimate.

### M2. Where AI is used
- **Question:** which occupations does AI touch most, and do independent measures agree?
- **Data:** Anthropic Economic Index (task and occupation usage, geography), Microsoft's occupation applicability scores, O*NET occupation and task definitions.
- **Method:** map every source to SOC occupation codes; rank correlation between measures; list the occupations where they disagree and why; use the Economic Index's automation-versus-augmentation shares and time-saved metrics by occupation.
- **Controls:** occupation search, source toggle, country (the Economic Index covers 121 countries, including India).
- **Known limits:** the Economic Index release has only two monthly windows (April and May 2026), so it is used as a cross-section, not as a time series. Diffusion over time comes from M3 instead. Each usage source covers one platform. The occupation labels come from Anthropic's own classification of conversations, and some rank unexpectedly high (for example librarians and counter clerks), so occupation-level results carry that caveat.
- **First look (2026-11-22, exploratory, not final):** the Microsoft applicability score and the Economic Index's usage share, across the 591 occupations that have both, have a Spearman rank correlation of about 0.45. Occupations with a Microsoft score of 0.3 or more hold about 11% of the wage bill.
- **Drop if:** the Economic Index cannot be mapped to occupations. Then M2 compares the remaining measures only. (Its occupation codes use the SOC system and match the BLS and Microsoft files, so this is not expected.)

### M3. Adoption in the economy
- **Question:** is firm-level AI adoption showing up in hiring, and in which sectors first?
- **Data:** US Census Business Trends and Outlook Survey (firm AI use by sector, state and size), Indeed AI postings tracker and job-postings tracker.
- **Method:** adoption curves; event study and difference-in-differences comparing high-exposure and low-exposure sectors around the dates adoption accelerates. The long series for this is the Indeed AI postings share (2019 to 2026, nine countries); BTOS adds firm-reported adoption.
- **Controls:** sector, state, date range.
- **Known limits:** in the BTOS files the question on firm AI use (Q7) has 26 fortnightly periods, from late 2025 to October 2026, because the wording changed; the questions on the effect of AI on headcount and hiring (Q9, Q10) have only two periods, so they are a snapshot by sector and size, not a series. Earlier wording is not in these files. Indeed covers nine countries (not India).
- **Drop if:** the BTOS sector files do not carry the AI questions by sector (not yet checked sector by sector).

### M4. The labour model ("why pay anyone?")
- **Question:** for a task that AI can also do, what happens to the human wage and employment as the AI price falls, the share of automatable tasks rises, or compute is scarce?
- **Data:** O*NET tasks and work activities; BLS Occupational Employment and Wage Statistics (May 2025, 830 occupations) for employment and wages; exposure and usage scores from M2; Epoch's METR task-time-horizon and GDPval data as anchors for how much work AI can do.
- **Method:** a task-based model with CES aggregation. The human wage for an exposed task is the lesser of the human productivity-adjusted wage and the AI cost per task. Compute scarcity makes the AI cost rise with the share of tasks automated (comparative advantage). New tasks enter at a rate set by a slider.
- **Controls:** AI price, compute scarcity, share of tasks automatable, elasticity of substitution, demand response, new-task rate. Presets such as "AI price falls tenfold".
- **Drop if:** wage data cannot be obtained. The calibrated version would then be dropped and only the stylised model kept, labelled as illustrative.

### M5. Market structure and power
- **Question:** who sells the intelligence, how concentrated is the market, and how does it behave over time?
- **Data:** OpenRouter daily token share by model and author (needs an API key); Epoch AI data on companies, chips and compute.
- **Method:** Herfindahl–Hirschman index over time; Cournot and Bertrand benchmarks calibrated to the number of firms and costs; price competition among providers.
- **Controls:** provider shares, number of firms, cost assumptions.
- **Known limits:** the shares are OpenRouter's users only, not the whole market; token counts differ by provider's tokenizer; two days are missing from the source; only the top 50 models per day are listed, plus one "other" row.
- **First look (2026-11-22, exploratory, not final):**
  - HHI by firm (each model author mapped to its parent; tokens of the top-50 models; anonymous pre-release models excluded): about 3,070 in January 2025 (about 3.3 equal-sized firms' worth of concentration; Anthropic had about 51% of tokens), falling to about 990 in April 2026 (about 10 firms' worth; the largest firm 16%), then rising to about 1,580 in October 2026 (about 6 firms' worth; the largest, DeepSeek, 34%). The 7-day mean of the daily HHI ranges from 1,029 (1 May 2026) to 3,567 (2 February 2025). Allowing for the models outside the top 50 moves these values by at most about 20%.
  - Positions change fast: the largest firm changed five times in 23 months (Google, DeepSeek, Anthropic and xAI each led in some months); the average month-to-month share-change index is 0.17; 26 firms have reached a 1% share at some point.
  - Under Cournot competition the average Lerner index (price minus marginal cost, over price) is the HHI divided by the market's demand elasticity. At an elasticity of 2, the October 2026 HHI implies a Lerner index of about 0.08 (a markup over marginal cost of about 9%) and the April 2026 HHI about 0.05. These are model-implied numbers, not measured margins. The elasticity must exceed 1 for a profit-maximising firm, so the M1 estimate (about -0.47, imprecise) cannot be used here; the site lets the reader choose it.
  - Price competition among hosts of the same model: for open-weights models, doubling the number of hosts goes with a lowest price about 29% lower (elasticity -0.49, 95% interval -0.63 to -0.34; 62 models, model and month fixed effects), as Bertrand competition would predict. For closed models the number of hosts has no clear effect (-0.04, interval -0.11 to +0.02), because cloud resellers mostly list the same price. The gap between the highest and lowest host price widens as hosts are added, so hosts also differentiate (speed, region, context length). These are associations, not proven causes.
  - Epoch's revenue reports cover only nine companies with sparse dates and none for several large providers, so revenue concentration is not computed (exclusion rule); the reported levels are kept in `m5_epoch_revenue.csv`.
- **Drop if:** daily shares cannot be obtained (they were, on 2026-11-22). Revenue-based concentration is dropped because Epoch's revenue data is too thin.

### M6. Macro and policy
- **Question:** what does falling intelligence cost, and the way its gains are shared, imply for growth, the labour share and policies such as UBI and an automation tax?
- **Data:** Epoch AI chip and data-centre data (compute stock); World Bank macro series; a labour-share series (source to be confirmed).
- **Method:** a Solow growth model with AI capital and an endogenous-growth variant (Romer; Trammell and Korinek on transformative AI); labour share and Piketty's r versus g; a welfare comparison of UBI and an automation tax.
- **Controls:** policy rates, growth parameters, ownership of AI capital.
- **Drop if:** no labour-share series can be sourced. The labour share would then be a model output only, with no data comparison.

## India lens (bounded, in two stages)
- **Stage A (published results, no microdata):** use published IMF results on exposure in India versus advanced economies, a cross-country regression of AI usage per capita on income using the Anthropic Economic Index country data (India's residual), and published India studies for context. India does appear in the Economic Index country data (usage per capita index 0.31 in April and 0.30 in May 2026, and about 7% of global Claude.ai usage), so this is feasible.
- **Stage B (needs PLFS microdata):** map India's occupations (NCO-2015) to the exposure scores and compute exposure-weighted employment and wage bill by sector, state, formality, gender and education; feed India-specific parameters into M4. Needs free registration and a data-access agreement on microdata.gov.in, and a workable occupation crosswalk.
- If Stage B access fails, India stays at Stage A.

## The chatbot
The only AI feature. It answers questions about the concepts, methods, data and results, using this project's own documentation as context, and can be told the current slider values. It does not use tools or act as an agent. The key sits on the server; limits on requests and spend apply.

## What would change the plan
Any source that turns out to be unavailable, unlicensed for public display or too thin removes the part of a module that needs it. Each such change is recorded in `data/SOURCES.md` and in the module's section above.

## Results so far (2026-11-22)
Full write-ups with methods, numbers and limits:
- M1 and M5: the first-look bullets in their sections above, and `data/processed/README.md`.
- M2: [findings-m2.md](findings-m2.md). The two exposure measures agree moderately across occupations (rank correlation 0.45) and strongly across job families (0.80).
- M3: [findings-m3.md](findings-m3.md). Firm use of AI rose from 17% to 25% over the year the survey question exists. Postings in the third of job categories most exposed to AI are about 24% lower than in the least exposed third since 2022, but the gap began opening before ChatGPT's launch, so it is a pattern, not proof of cause.
- M4: [model-m4.md](model-m4.md). A task-based model; with free adoption of AI where it is cheaper, real pay does not fall in the model, the labour share does, and the price of AI binds only when it is high.
- M6: [findings-m6.md](findings-m6.md) and [model-m6.md](model-m6.md). Three linked models, calibrated to Penn World Table and Epoch data; the welfare-best automation tax depends heavily on assumptions.
- India Stage A: [findings-india-a.md](findings-india-a.md). India's usage per person is about 71% of what its income predicts, inside normal scatter, and the gap vanishes once the services share of jobs is controlled. Stage B (PLFS microdata) has not been done.
