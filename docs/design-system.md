# Design system (third version, 2026-11-25)

**World: an interactive research bulletin.** The site is set like the report a statistics office or an economics department prints, made live: white paper, black ink, printing inks with fixed meanings, numbered figures and tables, thick-and-thin rules instead of cards, glows or gradients. Mode: *Read* (the visitor came to understand something), so the reading column stays calm and the frame (masthead, chapter openers, figure and table setting) carries the identity. Chosen after the user called the earlier midnight/cobalt version "AI-ish"; checked against Anthropic's `frontend-design` and the Impeccable skill's craft floor (no eyebrow labels, no side-bar callouts, no icon-tile cards, no glass or glow, no hero-metric templates, no unicode glyph icons, one authored motion moment).

## Colour (fixed meanings)
| Token | Hex | Means |
|---|---|---|
| `--ink` | `#1b1c1e` | text, rules, primary buttons |
| `--paper` / `--paper-2` | `#ffffff` / `#f4f3ef` | page / instrument panels (boxes of dials) |
| `--rule` | `#d7d6d0` | hairlines |
| `--ai` (`-deep`, `-soft`) | `#2c5aa0` | AI and compute ("blue") |
| `--human` (`-deep`, `-soft`) | `#c4432a` | people and wages ("red"); also chapter numerals |
| `--owner` (`-soft`) | `#a8761a` | owners of capital ("ochre") |
| `--ok` (`-soft`) | `#2e7a4c` | open weights, fine, correct answers ("green") |
Text selection is a highlighter yellow. Captions name colours as blue, red, ochre and green.

## Type
Source Serif 4 (optical sizes) for titles and reading text; Source Sans 3 for controls, labels, figures, tables and numbers (`.ui`, `.num`, tabular figures). No monospace. Body 17px, measure 66ch. Chapter openers set the chapter number large in red beside the question.

## Structure
- **Masthead:** title in serif, chapter links in sans with chapter numbers, the active one underlined; "Contents" menu on phones (full-screen list with numbers and one-line questions).
- **Chapter opener (`PageHead`):** double rule, red chapter numeral, question as title, standfirst in italic.
- **Figures (`Figure`):** heavy rule, automatic "Figure n." numbering (CSS counter), units line, chart, "Source:" line. **Tables:** `.booktabs` (heavy top and bottom rules, light inner rules), automatic "Table n.".
- **Notes:** `Takeaway` is a boxed reading ("What this shows") in the serif; `Caveat` is "Notes and limits" under a rule, like table footnotes.
- **Controls:** fieldsets as instrument panels on `--paper-2`; sliders are a thin scale with a round knob; options are joined tabs; checkboxes are real checkboxes.
- **Footer:** chapters, reference links and a "Cite as" line.

## The flow
1. **Cover** (`Splash.tsx`, once per session): the headline number counts down from $37.50 to $0.028 while the price line falls; then the title and two doors, "Start the guided reading" or "Go to the report". Skip and Esc always work; a head script hides it before paint once seen; noscript hides it without JavaScript.
2. **Home** (`app/page.tsx`): title page, abstract, "How to read this", Table 1 (key figures, from the data), Figure 1 (the task model with dials), contents, the argument in five ideas, notes.
3. **Guided reading** (`/journey`): 11 steps in 7 chapters; guess a number or make a call, the figure stays blurred until answered, then "You" and "Data" marks and a verdict; chapter rail, Back/Next, arrow keys and swipes; scorecard at the end.
4. **Chapters** 1 to 6 and India, with previous/next at the foot.

## Motion
The cover's countdown is the one authored moment. Elsewhere motion only answers the reader: numbers ease to new values when a dial moves, the guess marks slide, a step fades in. Reduced motion turns all of it off.

## Checking changes
`tools/bin/qa.mjs` (full-page shots at 375px and 1360px, plus an overflow audit), `tools/bin/journey-qa.mjs` (walks the cover and every journey step, answering each). After several edits of `globals.css` the dev server serves a stale stylesheet: delete `web/.next` and restart.
