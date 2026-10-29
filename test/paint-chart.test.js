import { test } from "node:test";
import assert from "node:assert/strict";
import { CHART_SAMPLES, chartLayer, paintChart } from "../dist/paint-chart.js";
import { fillOf, paintOf, THEMES } from "../dist/render.js";

globalThis.Path2D ??= class Path2D {
  constructor(d) {
    this.d = d;
  }
};

// A 2D context that keeps every call, with the drawing state at the moment of each one.
function canvasLog(width, height) {
  const calls = [];
  const state = { font: "", fillStyle: "", strokeStyle: "", globalAlpha: 1, textAlign: "start", textBaseline: "alphabetic", lineWidth: 1 };
  const stack = [];
  const ops = {
    save: () => stack.push({ ...state }),
    restore: () => Object.assign(state, stack.pop()),
    measureText: (text) => ({ width: text.length * (Number(state.font.match(/(\d+(?:\.\d+)?)px/)?.[1]) || 10) * 0.5 }),
    createLinearGradient: () => ({ addColorStop: (at, color) => calls.push({ op: "addColorStop", at, color }) }),
    fillText: (text, x, y) => calls.push({ op: "fillText", text, x, y, ...state }),
  };
  const ctx = new Proxy(state, {
    get: (target, key) => (key === "canvas" ? { width, height } : key in ops ? ops[key] : key in target ? target[key] : (...args) => calls.push({ op: key, args, ...state })),
    set: (target, key, value) => ((target[key] = value), true),
  });
  return { ctx, calls };
}

function envFor(ctx, growth = 1, theme = THEMES[0]) {
  return {
    theme, family: "Geist", unit: 1, time: 0, duration: 10, growth,
    fill: (paint, fallback, box) => fillOf(ctx, paint, theme, fallback, box),
    flat: (paint, fallback) => paintOf(paint, theme, fallback),
    image: () => null, placeholders: false, placeholderText: "", level: () => 0,
  };
}

const BOX = { x: -300, y: -200, width: 600, height: 400 };

function paint(layer, growth = 1, box = BOX) {
  const { ctx, calls } = canvasLog(1080, 1080);
  paintChart(ctx, layer, box, envFor(ctx, growth));
  return calls;
}

const texts = (calls) => calls.filter((call) => call.op === "fillText").map((call) => call.text);

// A bar is a path that starts at its base and turns its first rounded corner at its far end.
function barHeights(calls) {
  const heights = [];
  calls.forEach((call, index) => {
    const next = calls[index + 1];
    if (call.op === "moveTo" && next?.op === "arcTo") heights.push(call.args[1] - next.args[1]);
  });
  return heights;
}

test("columns grow in one after another, each a set share of its full height", () => {
  const layer = chartLayer("column", "c");
  const full = barHeights(paint(layer, 1));
  const half = barHeights(paint(layer, 0.5));
  const n = layer.data.length;
  assert.equal(full.length, n);
  assert.equal(half.length, n);
  full.forEach((height, index) => {
    const share = Math.min(1, Math.max(0, 0.5 * 1.4 - (index * 0.4) / n));
    assert.ok(Math.abs(half[index] - height * share) < 1e-6, `bar ${index}: ${half[index]} of ${height}`);
  });
  // Across the chart, halfway in, the bars stand about half their height.
  const mean = half.reduce((sum, height, index) => sum + height / full[index], 0) / n;
  assert.ok(Math.abs(mean - 0.5) < 0.06, `${mean}`);
  // Taller values stand taller.
  assert.ok(full[5] > full[0]);
});

test("values are written in en-US digits with the layer's words around them, whatever the machine", () => {
  const layer = { ...chartLayer("column", "c"), data: [{ label: "Q1", value: 1500 }, { label: "Q2", value: 12250.5 }], prefix: "$" };
  const shown = texts(paint(layer, 1));
  assert.ok(shown.includes("$1,500"), shown.join(" | "));
  assert.ok(shown.includes("$12,250.5"), shown.join(" | "));
  assert.ok(shown.includes("Q1") && shown.includes("Q2"));
});

test("a pie sweeps a whole turn from the top once grown, and half a turn halfway", () => {
  const layer = chartLayer("pie", "p");
  const sweep = (calls) => {
    const arcs = calls.filter((call) => call.op === "arc");
    const radius = Math.max(...arcs.map((call) => call.args[2]));
    const slices = arcs.filter((call) => call.args[2] === radius);
    return { slices, from: Math.min(...slices.map((call) => call.args[3])), to: Math.max(...slices.map((call) => call.args[4])) };
  };
  const whole = sweep(paint(layer, 1));
  assert.equal(whole.slices.length, layer.data.length);
  // Slices sit a hair apart, so the turn is whole to within that gap.
  assert.ok(Math.abs(whole.from + Math.PI / 2) < 0.05, `${whole.from}`);
  assert.ok(Math.abs(whole.to - Math.PI * 1.5) < 0.05, `${whole.to}`);
  const half = sweep(paint(layer, 0.5));
  assert.ok(Math.abs(half.to - Math.PI / 2) < 0.05, `${half.to}`);
  // Rows without a colour of their own each get a different one.
  const fills = new Set(paint(layer, 1).filter((call) => call.op === "fill" && call.fillStyle && typeof call.fillStyle === "string").map((call) => call.fillStyle));
  assert.ok(fills.size >= layer.data.length, [...fills].join(" "));
});

test("a one-row pie is a whole disc with no gap", () => {
  const calls = paint({ ...chartLayer("pie", "p"), data: [{ label: "All", value: 5 }] }, 1);
  const slice = calls.find((call) => call.op === "arc");
  assert.ok(Math.abs(slice.args[4] - slice.args[3] - Math.PI * 2) < 1e-9);
});

test("a number counts up to its value, keeping its own decimals", () => {
  const layer = { ...chartLayer("number", "n"), data: [{ label: "Downloads", value: 12500 }], prefix: "$" };
  const box = { x: -216, y: -135, width: 432, height: 270 };
  assert.ok(texts(paint(layer, 1, box)).includes("$12,500"));
  assert.ok(texts(paint(layer, 0.5, box)).includes("$6,250"));
  assert.ok(texts(paint(layer, 0.5, box)).includes("Downloads"));
  const decimals = { ...layer, prefix: undefined, suffix: "x", data: [{ label: "Growth", value: 2.5 }] };
  assert.ok(texts(paint(decimals, 1, box)).includes("2.5x"));
  assert.ok(texts(paint(decimals, 0.5, box)).includes("1.3x"));
  assert.ok(texts(paint(decimals, 0, box)).includes("0.0x"));
});

test("the number is sized by the value it ends on, so counting never makes it jump", () => {
  const layer = chartLayer("number", "n");
  const box = { x: -216, y: -135, width: 432, height: 270 };
  const fontAt = (growth) => paint(layer, growth, box).find((call) => call.op === "fillText" && /\d/.test(call.text)).font;
  assert.equal(fontAt(0.3), fontAt(1));
});

test("a ring fills its share of the target, a progress bar its share of the width", () => {
  const ring = { ...chartLayer("ring", "r"), data: [{ label: "Done", value: 25 }] };
  const box = { x: -170, y: -170, width: 340, height: 340 };
  const arcs = paint(ring, 1, box).filter((call) => call.op === "arc");
  const arc = arcs.find((call) => call.args[3] === -Math.PI / 2);
  assert.ok(Math.abs(arc.args[4] - arc.args[3] - Math.PI / 2) < 1e-9);
  assert.ok(texts(paint(ring, 1, box)).includes("25%"));
  const bar = { ...chartLayer("progress", "p"), data: [{ label: "Goal", value: 40 }], max: 80 };
  const strip = { x: -300, y: -60, width: 600, height: 120 };
  // Each pill is a rounded box whose first corner is at its right edge: the track, then the fill.
  const calls = paint(bar, 1, strip);
  const rights = calls.filter((call, index) => call.op === "arcTo" && calls[index - 1].op === "moveTo").map((call) => call.args[0]);
  assert.equal(rights.length, 2);
  assert.ok(Math.abs(rights[0] - 300) < 1e-6 && Math.abs(rights[1] - 0) < 1e-6, `${rights}`);
  const shown = texts(paint(bar, 0.5, strip));
  assert.ok(shown.includes("Goal") && shown.includes("20%"), shown.join(" | "));
});

test("a poll writes each answer's share of the whole and sets the leader bold", () => {
  const calls = paint(chartLayer("poll", "q"), 1);
  const shares = calls.filter((call) => call.op === "fillText" && call.text.endsWith("%"));
  assert.deepEqual(shares.map((call) => call.text), ["48%", "32%", "20%"]);
  const yes = calls.find((call) => call.op === "fillText" && call.text === "Yes");
  const no = calls.find((call) => call.op === "fillText" && call.text === "No");
  assert.match(yes.font, /^700 /);
  assert.match(no.font, /^500 /);
});

test("lines are uncovered from the left, and every form draws without throwing in a small box", () => {
  const line = chartLayer("line", "l");
  const clip = paint(line, 0.4).find((call) => call.op === "rect");
  assert.ok(clip && clip.args[0] + clip.args[2] < BOX.x + BOX.width * 0.6, `${clip?.args}`);
  assert.ok(!paint(line, 1).some((call) => call.op === "clip"));
  const tiny = { x: -40, y: -20, width: 80, height: 40 };
  for (const kind of Object.keys(CHART_SAMPLES)) {
    const calls = paint(chartLayer(kind, kind), 1, tiny);
    // Labels go before they can overlap: nothing wider than the box is written.
    for (const call of calls.filter((entry) => entry.op === "fillText")) {
      const px = Number(call.font.match(/(\d+)px/)[1]);
      assert.ok(call.text.length * px * 0.5 <= tiny.width + 1e-6, `${kind}: ${call.text} at ${px}px`);
    }
  }
});

test("labels and values can be turned off, and guides drawn", () => {
  const layer = { ...chartLayer("column", "c"), showLabels: false, showValues: false, showGrid: true };
  const shown = texts(paint(layer, 1));
  assert.ok(!shown.includes("Mon"));
  assert.ok(!shown.includes("12"));
  // The guides' values in the gutter.
  assert.ok(shown.includes("0") && shown.includes("30"), shown.join(" | "));
});

test("a chart layer comes centred, growing in, with its own copy of the samples", () => {
  const layer = chartLayer("ring", "r1");
  assert.equal(layer.kind, "chart");
  assert.equal(layer.chart, "ring");
  assert.equal(layer.enter, "grow");
  assert.ok(Math.abs(layer.x + layer.w / 2 - 0.5) < 1e-9 && Math.abs(layer.y + layer.h / 2 - 0.5) < 1e-9);
  layer.data[0].value = 1;
  assert.equal(CHART_SAMPLES.ring[0].value, 72);
  const number = chartLayer("number", "n1");
  assert.ok(number.w < 0.5 && number.h < 0.3);
});
