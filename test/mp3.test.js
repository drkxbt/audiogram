import { test } from "node:test";
import assert from "node:assert/strict";
import { frameSpan, indexMp3, parseWav, wavHeader } from "../dist/mp3.js";

// An MPEG-1 Layer III frame header: 128 kbps, 44.1 kHz, joint stereo. 417 bytes, or 418 with padding.
function frame(padding = 0, fill = 0x55) {
  const length = 417 + padding;
  const bytes = new Uint8Array(length).fill(fill);
  bytes.set([0xff, 0xfb, 0x90 | (padding << 1), 0x44]);
  return bytes;
}

// A first frame that carries a Xing header in place of audio, the way LAME writes it.
function xingFrame() {
  const bytes = frame();
  bytes.fill(0, 4);
  bytes.set([0x58, 0x69, 0x6e, 0x67], 4 + 32);
  return bytes;
}

function id3(size) {
  const tag = new Uint8Array(10 + size);
  tag.set([0x49, 0x44, 0x33, 4, 0, 0]);
  // Synchsafe: seven bits a byte.
  tag.set([(size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f], 6);
  return tag;
}

const join = (...parts) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

test("an MP3's audio frames are found past its tag, and its length follows from them", () => {
  const frames = Array.from({ length: 100 }, (_, i) => frame(i % 3 === 0 ? 1 : 0));
  const index = indexMp3(join(id3(300), ...frames));
  assert.equal(index.sampleRate, 44100);
  assert.equal(index.samplesPerFrame, 1152);
  assert.equal(index.frames, 100);
  assert.equal(index.offsets[0], 310);
  assert.equal(index.offsets[1], 310 + 418);
  assert.equal(index.offsets[100], 310 + frames.reduce((sum, item) => sum + item.length, 0));
  assert.ok(Math.abs(index.duration - (100 * 1152) / 44100) < 1e-9);
});

test("the Xing frame at the start holds no audio and is left out", () => {
  const index = indexMp3(join(xingFrame(), ...Array.from({ length: 10 }, () => frame())));
  assert.equal(index.frames, 10);
  assert.equal(index.offsets[0], 417);
});

test("stray bytes between frames are skipped, and a frame cut short at the end is not counted", () => {
  const index = indexMp3(join(frame(), frame(), new Uint8Array([0, 1, 2, 0xff, 0x00, 7]), frame(), frame(), frame().subarray(0, 200)));
  assert.equal(index.frames, 4);
  assert.equal(index.offsets[2], 417 * 2 + 6);
});

test("a file with no MPEG audio in it is not an MP3", () => {
  assert.equal(indexMp3(new TextEncoder().encode("RIFF....WAVEfmt nothing to see here".repeat(40))), null);
  assert.equal(indexMp3(new Uint8Array(0)), null);
  // One lucky sync word followed by nothing that agrees with it.
  assert.equal(indexMp3(join(new Uint8Array([0xff, 0xfb, 0x90, 0x44]), new Uint8Array(2000))), null);
});

test("a stretch of time maps to whole frames, with a few before it for the decoder to settle", () => {
  const index = indexMp3(join(...Array.from({ length: 1000 }, () => frame())));
  const perFrame = 1152 / 44100;
  const span = frameSpan(index, 10, 12);
  assert.equal(span.first, Math.floor(10 / perFrame) - 8);
  assert.ok(span.last >= Math.ceil(12 / perFrame) && span.last <= index.frames);
  assert.equal(span.byteStart, index.offsets[span.first]);
  assert.equal(span.byteEnd, index.offsets[span.last]);
  assert.ok(Math.abs(span.start - span.first * perFrame) < 1e-9);
  assert.ok(Math.abs(span.end - span.last * perFrame) < 1e-9);
  // Near the edges the span stops at the first and the last frame.
  const head = frameSpan(index, 0, 1);
  assert.equal(head.first, 0);
  const tail = frameSpan(index, index.duration - 1, index.duration + 5);
  assert.equal(tail.last, index.frames);
});

function wav({ channels = 2, sampleRate = 44100, bits = 16, frames = 1000, extra = false } = {}) {
  const block = (channels * bits) / 8;
  const fmt = new Uint8Array(24);
  const view = new DataView(fmt.buffer);
  fmt.set([0x66, 0x6d, 0x74, 0x20]);
  view.setUint32(4, 16, true);
  view.setUint16(8, 1, true);
  view.setUint16(10, channels, true);
  view.setUint32(12, sampleRate, true);
  view.setUint32(16, sampleRate * block, true);
  view.setUint16(20, block, true);
  view.setUint16(22, bits, true);
  const list = extra ? join(new TextEncoder().encode("LIST"), new Uint8Array([6, 0, 0, 0, 1, 2, 3, 4, 5, 6])) : new Uint8Array(0);
  const data = new Uint8Array(8 + frames * block);
  data.set([0x64, 0x61, 0x74, 0x61]);
  new DataView(data.buffer).setUint32(4, frames * block, true);
  const head = new Uint8Array(12);
  head.set(new TextEncoder().encode("RIFF"));
  new DataView(head.buffer).setUint32(4, 4 + fmt.length + list.length + data.length, true);
  head.set(new TextEncoder().encode("WAVE"), 8);
  return join(head, fmt, list, data);
}

test("a WAV's format and where its samples lie are read from its chunks", () => {
  const info = parseWav(wav({ extra: true }));
  assert.equal(info.sampleRate, 44100);
  assert.equal(info.channels, 2);
  assert.equal(info.blockAlign, 4);
  assert.equal(info.dataOffset, 12 + 24 + 14 + 8);
  assert.equal(info.dataLength, 4000);
  assert.ok(Math.abs(info.duration - 1000 / 44100) < 1e-9);
  assert.equal(parseWav(new TextEncoder().encode("ID3 not a wave at all, not even close")), null);
});

test("a stretch of a WAV gets a header of its own, saying how much data follows", () => {
  const info = parseWav(wav());
  const header = wavHeader(info, 400);
  const again = parseWav(join(header, new Uint8Array(400)));
  assert.equal(again.sampleRate, 44100);
  assert.equal(again.channels, 2);
  assert.equal(again.dataOffset, header.length);
  assert.equal(again.dataLength, 400);
});

test("only plain PCM and float WAVs are read in stretches; compressed ones are left to the browser to decode whole", () => {
  const withFormat = (tag, sub) => {
    const bytes = wav();
    const view = new DataView(bytes.buffer);
    view.setUint16(20, tag, true);
    if (sub !== undefined) {
      // An extensible format keeps its real one in the subformat GUID, past cbSize; a short fmt chunk can't hold it, so build one.
      const fmt = new Uint8Array(48);
      const fv = new DataView(fmt.buffer);
      fmt.set([0x66, 0x6d, 0x74, 0x20]);
      fv.setUint32(4, 40, true);
      fv.setUint16(8, 0xfffe, true);
      fv.setUint16(10, 2, true);
      fv.setUint32(12, 44100, true);
      fv.setUint32(16, 44100 * 4, true);
      fv.setUint16(20, 4, true);
      fv.setUint16(22, 16, true);
      fv.setUint16(24, 22, true);
      fv.setUint16(32, sub, true);
      const data = new Uint8Array(8 + 400);
      data.set([0x64, 0x61, 0x74, 0x61]);
      new DataView(data.buffer).setUint32(4, 400, true);
      const head = new Uint8Array(12);
      head.set(new TextEncoder().encode("RIFF"));
      head.set(new TextEncoder().encode("WAVE"), 8);
      return join(head, fmt, data);
    }
    return bytes;
  };
  assert.ok(parseWav(withFormat(1)));
  assert.ok(parseWav(withFormat(3)));
  assert.equal(parseWav(withFormat(0x11)), null);
  assert.equal(parseWav(withFormat(0x55)), null);
  assert.ok(parseWav(withFormat(0xfffe, 1)));
  assert.equal(parseWav(withFormat(0xfffe, 0x11)), null);
});
