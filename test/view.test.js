import { test } from "node:test";
import assert from "node:assert/strict";
import { initialView, outlineBars, panView, showSpan, zoomView } from "../dist/view.js";
import { joinParts } from "../dist/parts.js";

const near = (actual, expected) => assert.ok(actual.every((value, i) => Math.abs(value - expected[i]) < 1e-6), `${actual} ≉ ${expected}`);

test("a short recording opens whole, a long one at five minutes around the selection", () => {
  near(initialView(120, [0, 30]), [0, 120]);
  near(initialView(3600, [1800, 1830]), [1665, 1965]);
  near(initialView(3600, [0, 30]), [0, 300]);
  near(initialView(3600, [3590, 3600]), [3300, 3600]);
});

test("zooming keeps the point under the pointer still, inside the recording and no closer than ten seconds", () => {
  near(zoomView([0, 100], 100, 0.5, 50), [25, 75]);
  near(zoomView([0, 100], 100, 0.5, 0), [0, 50]);
  near(zoomView([20, 70], 100, 4, 45), [0, 100]);
  near(zoomView([40, 60], 100, 0.1, 50), [45, 55]);
  near(zoomView([0, 50], 100, 1.5, 50), [0, 75]);
});

test("panning moves the view along and stops at either end", () => {
  near(panView([0, 50], 100, 30), [30, 80]);
  near(panView([0, 50], 100, 80), [50, 100]);
  near(panView([20, 70], 100, -40), [0, 50]);
});

test("the view moves the least it can to show a stretch, and widens when the stretch is longer than it", () => {
  near(showSpan([0, 50], 100, [10, 20]), [0, 50]);
  near(showSpan([0, 50], 100, [70, 80]), [35, 85]);
  near(showSpan([50, 100], 100, [10, 20]), [5, 55]);
  near(showSpan([0, 20], 100, [30, 60]), [24, 66]);
});

test("the outline is drawn as the lowest and highest point under each bar", () => {
  // Two pairs a second over four seconds.
  const outline = Float32Array.from([-0.1, 0.1, -0.5, 0.2, 0, 0, -0.2, 0.9, -0.3, 0.3, -0.1, 0.1, -0.4, 0.4, -0.6, 0.6]);
  near(outlineBars(outline, 2, [0, 4], 4), [-0.5, 0.2, -0.2, 0.9, -0.3, 0.3, -0.6, 0.6]);
  near(outlineBars(outline, 2, [2, 4], 2), [-0.3, 0.3, -0.6, 0.6]);
  // Past the end of what has been read, the bars are flat.
  near(outlineBars(outline, 2, [3, 5], 2), [-0.6, 0.6, 0, 0]);
});

test("pieces of sound join end to end, fading at every join and nowhere else", () => {
  const ones = (length) => new Float32Array(length).fill(1);
  const out = joinParts([ones(200), ones(100)], 100, 0.1);
  assert.equal(out.length, 300);
  assert.equal(out[0], 1);
  assert.ok(out[199] < 0.2 && out[200] < 0.2);
  assert.equal(out[299], 1);
  assert.deepEqual([...joinParts([ones(3)], 100, 0.1)], [1, 1, 1]);
});
