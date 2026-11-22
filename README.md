# Why Pay Anyone? The Economics of Cheap Intelligence

> Working title. A Lab Based Project (industry track, Hello Agentic) for a BS-MS Economics degree at IIT Roorkee.

**The question:** if AI agents can do the work at a lower price, why would anyone pay a person to do it?

This project answers it with real data, a task-based economic model and an interactive website. The reader can move sliders (the price of AI, how much work is automatable, how substitutable people are, who owns the agents) and watch wages, the labour share and demand respond. An AI chatbot on the site answers questions about the concepts, data and results.

## Status

Planning (2026-11-22). Topic agreed with the industry supervisor. Nothing is built yet. See [docs/research-plan.md](docs/research-plan.md) for the research question, the six modules and what data each one needs, and [data/SOURCES.md](data/SOURCES.md) for every data source, its licence and whether it has been checked.

## The six modules

| | Module | One-line question |
|---|---|---|
| M1 | Price of intelligence | How fast is the price of a fixed level of AI capability falling, and does a cheaper price raise total spending (Jevons)? |
| M2 | Where AI is used | Which occupations does AI touch, and do independent measures agree? |
| M3 | Adoption in the economy | Is firm adoption showing up in hiring, and where first? |
| M4 | The labour model | What wage can a person earn for a task an AI can also do? |
| M5 | Market structure | Who sells the intelligence, and how concentrated is it? |
| M6 | Macro and policy | What does this mean for growth, the labour share and policies such as UBI or an automation tax? |

A module is kept only if its data has been confirmed. If the data is missing, the module or part of it is dropped, not guessed.

## Planned layout

```
docs/            research plan and method notes
data/raw/        downloaded source files (not committed; re-fetched by the pipeline)
data/processed/  small derived tables the website reads (committed, each with its source)
data/SOURCES.md  data registry: source, licence, files, status
pipeline/        scripts that turn raw data into processed tables (to be added)
web/             the website, with the chatbot endpoint (to be added)
```

Planned stack (to be confirmed): Python for the data pipeline and statistics; a TypeScript web app deployed on Vercel; the model runs in the browser so sliders respond instantly; the chatbot calls a server-side endpoint that holds the API key (never in browser code or this repo).

## Principles

- Every number on the site can be traced to a script in `pipeline/` and a file in `data/SOURCES.md`.
- Scenarios, not forecasts. Exposure scores are not job-loss predictions.
- Each data source is credited and used under its own licence.
