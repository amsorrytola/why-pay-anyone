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
- **Drop if:** a price history cannot be cross-checked from at least two sources for the models used. Then M1 shows only today's price cross-section, with no claim about the speed of decline. The elasticity part is dropped without OpenRouter volume data.

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
- **Drop if:** daily shares cannot be obtained. Concentration would then be shown from Epoch's company data only if that data supports it; otherwise only the theory panel stays.

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
