import { test } from "node:test";
import assert from "node:assert/strict";
import { ambientLayer, paintAmbient } from "../dist/paint-ambient.js";
import { paintOf, THEMES } from "../dist/render.js";

const STYLES = ["aurora", "flow", "bokeh", "particles", "waves", "rays", "grid", "grain"];
const DRAWS = new Set(["fill", "stroke", "fillRect", "strokeRect", "drawImage", "fillText"]);

// A 2D context that keeps every call with the drawing state at that moment; gradients keep their colour stops.
function canvasLog() {
  const calls = [];
  const state = { fillStyle: "#000000", strokeStyle: "#000000", globalAlpha: 1, globalCompositeOperation: "source-over", filter: "none", lineWidth: 1 };
  const stack = [];
  const gradient = (op, args) => {
    const made = { op, args, stops: [] };
    made.addColorStop = (at, color) => made.stops.push([at, color]);
    calls.push({ op, args });
    return made;
  };
  const ops = {
    save: () => (stack.push({ ...state }), calls.push({ op: "save" })),
    restore: () => (Object.assign(state, stack.pop()), calls.push({ op: "restore" })),
    createLinearGradient: (...args) => gradient("createLinearGradient", args),
    createRadialGradient: (...args) => gradient("createRadialGradient", args),
    createPattern: () => ({ op: "pattern" }),
  };
  const ctx = new Proxy(state, {
    get: (target, key) => (key in ops ? ops[key] : key in target ? target[key] : (...args) => calls.push({ op: key, args, ...state })),
    set: (target, key, value) => ((target[key] = value), true),
  });
  return { ctx, calls, state, depth: () => stack.length };
}

const theme = THEMES[0];
const environment = (time, extra = {}) => ({
  theme, family: "Geist", unit: 1, time, duration: 30, growth: 1,
  fill: (paint, fallback) => paintOf(paint, theme, fallback),
  flat: (paint, fallback) => paintOf(paint, theme, fallback),
  image: () => null, placeholders: false, placeholderText: "", level: () => 0,
  ...extra,
});
const page = { x: -540, y: -960, width: 1080, height: 1920 };

/** The calls one frame of a background makes, as text to compare frames by. */
function frame(layer, time, extra) {
  const { ctx, calls } = canvasLog();
  paintAmbient(ctx, layer, page, environment(time, extra));
  return JSON.stringify(calls);
}

test("each background is the same at the same moment and moves from one moment to the next", () => {
  for (const style of STYLES) {
    const layer = ambientLayer(style, "bg-1");
    assert.equal(frame(layer, 3.25), frame(layer, 3.25), `${style} is drawn from the time alone`);
    assert.notEqual(frame(layer, 3.25), frame(layer, 5.5), `${style} moves`);
  }
});

test("the scatter comes from the layer's id: the same id lands the same way on every run, another id elsewhere", () => {
  for (const style of ["bokeh", "particles", "aurora", "rays", "waves"]) {
    const first = frame(ambientLayer(style, "scatter"), 2);
    const again = frame(ambientLayer(style, "scatter"), 2);
    const other = frame(ambientLayer(style, "another"), 2);
    assert.equal(first, again, `${style} with the same id`);
    assert.notEqual(first, other, `${style} with another id`);
  }
});

test("nothing is left to chance or the clock while a background is drawn", () => {
  const random = Math.random;
  const now = Date.now;
  Math.random = () => assert.fail("Math.random");
  Date.now = () => assert.fail("Date.now");
  try {
    for (const style of STYLES) frame(ambientLayer(style, "pure"), 7.1);
  } finally {
    Math.random = random;
    Date.now = now;
  }
});

test("pace speeds the movement up: twice the pace at one second is the frame at two", () => {
  for (const style of STYLES) assert.equal(frame({ ...ambientLayer(style, "p"), pace: 2 }, 1), frame(ambientLayer(style, "p"), 2), style);
});

test("a background that follows the voice swells with it, and one that doesn't ignores it", () => {
  for (const style of ["aurora", "bokeh", "rays", "grid"]) {
    const layer = ambientLayer(style, "v");
    assert.notEqual(frame({ ...layer, react: true }, 4, { level: () => 1 }), frame({ ...layer, react: true }, 4, { level: () => 0 }), `${style} reacts`);
    assert.equal(frame(layer, 4, { level: () => 1 }), frame(layer, 4, { level: () => 0 }), `${style} stays still`);
  }
});

test("every background paints its ground first, keeps to its budget, and leaves the canvas as it found it", () => {
  for (const style of STYLES) {
    const { ctx, calls, state, depth } = canvasLog();
    ctx.globalAlpha = 0.6;
    paintAmbient(ctx, { ...ambientLayer(style, "b"), fill: "#101820" }, page, environment(9));
    const first = calls.find((call) => DRAWS.has(call.op));
    assert.equal(first.op, "fillRect", style);
    assert.equal(first.fillStyle, "#101820", `${style} ground`);
    assert.deepEqual(first.args, [page.x, page.y, page.width, page.height]);
    const draws = calls.filter((call) => DRAWS.has(call.op)).length;
    assert.ok(draws <= 150, `${style}: ${draws} draws`);
    assert.equal(depth(), 0, `${style} restores what it saves`);
    assert.equal(state.globalAlpha, 0.6);
    assert.equal(state.globalCompositeOperation, "source-over");
    // Fades inside are shares of the layer's own.
    assert.ok(calls.every((call) => call.globalAlpha === undefined || call.globalAlpha <= 0.6 + 1e-9), `${style} stays within the layer's fade`);
  }
});

test("lights add up on a dark ground and are laid over a light one", () => {
  const modes = (fill) => {
    const { ctx, calls } = canvasLog();
    paintAmbient(ctx, { ...ambientLayer("bokeh", "m"), fill }, page, environment(1));
    return new Set(calls.filter((call) => call.op === "fillRect").map((call) => call.globalCompositeOperation));
  };
  assert.ok(modes("#0d0e10").has("lighter"));
  assert.ok(!modes("#f5f4f0").has("lighter"));
});

test("a new background covers the whole page", () => {
  assert.deepEqual(ambientLayer("grid", "g"), { id: "g", kind: "ambient", ambient: "grid", x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1, fill: "background" });
});

test("an effect laid over the design paints only its lights, cut to its box: no ground, no gradient across it, no darkened corners", () => {
  for (const style of STYLES) {
    const { ctx, calls } = canvasLog();
    paintAmbient(ctx, ambientLayer(style, "fx", true), page, environment(3));
    const covers = (call) => call.op === "fillRect" && call.args[0] <= page.x && call.args[1] <= page.y && call.args[2] >= page.width && call.args[3] >= page.height;
    const opaque = calls.filter((call) => covers(call) && typeof call.fillStyle === "string");
    assert.equal(opaque.length, 0, `${style}: nothing solid across the whole box`);
    assert.ok(!calls.some((call) => call.op === "createRadialGradient" && call.args[2] > 0 && Math.abs(call.args[0] - (page.x + page.width / 2)) < 1e-6 && call.args[5] > Math.hypot(page.width, page.height) / 2), `${style}: no vignette`);
    assert.ok(calls.some((call) => call.op === "clip"), `${style}: kept to its box`);
  }
  assert.equal(ambientLayer("aurora", "fx", true).fill, "none");
  assert.equal(ambientLayer("aurora", "bg").fill, "background");
});

test("the Videos tiles add a moving effect over the design, not a background under it", async () => {
  const { elementTiles } = await import("../dist/elements.js");
  const parts = Object.fromEntries(["captions", "bars", "wave", "pulse", "ring", "time", "avatar", "name", "handle", "title", "links"].map((key) => [key, key]));
  const videos = elementTiles(parts).filter((tile) => tile.id.startsWith("video:"));
  assert.equal(videos.length, STYLES.length);
  for (const tile of videos) {
    assert.ok(!tile.under, `${tile.id} goes on top`);
    const [layer] = tile.make("square", (kind) => `${kind}-1`);
    assert.equal(layer.kind, "ambient");
    assert.equal(layer.fill, "none", `${tile.id} has no ground of its own`);
    assert.ok(!layer.backdrop);
  }
});
