import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, templateOf } from "../dist/templates.js";
import { defaultLayers } from "../dist/layers.js";

test("the blank template is an empty white page", () => {
  for (const layout of ["square", "portrait", "story", "landscape"]) {
    const blank = templateOf("blank", layout);
    assert.deepEqual(blank.layers, []);
    assert.deepEqual(blank.page, { color: "#ffffff" });
  }
});

test("the card template is the classic layout on the theme's own colours", () => {
  const card = templateOf("card", "story");
  assert.deepEqual(card.layers, defaultLayers("story"));
  assert.equal(card.page, null);
});

test("every template keeps its layers inside the frame, each with an id of its own", () => {
  for (const { id } of TEMPLATES) {
    for (const layout of ["square", "portrait", "story", "landscape"]) {
      const { layers } = templateOf(id, layout);
      assert.equal(new Set(layers.map((layer) => layer.id)).size, layers.length, `${id} ${layout} ids`);
      for (const layer of layers) {
        assert.ok(layer.x >= 0 && layer.y >= 0 && layer.x + layer.w <= 1 + 1e-9 && layer.y + layer.h <= 1 + 1e-9, `${id} ${layout} ${layer.id}`);
      }
    }
  }
});

test("the big captions template puts the words first, with the sound under them", () => {
  const { layers, page } = templateOf("captions", "portrait");
  const captions = layers.find((layer) => layer.kind === "captions");
  const visual = layers.find((layer) => layer.kind === "visual");
  assert.ok(captions && visual);
  assert.ok(captions.size >= 80, "big words");
  assert.ok(visual.y > captions.y, "the sound sits under the words");
  assert.ok(page && page.color);
});
