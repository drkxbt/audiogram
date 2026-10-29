import { test } from "node:test";
import assert from "node:assert/strict";
import { drawingLayer, matchDrawings } from "../dist/elements.js";
import { FRAME_SIZES } from "../dist/layers.js";

const art = { w: 24, h: 24, paths: [{ d: "M0 0h24v24z", fill: "currentColor" }] };
const drawings = [
  { id: "thumbs-up", name: "Thumbs up", art, tags: ["approve", "like"] },
  { id: "github", name: "GitHub", art, color: "#181717" },
  { id: "red-heart", name: "Red heart", art, tags: ["love"] },
  { id: "skoda", name: "Škoda", art },
  { id: "x", name: "X", art, color: "#000000", tags: ["twitter"] },
];
const ids = (found) => found.map((drawing) => drawing.id);

test("an empty search gives the set back as it is", () => {
  assert.equal(matchDrawings(drawings, ""), drawings);
  assert.equal(matchDrawings(drawings, "   "), drawings);
});

test("a search finds drawings by the start of a word in the name, a tag or the id, in the set's order", () => {
  assert.deepEqual(ids(matchDrawings(drawings, "up")), ["thumbs-up"]);
  assert.deepEqual(ids(matchDrawings(drawings, "humbs")), [], "the middle of a word is not enough");
  assert.deepEqual(ids(matchDrawings(drawings, "appr")), ["thumbs-up"], "a tag");
  assert.deepEqual(ids(matchDrawings(drawings, "twit")), ["x"], "a tag");
  assert.deepEqual(ids(matchDrawings(drawings, "red-h")), ["red-heart"], "the id");
  assert.deepEqual(ids(matchDrawings(drawings, "GIT")), ["github"], "any case");
  assert.deepEqual(ids(matchDrawings(drawings, "šk")), ["skoda"], "a name in its own spelling");
  assert.deepEqual(ids(matchDrawings(drawings, "l")), ["thumbs-up", "red-heart"], "every match, in order");
});

test("every word typed has to match", () => {
  assert.deepEqual(ids(matchDrawings(drawings, "red heart")), ["red-heart"]);
  assert.deepEqual(ids(matchDrawings(drawings, "heart love")), ["red-heart"]);
  assert.deepEqual(ids(matchDrawings(drawings, "red star")), []);
});

test("a drawing goes on the page as a graphic in the middle, its shape kept, a sixth of the shorter side across", () => {
  const square = drawingLayer(drawings[1], "square", "graphic-1");
  assert.equal(square.kind, "graphic");
  assert.equal(square.id, "graphic-1");
  assert.equal(square.art, art);
  assert.equal(square.color, "#181717", "a brand keeps its colour");
  assert.ok(Math.abs(square.w - 0.16) < 1e-9 && Math.abs(square.h - 0.16) < 1e-9, `${square.w} ${square.h}`);
  assert.ok(Math.abs(square.x + square.w / 2 - 0.5) < 1e-9 && Math.abs(square.y + square.h / 2 - 0.5) < 1e-9);
  const wide = drawingLayer({ id: "bar", name: "Bar", art: { w: 48, h: 24, paths: art.paths } }, "story", "graphic-2");
  const { width, height } = FRAME_SIZES.story;
  assert.ok(Math.abs((wide.w * width) / (wide.h * height) - 2) < 1e-9, "twice as wide as tall on the page");
  assert.ok(Math.abs(wide.w * width - 0.16 * width) < 1e-9, "its longer side a sixth of the shorter side");
  assert.ok(Math.abs(wide.x + wide.w / 2 - 0.5) < 1e-9 && Math.abs(wide.y + wide.h / 2 - 0.5) < 1e-9);
  const tall = drawingLayer({ id: "pole", name: "Pole", art: { w: 12, h: 48, paths: art.paths } }, "landscape", "graphic-3");
  assert.ok(Math.abs(tall.h * FRAME_SIZES.landscape.height - 0.16 * 1080) < 1e-9, "a tall one's height is the longer side");
  assert.equal(wide.color, "accent", "without a colour of its own it takes the accent");
});
