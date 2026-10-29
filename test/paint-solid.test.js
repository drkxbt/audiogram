import { test } from "node:test";
import assert from "node:assert/strict";
import { mix, paintSolid, solidLayer } from "../dist/paint-solid.js";
import { paintOf, THEMES } from "../dist/render.js";

const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);

// A 2D context that keeps every call with the drawing state at that moment; gradients keep their colour stops.
function canvasLog() {
  const calls = [];
  const state = { fillStyle: "#000000", strokeStyle: "#000000", globalAlpha: 1, globalCompositeOperation: "source-over", filter: "none", lineWidth: 1, lineJoin: "miter", lineCap: "butt" };
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
  };
  const ctx = new Proxy(state, {
    get: (target, key) => (key in ops ? ops[key] : key in target ? target[key] : (...args) => calls.push({ op: key, args, ...state })),
    set: (target, key, value) => ((target[key] = value), true),
  });
  return { ctx, calls, depth: () => stack.length };
}

const theme = THEMES[0];
const env = { theme, family: "Geist", unit: 1, time: 0, duration: 10, growth: 1, fill: (paint, fallback) => paintOf(paint, theme, fallback), flat: (paint, fallback) => paintOf(paint, theme, fallback), image: () => null, placeholders: false, placeholderText: "", level: () => 0 };
const solid = (form, extra = {}) => ({ id: "s", kind: "solid", solid: form, x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1, ...extra });
const box = { x: -150, y: -150, width: 300, height: 300 };
const paint = (layer, area = box) => {
  const log = canvasLog();
  paintSolid(log.ctx, layer, area, env);
  return log;
};

test("mix moves a colour toward another and leaves one it can't read alone", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mix("#ff0000", "#0000ff", 0), "#ff0000");
  assert.equal(mix("#ff0000", "#0000ff", 1), "#0000ff");
  assert.equal(mix("#f00", "#fff", 0.5), "#ff8080");
  assert.equal(mix("hsl(0 50% 50%)", "#ffffff", 0.5), "hsl(0 50% 50%)");
});

test("a sphere is shaded with a radial gradient lit from the top left, from light to dark in its own colour", () => {
  const { calls } = paint(solid("sphere", { fill: "#3366cc" }));
  const body = calls.find((call) => call.op === "fill" && call.fillStyle?.op === "createRadialGradient");
  assert.ok(body, "filled with a radial gradient");
  const [x, y] = body.fillStyle.args;
  assert.ok(x < 0 && y < 0, "its light sits up and to the left");
  const stops = body.fillStyle.stops.map(([, color]) => color);
  assert.equal(stops[0], mix("#3366cc", "#ffffff", 0.62));
  assert.equal(stops.at(-1), mix("#3366cc", "#000000", 0.58));
});

test("a cube fills three faces, each its own shade", () => {
  const { calls } = paint(solid("cube"));
  const faces = [];
  for (let i = 0; i < calls.length; i++) {
    if (calls[i].op !== "fill") continue;
    let start = i;
    while (start > 0 && calls[start].op !== "beginPath") start--;
    const corners = calls.slice(start, i).filter((call) => call.op === "moveTo" || call.op === "lineTo").length;
    if (corners === 4 && calls.slice(start, i).some((call) => call.op === "closePath")) faces.push(calls[i].fillStyle);
  }
  assert.equal(faces.length, 3, `${faces.length} faces`);
  assert.equal(new Set(faces).size, 3, "three different shades");
});

test("every form draws, casts its floor shadow unless told not to, and restores the canvas", () => {
  for (const form of ["sphere", "cube", "cylinder", "capsule", "cone", "torus", "pyramid"]) {
    const shaded = paint(solid(form));
    const bare = paint(solid(form, { shadow: false }));
    assert.equal(shaded.depth(), 0, `${form} restores what it saves`);
    assert.ok(shaded.calls.some((call) => call.op === "fill" || call.op === "fillRect"), `${form} draws`);
    const radial = (calls) => calls.filter((call) => call.op === "createRadialGradient").length;
    assert.equal(radial(shaded.calls) - radial(bare.calls), 2, `${form}'s shadow is two soft blots`);
    const matte = paint(solid(form, { gloss: false }));
    assert.ok(matte.calls.length < shaded.calls.length, `${form} has a shine unless gloss is off`);
  }
});

test("a metal form is shaded from the metal's own colour, a theme colour from the theme", () => {
  const gold = paint(solid("sphere", { fill: "metal:gold" }));
  const body = gold.calls.find((call) => call.op === "fill" && call.fillStyle?.op === "createRadialGradient");
  assert.equal(body.fillStyle.stops[2][1], "#d4af37");
  const accent = paint(solid("sphere"));
  assert.equal(accent.calls.find((call) => call.op === "fill" && call.fillStyle?.op === "createRadialGradient").fillStyle.stops[2][1], theme.accent);
});

test("a stretched box stretches the form, and an empty one draws nothing", () => {
  const { calls } = paint(solid("sphere"), { x: -200, y: -50, width: 400, height: 100 });
  const scale = calls.find((call) => call.op === "scale");
  near(scale.args[1], 0.25);
  assert.equal(paint(solid("cube"), { x: 0, y: 0, width: 0, height: 10 }).calls.length, 0);
});

test("a new solid is square on the page, about a third of its shorter side, in the middle", () => {
  for (const [width, height] of [[1080, 1080], [1080, 1920], [1920, 1080]]) {
    const layer = solidLayer("torus", "s1", width, height);
    assert.equal(layer.kind, "solid");
    assert.equal(layer.solid, "torus");
    near(layer.w * width, layer.h * height);
    near(layer.w * width, Math.min(width, height) * 0.32);
    near(layer.x + layer.w / 2, 0.5);
    near(layer.y + layer.h / 2, 0.5);
  }
});
