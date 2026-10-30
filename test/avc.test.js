import { test } from "node:test";
import assert from "node:assert/strict";
import { avcCodecs, videoBitrate } from "../dist/avc.js";

test("a 1080p square at 30 fps keeps level 4.0", () => {
  assert.deepEqual(avcCodecs(1080, 1080, 30), ["avc1.42E028", "avc1.4D4028", "avc1.640028"]);
});

test("60 fps at 1080p needs level 4.2", () => {
  assert.deepEqual(avcCodecs(1080, 1920, 60), ["avc1.42E02A", "avc1.4D402A", "avc1.64002A"]);
});

test("a 1440p story frame is too big for level 4.2 and takes 5.1 at 60 fps", () => {
  assert.equal(avcCodecs(1440, 2560, 30)[2], "avc1.640032");
  assert.equal(avcCodecs(1440, 2560, 60)[2], "avc1.640033");
  assert.equal(avcCodecs(2560, 1440, 60)[2], "avc1.640033");
});

test("a 1440p square fits level 4.2 even at 60 fps", () => {
  assert.equal(avcCodecs(1440, 1440, 60)[2], "avc1.64002A");
});

test("small frames stay on level 4.0", () => {
  assert.equal(avcCodecs(360, 640, 60)[2], "avc1.640028");
});

test("the bitrate grows with the picture and the frame rate", () => {
  assert.equal(videoBitrate(1080, 1080, 30), 5_000_000);
  assert.ok(videoBitrate(1440, 1440, 30) > videoBitrate(1080, 1080, 30));
  assert.ok(videoBitrate(1080, 1080, 60) > videoBitrate(1080, 1080, 30));
  assert.equal(videoBitrate(360, 360, 30), 1_500_000);
});
