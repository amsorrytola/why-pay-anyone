// Render the presentation with Chrome and ffmpeg.
//
//   node presentation/render.mjs shots                 screenshots of the live site for the closing scene
//   node presentation/render.mjs stills price+12 900   PNG stills (a frame number, or scene+seconds)
//   node presentation/render.mjs video [--workers 6]   the full MP4 and poster, into web/public/presentation/
//
// Each frame is drawn by deck.js's renderFrame(n) and captured as a screenshot, so the video is exactly
// what the deck draws, frame by frame. Run timeline.py and deckdata.py first.

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("/home/talha/Programs/LBP/tools/node_modules/playwright-core");

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(HERE, "build");
const OUT = join(HERE, "..", "web", "public", "presentation");
const DECK = pathToFileURL(join(HERE, "deck", "index.html")).href;
const CHROME = "/usr/bin/google-chrome";
const SITE = "https://why-pay-anyone.vercel.app";

const [mode, ...rest] = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : dflt;
};

async function openDeck(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("deck error:", e.message));
  await page.goto(DECK, { waitUntil: "load" });
  await page.evaluate(() => window.deckReady);
  return page;
}

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [input ? "pipe" : "ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} failed: ${err.slice(-800)}`))));
    if (input) input(p);
  });
}

async function shots() {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => (document.documentElement.dataset.splash = "seen")));
  mkdirSync(join(HERE, "deck", "shots"), { recursive: true });
  for (const [name, path] of [["home", "/"], ["m4", "/m4"], ["india", "/india"]]) {
    await page.goto(SITE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(HERE, "deck", "shots", `${name}.png`) });
    console.log("saved", name);
  }
  await browser.close();
}

async function stills(list) {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await openDeck(browser);
  const T = await page.evaluate(() => window.TIMELINE);
  mkdirSync(join(BUILD, "stills"), { recursive: true });
  for (const s of list) {
    let f = Number(s);
    if (Number.isNaN(f)) {
      const [id, secs] = s.split("+");
      const sc = T.scenes.find((x) => x.id === id);
      f = sc.from + Math.round(Number(secs || 0) * T.fps);
    }
    await page.evaluate((n) => window.renderFrame(n), f);
    const file = join(BUILD, "stills", `${s.replace(/[^\w+.-]/g, "_")}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
}

async function video() {
  const workers = Number(opt("workers", 6));
  const crf = opt("crf", "21");
  const browser = await chromium.launch({ executablePath: CHROME });
  const probe = await openDeck(browser);
  const T = await probe.evaluate(() => window.TIMELINE);
  await probe.close();
  const total = T.total;
  const chunkDir = join(BUILD, "chunks");
  if (existsSync(chunkDir)) rmSync(chunkDir, { recursive: true });
  mkdirSync(chunkDir, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const per = Math.ceil(total / workers);
  const t0 = Date.now();
  let done = 0;
  const jobs = Array.from({ length: workers }, async (_, k) => {
    const a = k * per;
    const b = Math.min(total, a + per);
    if (a >= b) return null;
    const page = await openDeck(browser);
    const file = join(chunkDir, `c${String(k).padStart(2, "0")}.mp4`);
    await run(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(T.fps), "-c:v", "mjpeg", "-i", "-",
        "-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-crf", crf, "-pix_fmt", "yuv420p", "-g", "60", "-r", String(T.fps), file],
      async (p) => {
        for (let f = a; f < b; f++) {
          await page.evaluate((n) => window.renderFrame(n), f);
          const buf = await page.screenshot({ type: "jpeg", quality: 95 });
          if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once("drain", r));
          done++;
          if (done % 600 === 0) console.log(`${done}/${total} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
        }
        p.stdin.end();
      },
    );
    await page.close();
    return file;
  });
  const files = (await Promise.all(jobs)).filter(Boolean);
  // poster: the title frame
  const page = await openDeck(browser);
  const open = T.scenes[0];
  await page.evaluate((n) => window.renderFrame(n), open.from + open.segs[2].at - 6);
  await page.screenshot({ path: join(OUT, "poster.jpg"), type: "jpeg", quality: 88 });
  await browser.close();
  const list = join(chunkDir, "list.txt");
  writeFileSync(list, files.map((f) => `file '${f}'`).join("\n"));
  const mp4 = join(OUT, "why-pay-anyone.mp4");
  await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-i", join(BUILD, "narration.wav"),
    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-shortest", "-movflags", "+faststart", mp4]);
  console.log(`done: ${mp4}, ${(statSync(mp4).size / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

if (mode === "shots") await shots();
else if (mode === "stills") await stills(rest.filter((s) => !s.startsWith("--")));
else if (mode === "video") await video();
else console.log("usage: node render.mjs shots | stills <frames> | video [--workers n] [--crf n]");
