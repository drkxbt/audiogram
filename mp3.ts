/* Where the sound lies inside MP3 and WAV files, so a long recording can be read a stretch at a time instead of
   decoded whole. Free of the DOM, so it can be tested on its own. */

export interface Mp3Index {
  sampleRate: number;
  samplesPerFrame: number;
  /** How many audio frames there are. */
  frames: number;
  /** The byte offset of each audio frame in order, then where the last one ends: `frames + 1` entries. */
  offsets: Uint32Array;
  /** In seconds. */
  duration: number;
}

interface Header {
  version: number;
  layer: number;
  sampleRate: number;
  samplesPerFrame: number;
  length: number;
  sideInfo: number;
}

// Bitrates in kbps by bitrate index: MPEG-1 layers I, II and III, then MPEG-2 and 2.5 layer I, then their layers II and III.
const BITRATES = [
  [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
];
const RATES = [44100, 48000, 32000];

/** The frame header at `at`, or null when the four bytes there aren't one. */
function header(bytes: Uint8Array, at: number): Header | null {
  if (at + 4 > bytes.length || bytes[at] !== 0xff || (bytes[at + 1] & 0xe0) !== 0xe0) return null;
  const b2 = bytes[at + 1];
  const b3 = bytes[at + 2];
  // Version: 3 is MPEG-1, 2 is MPEG-2, 0 is MPEG-2.5, 1 is reserved. Layer: 3 is I, 2 is II, 1 is III.
  const version = (b2 >> 3) & 3;
  const layerBits = (b2 >> 1) & 3;
  const bitrateIndex = b3 >> 4;
  const rateIndex = (b3 >> 2) & 3;
  if (version === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;
  const layer = 4 - layerBits;
  const mpeg1 = version === 3;
  const bitrate = BITRATES[mpeg1 ? layer - 1 : layer === 1 ? 3 : 4][bitrateIndex] * 1000;
  const sampleRate = RATES[rateIndex] >> (mpeg1 ? 0 : version === 2 ? 1 : 2);
  const padding = (b3 >> 1) & 1;
  const samplesPerFrame = layer === 1 ? 384 : layer === 3 && !mpeg1 ? 576 : 1152;
  const length = layer === 1
    ? (Math.floor((12 * bitrate) / sampleRate) + padding) * 4
    : Math.floor(((layer === 3 && !mpeg1 ? 72 : 144) * bitrate) / sampleRate) + padding;
  const mono = bytes[at + 3] >> 6 === 3;
  const crc = (b2 & 1) === 0 ? 2 : 0;
  const sideInfo = layer === 3 ? 4 + crc + (mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17) : 4 + crc;
  return { version, layer, sampleRate, samplesPerFrame, length, sideInfo };
}

const same = (a: Header, b: Header) => a.version === b.version && a.layer === b.layer && a.sampleRate === b.sampleRate;

const ascii = (bytes: Uint8Array, at: number, text: string) => [...text].every((char, i) => bytes[at + i] === char.charCodeAt(0));

/** A header at `at` that the next frame agrees with, so a stray 0xFF in the data isn't taken for one. */
function confirmed(bytes: Uint8Array, at: number, reference: Header | null): Header | null {
  const found = header(bytes, at);
  if (!found || (reference && !same(found, reference))) return null;
  const next = at + found.length;
  if (next === bytes.length) return found;
  const following = header(bytes, next);
  return following && same(found, following) ? found : null;
}

/** Every audio frame in an MP3 (or any MPEG audio stream), or null when there is none. */
export function indexMp3(bytes: Uint8Array): Mp3Index | null {
  let at = 0;
  // ID3v2 tags, sometimes more than one, before the audio.
  while (ascii(bytes, at, "ID3") && at + 10 <= bytes.length) {
    const size = ((bytes[at + 6] & 0x7f) << 21) | ((bytes[at + 7] & 0x7f) << 14) | ((bytes[at + 8] & 0x7f) << 7) | (bytes[at + 9] & 0x7f);
    at += 10 + size + (bytes[at + 5] & 0x10 ? 10 : 0);
  }
  let reference: Header | null = null;
  let offsets = new Uint32Array(Math.max(16, Math.ceil(bytes.length / 96)));
  let frames = 0;
  while (at < bytes.length) {
    const found: Header | null = reference ? header(bytes, at) : confirmed(bytes, at, null);
    if (!found || (reference && !same(found, reference)) || at + found.length > bytes.length) {
      if (found && reference && same(found, reference)) break;
      // Lost: look for the next frame the one after it agrees with.
      let next = at + 1;
      while (next < bytes.length && !confirmed(bytes, next, reference)) next++;
      at = next;
      continue;
    }
    // The first frame of a VBR file is often a Xing, Info or VBRI header in place of sound.
    if (!reference && (ascii(bytes, at + found.sideInfo, "Xing") || ascii(bytes, at + found.sideInfo, "Info") || ascii(bytes, at + 36, "VBRI"))) {
      reference = found;
      at += found.length;
      continue;
    }
    reference = found;
    if (frames + 1 >= offsets.length) {
      const grown = new Uint32Array(offsets.length * 2);
      grown.set(offsets);
      offsets = grown;
    }
    offsets[frames++] = at;
    at += found.length;
    offsets[frames] = at;
  }
  if (!frames || !reference) return null;
  return {
    sampleRate: reference.sampleRate,
    samplesPerFrame: reference.samplesPerFrame,
    frames,
    offsets: offsets.slice(0, frames + 1),
    duration: (frames * reference.samplesPerFrame) / reference.sampleRate,
  };
}

export interface FrameSpan {
  first: number;
  /** One past the last frame. */
  last: number;
  byteStart: number;
  byteEnd: number;
  /** Where the first frame starts and the last one ends, in seconds. */
  start: number;
  end: number;
}

/**
 * The frames that cover `start` to `end` seconds, with `preroll` frames before them so the decoder has the data the
 * first one leans on, and `postroll` after so the last one comes out whole.
 */
export function frameSpan(index: Mp3Index, start: number, end: number, preroll = 8, postroll = 2): FrameSpan {
  const perFrame = index.samplesPerFrame / index.sampleRate;
  const first = Math.min(index.frames - 1, Math.max(0, Math.floor(start / perFrame) - preroll));
  const last = Math.max(first + 1, Math.min(index.frames, Math.ceil(end / perFrame) + postroll));
  return { first, last, byteStart: index.offsets[first], byteEnd: index.offsets[last], start: first * perFrame, end: last * perFrame };
}

export interface WavInfo {
  sampleRate: number;
  channels: number;
  blockAlign: number;
  dataOffset: number;
  dataLength: number;
  duration: number;
  /** The body of the fmt chunk, kept to write headers for stretches of the file. */
  format: Uint8Array;
}

/**
 * The format of a WAV file and where its samples lie, from its first bytes. `fileLength` is the whole file's size when
 * `bytes` is only its start; a data chunk that says it runs further than the file, as streamed WAVs do, is cut to it.
 */
export function parseWav(bytes: Uint8Array, fileLength = bytes.length): WavInfo | null {
  if (bytes.length < 12 || !ascii(bytes, 0, "RIFF") || !ascii(bytes, 8, "WAVE")) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format: Uint8Array | null = null;
  let at = 12;
  while (at + 8 <= bytes.length) {
    const size = view.getUint32(at + 4, true);
    if (ascii(bytes, at, "fmt ") && at + 8 + 16 <= bytes.length) format = bytes.slice(at + 8, at + 8 + Math.min(size, 40));
    else if (ascii(bytes, at, "data") && format) {
      const formatView = new DataView(format.buffer);
      // Only plain PCM and float samples can be cut anywhere; compressed WAVs are left to the browser to decode whole.
      const tag = formatView.getUint16(0, true);
      const kind = tag === 0xfffe && format.length >= 26 ? formatView.getUint16(24, true) : tag;
      if (kind !== 1 && kind !== 3) return null;
      const channels = formatView.getUint16(2, true);
      const sampleRate = formatView.getUint32(4, true);
      const blockAlign = formatView.getUint16(12, true);
      if (!channels || !sampleRate || !blockAlign) return null;
      const dataOffset = at + 8;
      const room = Math.max(0, fileLength - dataOffset);
      const dataLength = Math.floor((size && size < room ? size : room) / blockAlign) * blockAlign;
      return { sampleRate, channels, blockAlign, dataOffset, dataLength, duration: dataLength / blockAlign / sampleRate, format };
    }
    at += 8 + size + (size & 1);
  }
  return null;
}

/** A WAV header for `dataLength` bytes of samples in the format of `info`, to put in front of a stretch of them. */
export function wavHeader(info: WavInfo, dataLength: number): Uint8Array {
  const out = new Uint8Array(12 + 8 + info.format.length + 8);
  const view = new DataView(out.buffer);
  const write = (at: number, text: string) => [...text].forEach((char, i) => (out[at + i] = char.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, out.length - 8 + dataLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, info.format.length, true);
  out.set(info.format, 20);
  const data = 20 + info.format.length;
  write(data, "data");
  view.setUint32(data + 4, dataLength, true);
  return out;
}
