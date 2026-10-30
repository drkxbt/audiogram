import { test } from "node:test";
import assert from "node:assert/strict";
import { templatePreview, THEMES } from "../dist/render.js";

const userScene = {
  layout: "square", visual: "bars", theme: THEMES[0], font: "Geist",
  title: "Small Bets", speaker: "Zoe", handle: "@zoe", links: ["zoe.fm"],
  cover: { width: 480, height: 480 }, logo: { width: 64, height: 64 }, backdrop: { width: 1080, height: 1080 },
  captions: [{ start: 0, end: 2, text: "Hi there" }],
  images: new Map([["upload-1", { width: 800, height: 600 }]]),
  overlay: () => {},
  audio: { samples: new Float32Array(48000), sampleRate: 48000, start: 0, end: 1 },
};

test("a design's preview is the design as it comes: none of the user's picture, words, uploads or captions", () => {
  const made = { layers: [{ id: "a", kind: "avatar" }], page: { color: "#1b2150" }, theme: 2 };
  const preview = templatePreview(userScene, made, [["photo:sky", { width: 320, height: 200 }]]);
  assert.equal(preview.cover, null);
  assert.equal(preview.logo, null);
  assert.equal(preview.backdrop, null);
  assert.equal(preview.overlay, undefined);
  assert.equal(preview.title, "");
  assert.equal(preview.speaker, "");
  assert.equal(preview.handle, "");
  assert.deepEqual(preview.links, []);
  assert.deepEqual(preview.captions, []);
  assert.deepEqual([...preview.images.keys()], ["photo:sky"]);
  assert.equal(preview.layers, made.layers);
  assert.deepEqual(preview.page, made.page);
  assert.equal(preview.theme, THEMES[2]);
});

test("a design without a theme of its own keeps the one the editor shows", () => {
  const preview = templatePreview(userScene, { layers: [], page: null }, []);
  assert.equal(preview.theme, userScene.theme);
});
