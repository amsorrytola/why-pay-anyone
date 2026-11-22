# M4 model: the labour model

A small task-based model in the spirit of Acemoglu and Restrepo, implemented in `web/src/models/m4.ts` (pure TypeScript, runs in the browser). It is a thinking tool, not a forecast.

## Set-up
Tasks i run from -n to 1. A person's productivity at task i is exp(-theta i): people are best at low-index tasks and relatively worse at high-index ones, which are the tasks AI is best at (comparative advantage). AI can do the share A of tasks with the highest index (i >= 1 - A). Tasks with i < 0 are new tasks only people can do (reinstatement); n is how many there are.

Doing one unit of task i costs
- a person: w exp(theta i), where w is the wage (found by the model);
- AI: R = rho w0 (1 + eta u), where w0 is the wage in a world without AI use, rho is the all-in AI price as a share of that wage, u is the share of tasks run on AI, and eta makes compute scarce (the more tasks run on AI, the dearer it gets).

Each task goes to the cheaper option. Final output combines tasks with a constant-elasticity aggregator with elasticity of substitution sigma between tasks. One unit of labour is supplied and the wage adjusts until the price of the final good is 1.

## Closed forms (sigma not equal to 1)
With k = theta (1 - sigma), I(a) = (exp(k a) - exp(-k n)) / k and i_a the index above which AI is used:
- price level: P^(1-sigma) = w^(1-sigma) I(i_a) + (1 - i_a) R^(1-sigma) = 1, solved for w by bisection;
- output: Y = w^sigma / I(i_a);
- labour share: s = w^(1-sigma) I(i_a);
- AI is used for tasks i >= max(1 - A, (1/theta) ln(R / w)): the first term is what AI can do, the second is where AI is cheaper than a person.
The scarcity link R(u) is solved by damped iteration.

## Demand side
Suppose investment is a fixed share of output, workers spend a share cL of their income and AI owners a share cK. Spending then falls short of output by (cL - cK)(1 - s)(1 - tau), where tau is an automation tax on AI income that is paid out to workers as a basic income. If the "demand can fall short" switch is on, the shortfall cuts employment by the same share; if it is off, Say's law holds.

## What the model says (and does not)
- With free adoption of AI where it is cheaper, and one unit of labour, the real wage never falls: it rises or stays the same. What falls is the labour share. This is a property of the set-up, not a claim that wages cannot fall in practice. Wages can fall through channels the model leaves out: workers who differ in skills, transition costs, monopsony, and demand failure (the Keynes switch).
- When AI is already cheaper than a person on every task it can do (the "corner"), a lower AI price changes nothing about who does the work. What matters is how much AI can do (A) and how well tasks substitute (sigma). When the AI price is high enough that it binds, the wage at the margin equals the AI price adjusted for the person's productivity at that task: this is the wage ceiling.
- Whether cheaper AI raises or lowers the labour share depends on sigma: below 1 (complements) spending on the now-cheap tasks shrinks and the labour share rises; above 1 (substitutes) the labour share falls.
- When sigma exceeds 1 and AI is cheap enough, output per worker has no finite answer (the model flags this as "no limit").
- The default "work AI can do" is 18%, the Microsoft AI-applicability score weighted by pay (BLS OEWS May 2025). The default all-in price is 30% of the wage: tokens alone cost only a few percent of pay for an hour of work (see the calculator on the page), so the rest stands for checking, integration and errors. This is an assumption.

## Not in the model
One kind of worker and one wage, so nothing about who within the workforce loses; no transition costs, learning, unions or laws; no capital accumulation or growth (see M6); real-pay numbers compare two worlds, not two years.
