import { frameSpan, indexMp3, parseWav, wavHeader, type Mp3Index, type WavInfo } from "./mp3.js";
import { peaks } from "./wave.js";

/** The outline's resolution: min, max pairs a second. */
export const OUTLINE_RATE = 50;

// The outline is read this many seconds at a time, at a rate that keeps the work small, with a short rest between
// stretches so a phone can free the last one's memory before the next.
const OUTLINE_STRETCH = 60;
const OUTLINE_SAMPLE_RATE = 16000;
const OUTLINE_REST = 40;

/** A recording opened for editing, read a stretch at a time so that it can be hours long. */
export interface AudioSource {
  /** In seconds. */
  readonly duration: number;
  /** An address the browser can play the recording from. */
  readonly url: string;
  /** The lowest and highest sample in each fiftieth of a second, as min, max pairs, filled in as it is read. */
  readonly outline: Float32Array;
  /** How many seconds from the start the outline covers so far. */
  readonly outlined: number;
  /** One channel of the recording from `start` to `end` seconds, at `sampleRate`; silence past either end. */
  read(start: number, end: number, sampleRate: number): Promise<Float32Array>;
  /** Stops reading the outline and lets go of the recording. */
  close(): void;
}

export interface SourceOptions {
  /** Called as the outline fills in, with how many seconds from the start it covers. */
  onOutline?: (seconds: number) => void;
  /** Whether to read the outline at all; music under the voice needs none. True by default. */
  outline?: boolean;
}

function mono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();
  const out = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const part = buffer.getChannelData(channel);
    for (let i = 0; i < part.length; i++) out[i] += part[i] / buffer.numberOfChannels;
  }
  return out;
}

// Decodes run one at a time, each rate on a context of its own that is kept: several decodes at once can run a phone
// out of memory.
let decoding: Promise<unknown> = Promise.resolve();
const contexts = new Map<number, OfflineAudioContext>();

function decode(bytes: ArrayBuffer, sampleRate: number): Promise<Float32Array> {
  const run = decoding.then(async () => {
    let context = contexts.get(sampleRate);
    if (!context) contexts.set(sampleRate, (context = new OfflineAudioContext(1, 1, sampleRate)));
    return mono(await context.decodeAudioData(bytes));
  });
  decoding = run.catch(() => {});
  return run;
}

const rest = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** `samples` at `from` rate, made `to` rate. */
async function resample(samples: Float32Array, from: number, to: number): Promise<Float32Array> {
  if (from === to || !samples.length) return samples;
  const buffer = new AudioBuffer({ numberOfChannels: 1, length: samples.length, sampleRate: from });
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  const context = new OfflineAudioContext(1, Math.max(1, Math.round((samples.length * to) / from)), to);
  const player = context.createBufferSource();
  player.buffer = buffer;
  player.connect(context.destination);
  player.start();
  return (await context.startRendering()).getChannelData(0).slice();
}

/** `length` samples from `decoded`, the first of them at `offset` (which may be negative), with silence where it has none. */
function cut(decoded: Float32Array, offset: number, length: number): Float32Array {
  const out = new Float32Array(Math.max(0, length));
  const from = Math.max(0, offset);
  const to = Math.min(decoded.length, offset + length);
  if (to > from) out.set(decoded.subarray(from, to), from - offset);
  return out;
}

/** Reads an MP3 a run of frames at a time. */
function mp3Reader(blob: Blob, index: Mp3Index) {
  return async (start: number, end: number, sampleRate: number) => {
    const length = Math.round((end - start) * sampleRate);
    if (end <= 0 || start >= index.duration) return new Float32Array(Math.max(0, length));
    const span = frameSpan(index, start, end);
    const decoded = await decode(await blob.slice(span.byteStart, span.byteEnd).arrayBuffer(), sampleRate);
    // The sound is lined up by its end, where the last frame ends: a decoder can drop or quiet the first frames of a
    // slice, which lean on data before it, but not the last.
    const firstAt = span.end - decoded.length / sampleRate;
    return cut(decoded, Math.round((start - firstAt) * sampleRate), length);
  };
}

/** Reads a WAV a stretch of samples at a time, each given a header of its own. */
function wavReader(blob: Blob, info: WavInfo) {
  return async (start: number, end: number, sampleRate: number) => {
    const length = Math.round((end - start) * sampleRate);
    const frames = info.dataLength / info.blockAlign;
    const first = Math.max(0, Math.floor(start * info.sampleRate));
    const last = Math.min(frames, Math.ceil(end * info.sampleRate));
    if (last <= first) return new Float32Array(Math.max(0, length));
    const bytes = (last - first) * info.blockAlign;
    const body = blob.slice(info.dataOffset + first * info.blockAlign, info.dataOffset + last * info.blockAlign);
    const decoded = await decode(await new Blob([wavHeader(info, bytes) as Uint8Array<ArrayBuffer>, body]).arrayBuffer(), sampleRate);
    return cut(decoded, Math.round((start - first / info.sampleRate) * sampleRate), length);
  };
}

/**
 * Opens a recording. An MP3 or a WAV is read a stretch at a time, so it can be any length, and its outline fills in
 * after this resolves. Anything else the browser can play, such as M4A or the sound of a video, is decoded whole, as
 * a short recording can be.
 */
export async function openSource(source: string | Blob, { onOutline, outline: wantOutline = true }: SourceOptions = {}): Promise<AudioSource> {
  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
  const head = new Uint8Array(await blob.slice(0, 10).arrayBuffer());
  // An ID3 tag can hold pictures; the audio is looked for after it.
  const tag = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33
    ? 10 + (((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f))
    : 0;
  const sample = new Uint8Array(await blob.slice(tag, tag + 65536).arrayBuffer());
  const looksMp3 = (indexMp3(sample)?.frames ?? 0) >= 8;
  const wav = !looksMp3 ? parseWav(new Uint8Array(await blob.slice(0, 65536).arrayBuffer()), blob.size) : null;
  const index = looksMp3 ? indexMp3(new Uint8Array(await blob.arrayBuffer())) : null;

  const url = URL.createObjectURL(blob);
  let closed = false;

  if (!index && !wav) {
    // Whole, at 48 kHz: the rate the AAC encoder and most players expect.
    let samples: Float32Array;
    try {
      samples = await decode(await blob.arrayBuffer(), 48000);
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
    const duration = samples.length / 48000;
    const outline = peaks(samples, Math.max(1, Math.round(duration * OUTLINE_RATE)));
    onOutline?.(duration);
    return {
      duration,
      url,
      outline,
      outlined: duration,
      read: (start, end, sampleRate) => {
        const from = Math.round(start * 48000);
        return resample(cut(samples, from, Math.round(end * 48000) - from), 48000, sampleRate);
      },
      close: () => URL.revokeObjectURL(url),
    };
  }

  const duration = index ? index.duration : wav!.duration;
  const read = index ? mp3Reader(blob, index) : wavReader(blob, wav!);
  const outline = new Float32Array(Math.max(1, Math.round(duration * OUTLINE_RATE)) * 2);
  const stretches = Math.ceil(duration / OUTLINE_STRETCH);
  let outlined = 0;

  // Front to back, a stretch at a time.
  if (wantOutline) void (async () => {
    for (let stretch = 0; stretch < stretches && !closed; stretch++) {
      const start = stretch * OUTLINE_STRETCH;
      const end = Math.min(duration, start + OUTLINE_STRETCH);
      try {
        const samples = await read(start, end, OUTLINE_SAMPLE_RATE);
        const from = Math.round(start * OUTLINE_RATE);
        const buckets = Math.min(outline.length / 2 - from, Math.max(1, Math.round((end - start) * OUTLINE_RATE)));
        outline.set(peaks(samples, buckets), from * 2);
      } catch {
        // A stretch the browser can't decode stays flat in the outline; it can still be played and read again later.
      }
      if (closed) break;
      outlined = Math.min(duration, end);
      onOutline?.(outlined);
      await rest(OUTLINE_REST);
    }
  })();

  return {
    duration,
    url,
    outline,
    get outlined() {
      return outlined;
    },
    read,
    close() {
      closed = true;
      URL.revokeObjectURL(url);
    },
  };
}
