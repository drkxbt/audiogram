import { test } from "node:test";
import assert from "node:assert/strict";
import { paintPlaceholder } from "../dist/paint-placeholder.js";

// A 2D context that keeps every call with the drawing state at that moment; gradients keep their colour stops.
function canvasLog() {
  const calls = [];
  const state = { font: "", fillStyle: "#000000", strokeStyle: "#000000", globalAlpha: 1, globalCompositeOperation: "source-over", filter: "none", lineWidth: 1, shadowBlur: 0, shadowColor: "rgba(0, 0, 0, 0)", textAlign: "start", textBaseline: "alphabetic" };
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
    measureText: (text) => ({ width: text.length * 10 }),
    createLinearGradient: (...args) => gradient("createLinearGradient", args),
    createRadialGradient: (...args) => gradient("createRadialGradient", args),
  };
  const ctx = new Proxy(state, {
    get: (target, key) => (key in ops ? ops[key] : key in target ? target[key] : (...args) => calls.push({ op: key, args, ...state })),
    set: (target, key, value) => ((target[key] = value), true),
  });
  return { ctx, calls, state, depth: () => stack.length };
}

const square = (side) => ({ x: -side / 2, y: -side / 2, width: side, height: side });
const stopsOf = (calls) => calls.filter((call) => call.op === "fill" || call.op === "fillRect").flatMap((call) => call.fillStyle?.stops ?? []).map(([, color]) => color);

test("an empty frame shows a sky, a sun and hills in fixed colours at any size", () => {
  for (const side of [40, 100, 300]) {
    const { ctx, calls } = canvasLog();
    paintPlaceholder(ctx, square(side), 1, "Drop a photo");
    const colours = stopsOf(calls);
    assert.ok(colours.includes("#cfe1f7") && colours.includes("#eef4fb"), `${side}: the sky`);
    assert.ok(colours.includes("#6f95cc") && colours.includes("#a6c2ea"), `${side}: two blues of hills`);
    assert.ok(calls.some((call) => call.op === "createRadialGradient"), `${side}: the sun's glow`);
  }
});

test("the hint is written only once the frame is big enough, under a white badge that needs less room", () => {
  const badge = (calls) => calls.some((call) => call.op === "fill" && call.fillStyle === "#ffffff");
  const hint = (calls) => calls.find((call) => call.op === "fillText" && call.args[0] === "Drop a photo");

  const tiny = canvasLog();
  paintPlaceholder(tiny.ctx, square(50), 1, "Drop a photo");
  assert.ok(!badge(tiny.calls) && !hint(tiny.calls), "too small for either");

  const middle = canvasLog();
  paintPlaceholder(middle.ctx, square(100), 1, "Drop a photo");
  assert.ok(badge(middle.calls), "a badge");
  assert.ok(!hint(middle.calls), "but no hint");

  const big = canvasLog();
  paintPlaceholder(big.ctx, { x: -200, y: -150, width: 400, height: 300 }, 1, "Drop a photo");
  const written = hint(big.calls);
  assert.ok(badge(big.calls) && written, "a badge and the hint");
  // 6% of the shorter side, held between 11 and 22 pixels of a 1080 frame.
  assert.match(written.font, /^600 18px /);
  assert.equal(written.fillStyle, "#2f4a6e");
  assert.equal(written.textAlign, "center");
  assert.ok(Math.abs(written.args[1]) < 1e-9, "centred across");
  assert.ok(big.calls.some((call) => call.op === "setLineDash" && call.args[0].length === 2), "a dashed outline");
});

test("the hint's size is held between its limits, scaled with the frame being drawn", () => {
  const sizeAt = (side, unit) => {
    const { ctx, calls } = canvasLog();
    paintPlaceholder(ctx, square(side), unit, "Drop a photo");
    return Number(calls.find((call) => call.op === "fillText").font.match(/600 ([\d.]+)px/)[1]);
  };
  assert.equal(sizeAt(150, 1), 11);
  assert.equal(sizeAt(1000, 1), 22);
  assert.equal(sizeAt(1000, 2), 44);
});

test("the placeholder leaves the canvas as it found it", () => {
  const { ctx, state, depth } = canvasLog();
  ctx.fillStyle = "#123456";
  ctx.globalAlpha = 0.5;
  paintPlaceholder(ctx, square(300), 1, "Drop a photo");
  assert.equal(depth(), 0);
  assert.equal(state.fillStyle, "#123456");
  assert.equal(state.globalAlpha, 0.5);
  assert.equal(state.shadowBlur, 0);
});

test("an empty or collapsed box draws nothing", () => {
  const { ctx, calls } = canvasLog();
  paintPlaceholder(ctx, { x: 0, y: 0, width: 0, height: 200 }, 1, "Drop a photo");
  assert.equal(calls.length, 0);
});
