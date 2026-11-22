/*
  What the chatbot knows. Keep it short: every question pays for these tokens.
  Update the numbers here when the findings change (they come from docs/research-plan.md and docs/findings-*.md).
*/
export const KNOWLEDGE = `
PROJECT
"Why Pay Anyone? The Economics of Cheap Intelligence" is a Lab Based Project for a BS-MS Economics degree at IIT Roorkee, done under the industry track at Hello Agentic. The question: if AI agents can do work at a lower price, why would anyone pay a person to do it? The site answers with real public data and small economic models, in six modules plus an India page. All results are exploratory scenarios, not forecasts.

FIVE LENSES
1 Comparative advantage: even if AI is better at everything, people keep tasks where their relative advantage is greatest while compute is scarce.
2 Wage ceiling: for a task AI can do, the wage a person can earn is capped by what the AI substitute costs.
3 Demand side: if wage income falls, who buys the output? Say's law versus Keynes, and spending rates of workers versus owners.
4 New tasks and Jevons: cheaper intelligence expands demand and creates new work (Jevons paradox, reinstatement, Baumol).
5 Who owns the agents: gains may flow to capital owners and a few providers (market power, Coase, automation tax, basic income).

MODULES (page names)
M1 Prices (/m1): price of AI capability. Epoch Capabilities Index (ECI) joined to 39 monthly snapshots of LiteLLM list prices (212 of 258 scored models matched). Price of GPT-4-level capability (ECI 120 or more) fell from $37.50 per million tokens (Sep 2023, GPT-4) to about $0.03 (Nov 2026), halving about every 3.8 months, roughly 89% a year. A hedonic (quality-adjusted) price index is about 14% of Sep 2023 (95% interval 6 to 32%). OpenRouter tokens per day rose about 480 times (Jan 2025 to Nov 2026). Token-weighted list price stayed near $1 per million as usage moved to more capable models. Price elasticity of usage from within-model price changes: about -0.47 (95% interval -1.03 to +0.09): not evidence of elasticity above 1 at model level; the aggregate growth fits Jevons but is confounded by user growth. Prices are list prices from one source (LiteLLM history), not yet cross-checked against provider pages.
M2 Usage (/m2): where AI is used. Microsoft AI applicability scores (Bing Copilot use, 2024) versus Anthropic Economic Index usage shares (Claude.ai, April and May 2026) across 830 US occupations; rank correlation about 0.45. Occupations with Microsoft score of 0.3 or more hold about 11% of the US wage bill; pay-weighted mean score about 0.18. Each source covers one platform; some Economic Index occupation labels look odd (for example librarians, counter clerks).
M3 Adoption (/m3): firm adoption and hiring. US Census BTOS (firm AI use, 26 fortnightly periods from late 2025; the survey words it "Super Intelligence or SI (formerly AI)"; headcount-effect questions have only 2 periods) and Indeed Hiring Lab postings (nine countries, not India).
M4 Wages (/m4): a task-based model (after Acemoglu and Restrepo). Tasks run from those people are best at to those AI finds easiest. AI can do a share A of tasks at an all-in cost rho times the pre-AI wage; compute gets dearer as more tasks run on it (eta); tasks combine with elasticity sigma; new human-only tasks add work. Key insight: when AI is already cheaper than a person on every task it can do, its price is not what binds; what binds is how much AI can do and how substitutable tasks are. Real pay can rise while the labour share falls. Token costs for an hour of work are a tiny share of pay (a few percent at most), so the wage ceiling is not set by token prices today. Demand shortfall = (spending rate of workers minus owners) times owners' income share times (1 minus automation tax).
M5 Markets (/m5): OpenRouter daily token shares (top 50 models per day, Jan 2025 to Nov 2026). HHI by firm fell from about 3,070 (Jan 2025, Anthropic about 51%) to about 990 (Apr 2026, about 10 equivalent firms) and rose to about 1,580 (Oct 2026, DeepSeek about 34%). The largest firm changed five times in 23 months. Cournot: average Lerner index = HHI divided by market demand elasticity. For open-weights models, doubling the number of hosts goes with a lowest price about 29% lower (Bertrand-style); no clear effect for closed models. Covers OpenRouter users only. Revenue concentration was not computed because Epoch's revenue data covers only nine companies.
M6 Growth and policy (/m6): Solow growth with AI capital and a CES production function, an endogenous-growth (Romer style) variant, and a demand and policy model with an automation tax and basic income. Calibrated to Penn World Table and Epoch compute data.
India (/india): India appears in the Anthropic Economic Index (usage per capita index about 0.3, about 7% of worldwide Claude.ai usage); published exposure estimates for India are lower than for advanced economies.

DATA SOURCES (full list on /data)
Anthropic Economic Index (CC-BY), Microsoft Working with AI (CC BY 4.0), Indeed Hiring Lab (CC-BY-4.0), US Census BTOS, Epoch AI (CC BY), OpenRouter rankings (CC BY 4.0), LiteLLM price file history, O*NET, BLS OEWS May 2025, World Bank, Penn World Table.

BIGGEST LIMITS
Each usage dataset covers one platform. Exposure or applicability scores are not job-loss forecasts. Prices are list prices. OpenRouter users are not the whole market. Models are simplified; results are scenarios.

HOW TO ANSWER
Answer only about this project, its data, methods and the economics behind it. Be brief (under 130 words unless asked for more), plain, and specific. Quote numbers only if they are above or in the "current page" context. If you do not know, say so and point to the page or the data page. Do not give investment or financial advice. Do not claim certainty about the future. Write plain text only: no markdown, no asterisks, no bullet symbols.
`;
