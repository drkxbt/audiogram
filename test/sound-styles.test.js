import { test } from "node:test";
import assert from "node:assert/strict";
import { Painter, THEMES, VISUALS } from "../dist/render.js";
import { elementTiles, restyleSound, soundPart } from "../dist/elements.js";
import { ICONS } from "../dist/ui.js";

const NEW = ["radial", "mirror", "line", "dots", "blocks", "scope"];

// A 2D context that follows its transform and measures what each fill or stroke covers on the canvas: the bounds of the
// path's points (with half the line's width for a stroke), and an amount of ink, its bounding area times its alpha.
function measurer(width, height) {
  const values = { globalAlpha: 1, lineWidth: 1, fillStyle: "#000000", strokeStyle: "#000000" };
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let path = [];
  const marks = [];
  const at = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const scale = () => Math.hypot(m[0], m[1]);
  const point = (x, y, r = 0) => path.push([...at(x, y), r * scale()]);
  const mark = (pad) => {
    if (!path.length) return;
    const left = Math.min(...path.map(([x, , r]) => x - r)) - pad;
    const right = Math.max(...path.map(([x, , r]) => x + r)) + pad;
    const top = Math.min(...path.map(([, y, r]) => y - r)) - pad;
    const bottom = Math.max(...path.map(([, y, r]) => y + r)) + pad;
    marks.push({ left, right, top, bottom, ink: (right - left) * (bottom - top) * values.globalAlpha });
  };
  const rect = (x, y, w, h) => {
    point(x, y);
    point(x + w, y + h);
  };
  const ops = {
    save: () => stack.push({ values: { ...values }, m: [...m] }),
    restore: () => {
      const top = stack.pop();
      Object.assign(values, top.values);
      m = top.m;
    },
    translate: (x, y) => (m = [m[0], m[1], m[2], m[3], m[4] + m[0] * x + m[2] * y, m[5] + m[1] * x + m[3] * y]),
    rotate: (t) => {
      const [a, b, c, d, e, f] = m;
      m = [a * Math.cos(t) + c * Math.sin(t), b * Math.cos(t) + d * Math.sin(t), -a * Math.sin(t) + c * Math.cos(t), -b * Math.sin(t) + d * Math.cos(t), e, f];
    },
    scale: (x, y) => (m = [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]]),
    setTransform: (...args) => (m = args),
    getTransform: () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }),
    beginPath: () => (path = []),
    moveTo: (x, y) => point(x, y),
    lineTo: (x, y) => point(x, y),
    arcTo: (x1, y1, x2, y2) => (point(x1, y1), point(x2, y2)),
    quadraticCurveTo: (cx, cy, x, y) => (point(cx, cy), point(x, y)),
    bezierCurveTo: (ax, ay, bx, by, x, y) => (point(ax, ay), point(bx, by), point(x, y)),
    arc: (x, y, r) => point(x, y, r),
    ellipse: (x, y, rx, ry) => point(x, y, Math.max(rx, ry)),
    rect,
    roundRect: rect,
    fill: () => mark(0),
    stroke: () => mark((values.lineWidth * scale()) / 2),
    fillRect: (x, y, w, h) => {
      path = [];
      rect(x, y, w, h);
      mark(0);
    },
    strokeRect: () => {},
    clip: () => {},
    measureText: (text) => ({ width: text.length * 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  };
  const canvas = { width, height };
  const ctx = new Proxy({}, {
    get: (_, key) => (key === "canvas" ? canvas : key in ops ? ops[key] : key in values ? values[key] : () => {}),
    set: (_, key, value) => ((values[key] = value), true),
    has: (_, key) => key in values || key in ops || key === "canvas",
  });
  return { ctx, marks };
}

const RATE = 16000;
// A voice-like sound: a low hum with its overtones, its loudness rising and falling a few times a second.
const voice = Float32Array.from({ length: RATE * 4 }, (_, i) => {
  const t = i / RATE;
  return (0.45 * Math.sin(2 * Math.PI * 160 * t) + 0.25 * Math.sin(2 * Math.PI * 480 * t) + 0.12 * Math.sin(2 * Math.PI * 1300 * t)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 6)));
});
const silence = new Float32Array(voice.length);

const STRIP = { x: 0.1, y: 0.45, w: 0.8, h: 0.1 };
const SQUARE = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };

/** What one sound layer paints at `time`, played up to it a frame at a time as the preview does. */
function paintStyle(visual, box, samples, time = 2) {
  const layer = { id: "v", kind: "visual", visual, color: "accent", rotation: 0, opacity: 1, ...box };
  const painter = new Painter({
    layout: "square", visual: "bars", theme: THEMES[0], title: "", speaker: "", handle: "", cover: null, captions: [],
    audio: { samples, sampleRate: RATE, start: 0, end: samples.length / RATE }, layers: [layer],
  });
  for (let t = time - 0.5; t < time; t += 1 / 30) painter.paint(measurer(1080, 1080).ctx, t);
  const { ctx, marks } = measurer(1080, 1080);
  painter.paint(ctx, time);
  // The first fill is the page behind every layer.
  return marks.slice(1);
}
const ink = (marks) => marks.reduce((sum, mark) => sum + mark.ink, 0);

test("every new sound style paints something for a loud voice, and less for silence, in a strip and a square", () => {
  for (const visual of NEW) {
    for (const [shape, box] of [["strip", STRIP], ["square", SQUARE]]) {
      const loud = ink(paintStyle(visual, box, voice));
      const quiet = ink(paintStyle(visual, box, silence));
      assert.ok(loud > 0, `${visual} in a ${shape} paints`);
      assert.ok(loud > quiet * 1.3, `${visual} in a ${shape}: ${Math.round(loud)} loud against ${Math.round(quiet)} quiet`);
    }
  }
});

test("every sound style stays inside its box, a strip, a thin strip or a square", () => {
  const thin = { x: 0.1, y: 0.5, w: 0.8, h: 0.03 };
  for (const visual of VISUALS.filter((look) => look !== "wave" && look !== "pulse")) {
    for (const [shape, box] of [["strip", STRIP], ["thin strip", thin], ["square", SQUARE]]) {
      for (const samples of [voice, silence]) {
        const marks = paintStyle(visual, box, samples);
        assert.ok(marks.length, `${visual} in a ${shape} paints`);
        const left = box.x * 1080 - 0.5;
        const top = box.y * 1080 - 0.5;
        const right = (box.x + box.w) * 1080 + 0.5;
        const bottom = (box.y + box.h) * 1080 + 0.5;
        for (const mark of marks) {
          assert.ok(mark.left >= left && mark.right <= right && mark.top >= top && mark.bottom <= bottom, `${visual} in a ${shape}: ${JSON.stringify(mark)} outside ${[left, top, right, bottom].join(", ")}`);
        }
      }
    }
  }
});

test("radial bars stand round a circle in a square and along a line in a strip", () => {
  const round = paintStyle("radial", SQUARE, voice);
  const span = (marks, key) => Math.max(...marks.map((mark) => mark[key === "x" ? "right" : "bottom"])) - Math.min(...marks.map((mark) => mark[key === "x" ? "left" : "top"]));
  // Low pitches at the top reach further than high ones at the foot, so the burst is round without being exact.
  assert.ok(span(round, "x") > 270 && span(round, "y") > 270, "spread round the middle of a square both ways");
  const strip = paintStyle("radial", STRIP, voice);
  assert.ok(span(strip, "x") > span(strip, "y") * 5, "laid along a strip");
});

test("a blocks column's cap stays at the peak a moment after the sound stops, then falls", () => {
  // Loud for a second, then silent.
  const burst = Float32Array.from(voice, (value, i) => (i < RATE ? value : 0));
  const layer = { id: "v", kind: "visual", visual: "blocks", color: "accent", rotation: 0, opacity: 1, ...SQUARE };
  const painter = new Painter({
    layout: "square", visual: "bars", theme: THEMES[0], title: "", speaker: "", handle: "", cover: null, captions: [],
    audio: { samples: burst, sampleRate: RATE, start: 0, end: 4 }, layers: [layer],
  });
  // The caps are the full-strength marks thinner than a block; their highest one, by its top on the canvas.
  const capTop = (time) => {
    const { ctx, marks } = measurer(1080, 1080);
    painter.paint(ctx, time);
    const blocks = marks.slice(1);
    const tallest = Math.max(...blocks.map((mark) => mark.bottom - mark.top));
    return Math.min(...blocks.filter((mark) => mark.bottom - mark.top < tallest * 0.6).map((mark) => mark.top));
  };
  let t = 0;
  for (; t < 1; t += 1 / 30) capTop(t);
  const peak = capTop(1);
  const held = capTop(1.2);
  let fallen = held;
  for (t = 1.2; t < 2.5; t += 1 / 30) fallen = capTop(t);
  assert.ok(Math.abs(held - peak) < 1, "held at the peak for a moment");
  assert.ok(fallen > held + 50, `then falls: ${held} to ${fallen}`);
});

test("the editor lists all ten sound styles, each with an icon and a tile in Elements", () => {
  assert.deepEqual(VISUALS, ["bars", "wave", "pulse", "ring", ...NEW]);
  for (const look of VISUALS) assert.ok(typeof ICONS[look] === "string" && ICONS[look].length > 20, `${look} has an icon`);
  const names = Object.fromEntries(["captions", ...VISUALS, "time", "avatar", "name", "handle", "title", "links"].map((key) => [key, key]));
  const tiles = elementTiles(names).filter((tile) => tile.part?.kind === "visual");
  assert.deepEqual(tiles.map((tile) => tile.part.look), VISUALS);
  assert.ok(tiles.find((tile) => tile.id === "audio:scope").tags.includes("oscilloscope"), "found by its own words too");
});

test("radial bars get a square of their own as the ring does, and go between round and strip as it does", () => {
  const strip = { id: "v", kind: "visual", x: 0.1, y: 0.5, w: 0.8, h: 0.1, rotation: 0, opacity: 1 };
  const placed = soundPart(strip, "radial", "portrait");
  assert.ok(Math.abs(placed.w * 1080 - placed.h * 1350) < 1e-6, "square on the frame");
  for (const look of NEW.filter((look) => look !== "radial")) assert.equal(soundPart(strip, look, "portrait"), strip, `${look} keeps the strip`);
  assert.equal(restyleSound(strip, "bars", "radial"), strip, "a strip keeps its box as radial bars");
  const round = { ...strip, y: 0.3, w: 0.3, h: 0.3 };
  assert.equal(restyleSound(round, "ring", "radial"), round, "round to round keeps the box");
  const flat = restyleSound(round, "radial", "scope");
  assert.ok(Math.abs(flat.h - 0.06) < 1e-9 && Math.abs(flat.y + flat.h - 0.6) < 1e-9, "radial to a strip lies along its foot");
});

test("the design's sound style restyles every sound layer but one kept to its own look", async () => {
  const { restyleAll } = await import("../dist/elements.js");
  const bars = { id: "visual-main", kind: "visual", x: 0.1, y: 0.8, w: 0.8, h: 0.1, rotation: 0, opacity: 1, visual: "bars" };
  const ring = { id: "visual-ring", kind: "visual", x: 0.1, y: 0.1, w: 0.3, h: 0.3, rotation: 0, opacity: 1, visual: "ring", keepLook: true };
  const words = { id: "text-a", kind: "text", x: 0, y: 0, w: 1, h: 0.1, rotation: 0, opacity: 1 };
  const [nextBars, nextRing, nextWords] = restyleAll([bars, ring, words], "bars", "wave");
  assert.equal(nextBars.visual, undefined, "the main sound follows the design's look");
  assert.equal(nextRing, ring, "a ring drawn round a clock stays a ring, in its own box");
  assert.equal(nextWords, words);
});
