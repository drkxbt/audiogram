import { test } from "node:test";
import assert from "node:assert/strict";
import { backgroundOf, isBackgroundLayer, motionAt, pageCovers, showCaptions, stacked, widthAnchored } from "../dist/layers.js";
import { documentColours, hexToHsv, hsvToHex, parseHex } from "../dist/colour.js";

const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);
const box = (id, extra = {}) => ({ id, kind: "shape", x: 0.1, y: 0.1, w: 0.2, h: 0.2, rotation: 0, opacity: 1, ...extra });

test("a background stays under everything, whatever is added or moved above it", () => {
  const back = box("bg", { kind: "image", backdrop: true, x: 0, y: 0, w: 1, h: 1 });
  const ordered = [back, box("a"), box("b")];
  assert.equal(stacked(ordered), ordered, "already in order comes back as it is");
  assert.deepEqual(stacked([box("a"), back, box("b")]).map((layer) => layer.id), ["bg", "a", "b"]);
  assert.ok(isBackgroundLayer(back));
  assert.equal(backgroundOf(ordered), back);
  // A full-page picture from before backgrounds were marked still counts, at the bottom only.
  const old = box("old", { kind: "image", x: 0, y: 0, w: 1, h: 1 });
  assert.equal(backgroundOf([old, box("a")]), old);
  assert.equal(backgroundOf([box("a"), old]), null);
});

test("a panel covering most of the page is told apart from smaller shapes", () => {
  assert.ok(pageCovers(box("card", { x: 0.03, y: 0.03, w: 0.94, h: 0.94 })));
  assert.ok(!pageCovers(box("small")));
  assert.ok(!pageCovers(box("faint", { x: 0, y: 0, w: 1, h: 1, opacity: 0.4 })));
  assert.ok(!pageCovers(box("line", { shape: "line", x: 0, y: 0, w: 1, h: 1 })));
});

test("hidden captions come back on top; showing captions does nothing when some already show", () => {
  const captions = box("c", { kind: "captions", hidden: true });
  const shown = showCaptions([captions, box("a"), box("b")]);
  assert.deepEqual(shown.map((layer) => layer.id), ["a", "b", "c"]);
  assert.equal(shown[2].hidden, false);
  assert.equal(showCaptions([{ ...captions, hidden: false }, box("a")]), null);
  assert.equal(showCaptions([box("a")]), null);
});

test("a box that hugs its words keeps the edge they line up on", () => {
  const left = box("t", { kind: "text", align: "left", x: 0.2, w: 0.4 });
  near(widthAnchored(left, 0.2, 1000, 1000).x, 0.2);
  const centre = { ...left, align: "center" };
  const narrowed = widthAnchored(centre, 0.2, 1000, 1000);
  near(narrowed.x + narrowed.w / 2, 0.4);
  const right = { ...left, align: "right" };
  const pulled = widthAnchored(right, 0.2, 1000, 1000);
  near(pulled.x + pulled.w, 0.6);
  // Turned a quarter, the left edge is the top one; it stays where it was on screen.
  const turned = widthAnchored({ ...left, rotation: 90 }, 0.2, 1000, 1000);
  near(turned.x + turned.w / 2, 0.4);
  near(turned.y + turned.h / 2, 0.2 - 0.1);
});

test("a layer rising in moves the way it was told to, and leaves carrying on that way", () => {
  const up = motionAt({ enter: "rise" }, 0, true, 10);
  assert.ok(up.dy > 0, "starts below");
  const left = motionAt({ enter: "rise", direction: "left" }, 0, true, 10);
  assert.ok(left.dx > 0 && left.dy === 0, "starts to the right, to move left");
  const leaving = motionAt({ exit: "rise" }, 9.9, true, 10);
  assert.ok(leaving.dy < 0, "rose in, so goes up and out");
});

test("a whole-clip layer still plays its way out, and a chart grows in", () => {
  const out = motionAt({ exit: "fade" }, 9.95, true, 10);
  assert.ok(out.alpha < 0.5, `${out.alpha}`);
  near(motionAt({ enter: "grow" }, 0, true, 10).growth, 0);
  near(motionAt({ enter: "grow" }, 5, true, 10).growth, 1);
  near(motionAt({ enter: "grow" }, 0, false, 10).growth, 1);
});

test("words move one at a time on a layer that has them, and whole on one that doesn't", () => {
  const worded = motionAt({ kind: "text", enter: "ascend" }, 0.3, true, 10);
  assert.equal(worded.units.way, "ascend");
  assert.equal(worded.alpha, 1, "each word fades on its own");
  const whole = motionAt({ kind: "shape", enter: "ascend" }, 0.3, true, 10);
  assert.equal(whole.units, null);
  assert.ok(whole.alpha < 1 && whole.dy > 0);
});

test("loops repeat, and a shimmer crosses at the start of each turn", () => {
  const a = motionAt({ loop: "heartbeat" }, 0.14, true, 10);
  const b = motionAt({ loop: "heartbeat" }, 0.14 + 1.4, true, 10);
  near(a.scale, b.scale);
  assert.ok(a.scale > 1.05);
  assert.ok(motionAt({ loop: "shimmer" }, 0.5, true, 10).shine > 0);
  assert.equal(motionAt({ loop: "shimmer" }, 2, true, 10).shine, null);
});

test("hex colours are read however they are typed, and survive a trip through hue, saturation and value", () => {
  assert.equal(parseHex("FF3131"), "#ff3131");
  assert.equal(parseHex("#abc"), "#aabbcc");
  assert.equal(parseHex("red"), null);
  assert.equal(parseHex("#12345"), null);
  for (const hex of ["#000000", "#ffffff", "#ff3131", "#5e17eb", "#00bf63", "#d4af37"]) {
    const { h, s, v } = hexToHsv(hex);
    assert.equal(hsvToHex(h, s, v), hex);
  }
});

test("a design's own colours come first, most used first, once each, without theme names or metals", () => {
  assert.deepEqual(documentColours(["#111111", "accent", "#FFFFFF", "#111111", "metal:gold", undefined, "#abc"]), ["#111111", "#ffffff", "#aabbcc"]);
});
