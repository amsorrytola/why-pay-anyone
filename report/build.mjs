// Print the report to an A4 PDF with Chrome.
//   node report/build.mjs            -> report/build/report.pdf, page previews in report/build/
//   node report/build.mjs --publish  -> also web/public/report/why-pay-anyone-report.pdf and the submission copy
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("/home/talha/Programs/LBP/tools/node_modules/playwright-core");
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "build");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("report error:", e.message));
await page.goto(pathToFileURL(join(HERE, "report.html")).href, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  await document.fonts.ready;
  return window.figuresReady;
});
const pdf = join(OUT, "report.pdf");
await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
await browser.close();

const info = execFileSync("pdfinfo", [pdf]).toString();
const pages = Number(/Pages:\s+(\d+)/.exec(info)[1]);
console.log(`${pdf}: ${pages} pages`);
execFileSync("pdftoppm", ["-r", "80", "-png", pdf, join(OUT, "page")]);
if (pages > 5) console.error("TOO LONG: the limit is 5 pages");

if (process.argv.includes("--publish")) {
  const web = join(HERE, "..", "web", "public", "report");
  mkdirSync(web, { recursive: true });
  copyFileSync(pdf, join(web, "why-pay-anyone-report.pdf"));
  copyFileSync(pdf, join(HERE, "..", "..", "deliverables", "LBP_Report_23322016.pdf"));
  console.log("published to web/public/report/ and deliverables/LBP_Report_23322016.pdf");
}
