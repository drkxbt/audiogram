import { test } from "node:test";
import assert from "node:assert/strict";
import { elementTiles, searchTiles, SECTIONS } from "../dist/elements.js";
import { FRAME_SIZES } from "../dist/layers.js";
import { blobArt, confettiArt, halftoneCircleArt, pixelFrameArt, starburstArt } from "../dist/decor.js";

const parts = { captions: "Captions", bars: "Sound bars", wave: "Sound wave", pulse: "Pulse", ring: "Sound ring", time: "Clip time", avatar: "Profile picture", name: "Name", handle: "Handle", title: "Title", links: "Links" };
const tiles = elementTiles(parts);
const decor = tiles.filter((tile) => tile.section === "decor");
const newId = (kind) => `${kind}-1`;

// The rules a saved design's drawing is held to by a host's kit (Soundbite's parseKit), so decor survives a save.
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;
const MOST_PATHS = 64;
const MOST_PATH = 20_000;
const MOST_DATA = 60_000;

test("decor is a section of its own, right after the shapes", () => {
  assert.ok(SECTIONS.includes("decor"));
  assert.equal(SECTIONS.indexOf("decor"), SECTIONS.indexOf("shapes") + 1);
  for (const tile of tiles) assert.ok(SECTIONS.includes(tile.section), tile.id);
});

test("there are several looks of each kind, every tile with a name, search words and an id of its own", () => {
  assert.ok(decor.length >= 20, String(decor.length));
  for (const kind of ["blob", "squiggle", "starburst", "pixel-frame", "halftone"]) assert.ok(decor.filter((tile) => tile.id.startsWith(`decor:${kind}`)).length >= 2, kind);
  const ids = tiles.map((tile) => tile.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  for (const tile of decor) {
    assert.match(tile.id, /^decor:[a-z0-9-]+$/);
    assert.ok(tile.name.trim(), tile.id);
    assert.ok(tile.tags.trim(), tile.id);
  }
});

test("every decor tile adds one graphic in the layer's colour, its drawing within what a saved design may hold", () => {
  for (const tile of decor) {
    const layers = tile.make("square", newId);
    assert.equal(layers.length, 1, tile.id);
    const [layer] = layers;
    assert.equal(layer.kind, "graphic", tile.id);
    assert.equal(layer.color, "accent", tile.id);
    const { art } = layer;
    assert.ok(art.w > 0 && art.w <= 4096 && art.h > 0 && art.h <= 4096, `${tile.id} ${art.w}x${art.h}`);
    assert.equal(Math.max(art.w, art.h), 1000, `${tile.id} is drawn in a 1000-unit box`);
    assert.ok(art.paths.length >= 1 && art.paths.length <= MOST_PATHS, tile.id);
    let total = 0;
    for (const path of art.paths) {
      assert.ok(path.d.length <= MOST_PATH, `${tile.id}: ${path.d.length} characters`);
      assert.match(path.d, PATH, tile.id);
      assert.match(path.d, /^[Mm]/, tile.id);
      assert.doesNotMatch(path.d, /\d\.\d\d/, `${tile.id}: numbers are to a tenth`);
      assert.doesNotMatch(path.d, /NaN|Infinity/, tile.id);
      assert.ok(path.fill === "currentColor" || path.stroke === "currentColor", `${tile.id} takes the layer's colour`);
      if (path.fill) assert.equal(path.fill, "currentColor", tile.id);
      if (path.stroke) {
        assert.equal(path.stroke, "currentColor", tile.id);
        assert.ok(path.width > 0 && path.width <= 100, `${tile.id} stroke ${path.width}`);
      }
      if (path.rule !== undefined) assert.equal(path.rule, "evenodd", tile.id);
      total += path.d.length;
    }
    assert.ok(total <= MOST_DATA, `${tile.id}: ${total} characters in all`);
  }
});

test("a decor tile always adds the same drawing, drawn afresh each time", () => {
  for (const tile of decor) {
    const first = tile.make("square", newId)[0];
    const again = tile.make("square", newId)[0];
    assert.deepEqual(again, first, tile.id);
    assert.notEqual(again.art, first.art, `${tile.id}: no two layers share one drawing`);
  }
  assert.deepEqual(blobArt(3, 7, 0.2), blobArt(3, 7, 0.2));
  assert.notDeepEqual(blobArt(3, 7, 0.2), blobArt(4, 7, 0.2), "another seed, another blob");
  assert.deepEqual(confettiArt(5), confettiArt(5));
  assert.notDeepEqual(confettiArt(5), confettiArt(6));
});

test("decor sits in the middle of every frame, inside it, its drawing's shape kept", () => {
  for (const layout of Object.keys(FRAME_SIZES)) {
    const { width, height } = FRAME_SIZES[layout];
    for (const tile of decor) {
      const layer = tile.make(layout, newId)[0];
      const label = `${tile.id} on ${layout}`;
      assert.ok(layer.x >= 0 && layer.y >= 0 && layer.x + layer.w <= 1 + 1e-9 && layer.y + layer.h <= 1 + 1e-9, label);
      assert.ok(Math.abs(layer.x + layer.w / 2 - 0.5) < 1e-9 && Math.abs(layer.y + layer.h / 2 - 0.5) < 1e-9, label);
      assert.ok(Math.abs((layer.w * width) / (layer.h * height) - layer.art.w / layer.art.h) < 1e-9, label);
    }
  }
});

test("a drawing's numbers stay inside its box", () => {
  for (const tile of decor) {
    const { art } = tile.make("square", newId)[0];
    // Absolute moves and line ends only: relative steps and curve handles are checked by what they draw, above.
    for (const path of art.paths) {
      for (const [, x, y] of path.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) {
        assert.ok(+x >= 0 && +x <= art.w && +y >= 0 && +y <= art.h, `${tile.id}: ${x} ${y} outside ${art.w}x${art.h}`);
      }
    }
  }
});

test("the generators draw what they say", () => {
  const burst = starburstArt(12, 0.7);
  assert.equal((burst.paths[0].d.match(/L/g) ?? []).length, 23, "a 12-point burst has 24 corners");
  const frame = pixelFrameArt(20, 20, 3);
  assert.deepEqual([frame.w, frame.h], [1000, 1000]);
  assert.doesNotMatch(frame.paths[0].d, /\.\d/, "pixels sit on whole units");
  const wide = pixelFrameArt(25, 14, 3);
  assert.deepEqual([wide.w, wide.h], [1000, 560]);
  const dots = halftoneCircleArt();
  assert.ok((dots.paths.map((path) => path.d).join("").match(/M/g) ?? []).length > 100, "a field of dots");
});

test("decor is found by its name, its words and its section", () => {
  const ids = (query) => searchTiles(tiles, query).map((tile) => tile.id);
  assert.ok(ids("halftone").includes("decor:halftone-circle"));
  assert.ok(ids("pixel").includes("decor:pixel-frame"));
  assert.ok(ids("8 bit").includes("decor:pixel-corner"));
  assert.ok(ids("squig").includes("decor:squiggle-long") && ids("squig").includes("decor:squiggle-short"));
  assert.ok(ids("starburst").includes("decor:seal-24"));
  assert.equal(ids("decor").length, decor.length);
});
