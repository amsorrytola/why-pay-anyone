# Report

The five-page report (`web/public/report/why-pay-anyone-report.pdf`). `report.html` and `report.css` hold the text and layout; `figures.js` draws the figures from `presentation/deck/data.js` (the same data as the site). `node build.mjs` prints it to A4 PDF with Chrome and checks the page count; `node build.mjs --publish` copies it to the site and to the submission copy.
