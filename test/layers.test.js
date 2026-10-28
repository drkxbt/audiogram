import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultLayers, layerAt, moveLayer, resizeLayer, resizeTurned, rotateLayer, snapMove } from "../dist/layers.js";

const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);

test("every shape starts with the classic layout as layers: the name above the visual, the captions under it", () => {
  for (const layout of ["square", "portrait", "story", "landscape"]) {
    const layers = defaultLayers(layout);
    const kinds = layers.map((layer) => layer.kind);
    for (const kind of ["avatar", "name", "handle", "title", "visual", "time", "captions", "links"]) assert.ok(kinds.includes(kind), `${layout} has ${kind}`);
    const of = (kind) => layers.find((layer) => layer.kind === kind);
    for (const layer of layers) {
      assert.ok(layer.x >= 0 && layer.y >= 0 && layer.x + layer.w <= 1 + 1e-9 && layer.y + layer.h <= 1 + 1e-9, `${layout} ${layer.kind} inside the frame`);
      assert.equal(new Set(layers.map((item) => item.id)).size, layers.length);
    }
    if (layout !== "landscape") {
      assert.ok(of("avatar").y < of("visual").y && of("visual").y < of("captions").y, `${layout} stacks down`);
      assert.ok(of("captions").y + of("captions").h <= of("links").y + 1e-9, `${layout} captions above the links`);
    }
  }
});

test("a press finds the topmost layer under it, turned or not, and skips hidden and locked ones", () => {
  const layers = [
    { id: "a", kind: "shape", x: 0.1, y: 0.1, w: 0.5, h: 0.5, rotation: 0, opacity: 1 },
    { id: "b", kind: "shape", x: 0.3, y: 0.3, w: 0.2, h: 0.2, rotation: 0, opacity: 1 },
    { id: "c", kind: "shape", x: 0.6, y: 0.1, w: 0.3, h: 0.04, rotation: 90, opacity: 1 },
  ];
  assert.equal(layerAt(layers, 0.35, 0.35, 1, 1)?.id, "b");
  assert.equal(layerAt(layers, 0.15, 0.15, 1, 1)?.id, "a");
  assert.equal(layerAt(layers, 0.9, 0.9, 1, 1), null);
  // Turned a quarter, the thin bar stands upright about its centre at (0.75, 0.12).
  assert.equal(layerAt(layers, 0.75, 0.24, 1, 1)?.id, "c");
  assert.equal(layerAt(layers, 0.62, 0.12, 1, 1), null);
  assert.equal(layerAt([{ ...layers[1], hidden: true }, layers[0]].reverse(), 0.35, 0.35, 1, 1)?.id, "a");
  assert.equal(layerAt([layers[0], { ...layers[1], locked: true }], 0.35, 0.35, 1, 1)?.id, "a");
});

test("a moved layer snaps to the frame's centre and edges, and to other layers, within a few pixels", () => {
  const box = { x: 0.398, y: 0.2, w: 0.2, h: 0.1 };
  // Its centre lands 0.002 off the frame's centre: 2 px at 1000 px wide, inside the 6 px reach.
  const snapped = snapMove(box, [], 1000, 1000, 6);
  near(snapped.x, 0.4);
  assert.ok(snapped.guides.some((guide) => guide.axis === "x" && Math.abs(guide.at - 0.5) < 1e-9));
  const other = { x: 0.1, y: 0.5, w: 0.3, h: 0.1 };
  const edge = snapMove({ x: 0.5, y: 0.603, w: 0.2, h: 0.1 }, [other], 1000, 1000, 6);
  near(edge.y, 0.6);
  // Far from anything, it stays where it was put.
  const free = snapMove({ x: 0.13, y: 0.27, w: 0.1, h: 0.1 }, [], 1000, 1000, 6);
  near(free.x, 0.13);
  near(free.y, 0.27);
  assert.equal(free.guides.length, 0);
});

test("moving keeps a layer inside reach of the frame, and resizing from a corner keeps the far corner still", () => {
  const layer = { id: "t", kind: "text", x: 0.2, y: 0.2, w: 0.4, h: 0.1, rotation: 0, opacity: 1 };
  const moved = moveLayer(layer, 2, -2);
  assert.ok(moved.x < 1 && moved.x + moved.w > 0 && moved.y < 1 && moved.y + moved.h > 0, "some of it stays on the frame");
  const grown = resizeLayer(layer, "se", 0.1, 0.05, false);
  near(grown.x, 0.2);
  near(grown.y, 0.2);
  near(grown.w, 0.5);
  near(grown.h, 0.15);
  const fromTopLeft = resizeLayer(layer, "nw", 0.1, 0.02, false);
  near(fromTopLeft.x + fromTopLeft.w, 0.6);
  near(fromTopLeft.y + fromTopLeft.h, 0.3);
  // Keeping the shape, the box grows by the larger pull and stays in proportion.
  const square = { ...layer, w: 0.2, h: 0.2 };
  const kept = resizeLayer(square, "se", 0.1, 0.02, true);
  near(kept.w / kept.h, 1);
  // It never turns inside out.
  const tiny = resizeLayer(layer, "se", -1, -1, false);
  assert.ok(tiny.w > 0 && tiny.h > 0);
});

test("turning follows the pointer about the layer's centre, and with Shift it steps by 15 degrees", () => {
  const layer = { id: "t", kind: "text", x: 0.4, y: 0.4, w: 0.2, h: 0.2, rotation: 0, opacity: 1 };
  near(rotateLayer(layer, 0.7, 0.5, 1, 1, false).rotation, 90);
  near(rotateLayer(layer, 0.5, 0.2, 1, 1, false).rotation, 0);
  near(rotateLayer(layer, 0.62, 0.3, 1, 1, true).rotation % 15, 0);
});

test("a turned layer resizes along its own sides, and its far side stays put on screen", () => {
  // 200 by 100 px on a 1000 px frame, centred at (500, 450), turned a quarter clockwise: its east side now faces down.
  const layer = { id: "t", kind: "text", x: 0.4, y: 0.4, w: 0.2, h: 0.1, rotation: 90, opacity: 1 };
  const grown = resizeTurned(layer, "e", 0, 50, false, 1000, 1000);
  near(grown.w, 0.25);
  near(grown.h, 0.1);
  // Its west side's middle was at (500, 350) on screen, and still is.
  const west = (box) => ({ x: (box.x + box.w / 2) * 1000, y: (box.y + box.h / 2) * 1000 - (box.w * 1000) / 2 });
  near(west(grown).x, 500);
  near(west(grown).y, 350);
  // Unturned, it is plain resizing.
  const flat = resizeTurned({ ...layer, rotation: 0 }, "se", 100, 50, false, 1000, 1000);
  near(flat.x, 0.4);
  near(flat.w, 0.3);
  near(flat.h, 0.15);
});

test("turning settles on upright and on each quarter turn when it comes within a few degrees, Shift or not", () => {
  const layer = { id: "t", kind: "text", x: 0.4, y: 0.4, w: 0.2, h: 0.2, rotation: 0, opacity: 1 };
  const towards = (degrees) => {
    const angle = (degrees * Math.PI) / 180;
    return [0.5 + Math.sin(angle) * 0.3, 0.5 - Math.cos(angle) * 0.3];
  };
  near(rotateLayer(layer, ...towards(3), 1, 1, false).rotation, 0);
  near(rotateLayer(layer, ...towards(357), 1, 1, false).rotation, 0);
  near(rotateLayer(layer, ...towards(87), 1, 1, false).rotation, 90);
  near(rotateLayer(layer, ...towards(30), 1, 1, false).rotation, 30, 1e-6);
});

test("pulling one side leaves the other dimension alone, so a thin line stays thin", () => {
  const line = { id: "l", kind: "shape", x: 0.2, y: 0.5, w: 0.4, h: 0.005, rotation: 0, opacity: 1 };
  const longer = resizeLayer(line, "e", 0.1, 0, false);
  near(longer.w, 0.5);
  near(longer.h, 0.005);
});
