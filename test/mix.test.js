import { test } from "node:test";
import assert from "node:assert/strict";
import { mixMusic } from "../dist/mix.js";

const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);
const rate = 100;

test("music plays under the voice at its level, looping when it is shorter than the clip", () => {
  const voice = new Float32Array(1000);
  const music = Float32Array.from({ length: 300 }, (_, i) => (i % 2 ? 0.5 : -0.5));
  const out = mixMusic(voice, music, rate, { gain: 0.2, fadeIn: 0, fadeOut: 0 });
  assert.equal(out.length, 1000);
  close(out[0], -0.1);
  close(out[1], 0.1);
  close(out[301], 0.1);
  close(out[999], 0.1);
});

test("the music fades in at the start and out at the end, and the voice stays as it was", () => {
  const voice = new Float32Array(1000).fill(0.1);
  const music = new Float32Array(1000).fill(0.5);
  const out = mixMusic(voice, music, rate, { gain: 0.4, fadeIn: 1, fadeOut: 1.5 });
  close(out[0], 0.1);
  close(out[50], 0.1 + 0.2 * 0.5, 0.01);
  close(out[500], 0.3);
  close(out[999], 0.1, 0.002);
});

test("a loud mix is brought down so it never clips", () => {
  const voice = new Float32Array(500).fill(0.9);
  const music = new Float32Array(500).fill(0.9);
  const out = mixMusic(voice, music, rate, { gain: 1, fadeIn: 0, fadeOut: 0 });
  assert.ok(Math.max(...out.map(Math.abs)) <= 0.98 + 1e-6);
});

test("no music leaves the voice untouched", () => {
  const voice = Float32Array.from([0.1, -0.2, 0.3]);
  assert.deepEqual([...mixMusic(voice, new Float32Array(0), rate, { gain: 0.5 })], [...voice]);
});
