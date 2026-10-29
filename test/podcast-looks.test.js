import { test } from "node:test";
import assert from "node:assert/strict";
import { FILTERS, Painter, THEMES } from "../dist/render.js";
import { libraryPhotos, PHOTO_KEY } from "../dist/layers.js";

// A 2D context that keeps every call in `log` with the drawing state at that moment, and follows its transform so the
// painter can find where a layer lands on the canvas. `filters` says whether it has canvas filters, as most browsers
// do and older Safari doesn't: the property sits on the context's prototype, as it does in a browser.
function recorder(canvas, log, filters) {
  const proto = filters ? { filter: "none" } : {};
  const values = { ...proto, globalAlpha: 1, fillStyle: "#000000", globalCompositeOperation: "source-over", shadowColor: "transparent", shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, font: "", textAlign: "start", textBaseline: "alphabetic" };
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const note = (op, args) => log.push({ on: canvas, op, args, alpha: values.globalAlpha, filter: values.filter, composite: values.globalCompositeOperation, fillStyle: values.fillStyle, shadowBlur: values.shadowBlur, shadowOffsetX: values.shadowOffsetX, smooth: values.imageSmoothingEnabled });
  const ops = {
    save: () => stack.push({ values: { ...values }, m: [...m] }),
    restore: () => {
      const top = stack.pop();
      for (const key of Object.keys(values)) delete values[key];
      Object.assign(values, top.values);
      m = top.m;
    },
    translate: (x, y) => {
      note("translate", [x, y]);
      m = [m[0], m[1], m[2], m[3], m[4] + m[0] * x + m[2] * y, m[5] + m[1] * x + m[3] * y];
    },
    rotate: (t) => {
      const [a, b, c, d, e, f] = m;
      m = [a * Math.cos(t) + c * Math.sin(t), b * Math.cos(t) + d * Math.sin(t), -a * Math.sin(t) + c * Math.cos(t), -b * Math.sin(t) + d * Math.cos(t), e, f];
    },
    scale: (x, y) => {
      m = [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]];
    },
    setTransform: (...args) => {
      m = args;
    },
    getTransform: () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }),
    measureText: (text) => ({ width: text.length * 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  };
  return new Proxy(Object.create(proto), {
    get: (_, key) => (key === "canvas" ? canvas : key in ops ? ops[key] : key in values ? values[key] : (...args) => note(key, args)),
    set: (_, key, value) => ((values[key] = value), true),
    has: (_, key) => key in values || key in ops || key === "canvas",
  });
}

/** Off-screen canvases as the painter makes them, each drawing into the same log. */
function offscreen(log, filters) {
  const made = [];
  globalThis.OffscreenCanvas = class {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.context = recorder(this, log, filters);
      made.push(this);
    }
    getContext() {
      return this.context;
    }
  };
  return made;
}

const scene = (extra = {}) => ({
  layout: "square", visual: "bars", theme: THEMES[0], title: "", speaker: "", handle: "", cover: null,
  captions: [], audio: { samples: new Float32Array(48000), sampleRate: 48000, start: 0, end: 60 }, font: "Geist", ...extra,
});

const photo = { id: "p", kind: "shape", shape: "rect", fill: "#cc3311", x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1 };
const card = { id: "glass", kind: "shape", shape: "rect", radius: 0.08, fill: "#ffffff", opacity: 0.2, frost: 24, x: 0.2, y: 0.25, w: 0.6, h: 0.5, rotation: 0 };

test("a frosted shape paints a blurred copy of what is under it inside its outline, then its tint", (t) => {
  t.after(() => delete globalThis.OffscreenCanvas);
  const log = [];
  offscreen(log, true);
  const main = { width: 1080, height: 1080 };
  new Painter(scene({ layers: [photo, card] })).paint(recorder(main, log, true), 1);

  const under = log.findIndex((call) => call.on === main && call.op === "fill" && call.fillStyle === "#cc3311");
  const copy = log.findIndex((call) => call.on !== main && call.op === "drawImage" && call.args[0] === main);
  assert.ok(under >= 0 && copy > under, "the copy is taken after what lies under the card is painted");
  assert.equal(log[copy].filter, "blur(24px)", "blurred by the frost, in pixels of this 1080 frame");
  // Only the card's box and the reach of the blur round it is copied, not the whole frame.
  const [sx, sy, sw, sh] = log[copy].args.slice(1, 5);
  assert.deepEqual([sx, sy, sw, sh], [216 - 60, 270 - 60, 648 + 120, 540 + 120]);

  const glass = log.findIndex((call) => call.on === main && call.op === "drawImage" && call.args[0] === log[copy].on);
  assert.ok(glass > copy, "the blurred copy is laid back on the frame");
  assert.ok(log.slice(under + 1, glass).some((call) => call.on === main && call.op === "clip"), "cut to the card's outline");
  assert.equal(log[glass].alpha, 1, "the glass leaves out the layer's opacity");
  assert.deepEqual(log[glass].args.slice(5), [156, 210, 768, 660], "laid back exactly where it was copied from");
  const tint = log.findIndex((call) => call.on === main && call.op === "fill" && call.fillStyle === "#ffffff");
  assert.ok(tint > glass, "the tint goes over the glass");
  assert.equal(log[tint].alpha, 0.2, "the opacity sets how strong the tint is");
});

test("without canvas filters the glass is softened by shrinking it and drawing it back up", (t) => {
  t.after(() => delete globalThis.OffscreenCanvas);
  const log = [];
  offscreen(log, false);
  const main = { width: 1080, height: 1080 };
  new Painter(scene({ layers: [photo, card] })).paint(recorder(main, log, false), 1);
  assert.ok(!log.some((call) => String(call.filter ?? "").startsWith("blur")), "no filter is used");
  const shrink = log.find((call) => call.on !== main && call.op === "drawImage" && call.args[0] === main);
  assert.ok(shrink, "the frame under the card is copied");
  const [, , , sw, sh, , , dw, dh] = shrink.args;
  assert.ok(dw < sw / 20 && dh < sh / 20, `shrunk to a few pixels: ${dw} by ${dh}`);
  const grow = log.find((call) => call.op === "drawImage" && call.args[0] === shrink.on);
  assert.ok(grow && grow.on !== main, "drawn back up on the glass");
  assert.deepEqual(grow.args.slice(7), [sw, sh], "to the size it was copied at");
  assert.ok(log.some((call) => call.on === main && call.op === "drawImage" && call.args[0] === grow.on), "and laid on the frame");
});

// Glass across the whole width of the frame, as a band is: the frame's edge is inside the blur's reach on both sides.
const band = { ...card, x: 0, w: 1, radius: 0 };

test("glass touching the frame's edge is frosted to the edge: the edge pixels are stretched past it before the blur", (t) => {
  t.after(() => delete globalThis.OffscreenCanvas);
  const log = [];
  offscreen(log, true);
  const main = { width: 1080, height: 1080 };
  new Painter(scene({ layers: [photo, band] })).paint(recorder(main, log, true), 1);
  // The copy reaches 60 px round the band, which is 0 to 1080 across, 270 to 810 down: past the left and right edges.
  const copies = log.filter((call) => call.on !== main && call.op === "drawImage" && call.args[0] === main);
  assert.ok(copies.length && copies.every((call) => call.filter !== "blur(24px)" && call.smooth === false), "copied unblurred and unsmoothed");
  const edge = copies[0].on;
  assert.ok(copies.every((call) => call.on === edge), "all onto one canvas");
  assert.deepEqual(copies.map((call) => call.args.slice(1)), [
    [0, 210, 1, 660, 0, 0, 60, 660],
    [0, 210, 1080, 660, 60, 0, 1080, 660],
    [1079, 210, 1, 660, 1140, 0, 60, 660],
  ], "the first and last columns stretched 60 px out each side of the band's own pixels");
  const blurred = log.find((call) => call.op === "drawImage" && call.args[0] === edge);
  assert.equal(blurred.filter, "blur(24px)");
  // Plus zero, as the band starts at the top of its copy: drawn at -0 there, which a canvas takes as 0.
  assert.deepEqual(blurred.args.slice(1).map((n) => n + 0), [0, 0, 1200, 660, -60, 0, 1200, 660], "blurred whole, the band's own part landing in the corner");
  const laid = log.find((call) => call.on === main && call.op === "drawImage" && call.args[0] === blurred.on);
  assert.deepEqual(laid.args.slice(1), [0, 0, 1080, 660, 0, 210, 1080, 660], "only the band's own part is laid back");
});

test("glass touching the frame's edge is softened to the edge without canvas filters too", (t) => {
  t.after(() => delete globalThis.OffscreenCanvas);
  const log = [];
  offscreen(log, false);
  const main = { width: 1080, height: 1080 };
  new Painter(scene({ layers: [photo, band] })).paint(recorder(main, log, false), 1);
  const edge = log.find((call) => call.on !== main && call.op === "drawImage" && call.args[0] === main).on;
  const shrink = log.find((call) => call.op === "drawImage" && call.args[0] === edge);
  assert.deepEqual(shrink.args.slice(1, 5), [0, 0, 1200, 660], "the stretched copy is what is shrunk");
  const grow = log.find((call) => call.op === "drawImage" && call.args[0] === shrink.on);
  assert.deepEqual(grow.args.slice(5).map((n) => n + 0), [-60, 0, 1200, 660], "and drawn back up over the same span");
  assert.ok(log.some((call) => call.on === main && call.op === "drawImage" && call.args[0] === grow.on && call.args[5] === 0 && call.args[7] === 1080), "then laid on the frame");
});

test("a shape's shadow falls outside its outline, under it", (t) => {
  t.after(() => delete globalThis.OffscreenCanvas);
  const log = [];
  offscreen(log, true);
  const main = { width: 1080, height: 1080 };
  const panel = { ...card, frost: undefined, opacity: 1, shadow: true };
  new Painter(scene({ layers: [panel] })).paint(recorder(main, log, true), 1);
  const cast = log.find((call) => call.on !== main && call.op === "fill" && call.shadowBlur > 0);
  assert.ok(cast, "the shadow is cast on a canvas of its own");
  assert.ok(cast.shadowOffsetX < 0, "from a shape drawn off to the side, so only the shadow lands");
  const cut = log.find((call) => call.on === cast.on && call.op === "fill" && call.composite === "destination-out");
  assert.ok(cut, "the outline is cut out of the shadow");
  const laid = log.findIndex((call) => call.on === main && call.op === "drawImage" && call.args[0] === cast.on);
  const fill = log.findIndex((call) => call.on === main && call.op === "fill" && call.fillStyle === "#ffffff");
  assert.ok(laid >= 0 && fill > laid, "the shadow goes down before the shape is filled");
});

// The ring's dots as painted: each an arc filled at its own strength.
function ringDots(painter, time) {
  const log = [];
  painter.paint(recorder({ width: 1080, height: 1080 }, log, true), time);
  return log.filter((call) => call.op === "arc").map((call) => ({ radius: call.args[2], alpha: call.alpha }));
}

const ring = { id: "ring", kind: "visual", visual: "ring", color: "#ffffff", x: 0.2, y: 0.2, w: 0.6, h: 0.6, rotation: 0, opacity: 1 };

test("the ring lights its dots as far as the clip has played, the newest few brighter and larger", () => {
  const dots = ringDots(new Painter(scene({ layers: [ring] })), 15);
  assert.equal(dots.length, 60);
  const lit = dots.filter((dot) => dot.alpha >= 0.7);
  assert.equal(lit.length, 15, "a quarter of the way through, a quarter of the dots");
  assert.ok(dots.slice(0, 15).every((dot) => dot.alpha >= 0.7) && dots.slice(15).every((dot) => Math.abs(dot.alpha - 0.2) < 1e-9), "lit from the top round, the rest dim");
  assert.ok(dots[14].radius > dots[13].radius && dots[13].radius > dots[0].radius, "the head of the comet is larger");
  assert.ok(dots[14].alpha > dots[0].alpha, "and brighter");
  assert.equal(dots[0].radius, dots[40].radius, "behind the head a lit dot is the size of a dim one in silence");
});

const clockLayer = (clock) => ({ id: "t", kind: "time", x: 0, y: 0, w: 1, h: 0.1, rotation: 0, opacity: 1, clock });
const litDots = (painter, time) => ringDots(painter, time).filter((dot) => dot.alpha >= 0.7).length;

test("a still frame being edited, with a clip, shows the ring and the clock where the playhead is", () => {
  const painter = new Painter(scene({ layers: [ring] }));
  painter.animate = false;
  painter.placeholders = true;
  assert.equal(litDots(painter, 0), 0, "at the start");
  assert.equal(painter.textOf(clockLayer("percent"), 0), "0%");
  assert.equal(litDots(painter, 30), 30, "halfway");
  assert.equal(painter.textOf(clockLayer("percent"), 30), "50%");
});

test("with no clip to follow, the ring and every clock show one sample point most of the way through a minute", () => {
  const noClip = { samples: new Float32Array(1), sampleRate: 48000, start: 0, end: 0 };
  // A template's thumbnail, painted over the user's clip wherever its playhead is, and a design before any recording.
  for (const [audio, time] of [[undefined, 0], [undefined, 12], [noClip, 0]]) {
    const painter = new Painter(scene({ layers: [ring], ...(audio ? { audio } : {}) }));
    painter.animate = false;
    painter.placeholders = true;
    painter.sampleProgress = true;
    assert.equal(litDots(painter, time), 42, "seven tenths of the ring");
    assert.deepEqual(["both", "elapsed", "remaining", "percent"].map((clock) => painter.textOf(clockLayer(clock), time)), ["0:42 / 1:00", "0:42", "-0:18", "70%"]);
  }
});

test("lit dots swell with the voice", () => {
  const sampleRate = 48000;
  const samples = new Float32Array(sampleRate * 2);
  for (let i = 0; i < samples.length; i++) samples[i] = 0.6 * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
  // Halfway through a two second clip, so half the ring is lit.
  const quiet = ringDots(new Painter(scene({ layers: [ring], audio: { samples: new Float32Array(samples.length), sampleRate, start: 0, end: 2 } })), 1);
  const loud = ringDots(new Painter(scene({ layers: [ring], audio: { samples, sampleRate, start: 0, end: 2 } })), 1);
  const size = (dots) => dots.slice(0, 30).reduce((sum, dot) => sum + dot.radius, 0);
  assert.ok(size(loud) > size(quiet) * 1.02, "the lit dots grow");
  assert.equal(loud[45].radius, quiet[45].radius, "a dim one doesn't");
});

test("the clock shows the time played and the length, the time played, the time left, or a percent", () => {
  const painter = new Painter(scene());
  const time = (clock) => painter.textOf({ id: "t", kind: "time", x: 0, y: 0, w: 1, h: 0.1, rotation: 0, opacity: 1, clock }, 16.4);
  assert.equal(time(undefined), "0:16 / 1:00");
  assert.equal(time("both"), "0:16 / 1:00");
  assert.equal(time("elapsed"), "0:16");
  assert.equal(time("remaining"), "-0:44");
  assert.equal(time("percent"), "27%");
  assert.equal(new Painter(scene({ audio: { samples: new Float32Array(0), sampleRate: 48000, start: 0, end: 0 } })).textOf({ id: "t", kind: "time", x: 0, y: 0, w: 1, h: 0.1, rotation: 0, opacity: 1, clock: "percent" }, 0), "0%", "no clip yet");
});

test("the single-tone filters turn a photo into one tone, on photo layers like the rest", () => {
  for (const name of ["amber", "slate", "ash"]) assert.match(FILTERS[name], /^grayscale\(1\)/, name);
  const picture = { width: 800, height: 600 };
  const log = [];
  const backdrop = { id: "bg", kind: "image", image: "a", backdrop: true, filter: "amber", x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1 };
  new Painter(scene({ layers: [backdrop], images: new Map([["a", picture]]) })).paint(recorder({ width: 1080, height: 1080 }, log, true), 1);
  assert.equal(log.find((call) => call.op === "drawImage" && call.args[0] === picture).filter, FILTERS.amber);
});

test("a photo: key finds its photo in the host's library, once, and an unknown one finds nothing", () => {
  const photos = [{ id: "fog", thumb: "fog-small.jpg" }, { id: "dunes", thumb: "dunes-small.jpg" }];
  const layers = [{ image: `${PHOTO_KEY}fog` }, { image: "picture-1" }, {}, { image: "photo:fog" }, { image: "photo:gone" }, { image: "photo:dunes" }];
  assert.deepEqual(libraryPhotos(layers, photos), [{ key: "photo:fog", photo: photos[0] }, { key: "photo:dunes", photo: photos[1] }]);
  assert.deepEqual(libraryPhotos(layers), [], "before the library arrives");
});

test("a photo layer draws its library photo by its key, and nothing while it is still missing", () => {
  const picture = { width: 1200, height: 800 };
  const layer = { id: "bg", kind: "image", image: "photo:fog", backdrop: true, x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1 };
  const paint = (images) => {
    const log = [];
    const painter = new Painter(scene({ layers: [layer, { ...layer, id: "frame", image: undefined, backdrop: false }], images }));
    painter.animate = false;
    painter.placeholders = true;
    painter.placeholderText = "Drop a photo";
    painter.paint(recorder({ width: 1080, height: 1080 }, log, true), 0);
    return log;
  };
  assert.ok(paint(new Map([["photo:fog", picture]])).some((call) => call.op === "drawImage" && call.args[0] === picture));
  const hints = paint(new Map()).filter((call) => call.op === "fillText" && call.args[0] === "Drop a photo");
  assert.equal(hints.length, 1, "only the empty frame asks for a photo");
});

test("the Elements panel offers the sound ring in a square of its own where the bars would sit", async () => {
  const { elementTiles } = await import("../dist/elements.js");
  const names = { captions: "Captions", bars: "Sound bars", wave: "Sound wave", pulse: "Pulse", ring: "Sound ring", time: "Clip time", avatar: "Profile picture", name: "Name", handle: "Handle", title: "Title", links: "Links" };
  const tile = elementTiles(names).find((item) => item.id === "audio:ring");
  assert.ok(tile && tile.name === "Sound ring");
  assert.deepEqual(tile.part, { kind: "visual", look: "ring" });
  const [layer] = tile.make("portrait", (kind) => `${kind}-1`);
  assert.equal(layer.visual, "ring");
  assert.ok(Math.abs(layer.w * 1080 - layer.h * 1350) < 1e-6, "square on the frame");
});

test("a sound layer going between a ring and a strip stays in its slot, so it never grows over the words around it", async () => {
  const { restyleSound } = await import("../dist/elements.js");
  const px = (layer) => ({ x: layer.x * 1080, y: layer.y * 1080, w: layer.w * 1080, h: layer.h * 1080 });
  const near = (a, b, what) => assert.ok(Object.keys(b).every((key) => Math.abs(a[key] - b[key]) < 1e-6), `${what}: ${JSON.stringify(a)}`);
  // A thin strip, 840 by 40, beside the words of a template.
  const strip = { id: "v", kind: "visual", x: 120 / 1080, y: 580 / 1080, w: 840 / 1080, h: 40 / 1080, rotation: 0, opacity: 1 };
  assert.equal(restyleSound(strip, "bars", "wave"), strip, "bars to a wave keeps the box");
  assert.equal(restyleSound(strip, "bars", "ring"), strip, "a strip keeps its box as a ring; the ring is drawn as a row of dots in it");
  // A ring of 300 round a clock in its middle becomes a strip along its foot, clear of the clock.
  const ringed = { ...strip, x: 390 / 1080, y: 450 / 1080, w: 300 / 1080, h: 300 / 1080 };
  near(px(restyleSound(ringed, "ring", "pulse")), { x: 390, y: 690, w: 300, h: 60 }, "a ring's strip: as wide, a fifth as tall, at its foot");
});

test("a ring in a box much wider than it is tall is drawn as a row of dots lighting up left to right", () => {
  const row = { ...ring, x: 0.1, y: 0.5, w: 0.8, h: 0.04 };
  const log = [];
  new Painter(scene({ layers: [row] })).paint(recorder({ width: 1080, height: 1080 }, log, true), 15);
  const dots = log.filter((call) => call.op === "arc").map((call) => ({ x: call.args[0], y: call.args[1], radius: call.args[2], alpha: call.alpha }));
  assert.ok(dots.length >= 12, `enough dots to read as a row: ${dots.length}`);
  assert.ok(dots.every((dot) => Math.abs(dot.y - dots[0].y) < 1e-6), "all on one line");
  assert.ok(dots.every((dot, i) => i === 0 || dot.x > dots[i - 1].x), "left to right");
  // The painter may move its origin first, so the row is measured against itself: it spans no more than the box.
  const span = Math.max(...dots.map((dot) => dot.x + dot.radius)) - Math.min(...dots.map((dot) => dot.x - dot.radius));
  assert.ok(span <= 864 + 1e-6 && span > 864 * 0.9, `spans the box: ${span}`);
  const lit = dots.filter((dot) => dot.alpha >= 0.7).length;
  assert.equal(lit, Math.floor(dots.length / 4), "a quarter of the way through, a quarter of the dots");
});

test("painters handed one store of scratch canvases reuse them, so a redraw for every drag move makes none", (t) => {
  t.after(() => delete globalThis.OffscreenCanvas);
  const log = [];
  const made = offscreen(log, true);
  const store = new Map();
  for (let i = 0; i < 3; i++) {
    const painter = new Painter(scene({ layers: [photo, card] }));
    painter.scratches = store;
    painter.paint(recorder({ width: 1080, height: 1080 }, log, true), 1);
  }
  const first = new Painter(scene({ layers: [photo, card] }));
  first.scratches = new Map();
  const before = made.length;
  first.paint(recorder({ width: 1080, height: 1080 }, log, true), 1);
  assert.ok(made.length > before, "a painter with a store of its own makes its canvases");
  assert.ok(before <= 3, `three painters sharing a store made only the first one's canvases: ${before}`);
});
