/*
  The economics concepts used on this site: one entry per concept in the project's concept list
  (61 concepts in 7 groups). Written for a reader with no economics background.

  Fields
    id          stable kebab-case key; used in links (/concepts#<id>) and in <C id="..."> on the pages
    name        the concept's name as in the project's concept list
    short       a shorter label for map nodes (optional)
    modules     the group the concept belongs to first (its lane on the concept map), then any other
                module where it is also used
    era         classic: the main framework was set out before about 1970.
                modern: 1970 or later, including work on digital technology and AI.
    kind        modelled: a module models or estimates it with data.
                explained: a plain-English card only (marked with a diamond in the project's concept list).
    definition  plain English, 30 to 45 words
    example     one sentence tying the concept to this project's data or model
    page        the route where the concept appears
    related     ids of related concepts (the concept map treats a link as two-way)

  Numbers in examples come from docs/research-plan.md and data/processed/. They are exploratory; update
  them if the findings change.
*/

export type ModuleId = "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "India";
export type GroupId = "Foundations" | ModuleId;
export type Era = "classic" | "modern";
export type Kind = "modelled" | "explained";

export type Concept = {
  id: string;
  name: string;
  short?: string;
  modules: GroupId[];
  era: Era;
  kind: Kind;
  definition: string;
  example: string;
  page: string;
  related: string[];
};

export type ModuleInfo = {
  id: ModuleId;
  name: string;
  /** The label used in the site navigation. */
  short: string;
  route: string;
  question: string;
};

export type GroupInfo = { id: GroupId; name: string; short: string; route: string; question: string };

export const MODULES: ModuleInfo[] = [
  {
    id: "M1",
    name: "Price of intelligence",
    short: "Prices",
    route: "/m1",
    question: "How fast is the price of a fixed level of AI capability falling, and does a cheaper price raise total spending (Jevons)?",
  },
  {
    id: "M2",
    name: "Where AI is used",
    short: "Usage",
    route: "/m2",
    question: "Which occupations does AI touch, and do independent measures agree?",
  },
  {
    id: "M3",
    name: "Adoption in the economy",
    short: "Adoption",
    route: "/m3",
    question: "Is firm adoption showing up in hiring, and where first?",
  },
  {
    id: "M4",
    name: "The labour model",
    short: "Wages",
    route: "/m4",
    question: "What wage can a person earn for a task an AI can also do?",
  },
  {
    id: "M5",
    name: "Market structure and power",
    short: "Markets",
    route: "/m5",
    question: "Who sells the intelligence, and how concentrated is it?",
  },
  {
    id: "M6",
    name: "Macro and policy",
    short: "Growth and policy",
    route: "/m6",
    question: "What does this mean for growth, the labour share and policies such as UBI or an automation tax?",
  },
  {
    id: "India",
    name: "India",
    short: "India",
    route: "/india",
    question: "How does India compare on AI use and on how exposed its work is?",
  },
];

/** The lanes of the concept map: the foundations first, then the modules. */
export const GROUPS: GroupInfo[] = [
  {
    id: "Foundations",
    name: "Foundations",
    short: "Foundations",
    route: "/concepts",
    question: "Ideas used throughout the site, from scarcity to welfare.",
  },
  ...MODULES,
];

export const CONCEPTS: Concept[] = [
  // ---------------------------------------------------------------- Foundations
  {
    id: "scarcity",
    name: "Scarcity and opportunity cost",
    modules: ["Foundations", "M4"],
    era: "classic",
    kind: "modelled",
    definition:
      "Resources are limited, so using them for one purpose means giving up the next best use. The opportunity cost of a choice is the value of what you give up, not just the money you spend.",
    example: "In the M4 model compute is scarce, so every task given to an AI uses compute that another task could have used.",
    page: "/m4",
    related: ["comparative-advantage", "shadow-price"],
  },
  {
    id: "comparative-advantage",
    name: "Absolute vs comparative advantage (Ricardo)",
    short: "Comparative advantage",
    modules: ["Foundations", "M4"],
    era: "classic",
    kind: "modelled",
    definition:
      "A party has an absolute advantage if it needs fewer resources to make something, and a comparative advantage if its opportunity cost is lower. Even one that is worse at everything gains from trade by specialising where its disadvantage is smallest (Ricardo, 1817).",
    example:
      "M4 lines tasks up from those people do best relative to AI to those AI does best, so people keep the tasks where their relative advantage is greatest while compute is scarce.",
    page: "/m4",
    related: ["scarcity", "shadow-price", "task-framework", "offshoring"],
  },
  {
    id: "marginal-productivity",
    name: "Marginal productivity theory of wages",
    short: "Marginal productivity of labour",
    modules: ["Foundations", "M4"],
    era: "classic",
    kind: "modelled",
    definition:
      "In a competitive market, a worker is paid roughly the value of the extra output that one more unit of their labour adds. Higher marginal productivity supports higher pay. It is a benchmark for wages, not a law.",
    example: "M4 asks what happens to this benchmark when an AI can add the same output more cheaply: the wage is then capped at the AI's price.",
    page: "/m4",
    related: ["wage-ceiling", "derived-demand", "labour-share", "task-framework"],
  },
  {
    id: "elasticity",
    name: "Elasticity (price elasticity and elasticity of substitution)",
    short: "Elasticity",
    modules: ["Foundations", "M1", "M4"],
    era: "classic",
    kind: "modelled",
    definition:
      "Elasticity measures how strongly one quantity responds to a change in another, as a ratio of percentage changes. Price elasticity of demand is how much the quantity bought responds to price. Elasticity of substitution is how easily one input replaces another.",
    example: "M1 estimates how token use responds to price (about -0.47, with a wide interval), and M4 has a slider for the elasticity of substitution between tasks.",
    page: "/m1",
    related: ["substitutes-complements", "ces", "jevons", "derived-demand", "cournot"],
  },
  {
    id: "substitutes-complements",
    name: "Substitutes vs complements",
    modules: ["Foundations", "M4"],
    era: "classic",
    kind: "modelled",
    definition:
      "Two goods or inputs are substitutes if more of one reduces the need for the other, and complements if they work better together. Whether AI substitutes for human work or complements it decides if a falling AI price helps or hurts pay.",
    example: "In M4 the elasticity between tasks decides whether cheaper AI lifts or cuts the labour share: below 1 the tasks are complements, above 1 they are substitutes.",
    page: "/m4",
    related: ["elasticity", "ces", "baumol", "automation-augmentation"],
  },
  {
    id: "derived-demand",
    name: "Derived demand (Marshall's rules)",
    short: "Derived demand",
    modules: ["Foundations", "M4"],
    era: "classic",
    kind: "modelled",
    definition:
      "Demand for an input, such as labour, comes from demand for what it helps make. Marshall's rules say it is less price-sensitive when substitutes are scarce, product demand is inelastic, or the input is a small share of cost.",
    example: "In M4 the demand for people's time depends on demand for the output and on how easily an AI can do the same task.",
    page: "/m4",
    related: ["marginal-productivity", "elasticity", "wage-ceiling"],
  },
  {
    id: "equilibrium",
    name: "Partial and general equilibrium",
    modules: ["Foundations", "M4", "M5"],
    era: "classic",
    kind: "modelled",
    definition:
      "Partial equilibrium studies one market while holding the rest fixed. General equilibrium lets all markets and prices adjust together, so a change in one place, such as the price of AI, can ripple through wages, output and spending elsewhere.",
    example:
      "M5 looks at one market, the hosts of an AI model, in partial equilibrium, while M4 adjusts the wage until all labour is employed and then checks what that does to output and spending.",
    page: "/m4",
    related: ["surplus", "says-law", "cournot"],
  },
  {
    id: "surplus",
    name: "Consumer and producer surplus (welfare)",
    short: "Consumer and producer surplus",
    modules: ["Foundations", "M5", "M6"],
    era: "classic",
    kind: "modelled",
    definition:
      "Consumer surplus is the gap between what buyers would be willing to pay and what they pay. Producer surplus is the gap between what sellers receive and the least they would accept. Together they measure the gains from a market.",
    example: "A markup above cost, as M5 estimates, shifts surplus from buyers to sellers and shrinks the total; M6 asks how a basic income or automation tax changes the gains of workers and owners.",
    page: "/m5",
    related: ["market-power", "welfare", "equilibrium", "technological-deflation"],
  },

  // ---------------------------------------------------------------- M1 Price of intelligence
  {
    id: "price-index",
    name: "Price index theory (Laspeyres, Paasche, Fisher)",
    short: "Price indices",
    modules: ["M1"],
    era: "classic",
    kind: "modelled",
    definition:
      "A price index tracks the cost of a fixed basket of goods over time. Laspeyres prices the old basket, Paasche the new one, and Fisher takes the geometric mean of the two, which cancels much of the bias in each.",
    example: "M1 follows the price of a fixed level of AI capability across 39 monthly price snapshots, which is the same idea as holding the basket fixed.",
    page: "/m1",
    related: ["hedonic-pricing", "technological-deflation", "wrights-law"],
  },
  {
    id: "hedonic-pricing",
    name: "Hedonic pricing and quality adjustment",
    short: "Hedonic pricing",
    modules: ["M1"],
    era: "modern",
    kind: "modelled",
    definition:
      "Hedonic pricing explains a product's price by its features. Statisticians use it to adjust for quality: if a new version is better, part of a higher price buys more product, not inflation, and the price index should say so.",
    example: "M1's quality-adjusted index holds the capability score fixed and puts the November 2026 price at about 14% of September 2023 (95% interval 6% to 32%).",
    page: "/m1",
    related: ["price-index", "technological-deflation"],
  },
  {
    id: "wrights-law",
    name: "Learning curve / Wright's law (learning by doing)",
    short: "Wright's law",
    modules: ["M1"],
    era: "classic",
    kind: "modelled",
    definition:
      "Wright's law says that each time cumulative output doubles, unit cost falls by a roughly constant percentage, because people learn by doing. Wright first described it for aircraft in 1936, and it has since been fitted to many technologies.",
    example:
      "M1 fits a trend to the price of GPT-4-level capability, which halves about every 3.8 months; a time trend is looser than Wright's law, which ties cost to cumulative output.",
    page: "/m1",
    related: ["economies-of-scale", "technological-deflation", "price-index"],
  },
  {
    id: "economies-of-scale",
    name: "Economies of scale",
    modules: ["M1", "M5"],
    era: "classic",
    kind: "modelled",
    definition:
      "Economies of scale arise when producing more lowers the average cost per unit, often because fixed costs are spread over more output. They can give large producers a cost advantage over small ones.",
    example: "Training a frontier model is a large one-off cost, so a provider with more usage spreads it thinner; M5 asks how that shapes who sells AI.",
    page: "/m1",
    related: ["wrights-law", "market-power", "network-effects"],
  },
  {
    id: "jevons",
    name: "Jevons paradox (rebound effect)",
    short: "Jevons paradox",
    modules: ["M1"],
    era: "classic",
    kind: "modelled",
    definition:
      "When a resource is used more efficiently, its effective price falls. If demand responds strongly enough, total use of the resource rises instead of falling. Jevons made this point about coal in 1865; a rebound of more than 100% is called the Jevons paradox.",
    example:
      "OpenRouter tokens per day rose about 480 times from January 2025 to November 2026, yet within-model price cuts show an elasticity of only about -0.47, so M1 treats Jevons as plausible, not proven.",
    page: "/m1",
    related: ["elasticity", "technological-deflation", "lump-of-labour"],
  },
  {
    id: "technological-deflation",
    name: "Technological deflation (falling prices)",
    short: "Technological deflation",
    modules: ["M1"],
    era: "modern",
    kind: "modelled",
    definition:
      "Technological deflation is a fall in the price of goods or services because technology makes them cheaper to produce, as with computing and solar panels. It differs from general deflation, which is a fall in the whole price level.",
    example: "The cheapest price of GPT-4-level capability fell from $37.50 per million tokens in September 2023 to about $0.03 in November 2026.",
    page: "/m1",
    related: ["jevons", "price-index", "hedonic-pricing", "wrights-law", "baumol"],
  },

  // ---------------------------------------------------------------- M2 Where AI is used
  {
    id: "task-based-view",
    name: "Task-based view of work (occupations as bundles of tasks)",
    short: "Jobs as bundles of tasks",
    modules: ["M2", "M4"],
    era: "modern",
    kind: "modelled",
    definition:
      "The task-based view treats a job as a bundle of tasks, only some of which a given technology can do. Technology then changes which tasks people do, instead of simply removing or keeping whole occupations.",
    example: "M2 links O*NET occupations, which are lists of tasks, to usage scores from Microsoft and the Anthropic Economic Index.",
    page: "/m2",
    related: ["automation-augmentation", "task-framework", "skill-biased-change", "measurement-error"],
  },
  {
    id: "automation-augmentation",
    name: "Automation vs augmentation",
    modules: ["M2", "M4"],
    era: "modern",
    kind: "modelled",
    definition:
      "Automation means technology performs a task that people did. Augmentation means it helps people do a task better or faster while they stay involved. One occupation can see both, and the mix affects pay and jobs differently.",
    example: "The Anthropic Economic Index codes each conversation as automation or augmentation, and M2 reports those shares by occupation.",
    page: "/m2",
    related: ["task-based-view", "task-framework", "substitutes-complements"],
  },
  {
    id: "diffusion",
    name: "Technology diffusion and S-curves",
    short: "Diffusion and S-curves",
    modules: ["M2", "M3"],
    era: "classic",
    kind: "modelled",
    definition:
      "New technologies usually spread slowly at first, then quickly, then level off once most potential users have adopted. Plotted over time, the share of adopters traces an S shape. Spread is often faster among larger, richer or better-connected users.",
    example: "M3 tracks the share of US firms using AI across fortnightly Census survey periods (25.0% in the latest) and the share of Indeed job postings that mention AI since 2019.",
    page: "/m3",
    related: ["firm-adoption", "convergence", "digital-divide", "j-curve"],
  },
  {
    id: "convergence",
    name: "Convergence across countries/regions",
    short: "Convergence",
    modules: ["M2", "India"],
    era: "modern",
    kind: "modelled",
    definition:
      "Convergence is the tendency of poorer countries or regions to catch up with richer ones. Absolute convergence means every place closes the gap. Conditional convergence means only places with similar savings, schooling and institutions do.",
    example: "The Economic Index puts India's usage per capita at about 0.3 against about 4 for the US (April and May 2026), so India is far from catching up on this measure.",
    page: "/m2",
    related: ["digital-divide", "diffusion", "solow", "lewis"],
  },
  {
    id: "digital-divide",
    name: "Digital divide",
    modules: ["M2", "India"],
    era: "modern",
    kind: "modelled",
    definition:
      "The digital divide is the gap between people or places with access to digital technology and the skills to use it, and those without. Gaps follow income, location, age, gender and education, and can deepen existing inequality.",
    example: "M2 compares AI use per capita across 121 countries, and the India page asks how income and internet access relate to it.",
    page: "/m2",
    related: ["convergence", "diffusion", "measurement-error"],
  },
  {
    id: "measurement-error",
    name: "Measurement error and selection bias",
    modules: ["M2"],
    era: "modern",
    kind: "modelled",
    definition:
      "Measurement error is noise or distortion in how something is recorded. Selection bias arises when the people or items observed are not representative of the group you care about. Both can mislead even in very large data sets.",
    example:
      "Each M2 usage source covers one platform's users (Bing Copilot in 2024, Claude.ai in 2026), so neither describes all AI use, and Anthropic's occupation labels come from classifying conversations.",
    page: "/m2",
    related: ["cross-source-agreement", "job-postings", "digital-divide"],
  },
  {
    id: "cross-source-agreement",
    name: "Cross-source agreement (rank correlation, robustness)",
    short: "Cross-source agreement",
    modules: ["M2"],
    era: "modern",
    kind: "modelled",
    definition:
      "When independent measures of the same thing agree, we trust them more. Rank correlation checks whether two measures order items similarly, ignoring scale. A robustness check asks whether a result survives different data, methods or assumptions.",
    example:
      "Across the 591 occupations that have both scores, Microsoft's applicability score and the Economic Index usage share have a Spearman rank correlation of about 0.45.",
    page: "/m2",
    related: ["measurement-error", "task-based-view"],
  },

  // ---------------------------------------------------------------- M3 Adoption in the economy
  {
    id: "firm-adoption",
    name: "Firm-level technology adoption",
    short: "Firm-level adoption",
    modules: ["M3"],
    era: "modern",
    kind: "modelled",
    definition:
      "Firms adopt new technology at different times, depending on cost, expected benefit, skills, size and competition. Studying adoption at firm level shows which sectors and sizes move first, which national averages hide.",
    example: "M3 uses the Census Business Trends and Outlook Survey, in which about 25% of US firms reported using AI in the latest period.",
    page: "/m3",
    related: ["diffusion", "job-postings", "event-study", "j-curve"],
  },
  {
    id: "job-postings",
    name: "Job postings as a labour-demand signal",
    short: "Job postings as a signal",
    modules: ["M3"],
    era: "modern",
    kind: "modelled",
    definition:
      "Employer job postings show how many workers firms want to hire and what skills they ask for, often sooner than official employment figures. They measure the wish to hire, not actual hires, and not every job is advertised.",
    example: "M3 uses Indeed Hiring Lab's daily share of postings that mention AI (2019 to 2026, nine countries) and its postings index by sector.",
    page: "/m3",
    related: ["firm-adoption", "event-study", "measurement-error", "structural-breaks"],
  },
  {
    id: "event-study",
    name: "Event study / difference-in-differences",
    short: "Event study and diff-in-diff",
    modules: ["M3"],
    era: "modern",
    kind: "modelled",
    definition:
      "An event study follows an outcome before and after a dated event. Difference-in-differences adds a comparison group, so the change in the affected group is measured against the change in an unaffected one, which removes trends they share.",
    example: "M3 compares job postings in the most and least AI-exposed job categories before and after ChatGPT's launch in November 2022.",
    page: "/m3",
    related: ["structural-breaks", "job-postings", "firm-adoption"],
  },
  {
    id: "structural-breaks",
    name: "Structural breaks in time series",
    short: "Structural breaks",
    modules: ["M3"],
    era: "modern",
    kind: "modelled",
    definition:
      "A structural break is a point where the pattern of a time series shifts, such as a new trend or a new level. Detecting one helps show whether a change is real, and when it began, rather than ordinary fluctuation.",
    example: "M3 compares growth in the AI share of job postings before and after November 2022, and asks whether the gap between exposed and other job categories opened at ChatGPT's launch.",
    page: "/m3",
    related: ["event-study", "job-postings"],
  },
  {
    id: "skill-biased-change",
    name: "Skill-biased technical change",
    modules: ["M3"],
    era: "modern",
    kind: "modelled",
    definition:
      "Skill-biased technical change is technology that raises demand for skilled workers relative to less skilled ones, widening the wage gap between them. It was proposed to explain the rising college wage premium since the 1980s.",
    example:
      "In M3 the job categories with the highest AI exposure include customer service, data and analytics, sales and software development, so exposure is not confined to low-skill work.",
    page: "/m3",
    related: ["task-based-view", "task-framework", "labour-share", "signalling"],
  },
  {
    id: "structural-change",
    name: "Structural change across sectors",
    modules: ["M3", "India"],
    era: "classic",
    kind: "modelled",
    definition:
      "Structural change is the shift of workers and output between sectors as economies develop and technology changes, typically from farming to manufacturing to services. It can raise average productivity when workers move to more productive sectors.",
    example: "M3 compares AI adoption and hiring across sectors, and the India page looks at the shares of farming and services in employment.",
    page: "/m3",
    related: ["lewis", "baumol", "engel"],
  },

  // ---------------------------------------------------------------- M4 The labour model
  {
    id: "task-framework",
    name: "Task-based framework (Acemoglu and Restrepo)",
    short: "Task framework (Acemoglu and Restrepo)",
    modules: ["M4"],
    era: "modern",
    kind: "modelled",
    definition:
      "Acemoglu and Restrepo model production as a set of tasks that capital or labour can perform. Automation displaces labour from tasks and raises productivity, while new tasks can reinstate labour. The net effect on wages depends on the balance of the three.",
    example: "In the M4 model AI takes over tasks (displacement), costs fall (productivity), and a slider adds new human-only tasks (reinstatement).",
    page: "/m4",
    related: ["task-based-view", "ces", "wage-ceiling", "labour-share", "automation-augmentation", "lump-of-labour"],
  },
  {
    id: "ces",
    name: "CES production function and substitution",
    short: "CES production function",
    modules: ["M4", "M6"],
    era: "classic",
    kind: "modelled",
    definition:
      "A constant elasticity of substitution (CES) function combines inputs so that the ease of swapping one for another stays constant. One parameter sets whether inputs are poor substitutes (complements), close substitutes, or in between.",
    example: "M4 combines tasks into output with a CES aggregator, and its elasticity slider sets how well tasks substitute for one another.",
    page: "/m4",
    related: ["elasticity", "substitutes-complements", "task-framework", "solow"],
  },
  {
    id: "wage-ceiling",
    name: "Wage ceiling (the cost of the AI substitute caps the wage)",
    short: "Wage ceiling",
    modules: ["M4"],
    era: "modern",
    kind: "modelled",
    definition:
      "For a task an AI can do, a person cannot sustainably earn more than the AI substitute costs, or the buyer switches. This project calls that cap the wage ceiling. It binds only where AI can do the task and is the cheaper option.",
    example: "M4's ceiling chart cuts each task's cost to the AI price wherever AI can do the task and a person would cost more.",
    page: "/m4",
    related: ["task-framework", "comparative-advantage", "marginal-productivity", "shadow-price", "derived-demand"],
  },
  {
    id: "shadow-price",
    name: "Scarce compute and shadow prices",
    short: "Shadow price of compute",
    modules: ["M4"],
    era: "classic",
    kind: "modelled",
    definition:
      "A shadow price is the value of one more unit of a scarce resource, measured by how much the best achievable outcome would improve. When compute is limited, its shadow price is what the next-best use of it would be worth.",
    example: "M4's compute-scarcity dial makes AI dearer as more tasks run on it, which is why people can keep tasks even when AI is better at all of them.",
    page: "/m4",
    related: ["scarcity", "comparative-advantage", "wage-ceiling"],
  },
  {
    id: "says-law",
    name: "Say's law vs Keynesian aggregate demand",
    short: "Say's law vs Keynes",
    modules: ["M4", "M6"],
    era: "classic",
    kind: "modelled",
    definition:
      "Say's law holds that supply creates its own demand: income earned from producing goods is spent buying them. Keynes argued that spending can fall short of output, for example when saving or caution rises, so output and jobs fall until demand recovers.",
    example: "The M4 switch 'Let demand fall short' toggles between the two: off, spending always catches up with output; on, a shortfall cuts jobs.",
    page: "/m4",
    related: ["propensity-to-consume", "equilibrium", "ubi", "technological-unemployment"],
  },
  {
    id: "propensity-to-consume",
    name: "Marginal propensity to consume by income type",
    short: "Propensity to consume",
    modules: ["M4", "M6"],
    era: "classic",
    kind: "modelled",
    definition:
      "The marginal propensity to consume is the share of an extra unit of income that is spent rather than saved. It is often higher for wage earners than for owners of capital, so shifting income from one group to the other changes total spending.",
    example: "In M4 the spending shortfall is the gap between the spending rates of workers and AI owners, times the owners' share of income.",
    page: "/m4",
    related: ["says-law", "labour-share", "ubi", "automation-tax", "piketty"],
  },
  {
    id: "labour-share",
    name: "Labour share of income",
    modules: ["M4", "M6"],
    era: "classic",
    kind: "modelled",
    definition:
      "The labour share is the part of national income paid as wages, salaries and benefits. The rest goes to owners of capital as profits and rents. It was fairly steady for decades in rich countries, and has fallen in many since the 1980s.",
    example: "M4 reports the share of income paid as wages and the share that goes to AI owners, and M6 sets its starting point beside Penn World Table, ILO and US labour-share data.",
    page: "/m4",
    related: ["task-framework", "propensity-to-consume", "piketty", "gini", "solow"],
  },
  {
    id: "gini",
    name: "Inequality: Lorenz curve and Gini coefficient",
    short: "Lorenz curve and Gini",
    modules: ["M4", "M6"],
    era: "classic",
    kind: "modelled",
    definition:
      "The Lorenz curve plots the cumulative share of income against the cumulative share of people, ordered from poorest to richest. The Gini coefficient summarises how far it is from perfect equality, from 0 (everyone equal) to 1 (one person has it all).",
    example: "M4 splits income between workers and AI owners; because owners are far fewer, a larger owner share of income points to a higher Gini.",
    page: "/m4",
    related: ["labour-share", "piketty", "welfare", "ubi"],
  },
  {
    id: "baumol",
    name: "Baumol's cost disease",
    modules: ["M4", "M1"],
    era: "classic",
    kind: "modelled",
    definition:
      "Baumol's cost disease says that services where productivity grows slowly, such as live music or teaching, become relatively more expensive, because their pay must keep up with wages in sectors where productivity grows fast.",
    example: "In M4, when tasks are complements (elasticity below 1), cheaper AI tasks raise the relative value of the tasks that still need people, a Baumol effect.",
    page: "/m4",
    related: ["substitutes-complements", "ces", "engel", "structural-change", "technological-deflation"],
  },
  {
    id: "engel",
    name: "Engel's law",
    modules: ["M4"],
    era: "classic",
    kind: "explained",
    definition:
      "Engel's law is the observation that as household income rises, the share of income spent on food falls, even though spending on food rises. More generally, spending shifts toward goods and services whose demand grows faster than income.",
    example: "If AI makes many goods cheaper, spending may shift toward what people value more as they get richer, which is where M4's new tasks could come from.",
    page: "/m4",
    related: ["baumol", "structural-change", "lump-of-labour"],
  },
  {
    id: "lump-of-labour",
    name: "Lump-of-labour fallacy",
    modules: ["M4"],
    era: "classic",
    kind: "explained",
    definition:
      "The lump-of-labour fallacy is the mistaken belief that there is a fixed amount of work to share, so every job taken by a machine or a migrant is lost for good. In practice, demand for work can grow as output and incomes grow.",
    example: "M4 does not assume a fixed amount of work: a slider adds new tasks, and whether they offset the work AI displaces is the open question.",
    page: "/m4",
    related: ["technological-unemployment", "task-framework", "engel", "jevons"],
  },
  {
    id: "technological-unemployment",
    name: "Keynes's technological unemployment (1930)",
    short: "Technological unemployment",
    modules: ["M4"],
    era: "classic",
    kind: "explained",
    definition:
      "In 'Economic Possibilities for our Grandchildren' (1930), Keynes warned of technological unemployment: jobs lost to labour-saving methods faster than new uses for labour are found. He expected this to be a temporary phase of adjustment.",
    example: "M4 asks the same question for AI: when does cheaper machine labour displace people faster than new tasks can absorb them?",
    page: "/m4",
    related: ["lump-of-labour", "says-law", "task-framework"],
  },

  // ---------------------------------------------------------------- M5 Market structure and power
  {
    id: "hhi",
    name: "Market concentration (HHI)",
    short: "Market concentration (HHI)",
    modules: ["M5"],
    era: "classic",
    kind: "modelled",
    definition:
      "The Herfindahl–Hirschman index adds up the squares of each firm's percentage market share, giving a value from near 0 to 10,000. Four equal firms score 2,500 and a monopoly scores 10,000. Higher values mean fewer firms hold more of the market.",
    example: "From OpenRouter token shares, the HHI by firm fell from about 3,070 in January 2025 to about 990 in April 2026, then rose to about 1,580 in October 2026.",
    page: "/m5",
    related: ["cournot", "market-power", "bertrand"],
  },
  {
    id: "cournot",
    name: "Cournot competition",
    modules: ["M5"],
    era: "classic",
    kind: "modelled",
    definition:
      "In Cournot competition each firm chooses how much to produce, taking its rivals' output as given, and the market price follows. The average markup over cost (the Lerner index) equals the HHI, as a fraction, divided by the elasticity of demand.",
    example: "At a demand elasticity of 2, the October 2026 HHI implies a Lerner index of about 0.08; these are model-implied numbers, not measured margins.",
    page: "/m5",
    related: ["hhi", "bertrand", "market-power", "elasticity"],
  },
  {
    id: "bertrand",
    name: "Bertrand competition and price wars",
    modules: ["M5"],
    era: "classic",
    kind: "modelled",
    definition:
      "In Bertrand competition firms choose prices, and buyers go to the cheapest seller of an identical product, so even two firms can push the price down to cost. Differentiated products, limited capacity or loyalty soften this.",
    example:
      "For open-weights models, doubling the number of hosts goes with a lowest price about 29% lower, as Bertrand competition would predict (an association, not proof of cause).",
    page: "/m5",
    related: ["cournot", "network-effects", "market-power", "public-goods"],
  },
  {
    id: "network-effects",
    name: "Network effects, switching costs and lock-in",
    short: "Network effects and lock-in",
    modules: ["M5"],
    era: "modern",
    kind: "modelled",
    definition:
      "A network effect means a product becomes more valuable as more people use it. Switching costs are what it costs a customer to change supplier. Together they can lock customers in, so a large provider keeps its lead even when rivals are cheaper.",
    example:
      "The leading provider on OpenRouter changed five times in 23 months, which points to low switching costs there; customers elsewhere may be more locked in.",
    page: "/m5",
    related: ["market-power", "economies-of-scale", "bertrand"],
  },
  {
    id: "market-power",
    name: "Entry barriers and market power (markups, deadweight loss)",
    short: "Market power",
    modules: ["M5"],
    era: "classic",
    kind: "modelled",
    definition:
      "Entry barriers, such as large fixed costs, patents or data advantages, keep new firms out. Protected firms can price above marginal cost. The markup raises their profit and causes a deadweight loss: sales that would benefit both sides but do not happen.",
    example: "M5 turns concentration into a model-implied markup over cost, about 9% at the October 2026 HHI with a demand elasticity of 2.",
    page: "/m5",
    related: ["hhi", "cournot", "surplus", "economies-of-scale", "network-effects"],
  },
  {
    id: "coase",
    name: "Coase's theory of the firm (transaction costs)",
    short: "Coase's theory of the firm",
    modules: ["M5"],
    era: "classic",
    kind: "modelled",
    definition:
      "Coase argued in 1937 that firms exist because using the market has costs: finding partners, negotiating and enforcing contracts. A task is done inside a firm when that is cheaper than buying it, and bought when it is not.",
    example: "If AI cuts the cost of coordinating and checking work, M5 asks whether firms will do more themselves or buy more from AI providers.",
    page: "/m5",
    related: ["principal-agent", "automation-augmentation", "hayek"],
  },
  {
    id: "principal-agent",
    name: "Principal–agent problem and moral hazard",
    short: "Principal–agent problem",
    modules: ["M5"],
    era: "modern",
    kind: "explained",
    definition:
      "A principal hires an agent to act for them but cannot fully observe the agent's effort or choices. Moral hazard is the risk that the agent takes hidden actions that suit the agent, not the principal. Contracts, monitoring and incentives try to align the two.",
    example: "When people hand tasks to AI agents the same problem arises, and the cost of checking their work is part of the all-in AI price in M4.",
    page: "/m5",
    related: ["coase", "lemons", "arrow-information"],
  },
  {
    id: "public-goods",
    name: "Public goods and free riding (open-source models)",
    short: "Public goods and free riding",
    modules: ["M5"],
    era: "classic",
    kind: "explained",
    definition:
      "A public good can be used by many people at once without being used up, and it is hard to stop anyone using it. Free riding is using it without paying. Markets tend to supply too little of such goods without public funding.",
    example: "Released open-weights models partly behave like public goods: anyone can run them, and M5 shows many competing hosts offering them at lower prices.",
    page: "/m5",
    related: ["arrow-information", "bertrand", "endogenous-growth"],
  },
  {
    id: "arrow-information",
    name: "Arrow's information paradox and intellectual property",
    short: "Arrow's information paradox",
    modules: ["M5"],
    era: "classic",
    kind: "explained",
    definition:
      "Arrow's information paradox is that a buyer cannot value information without seeing it, yet once seen, the buyer no longer needs to pay for it. Intellectual property rights, such as patents and copyright, are one way to let sellers sell ideas safely.",
    example: "Model weights, training data and prompts are information goods whose value is hard to judge before use, which is why access terms and licences matter to AI providers.",
    page: "/m5",
    related: ["public-goods", "lemons", "endogenous-growth", "principal-agent"],
  },
  {
    id: "lemons",
    name: "Akerlof's market for lemons (AI-generated content)",
    short: "Market for lemons",
    modules: ["M5"],
    era: "modern",
    kind: "explained",
    definition:
      "Akerlof showed in 1970 that when buyers cannot tell good products from bad ones, they offer only an average price. That drives sellers of good products out and shrinks the market. Hidden quality differences can make a market unravel.",
    example: "If AI-generated content becomes hard to tell from careful human work, buyers may discount both, which makes reputation and verification more valuable.",
    page: "/m5",
    related: ["arrow-information", "principal-agent", "signalling"],
  },

  // ---------------------------------------------------------------- M6 Macro and policy
  {
    id: "solow",
    name: "Solow–Swan growth model",
    modules: ["M6"],
    era: "classic",
    kind: "modelled",
    definition:
      "The Solow–Swan model explains output per worker by capital per worker and technology. Saving adds capital, depreciation removes it, and diminishing returns mean that long-run growth in output per worker comes from technological progress.",
    example: "M6 adds AI compute as an input that can stand in for labour, and follows GDP per worker, wages and income shares over 60 years.",
    page: "/m6",
    related: ["endogenous-growth", "ces", "labour-share", "convergence", "piketty"],
  },
  {
    id: "endogenous-growth",
    name: "Endogenous growth (Romer)",
    modules: ["M6"],
    era: "modern",
    kind: "modelled",
    definition:
      "Endogenous growth theory makes technological progress a result of choices made inside the economy, such as research effort. In Romer's 1990 model ideas are non-rival, since many can use one at once, so more researchers and more ideas can raise growth.",
    example: "M6's endogenous-growth variant asks what changes if AI does part of the research work as well as production.",
    page: "/m6",
    related: ["solow", "transformative-ai-growth", "public-goods", "arrow-information"],
  },
  {
    id: "transformative-ai-growth",
    name: "Growth under transformative AI (Trammell and Korinek scenarios)",
    short: "Growth under transformative AI",
    modules: ["M6"],
    era: "modern",
    kind: "modelled",
    definition:
      "Trammell and Korinek (2023) review how AI could change long-run growth in standard models. Outcomes range from little change to much faster or even explosive growth, depending on how far AI can substitute for human work and on bottlenecks such as scarce inputs.",
    example: "M6 offers scenarios in that spirit and labels them scenarios, not forecasts.",
    page: "/m6",
    related: ["endogenous-growth", "solow", "baumol", "j-curve"],
  },
  {
    id: "j-curve",
    name: "Productivity paradox and the J-curve",
    short: "Productivity paradox and J-curve",
    modules: ["M6"],
    era: "modern",
    kind: "modelled",
    definition:
      "The productivity paradox is Solow's 1987 remark that computers were everywhere except in the productivity statistics. The J-curve explains it: general-purpose technologies need costly complementary investment first, so measured productivity may stall before it rises.",
    example: "With about a quarter of US firms reporting AI use in the latest Census survey, a J-curve would say gains may still lie ahead; the site does not forecast them.",
    page: "/m6",
    related: ["diffusion", "firm-adoption", "transformative-ai-growth"],
  },
  {
    id: "piketty",
    name: "Capital vs labour income (Piketty's r > g)",
    short: "Piketty's r greater than g",
    modules: ["M6"],
    era: "modern",
    kind: "modelled",
    definition:
      "Piketty argues that when the return on capital (r) exceeds the growth rate of the economy (g), wealth built from past savings grows faster than incomes in general, which tends to raise the share of wealth held by those who already own most of it.",
    example: "M6 compares the return on capital with growth, which matters more if the owners of AI capture much of the income that AI creates.",
    page: "/m6",
    related: ["labour-share", "gini", "ubi", "automation-tax", "solow"],
  },
  {
    id: "ubi",
    name: "Universal basic income",
    modules: ["M6"],
    era: "modern",
    kind: "modelled",
    definition:
      "Universal basic income is a regular cash payment to every person, with no means test or work requirement. Supporters see a floor under living standards and spending. Critics point to the cost, possible effects on work, and the trade-off with targeted help.",
    example: "M4 can pay workers a basic income funded by an automation tax, and M6 shows how the tax rate that funds it changes demand and welfare.",
    page: "/m6",
    related: ["automation-tax", "welfare", "propensity-to-consume", "says-law", "gini"],
  },
  {
    id: "automation-tax",
    name: "Automation (robot) tax",
    modules: ["M6"],
    era: "modern",
    kind: "modelled",
    definition:
      "An automation tax, or robot tax, is a levy on firms that replace workers with machines, or on the income the machines earn. It is proposed to slow job losses or to fund support for displaced workers. Critics worry that it could discourage useful investment.",
    example: "In M4 the demand shortfall shrinks by the amount of any automation tax paid out to workers.",
    page: "/m6",
    related: ["ubi", "welfare", "piketty", "propensity-to-consume"],
  },
  {
    id: "welfare",
    name: "Welfare analysis and redistribution",
    modules: ["M6"],
    era: "classic",
    kind: "modelled",
    definition:
      "Welfare analysis judges outcomes by their effect on people's wellbeing, often through total surplus, and separately asks who gains and who loses. Redistribution through taxes and transfers can trade some efficiency for a fairer split.",
    example: "M6's tax model reports the welfare gain at each tax rate, with the consumption of workers and of owners shown separately.",
    page: "/m6",
    related: ["surplus", "ubi", "automation-tax", "gini"],
  },
  {
    id: "signalling",
    name: "Human capital vs signalling (Spence)",
    short: "Human capital vs signalling",
    modules: ["M6"],
    era: "modern",
    kind: "explained",
    definition:
      "Human capital theory says education raises productivity. Spence's signalling model (1973) says part of its value is showing employers an ability they cannot observe directly. The two views imply different returns to schooling when AI changes what skills are worth.",
    example: "If AI can do the tasks a degree once proved you could do, the signal weakens; M6 discusses this in words only.",
    page: "/m6",
    related: ["skill-biased-change", "lemons", "marginal-productivity"],
  },
  {
    id: "offshoring",
    name: "Offshoring and Heckscher–Ohlin (India's IT-services angle)",
    short: "Offshoring and Heckscher–Ohlin",
    modules: ["M6", "India"],
    era: "classic",
    kind: "explained",
    definition:
      "The Heckscher–Ohlin model predicts that countries export goods made with the factor they have most of. Offshoring means moving tasks abroad where labour is cheaper; India's IT and business services are a leading example.",
    example: "On the India page the question is whether AI that does such tasks cheaply anywhere weakens the cost advantage that made offshoring attractive.",
    page: "/india",
    related: ["comparative-advantage", "lewis", "structural-change"],
  },
  {
    id: "lewis",
    name: "Lewis model and premature deindustrialisation",
    short: "Lewis model",
    modules: ["M6", "India"],
    era: "classic",
    kind: "explained",
    definition:
      "Lewis's 1954 model has a traditional sector with surplus labour that feeds a modern sector at near-constant wages. Rodrik found that many countries now see manufacturing's share of jobs peak early, at low income, leaving services as the main route.",
    example: "The India page looks at services-led growth and asks whether services can keep absorbing workers as AI changes service work.",
    page: "/india",
    related: ["structural-change", "offshoring", "convergence"],
  },
  {
    id: "hayek",
    name: "Hayek's knowledge problem",
    modules: ["M6"],
    era: "classic",
    kind: "explained",
    definition:
      "Hayek argued in 1945 that the knowledge needed to run an economy is scattered among millions of people, so no central planner can gather it. Prices summarise what each person knows. The question for AI is how much of that it can capture.",
    example: "M6 does not model this, but it bears on how much work AI can take on, which M4 sets with a slider.",
    page: "/m6",
    related: ["equilibrium", "arrow-information", "coase"],
  },
];

/** Look-up by id. */
export const CONCEPT_BY_ID: ReadonlyMap<string, Concept> = new Map(CONCEPTS.map((c) => [c.id, c]));

/** Two-way relations: if A lists B as related, B lists A too. Order follows the list order of CONCEPTS. */
export const RELATED_BY_ID: ReadonlyMap<string, string[]> = (() => {
  const sets = new Map<string, Set<string>>(CONCEPTS.map((c) => [c.id, new Set<string>()]));
  for (const c of CONCEPTS) {
    for (const r of c.related) {
      if (!sets.has(r) || r === c.id) continue;
      sets.get(c.id)!.add(r);
      sets.get(r)!.add(c.id);
    }
  }
  const order = new Map(CONCEPTS.map((c, i) => [c.id, i]));
  return new Map(
    [...sets].map(([id, s]) => [id, [...s].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))]),
  );
})();

export const GROUP_BY_ID: ReadonlyMap<string, GroupInfo> = new Map(GROUPS.map((g) => [g.id, g]));
