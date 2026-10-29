import { test } from "node:test";
import assert from "node:assert/strict";
import { DEVICES, mockupLayer, mockupScreen, paintMockup } from "../dist/paint-mockup.js";
import { paintOf, THEMES } from "../dist/render.js";

const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);

// A 2D context that keeps every call with the drawing state at that moment; gradients keep their colour stops.
function canvasLog() {
  const calls = [];
  const state = { font: "", fillStyle: "#000000", strokeStyle: "#000000", globalAlpha: 1, globalCompositeOperation: "source-over", filter: "none", lineWidth: 1, shadowBlur: 0, shadowColor: "rgba(0, 0, 0, 0)", shadowOffsetX: 0, shadowOffsetY: 0, textAlign: "start", textBaseline: "alphabetic" };
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

const theme = THEMES[0];
const environment = (extra = {}) => {
  const images = extra.images ?? new Map();
  return {
    theme, family: "Geist", unit: 1, time: 0, duration: 10, growth: 1,
    fill: (paint, fallback) => paintOf(paint, theme, fallback),
    flat: (paint, fallback) => paintOf(paint, theme, fallback),
    image: (key) => images.get(key ?? "") ?? null,
    placeholders: true, placeholderText: "Drop a photo", level: () => 0,
    ...extra,
  };
};
const mockup = (device, extra = {}) => ({ id: "m", kind: "mockup", device, x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1, ...extra });
const boxFor = (device, height = 700) => {
  const width = height * DEVICES[device].aspect;
  return { x: -width / 2, y: -height / 2, width, height };
};
const skyOf = (calls) => calls.some((call) => (call.op === "fill" || call.op === "fillRect") && call.fillStyle?.stops?.some(([, color]) => color === "#cfe1f7"));

/** The bounds of the path traced between the last beginPath and `end`, from its moveTo and arcTo points. */
function pathBounds(calls, end) {
  let start = end;
  while (start > 0 && calls[start].op !== "beginPath") start--;
  const points = calls.slice(start, end).flatMap((call) => (call.op === "moveTo" || call.op === "lineTo" ? [call.args] : call.op === "arcTo" ? [call.args.slice(0, 2), call.args.slice(2, 4)] : []));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { x: Math.min(...xs), y: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

test("a phone shows its picture cut to the screen mockupScreen gives, covering all of it", () => {
  const picture = { width: 1080, height: 1920 };
  const box = boxFor("phone");
  const screen = mockupScreen("phone", box);
  const { ctx, calls, depth } = canvasLog();
  paintMockup(ctx, mockup("phone", { image: "p", filter: "mono" }), box, environment({ images: new Map([["p", picture]]) }));
  const draw = calls.findIndex((call) => call.op === "drawImage" && call.args[0] === picture);
  assert.ok(draw >= 0, "the picture is drawn");
  let clip = draw;
  while (clip > 0 && calls[clip].op !== "clip") clip--;
  const bounds = pathBounds(calls, clip);
  near(bounds.x, screen.x);
  near(bounds.y, screen.y);
  near(bounds.right, screen.x + screen.width);
  near(bounds.bottom, screen.y + screen.height);
  const [, x, y, w, h] = calls[draw].args;
  assert.ok(x <= screen.x + 1e-6 && y <= screen.y + 1e-6 && x + w >= screen.x + screen.width - 1e-6 && y + h >= screen.y + screen.height - 1e-6, `${calls[draw].args.slice(1)}`);
  assert.match(calls[draw].filter, /grayscale/, "toned as the layer says");
  assert.ok(!skyOf(calls), "no placeholder under a picture");
  assert.equal(depth(), 0, "every save restored");
});

test("an empty screen shows the placeholder only while editing, and a dark screen in the video", () => {
  const box = boxFor("phone");
  const editing = canvasLog();
  paintMockup(editing.ctx, mockup("phone"), box, environment({ placeholders: true }));
  assert.ok(skyOf(editing.calls), "the empty-frame drawing while editing");
  assert.ok(editing.calls.some((call) => call.op === "fillText" && call.args[0] === "Drop a photo"), "with its hint");
  const video = canvasLog();
  paintMockup(video.ctx, mockup("phone"), box, environment({ placeholders: false }));
  assert.ok(!skyOf(video.calls), "no placeholder in the video");
  assert.ok(!video.calls.some((call) => call.op === "fillText"), "and no hint");
  assert.ok(video.calls.some((call) => call.op === "fillRect" && call.fillStyle?.stops?.some(([, color]) => color === "#060709")), "a dark screen instead");
});

test("the body takes the layer's colour, and its own when it has none", () => {
  const box = boxFor("phone");
  const fills = (layer) => {
    const { ctx, calls } = canvasLog();
    paintMockup(ctx, layer, box, environment());
    return calls.filter((call) => call.op === "fill").map((call) => call.fillStyle);
  };
  assert.ok(fills(mockup("phone")).includes("#111214"));
  assert.ok(fills(mockup("phone", { fill: "#d4af37" })).includes("#d4af37"));
  assert.ok(fills(mockup("laptop")).includes("#c9ccd1"), "a silver base under a dark lid");
});

test("every device draws inside its box with a screen inside it, with or without a picture", () => {
  const picture = { width: 1200, height: 800 };
  for (const device of Object.keys(DEVICES)) {
    const box = boxFor(device, 500);
    const screen = mockupScreen(device, box);
    assert.ok(screen.width > 0 && screen.height > 0, `${device} has a screen`);
    assert.ok(screen.x >= box.x - 1e-9 && screen.y >= box.y - 1e-9 && screen.x + screen.width <= box.x + box.width + 1e-9 && screen.y + screen.height <= box.y + box.height + 1e-9, `${device}'s screen is inside its box`);
    for (const image of [undefined, "p"]) {
      const { ctx, calls, depth } = canvasLog();
      paintMockup(ctx, mockup(device, { image, text: "Side A" }), box, environment({ images: new Map([["p", picture]]) }));
      assert.equal(depth(), 0, `${device} restores what it saves`);
      assert.equal(calls.some((call) => call.op === "drawImage" && call.args[0] === picture), image !== undefined, `${device} draws its picture only when it has one`);
    }
  }
});

test("a polaroid writes its caption on the strip under the picture, and a browser shows its three window buttons", () => {
  const box = boxFor("polaroid");
  const screen = mockupScreen("polaroid", box);
  const { ctx, calls } = canvasLog();
  paintMockup(ctx, mockup("polaroid", { text: "Summer, 1998" }), box, environment());
  const caption = calls.find((call) => call.op === "fillText" && call.args[0] === "Summer, 1998");
  assert.ok(caption, "the caption");
  assert.ok(caption.args[2] > screen.y + screen.height && caption.args[2] < box.y + box.height, "under the picture");
  assert.equal(caption.fillStyle, "#34322d", "dark ink on the white card");

  const window = canvasLog();
  paintMockup(window.ctx, mockup("browser"), boxFor("browser"), environment());
  const colours = window.calls.filter((call) => call.op === "fill").map((call) => call.fillStyle);
  for (const color of ["#ff5f57", "#febc2e", "#28c840"]) assert.ok(colours.includes(color), color);
});

test("a vinyl record has a hole through its middle and shows the picture on its sleeve and its label", () => {
  const picture = { width: 1000, height: 1000 };
  const box = boxFor("vinyl", 400);
  const { ctx, calls } = canvasLog();
  paintMockup(ctx, mockup("vinyl", { image: "p" }), box, environment({ images: new Map([["p", picture]]) }));
  assert.equal(calls.filter((call) => call.op === "drawImage" && call.args[0] === picture).length, 2, "on the sleeve and the label");
  assert.ok(calls.some((call) => call.op === "fill" && call.args[0] === "evenodd"), "the spindle hole is cut through");
});

test("a new mockup is shaped to its device, centred, and kept inside the page", () => {
  for (const [frameWidth, frameHeight] of [[1080, 1080], [1080, 1920], [1920, 1080]]) {
    for (const device of Object.keys(DEVICES)) {
      const layer = mockupLayer(device, "new", frameWidth, frameHeight);
      assert.equal(layer.kind, "mockup");
      assert.equal(layer.device, device);
      near((layer.w * frameWidth) / (layer.h * frameHeight), DEVICES[device].aspect, 1e-9);
      near(layer.x + layer.w / 2, 0.5, 1e-9);
      near(layer.y + layer.h / 2, 0.5, 1e-9);
      assert.ok(layer.w <= 0.9 + 1e-9 && layer.h <= 0.9 + 1e-9, `${device} on ${frameWidth}x${frameHeight}`);
      // As much room as a square 0.45 of the shorter side, unless that would not fit.
      const area = layer.w * frameWidth * layer.h * frameHeight;
      assert.ok(area <= (Math.min(frameWidth, frameHeight) * 0.45) ** 2 + 1e-6, `${device} area`);
    }
  }
});
