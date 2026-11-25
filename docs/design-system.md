# Design system (redesign of 2026-11-25)

The look is a **price board crossed with an economics journal**: a midnight-blue band with graph-paper lines for headers and the footer, white panels for charts and dials, serif headlines, a clean grotesque for the interface, tabular numerals. It has to read well on a phone first.

## Meaning of colour (unchanged on every page)
| Token | Colour | Means |
|---|---|---|
| `--ai` / `--ai-deep` / `--ai-soft` / `--ai-glow` | cobalt `#3357ff` | AI, compute, prices |
| `--human` / `--human-deep` / `--human-soft` | amber `#f6a812` | people, wages |
| `--owner` / `--owner-soft` | plum `#b0307f` | owners of capital, markets |
| `--ok` / `--ok-soft` | green `#0f9a6e` | prices falling, fine, adoption |
| `--night`, `--night-2`, `--on-night`, `--on-night-soft` | midnight `#070e2c` to `#101c52` | headers, footer, hero |
| `--paper`, `--paper-2`, `--surface`, `--ink`, `--ink-soft`, `--ink-faint`, `--rule` | cool whites and ink | everything else |

Amber and green are never used for small text on white; use `--human-deep` and `--ok`.

## Type
- Headlines (`h1`, `h2`, `.serif`): Fraunces, optical size auto, weight about 540, tracking -0.016em.
- Interface and body (`.ui`, default): Geist, 16px body, 1.65 line height. Numbers use `.num` (tabular, weight 600).
- `.mono` (Geist Mono) only for module ids and tickers.

## Building blocks (`web/src/components/ui.tsx`, `viz.tsx`)
`PageHead` (night banner with a ghost module numeral), `Section`, `Figure` (white panel with title, subtitle, source line), `Stat` (counts up when seen and when its value changes), `StickyReadout` (phone-only live numbers pinned under the nav), `Takeaway` (serif insight card), `Caveat`, `Slider`, `Toggle` (switch), `Segmented` and `PresetBar` (scroll sideways on a phone), `Spark` (self-drawing trend line), `Marquee`. Shell: `Nav` (pill row at 1024px and up, full-screen menu below), `Footer`, `ModulePager` (previous and next lab), `Chat` (floating button; bottom sheet on a phone). CSS utilities: `.panel`, `.panel-tint`, `.night` (with `.on-night`), `.btn`, `.tile`, `.hscroll`.

## Motion (all of it respects `prefers-reduced-motion`)
1. Page-load rise of the header text (`.rise`). 2. Slow ticker strip of headline figures on the home page. 3. Scroll-driven reveal of cards and drawing of chart lines (`[data-reveal]`, `path[data-draw]`, CSS `animation-timeline: view()`; browsers without it just show everything). 4. Numbers count up. 5. Hover lift on link tiles. Motion that answers a touch (slider thumb, button press) is allowed; no decorative looping animation besides the ticker and the pulse dot.

## Mobile rules
- One column below 1024px; controls stay above their chart, and `StickyReadout` keeps the result in view on the Wages lab.
- Grid children can shrink (`.grid > * { min-width: 0 }`), fieldsets can shrink, rows of chips scroll sideways, tables scroll inside their card. A page must never be wider than the screen: `tools/bin/qa.mjs` checks this on all ten pages at 375px and 1360px.
- Touch targets are at least 40px; sliders are 40px tall with a 28px thumb.

## Checking changes
`node /home/talha/Programs/LBP/tools/bin/qa.mjs <outdir> mobile|desktop <route...>` writes full-page screenshots in segments and prints the horizontal-overflow audit (needs the dev server on port 3100 and the system Chrome). The dev server serves a stale stylesheet after several edits of `globals.css`: delete `web/.next` and restart it.

## The flow (added 2026-11-25)
1. **Splash** (`components/Splash.tsx`), once per browser session: the price of GPT-4-level AI counts down from $37.50 to $0.028 on a price board while a stepped line falls, then the question appears with two doors: "Start the journey" or "Explore on my own". Skip and Esc always work. A script in the layout's `<head>` hides it before paint when it has been seen; a `<noscript>` rule hides it without JavaScript.
2. **Home** (`app/page.tsx`): the question, the live model, and "Three ways in" (journey, model, labs).
3. **Guided journey** (`/journey`, `components/Journey.tsx`): 11 steps in 7 chapters. Each chapter asks the reader to guess a number (slider, then "Lock in my guess") or make a call (choice cards); the chart behind it stays blurred until they answer, then the data reveals with a "You" and "Data" marker and a verdict (spot on, close, off). Chapter rail at the top (clickable), Back and Next at the bottom, arrow keys and swipes. Answers are kept in localStorage; the step is in the URL hash. Ends with "So, why pay anyone?" and a scorecard. Every number is read from the project's own tables.
4. **Labs** (M1 to M6, India) with a previous/next pager; the journey's chapters each link to their lab.

`tools/bin/journey-qa.mjs` walks the splash and every journey step, answering each question, and screenshots each screen.
