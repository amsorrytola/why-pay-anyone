/* Figures for the report, drawn as SVG from the same data the website and the video use
   (presentation/deck/data.js, made by presentation/deckdata.py from web/src/data). */
(() => {
  const D = window.DATA;
  const C = { ink: "#1b1c1e", soft: "#4b4c50", faint: "#66686d", rule: "#d7d6d0", paper2: "#f4f3ef", human: "#c4432a", humanSoft: "#f8e4de", ai: "#2c5aa0", aiSoft: "#e6ecf6", owner: "#a8761a" };
  const SANS = "'Source Sans 3', sans-serif";
  const NS = "http://www.w3.org/2000/svg";
  const W = 400, H = 232;
  function svgIn(id, h = H) {
    const fig = document.getElementById(id);
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", `0 0 ${W} ${h}`);
    fig.appendChild(s);
    return s;
  }
  function el(parent, tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    parent.appendChild(e);
    return e;
  }
  const t = (p, x, y, s, a = {}) => el(p, "text", { x, y, "font-family": SANS, "font-size": 11, fill: C.soft, stroke: "#fff", "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round", ...a }, s);
  const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  const lg = (d0, d1, r0, r1) => (v) => r0 + ((Math.log(v) - Math.log(d0)) / (Math.log(d1) - Math.log(d0))) * (r1 - r0);
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const mi = (s) => +s.slice(0, 4) * 12 + +s.slice(5, 7) - 1;
  const hgrid = (s, x0, x1, y, label, strong) => {
    el(s, "line", { x1: x0, x2: x1, y1: y, y2: y, stroke: strong ? C.faint : C.rule, "stroke-width": strong ? 0.8 : 0.7, "stroke-dasharray": strong ? "3 3" : "" });
    if (label) t(s, x0 - 4, y + 3.5, label, { "text-anchor": "end", fill: C.faint, "font-size": 10.5 });
  };

  // Figure 1: price of GPT-4-level capability
  {
    const s = svgIn("fig1");
    const P = D.price, n = P.length;
    const x0 = 40, x1 = 392, yT = 10, yB = 200;
    const X = lin(0, n - 1, x0, x1), Y = lg(60, 0.015, yT, yB);
    [[10, "$10"], [1, "$1"], [0.1, "$0.10"], [0.01, "$0.01"]].forEach(([v, l]) => hgrid(s, x0, x1, Y(v), l));
    el(s, "line", { x1: x0, x2: x1, y1: yB + 6, y2: yB + 6, stroke: C.ink, "stroke-width": 0.9 });
    P.forEach(([m], i) => { if (m.endsWith("-01")) { el(s, "line", { x1: X(i), x2: X(i), y1: yB + 6, y2: yB + 10, stroke: C.ink, "stroke-width": 0.9 }); t(s, X(i), yB + 22, m.slice(0, 4), { "text-anchor": "middle" }); } });
    const xs = P.map((_, i) => i), ys = P.map(([, v]) => Math.log(v));
    const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    const b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const a = my - b * mx;
    el(s, "path", { d: path([[X(0), Y(Math.exp(a))], [X(n - 1), Y(Math.exp(a + b * (n - 1)))]]), stroke: C.ink, "stroke-width": 1, "stroke-dasharray": "4 3", fill: "none" });
    const pts = [];
    P.forEach(([, v], i) => { if (i) pts.push([X(i), Y(P[i - 1][1])]); pts.push([X(i), Y(v)]); });
    el(s, "path", { d: path(pts), stroke: C.ai, "stroke-width": 2.2, fill: "none", "stroke-linejoin": "round" });
    t(s, X(0) + 4, Y(P[0][1]) - 6, "$37.50, GPT-4", { fill: C.ai, "font-weight": 700 });
    el(s, "line", { x1: X(n - 1), x2: X(n - 1), y1: Y(0.17) + 4, y2: Y(P[n - 1][1]) - 4, stroke: C.ai, "stroke-width": 0.8 });
    t(s, X(n - 1), Y(0.17), "$0.028 in Nov 2026, gpt-oss-20b", { fill: C.ai, "font-weight": 700, "text-anchor": "end" });
    t(s, X(17), Y(Math.exp(a + b * 17)) - 26, "trend: halves every", { fill: C.ink });
    t(s, X(17), Y(Math.exp(a + b * 17)) - 13, `${D.priceFit.halving.toFixed(1)} months (−${Math.round(D.priceFit.annualDecline)}% a year)`, { fill: C.ink });
  }

  // Figure 2: postings by exposure third
  {
    const s = svgIn("fig2");
    const hi = D.postings.high, lo = D.postings.low;
    const m0 = mi(hi[0][0]), m1 = mi(hi[hi.length - 1][0]);
    const x0 = 30, x1 = 392, yT = 10, yB = 200;
    const X = lin(m0, m1, x0, x1), Y = lin(40, 130, yB, yT);
    el(s, "rect", { x: X(mi("2022-01")), width: X(mi("2022-10")) - X(mi("2022-01")), y: yT, height: yB - yT, fill: C.paper2 });
    [50, 75, 100, 125].forEach((v) => hgrid(s, x0, x1, Y(v), `${v}`, v === 100));
    const k0 = hi.findIndex(([m]) => m === "2022-12");
    const top = lo.slice(k0).map(([m, v]) => [X(mi(m)), Y(v)]);
    const bot = hi.slice(k0).map(([m, v]) => [X(mi(m)), Y(v)]).reverse();
    el(s, "path", { d: path(top.concat(bot)) + "Z", fill: C.aiSoft });
    const xl = X(mi("2022-11")) + 0.97 * (X(1) - X(0));
    el(s, "line", { x1: xl, x2: xl, y1: yT, y2: yB, stroke: C.ink, "stroke-width": 1 });
    t(s, xl + 4, yT + 11, "ChatGPT launch", { fill: C.ink, "font-weight": 600 });
    t(s, X(mi("2022-05")), yB - 5, "base", { "text-anchor": "middle", fill: C.faint, "font-size": 9.5 });
    el(s, "path", { d: path(lo.map(([m, v]) => [X(mi(m)), Y(v)])), stroke: C.ink, "stroke-width": 1.5, fill: "none" });
    el(s, "path", { d: path(hi.map(([m, v]) => [X(mi(m)), Y(v)])), stroke: C.ai, "stroke-width": 2.2, fill: "none" });
    el(s, "line", { x1: x0, x2: x1, y1: yB + 6, y2: yB + 6, stroke: C.ink, "stroke-width": 0.9 });
    [2021, 2022, 2023, 2024, 2025, 2026].forEach((y) => t(s, X(y * 12 + 6), yB + 22, `${y}`, { "text-anchor": "middle" }));
    const L = lo[lo.length - 1], Hh = hi[hi.length - 1];
    t(s, x1, Y(L[1]) - 9, "least exposed third", { "text-anchor": "end", fill: C.ink, "font-weight": 700 });
    t(s, x1, Y(Hh[1]) + 16, "most exposed third", { "text-anchor": "end", fill: C.ai, "font-weight": 700 });
    const es = D.eventStudy;
    t(s, X(mi("2024-03")), Y(118), `gap: −${Math.abs(es.pct).toFixed(1)}%`, { fill: C.ai, "font-weight": 700, "font-size": 12.5 });
    t(s, X(mi("2024-03")), Y(118) + 13, `95% interval −${Math.abs(es.lo).toFixed(1)}% to −${Math.abs(es.hi).toFixed(1)}%`, { fill: C.soft });
  }

  // Figure 3: HHI
  {
    const s = svgIn("fig3", 214);
    const Hh = D.hhi;
    const x0 = 40, x1 = 392, yT = 12, yB = 182;
    const X = lin(0, Hh.length - 1, x0 + 6, x1 - 6), Y = lin(0, 3500, yB, yT);
    [0, 1000, 2000, 3000].forEach((v) => hgrid(s, x0, x1, Y(v), v.toLocaleString("en-US")));
    el(s, "line", { x1: x0, x2: x1, y1: Y(1800), y2: Y(1800), stroke: C.owner, "stroke-width": 1, "stroke-dasharray": "4 3" });
    t(s, x0 + 4, Y(1800) + 13, "1,800", { fill: C.owner, "font-weight": 600 });
    el(s, "path", { d: path(Hh.map(([, v], i) => [X(i), Y(v)])), stroke: C.owner, "stroke-width": 2.2, fill: "none", "stroke-linejoin": "round" });
    [["2025-01", 12, -8, "start"], ["2026-04", 0, 16, "middle"], ["2026-10", -4, -10, "end"]].forEach(([m, dx, dy, anc]) => {
      const i = Hh.findIndex((r) => r[0] === m);
      el(s, "circle", { cx: X(i), cy: Y(Hh[i][1]), r: 3, fill: "#fff", stroke: C.owner, "stroke-width": 1.6 });
      t(s, X(i) + dx, Y(Hh[i][1]) + dy, `${Math.round(Hh[i][1]).toLocaleString("en-US")} (${Hh[i][2]})`, { fill: C.ink, "font-weight": 600, "text-anchor": anc });
    });
    el(s, "line", { x1: x0, x2: x1, y1: yB + 4, y2: yB + 4, stroke: C.ink, "stroke-width": 0.9 });
    Hh.forEach(([m], i) => { if (m.endsWith("-01") || m.endsWith("-07")) t(s, X(i), yB + 19, `${["Jan", "Jul"][m.endsWith("-01") ? 0 : 1]} ${m.slice(2, 4)}`, { "text-anchor": "middle", "font-size": 10.5 }); });
  }

  // Figure 4: India's exposure distribution
  {
    const s = svgIn("fig4", 222);
    const bins = Array.from({ length: 10 }, () => 0);
    D.indiaOcc.forEach(([pc, share]) => { bins[Math.min(9, Math.floor(pc / 10))] += share; });
    const tot = bins.reduce((a, b) => a + b, 0);
    const x0 = 34, x1 = 392, yT = 14, yB = 186;
    const X = lin(0, 100, x0, x1), Y = lin(0, 40, yB, yT);
    [0, 10, 20, 30, 40].forEach((v) => hgrid(s, x0, x1, Y(v), `${v}%`));
    bins.forEach((b, k) => {
      const v = (100 * b) / tot;
      el(s, "rect", { x: X(k * 10) + 3, width: X(10) - X(0) - 6, y: Y(v), height: yB - Y(v), fill: k >= 6.67 ? C.human : C.human, opacity: k >= 7 ? 1 : 0.85 });
      t(s, X(k * 10 + 5), Y(v) - 4, `${v.toFixed(0)}%`, { "text-anchor": "middle", fill: C.ink, "font-size": 10 });
    });
    el(s, "line", { x1: x0, x2: x1, y1: Y(10), y2: Y(10), stroke: C.ink, "stroke-width": 1.1, "stroke-dasharray": "4 3" });
    t(s, x1, Y(10) - 16, "US workers: 10% per band", { "text-anchor": "end", fill: C.ink, "font-weight": 600 });
    el(s, "line", { x1: X(66.7), x2: X(66.7), y1: yT, y2: yB, stroke: C.faint, "stroke-width": 1, "stroke-dasharray": "2 2" });
    t(s, X(66.7) + 4, yT + 22, "US top-third line:", { fill: C.soft });
    t(s, X(66.7) + 4, yT + 35, `India ${D.india.topThird.toFixed(1)}% above, US 33%`, { fill: C.human, "font-weight": 700 });
    el(s, "line", { x1: X(D.india.meanPct), x2: X(D.india.meanPct), y1: yT - 4, y2: yB, stroke: C.ink, "stroke-width": 1.2 });
    t(s, X(D.india.meanPct) + 4, yT + 2, `Indian average: ${Math.round(D.india.meanPct)}th`, { fill: C.ink, "font-weight": 700 });
    el(s, "line", { x1: x0, x2: x1, y1: yB, y2: yB, stroke: C.ink, "stroke-width": 0.9 });
    [0, 25, 50, 75, 100].forEach((v) => t(s, X(v), yB + 15, `${v}`, { "text-anchor": "middle" }));
    t(s, x1, yB + 30, "percentile of US exposure (Microsoft score)", { "text-anchor": "end", fill: C.faint, "font-size": 10.5 });
  }
  // Figure 5: the task model
  {
    const s = svgIn("fig5", 210);
    const x0 = 34, x1 = 392, yT = 10, yB = 176;
    const X = lin(0, 1, x0, x1), Y = lg(0.8, 6.5, yB, yT);
    const th = 1.5, A = 0.5;
    [[1, "1"], [2, "2"], [4, "4"]].forEach(([v, l]) => hgrid(s, x0, x1, Y(v), l));
    el(s, "rect", { x: X(0.62), width: X(1) - X(0.62), y: yT, height: yB - yT, fill: C.aiSoft });
    el(s, "line", { x1: X(1 - A), x2: X(1 - A), y1: yT, y2: yB, stroke: C.ai, "stroke-width": 1, "stroke-dasharray": "3 3" });
    t(s, X(1 - A) + 4, yB - 6, "AI can do these tasks", { fill: C.ai, "font-size": 10, "font-weight": 600 });
    const curve = [];
    for (let k = 0; k <= 40; k++) curve.push([X(k / 40), Y(Math.exp(th * (k / 40)))]);
    el(s, "path", { d: path(curve), stroke: C.human, "stroke-width": 2.2, fill: "none" });
    t(s, X(1) - 2, Y(Math.exp(th)) + 15, "a person’s cost, in wages", { fill: C.human, "font-weight": 700, "text-anchor": "end" });
    [[5.2, "high price: no task moves"], [2.55, "lower price: AI takes tasks from the right"], [1.15, "corner: a lower price changes nothing"]].forEach(([r, l], k) => {
      el(s, "line", { x1: x0, x2: x1, y1: Y(r), y2: Y(r), stroke: C.ai, "stroke-width": k === 1 ? 2 : 1.3, "stroke-dasharray": k === 1 ? "" : "5 3" });
      t(s, x0 + 4, Y(r) - 4, l, { fill: C.ai, "font-weight": k === 1 ? 700 : 400, "font-size": 10.5 });
    });
    el(s, "circle", { cx: X(0.62), cy: Y(2.55), r: 3.2, fill: "#fff", stroke: C.ink, "stroke-width": 1.4 });
    el(s, "line", { x1: x0, x2: x1, y1: yB, y2: yB, stroke: C.ink, "stroke-width": 0.9 });
    t(s, x0, yB + 15, "tasks people do best", { fill: C.soft });
    t(s, x1, yB + 15, "tasks AI does best", { fill: C.soft, "text-anchor": "end" });
    t(s, x0 - 4, yT + 4, "cost", { "text-anchor": "end", fill: C.faint, "font-size": 10 });
  }
  window.figuresReady = true;
})();
