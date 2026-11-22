# Data sources

Registry of every dataset. Audit date: 2026-11-21 (read source pages, HTTP HEAD requests and the first bytes of some files; nothing downloaded in full). Licences are as stated on the source pages, not legal advice. Exact file URLs, retrieval dates and checksums are written to `data/manifest.json` when a file is downloaded.

Status: **VERIFIED** (exists, structure confirmed) · **PARTLY** (exists, contents not yet opened) · **UNVERIFIED** (could not check) · **EXCLUDED** (not used).

| Source | Where | Licence | Used in | Status |
|---|---|---|---|---|
| Anthropic Economic Index, release 2026-06-26 | Hugging Face dataset `Anthropic/EconomicIndex` | CC-BY (per its documentation) | M2, India Stage A | PARTLY. Two CSVs (219 MB and 77 MB). Long format with geography, hierarchy and metric columns. India's rows not yet confirmed |
| Microsoft "Working with AI" | GitHub `microsoft/working-with-ai` | CC BY 4.0 | M2 | VERIFIED. 785 occupations, US Bing Copilot, Jan–Sep 2024 |
| Indeed AI tracker | GitHub `hiring-lab/ai-tracker` | CC-BY-4.0 | M3 | VERIFIED. 25,749 rows, 9 countries (no India), 2019-01 to 2026-10 |
| Indeed job postings tracker | GitHub `hiring-lab/job_postings_tracker` | CC-BY-4.0 | M3 | PARTLY. Structure from the README only. No India |
| US Census BTOS | census.gov, Business Trends and Outlook Survey data files | US government data | M3 | PARTLY. Seven Excel files (about 18 MB). AI columns not opened. Question wording changed Nov 2025 |
| Epoch AI datasets | epoch.ai/data | CC BY | M1, M5, M6 | PARTLY. All files respond; contents not opened. No inference-price dataset |
| OpenRouter models API | `openrouter.ai/api/v1/models` | OpenRouter terms | M1 | VERIFIED for today's prices only (476 models) |
| OpenRouter rankings-daily | OpenRouter datasets API | CC BY 4.0 with citation | M1, M5 | PARTLY. Needs an API key (401 without). Top 50 models per day from 2025-01-01 |
| LLM price history | LiteLLM `model_prices_and_context_window.json` git history; provider pricing pages via the Wayback Machine | LiteLLM licence unclear (NOASSERTION); pricing pages are the providers' own | M1 | PARTLY. Feasible but needs a compiled, cross-checked table with sources cited. Other price-history repos show no licence |
| O*NET 29.0 | onetcenter.org database zip (13.2 MB) | Not yet checked (to confirm on the O*NET site before use) | M2, M4 | VERIFIED (exists) |
| BLS OEWS (employment and wages) | bls.gov | US government data | M4 | UNVERIFIED. BLS blocks scripts (HTTP 403); file must be downloaded in a browser |
| BLS ISCO–SOC crosswalk | bls.gov | US government data | India Stage B | UNVERIFIED. Same 403 |
| World Bank API | api.worldbank.org | Not yet checked (World Bank open-data terms to confirm) | M6, India Stage A | VERIFIED |
| IMF AI Preparedness Index | IMF DataMapper | IMF terms | India Stage A | UNVERIFIED. API rate-limited then "not found" |
| ILO refined GenAI exposure index | ilo.org publication | ILO terms | India Stage A | UNVERIFIED. No data link found |
| India PLFS microdata | microdata.gov.in | Government of India, data-access agreement | India Stage B | PARTLY. Exists; needs free registration by the student |
| Labour share series | to be chosen (for example Penn World Table, ILO or FRED) | to be confirmed | M6 | UNVERIFIED. Source not yet selected |
| Artificial Analysis | artificialanalysis.ai | Free API is internal-use-only; terms bar redistribution and public display | none | EXCLUDED |
