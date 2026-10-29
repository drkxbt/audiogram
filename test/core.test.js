import { test } from "node:test";
import assert from "node:assert/strict";
import { fft, peaks, rms, spectrum, Smoother } from "../dist/wave.js";
import { clip, cueAt, formatTime, markStart, paginate, parseSubtitles, parseTime, spread, timeWords, toSRT, toVTT } from "../dist/captions.js";
import { Mp4Builder, mux } from "../dist/mp4.js";
import { clock, Painter, SIZES, THEMES } from "../dist/render.js";
import { defaultLayers } from "../dist/layers.js";

const close = (actual, expected, tolerance = 1e-6, message) => assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `${actual} ≉ ${expected}`);

test("peaks hold each slice's lowest and highest sample", () => {
  const samples = Float32Array.from([0, 0.5, -0.25, 0.1, -0.9, 0.3, 0, 0]);
  const f = Math.fround;
  assert.deepEqual([...peaks(samples, 2)], [-0.25, 0.5, f(-0.9), f(0.3)]);
  assert.deepEqual([...peaks(samples, 1, 4, 6)], [f(-0.9), f(0.3)]);
  assert.equal(rms(Float32Array.from([1, -1, 1, -1]), 0, 4), 1);
  assert.equal(rms(samples, 6, 6), 0);
});

test("the FFT finds a pure tone in its own bin", () => {
  const n = 64;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 5 * i) / n);
  fft(re, im);
  const magnitude = (k) => Math.hypot(re[k], im[k]);
  close(magnitude(5), n / 2, 1e-9);
  close(magnitude(n - 5), n / 2, 1e-9);
  close(magnitude(6), 0, 1e-9);
  assert.throws(() => fft(new Float64Array(6), new Float64Array(6)));
});

test("a spectrum lights the band a tone is in and leaves silence dark", () => {
  const rate = 16000;
  const tone = new Float32Array(4096).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 1000 * i) / rate));
  const bands = spectrum(tone, rate, 2048, { bands: 16, low: 100, high: 8000 });
  const loudest = bands.indexOf(Math.max(...bands));
  // 1 kHz on a log scale from 100 Hz to 8 kHz falls in band 8 of 16.
  assert.equal(loudest, 8);
  assert.ok(bands[loudest] > 0.8);
  assert.ok(bands[1] < 0.2);
  assert.ok(spectrum(new Float32Array(4096), rate, 2048).every((value) => value === 0));
});

test("levels rise quickly and fall slowly", () => {
  const meter = new Smoother(0.5, 0.1);
  assert.deepEqual([...meter.next(Float32Array.from([0]))], [0]);
  close(meter.next(Float32Array.from([1]))[0], 0.5);
  close(meter.next(Float32Array.from([0]))[0], 0.45);
});

test("times read in every common form and write back", () => {
  assert.equal(parseTime("00:01:02,500"), 62.5);
  assert.equal(parseTime("01:02.250"), 62.25);
  assert.equal(parseTime("1:00:00.000"), 3600);
  assert.equal(parseTime("7.5"), 7.5);
  assert.ok(Number.isNaN(parseTime("soon")));
  assert.equal(formatTime(3725.5, "srt"), "01:02:05,500");
  assert.equal(formatTime(62.5, "vtt"), "00:01:02.500");
  assert.equal(formatTime(62.54), "1:02.5");
});

test("SRT and WebVTT read and write, with speakers from voice tags", () => {
  const srt = "1\r\n00:00:01,000 --> 00:00:02,500\r\nHello <i>there</i>\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nsecond\r\nline\r\n";
  assert.deepEqual(parseSubtitles(srt), [{ start: 1, end: 2.5, text: "Hello there" }, { start: 3, end: 4, text: "second line" }]);
  const vtt = "WEBVTT\n\nintro\n00:01.000 --> 00:02.000 align:start\n<v Host>gm everyone\n";
  assert.deepEqual(parseSubtitles(vtt), [{ start: 1, end: 2, text: "gm everyone", speaker: "Host" }]);
  const cues = [{ start: 1, end: 2.5, text: "gm", speaker: "Host" }];
  assert.deepEqual(parseSubtitles(toSRT(cues)), [{ start: 1, end: 2.5, text: "gm" }]);
  assert.deepEqual(parseSubtitles(toVTT(cues)), cues);
});

test("plain lines spread over the time by how long they take to say", () => {
  const cues = spread(["short.", "a much longer line that takes a while to say"], 10, 20, 0.5);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 10);
  close(cues[1].end, 20);
  close(cues[1].start - cues[0].end, 0.5);
  assert.ok(cues[1].end - cues[1].start > 3 * (cues[0].end - cues[0].start));
  assert.deepEqual(spread(["", "  "], 0, 5), []);
});

test("words keep recorded times, or share the cue's by length", () => {
  const recorded = timeWords({ start: 0, end: 2, text: "ship it", words: [{ text: "ship", start: 0.1 }, { text: "it", start: 0.8 }] });
  assert.deepEqual(recorded, [{ text: "ship", start: 0.1, end: 0.8 }, { text: "it", start: 0.8, end: 2 }]);
  const shared = timeWords({ start: 0, end: 3, text: "go go gone" });
  assert.equal(shared.length, 3);
  assert.equal(shared[0].start, 0);
  close(shared[2].end, 3);
  assert.ok(shared[2].end - shared[2].start > shared[0].end - shared[0].start);
});

test("long cues break into pages that keep their words' times", () => {
  const cue = { start: 0, end: 6, text: "The best thing I did this year was post every build, even the ugly ones." };
  const pages = paginate([cue], 32);
  assert.ok(pages.length >= 2);
  assert.ok(pages.every((page) => page.text.length <= 32));
  assert.equal(pages.map((page) => page.text).join(" "), cue.text);
  assert.equal(pages[0].start, 0);
  assert.equal(pages[pages.length - 1].end, 6);
  for (let i = 1; i < pages.length; i++) close(pages[i].start, pages[i - 1].end, 1e-9);
});

test("finding the cue on screen, and tapping a new start", () => {
  const cues = [{ start: 0, end: 2, text: "a" }, { start: 3, end: 5, text: "b" }, { start: 6, end: 8, text: "c" }];
  assert.equal(cueAt(cues, 1), 0);
  assert.equal(cueAt(cues, 2.5), -1);
  assert.equal(cueAt(cues, 7.9), 2);
  assert.equal(cueAt(cues, 8), -1);
  const tapped = markStart(cues, 1, 1.5);
  assert.equal(tapped[0].end, 1.5, "the cue before ends where the tap is");
  assert.equal(tapped[1].start, 1.5);
  assert.ok(tapped[1].end > tapped[1].start);
  assert.equal(tapped[2].start, 6);
});

test("clipping keeps what's inside and starts the clip at zero", () => {
  const cues = [{ start: 0, end: 4, text: "one two three four" }, { start: 5, end: 7, text: "five six" }, { start: 9, end: 10, text: "late" }];
  const clipped = clip(cues, 2, 6);
  assert.equal(clipped.length, 2);
  assert.equal(clipped[0].start, 0);
  assert.equal(clipped[0].text, "three four");
  assert.equal(clipped[1].start, 3);
  assert.equal(clipped[1].end, 4);
});

// A small MP4 reader: the boxes in a buffer, and the ones inside a box.
function boxes(bytes, from = 0, to = bytes.length) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  for (let at = from; at < to; ) {
    let size = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    let header = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(at + 8));
      header = 16;
    }
    out.push({ type, at, size, body: at + header, end: at + size });
    at += size;
  }
  return out;
}
const child = (bytes, box, type, skip = 0) => boxes(bytes, box.body + skip, box.end).find((item) => item.type === type);
const path = (bytes, box, ...types) => types.reduce((parent, type) => {
  const skip = { stsd: 8, dref: 8 }[parent.type] ?? 0;
  return child(bytes, parent, type, skip);
}, box);

test("an MP4 with its index first, every sample where the index says", () => {
  const frame = (n) => Uint8Array.from({ length: 50 + n }, (_, i) => (n * 7 + i) & 0xff);
  const video = { kind: "video", width: 1080, height: 1080, timescale: 90000, description: Uint8Array.from([1, 0x42, 0xe0, 0x28, 0xff]), samples: [0, 1, 2, 3].map((n) => ({ data: frame(n), duration: 3000, key: n === 0 || n === 2 })) };
  const audio = { kind: "audio", sampleRate: 48000, channels: 1, timescale: 48000, description: Uint8Array.from([0x11, 0x88]), samples: [0, 1, 2].map((n) => ({ data: frame(100 + n), duration: 1024, key: true })) };
  const file = mux([video, audio]);
  const view = new DataView(file.buffer);
  const top = boxes(file);
  assert.deepEqual(top.map((box) => box.type), ["ftyp", "moov", "mdat"]);
  const moov = top[1];
  const mvhd = child(file, moov, "mvhd");
  assert.equal(view.getUint32(mvhd.body + 12), 1000, "movie timescale");
  assert.equal(view.getUint32(mvhd.body + 16), Math.round((4 * 3000 / 90000) * 1000), "movie duration in ms");
  const traks = boxes(file, moov.body, moov.end).filter((box) => box.type === "trak");
  assert.equal(traks.length, 2);

  for (const [index, track] of [video, audio].entries()) {
    const stbl = path(file, traks[index], "mdia", "minf", "stbl");
    const stsz = child(file, stbl, "stsz");
    assert.equal(view.getUint32(stsz.body + 8), track.samples.length);
    const offsets = child(file, stbl, "stco");
    track.samples.forEach((sample, n) => {
      const offset = view.getUint32(offsets.body + 8 + 4 * n);
      assert.equal(view.getUint32(stsz.body + 12 + 4 * n), sample.data.length);
      assert.deepEqual(file.subarray(offset, offset + sample.data.length), sample.data, `sample ${n} of track ${index} is where the index says`);
    });
    const stts = child(file, stbl, "stts");
    assert.equal(view.getUint32(stts.body + 4), 1, "one run of equal durations");
    assert.equal(view.getUint32(stts.body + 12), track.samples[0].duration);
  }

  const videoStbl = path(file, traks[0], "mdia", "minf", "stbl");
  const stss = child(file, videoStbl, "stss");
  assert.deepEqual([view.getUint32(stss.body + 8), view.getUint32(stss.body + 12)], [1, 3], "key frames by number");
  const avc1 = path(file, traks[0], "mdia", "minf", "stbl", "stsd", "avc1");
  assert.equal(view.getUint16(avc1.body + 24), 1080);
  const avcC = child(file, avc1, "avcC", 78);
  assert.deepEqual(file.subarray(avcC.body, avcC.end), video.description);

  const mp4a = path(file, traks[1], "mdia", "minf", "stbl", "stsd", "mp4a");
  assert.equal(view.getUint16(mp4a.body + 16), 1, "channels");
  assert.equal(view.getUint32(mp4a.body + 24) >>> 16, 48000, "sample rate");
  const esds = child(file, mp4a, "esds", 28);
  const inside = file.subarray(esds.body, esds.end);
  const asc = inside.findIndex((byte, i) => byte === 0x05 && inside[i + 4] === 2);
  assert.ok(asc > 0, "a decoder-specific-info descriptor two bytes long");
  assert.deepEqual(inside.subarray(asc + 5, asc + 7), audio.description);
  const hdlr = path(file, traks[1], "mdia", "hdlr");
  assert.equal(String.fromCharCode(...file.subarray(hdlr.body + 8, hdlr.body + 12)), "soun");
});

test("an MP4 built a sample at a time keeps the bytes in the order they came, each where the index says", async () => {
  const frame = (n) => Uint8Array.from({ length: 40 + n }, (_, i) => (n * 13 + i) & 0xff);
  const head = [
    { kind: "video", width: 640, height: 360, timescale: 90000, description: Uint8Array.from([1, 0x42, 0xe0, 0x1e, 0xff]) },
    { kind: "audio", sampleRate: 48000, channels: 1, timescale: 48000, description: Uint8Array.from([0x11, 0x88]) },
  ];
  // Batches of 100 bytes, so the media spans several of them.
  const builder = new Mp4Builder(100);
  const added = [[], []];
  for (const [track, n] of [[1, 0], [1, 1], [0, 2], [0, 3], [1, 4], [0, 5], [0, 6]]) {
    const sample = { data: frame(n), duration: track ? 1024 : 3000, key: track === 1 || n === 2 };
    builder.add(track, sample);
    added[track].push(sample);
  }
  const file = new Uint8Array(await builder.finish(head).arrayBuffer());
  const view = new DataView(file.buffer);
  const top = boxes(file);
  assert.deepEqual(top.map((box) => box.type), ["ftyp", "moov", "mdat"]);
  const traks = boxes(file, top[1].body, top[1].end).filter((box) => box.type === "trak");
  const firstOffset = (index) => view.getUint32(child(file, path(file, traks[index], "mdia", "minf", "stbl"), "stco").body + 8);
  let last = 0;
  for (const [index, samples] of added.entries()) {
    const stbl = path(file, traks[index], "mdia", "minf", "stbl");
    const stsz = child(file, stbl, "stsz");
    const offsets = child(file, stbl, "stco");
    assert.equal(view.getUint32(stsz.body + 8), samples.length);
    samples.forEach((sample, n) => {
      const offset = view.getUint32(offsets.body + 8 + 4 * n);
      assert.deepEqual(file.subarray(offset, offset + sample.data.length), sample.data, `sample ${n} of track ${index}`);
      last = Math.max(last, offset + sample.data.length);
    });
  }
  assert.equal(last, file.length, "the media ends the file");
  assert.equal(top[2].end, file.length);
  assert.ok(firstOffset(1) < firstOffset(0), "the first sound came first, so it sits first");
});

test("a track longer than 32 bits of its timescale keeps its whole duration", () => {
  // Three samples of 2e9 ticks at 90 kHz: about 18.5 hours, past what four bytes hold.
  const video = { kind: "video", width: 640, height: 360, timescale: 90000, description: Uint8Array.from([1, 0x42, 0xe0, 0x1e, 0xff]), samples: [0, 1, 2].map((n) => ({ data: Uint8Array.of(n), duration: 2e9, key: n === 0 })) };
  const file = mux([video]);
  const view = new DataView(file.buffer);
  const moov = boxes(file).find((box) => box.type === "moov");
  const trak = boxes(file, moov.body, moov.end).find((box) => box.type === "trak");
  const mdhd = path(file, trak, "mdia", "mdhd");
  assert.equal(file[mdhd.body], 1, "version 1, with 64-bit times");
  assert.equal(view.getUint32(mdhd.body + 20), 90000, "timescale");
  assert.equal(Number(view.getBigUint64(mdhd.body + 24)), 6e9, "duration");
});

// A 2D context that accepts every call and records nothing, so the painter runs outside a browser.
function fakeContext(width, height) {
  const any = new Proxy(function () {}, { get: (_, key) => (key === "width" ? 0 : any), apply: () => any, set: () => true });
  // Numbers where a real canvas has them, so sums on the current alpha work.
  return new Proxy({}, { get: (_, key) => (key === "canvas" ? { width, height } : key === "globalAlpha" ? 1 : any), set: () => true });
}

const sceneFor = (overlay) => ({
  layout: "square", visual: "bars", theme: THEMES[0], title: "", speaker: "drk", handle: "@drkxbt", cover: null, captions: [],
  audio: { samples: new Float32Array(48000 * 10), sampleRate: 48000, start: 2, end: 8 }, overlay,
});

test("an overlay draws last on every frame, told where the clip is and how big", () => {
  const frames = [];
  const painter = new Painter(sceneFor((ctx, frame) => frames.push(frame)));
  painter.paint(fakeContext(540, 540), 1.5);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].time, 1.5);
  assert.equal(frames[0].duration, 6);
  assert.equal(frames[0].width, 540);
  assert.equal(frames[0].height, 540);
  close(frames[0].unit, 0.5);
  assert.equal(frames[0].theme, THEMES[0]);
});

test("a scene without an overlay paints as before", () => {
  assert.doesNotThrow(() => new Painter(sceneFor(undefined)).paint(fakeContext(1080, 1080), 0));
});

// A 2D context that writes down what was drawn, in order, and accepts everything else.
function recordingContext(width, height) {
  const calls = [];
  const any = new Proxy(function () {}, { get: (_, key) => (key === "width" ? 10 : any), apply: () => any, set: () => true });
  const ctx = new Proxy({}, {
    get: (_, key) => {
      if (key === "canvas") return { width, height };
      if (key === "globalAlpha") return 1;
      if (key === "drawImage") return (image, ...rect) => calls.push({ op: "drawImage", image, rect });
      if (key === "fillText") return (text, x, y) => calls.push({ op: "fillText", text, x, y });
      return any;
    },
    set: () => true,
  });
  return { ctx, calls };
}

test("a background picture goes under everything, a logo over the content and under any overlay", () => {
  const backdrop = { width: 1600, height: 900 };
  const logo = { width: 400, height: 200 };
  const { ctx, calls } = recordingContext(1080, 1080);
  const scene = { ...sceneFor((context) => context.drawImage("overlay")), speaker: "drk", backdrop, logo };
  new Painter(scene).paint(ctx, 1);
  const order = calls.map((call) => (call.image === backdrop ? "backdrop" : call.image === logo ? "logo" : call.image === "overlay" ? "overlay" : call.text === "drk" ? "name" : null)).filter(Boolean);
  assert.deepEqual(order, ["backdrop", "name", "logo", "overlay"]);
  // The picture covers the frame; the logo sits small in the top left margin, its shape kept.
  const [bx, by, bw, bh] = calls.find((call) => call.image === backdrop).rect;
  assert.ok(bx <= 0 && by <= 0 && bx + bw >= 1080 && by + bh >= 1080);
  const pad = Math.round(1080 * 0.074);
  const [lx, ly, lw, lh] = calls.find((call) => call.image === logo).rect;
  close(lx, pad);
  assert.ok(ly > 0 && ly + lh < pad, `logo ${ly}..${ly + lh} inside the ${pad} px margin`);
  close(lw / lh, 2, 1e-9);
});

test("without a background or a logo nothing extra is drawn", () => {
  const { ctx, calls } = recordingContext(1080, 1080);
  new Painter({ ...sceneFor(undefined), speaker: "drk" }).paint(ctx, 1);
  assert.equal(calls.filter((call) => call.op === "drawImage").length, 0);
});

test("the frame shows the clip's time by the visual and the links along the bottom", () => {
  const { ctx, calls } = recordingContext(1080, 1080);
  new Painter({ ...sceneFor(undefined), speaker: "drk", links: ["drk.vc", " x.com/drkxbt ", ""] }).paint(ctx, 1.5);
  const texts = calls.filter((call) => call.op === "fillText").map((call) => call.text);
  assert.ok(texts.includes("0:01 / 0:06"), texts.join(" | "));
  assert.ok(texts.includes("drk.vc  ·  x.com/drkxbt"), texts.join(" | "));
});

test("a 9:16 story is 1080 by 1920, and its name, visual and captions stack down it without overlapping", () => {
  assert.deepEqual(SIZES.story, { width: 1080, height: 1920 });
  const { ctx, calls } = recordingContext(1080, 1920);
  const cue = { start: 0, end: 5, text: "Ship small and ship often" };
  new Painter({ ...sceneFor(undefined), layout: "story", title: "A title", captions: [cue] }).paint(ctx, 1);
  const at = (text) => calls.find((call) => call.op === "fillText" && call.text.includes(text));
  assert.ok(at("drk") && at("A title") && at("0:01 / 0:06") && at("Ship"), calls.filter((call) => call.op === "fillText").map((call) => call.text).join(" | "));
  // Each part is drawn in its own layer's frame; the layers themselves stack down the frame.
  const top = (kind) => defaultLayers("story").find((layer) => layer.kind === kind).y;
  assert.ok(top("name") < top("title") && top("title") < top("time") && top("time") < top("captions"));
  const captions = defaultLayers("story").find((layer) => layer.kind === "captions");
  assert.ok((captions.y + captions.h) * 1920 < 1920 - 1080 * 0.074);
});

test("the clip's clock counts minutes, then hours once there are sixty of them", () => {
  assert.equal(clock(59.9), "0:59");
  assert.equal(clock(600), "10:00");
  assert.equal(clock(3602.4), "1:00:02");
  assert.equal(clock(5 * 3600 + 61), "5:01:01");
});
