import { test } from "node:test";
import assert from "node:assert/strict";
import { fitText, paintTable, tableLayer } from "../dist/paint-table.js";
import { fillOf, inkOn, paintOf, THEMES } from "../dist/render.js";

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

const BOX = { x: -378, y: -172, width: 756, height: 344 };

function paint(layer, growth = 1, box = BOX) {
  const { ctx, calls } = canvasLog(1080, 1080);
  paintTable(ctx, layer, box, envFor(ctx, growth));
  return calls;
}

const written = (calls) => calls.filter((call) => call.op === "fillText");

test("every cell with words in it is written once, centred in its row", () => {
  const layer = { ...tableLayer("schedule", "t"), cells: [["Time", "Topic"], ["0:00", "Intro"], ["", "Questions"]] };
  const texts = written(paint(layer));
  assert.deepEqual(texts.map((call) => call.text), ["Time", "Topic", "0:00", "Intro", "Questions"]);
  const rowHeight = BOX.height / 3;
  assert.ok(Math.abs(texts[2].y - (BOX.y + rowHeight * 1.5)) < 1e-6);
  assert.ok(texts.every((call) => call.textBaseline === "middle"));
});

test("a cell too long for its column is cut with an ellipsis that fits", () => {
  const long = "A very long topic that will never fit inside a narrow column at all";
  const layer = { ...tableLayer("schedule", "t"), cells: [["Time", "Topic"], ["0:00", long]] };
  const box = { x: -150, y: -60, width: 300, height: 120 };
  const cut = written(paint(layer, 1, box)).find((call) => call.text.startsWith("A very"));
  assert.ok(cut.text.endsWith("…"), cut.text);
  assert.ok(cut.text.length < long.length);
  assert.ok(!cut.text.endsWith(" …"), "no space before the ellipsis");
});

test("fitting never splits a letter made of several code points", () => {
  const { ctx } = canvasLog(100, 100);
  ctx.font = "500 20px Geist";
  // Cut by code points, the family would lose a member and keep a dangling joiner; cut by letters, it goes whole.
  assert.equal(fitText(ctx, "café 👩‍👩‍👧 family evening", 120), "café…");
  assert.equal(fitText(ctx, "Short", 120), "Short");
  assert.equal(fitText(ctx, "Anything", 2), "");
});

test("the header row takes the fill, with bold words in whichever ink reads on it", () => {
  for (const fill of ["#f0bf2f", "#18122b"]) {
    const layer = { ...tableLayer("header", "t"), fill };
    const calls = paint(layer);
    const head = written(calls).find((call) => call.text === "Name");
    assert.equal(head.fillStyle, inkOn(fill));
    assert.match(head.font, /^700 /);
    const body = written(calls).find((call) => call.text === "Guest name");
    assert.equal(body.fillStyle, THEMES[0].text);
    assert.ok(calls.some((call) => call.op === "fillRect" && call.fillStyle === fill));
  }
});

test("stripes tint every other body row, faintly in the theme's words colour", () => {
  const calls = paint(tableLayer("striped", "t"));
  const tints = calls.filter((call) => call.op === "fillRect" && call.fillStyle === THEMES[0].text);
  // Four rows: the header, then body rows one, two and three; the second body row is tinted.
  assert.equal(tints.length, 1);
  assert.ok(tints[0].globalAlpha < 0.15);
  const picked = paint({ ...tableLayer("striped", "t"), background: "#334455" }).find((call) => call.op === "fillRect" && call.fillStyle === "#334455");
  assert.equal(picked.globalAlpha, 1);
});

test("rules: lines between rows, a grid with a border, or none", () => {
  const strokes = (layer) => paint(layer).filter((call) => call.op === "stroke");
  const rows = { ...tableLayer("simple", "t") };
  assert.equal(strokes(rows).length, 2, "two rules between three rows");
  assert.equal(strokes({ ...rows, rules: "none" }).length, 0);
  const grid = paint(tableLayer("scoreboard", "t"));
  const border = grid.findLastIndex((call) => call.op === "stroke");
  assert.equal(grid[border - 1].op, "closePath", "a rounded border drawn last");
  // Two lines between three columns on each of four rows, and one under each body row but the last.
  assert.equal(grid.filter((call) => call.op === "lineTo").length, 4 * 2 + 2);
  const rule = grid.find((call) => call.op === "stroke");
  assert.equal(rule.lineWidth, 1.5);
  assert.equal(rule.strokeStyle, THEMES[0].muted);
});

test("rows fade and rise in one after another as the table grows", () => {
  const layer = tableLayer("schedule", "t");
  const rows = layer.cells.length;
  const at = (growth) => written(paint(layer, growth));
  assert.equal(at(0).length, 0);
  const early = at(0.3);
  const first = early.find((call) => call.text === "Time");
  const p = Math.min(1, 0.3 * (1 + 0.3 * (rows - 1)));
  assert.ok(Math.abs(first.globalAlpha - p) < 1e-9, `${first.globalAlpha}`);
  const rowHeight = BOX.height / rows;
  assert.ok(Math.abs(first.y - (BOX.y + rowHeight / 2 + (1 - p) * rowHeight * 0.4)) < 1e-6);
  assert.ok(!early.some((call) => call.text === "48:00"), "the last row has not started");
  const settled = at(1);
  assert.ok(settled.every((call) => call.globalAlpha === 1));
});

test("a table layer comes centred, in its style, with its own sample cells", () => {
  const scoreboard = tableLayer("scoreboard", "s");
  assert.equal(scoreboard.kind, "table");
  assert.equal(scoreboard.cells[0].length, 3);
  assert.equal(scoreboard.align, "center");
  assert.equal(scoreboard.rules, "grid");
  assert.ok(Math.abs(scoreboard.x + scoreboard.w / 2 - 0.5) < 1e-9 && Math.abs(scoreboard.y + scoreboard.h / 2 - 0.5) < 1e-9);
  scoreboard.cells[0][0] = "Changed";
  assert.equal(tableLayer("scoreboard", "s2").cells[0][0], "Player");
  assert.deepEqual(tableLayer("schedule", "c").cells[0], ["Time", "Topic"]);
  for (const style of ["simple", "header", "striped", "schedule", "scoreboard"]) assert.equal(tableLayer(style, style).enter, "grow");
});
