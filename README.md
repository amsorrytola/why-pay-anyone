# Why Pay Anyone? The Economics of Cheap Intelligence

**If an AI can do a task for a few cents, why would anyone pay a person to do it?**

An economics study of what happens to jobs, wages, prices and market power when intelligence becomes cheap. It combines public data, standard economic models and an interactive website where every assumption can be changed. Lab Based Project (HSC-400), BS-MS Economics, IIT Roorkee; industry track with Hello Agentic. November 2026.

| | |
|---|---|
| **Website** | [why-pay-anyone.vercel.app](https://why-pay-anyone.vercel.app): seven chapters of interactive figures, a guided reading, 61 economics concepts and a chatbot |
| **Video** | [6-minute narrated presentation](https://why-pay-anyone.vercel.app/presentation), with chapters, captions and a transcript |
| **Report** | [Five-page report (PDF)](https://why-pay-anyone.vercel.app/report/why-pay-anyone-report.pdf): objectives, data, methods, results, interpretation, limitations, references |

## The idea

For any task an AI can also do, an employer will not pay a person more than the AI costs, allowing for how productive each is. A person keeps task *i* only if *w* ≤ *R*·e<sup>−θi</sup>, where *w* is the wage, *R* the AI's cost and e<sup>−θi</sup> the person's relative productivity. As *R* falls, this wage ceiling falls. Whether people still earn well then depends on four forces, which the chapters measure one by one: comparative advantage while compute is scarce, new tasks, whether demand holds up when income moves from wages to profits, and who owns the AI.

## Results

All results are exploratory. Intervals are 95%.

| | Question | Data and method | Main result |
|---|---|---|---|
| 1 | How fast is AI capability getting cheaper? | Epoch Capabilities Index matched to 39 monthly LiteLLM price snapshots; log-linear trend; panel elasticity with fixed effects | GPT-4-level price fell from $37.50 to $0.03 per million tokens (Sep 2023 to Nov 2026), halving every 3.8 months; within-model price elasticity −0.47 [−1.03, 0.09] |
| 2 | Which jobs does AI touch? | Microsoft applicability scores and the Anthropic Economic Index, 591 US occupations; rank correlations | ρ = 0.45 [0.38, 0.52] across occupations, 0.80 across job families; computer jobs are 3.4% of employment and 23.9% of usage |
| 3 | Is adoption visible in hiring? | US Census BTOS; Indeed postings by job category; event study (difference in differences) | Firms using AI rose from 17% to 25% in a year; postings in the most exposed third are 24% lower [−35%, −11%] than in the least exposed since 2022, but the gap opened before ChatGPT |
| 4 | When does cheaper AI lower pay? | Task model with comparative advantage, compute scarcity and CES aggregation (after Acemoglu and Restrepo) | With free adoption the real wage does not fall, but the labour share does; the AI price matters only while it is high |
| 5 | Who sells the intelligence? | OpenRouter daily token shares; Herfindahl–Hirschman index; Cournot and Bertrand | HHI 3,072 (Jan 2025) to 992 (Apr 2026) to 1,577 (Oct 2026); five changes of market leader; twice the hosts goes with a 29% lower price |
| 6 | Growth, the labour share and policy? | Solow model with AI compute, ideas model and two-group demand model, calibrated to the Penn World Table | The labour share falls only if compute substitutes for labour (σ > 1); the welfare-best automation tax ranges from 12% to 95% across assumptions |
| 7 | How exposed are Indian workers? | PLFS 2025 unit-level data linked to exposure scores through occupation crosswalks | The average Indian worker sits at the 28th percentile of US exposure; 6.3% are above the US top-third line (US: 33%); exposed jobs pay 65% more, 4.8% after controls |

Full write-ups, with methods and limits: [research plan](docs/research-plan.md), [M2](docs/findings-m2.md), [M3](docs/findings-m3.md), [M4 model](docs/model-m4.md), [M6](docs/findings-m6.md) and [model](docs/model-m6.md), [India Stage A](docs/findings-india-a.md) and [Stage B](docs/findings-india-b.md).

## Repository

```
pipeline/        Python scripts: fetch the raw data, build the analyses, export the website's data
data/processed/  72 derived tables (CSV) the analyses produce; dictionary in data/processed/README.md
data/SOURCES.md  every data source: what it is, its licence and its files
data/manifest.json  URL, size, SHA-256 and retrieval time of every raw file
docs/            research plan, findings and model notes for each chapter, design system
web/             the website (Next.js): pages, figures, models that run in the browser, chatbot route
presentation/    the narrated video: script, voice, timeline and the frame-by-frame renderer
report/          the five-page report: text, layout and figures, printed to PDF
```

Raw data is not committed (about 370 MB, and the PLFS microdata may not be redistributed). The manifest records where each file came from so the pipeline can fetch it again.

## Reproduce

**Data and analyses** (Python 3.11+, [uv](https://docs.astral.sh/uv/)):

```bash
uv sync
python3 -I pipeline/fetch.py all                     # public sources
python3 -I pipeline/fetch_litellm_history.py         # price history (needs the gh CLI)
python3 -I pipeline/fetch_openrouter_rankings.py     # token shares (needs OPENROUTER_API_KEY)
uv run python pipeline/build_m1_prices.py            # and the other build_*.py scripts
uv run python pipeline/export_web_data.py            # tables for the website
```

The BLS wage file has to be downloaded in a browser (BLS blocks scripts). The PLFS 2025 unit-level files come from [microdata.gov.in](https://microdata.gov.in) after registration and MoSPI's data agreement.

**Website** (Node 20+): see [web/README.md](web/README.md).

```bash
cd web && npm install && npm run dev
```

**Video**: see [presentation/README.md](presentation/README.md). **Report**: see [report/README.md](report/README.md).

Keys go in `.env` (copy [.env.example](.env.example)); it is never committed.

## The chatbot

The site's assistant answers from the project's own documentation (`web/src/content/knowledge.ts`) and the dial settings on screen. Answers stream in as they are written (first words in about one second). The server route tries OpenAI GPT-5.4 mini first (reasoning off), then Gemini 2.5 Flash, Gemini 2.5 Flash-Lite and MiniMax (`MiniMax-M3.1-Flash`); a provider that has not started answering within its deadline is skipped, so one busy provider does not take the chat down. Keys stay on the server; per-visitor and daily limits apply.

## Principles

- Every number on the site, in the video and in the report traces to a script in `pipeline/` and a source in `data/SOURCES.md`.
- Scenarios, not forecasts. Exposure scores measure where AI is used, not jobs lost.
- If the data for a question was missing or too thin, that part was dropped rather than guessed.
- Each source is credited and used under its own licence. PLFS data: National Statistics Office, Ministry of Statistics and Programme Implementation (MoSPI), Government of India.

## Use of AI tools

An AI coding assistant (Anthropic's Claude) helped write the pipeline, the website and drafts of the text. The site's chatbot runs on OpenAI GPT-5.4 mini, with Google Gemini and MiniMax as backups. The video's voice is synthetic (Sarvam AI, Bulbul v4). All numbers come from the pipeline's outputs.

## Citation

Ansari, T. (2026). *Why Pay Anyone? The Economics of Cheap Intelligence.* Lab Based Project, BS-MS Economics, IIT Roorkee (industry track, Hello Agentic). https://why-pay-anyone.vercel.app. See [CITATION.cff](CITATION.cff).

**Author:** Talha Ansari, BS-MS Economics, IIT Roorkee. **Industry supervisor:** Lalla Asmaa Alaoui, Hello Agentic.
