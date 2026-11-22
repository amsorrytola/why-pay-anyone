import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Caveat, PageHead, Section, Takeaway } from "@/components/ui";
import { MODULES } from "@/content/concepts";

export const metadata: Metadata = {
  title: "Data and method | Why Pay Anyone?",
  description: "Every data source the site uses, with its licence and citation, what we left out and why, the limits of the data, the method behind each module and how to reproduce it.",
};

/* ====================================================================================================
   Data for this page. It is written by hand from data/SOURCES.md, docs/research-plan.md, the headers of
   the scripts in pipeline/ and the tables in data/processed/ (state on 2026-11-22). Nothing is read at
   runtime. If a source changes, edit the row here.
   ==================================================================================================== */

type Status = "used" | "levels" | "downloaded" | "notused" | "notobtained" | "excluded";

const STATUS: Record<Status, { label: string; bg: string }> = {
  used: { label: "Used", bg: "bg-ok-soft" },
  levels: { label: "Used for levels only", bg: "bg-ok-soft" },
  downloaded: { label: "Downloaded, not used yet", bg: "bg-ai-soft" },
  notused: { label: "Not used", bg: "bg-human-soft" },
  notobtained: { label: "Not obtained", bg: "bg-human-soft" },
  excluded: { label: "Excluded", bg: "bg-owner-soft" },
};

type Source = {
  id: string;
  name: string;
  publisher: string;
  /** Link text and address of the publisher's page. */
  where: string;
  href: string;
  what: string;
  usedFor: string;
  /** Modules that use it. */
  modules: string;
  licence: string;
  /** Printed exactly as the publisher asks. */
  cite?: string;
  status: Status;
  /** Files in data/processed/ (or other tables) that the source feeds. */
  feeds: string[];
  /** Why it is not used, for the excluded and not-obtained sources. */
  reason?: string;
};

const EPOCH_CITE = "Epoch AI, Data on AI models / AI companies / benchmarks (epoch.ai)";

const SOURCES: Source[] = [
  {
    id: "aei",
    name: "Anthropic Economic Index, release 2026-06-26",
    publisher: "Anthropic",
    where: "huggingface.co/datasets/Anthropic/EconomicIndex",
    href: "https://huggingface.co/datasets/Anthropic/EconomicIndex",
    what: "Claude.ai conversations coded by country (121, including India), by occupation and work activity, by automation or augmentation and by estimated time saved. Only two monthly windows: April and May 2026. API usage is global only. Claude Code is excluded. Covers Anthropic's products only.",
    usedFor: "Occupation usage shares and automation versus augmentation shares (M2); a second exposure measure, by rank, for job categories (M3); usage per capita by country and India's occupation mix (India page).",
    modules: "M2, M3, India",
    licence: "CC-BY",
    cite: "Massenkoff et al., “Anthropic Economic Index report: Cadences”, 2026.",
    status: "used",
    feeds: ["occupations.csv (aei_ columns)", "m2_*.csv", "m3_category_exposure.csv", "india_a_*.csv"],
  },
  {
    id: "microsoft",
    name: "Microsoft, Working with AI",
    publisher: "Microsoft Research",
    where: "github.com/microsoft/working-with-ai",
    href: "https://github.com/microsoft/working-with-ai",
    what: "An AI applicability score for 785 US occupations, built from how Bing Copilot was used in the US from January to September 2024. The authors say it must not be read as a measure of AI replacing jobs.",
    usedFor: "The exposure score in M2, M3 and M4. Weighted by pay, it sets the default for the share of work AI can do in M4 (about 18%).",
    modules: "M2, M3, M4",
    licence: "CC BY 4.0",
    cite: "Tomlinson, Jaffe, Wang, Counts and Suri, “Working with AI: Measuring the Applicability of Generative AI to Occupations”, NeurIPS 2026 (arXiv:2507.07935).",
    status: "used",
    feeds: ["occupations.csv (ms_applicability)", "m2_*.csv", "m3_category_exposure.csv", "m3_event_study_*.csv"],
  },
  {
    id: "indeed-ai",
    name: "Indeed Hiring Lab, AI tracker",
    publisher: "Indeed Hiring Lab",
    where: "github.com/hiring-lab/ai-tracker",
    href: "https://github.com/hiring-lab/ai-tracker",
    what: "The daily share of job postings that mention AI keywords (seven-day trailing average). 25,749 rows, nine countries (not India), January 2019 to October 2026.",
    usedFor: "The long adoption series in M3.",
    modules: "M3",
    licence: "CC-BY-4.0. Indeed asks that Hiring Lab is cited as the source.",
    cite: "Source: Indeed Hiring Lab (github.com/hiring-lab/ai-tracker). Licensed under CC BY 4.0.",
    status: "used",
    feeds: ["m3_indeed_ai_share_monthly.csv", "m3_indeed_ai_share_summary.csv"],
  },
  {
    id: "indeed-postings",
    name: "Indeed Hiring Lab, job postings tracker",
    publisher: "Indeed Hiring Lab",
    where: "github.com/hiring-lab/job_postings_tracker",
    href: "https://github.com/hiring-lab/job_postings_tracker",
    what: "An index of seasonally adjusted job postings relative to 1 February 2020: totals for 11 country or area files, and by occupational sector for six countries (US, Canada, UK, Australia, Germany, France). No India. Regional and metro files were not downloaded.",
    usedFor: "The hiring side of M3: postings by sector, and the comparison of high-exposure and low-exposure sectors around the dates adoption speeds up.",
    modules: "M3",
    licence: "CC-BY-4.0. Indeed asks that Hiring Lab is cited as the source.",
    cite: "Source: Indeed Hiring Lab (github.com/hiring-lab/job_postings_tracker). Licensed under CC BY 4.0.",
    status: "used",
    feeds: ["m3_indeed_aggregate_monthly.csv", "m3_indeed_sector_monthly.csv", "m3_category_exposure.csv", "m3_event_study_*.csv"],
  },
  {
    id: "btos",
    name: "US Census Bureau, Business Trends and Outlook Survey (BTOS)",
    publisher: "US Census Bureau",
    where: "census.gov/hfp/btos",
    href: "https://www.census.gov/hfp/btos",
    what: "A fortnightly survey of US businesses: seven Excel files (national, sector, subsector, employment size, state and top 25 metro areas, plus URR, which holds response rates and is not used), 82 periods since 2023. AI questions: firm uses AI (26 periods, late 2025 to October 2026; 25.0% yes in the latest), employees use generative AI (2 periods), effect on headcount and on hiring (2 periods only), expected use. The survey words AI as “Super Intelligence or SI (formerly referred to as Artificial Intelligence or AI)”.",
    usedFor: "Firm adoption by sector, size, state and metro area (M3).",
    modules: "M3",
    licence: "US government data",
    cite: "Source: U.S. Census Bureau, Business Trends and Outlook Survey.",
    status: "used",
    feeds: ["m3_btos_*.csv"],
  },
  {
    id: "epoch-benchmarks",
    name: "Epoch AI, benchmarks and the Epoch Capabilities Index",
    publisher: "Epoch AI",
    where: "epoch.ai/data",
    href: "https://epoch.ai/data",
    what: "benchmark_data.zip: about 90 benchmark files, the Epoch Capabilities Index (ECI) with confidence intervals for 258 models, metadata for 1,276 models, and external METR time-horizon and GDPval files.",
    usedFor: "The capability score that M1 holds fixed when it compares prices. The METR and GDPval files were planned as anchors for M4 and are not used so far.",
    modules: "M1",
    licence: "CC BY",
    cite: EPOCH_CITE,
    status: "used",
    feeds: ["m1_models.csv", "m1_price_of_capability.csv", "m1_price_decline_fits.csv", "m1_hedonic_index.csv"],
  },
  {
    id: "epoch-models",
    name: "Epoch AI, AI models",
    publisher: "Epoch AI",
    where: "epoch.ai/data",
    href: "https://epoch.ai/data",
    what: "ai_models.zip: 3,730 models with training compute. Also downloaded with the Epoch files: a chat statistics workbook and a polling file on AI use (October 2026).",
    usedFor: "Not used so far.",
    modules: "none yet",
    licence: "CC BY",
    cite: EPOCH_CITE,
    status: "downloaded",
    feeds: [],
  },
  {
    id: "epoch-companies",
    name: "Epoch AI, AI companies",
    publisher: "Epoch AI",
    where: "epoch.ai/data",
    href: "https://epoch.ai/data",
    what: "ai_companies.zip: funding, revenue, staff, usage and compute-spend reports. The revenue reports have numbers for only nine companies (mostly Anthropic and OpenAI), with large gaps.",
    usedFor: "Reported revenue levels in M5. They are too thin to compute revenue concentration, so concentration is measured from OpenRouter tokens instead.",
    modules: "M5",
    licence: "CC BY",
    cite: EPOCH_CITE,
    status: "levels",
    feeds: ["m5_epoch_revenue.csv"],
  },
  {
    id: "epoch-chips",
    name: "Epoch AI, AI chip sales",
    publisher: "Epoch AI",
    where: "epoch.ai/data",
    href: "https://epoch.ai/data",
    what: "ai_chip_sales.zip: quarterly AI chip shipments by designer, in H100 equivalents, with power and spending, and chip price by release date.",
    usedFor: "The stock of AI compute (cumulative shipments, an upper bound because no chips are retired), its doubling time and the trend in chip cost (M6).",
    modules: "M6",
    licence: "CC BY",
    cite: "Epoch AI, Data on AI chip sales (epoch.ai)",
    status: "used",
    feeds: ["m6_compute_stock.csv", "m6_compute_growth.csv", "m6_parameters.csv"],
  },
  {
    id: "epoch-datacentres",
    name: "Epoch AI, data centres",
    publisher: "Epoch AI",
    where: "epoch.ai/data",
    href: "https://epoch.ai/data",
    what: "data_centers.zip: the data-centre sites Epoch tracks, with power, chip capacity and capital cost by quarter.",
    usedFor: "The starting income share of AI hardware in M6: the capital cost of US sites relative to GDP.",
    modules: "M6",
    licence: "CC BY",
    cite: "Epoch AI, Data on AI data centers (epoch.ai)",
    status: "used",
    feeds: ["m6_datacenter_capacity.csv", "m6_parameters.csv"],
  },
  {
    id: "openrouter-rankings",
    name: "OpenRouter rankings (daily token usage)",
    publisher: "OpenRouter",
    where: "openrouter.ai/rankings",
    href: "https://openrouter.ai/rankings",
    what: "Daily token totals for the top 50 public models plus an “other” row: 35,088 rows, 688 days from 2025-01-01 to 2026-11-21. Two days are missing from the source (2025-06-15 and 2025-07-15). Tokens are prompt plus completion tokens as each provider counts them. The top 50 make up about 94% of tokens. Covers OpenRouter's own users only.",
    usedFor: "Usage volume against price (M1), and market shares and concentration (M5).",
    modules: "M1, M5",
    licence: "CC BY 4.0, with citation",
    cite: "Source: OpenRouter (openrouter.ai/rankings), as of 2026-11-22. Licensed under CC BY 4.0.",
    status: "used",
    feeds: ["m1_model_month_volume.csv", "m1_volume_monthly.csv", "m1_elasticity.csv", "m5_firm_month_shares.csv", "m5_concentration_monthly.csv", "m5_hhi_daily.csv", "m5_cournot_by_month.csv"],
  },
  {
    id: "openrouter-models",
    name: "OpenRouter models API",
    publisher: "OpenRouter",
    where: "openrouter.ai/api/v1/models",
    href: "https://openrouter.ai/api/v1/models",
    what: "Today's list prices and metadata for 476 models (one snapshot, dated in data/manifest.json).",
    usedFor: "Planned as a check on current prices in M1. No processed table reads it yet; M1 prices come from the LiteLLM history.",
    modules: "none yet",
    licence: "OpenRouter terms",
    status: "downloaded",
    feeds: [],
  },
  {
    id: "litellm",
    name: "LiteLLM price history",
    publisher: "BerriAI (LiteLLM maintainers)",
    where: "github.com/BerriAI/litellm",
    href: "https://github.com/BerriAI/litellm",
    what: "39 month-end snapshots (September 2023 to November 2026) of the model_prices_and_context_window.json file, taken from the git history. These are list prices as recorded by the maintainers, not the date a price changed. 212 of Epoch's 258 scored models are matched to a price. Spot-checked against OpenAI's pricing page in the Wayback Machine for two dates in 2024: GPT-4, GPT-4 Turbo and GPT-4o mini match exactly. Other providers could not be checked.",
    usedFor: "The list price of each model each month (M1), and the number of hosts and the price spread for each model (M5).",
    modules: "M1, M5",
    licence: "Unclear: the repository's licence is listed as NOASSERTION. We use it as a record of list prices and publish only derived tables.",
    cite: "BerriAI/litellm, model_prices_and_context_window.json (month-end snapshots from the git history).",
    status: "used",
    feeds: ["m1_models.csv", "m1_model_prices.csv", "m1_price_of_capability.csv", "m1_price_crosscheck.csv", "m5_host_prices.csv", "m5_host_competition.csv"],
  },
  {
    id: "onet",
    name: "O*NET 29.0 and 31.0",
    publisher: "US Department of Labor, Employment and Training Administration",
    where: "onetcenter.org/database.html",
    href: "https://www.onetcenter.org/database.html",
    what: "The occupation database: 1,016 occupations, 18,796 tasks and the links from tasks to work activities. Version 31.0 is current; 29.0 is kept to compare with the Economic Index.",
    usedFor: "Work activities and job zones in M2; the task structure behind the occupation view.",
    modules: "M2, M4",
    licence: "CC BY 4.0",
    cite: "O*NET 31.0 and 29.0 Databases by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. We have joined and aggregated the data; USDOL/ETA has not approved or endorsed these changes.",
    status: "used",
    feeds: ["m2_*.csv"],
  },
  {
    id: "bls-oews",
    name: "BLS Occupational Employment and Wage Statistics, May 2025",
    publisher: "US Bureau of Labor Statistics",
    where: "bls.gov/oes",
    href: "https://www.bls.gov/oes/",
    what: "Employment and mean and median wages for 830 detailed US occupations (national estimates). Five occupations have a suppressed mean annual wage. 783 occupations match the Microsoft scores. Downloaded in a browser because BLS blocks scripts.",
    usedFor: "Pay and employment weights in M2 and M4: the wage bill, and the average hourly wage in the M4 token calculator.",
    modules: "M2, M4",
    licence: "US government data",
    cite: "Source: U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2025.",
    status: "used",
    feeds: ["occupations.csv"],
  },
  {
    id: "bls-crosswalk",
    name: "BLS ISCO to SOC crosswalk",
    publisher: "US Bureau of Labor Statistics",
    where: "bls.gov",
    href: "https://www.bls.gov/",
    what: "A table linking international occupation codes (ISCO) to US occupation codes (SOC).",
    usedFor: "Planned for the India lens, stage B. Not obtained: it needs a browser download.",
    modules: "none",
    licence: "US government data",
    status: "notobtained",
    feeds: [],
    reason: "Needs a browser download that has not been done, and is only needed for the India stage that depends on PLFS microdata.",
  },
  {
    id: "worldbank",
    name: "World Bank, World Development Indicators",
    publisher: "World Bank",
    where: "data.worldbank.org",
    href: "https://data.worldbank.org/",
    what: "For every country: GDP per capita (PPP), internet users, tertiary enrolment, employment in services and in agriculture, working-age share and population. For the USA, India, China and the world: growth, saving, investment, consumption, tax revenue, population, labour force and the real interest rate.",
    usedFor: "Income and other covariates in the India lens; macro calibration of the growth model (M6).",
    modules: "M6, India",
    licence: "CC BY 4.0 (the World Bank's default for its datasets). Indicators that come from other organisations keep their own terms, listed in each indicator's metadata.",
    cite: "Source: World Bank, World Development Indicators (CC BY 4.0)",
    status: "used",
    feeds: ["india_a_country_data.csv", "m6_macro_calibration.csv", "m6_parameters.csv"],
  },
  {
    id: "pwt",
    name: "Penn World Table 11.0",
    publisher: "Groningen Growth and Development Centre, University of Groningen",
    where: "rug.nl/ggdc/productivity/pwt",
    href: "https://www.rug.nl/ggdc/productivity/pwt/",
    what: "National accounts for many countries and years, including the labour share of GDP, the capital stock, depreciation and productivity. India's series is partly imputed.",
    usedFor: "The labour share and the calibration of the growth model (M6).",
    modules: "M6",
    licence: "CC BY 4.0, as recorded in the DataverseNL record (doi 10.34894/FABVLR)",
    cite: "Feenstra, Inklaar and Timmer (2015), “The Next Generation of the Penn World Table”, American Economic Review 105(10), 3150-3182. Data: PWT 11.0.",
    status: "used",
    feeds: ["m6_labour_share.csv", "m6_macro_calibration.csv", "m6_parameters.csv"],
  },
  {
    id: "ilostat",
    name: "ILOSTAT, labour income share as a percent of GDP",
    publisher: "International Labour Organization",
    where: "ilostat.ilo.org",
    href: "https://ilostat.ilo.org/",
    what: "ILO modelled estimates, November 2025, for the USA, India, China and the ILO world and income-group aggregates.",
    usedFor: "A second labour-share series for M6. It differs in level from the Penn World Table series, most for India (53% against 61% in 2023).",
    modules: "M6",
    licence: "CC BY 4.0 (ILO datasets since 3 May 2023)",
    cite: "ILOSTAT, Labour income share as a percent of GDP, ILO modelled estimates, Nov. 2025. Licensed under CC BY 4.0.",
    status: "used",
    feeds: ["m6_labour_share.csv"],
  },
  {
    id: "fred",
    name: "US macro series from BLS, BEA and the Federal Reserve, through FRED",
    publisher: "US Bureau of Labor Statistics, Bureau of Economic Analysis, Federal Reserve",
    where: "fred.stlouisfed.org",
    href: "https://fred.stlouisfed.org/",
    what: "The US nonfarm business labour share (BLS), compensation as a share of gross domestic income and the personal saving rate (BEA), wealth shares of the top 1% and 0.1% and shares of corporate equities held by the top 1% and the 90th to 99th percentiles (Federal Reserve), and the 10-year TIPS yield.",
    usedFor: "A US labour-share series, and the spending and ownership assumptions behind the demand and policy model (M6).",
    modules: "M6",
    licence: "US government statistics",
    cite: "Source: U.S. Bureau of Labor Statistics, U.S. Bureau of Economic Analysis and Board of Governors of the Federal Reserve System, via FRED, Federal Reserve Bank of St. Louis.",
    status: "used",
    feeds: ["m6_labour_share.csv", "m6_parameters.csv"],
  },
  {
    id: "india-published",
    name: "Published exposure studies for India (figures read by hand)",
    publisher: "IMF; ILO; ICRIER; news reports of other studies",
    where: "IMF SDN/2024/001",
    href: "https://www.imf.org/-/media/files/publications/sdn/2024/english/sdnea2024001.pdf",
    what: "Figures read from IMF Staff Discussion Note SDN/2024/001 (Cazzaniga and others), ILO Working Paper 140 (Gmyrek and others) and an ICRIER survey of 651 IT firms (Mishra and others, February 2026). Each figure is stored with its source, link, place in the source and a verified flag. Figures that come from news reports of a NITI Aayog roadmap and of a Great Lakes Institute paper are marked as not verified against the original.",
    usedFor: "Context for the India page: what published studies say about exposure in India and in other income groups.",
    modules: "India",
    licence: "Published figures, quoted with attribution. See each publisher's terms.",
    status: "used",
    feeds: ["india_a_benchmarks.csv"],
  },
  {
    id: "imf-index",
    name: "IMF AI Preparedness Index",
    publisher: "International Monetary Fund",
    where: "imf.org (DataMapper)",
    href: "https://www.imf.org/external/datamapper/",
    what: "A country index of readiness for AI.",
    usedFor: "Not used.",
    modules: "none",
    licence: "IMF terms",
    status: "notobtained",
    feeds: [],
    reason: "The data interface was rate-limited and then returned “not found”, so the data could not be checked.",
  },
  {
    id: "ilo-genai",
    name: "ILO refined generative AI exposure index (data)",
    publisher: "International Labour Organization",
    where: "ilo.org",
    href: "https://www.ilo.org/",
    what: "Exposure scores by occupation. Only the published headline figures are quoted, in the India benchmarks above.",
    usedFor: "Not used as data.",
    modules: "none",
    licence: "ILO terms",
    status: "notobtained",
    feeds: [],
    reason: "No data link was found, so only published figures are quoted.",
  },
  {
    id: "plfs",
    name: "India Periodic Labour Force Survey (PLFS) microdata",
    publisher: "Ministry of Statistics and Programme Implementation, Government of India",
    where: "microdata.gov.in",
    href: "https://microdata.gov.in/",
    what: "Household microdata with occupation (3-digit NCO), industry, sex, age, education, contract type and earnings. Only the data layout file has been downloaded; the microdata has not.",
    usedFor: "Not used. It would allow India's occupations to be mapped to exposure scores in stage B of the India lens.",
    modules: "none",
    licence: "Government of India data-access agreement: non-commercial use, no sharing of unit-level data, cite the source, send MoSPI a copy of publications",
    status: "notused",
    feeds: [],
    reason: "Access needs a free account and a signed data-access agreement, which has not been done. The terms also bar sharing the unit-level files, so they could never be placed in this public repository.",
  },
  {
    id: "aa",
    name: "Artificial Analysis",
    publisher: "Artificial Analysis",
    where: "artificialanalysis.ai",
    href: "https://artificialanalysis.ai/",
    what: "Prices, speed and quality scores for AI models.",
    usedFor: "Not used.",
    modules: "none",
    licence: "The free API is for internal use only. The terms bar redistribution and public display.",
    status: "excluded",
    feeds: [],
    reason: "Licence: its terms do not allow redistribution or public display, so its data cannot appear on a public site.",
  },
];

const LIMITS_MAIN: { lead: string; text: string }[] = [
  {
    lead: "Each usage dataset covers one platform.",
    text: "Microsoft's scores come from Bing Copilot in the US from January to September 2024. The Anthropic Economic Index comes from Claude.ai in April and May 2026. Neither describes all AI use, and the people who use one platform are not a random sample.",
  },
  {
    lead: "Exposure scores are not job-loss forecasts.",
    text: "A high score means AI is used or applicable for the tasks in an occupation. It does not say that jobs will go, and the publishers of the Microsoft scores say the same.",
  },
  {
    lead: "Prices are list prices.",
    text: "M1 uses the list prices recorded in LiteLLM's price file at the end of each month, not what customers paid. Discounts, caching and batch prices are not captured. Only OpenAI's prices could be checked against archived pricing pages; the others rest on LiteLLM alone.",
  },
  {
    lead: "OpenRouter's users are not the whole market.",
    text: "The rankings cover developers and apps that route through OpenRouter, and only the top 50 models each day. Token counts follow each provider's own tokenizer, so they are not strictly comparable. Tokens are not revenue.",
  },
  {
    lead: "The models are scenarios.",
    text: "M4 and M6 are small, simplified models with assumed parameters. They show what follows from stated assumptions. They are not forecasts, and the site says so wherever it shows a result.",
  },
  {
    lead: "The BTOS survey uses its own wording for AI.",
    text: "In the Census files the question is worded “Super Intelligence or SI (formerly referred to as Artificial Intelligence or AI)”. The question on firm AI use has 26 fortnightly periods (late 2025 to October 2026). The questions on headcount and hiring have only two periods, so they are a snapshot, not a trend. Earlier wording is not in these files.",
  },
];

const LIMITS_MORE: string[] = [
  "The Economic Index has only two monthly windows, so it is used as a cross-section. Change over time comes from M3. Its shares are rounded to 0.01 of a percentage point and come without sampling intervals; an empty cell means not published, not zero.",
  "The Economic Index labels occupations by classifying conversations, and some rank unexpectedly high (for example librarians and counter clerks). Occupation-level results carry that caveat. The usage ratio compares worldwide usage with US employment, so it is descriptive.",
  "The M1 elasticity of usage with respect to price is imprecise (about -0.47, 95% interval -1.03 to +0.09). Growth in spending fits Jevons-type behaviour, but new users and new uses drive it too, so it is not proof.",
  "The M5 host-price and event-study results are associations, not proven causes. Concentration is measured over OpenRouter's top 50 models, and revenue concentration is not computed because Epoch's revenue data is too thin.",
  "In M6 the compute stock counts chips shipped, with no retirements, so it is an upper bound on installed compute. The Penn World Table and ILO labour shares differ in level because they are built differently, and India's Penn World Table series is partly imputed.",
  "Indeed's trackers do not cover India. The India page uses published data only: the PLFS microdata has not been obtained.",
  "US wages and employment (BLS, May 2025) are applied to occupations whose usage is measured worldwide. India's wages are not modelled.",
];

type Method = { id: string; data: string; steps: string; checks: string; where: string };

const METHODS: Method[] = [
  {
    id: "M1",
    data: "Epoch's capability index (ECI), 39 month-end snapshots of LiteLLM list prices, and OpenRouter daily token counts.",
    steps:
      "Match each Epoch-scored model to a price entry (212 of 258 matched, listed in m1_models.csv). For each capability threshold and month, take the cheapest price of any model at or above it, where the blended price is three parts input to one part output. Fit a log-linear trend to get a halving time. Build a quality-adjusted index from a regression of log price on the capability score, an open-weights flag and month dummies. Estimate how usage responds to price with a panel regression using model and month fixed effects.",
    checks: "Prices are spot-checked against OpenAI's archived pricing pages for two dates (m1_price_crosscheck.csv). The elasticity is imprecise, so spending growth is consistent with Jevons behaviour but does not prove it.",
    where: "build_m1_prices.py, build_m1_volume.py; tables m1_*.csv",
  },
  {
    id: "M2",
    data: "Microsoft applicability scores, Anthropic Economic Index occupation shares, O*NET, and BLS employment and wages.",
    steps:
      "Join everything at the 6-digit SOC occupation in one table (occupations.csv). Compare the measures with rank correlations (Spearman and Kendall, plain and weighted by employment, with bootstrap 95% intervals). List the occupations where the measures disagree most, and run regressions with robust standard errors.",
    checks: "Each source covers one platform and one period. Missing Economic Index cells are unpublished, not zero. The two measures agree only moderately (a Spearman rank correlation of about 0.45).",
    where: "build_occupations.py, build_m2.py; tables occupations.csv and m2_*.csv",
  },
  {
    id: "M3",
    data: "Census BTOS (firm AI use by sector, size, state and metro area), the Indeed AI tracker and the Indeed job postings tracker.",
    steps:
      "Build adoption curves from BTOS and from Indeed's AI share of postings, and compare adoption across sectors, states and firm sizes. Map occupations to Indeed's job categories to score how exposed each category is (Microsoft score; the Economic Index by rank). Then run an event study that is also a difference-in-differences: postings in the most exposed third of categories against the least exposed third, before and after ChatGPT's launch on 30 November 2022, with a permutation test (10,000 shuffles, fixed seed).",
    checks:
      "The BTOS AI-use series is one year long and its wording changed. The gap in postings began to open before the launch, and interest rates and tech layoffs hit the same categories, so the data do not show that generative AI caused it. The link from occupations to job categories is a documented judgement. See docs/findings-m3.md.",
    where: "build_m3.py; tables m3_*.csv",
  },
  {
    id: "M4",
    data: "BLS employment and wages, the Microsoft applicability score for the share of work AI can do, and the M1 price of capability for the token calculator.",
    steps:
      "A task-based model with a constant-elasticity aggregator. Tasks run from those people do best relative to AI to those AI does best. Each task goes to the cheaper option, and the wage adjusts until one unit of labour is employed. Compute scarcity raises the AI price as more tasks move to AI. A demand block gives the spending shortfall and an optional basic income. The model runs in the browser.",
    checks: "Defaults: 18% of work AI can do (the pay-weighted Microsoft score) and an all-in AI price of 30% of the wage, which is an assumption. There is one kind of worker and one wage. See docs/model-m4.md.",
    where: "web/src/models/m4.ts; docs/model-m4.md",
  },
  {
    id: "M5",
    data: "OpenRouter daily token shares, Epoch company revenue (levels only), and host prices from the LiteLLM snapshots.",
    steps:
      "Map each model author to its parent firm and leave out anonymous pre-release models. Compute the Herfindahl–Hirschman index (HHI) from the top 50 models' tokens, with bounds for tokens outside the top 50. The Cournot-implied markup is the HHI divided by the demand elasticity, for elasticities of 1 to 5. As a Bertrand-style test, regress a model's lowest list price on the log number of hosts, with model and month fixed effects.",
    checks: "Shares cover OpenRouter's users only. The host results are associations. Two days are missing from the source.",
    where: "build_m5.py; tables m5_*.csv",
  },
  {
    id: "M6",
    data: "Epoch chip sales and data centres, Penn World Table 11.0, ILOSTAT, FRED series and World Bank indicators.",
    steps:
      "Three small models. (A) Solow growth with a CES function between labour and AI compute. (B) An ideas-production variant in which AI does part of the research. (C) A distribution, demand and policy model in which an automation tax funds a basic income. The calibration script writes every parameter with its source and says whether it is data, derived or an assumption (m6_parameters.csv). A Python reference version checks the TypeScript.",
    checks: "Compute stock is an upper bound. The compute path is set by the reader and the tax does not slow it. The policy model is a one-year snapshot with a first-round demand gap and no multiplier. India's AI income share and spending behaviour are assumptions. Results are scenarios, not forecasts. See docs/model-m6.md and docs/findings-m6.md.",
    where: "build_m6.py, m6_reference.py; tables m6_*.csv",
  },
];

const FETCH_README = `python3 -I pipeline/fetch.py all
python3 -I pipeline/fetch_litellm_history.py
python3 -I pipeline/fetch_openrouter_rankings.py`;

const FETCH_OTHER = `python3 -I pipeline/fetch_indeed.py
python3 -I pipeline/fetch_pwt.py
python3 -I pipeline/fetch_worldbank.py`;

const BUILD = `uv sync
uv run python pipeline/build_occupations.py
uv run python pipeline/build_m1_prices.py
uv run python pipeline/build_m1_volume.py
uv run python pipeline/build_m2.py
uv run python pipeline/build_m3.py
uv run python pipeline/build_m5.py
uv run python pipeline/build_m6.py
uv run python pipeline/build_india_a.py
uv run python pipeline/export_web_data.py`;

const SITE = `cd web
npm install
npm run dev`;

const REPO = "https://github.com/amsorrytola/why-pay-anyone";
const LINKS: { label: string; href: string; note: string }[] = [
  { label: "The repository", href: REPO, note: "code, processed tables and documents" },
  { label: "Research plan", href: `${REPO}/blob/main/docs/research-plan.md`, note: "the question, each module's data, method and drop rule" },
  { label: "Data registry", href: `${REPO}/blob/main/data/SOURCES.md`, note: "every source, its licence and what its files contain" },
  { label: "Processed tables", href: `${REPO}/blob/main/data/processed/README.md`, note: "what each table in data/processed/ holds" },
  { label: "The M4 model", href: `${REPO}/blob/main/docs/model-m4.md`, note: "equations, closed forms and what the model leaves out" },
  { label: "The M6 model", href: `${REPO}/blob/main/docs/model-m6.md`, note: "equations, calibration and limits of the three macro models" },
  { label: "M2 findings", href: `${REPO}/blob/main/docs/findings-m2.md`, note: "how the exposure measures compare" },
  { label: "M3 findings", href: `${REPO}/blob/main/docs/findings-m3.md`, note: "adoption and the event study, written up" },
  { label: "M6 findings", href: `${REPO}/blob/main/docs/findings-m6.md`, note: "the macro and policy results, written up" },
  { label: "India findings", href: `${REPO}/blob/main/docs/findings-india-a.md`, note: "the India lens, stage A" },
  { label: "Pipeline scripts", href: `${REPO}/tree/main/pipeline`, note: "fetch and build scripts" },
  { label: "README", href: `${REPO}/blob/main/README.md`, note: "setup and the principles" },
];

/* ====================================================================================================
   Small pieces
   ==================================================================================================== */

function StatusPill({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`ui inline-block rounded-full border border-rule px-2.5 py-0.5 text-[0.78rem] leading-snug text-ink ${s.bg}`}>{s.label}</span>;
}

function FeedList({ feeds }: { feeds: string[] }) {
  if (feeds.length === 0) return <p className="ui text-[0.85rem] text-ink-faint">No table yet</p>;
  return (
    <ul className="space-y-1">
      {feeds.map((f) => (
        <li key={f} className="font-mono text-[0.76rem] leading-snug [overflow-wrap:anywhere]">
          {f.split("_").map((part, i, all) => (
            <Fragment key={i}>
              {part}
              {i < all.length - 1 && (
                <>
                  _<wbr />
                </>
              )}
            </Fragment>
          ))}
        </li>
      ))}
    </ul>
  );
}

function Cite({ text }: { text: string }) {
  return (
    <p className="mt-2 border-l-[3px] border-rule pl-2.5 text-[0.82rem] leading-snug">
      <span className="ui font-semibold">Cite as: </span>
      <span>{text}</span>
    </p>
  );
}

function Code({ label, children }: { label: string; children: string }) {
  return (
    <pre tabIndex={0} aria-label={label} className="overflow-x-auto rounded-[6px] bg-ink px-4 py-3 font-mono text-[0.84rem] leading-relaxed text-paper">
      <code>{children}</code>
    </pre>
  );
}

function SourceName({ s }: { s: Source }) {
  return (
    <>
      <div className="ui text-[0.95rem] font-bold leading-snug">{s.name}</div>
      <div className="ui mt-1 text-[0.8rem] text-ink-soft">{s.publisher}</div>
      <a href={s.href} rel="noreferrer" className="ui mt-0.5 inline-block text-[0.8rem] [overflow-wrap:anywhere]">
        {s.where}
      </a>
    </>
  );
}

function SourceText({ s }: { s: Source }) {
  return (
    <>
      <p className="text-[0.86rem] leading-snug">{s.what}</p>
      <p className="mt-2 text-[0.86rem] leading-snug">
        <span className="ui font-semibold">Used for: </span>
        {s.usedFor}
      </p>
      <p className="ui mt-1 text-[0.78rem] text-ink-soft">Modules: {s.modules}</p>
    </>
  );
}

function LicenceText({ s }: { s: Source }) {
  return (
    <>
      <p className="text-[0.86rem] leading-snug">{s.licence}</p>
      {s.cite && <Cite text={s.cite} />}
    </>
  );
}

/* ====================================================================================================
   Page
   ==================================================================================================== */

export default function DataPage() {
  const used = SOURCES.filter((s) => s.status === "used" || s.status === "levels").length;
  const waiting = SOURCES.filter((s) => s.status === "downloaded").length;
  const out = SOURCES.filter((s) => s.status === "excluded" || s.status === "notobtained" || s.status === "notused");
  return (
    <>
      <PageHead
        title="Data and method"
        question="Where every number on this site comes from, how it was turned into what you see, and what it cannot tell you. Written so that you can check our work."
      />

      <Section>
        <Takeaway title="How to check a number">
          <p>
            Every number on the site can be traced to a script in <span className="font-mono text-[0.9em]">pipeline/</span> and a table in{" "}
            <span className="font-mono text-[0.9em]">data/processed/</span>. Each module page names the tables it reads. The raw files are not in the repository. The fetch scripts download them again, and{" "}
            <span className="font-mono text-[0.9em]">data/manifest.json</span> records the address, size, checksum (SHA-256) and time of each download.
          </p>
          <p>
            This page lists {SOURCES.length} sources. {used} feed at least one table, {waiting} were downloaded but are not used yet, and {out.length} were left out or not obtained. Licences are as stated on each
            source&apos;s page. They are not legal advice.
          </p>
        </Takeaway>
      </Section>

      <Section>
        <h2 className="mb-3">Data sources</h2>
        <p className="mb-5 text-[1rem] text-ink-soft">
          One row for each source. Where a publisher asks for a particular citation, it is printed under the licence exactly as it should appear. The registry in the repository (data/SOURCES.md) has the
          longer notes.
        </p>

        {/* Wide screens: a table. */}
        <div className="hidden lg:block">
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">Data sources: what each is, what we used it for, its licence and citation, its status and the tables it feeds</caption>
            <colgroup>
              <col style={{ width: "18%" }} />
              <col style={{ width: "31%" }} />
              <col style={{ width: "21%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr className="ui border-b-2 border-ink text-[0.82rem]">
                <th scope="col" className="px-3 py-2 font-semibold">
                  Source and publisher
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  What it is, and what we used it for
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Licence and citation
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Tables it feeds
                </th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.id} id={`src-${s.id}`} className="scroll-mt-24 border-b border-rule align-top">
                  <th scope="row" className="px-3 py-3 text-left font-normal">
                    <SourceName s={s} />
                  </th>
                  <td className="px-3 py-3">
                    <SourceText s={s} />
                  </td>
                  <td className="px-3 py-3">
                    <LicenceText s={s} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={s.status} />
                  </td>
                  <td className="px-3 py-3">
                    <FeedList feeds={s.feeds} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Narrow screens: one card for each source. */}
        <ul className="space-y-4 lg:hidden">
          {SOURCES.map((s) => (
            <li key={s.id} className="rounded-[6px] border border-rule bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <SourceName s={s} />
                </div>
                <StatusPill status={s.status} />
              </div>
              <div className="mt-3">
                <SourceText s={s} />
              </div>
              <div className="mt-3 border-t border-rule pt-3">
                <h3 className="ui mb-1 text-[0.8rem] text-ink-soft">Licence and citation</h3>
                <LicenceText s={s} />
              </div>
              <div className="mt-3 border-t border-rule pt-3">
                <h3 className="ui mb-1 text-[0.8rem] text-ink-soft">Tables it feeds</h3>
                <FeedList feeds={s.feeds} />
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <h2 className="mb-3">Sources we left out, and why</h2>
        <p className="mb-4 text-[1rem] text-ink-soft">A source is left out when its licence does not allow public display, when it could not be obtained, or when it was too thin to use. Nothing here is filled in by guesswork.</p>
        <ul className="max-w-[72ch] space-y-3">
          {out.map((s) => (
            <li key={s.id} className="border-l-[3px] border-rule pl-3">
              <p className="ui text-[0.98rem]">
                <strong>{s.name}</strong> <StatusPill status={s.status} />
              </p>
              <p className="mt-1 text-[1rem] leading-snug">{s.reason}</p>
            </li>
          ))}
          <li className="border-l-[3px] border-rule pl-3">
            <p className="ui text-[0.98rem]">
              <strong>Other price-history repositories</strong>
            </p>
            <p className="mt-1 text-[1rem] leading-snug">Other public repositories of AI price history show no licence, so only the LiteLLM history is used.</p>
          </li>
          <li className="border-l-[3px] border-rule pl-3">
            <p className="ui text-[0.98rem]">
              <strong>Revenue-based market concentration</strong>
            </p>
            <p className="mt-1 text-[1rem] leading-snug">Epoch&apos;s revenue reports cover nine companies with large gaps, so concentration is measured from OpenRouter tokens, not revenue.</p>
          </li>
        </ul>
      </Section>

      <Section>
        <h2 className="mb-3">What the data cannot tell you</h2>
        <p className="mb-4 text-[1rem] text-ink-soft">The six limits that matter most, then the more specific ones.</p>
        <ol className="max-w-[72ch] list-decimal space-y-3 pl-6 marker:font-semibold">
          {LIMITS_MAIN.map((l) => (
            <li key={l.lead} className="pl-1">
              <strong>{l.lead}</strong> {l.text}
            </li>
          ))}
        </ol>
        <h3 className="mb-2 mt-8">More specific limits</h3>
        <ul className="max-w-[72ch] list-disc space-y-2 pl-6">
          {LIMITS_MORE.map((t) => (
            <li key={t} className="pl-1">
              {t}
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <h2 className="mb-3">Method, module by module</h2>
        <p className="mb-5 text-[1rem] text-ink-soft">Each section says what goes in, what is done to it and what to be careful about. The module page shows the result.</p>
        <div className="grid gap-5 md:grid-cols-2">
          {METHODS.map((m) => {
            const mod = MODULES.find((x) => x.id === m.id);
            if (!mod) return null;
            return (
              <article key={m.id} className="rounded-[6px] border border-rule bg-surface p-4 sm:p-5">
                <p className="ui text-[0.9rem] font-semibold text-ai-deep">Module {mod.id}</p>
                <h3 className="mt-1">{mod.name}</h3>
                <p className="mt-2 text-[1rem] leading-snug text-ink-soft">{mod.question}</p>
                <dl className="mt-4 space-y-3 text-[0.98rem] leading-snug">
                  <div>
                    <dt className="ui text-[0.85rem] font-semibold">Data</dt>
                    <dd>{m.data}</dd>
                  </div>
                  <div>
                    <dt className="ui text-[0.85rem] font-semibold">Method</dt>
                    <dd>{m.steps}</dd>
                  </div>
                  <div>
                    <dt className="ui text-[0.85rem] font-semibold">Check and limits</dt>
                    <dd>{m.checks}</dd>
                  </div>
                  <div>
                    <dt className="ui text-[0.85rem] font-semibold">Code and tables</dt>
                    <dd className="font-mono text-[0.8rem] [overflow-wrap:anywhere]">{m.where}</dd>
                  </div>
                </dl>
                <p className="ui mt-4 text-[0.95rem]">
                  <Link href={mod.route}>Open the {mod.id} page</Link>
                </p>
              </article>
            );
          })}
        </div>
        <div className="mt-5">
          <Caveat title="India lens">
            <p>
              Stage A uses published data only. It compares Claude.ai usage per capita across countries with income (World Bank), also allowing for internet use and the share of jobs in services, measures India&apos;s gap from the fitted line and from peer countries, compares India&apos;s
              occupation mix with the world&apos;s, and sets published exposure figures beside these. See docs/findings-india-a.md. Stage B would use PLFS microdata and has not been done (see the sources above).{" "}
              <Link href="/india">Open the India page</Link>.
            </p>
          </Caveat>
        </div>
      </Section>

      <Section>
        <h2 className="mb-3">How to reproduce</h2>
        <div className="max-w-[78ch] space-y-4">
          <p>
            Install <a href="https://docs.astral.sh/uv/">uv</a>, then run <span className="font-mono text-[0.9em]">uv sync</span>. It builds the Python environment from{" "}
            <span className="font-mono text-[0.9em]">pyproject.toml</span> and <span className="font-mono text-[0.9em]">uv.lock</span>. Secrets go in <span className="font-mono text-[0.9em]">.env</span> (see{" "}
            <span className="font-mono text-[0.9em]">.env.example</span>), which is never committed.
          </p>
          <div>
            <h3 className="mb-2 text-[1.05rem]">1. Fetch the raw data (about 370 MB, standard-library Python only)</h3>
            <Code label="Commands to fetch the raw data">{FETCH_README}</Code>
            <p className="mt-2 text-[0.95rem] text-ink-soft">
              The LiteLLM script needs the <span className="font-mono text-[0.9em]">gh</span> command-line tool. The OpenRouter script needs <span className="font-mono text-[0.9em]">OPENROUTER_API_KEY</span> in{" "}
              <span className="font-mono text-[0.9em]">.env</span>. The BLS wage file must be downloaded in a browser because BLS blocks scripts; it is recorded in{" "}
              <span className="font-mono text-[0.9em]">data/manifest.json</span>.
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-[1.05rem]">2. Fetch the sources added later</h3>
            <Code label="Commands to fetch Indeed, Penn World Table and World Bank data">{FETCH_OTHER}</Code>
          </div>
          <div>
            <h3 className="mb-2 text-[1.05rem]">3. Build the tables</h3>
            <Code label="Commands to build the processed tables">{BUILD}</Code>
            <p className="mt-2 text-[0.95rem] text-ink-soft">
              Run them in this order: the M5 and volume scripts need the M1 price table, and the M2 and M3 scripts need the occupation table. Each script&apos;s header lists its inputs and outputs. The processed tables are
              committed, so the site builds without the raw data.
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-[1.05rem]">4. Run the site</h3>
            <Code label="Commands to run the website">{SITE}</Code>
          </div>
        </div>
      </Section>

      <Section>
        <h2 className="mb-3">Where to look next</h2>
        <ul className="grid max-w-[900px] gap-x-8 gap-y-2 sm:grid-cols-2">
          {LINKS.map((l) => (
            <li key={l.href} className="ui text-[0.98rem] leading-snug">
              <a href={l.href} rel="noreferrer" className="font-semibold">
                {l.label}
              </a>
              <span className="block text-[0.85rem] text-ink-soft">{l.note}</span>
            </li>
          ))}
        </ul>
        <p className="ui mt-6 text-[0.85rem] text-ink-faint">Registry as of 2026-11-22.</p>
      </Section>
    </>
  );
}
