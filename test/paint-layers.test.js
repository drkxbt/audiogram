import { test } from "node:test";
import assert from "node:assert/strict";
import { Painter, textHeight, THEMES } from "../dist/render.js";
import { defaultLayers } from "../dist/layers.js";

// A 2D context that keeps every call, with the drawing state at the moment of each fillText and drawImage.
function canvasLog(width, height) {
  const calls = [];
  const state = { font: "", fillStyle: "", strokeStyle: "", globalAlpha: 1, textAlign: "start", textBaseline: "alphabetic", lineWidth: 1 };
  const stack = [];
  const ops = {
    save: () => stack.push({ ...state }),
    restore: () => Object.assign(state, stack.pop()),
    measureText: (text) => ({ width: text.length * (Number(state.font.match(/(\d+(?:\.\d+)?)px/)?.[1]) || 10) * 0.5 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    fillText: (text, x, y) => calls.push({ op: "fillText", text, x, y, ...state }),
    drawImage: (image, ...rect) => calls.push({ op: "drawImage", image, rect, ...state }),
  };
  const ctx = new Proxy(state, {
    get: (target, key) => (key === "canvas" ? { width, height } : key in ops ? ops[key] : key in target ? target[key] : (...args) => calls.push({ op: key, args, ...state })),
    set: (target, key, value) => ((target[key] = value), true),
  });
  return { ctx, calls };
}

const scene = (extra = {}) => ({
  layout: "square", visual: "bars", theme: THEMES[0], title: "Shipping in public", speaker: "drk", handle: "@drkxbt", cover: null,
  captions: [], audio: { samples: new Float32Array(48000), sampleRate: 48000, start: 0, end: 6 }, font: "Geist", ...extra,
});

test("a text layer is painted where it sits, turned about its centre, in its own font, size and colour", () => {
  const layer = { id: "t1", kind: "text", text: "Hello there", x: 0.1, y: 0.2, w: 0.5, h: 0.1, rotation: 30, opacity: 0.5, font: "Anton", size: 80, weight: 400, color: "#ff3366", align: "left" };
  const { ctx, calls } = canvasLog(1080, 1080);
  new Painter(scene({ layers: [layer] })).paint(ctx, 1);
  const text = calls.find((call) => call.op === "fillText" && call.text === "Hello there");
  assert.ok(text, calls.filter((call) => call.op === "fillText").map((call) => call.text).join(" | "));
  assert.match(text.font, /80px/);
  assert.match(text.font, /Anton/);
  assert.equal(text.fillStyle, "#ff3366");
  assert.equal(text.globalAlpha, 0.5);
  const turn = calls.find((call) => call.op === "translate");
  assert.ok(Math.abs(turn.args[0] - 0.35 * 1080) < 1e-6 && Math.abs(turn.args[1] - 0.25 * 1080) < 1e-6, `translate ${turn.args}`);
  assert.ok(calls.some((call) => call.op === "rotate" && Math.abs(call.args[0] - Math.PI / 6) < 1e-9));
});

test("hidden layers are not painted, and theme colours follow the theme", () => {
  const layers = defaultLayers("square").map((layer) => (layer.kind === "handle" ? { ...layer, hidden: true } : layer.kind === "name" ? { ...layer, color: "accent" } : layer));
  const { ctx, calls } = canvasLog(1080, 1080);
  new Painter(scene({ layers, theme: THEMES[3] })).paint(ctx, 1);
  const texts = calls.filter((call) => call.op === "fillText");
  assert.ok(!texts.some((call) => call.text === "@drkxbt"), "the hidden handle");
  assert.equal(texts.find((call) => call.text === "drk").fillStyle, THEMES[3].accent);
  assert.equal(texts.find((call) => call.text === "Shipping in public").fillStyle, THEMES[3].text);
});

test("a picture layer draws its picture inside its box, and a shape fills its own", () => {
  const picture = { width: 800, height: 400 };
  const layers = [
    { id: "p", kind: "image", image: "a", x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 },
    { id: "s", kind: "shape", shape: "ellipse", fill: "#00ff00", x: 0, y: 0, w: 0.1, h: 0.1, rotation: 0, opacity: 1 },
  ];
  const { ctx, calls } = canvasLog(1000, 1000);
  new Painter(scene({ layers, images: new Map([["a", picture]]) })).paint(ctx, 1);
  const draw = calls.find((call) => call.op === "drawImage" && call.image === picture);
  assert.ok(draw, "the picture is drawn");
  // In the layer's own frame, centred on the origin after the translate: a 400 by 200 box.
  const [x, y, w, h] = draw.rect;
  assert.ok(Math.abs(x + w / 2) < 1e-6 && Math.abs(y + h / 2) < 1e-6 && Math.abs(w - 400) < 1e-6 && Math.abs(h - 200) < 1e-6, `${draw.rect}`);
  assert.ok(calls.some((call) => call.op === "ellipse"));
  assert.ok(calls.some((call) => call.op === "fill" && call.fillStyle === "#00ff00"));
});

test("captions take their layer's font, size and highlight", () => {
  const cue = { start: 0, end: 4, text: "ship it now", words: [{ text: "ship", start: 0, end: 1 }, { text: "it", start: 1, end: 2 }, { text: "now", start: 2, end: 3 }] };
  const layers = defaultLayers("square").map((layer) => (layer.kind === "captions" ? { ...layer, font: "Bebas Neue", size: 90, highlight: "#ffcc00", color: "#ffffff" } : layer));
  const { ctx, calls } = canvasLog(1080, 1080);
  new Painter(scene({ layers, captions: [cue] })).paint(ctx, 1.5);
  const said = calls.find((call) => call.op === "fillText" && call.text === "ship");
  assert.match(said.font, /90px/);
  assert.match(said.font, /Bebas Neue/);
  assert.equal(said.fillStyle, "#ffffff");
  // The word being said sits on the highlight.
  assert.ok(calls.some((call) => call.op === "fill" && call.fillStyle === "#ffcc00"));
});

test("a text layer's height follows its lines: more words, a narrower box or a bigger size make it taller", () => {
  const { ctx } = canvasLog(1080, 1080);
  const layer = { id: "t", kind: "text", text: "one two three four five six seven", x: 0, y: 0, w: 0.5, h: 0.1, rotation: 0, opacity: 1, size: 40 };
  const one = textHeight(ctx, { ...layer, text: "one" }, "one", "Geist", 1080, 1080);
  const many = textHeight(ctx, layer, layer.text, "Geist", 1080, 1080);
  const narrow = textHeight(ctx, { ...layer, w: 0.2 }, layer.text, "Geist", 1080, 1080);
  const big = textHeight(ctx, { ...layer, size: 80 }, layer.text, "Geist", 1080, 1080);
  assert.ok(Math.abs(one - (40 * 1.15) / 1080) < 1e-9, `${one}`);
  assert.ok(many >= one && narrow > many && big > many, `${one} ${many} ${narrow} ${big}`);
  // A new line typed counts as a line.
  assert.ok(Math.abs(textHeight(ctx, layer, "a\nb", "Geist", 1080, 1080) - (2 * 40 * 1.15) / 1080) < 1e-9);
});
