/*
  Why Pay Anyone? The presentation, drawn frame by frame.

  Every scene is built once and then set for a given frame by its update(f) function, where f is the frame
  inside the scene. Nothing moves by CSS transition or animation: every value is a function of the frame
  (the rule Remotion's motion guidance gives), so render.mjs can draw any frame in any order and get the same
  picture. Scene and sentence timing comes from timeline.js (made from the narration clips); numbers come
  from data.js (made from the website's data files).
*/
(() => {
  const T = window.TIMELINE;
  const D = window.DATA;
  const FPS = T.fps;
  const TR = T.transition;
  const W = 1920;
  const H = 1080;
  const SANS = "'Source Sans 3', sans-serif";
  const SERIF = "'Source Serif 4', Georgia, serif";
  const C = {
    ink: "#1b1c1e", soft: "#4b4c50", faint: "#66686d", rule: "#d7d6d0", paper: "#ffffff", paper2: "#f4f3ef",
    human: "#c4432a", humanSoft: "#f8e4de", ai: "#2c5aa0", aiSoft: "#e6ecf6", owner: "#a8761a", ownerSoft: "#f5ead4", ok: "#2e7a4c",
  };

  // ---------------------------------------------------------------- timing
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 40; i++) {
        const v = sx(t);
        if (Math.abs(v - x) < 1e-6) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return sy(t);
    };
  }
  const EO = bezier(0.16, 1, 0.3, 1); // quick start, long settle
  const EIO = bezier(0.65, 0, 0.35, 1); // symmetric, for things that travel
  const ES = bezier(0.33, 1, 0.68, 1); // gentle out
  const LIN = (x) => Math.min(1, Math.max(0, x));
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (f, a, b, e = EO) => e(clamp((f - a) / Math.max(1e-6, b - a)));
  const lerp = (a, b, p) => a + (b - a) * p;
  const sec = (s) => Math.round(s * FPS);

  // ---------------------------------------------------------------- drawing helpers
  const NS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function ht(tag, style, parent, html) {
    const e = document.createElement(tag);
    for (const k in style || {}) if (style[k] !== undefined && style[k] !== null) e.style[k] = style[k];
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  const box = (parent, x, y, w, style, html) =>
    ht("div", { position: "absolute", left: `${x}px`, top: `${y}px`, width: w ? `${w}px` : undefined, ...(style || {}) }, parent, html);
  function txt(parent, x, y, s, attrs) {
    const t = sv("text", { x, y, fill: C.soft, "font-size": 28, "font-family": SANS, ...(attrs || {}) }, parent);
    t.textContent = s;
    return t;
  }
  function svgLayer(parent) {
    const s = sv("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, parent);
    s.style.position = "absolute";
    s.style.left = "0";
    s.style.top = "0";
    s.style.overflow = "visible";
    return s;
  }
  const fade = (el, p, dy = 0) => {
    el.style.opacity = p;
    el.style.transform = dy ? `translateY(${(1 - p) * dy}px)` : "";
  };

  /* Text that rises word by word out of a mask. Mark coloured words as [[ai:words]]. */
  function rise(parent, x, y, w, src, style) {
    const el = box(parent, x, y, w, style);
    const spans = [];
    const re = /\[\[(\w+):([^\]]+)\]\]|([^[]+)/g;
    let m;
    while ((m = re.exec(src))) {
      const color = m[1] ? C[m[1]] : null;
      (m[2] || m[3]).split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          el.appendChild(document.createTextNode(" "));
          return;
        }
        const o = ht("span", {}, el);
        o.className = "w";
        spans.push(ht("span", color ? { color } : {}, o, part));
      });
    }
    return {
      el,
      spans,
      set(f, start, per = 1.6, dur = 20) {
        spans.forEach((s, i) => {
          const p = prog(f, start + i * per, start + i * per + dur, EO);
          s.style.transform = `translateY(${(1 - p) * 108}%)`;
        });
      },
      out(f, start, dur = 16) {
        const p = prog(f, start, start + dur, EIO);
        el.style.opacity = 1 - p;
        el.style.transform = `translateY(${-p * 26}px)`;
      },
    };
  }

  function cum(pts) {
    const c = [0];
    for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return c;
  }
  /* The first fraction p (by length) of a polyline, and where its head is. */
  function partial(pts, p, c) {
    c = c || cum(pts);
    const L = c[c.length - 1] * clamp(p);
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    let head = pts[0];
    let idx = 0;
    for (let i = 1; i < pts.length; i++) {
      if (c[i] <= L) {
        d += `L${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
        head = pts[i];
        idx = i;
      } else {
        const t = (L - c[i - 1]) / Math.max(1e-9, c[i] - c[i - 1]);
        head = [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)];
        d += `L${head[0].toFixed(1)},${head[1].toFixed(1)}`;
        break;
      }
    }
    return { d, head, idx };
  }
  const polyline = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const mi = (s) => {
    const [y, m] = s.split("-").map(Number);
    return y * 12 + m - 1;
  };
  const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  const lg = (d0, d1, r0, r1) => (v) => r0 + ((Math.log(v) - Math.log(d0)) / (Math.log(d1) - Math.log(d0))) * (r1 - r0);
  const fmt0 = (v) => Math.round(v).toLocaleString("en-US");
  const fmt1 = (v) => v.toFixed(1);
  const usd = (v) => (v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(3)}`);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = (s) => `${MON[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`;

  /* A small chart title in the bulletin style: "Figure n." in ink, then the title. */
  function figTitle(parent, x, y, w, n, title) {
    const el = box(parent, x, y, w, { fontFamily: SANS, fontSize: "30px", lineHeight: "1.25", color: C.ink });
    el.innerHTML = `<span style="font-weight:700">Figure ${n}.</span> ${title}`;
    return el;
  }
  /* A double rule (thick over thin) that draws from the left. */
  function doubleRule(parent, x, y, w, color = C.ink) {
    const g = box(parent, x, y, w, { height: "8px" });
    const a = ht("div", { position: "absolute", left: "0", top: "0", height: "3px", width: "100%", background: color, transformOrigin: "0 50%" }, g);
    const b = ht("div", { position: "absolute", left: "0", top: "6px", height: "1px", width: "100%", background: color, transformOrigin: "0 50%" }, g);
    return (p) => {
      a.style.transform = `scaleX(${p})`;
      b.style.transform = `scaleX(${clamp(p * 1.08 - 0.08)})`;
    };
  }
  /* A big number with a small label under it. */
  function stat(parent, x, y, w, color, label, size = 120) {
    const el = box(parent, x, y, w, { fontFamily: SANS });
    const v = ht("div", { fontSize: `${size}px`, fontWeight: "600", color, lineHeight: "1", letterSpacing: "-0.01em" }, el);
    v.className = "num";
    const l = ht("div", { fontSize: "30px", color: C.soft, marginTop: "12px", lineHeight: "1.3" }, el, label);
    return { el, v, l };
  }

  // ---------------------------------------------------------------- the labour model (same as web/src/models/m4.ts)
  function Iint(a, k, n) {
    return Math.abs(k) < 1e-9 ? a + n : (Math.exp(k * a) - Math.exp(-k * n)) / k;
  }
  function simulateM4(p) {
    const sigma = Math.abs(p.sigma - 1) < 1e-3 ? 1.001 : p.sigma;
    const k = p.theta * (1 - sigma);
    const n = p.n;
    const w0 = Math.pow(Iint(1, k, n), -1 / (1 - sigma));
    const solveW = (R) => {
      const iaOf = (w) => {
        const istar = p.theta < 1e-6 ? (R < w ? -Infinity : Infinity) : Math.log(R / w) / p.theta;
        return Math.min(1, Math.max(1 - p.A, istar));
      };
      const priceLevel = (w) => {
        const ia = iaOf(w);
        const v = Math.pow(w, 1 - sigma) * Iint(ia, k, n) + (1 - ia) * Math.pow(R, 1 - sigma);
        return Math.pow(v, 1 / (1 - sigma));
      };
      let lo = Math.log(w0 * 1e-4), hi = Math.log(w0 * 1e4);
      for (let it = 0; it < 90; it++) {
        const mid = (lo + hi) / 2;
        if (priceLevel(Math.exp(mid)) < 1) lo = mid; else hi = mid;
      }
      const w = Math.exp((lo + hi) / 2);
      return { w, ia: iaOf(w) };
    };
    let u = p.A * 0.5, sol = { w: w0, ia: 1 }, R = p.rho * w0;
    for (let it = 0; it < 60; it++) {
      R = p.rho * w0 * (1 + p.eta * u);
      sol = solveW(R);
      const uNew = 1 - sol.ia;
      if (Math.abs(uNew - u) < 1e-7) { u = uNew; break; }
      u = 0.5 * u + 0.5 * uNew;
    }
    R = p.rho * w0 * (1 + p.eta * u);
    sol = solveW(R);
    const s = clamp(Math.pow(sol.w, 1 - sigma) * Iint(sol.ia, k, n));
    return { w: sol.w, w0, R, ia: sol.ia, aiShare: 1 - sol.ia, relWage: sol.w / w0, labourShare: s };
  }

  // ---------------------------------------------------------------- scenes
  const SCENES = {};
  const SOURCES = {
    ceiling: "The task-based view of work follows Acemoglu and Restrepo (2018, 2019).",
    plan: "Every source is public except the PLFS microdata, used under MoSPI's data agreement.",
    price: "Data: Epoch AI capabilities index; LiteLLM price file, 39 monthly snapshots; OpenRouter token counts. Elasticity: model and month fixed effects, 58 models.",
    use: "Data: Microsoft, Working with AI (2025); Anthropic Economic Index, April and May 2026; BLS employment, May 2025.",
    adoption: "Data: US Census Bureau, Business Trends and Outlook Survey; Indeed Hiring Lab job postings, US, 32 job categories.",
    model: "Model: tasks go to the cheaper of a person and AI; CES across tasks. Here AI can do half the tasks; elasticity between tasks 1.",
    market: "Data: OpenRouter daily token shares, top 50 models, Jan 2025 to Oct 2026; host prices for 62 open-weights models.",
    macro: "Models: Solow growth with AI capital; demand with two spending rates; tax paid out as a basic income. Calibrated to Penn World Table 11 (USA).",
    india: "Source: PLFS 2025 unit-level data, MoSPI, Government of India. Exposure: Microsoft scores carried to Indian occupations through BLS crosswalks.",
    meaning: "All results are exploratory. Methods, intervals and limits are in the report.",
  };

  // ---- 1. Opening: the price of GPT-4-level AI draws itself, then the title
  SCENES.open = (root, S) => {
    const svg = svgLayer(root);
    const P = D.price;
    const n = P.length;
    const x0 = 120, x1 = 1780, yTop = 150, yBot = 880;
    const X = (i) => x0 + ((x1 - x0) * i) / (n - 1);
    const Y = lg(60, 0.016, yTop, yBot);
    const chart = sv("g", {}, svg);
    const grid = sv("g", {}, chart);
    const gridText = sv("g", {}, chart);
    [[10, "$10 per million tokens"], [1, "$1"], [0.1, "$0.10"]].forEach(([v, l]) => {
      sv("line", { x1: x0, x2: x1, y1: Y(v), y2: Y(v), stroke: C.rule, "stroke-width": 2, "stroke-dasharray": "1 9", "stroke-linecap": "round" }, grid);
      txt(gridText, x0, Y(v) - 12, l, { fill: C.faint, "font-size": 24 });
    });
    sv("line", { x1: x0, x2: x1, y1: yBot + 36, y2: yBot + 36, stroke: C.ink, "stroke-width": 2 }, grid);
    P.forEach(([m], i) => {
      if (m.endsWith("-01")) {
        sv("line", { x1: X(i), x2: X(i), y1: yBot + 36, y2: yBot + 48, stroke: C.ink, "stroke-width": 2 }, grid);
        txt(gridText, X(i), yBot + 82, m.slice(0, 4), { "text-anchor": "middle", "font-size": 26 });
      }
    });
    const pts = [];
    const vIdx = [];
    P.forEach(([, v], i) => {
      if (i > 0) { pts.push([X(i), Y(P[i - 1][1])]); vIdx.push(i - 1); }
      pts.push([X(i), Y(v)]);
      vIdx.push(i);
    });
    const c = cum(pts);
    const line = sv("path", { fill: "none", stroke: C.ai, "stroke-width": 6, "stroke-linejoin": "round", "stroke-linecap": "round" }, chart);
    const head = sv("circle", { r: 10, fill: C.ai }, chart);
    const tag = box(root, 0, 0, null, { fontFamily: SANS, whiteSpace: "nowrap", background: "rgba(255,255,255,0.92)", padding: "2px 14px 8px 4px" });
    const price = ht("div", { fontSize: "64px", fontWeight: "600", color: C.ai, lineHeight: "1" }, tag);
    price.className = "num";
    const meta = ht("div", { fontSize: "26px", color: C.soft, marginTop: "8px" }, tag);

    const q = rise(root, 760, 170, 1040, "If an AI can do a piece of work for a few cents, why would anyone pay a person to do it?",
      { fontSize: "78px", lineHeight: "1.1", fontWeight: "500", letterSpacing: "-0.01em" });

    const title = rise(root, 120, 250, 1500, "Why Pay Anyone?", { fontSize: "176px", lineHeight: "1", fontWeight: "600", letterSpacing: "-0.02em" });
    const sub = rise(root, 124, 452, 1400, "The economics of cheap intelligence", { fontSize: "64px", fontStyle: "italic", color: C.soft });
    const rule = doubleRule(root, 124, 568, 960);
    const metaBox = box(root, 124, 608, 1300, { fontFamily: SANS, fontSize: "32px", lineHeight: "1.5", color: C.ink });
    const rows = [
      ["Student", "Talha Ansari, BS-MS Economics, IIT Roorkee"],
      ["Project", "Lab Based Project (HSC-400), industry track"],
      ["Host", "Hello Agentic, supervised by Lalla Asmaa Alaoui"],
    ].map(([a, b]) => {
      const r = ht("div", { display: "flex", gap: "28px" }, metaBox);
      ht("span", { width: "130px", color: C.faint }, r, a);
      ht("span", {}, r, b);
      return r;
    });
    const cap = box(root, 1180, 902, 620, { fontFamily: SANS, fontSize: "24px", lineHeight: "1.3", color: C.soft },
      `Cheapest price of GPT-4-level AI, per million tokens: <b style="color:${C.ai}">$37.50</b> in Sep 2023, <b style="color:${C.ai}">$0.03</b> in Nov 2026`);
    const ask = rise(root, 124, 836, 980, "What happens to [[human:jobs]], [[human:wages]], [[ai:prices]] and [[owner:market power]] when intelligence becomes cheap?",
      { fontSize: "48px", lineHeight: "1.2", fontStyle: "italic" });

    const drawEnd = S.end(0) - 6;
    return (f) => {
      const p = prog(f, 4, drawEnd, bezier(0.45, 0.05, 0.4, 1));
      const r = partial(pts, p, c);
      line.setAttribute("d", r.d);
      head.setAttribute("cx", r.head[0]);
      head.setAttribute("cy", r.head[1]);
      const i = vIdx[r.idx];
      price.textContent = usd(P[i][1]);
      meta.textContent = `${monthName(P[i][0])}, ${P[i][2]}`;
      const right = r.head[0] > 1300;
      const tw = tag.offsetWidth;
      tag.style.transform = `translate(${right ? r.head[0] - tw - 26 : r.head[0] + 22}px, ${r.head[1] - 120}px)`;
      grid.style.opacity = prog(f, 0, 24);
      tag.style.opacity = prog(f, 4, 14);
      // the chart steps back when the title arrives
      const back = prog(f, S.at(1) - 18, S.at(1) + 22, EIO);
      const sc = lerp(1, 0.36, back);
      chart.setAttribute("transform", `translate(${lerp(0, 1180 - 120 * 0.36, back)},${lerp(0, 610 - 150 * 0.36, back)}) scale(${sc})`);
      gridText.style.opacity = 1 - prog(f, S.at(1) - 18, S.at(1) - 4, LIN);
      line.setAttribute("stroke-width", 6 / sc);
      head.setAttribute("r", 10 / Math.sqrt(sc));
      tag.style.opacity = Math.min(prog(f, 4, 14), 1 - prog(f, S.at(1) - 18, S.at(1) - 6, LIN));
      fade(cap, prog(f, S.at(1) + 20, S.at(1) + 40), 10);
      q.set(f, S.at(0) - 4, 1.4);
      q.out(f, S.at(1) - 14);
      title.set(f, S.at(1) + 2, 3, 26);
      sub.set(f, S.at(1) + 12, 2, 22);
      rule(prog(f, S.at(1) + 18, S.at(1) + 48, EIO));
      rows.forEach((row, k) => fade(row, prog(f, S.at(1) + 26 + k * 6, S.at(1) + 50 + k * 6), 18));
      ask.set(f, S.at(2) - 2, (S.segs[2].len * 0.85) / ask.spans.length, 18);
    };
  };

  // ---- 2. The idea: a wage ceiling, and four things that decide whether people still earn well
  SCENES.ceiling = (root, S) => {
    const head = rise(root, 120, 168, 1300, "A wage ceiling", { fontSize: "96px", fontWeight: "600", letterSpacing: "-0.01em" });
    // the inequality, term by term
    const eq = box(root, 120, 330, 1000, { fontSize: "60px", lineHeight: "1.1", display: "flex", alignItems: "flex-start", gap: "22px" });
    const terms = [
      ["pay for a task", C.human, "what an employer will pay a person"],
      ["≤", C.ink, ""],
      ["AI’s cost", C.ai, "what the AI charges for the task"],
      ["×", C.ink, ""],
      ["edge", C.ink, "how much better the person is at it"],
    ].map(([t, col, cap], k) => {
      const cell = ht("div", { flex: "none", width: ["330px", "44px", "240px", "40px", "270px"][k] }, eq);
      const w = ht("div", { color: col, fontWeight: k % 2 ? "400" : "600", fontStyle: k % 2 ? "normal" : "italic", whiteSpace: "nowrap" }, cell, t);
      const cp = ht("div", { fontFamily: SANS, fontSize: "26px", color: C.soft, lineHeight: "1.3", marginTop: "14px", whiteSpace: "normal" }, cell, cap);
      return { cell, w, cp };
    });
    // a ceiling pressing pay down as AI gets cheaper
    const svg = svgLayer(root);
    const gx0 = 1180, gx1 = 1780, gyTop = 300, gyBot = 650;
    sv("line", { x1: gx0, x2: gx1, y1: gyBot, y2: gyBot, stroke: C.ink, "stroke-width": 2 }, svg);
    const bar = sv("rect", { x: gx0 + 200, width: 200, fill: C.human }, svg);
    const barLbl = txt(svg, gx0 + 300, gyBot + 44, "Pay", { "text-anchor": "middle", fill: C.human, "font-weight": 600, "font-size": 30 });
    const ceil = sv("line", { x1: gx0, x2: gx1, stroke: C.ai, "stroke-width": 6, "stroke-linecap": "round" }, svg);
    const ceilLbl = txt(svg, gx1, 0, "Ceiling: AI’s cost × edge", { "text-anchor": "end", fill: C.ai, "font-weight": 600, "font-size": 30 });
    const ceilNote = txt(svg, gx0, gyTop - 40, "As AI gets cheaper, the ceiling falls", { fill: C.ink, "font-size": 30, "font-weight": 600 });
    // four things that decide the outcome
    const items = [
      [C.ai, "Comparative advantage", "while computing power is scarce", "Chapter 4"],
      [C.human, "New tasks", "that cheap intelligence creates", "Chapters 1 and 4"],
      [C.ok, "Demand", "whether it holds up when wage income falls", "Chapter 6"],
      [C.owner, "Ownership", "who owns the AI and its income", "Chapters 5 and 6"],
    ].map(([col, a, b, ch], k) => {
      const x = 120 + k * 425;
      const el = box(root, x, 742, 385, { fontFamily: SANS });
      const r = ht("div", { height: "6px", background: col, transformOrigin: "0 50%" }, el);
      const t1 = ht("div", { fontSize: "38px", fontWeight: "700", marginTop: "18px", color: C.ink, fontFamily: SERIF }, el, a);
      const t2 = ht("div", { fontSize: "28px", color: C.soft, marginTop: "6px", lineHeight: "1.3" }, el, b);
      const t3 = ht("div", { fontSize: "24px", color: col, marginTop: "12px", fontWeight: "600" }, el, ch);
      return { el, r, t1, t2, t3 };
    });
    return (f) => {
      head.set(f, S.at(0) - 6, 3);
      const k1 = S.at(1);
      terms.forEach((t, k) => {
        const at = k1 + [0, 0.3, 0.42, 0.62, 0.72][k] * S.segs[1].len;
        fade(t.w, prog(f, at, at + 16), 24);
        fade(t.cp, prog(f, at + 8, at + 26), 12);
      });
      // ceiling falls during sentence 3
      const drop = prog(f, S.at(2), S.end(2) + 10, EIO);
      const ceilY = lerp(gyTop + 30, gyTop + 200, drop);
      const payTop = Math.max(ceilY + 10, gyTop + 120);
      const showG = prog(f, S.at(1) + 10, S.at(1) + 34);
      svg.style.opacity = showG;
      bar.setAttribute("y", payTop);
      bar.setAttribute("height", gyBot - payTop);
      ceil.setAttribute("y1", ceilY);
      ceil.setAttribute("y2", ceilY);
      ceilLbl.setAttribute("y", ceilY - 18);
      ceilNote.style.opacity = prog(f, S.at(2), S.at(2) + 16);
      barLbl.style.opacity = 1;
      items.forEach((it, k) => {
        const at = S.at(4 + k) - 4;
        const p = prog(f, at, at + 22);
        it.r.style.transform = `scaleX(${prog(f, at, at + 26, EIO)})`;
        fade(it.t1, p, 20);
        fade(it.t2, prog(f, at + 5, at + 26), 16);
        fade(it.t3, prog(f, at + 10, at + 30), 10);
      });
    };
  };

  // ---- 3. The approach: six steps and an India lens, each with its data and model
  SCENES.plan = (root, S) => {
    const head = rise(root, 120, 168, 1680, "Six steps, each with real data and one model", { fontSize: "80px", fontWeight: "600", letterSpacing: "-0.01em", lineHeight: "1.05" });
    const steps = [
      ["Price", "Price index, elasticity", "Epoch AI, LiteLLM, OpenRouter", "Price"],
      ["Use", "Rank correlation", "Microsoft, Anthropic, BLS", "use"],
      ["Adoption", "Event study", "Census BTOS, Indeed", "adoption"],
      ["Labour model", "Task model, CES", "BLS, O*NET", "labour model"],
      ["Market power", "HHI, Cournot, Bertrand", "OpenRouter shares", "market power"],
      ["Macroeconomy", "Solow, ideas, demand", "Penn World Table", "macroeconomy"],
      ["India", "Exposure, pay gaps", "PLFS 2025 microdata", null],
    ];
    const svg = svgLayer(root);
    const y = 540;
    const xs = steps.map((_, k) => 180 + k * 260);
    const track = sv("path", { fill: "none", stroke: C.ink, "stroke-width": 3 }, svg);
    const nodes = steps.map(([name, model, data, cue], k) => {
      const india = k === 6;
      const col = india ? C.human : C.ai;
      const dot = sv("circle", { cx: xs[k], cy: y, r: 16, fill: C.paper, stroke: col, "stroke-width": 5 }, svg);
      const num = box(root, xs[k] - 120, y - 150, 240, { textAlign: "center", fontFamily: SANS, fontSize: "26px", fontWeight: "700", color: col }, india ? "Lens" : `Chapter ${k + 1}`);
      const nm = box(root, xs[k] - 125, y - 108, 250, { textAlign: "center", fontSize: "35px", fontWeight: "600", lineHeight: "1.05" }, name);
      const md = box(root, xs[k] - 120, y + 48, 240, { textAlign: "center", fontFamily: SANS, fontSize: "27px", color: C.ink, lineHeight: "1.25" }, model);
      const dt = box(root, xs[k] - 120, y + 120, 240, { textAlign: "center", fontFamily: SANS, fontSize: "24px", color: C.faint, lineHeight: "1.25" }, data);
      return { dot, num, nm, md, dt, cue };
    });
    const at = nodes.map((nd, k) => (k === 6 ? S.at(2) : S.cue(1, nd.cue)));
    return (f) => {
      head.set(f, S.at(0) - 6, 1.6);
      // the track runs to each step as it is named
      let reach = xs[0];
      for (let k = 0; k < xs.length; k++) {
        const p = prog(f, at[k] - 10, at[k] + 6, EIO);
        if (k === 0) reach = xs[0] - 60 + 60 * p;
        else reach = Math.max(reach, lerp(xs[k - 1], xs[k], p));
      }
      track.setAttribute("d", `M${xs[0] - 60},${y}L${reach},${y}`);
      track.style.opacity = prog(f, at[0] - 14, at[0]);
      nodes.forEach((nd, k) => {
        const p = prog(f, at[k], at[k] + 18);
        nd.dot.setAttribute("r", 16 * prog(f, at[k] - 2, at[k] + 14, bezier(0.34, 1.56, 0.64, 1)));
        nd.dot.setAttribute("fill", f >= at[k] + 6 ? (k === 6 ? C.human : C.ai) : C.paper);
        fade(nd.num, p, 14);
        fade(nd.nm, p, 22);
        fade(nd.md, prog(f, at[k] + 6, at[k] + 24), 14);
        fade(nd.dt, prog(f, at[k] + 10, at[k] + 28), 10);
      });
    };
  };

  // ---- 4. Chapter 1: the price of intelligence
  SCENES.price = (root, S) => {
    const P = D.price;
    const n = P.length;
    const svg = svgLayer(root);
    const fig = figTitle(root, 120, 160, 1100, 1, "Cheapest price of GPT-4-level AI, US dollars per million tokens, log scale");
    const big = stat(root, 120, 222, 700, C.ai, "", 112);
    const grid = sv("g", {}, svg);
    const yTop = 380, yBot = 880;
    const Y = lg(60, 0.016, yTop, yBot);
    const gl = [[10, "$10"], [1, "$1"], [0.1, "$0.10"]].map(([v, l]) => ({
      line: sv("line", { y1: Y(v), y2: Y(v), stroke: C.rule, "stroke-width": 2, "stroke-dasharray": "1 9", "stroke-linecap": "round" }, grid),
      t: txt(grid, 0, Y(v) - 10, l, { fill: C.faint, "font-size": 24 }),
    }));
    const base = sv("line", { y1: yBot + 30, y2: yBot + 30, stroke: C.ink, "stroke-width": 2 }, grid);
    const years = P.map(([m], i) => (m.endsWith("-01") ? { i, t: txt(grid, 0, yBot + 70, m.slice(0, 4), { "text-anchor": "middle", "font-size": 26 }) } : null)).filter(Boolean);
    const trend = sv("path", { fill: "none", stroke: C.ink, "stroke-width": 3, "stroke-dasharray": "12 10" }, svg);
    const line = sv("path", { fill: "none", stroke: C.ai, "stroke-width": 6, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    const headDot = sv("circle", { r: 10, fill: C.ai }, svg);
    const trendLbl = box(root, 0, 0, 520, { fontFamily: SANS, fontSize: "32px", lineHeight: "1.25", color: C.ink, background: "rgba(255,255,255,0.9)" },
      `<b>Halves every ${D.priceFit.halving.toFixed(1)} months</b><br>a fall of about ${Math.round(D.priceFit.annualDecline)}% a year`);
    // log-linear trend fitted here on the plotted series (the report's fit uses the same data)
    const xs = P.map((_, i) => i);
    const ys = P.map(([, v]) => Math.log(v));
    const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    const icpt = my - slope * mx;
    // right-hand panel: Jevons, then the elasticity
    const vol = D.volume;
    const ratio = vol[vol.length - 1][1] / vol[0][1];
    const jev = stat(root, 1180, 380, 620, C.ai, `tokens a day on OpenRouter,<br>${monthName(vol[0][0])} to ${monthName(vol[vol.length - 1][0])}`, 150);
    const vsvg = sv("g", {}, svg);
    const vX = lin(0, vol.length - 1, 1190, 1780);
    const vY = lg(vol[0][1] * 0.8, vol[vol.length - 1][1] * 1.2, 840, 600);
    sv("line", { x1: 1190, x2: 1780, y1: 860, y2: 860, stroke: C.ink, "stroke-width": 2 }, vsvg);
    txt(vsvg, 1190, 898, monthName(vol[0][0]), { "font-size": 24 });
    txt(vsvg, 1780, 898, monthName(vol[vol.length - 1][0]), { "font-size": 24, "text-anchor": "end" });
    const vpts = vol.map(([, v], i) => [vX(i), vY(v)]);
    const vline = sv("path", { fill: "none", stroke: C.ai, "stroke-width": 5, "stroke-linecap": "round" }, vsvg);
    const el = D.elasticity;
    const eg = sv("g", {}, svg);
    const eX = lin(-1.5, 0.5, 1200, 1780);
    const eTitle = box(root, 1180, 380, 640, { fontFamily: SANS, fontSize: "30px", lineHeight: "1.3", color: C.ink }, "<b>Price elasticity of demand</b>, when one model changes its price");
    sv("line", { x1: eX(-1.5), x2: eX(0.5), y1: 640, y2: 640, stroke: C.ink, "stroke-width": 2 }, eg);
    [-1.5, -1, -0.5, 0, 0.5].forEach((v) => {
      sv("line", { x1: eX(v), x2: eX(v), y1: 640, y2: 652, stroke: C.ink, "stroke-width": 2 }, eg);
      txt(eg, eX(v), 690, v === 0 ? "0" : v.toFixed(1).replace("-", "−"), { "text-anchor": "middle", "font-size": 26 });
    });
    const refs = [[-1, "spending\nunchanged"], [0, "no\nresponse"]].map(([v, l]) => {
      const g = sv("g", {}, eg);
      sv("line", { x1: eX(v), x2: eX(v), y1: 500, y2: 640, stroke: C.faint, "stroke-width": 2, "stroke-dasharray": "6 6" }, g);
      l.split("\n").forEach((s, k) => txt(g, eX(v), 732 + k * 30, s, { "text-anchor": "middle", "font-size": 24, fill: C.faint }));
      return g;
    });
    const ci = sv("line", { y1: 580, y2: 580, stroke: C.ai, "stroke-width": 10, "stroke-linecap": "round" }, eg);
    const pt = sv("circle", { cx: eX(el.est), cy: 580, r: 15, fill: C.paper, stroke: C.ai, "stroke-width": 6 }, eg);
    const ptl = txt(eg, eX(el.est), 548, `−${Math.abs(el.est).toFixed(2)}`, { "text-anchor": "middle", "font-size": 40, "font-weight": 700, fill: C.ai });
    const ciLbl = txt(eg, eX(el.hi) + 18, 590, "95% interval", { "font-size": 24, fill: C.ai });
    const verdict = rise(root, 1180, 820, 640, "The data cannot yet settle it.", { fontSize: "44px", fontWeight: "600", fontStyle: "italic", color: C.human, lineHeight: "1.15" });

    return (f) => {
      // layout: the chart narrows to make room for the right-hand panel at sentence 4
      const narrow = prog(f, S.at(3) - 12, S.at(3) + 18, EIO);
      const x0 = 120, x1 = lerp(1780, 1040, narrow);
      const X = (i) => x0 + ((x1 - x0) * i) / (n - 1);
      gl.forEach((g) => {
        g.line.setAttribute("x1", x0);
        g.line.setAttribute("x2", x1);
        g.t.setAttribute("x", x0);
      });
      base.setAttribute("x1", x0);
      base.setAttribute("x2", x1);
      years.forEach((y) => y.t.setAttribute("x", X(y.i)));
      grid.style.opacity = prog(f, S.at(0) - 10, S.at(0) + 14);
      fade(fig, prog(f, S.at(0) - 10, S.at(0) + 10), 12);
      const pts = [];
      const vIdx = [];
      P.forEach(([, v], i) => {
        if (i > 0) { pts.push([X(i), Y(P[i - 1][1])]); vIdx.push(i - 1); }
        pts.push([X(i), Y(v)]);
        vIdx.push(i);
      });
      const p = prog(f, S.at(1), S.end(1) - 10, bezier(0.4, 0.05, 0.45, 1));
      const r = partial(pts, p);
      line.setAttribute("d", r.d);
      headDot.setAttribute("cx", r.head[0]);
      headDot.setAttribute("cy", r.head[1]);
      headDot.style.opacity = prog(f, S.at(1), S.at(1) + 6);
      const i = vIdx[r.idx];
      big.v.textContent = usd(P[i][1]);
      big.l.textContent = `${monthName(P[i][0])}, cheapest qualifying model: ${P[i][2]}`;
      fade(big.el, prog(f, S.at(1) - 4, S.at(1) + 10), 10);
      if (f > S.end(1)) {
        const x = Math.round(P[0][1] / P[n - 1][1]);
        big.l.textContent = `${monthName(P[n - 1][0])}: ${x.toLocaleString("en-US")} times cheaper than ${monthName(P[0][0])}`;
      }
      // fitted trend
      const tp = prog(f, S.at(2), S.at(2) + 30, EIO);
      const tpts = [];
      for (let k = 0; k <= 40; k++) {
        const ii = ((n - 1) * k) / 40;
        const yy = Y(Math.exp(icpt + slope * ii));
        if (yy <= yBot + 4) tpts.push([X(ii), yy]);
      }
      trend.setAttribute("d", partial(tpts, tp).d);
      const lp = prog(f, S.at(2) + 6, S.at(2) + 24);
      trendLbl.style.opacity = lp * (1 - narrow);
      trendLbl.style.transform = `translate(${X(n * 0.42)}px, ${Y(Math.exp(icpt + slope * n * 0.42)) - 140 + (1 - lp) * 14}px)`;
      // Jevons panel
      const jIn = prog(f, S.at(3) + 4, S.at(3) + 24);
      const jOut = prog(f, S.at(4) - 12, S.at(4) + 6, EIO);
      jev.el.style.opacity = jIn * (1 - jOut);
      jev.v.textContent = `×${fmt0(Math.exp(Math.log(ratio) * prog(f, S.at(3) + 6, S.cue(3, "480") + 12, bezier(0.3, 0, 0.2, 1))))}`;
      vline.setAttribute("d", partial(vpts, prog(f, S.at(3) + 6, S.cue(3, "480") + 12, EIO)).d);
      vsvg.style.opacity = jIn * (1 - jOut);
      // elasticity panel
      const eIn = prog(f, S.at(4), S.at(4) + 20);
      eg.style.opacity = eIn;
      fade(eTitle, eIn, 14);
      const cp = prog(f, S.cue(4, "interval"), S.cue(4, "interval") + 26, EIO);
      ci.setAttribute("x1", lerp(eX(el.est), eX(el.lo), cp));
      ci.setAttribute("x2", lerp(eX(el.est), eX(el.hi), cp));
      ci.style.opacity = cp > 0.001 ? 1 : 0;
      ciLbl.style.opacity = prog(f, S.cue(4, "interval") + 18, S.cue(4, "interval") + 32);
      pt.setAttribute("r", 15 * prog(f, S.cue(4, "elasticity"), S.cue(4, "elasticity") + 14, bezier(0.34, 1.56, 0.64, 1)));
      ptl.style.opacity = prog(f, S.cue(4, "elasticity") + 4, S.cue(4, "elasticity") + 18);
      refs[0].style.opacity = prog(f, S.cue(4, "and −1") - 6, S.cue(4, "and −1") + 10);
      refs[1].style.opacity = prog(f, S.cue(4, "both zero") - 6, S.cue(4, "both zero") + 10);
      verdict.set(f, S.at(5) - 4, 2.2);
    };
  };

  // ---- 5. Chapter 2: where AI is used
  SCENES.use = (root, S) => {
    const svg = svgLayer(root);
    const fig = figTitle(root, 120, 160, 1000, 2, "591 US occupations: Microsoft’s applicability score against Claude usage relative to employment");
    const x0 = 160, x1 = 1060, yTop = 290, yBot = 800, yZero = 870;
    const X = lin(0, 0.5, x0, x1);
    const Y = lg(1000, 0.003, yTop, yBot);
    const grid = sv("g", {}, svg);
    [[100, "100×"], [10, "10×"], [1, "1× (usage in line with jobs)"], [0.1, "0.1×"], [0.01, "0.01×"]].forEach(([v, l]) => {
      sv("line", { x1: x0, x2: x1, y1: Y(v), y2: Y(v), stroke: v === 1 ? C.faint : C.rule, "stroke-width": 2, "stroke-dasharray": v === 1 ? "8 8" : "1 9", "stroke-linecap": "round" }, grid);
      txt(grid, x0, Y(v) - 10, l, { fill: C.faint, "font-size": 22, stroke: C.paper, "stroke-width": 6, "paint-order": "stroke", "stroke-linejoin": "round" });
    });
    txt(grid, x0, yZero - 26, "no published usage", { fill: C.faint, "font-size": 22 });
    sv("line", { x1: x0, x2: x1, y1: yZero + 26, y2: yZero + 26, stroke: C.ink, "stroke-width": 2 }, grid);
    [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach((v) => {
      sv("line", { x1: X(v), x2: X(v), y1: yZero + 26, y2: yZero + 38, stroke: C.ink, "stroke-width": 2 }, grid);
      txt(grid, X(v), yZero + 72, v.toFixed(1), { "text-anchor": "middle", "font-size": 24 });
    });
    txt(grid, x1, yZero + 72, "", {});
    const pts = D.scatter
      .map(([a, r, emp, g]) => ({ x: X(a), y: r > 0 ? Y(r) : yZero + (Math.sin(a * 997) * 8), r: 3 + Math.sqrt(emp) / 120, comp: g === 15 }))
      .sort((a, b) => a.x - b.x);
    const dots = pts.map((d) => sv("circle", { cx: d.x, cy: d.y, r: 0, fill: d.comp ? C.ai : C.faint, "fill-opacity": d.comp ? 0.85 : 0.35 }, svg));
    svg.appendChild(grid);
    const rho1 = stat(root, 1200, 290, 600, C.ink, "rank correlation across 591 occupations", 112);
    const rho2 = stat(root, 1200, 500, 600, C.ink, "across the 22 job families", 112);
    // computer and maths: share of jobs against share of usage
    const cm = D.groups.find((g) => /Computer/.test(g[0]));
    const bars = box(root, 1200, 290, 600, { fontFamily: SANS });
    ht("div", { fontSize: "34px", fontWeight: "700", lineHeight: "1.2" }, bars, "Computer and mathematical jobs");
    const mk = (label, col, v) => {
      const wrap = ht("div", { marginTop: "26px" }, bars);
      const lab = ht("div", { fontSize: "28px", color: C.soft }, wrap, label);
      const row = ht("div", { display: "flex", alignItems: "center", gap: "16px", marginTop: "8px" }, wrap);
      const b = ht("div", { height: "46px", background: col, width: "0px" }, row);
      const num = ht("div", { fontSize: "52px", fontWeight: "600", color: col }, row);
      num.className = "num";
      return { b, num, v };
    };
    const b1 = mk("Share of US employment", C.human, cm[1]);
    const b2 = mk("Share of Claude usage", C.ai, cm[2]);
    const claim = rise(root, 1200, 720, 600, "Exposure is real, but concentrated.", { fontSize: "56px", fontWeight: "600", lineHeight: "1.1" });
    return (f) => {
      fade(fig, prog(f, S.at(0) - 8, S.at(0) + 12), 12);
      grid.style.opacity = prog(f, S.at(0) - 4, S.at(0) + 16);
      const a = S.at(1) - 4;
      const span = sec(2.6);
      dots.forEach((d, k) => {
        const t = a + (k / dots.length) * span;
        d.setAttribute("r", pts[k].r * prog(f, t, t + 10, bezier(0.34, 1.56, 0.64, 1)));
      });
      const r1 = prog(f, S.cue(1, "correlation"), S.cue(1, "correlation") + 20);
      rho1.v.textContent = `ρ = ${(0.45 * prog(f, S.cue(1, "correlation"), S.cue(1, "correlation") + 26, EO)).toFixed(2)}`;
      const out = prog(f, S.at(2) - 12, S.at(2) + 4, EIO);
      rho1.el.style.opacity = r1 * (1 - out);
      const c2 = S.cue(1, "whole job families");
      rho2.v.textContent = `ρ = ${(0.8 * prog(f, c2, c2 + 26, EO)).toFixed(2)}`;
      rho2.el.style.opacity = prog(f, c2, c2 + 18) * (1 - out);
      bars.style.opacity = prog(f, S.at(2), S.at(2) + 14);
      [b1, b2].forEach((b, k) => {
        const p = prog(f, S.at(2) + 6 + k * 12, S.at(2) + 36 + k * 12, EO);
        b.b.style.width = `${(b.v / 26) * 430 * p}px`;
        b.num.textContent = `${(b.v * p).toFixed(1)}%`;
      });
      claim.set(f, S.at(3) - 4, 2);
    };
  };

  // ---- 6. Chapter 3: adoption in the economy
  SCENES.adoption = (root, S) => {
    const svg = svgLayer(root);
    // left: firms using AI
    const b = D.btos;
    const fig1 = figTitle(root, 120, 160, 520, 3, "US firms using AI, percent, fortnightly");
    const bX = lin(0, b.length - 1, 130, 600);
    const bY = lin(10, 30, 800, 380);
    const bg = sv("g", {}, svg);
    [10, 20, 30].forEach((v) => {
      sv("line", { x1: 130, x2: 600, y1: bY(v), y2: bY(v), stroke: C.rule, "stroke-width": 2, "stroke-dasharray": "1 9", "stroke-linecap": "round" }, bg);
      txt(bg, 130, bY(v) - 10, `${v}%`, { fill: C.faint, "font-size": 24 });
    });
    txt(bg, 130, 850, "Nov 2025", { "font-size": 24 });
    txt(bg, 600, 850, "Nov 2026", { "font-size": 24, "text-anchor": "end" });
    const bline = sv("path", { fill: "none", stroke: C.ai, "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    const bpts = b.map(([, v], i) => [bX(i), bY(v)]);
    const bnum = box(root, 0, 0, 200, { fontFamily: SANS, fontSize: "56px", fontWeight: "600", color: C.ai, whiteSpace: "nowrap" });
    bnum.className = "num";
    // right: postings, most against least exposed third
    const hi = D.postings.high, lo = D.postings.low;
    const fig2 = figTitle(root, 760, 160, 1040, "", "Job postings in the most and least AI-exposed thirds of job categories, US, Jan–Oct 2022 = 100");
    fig2.innerHTML = fig2.innerHTML.replace("Figure .", "Figure 4.");
    const m0 = mi(hi[0][0]), m1 = mi(hi[hi.length - 1][0]);
    const pX = lin(m0, m1, 780, 1780);
    const pY = lin(40, 140, 860, 300);
    const pg = sv("g", {}, svg);
    [50, 75, 100, 125].forEach((v) => {
      sv("line", { x1: 780, x2: 1780, y1: pY(v), y2: pY(v), stroke: v === 100 ? C.faint : C.rule, "stroke-width": 2, "stroke-dasharray": v === 100 ? "8 8" : "1 9", "stroke-linecap": "round" }, pg);
      txt(pg, 780, pY(v) - 10, `${v}`, { fill: C.faint, "font-size": 24 });
    });
    const base = sv("rect", { x: pX(mi("2022-01")), width: pX(mi("2022-10")) - pX(mi("2022-01")), y: 300, height: 560, fill: C.paper2 }, pg);
    pg.insertBefore(base, pg.firstChild);
    const baseLbl = txt(svg, pX(mi("2022-01")) + 6, 848, "baseline", { "font-size": 20, fill: C.faint });
    [2021, 2022, 2023, 2024, 2025, 2026].forEach((y) => txt(pg, pX(y * 12 + 6), 900, `${y}`, { "text-anchor": "middle", "font-size": 24 }));
    const gap = sv("path", { fill: C.aiSoft, stroke: "none" }, svg);
    const early = sv("rect", { x: pX(mi("2022-06")), width: pX(mi("2022-11")) - pX(mi("2022-06")), y: 300, height: 560, fill: C.humanSoft, opacity: 0 }, svg);
    const earlyLbl = box(root, pX(mi("2022-06")) - 262, 306, 250, { fontFamily: SANS, fontSize: "24px", color: C.human, fontWeight: "600", textAlign: "right", lineHeight: "1.2" }, "the gap opens here, before the launch");
    svg.appendChild(baseLbl);
    const launch = sv("line", { x1: pX(mi("2022-11")) + 0.97 * (pX(1) - pX(0)), x2: pX(mi("2022-11")) + 0.97 * (pX(1) - pX(0)), y1: 300, y2: 860, stroke: C.ink, "stroke-width": 3 }, svg);
    const launchLbl = box(root, pX(mi("2022-12")) + 12, 300, 260, { fontFamily: SANS, fontSize: "24px", fontWeight: "600", lineHeight: "1.2" }, "ChatGPT launch,<br>30 Nov 2022");
    const lineHi = sv("path", { fill: "none", stroke: C.ai, "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    const lineLo = sv("path", { fill: "none", stroke: C.ink, "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    const hpts = hi.map(([m, v]) => [pX(mi(m)), pY(v)]);
    const lpts = lo.map(([m, v]) => [pX(mi(m)), pY(v)]);
    const lblHi = box(root, 0, 0, 260, { fontFamily: SANS, fontSize: "26px", fontWeight: "700", color: C.ai, lineHeight: "1.15" }, "most exposed third");
    const lblLo = box(root, 0, 0, 260, { fontFamily: SANS, fontSize: "26px", fontWeight: "700", color: C.ink, lineHeight: "1.15" }, "least exposed third");
    const es = D.eventStudy;
    const gapLbl = box(root, 1420, 360, 380, { fontFamily: SANS, color: C.ai, lineHeight: "1.2", background: "rgba(255,255,255,0.85)" },
      `<div class="num" style="font-size:72px;font-weight:600">−${Math.abs(es.pct).toFixed(0)}%</div><div style="font-size:24px;color:${C.soft}">most against least exposed, Dec 2022 to Oct 2026; 95% interval −${Math.abs(es.lo).toFixed(0)}% to −${Math.abs(es.hi).toFixed(0)}%</div>`);
    const claim = rise(root, 120, 900, 560, "A pattern, not proof.", { fontSize: "52px", fontWeight: "600", fontStyle: "italic", color: C.human });
    return (f) => {
      fade(fig1, prog(f, S.at(0) - 8, S.at(0) + 12), 12);
      fade(fig2, prog(f, S.at(0), S.at(0) + 20), 12);
      bg.style.opacity = prog(f, S.at(0) - 4, S.at(0) + 16);
      pg.style.opacity = prog(f, S.at(0) + 4, S.at(0) + 24);
      baseLbl.style.opacity = pg.style.opacity;
      const bp = prog(f, S.at(1), S.end(1), bezier(0.4, 0.05, 0.4, 1));
      const br = partial(bpts, bp);
      bline.setAttribute("d", br.d);
      const bi = Math.min(b.length - 1, Math.round(((br.head[0] - 130) / 470) * (b.length - 1)));
      bnum.textContent = `${b[bi][1].toFixed(0)}%`;
      bnum.style.transform = `translate(${br.head[0] - (bp > 0.6 ? 110 : -14)}px, ${br.head[1] - 88}px)`;
      bnum.style.opacity = prog(f, S.at(1), S.at(1) + 8);
      const pp = prog(f, S.at(2) - 6, S.at(2) + sec(3.4), bezier(0.4, 0.05, 0.4, 1));
      const rh = partial(hpts, pp), rl = partial(lpts, pp);
      lineHi.setAttribute("d", rh.d);
      lineLo.setAttribute("d", rl.d);
      lblHi.style.transform = `translate(${rh.head[0] - 250}px, ${rh.head[1] + 22}px)`;
      lblLo.style.transform = `translate(${rl.head[0] - 250}px, ${rl.head[1] - 76}px)`;
      lblHi.style.opacity = prog(f, S.at(2) + 30, S.at(2) + 46);
      lblLo.style.opacity = prog(f, S.at(2) + 30, S.at(2) + 46);
      // shaded gap after the launch
      const gp = prog(f, S.cue(2, "24 percent") - 10, S.cue(2, "24 percent") + 20);
      const k0 = hi.findIndex(([m]) => m === "2022-12");
      const top = lpts.slice(k0), bot = hpts.slice(k0).reverse();
      gap.setAttribute("d", polyline(top.concat(bot)) + "Z");
      gap.style.opacity = gp;
      fade(gapLbl, prog(f, S.cue(2, "24 percent"), S.cue(2, "24 percent") + 18), 16);
      const lp = prog(f, S.cue(3, "ChatGPT") - 6, S.cue(3, "ChatGPT") + 16, EIO);
      launch.setAttribute("y1", lerp(860, 300, lp));
      launch.style.opacity = lp > 0 ? 1 : 0;
      launchLbl.style.opacity = prog(f, S.cue(3, "ChatGPT") + 4, S.cue(3, "ChatGPT") + 18);
      const ep = prog(f, S.cue(3, "opening"), S.cue(3, "opening") + 18);
      early.setAttribute("opacity", ep);
      fade(earlyLbl, ep, 10);
      claim.set(f, S.at(4) - 4, 2.2);
    };
  };

  // ---- 7. Chapter 4: the labour model
  SCENES.model = (root, S) => {
    const svg = svgLayer(root);
    const fig = figTitle(root, 120, 160, 1180, 5, "The task model: each task goes to whoever does it more cheaply, a person or AI");
    const x0 = 150, x1 = 1220, yTop = 300, yBot = 830;
    const X = lin(0, 1, x0, x1);
    const base = { rho: 5, A: 0.5, theta: 1.5, sigma: 1.0, n: 0, eta: 1 };
    const Y = lg(0.75, 7.5, yBot, yTop);
    const g = sv("g", {}, svg);
    sv("line", { x1: x0, x2: x1, y1: yBot, y2: yBot, stroke: C.ink, "stroke-width": 2 }, g);
    txt(g, x0, yBot + 44, "Tasks people do best", { "font-size": 26, fill: C.soft });
    txt(g, x1, yBot + 44, "Tasks AI does best", { "font-size": 26, fill: C.soft, "text-anchor": "end" });
    txt(g, x1, yTop - 16, "Cost of one task, in hours of a person’s pay (log scale)", { "font-size": 24, fill: C.faint, "text-anchor": "end" });
    const shade = sv("rect", { y: yTop, height: yBot - yTop, fill: C.aiSoft }, svg);
    svg.insertBefore(shade, svg.firstChild);
    const canLine = sv("line", { y1: yTop, y2: yBot, stroke: C.ai, "stroke-width": 3, "stroke-dasharray": "10 8" }, svg);
    const canLbl = box(root, 0, yTop + 12, 260, { fontFamily: SANS, fontSize: "24px", color: C.ai, fontWeight: "600", lineHeight: "1.2" }, "AI can do the tasks right of this line");
    const human = sv("path", { fill: "none", stroke: C.human, "stroke-width": 6, "stroke-linecap": "round" }, svg);
    const humanLbl = txt(svg, 0, 0, "A person’s cost", { "font-size": 28, fill: C.human, "font-weight": 700 });
    const ai = sv("line", { x1: x0, x2: x1, stroke: C.ai, "stroke-width": 6, "stroke-linecap": "round" }, svg);
    const aiLbl = txt(svg, x0 + 8, 0, "AI’s cost per task", { "font-size": 28, fill: C.ai, "font-weight": 700, stroke: C.paper, "stroke-width": 7, "paint-order": "stroke", "stroke-linejoin": "round" });
    const cross = sv("circle", { r: 12, fill: C.paper, stroke: C.ink, "stroke-width": 5 }, svg);
    // readouts
    const ro = box(root, 1320, 300, 480, { fontFamily: SANS });
    const read = (label, col) => {
      const el = ht("div", { marginBottom: "34px" }, ro);
      const v = ht("div", { fontSize: "84px", fontWeight: "600", color: col, lineHeight: "1" }, el);
      v.className = "num";
      ht("div", { fontSize: "28px", color: C.soft, marginTop: "8px" }, el, label);
      return { el, v };
    };
    const rAI = read("of tasks done by AI", C.ai);
    const rW = read("real wage, against a world without AI", C.human);
    const rS = read("labour share of income", C.ink);
    const corner = box(root, 0, 0, 380, { fontFamily: SANS, fontSize: "26px", fontWeight: "600", color: C.ink, lineHeight: "1.25", background: "rgba(255,255,255,0.9)" },
      "The corner: a lower price no longer changes who does the work");
    const tokens = box(root, 1320, 300, 480, { fontFamily: SANS });
    tokens.innerHTML = `<div style="font-size:30px;font-weight:700;line-height:1.25">One hour of work, at a million tokens</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:26px;border-top:3px solid ${C.ink};padding-top:14px"><span style="font-size:28px;color:${C.soft}">Tokens, GPT-5-level model</span><span class="num" style="font-size:52px;font-weight:600;color:${C.ai}">$0.09</span></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;border-top:1px solid ${C.rule};padding-top:14px"><span style="font-size:28px;color:${C.soft}">Average US pay</span><span class="num" style="font-size:52px;font-weight:600;color:${C.human}">$33.36</span></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;border-top:1px solid ${C.rule};padding-top:14px"><span style="font-size:28px;color:${C.soft}">Tokens as a share of pay</span><span class="num" style="font-size:52px;font-weight:600">0.3%</span></div>
      <div style="font-size:22px;color:${C.faint};margin-top:18px;line-height:1.3">Cheapest listed price at that capability, Nov 2026; BLS mean hourly wage, May 2025.</div>`;
    const rhoAt = (f) => {
      const a = prog(f, S.at(2) - 6, S.end(2), EIO);
      const b = prog(f, S.at(3), S.end(3) + 20, EIO);
      return Math.exp(lerp(Math.log(5), lerp(Math.log(1.6), Math.log(1.2), b), a));
    };
    return (f) => {
      fade(fig, prog(f, S.at(0) - 8, S.at(0) + 12), 12);
      g.style.opacity = prog(f, S.at(0), S.at(0) + 18);
      const A = lerp(0.5, 0.72, prog(f, S.cue(4, "how much it can do"), S.cue(4, "how much it can do") + 30, EIO));
      const p = { ...base, rho: rhoAt(f), A };
      const r = simulateM4(p);
      // person's cost curve w * exp(theta * i)
      const hp = [];
      for (let k = 0; k <= 60; k++) {
        const i = k / 60;
        hp.push([X(i), Y(Math.exp(p.theta * i))]);
      }
      human.setAttribute("d", partial(hp, prog(f, S.at(1) - 6, S.at(1) + 30, EIO)).d);
      humanLbl.setAttribute("x", X(0.02));
      humanLbl.setAttribute("y", Y(1) + 46);
      humanLbl.style.opacity = prog(f, S.at(1) + 10, S.at(1) + 24);
      const aiIn = prog(f, S.cue(1, "AI at others") - 6, S.cue(1, "AI at others") + 14);
      const yR = clamp(Y(r.R / r.w), yTop - 30, yBot);
      ai.setAttribute("y1", yR);
      ai.setAttribute("y2", yR);
      ai.style.opacity = aiIn;
      aiLbl.setAttribute("y", yR - 16);
      aiLbl.style.opacity = aiIn;
      const xa = X(r.ia);
      const xc = X(1 - p.A);
      canLine.setAttribute("x1", xc);
      canLine.setAttribute("x2", xc);
      canLine.style.opacity = prog(f, S.cue(1, "cheaper") - 4, S.cue(1, "cheaper") + 14);
      canLbl.style.transform = `translateX(${xc + 16}px)`;
      canLbl.style.opacity = prog(f, S.cue(1, "cheaper"), S.cue(1, "cheaper") + 18);
      shade.setAttribute("x", Math.min(xa, x1));
      shade.setAttribute("width", Math.max(0, x1 - xa));
      shade.style.opacity = prog(f, S.cue(1, "cheaper") + 6, S.cue(1, "cheaper") + 24);
      const istar = Math.log(r.R / r.w) / p.theta;
      const showCross = istar > 1 - p.A && istar < 1;
      cross.setAttribute("cx", X(clamp(istar)));
      cross.setAttribute("cy", yR);
      cross.style.opacity = showCross ? prog(f, S.at(2), S.at(2) + 10) : 0;
      ro.style.opacity = prog(f, S.at(2) - 6, S.at(2) + 12) * (1 - prog(f, S.at(5) - 12, S.at(5) + 4, EIO));
      rAI.v.textContent = `${Math.round(r.aiShare * 100)}%`;
      rW.v.textContent = `×${r.relWage.toFixed(2)}`;
      rS.v.textContent = `${Math.round(r.labourShare * 100)}%`;
      const cp = !showCross && f > S.at(3) ? prog(f, S.cue(3, "only while"), S.cue(3, "only while") + 20) : 0;
      corner.style.opacity = cp * (1 - prog(f, S.at(5) - 12, S.at(5) + 4, EIO));
      corner.style.transform = `translate(${xc + 20}px, ${yBot - 230}px)`;
      fade(tokens, prog(f, S.at(5), S.at(5) + 18), 16);
    };
  };

  // ---- 8. Chapter 5: market structure and power
  SCENES.market = (root, S) => {
    const svg = svgLayer(root);
    const fig = figTitle(root, 120, 160, 1300, 6, "Concentration of AI model sales on OpenRouter: Herfindahl–Hirschman index by firm, monthly");
    const Hh = D.hhi;
    const x0 = 150, xs0 = 230, yTop = 300, yBot = 720;
    const Y = lin(0, 3600, yBot, yTop);
    const g = sv("g", {}, svg);
    const grid = [0, 1000, 2000, 3000].map((v) => ({
      l: sv("line", { x1: x0, y1: Y(v), y2: Y(v), stroke: v === 0 ? C.ink : C.rule, "stroke-width": 2, "stroke-dasharray": v === 0 ? "" : "1 9", "stroke-linecap": "round" }, g),
      t: txt(g, x0, Y(v) - 10, v.toLocaleString("en-US"), { fill: C.faint, "font-size": 24 }),
    }));
    const hl = sv("line", { x1: x0, y1: Y(1800), y2: Y(1800), stroke: C.owner, "stroke-width": 3, "stroke-dasharray": "10 8" }, g);
    const hlT = txt(g, xs0 + 4, Y(1800) + 36, "1,800: highly concentrated (US merger guidelines)", { fill: C.owner, "font-size": 24, "font-weight": 600 });
    const line = sv("path", { fill: "none", stroke: C.owner, "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    const callouts = [
      ["2025-01", "about 3,070"],
      ["2026-04", "990"],
      ["2026-10", "about 1,580"],
    ].map(([m, s], k) => {
      const i = Hh.findIndex((r) => r[0] === m);
      const el = box(root, 0, 0, 260, { fontFamily: SANS, textAlign: "center" });
      el.innerHTML = `<div class="num" style="font-size:44px;font-weight:600;color:${C.owner}">${Math.round(Hh[i][1]).toLocaleString("en-US")}</div><div style="font-size:22px;color:${C.soft}">${monthName(m)}</div>`;
      const dot = sv("circle", { r: 0, fill: C.paper, stroke: C.owner, "stroke-width": 5 }, svg);
      return { i, el, dot, cue: ["three thousand", "nine hundred", "fifteen hundred"][k] };
    });
    const sayT = S.segs[1].text;
    // leader strip
    const strip = sv("g", {}, svg);
    const stripLbl = box(root, 120, 760, 600, { fontFamily: SANS, fontSize: "26px", fontWeight: "700" }, "Largest firm each month");
    const runs = [];
    Hh.forEach(([m, , who], i) => {
      if (!runs.length || runs[runs.length - 1].who !== who) runs.push({ who, a: i, b: i });
      else runs[runs.length - 1].b = i;
    });
    const tones = [C.ink, C.soft, "#8a8b8f", C.faint];
    const firms = [...new Set(runs.map((r) => r.who))];
    const runEls = runs.map((r) => ({
      r,
      rect: sv("rect", { y: 808, height: 46, fill: tones[firms.indexOf(r.who) % tones.length] }, strip),
      t: txt(strip, 0, 840, r.who, { fill: C.paper, "font-size": 24, "font-weight": 700 }),
    }));
    const changes = box(root, 0, 870, 400, { fontFamily: SANS, fontSize: "26px", color: C.ink, fontWeight: "600" }, "5 changes of leader in 23 months");
    // hosts panel
    const h = D.hosts;
    const pct = (c) => (Math.pow(2, c) - 1) * 100;
    const hp = box(root, 1300, 300, 500, { fontFamily: SANS });
    hp.innerHTML = `<div style="font-size:30px;font-weight:700;line-height:1.25">Open-weights models: twice as many hosts</div>
      <div class="num" style="font-size:120px;font-weight:600;color:${C.ok};line-height:1;margin-top:18px">−${Math.abs(pct(h.coef)).toFixed(0)}%</div>
      <div style="font-size:28px;color:${C.soft};margin-top:10px;line-height:1.3">lowest price, 95% interval −${Math.abs(pct(h.lo)).toFixed(0)}% to −${Math.abs(pct(h.hi)).toFixed(0)}%, ${h.models} models</div>
      <div style="font-size:28px;margin-top:22px;line-height:1.3;color:${C.ink}">As Bertrand price competition predicts</div>`;
    return (f) => {
      fade(fig, prog(f, S.at(0) - 8, S.at(0) + 12), 12);
      const narrow = prog(f, S.at(3) - 10, S.at(3) + 18, EIO);
      const x1 = lerp(1780, 1200, narrow);
      const X = lin(0, Hh.length - 1, xs0, x1);
      grid.forEach((q) => q.l.setAttribute("x2", x1));
      hl.setAttribute("x2", x1);
      g.style.opacity = prog(f, S.at(0), S.at(0) + 16);
      hlT.style.opacity = prog(f, S.at(1) - 10, S.at(1) + 10) * (1 - narrow);
      const pts = Hh.map(([, v], i) => [X(i), Y(v)]);
      const p = prog(f, S.at(1), S.end(1) - 6, bezier(0.4, 0.05, 0.45, 1));
      line.setAttribute("d", partial(pts, p).d);
      callouts.forEach((c) => {
        const ci = sayT.indexOf(c.cue) >= 0 ? sayT.indexOf(c.cue) : 0;
        const at = S.at(1) + (S.segs[1].len * (c.i / (Hh.length - 1))) * 0.9;
        const q = prog(f, at, at + 16);
        c.dot.setAttribute("cx", X(c.i));
        c.dot.setAttribute("cy", Y(Hh[c.i][1]));
        c.dot.setAttribute("r", 11 * prog(f, at, at + 14, bezier(0.34, 1.56, 0.64, 1)));
        const below = Hh[c.i][0] === "2026-04";
        c.el.style.transform = `translate(${X(c.i) - (c.i === 0 ? 20 : 130)}px, ${Y(Hh[c.i][1]) + (below ? 22 : -104)}px)`;
        c.el.style.opacity = q;
        void ci;
      });
      const sp = prog(f, S.at(2) - 4, S.at(2) + 24, EIO);
      runEls.forEach(({ r, rect, t }) => {
        const xa = X(r.a) - (X(1) - X(0)) / 2, xb = X(r.b) + (X(1) - X(0)) / 2;
        const reveal = clamp((sp * (Hh.length + 2) - r.a) / 3);
        rect.setAttribute("x", xa);
        rect.setAttribute("width", Math.max(0, (xb - xa - 4) * reveal));
        t.setAttribute("x", xa + 10);
        t.style.opacity = reveal > 0.9 && xb - xa > 100 ? 1 : 0;
      });
      stripLbl.style.opacity = sp > 0 ? prog(f, S.at(2) - 4, S.at(2) + 10) : 0;
      changes.style.transform = `translateX(${x1 - 400}px)`;
      changes.style.textAlign = "right";
      changes.style.opacity = prog(f, S.cue(2, "five"), S.cue(2, "five") + 16);
      fade(hp, prog(f, S.at(3) + 4, S.at(3) + 24), 16);
    };
  };

  // ---- 9. Chapter 6: macroeconomics and policy
  SCENES.macro = (root, S) => {
    const svg = svgLayer(root);
    const fig = figTitle(root, 120, 160, 880, 7, "Labour share of income after 30 years, by how easily compute substitutes for labour (USA model)");
    const L = D.labourShareBySigma;
    const X = lin(0.4, 3.1, 170, 980);
    const Y = lin(30, 65, 860, 330);
    const g = sv("g", {}, svg);
    [30, 40, 50, 60].forEach((v) => {
      sv("line", { x1: 170, x2: 980, y1: Y(v), y2: Y(v), stroke: C.rule, "stroke-width": 2, "stroke-dasharray": "1 9", "stroke-linecap": "round" }, g);
      txt(g, 170, Y(v) - 10, `${v}%`, { fill: C.faint, "font-size": 24 });
    });
    sv("line", { x1: 170, x2: 980, y1: 860, y2: 860, stroke: C.ink, "stroke-width": 2 }, g);
    [0.5, 1, 2, 3].forEach((v) => txt(g, X(v), 900, `${v}`, { "text-anchor": "middle", "font-size": 24 }));
    txt(g, 980, 940, "elasticity of substitution", { "text-anchor": "end", "font-size": 24, fill: C.faint });
    const subs = sv("rect", { x: X(1), width: 980 - X(1), y: 330, height: 530, fill: C.humanSoft }, svg);
    svg.insertBefore(subs, svg.firstChild);
    const div = sv("line", { x1: X(1), x2: X(1), y1: 330, y2: 860, stroke: C.ink, "stroke-width": 3 }, svg);
    const divA = txt(svg, X(1) - 14, 366, "complements", { "text-anchor": "end", "font-size": 26, "font-weight": 600, fill: C.soft });
    const divB = txt(svg, X(1) + 14, 366, "substitutes", { "font-size": 26, "font-weight": 600, fill: C.human });
    const today = sv("line", { x1: 170, x2: 980, y1: Y(D.labourShareToday), y2: Y(D.labourShareToday), stroke: C.ink, "stroke-width": 2, "stroke-dasharray": "8 8" }, svg);
    const todayT = txt(svg, 176, Y(D.labourShareToday) + 34, `today ${D.labourShareToday}%`, { "font-size": 24, fill: C.ink });
    const pts = L.map(([s, v]) => [X(s), Y(v)]);
    const line = sv("path", { fill: "none", stroke: C.human, "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    const dots = L.map(([s, v]) => sv("circle", { cx: X(s), cy: Y(v), r: 0, fill: C.human }, svg));
    const lastT = txt(svg, X(3) - 10, Y(37.3) + 46, "37%", { "font-size": 34, "font-weight": 700, fill: C.human, "text-anchor": "end" });
    // spending out of a dollar
    const sp = box(root, 1120, 300, 680, { fontFamily: SANS });
    ht("div", { fontSize: "30px", fontWeight: "700" }, sp, "Spent out of each extra dollar");
    const sbar = (label, col, v) => {
      const row = ht("div", { display: "flex", alignItems: "center", gap: "16px", marginTop: "18px" }, sp);
      ht("div", { width: "150px", fontSize: "28px", color: C.soft }, row, label);
      const b = ht("div", { height: "44px", background: col, width: "0" }, row);
      const n = ht("div", { fontSize: "44px", fontWeight: "600", color: col }, row);
      n.className = "num";
      return { b, n, v };
    };
    const s1 = sbar("Workers", C.human, 95);
    const s2 = sbar("Owners", C.owner, 58);
    // automation tax range
    const tx = box(root, 1120, 620, 680, { fontFamily: SANS });
    tx.innerHTML = `<div style="font-size:30px;font-weight:700;line-height:1.25">Welfare-best automation tax, paid out as a basic income</div>`;
    const tsvg = sv("g", {}, svg);
    const tX = lin(0, 100, 1130, 1770);
    sv("line", { x1: tX(0), x2: tX(100), y1: 800, y2: 800, stroke: C.ink, "stroke-width": 2 }, tsvg);
    [0, 25, 50, 75, 100].forEach((v) => {
      sv("line", { x1: tX(v), x2: tX(v), y1: 800, y2: 812, stroke: C.ink, "stroke-width": 2 }, tsvg);
      txt(tsvg, tX(v), 846, `${v}%`, { "text-anchor": "middle", "font-size": 24 });
    });
    const band = sv("rect", { y: 740, height: 44, fill: C.owner, rx: 3 }, tsvg);
    const bandT = txt(tsvg, tX(53.5), 724, "12% to 95%, depending on assumptions", { "text-anchor": "middle", "font-size": 26, "font-weight": 600, fill: C.owner });
    const claim = rise(root, 1120, 880, 680, "It depends on parameters we cannot yet measure.", { fontSize: "40px", fontWeight: "600", fontStyle: "italic", color: C.ink, lineHeight: "1.15" });
    return (f) => {
      fade(fig, prog(f, S.at(0) - 8, S.at(0) + 12), 12);
      g.style.opacity = prog(f, S.at(0), S.at(0) + 16);
      today.style.opacity = todayT.style.opacity = prog(f, S.at(1), S.at(1) + 16);
      const lp = prog(f, S.at(1) + 10, S.cue(1, "only if") + 10, bezier(0.4, 0.05, 0.4, 1));
      line.setAttribute("d", partial(pts, lp).d);
      dots.forEach((d, k) => d.setAttribute("r", 9 * prog(f, S.at(1) + 10 + (k / 4) * (S.cue(1, "only if") - S.at(1)), S.at(1) + 22 + (k / 4) * (S.cue(1, "only if") - S.at(1)))));
      const dv = prog(f, S.cue(1, "substitutes"), S.cue(1, "substitutes") + 18);
      div.style.opacity = divA.style.opacity = divB.style.opacity = dv;
      subs.style.opacity = prog(f, S.cue(1, "elasticity above"), S.cue(1, "elasticity above") + 20);
      lastT.style.opacity = prog(f, S.cue(1, "elasticity above"), S.cue(1, "elasticity above") + 16);
      sp.style.opacity = prog(f, S.at(2) - 4, S.at(2) + 12);
      [s1, s2].forEach((s, k) => {
        const p = prog(f, S.at(2) + 4 + k * 10, S.at(2) + 34 + k * 10);
        s.b.style.width = `${4.2 * s.v * p}px`;
        s.n.textContent = `${Math.round(s.v * p)}¢`;
      });
      tx.style.opacity = prog(f, S.at(3), S.at(3) + 14);
      tsvg.style.opacity = prog(f, S.at(3), S.at(3) + 14);
      const bp = prog(f, S.cue(3, "ranges"), S.cue(3, "ranges") + 30, EIO);
      band.setAttribute("x", lerp(tX(53.5), tX(12), bp));
      band.setAttribute("width", lerp(0, tX(95) - tX(12), bp));
      bandT.style.opacity = prog(f, S.cue(3, "ranges") + 14, S.cue(3, "ranges") + 30);
      claim.set(f, S.at(4) - 4, 1.8);
    };
  };

  // ---- 10. Chapter 7: India
  SCENES.india = (root, S) => {
    const svg = svgLayer(root);
    const fig = figTitle(root, 120, 160, 960, 8, "Indian workers by how exposed their occupation is, measured against US workers (PLFS 2025)");
    const bins = Array.from({ length: 10 }, () => 0);
    D.indiaOcc.forEach(([pc, share]) => { bins[Math.min(9, Math.floor(pc / 10))] += share; });
    const tot = bins.reduce((a, b) => a + b, 0);
    const shares = bins.map((b) => (100 * b) / tot);
    const x0 = 170, x1 = 1000, yTop = 300, yBot = 760;
    const X = lin(0, 100, x0, x1);
    const Y = lin(0, 45, yBot, yTop);
    const g = sv("g", {}, svg);
    [0, 15, 30, 45].forEach((v) => {
      sv("line", { x1: x0, x2: x1, y1: Y(v), y2: Y(v), stroke: v ? C.rule : C.ink, "stroke-width": 2, "stroke-dasharray": v ? "1 9" : "", "stroke-linecap": "round" }, g);
      txt(g, x0 - 12, Y(v) + 8, v ? `${v}%` : "", { fill: C.faint, "font-size": 24, "text-anchor": "end" });
    });
    [0, 25, 50, 75, 100].forEach((v) => txt(g, X(v), yBot + 40, `${v}`, { "text-anchor": "middle", "font-size": 24 }));
    txt(g, x1, yBot + 80, "US exposure percentile (US workers spread evenly)", { "text-anchor": "end", "font-size": 24, fill: C.faint });
    const usLine = sv("line", { x1: x0, x2: x1, y1: Y(10), y2: Y(10), stroke: C.ink, "stroke-width": 3, "stroke-dasharray": "10 8" }, svg);
    const usT = txt(svg, x1, Y(10) - 14, "US workers: 10% in each band", { "text-anchor": "end", "font-size": 24, fill: C.ink });
    const bars = shares.map((s, k) => sv("rect", { x: X(k * 10) + 6, width: X(10) - X(0) - 12, fill: C.human }, svg));
    const meanLine = sv("line", { y1: yTop - 10, y2: yBot, stroke: C.ink, "stroke-width": 3 }, svg);
    const meanT = box(root, 0, 250, 300, { fontFamily: SANS, fontSize: "26px", fontWeight: "700", color: C.human, lineHeight: "1.15" });
    meanT.className = "num";
    // right: above the US top-third line
    const I = D.india;
    const rp = box(root, 1120, 300, 680, { fontFamily: SANS });
    ht("div", { fontSize: "30px", fontWeight: "700", lineHeight: "1.25" }, rp, "Workers in jobs above the US top-third line");
    const row = (label, col, v, big) => {
      const r = ht("div", { display: "flex", alignItems: "center", gap: "16px", marginTop: big ? "22px" : "12px" }, rp);
      ht("div", { width: "190px", fontSize: big ? "30px" : "26px", color: big ? C.ink : C.soft, fontWeight: big ? "600" : "400" }, r, label);
      const b = ht("div", { height: big ? "46px" : "30px", background: col, width: "0" }, r);
      const n = ht("div", { fontSize: big ? "46px" : "32px", fontWeight: "600", color: col }, r);
      n.className = "num";
      return { r, b, n, v };
    };
    const rows = [row("United States", C.faint, 33.3, true), row("India", C.human, I.topThird, true), row("in cities", C.human, I.urban, false), row("in villages", C.human, I.rural, false)];
    // pay gap
    const pay = box(root, 120, 860, 900, { fontFamily: SANS });
    const payLine = ht("div", { display: "flex", alignItems: "center", gap: "18px" }, pay);
    ht("div", { width: "330px", fontSize: "28px", lineHeight: "1.2" }, payLine, "Pay gap, more against less exposed jobs");
    const payBar = ht("div", { height: "40px", background: C.human, width: "0" }, payLine);
    const payN = ht("div", { fontSize: "46px", fontWeight: "600", color: C.human }, payLine);
    payN.className = "num";
    const payNote = box(root, 470, 916, 600, { fontFamily: SANS, fontSize: "24px", color: C.soft }, "after education, sex, age, area and state");
    const contract = box(root, 1120, 690, 680, { fontFamily: SANS });
    contract.innerHTML = `<div class="num" style="font-size:110px;font-weight:600;line-height:1;color:${C.ink}">${Math.round(I.noContractHigh)}%</div>
      <div style="font-size:28px;color:${C.soft};margin-top:10px;line-height:1.3">of regular wage workers in the most exposed third have no written contract (${Math.round(I.noContractLow)}% in the least exposed)</div>`;
    return (f) => {
      fade(fig, prog(f, S.at(0) - 8, S.at(0) + 12), 12);
      g.style.opacity = prog(f, S.at(0), S.at(0) + 16);
      bars.forEach((b, k) => {
        const p = prog(f, S.at(1) + k * 3, S.at(1) + 26 + k * 3, EO);
        const h = Y(0) - Y(shares[k] * p);
        b.setAttribute("y", Y(0) - h);
        b.setAttribute("height", h);
      });
      usLine.style.opacity = usT.style.opacity = prog(f, S.at(1) + 30, S.at(1) + 46);
      const mp = prog(f, S.cue(1, "28th"), S.cue(1, "28th") + 26, EIO);
      const mv = lerp(50, I.meanPct, mp);
      meanLine.setAttribute("x1", X(mv));
      meanLine.setAttribute("x2", X(mv));
      meanLine.style.opacity = prog(f, S.cue(1, "average") - 6, S.cue(1, "average") + 10);
      meanT.innerHTML = mp < 0.02 ? "average US worker: 50" : `average Indian worker: ${Math.round(mv)}${mp > 0.98 ? "th percentile" : ""}`;
      meanT.style.transform = `translateX(${X(mv) + 14}px)`;
      meanT.style.opacity = prog(f, S.cue(1, "average") - 6, S.cue(1, "average") + 10);
      rp.style.opacity = prog(f, S.at(2) - 4, S.at(2) + 12);
      const cueOf = [S.cue(2, "against 33"), S.at(2) + 6, S.cue(2, "14 percent in cities"), S.cue(2, "3 percent in villages")];
      rows.forEach((r, k) => {
        const p = prog(f, cueOf[k], cueOf[k] + 24);
        r.b.style.width = `${(r.v / 34) * 380 * p}px`;
        r.n.textContent = `${(r.v * p).toFixed(0)}%`;
        r.r.style.opacity = prog(f, cueOf[k] - 4, cueOf[k] + 8);
      });
      const pi = prog(f, S.at(3), S.at(3) + 20);
      pay.style.opacity = pi;
      const shrink = prog(f, S.cue(3, "education") - 4, S.cue(3, "education") + 30, EIO);
      const v = lerp(I.payRaw, I.payControlled, shrink);
      payBar.style.width = `${v * 4.2 * pi}px`;
      payN.textContent = `${Math.round(v * pi)}%`;
      payNote.style.opacity = prog(f, S.cue(3, "education") + 20, S.cue(3, "education") + 34);
      fade(contract, prog(f, S.at(4), S.at(4) + 20), 18);
    };
  };

  // ---- 11. What it means
  SCENES.meaning = (root, S) => {
    const q = rise(root, 120, 330, 1680, "So, why pay anyone?", { fontSize: "150px", fontWeight: "600", letterSpacing: "-0.02em", lineHeight: "1" });
    const a = rise(root, 124, 330, 1680, "The price of AI alone does not decide.", { fontSize: "84px", fontWeight: "500", lineHeight: "1.05" });
    const items = [
      [C.human, "What AI cannot yet do"],
      [C.human, "The new tasks it creates"],
      [C.owner, "Competition among sellers"],
      [C.owner, "Who owns it"],
    ].map(([col, t], k) => {
      const el = box(root, 124 + (k % 2) * 840, 500 + Math.floor(k / 2) * 120, 800, { fontSize: "52px", fontWeight: "600", color: col, display: "flex", alignItems: "baseline", gap: "22px" });
      ht("span", { display: "inline-block", width: "22px", height: "22px", background: col, borderRadius: "3px", flex: "none", transform: "translateY(-4px)" }, el);
      ht("span", {}, el, t);
      return el;
    });
    const risk = rise(root, 124, 780, 1680, "The risk: not collapsing wages, but a slowly falling [[human:labour share]].", { fontSize: "52px", fontStyle: "italic", lineHeight: "1.15" });
    const end = rise(root, 124, 900, 1680, "How that income is shared is a [[owner:policy choice]].", { fontSize: "52px", fontWeight: "600", lineHeight: "1.15" });
    const cues = ["cannot yet do", "new tasks", "competition", "who owns"];
    return (f) => {
      q.set(f, S.at(0) - 4, 2.2, 24);
      const up = prog(f, S.at(1) - 14, S.at(1) + 10, EIO);
      q.el.style.transform = `translateY(${-150 * up}px) scale(${1 - 0.45 * up})`;
      q.el.style.transformOrigin = "0 0";
      a.set(f, S.at(1) + 6, 1.8);
      items.forEach((el, k) => fade(el, prog(f, S.cue(2, cues[k]) - 2, S.cue(2, cues[k]) + 16), 22));
      risk.set(f, S.at(3) - 2, 1.6);
      end.set(f, S.at(4) - 2, 2.2);
    };
  };

  // ---- 12. Close: the website
  SCENES.close = (root, S) => {
    const shots = ["home", "m4", "india"].map((s, k) => {
      const el = box(root, 990 + k * 64, 190 + k * 90, 760, { border: `2px solid ${C.ink}`, borderRadius: "3px", overflow: "hidden", background: C.paper });
      const img = ht("img", { display: "block", width: "760px" }, el);
      img.src = `shots/${s}.png`;
      return el;
    });
    const t = rise(root, 120, 250, 860, "Every chart is live on the website", { fontSize: "84px", fontWeight: "600", lineHeight: "1.05", letterSpacing: "-0.01em" });
    const url = box(root, 120, 520, 800, { fontFamily: SANS, fontSize: "50px", fontWeight: "600", color: C.ai }, "why-pay-anyone.vercel.app");
    const urlRule = ht("div", { height: "4px", background: C.ai, marginTop: "6px", transformOrigin: "0 50%" }, url);
    const list = box(root, 120, 616, 840, { fontFamily: SANS, fontSize: "31px", lineHeight: "1.45", color: C.ink });
    const li = ["Move the assumptions and switch the data", "Ask the built-in assistant about any concept", "Report, data and code: github.com/amsorrytola/why-pay-anyone"].map((s) => ht("div", { whiteSpace: "nowrap" }, list, s));
    const credits = box(root, 120, 930, 1680, { fontFamily: SANS, fontSize: "22px", color: C.faint, lineHeight: "1.4" },
      "Narration: synthetic voice, Sarvam AI (Bulbul v4). Data: Epoch AI, LiteLLM, OpenRouter, Anthropic Economic Index, Microsoft, O*NET, BLS, US Census Bureau (BTOS), Indeed Hiring Lab, Penn World Table, World Bank, MoSPI (PLFS 2025).");
    const thanks = rise(root, 120, 806, 860, "Thank you.", { fontSize: "64px", fontStyle: "italic", fontWeight: "500" });
    return (f) => {
      t.set(f, S.at(0) - 4, 2);
      shots.forEach((el, k) => {
        const p = prog(f, S.at(0) + 6 + k * 8, S.at(0) + 40 + k * 8, EO);
        el.style.opacity = p;
        el.style.transform = `translate(${(1 - p) * 120}px, ${(1 - p) * 20}px)`;
      });
      fade(url, prog(f, S.at(0) + 30, S.at(0) + 50), 14);
      urlRule.style.transform = `scaleX(${prog(f, S.at(0) + 40, S.at(0) + 70, EIO)})`;
      li.forEach((el, k) => fade(el, prog(f, S.cue(0, ["move", "ask", "move"][k]) + k * 10 - 4, S.cue(0, ["move", "ask", "move"][k]) + k * 10 + 14), 12));
      li[2].style.opacity = prog(f, S.at(1) - 4, S.at(1) + 14);
      thanks.set(f, S.cue(1, "Thank you") - 2, 3);
      credits.style.opacity = prog(f, S.at(1) + 10, S.at(1) + 30);
    };
  };

  // ---------------------------------------------------------------- the frame around the scenes
  const stage = document.getElementById("stage");
  const layer = ht("div", { position: "absolute", inset: "0" }, stage);
  const built = T.scenes.map((sc, i) => {
    const root = ht("div", { position: "absolute", inset: "0", visibility: "hidden", background: C.paper, zIndex: String(i) }, layer);
    const inner = ht("div", { position: "absolute", inset: "0" }, root);
    const S = {
      ...sc,
      at: (k) => sc.segs[k].at,
      end: (k) => sc.segs[k].at + sc.segs[k].len,
      // the frame where a phrase is spoken, estimated from its place in the spoken wording
      cue: (k, phrase) => {
        const g = sc.segs[k];
        const said = g.say || g.text;
        let i = said.indexOf(phrase);
        let n = said.length;
        if (i < 0) {
          i = g.text.indexOf(phrase);
          n = g.text.length;
        }
        if (i < 0) throw new Error(`cue not found in ${sc.id}[${k}]: ${phrase}`);
        return Math.round(g.at + g.len * (i / n));
      },
    };
    const update = SCENES[sc.id](inner, S);
    return { sc, root, inner, update };
  });
  const chrome = ht("div", { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "100" }, stage);
  const head = box(chrome, 120, 52, 1680, { height: "80px" });
  ht("div", { position: "absolute", left: "0", top: "0", fontSize: "34px", fontWeight: "600", letterSpacing: "-0.005em" }, head, "Why Pay Anyone?");
  const chA = ht("div", { position: "absolute", right: "0", top: "4px", fontFamily: SANS, fontSize: "30px", color: C.soft, whiteSpace: "nowrap" }, head);
  const chB = ht("div", { position: "absolute", right: "0", top: "4px", fontFamily: SANS, fontSize: "30px", color: C.soft, whiteSpace: "nowrap" }, head);
  const headRule = doubleRule(head, 0, 58, 1680);
  const src = box(chrome, 120, 1002, 1680, { fontFamily: SANS, fontSize: "22px", color: C.faint, lineHeight: "1.3" });
  const track = box(chrome, 0, 1072, W, { height: "8px", background: C.paper2 });
  const fill = ht("div", { position: "absolute", left: "0", top: "0", height: "8px", background: C.ink, width: "0" }, track);
  T.scenes.forEach((sc) => {
    if (/^Chapter/.test(sc.chapter)) ht("div", { position: "absolute", left: `${(sc.from / T.total) * W}px`, top: "0", width: "3px", height: "8px", background: C.paper }, track);
  });
  const edge = ht("div", { position: "absolute", top: "0", width: "6px", height: `${H}px`, background: C.ai, zIndex: "99" }, stage);

  const hasHead = (sc) => !!sc.chapter;
  window.renderFrame = (F) => {
    let cur = 0;
    built.forEach((b, i) => {
      const { from, len } = b.sc;
      const f = F - from;
      const vis = f >= 0 && f < len;
      b.root.style.visibility = vis ? "visible" : "hidden";
      if (vis) cur = i;
      if (!vis) return;
      b.update(f);
      let clip = "none";
      if (i > 0 && f < TR) clip = `inset(0 ${(100 * (1 - EIO(f / TR))).toFixed(3)}% 0 0)`;
      b.root.style.clipPath = clip;
      let tx = 0;
      if (i < built.length - 1 && f >= len - TR) tx = -90 * EIO((f - (len - TR)) / TR);
      b.inner.style.transform = tx ? `translateX(${tx}px)` : "";
    });
    const b = built[cur];
    const f = F - b.sc.from;
    const inTr = cur > 0 && f < TR;
    const p = inTr ? EIO(f / TR) : 1;
    edge.style.display = inTr ? "block" : "none";
    edge.style.left = `${p * W - 3}px`;
    const prev = cur > 0 ? built[cur - 1].sc : null;
    // running head: the chapter label hands over during the wipe
    const hNow = hasHead(b.sc) ? 1 : 0;
    const hPrev = prev && hasHead(prev) ? 1 : 0;
    head.style.opacity = inTr ? lerp(hPrev, hNow, p) : hNow;
    if (b.sc.id === "ceiling") head.style.opacity = Math.min(+head.style.opacity, prog(f, 0, 24));
    headRule(b.sc.id === "ceiling" ? prog(f, 4, 40, EIO) : 1);
    chB.textContent = b.sc.chapter;
    chA.textContent = prev ? prev.chapter : "";
    chB.style.opacity = inTr ? p : 1;
    chA.style.opacity = inTr && hPrev && hNow ? 1 - p : 0;
    // sources line
    const s = SOURCES[b.sc.id] || "";
    const sp = SOURCES[prev ? prev.id : ""] || "";
    if (inTr && p < 0.5) {
      src.textContent = sp;
      src.style.opacity = 1 - 2 * p;
    } else {
      src.textContent = s;
      src.style.opacity = inTr ? 2 * p - 1 : prog(f, 0, 1);
    }
    fill.style.width = `${(F / (T.total - 1)) * W}px`;
    track.style.opacity = b.sc.id === "open" ? prog(f, 0, 30) : 1;
  };
  window.deckReady = Promise.all([
    document.fonts.load("600 40px 'Source Serif 4'"),
    document.fonts.load("500 40px 'Source Serif 4'"),
    document.fonts.load("400 40px 'Source Serif 4'"),
    document.fonts.load("italic 400 40px 'Source Serif 4'"),
    document.fonts.load("italic 500 40px 'Source Serif 4'"),
    document.fonts.load("400 40px 'Source Sans 3'"),
    document.fonts.load("600 40px 'Source Sans 3'"),
    document.fonts.load("700 40px 'Source Sans 3'"),
    ...[...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))),
  ]).then(() => document.fonts.ready).then(() => {
    window.renderFrame(0);
    return true;
  });
})();
