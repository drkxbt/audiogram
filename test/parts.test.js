import { test } from "node:test";
import assert from "node:assert/strict";
import { clipTimeAt, partsLength, readClip, readReel, recordingTimeAt, stitch, stitchCues } from "../dist/parts.js";

const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);

test("parts add up to one clip, in the order they were put in", () => {
  assert.equal(partsLength([[10, 14], [2, 5]]), 7);
  assert.equal(partsLength([]), 0);
});

test("a time in the recording maps into the clip, and back", () => {
  const parts = [[10, 14], [2, 5]];
  close(clipTimeAt(parts, 12), 2);
  close(clipTimeAt(parts, 3), 5);
  assert.equal(clipTimeAt(parts, 7), null);
  close(recordingTimeAt(parts, 2), 12);
  close(recordingTimeAt(parts, 5), 3);
  close(recordingTimeAt(parts, 6.9), 4.9);
  close(recordingTimeAt(parts, 99), 5);
});

test("the parts' sound joins end to end, fading at every join and nowhere else", () => {
  const rate = 100;
  const samples = new Float32Array(1000).fill(1);
  const out = stitch(samples, rate, [[1, 3], [6, 7]], 0.1);
  assert.equal(out.length, 300);
  close(out[0], 1);
  close(out[150], 1);
  assert.ok(out[199] < 0.2, "the first part fades out at the join");
  assert.ok(out[200] < 0.2, "the second part fades in from the join");
  close(out[299], 1);
  // A single part comes back untouched.
  assert.deepEqual([...stitch(samples, rate, [[2, 2.05]], 0.1)], [1, 1, 1, 1, 1]);
});

test("each part keeps its own captions, moved to where it sits in the clip", () => {
  const cues = [
    { start: 2, end: 4, text: "early", words: [{ text: "early", start: 2, end: 4 }] },
    { start: 11, end: 13, text: "late", words: [{ text: "late", start: 11, end: 13 }] },
    { start: 20, end: 22, text: "left out" },
  ];
  const out = stitchCues(cues, [[10, 14], [1, 5]]);
  assert.deepEqual(out.map((cue) => [cue.text, cue.start, cue.end]), [["late", 1, 3], ["early", 5, 7]]);
  assert.deepEqual(out[1].words.map((word) => [word.start, word.end]), [[5, 7]]);
});

// A recording read the way an AudioSource reads one: any stretch, at the rate asked for, silence past its ends.
function recordingOf(samples, calls = []) {
  return async (start, end, sampleRate) => {
    calls.push([start, end]);
    const from = Math.round(start * sampleRate);
    return Float32Array.from({ length: Math.round((end - start) * sampleRate) }, (_, i) => samples[from + i] ?? 0);
  };
}

test("a window of the clip reads the same sound as the whole clip joined at once", async () => {
  const rate = 100;
  const samples = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 7) * 0.5 + 0.1);
  const parts = [[1, 3], [6, 7], [8, 8.5]];
  const whole = stitch(samples, rate, parts, 0.1);
  for (const [from, to] of [[0, 3.5], [1.5, 3.2], [2.95, 3.05], [0.37, 2.11]]) {
    const window = await readClip(recordingOf(samples), parts, from, to, rate, 0.1);
    assert.equal(window.length, Math.round((to - from) * rate));
    window.forEach((value, i) => close(value, whole[Math.round(from * rate) + i]));
  }
});

test("before the clip starts and after it ends there is silence", async () => {
  const rate = 100;
  const samples = new Float32Array(500).fill(0.5);
  const window = await readClip(recordingOf(samples), [[1, 2]], -0.5, 1.5, rate, 0.1);
  assert.equal(window.length, 200);
  assert.ok(window.subarray(0, 50).every((value) => value === 0));
  assert.ok(window.subarray(50, 150).every((value) => value === 0.5));
  assert.ok(window.subarray(150).every((value) => value === 0));
});

test("only the parts under the window are read, and only as much of them as it covers", async () => {
  const calls = [];
  await readClip(recordingOf(new Float32Array(2000), calls), [[1, 3], [10, 14], [6, 7]], 3, 4, 100);
  assert.equal(calls.length, 1);
  close(calls[0][0], 11);
  close(calls[0][1], 12);
});

test("the halves of a split play on into each other, and only a real join fades", () => {
  const rate = 100;
  const samples = new Float32Array(1000).fill(1);
  assert.deepEqual([...stitch(samples, rate, [[1, 3], [3, 4]], 0.1)], [...samples.subarray(100, 400)]);
  const out = stitch(samples, rate, [[1, 3], [3, 4], [6, 7]], 0.1);
  close(out[199], 1);
  close(out[200], 1);
  assert.ok(out[299] < 0.2, "the split clip fades out where the next part was cut from elsewhere");
  assert.ok(out[300] < 0.2, "and the next part fades in");
});

test("a window of a clip with a split in it reads the same sound as the whole clip", async () => {
  const rate = 100;
  const samples = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 5) * 0.4 + 0.2);
  const parts = [[1, 2.4], [2.4, 4], [6, 7]];
  const whole = stitch(samples, rate, parts, 0.1);
  for (const [from, to] of [[0, 4], [1.2, 1.6], [2.9, 3.4], [0.5, 2.7]]) {
    const window = await readClip(recordingOf(samples), parts, from, to, rate, 0.1);
    window.forEach((value, i) => close(value, whole[Math.round(from * rate) + i]));
  }
});

test("recordings end to end read as one, each in its own time, silent where none is", async () => {
  const rate = 100;
  const first = [];
  const second = [];
  const reel = [
    { offset: 0, duration: 2, read: recordingOf(new Float32Array(200).fill(0.25), first) },
    { offset: 2, duration: 1, read: recordingOf(new Float32Array(100).fill(0.75), second) },
    { offset: 4, duration: 1, read: recordingOf(new Float32Array(100).fill(0.5)) },
  ];
  const across = await readReel(reel, 1.5, 2.5, rate);
  assert.equal(across.length, 100);
  assert.ok(across.subarray(0, 50).every((value) => value === 0.25));
  assert.ok(across.subarray(50).every((value) => value === 0.75));
  close(first[0][0], 1.5);
  close(first[0][1], 2);
  close(second[0][0], 0);
  close(second[0][1], 0.5);
  const all = await readReel(reel, -0.5, 5.5, rate);
  assert.equal(all.length, 600);
  assert.ok(all.subarray(0, 50).every((value) => value === 0), "silence before the first");
  assert.ok(all.subarray(50, 250).every((value) => value === 0.25));
  assert.ok(all.subarray(250, 350).every((value) => value === 0.75));
  assert.ok(all.subarray(350, 450).every((value) => value === 0), "silence in the gap");
  assert.ok(all.subarray(450, 550).every((value) => value === 0.5));
  assert.ok(all.subarray(550).every((value) => value === 0), "silence after the last");
  assert.equal((await readReel(reel, 6, 7, rate)).length, 100);
});

test("a clip of parts from two recordings sounds the same as the recordings joined into one file", async () => {
  const rate = 100;
  const one = Float32Array.from({ length: 300 }, (_, i) => Math.sin(i / 6) * 0.5);
  const two = Float32Array.from({ length: 200 }, (_, i) => Math.cos(i / 4) * 0.3 + 0.1);
  const both = new Float32Array(500);
  both.set(one);
  both.set(two, 300);
  const reel = [{ offset: 0, duration: 3, read: recordingOf(one) }, { offset: 3, duration: 2, read: recordingOf(two) }];
  const read = (start, end, sampleRate) => readReel(reel, start, end, sampleRate);
  const parts = [[1, 3], [3, 4.5], [0.5, 1]];
  const whole = stitch(both, rate, parts, 0.1);
  assert.equal(whole.length, 400);
  for (const [from, to] of [[0, 4], [1.5, 2.5], [1.9, 2.1], [3.2, 4]]) {
    const window = await readClip(read, parts, from, to, rate, 0.1);
    window.forEach((value, i) => close(value, whole[Math.round(from * rate) + i]));
  }
});
