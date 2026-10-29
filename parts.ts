import { clip, type Cue } from "./captions.js";

/** Stretches of a recording, in seconds, played one after another as a single clip. */
export type Parts = ReadonlyArray<readonly [number, number]>;

/** How long the parts last together. */
export function partsLength(parts: Parts): number {
  return parts.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0);
}

/** Where a time in the recording falls in the clip, or null when it is in none of the parts. */
export function clipTimeAt(parts: Parts, time: number): number | null {
  let offset = 0;
  for (const [start, end] of parts) {
    if (time >= start && time <= end) return offset + time - start;
    offset += end - start;
  }
  return null;
}

/** The time in the recording that a time in the clip plays; past the end, the last part's end. */
export function recordingTimeAt(parts: Parts, time: number): number {
  let offset = 0;
  for (const [start, end] of parts) {
    if (time <= offset + end - start) return start + Math.max(0, time - offset);
    offset += end - start;
  }
  return parts.at(-1)?.[1] ?? 0;
}

/**
 * The parts run together where one carries straight on from the one before it, as the two halves of a split do, so
 * nothing marks a join that was never a cut.
 */
function runs(parts: Parts): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [start, end] of parts) {
    const last = out.at(-1);
    if (last && last[1] === start) last[1] = end;
    else out.push([start, end]);
  }
  return out;
}

/**
 * The parts' sound end to end. Each join fades out and back in over `fade` seconds, so a cut mid-word doesn't click;
 * a part that carries straight on from the one before it plays on without one, and the clip's own start and end are
 * left as they are.
 */
export function stitch(samples: Float32Array, sampleRate: number, parts: Parts, fade = 0.15): Float32Array {
  return joinParts(runs(parts).map(([start, end]) => samples.subarray(Math.max(0, Math.round(start * sampleRate)), Math.min(samples.length, Math.round(end * sampleRate)))), sampleRate, fade);
}

/** Pieces of sound end to end, each join faded out and back in over `fade` seconds; the ends are left as they are. */
export function joinParts(pieces: Float32Array[], sampleRate: number, fade = 0.15): Float32Array {
  const out = new Float32Array(pieces.reduce((sum, piece) => sum + piece.length, 0));
  let at = 0;
  pieces.forEach((piece, index) => {
    out.set(piece, at);
    const ramp = Math.min(Math.round(fade * sampleRate), Math.floor(piece.length / 2));
    for (let i = 0; i < ramp; i++) {
      if (index > 0) out[at + i] *= i / ramp;
      if (index < pieces.length - 1) out[at + piece.length - 1 - i] *= i / ramp;
    }
    at += piece.length;
  });
  return out;
}

/** Reads one channel of a recording from `start` to `end` seconds at `sampleRate`, the way an AudioSource does. */
export type Reader = (start: number, end: number, sampleRate: number) => Promise<Float32Array>;

/** Recordings laid end to end on one timeline: each starts `offset` seconds in, lasts `duration`, and reads in its own time. */
export type Reel = ReadonlyArray<{ readonly offset: number; readonly duration: number; readonly read: Reader }>;

/**
 * One channel of the reel from `start` to `end` seconds at `sampleRate`: each recording under that stretch read in its
 * own time and put where it sits, with silence where no recording is.
 */
export async function readReel(reel: Reel, start: number, end: number, sampleRate: number): Promise<Float32Array> {
  // Counted in whole samples from the reel's start, so recordings end to end meet without a gap or an overlap.
  const first = Math.round(start * sampleRate);
  const out = new Float32Array(Math.max(0, Math.round(end * sampleRate) - first));
  const last = first + out.length;
  for (const { offset, duration, read } of reel) {
    const head = Math.round(offset * sampleRate);
    const lo = Math.max(first, head);
    const hi = Math.min(last, Math.round((offset + duration) * sampleRate));
    if (hi <= lo) continue;
    const piece = await read((lo - head) / sampleRate, (hi - head) / sampleRate, sampleRate);
    out.set(piece.subarray(0, hi - lo), lo - first);
  }
  return out;
}

/**
 * The clip's sound from `from` to `to` seconds into it, read from just the parts of the recording under that window,
 * and the same, sample for sample, as that stretch of the parts joined whole with `stitch`. A long clip is read this
 * way a window at a time, so it never has to be held in memory at once; past either end of the clip is silence.
 */
export async function readClip(read: Reader, parts: Parts, from: number, to: number, sampleRate: number, fade = 0.15): Promise<Float32Array> {
  // Counted in whole samples, as joinParts counts them, so windows read one after another line up exactly.
  const first = Math.round(from * sampleRate);
  const out = new Float32Array(Math.max(0, Math.round(to * sampleRate) - first));
  const last = first + out.length;
  const list = runs(parts);
  let at = 0;
  for (const [index, [start, end]] of list.entries()) {
    const head = Math.round(start * sampleRate);
    const length = Math.max(0, Math.round(end * sampleRate) - head);
    const lo = Math.max(first, at);
    const hi = Math.min(last, at + length);
    if (hi > lo) {
      const piece = await read((head + lo - at) / sampleRate, (head + hi - at) / sampleRate, sampleRate);
      const ramp = Math.min(Math.round(fade * sampleRate), Math.floor(length / 2));
      for (let i = 0; i < hi - lo && i < piece.length; i++) {
        const into = lo - at + i;
        let gain = 1;
        if (index > 0 && into < ramp) gain *= into / ramp;
        if (index < list.length - 1 && length - 1 - into < ramp) gain *= (length - 1 - into) / ramp;
        out[lo - first + i] = piece[i] * gain;
      }
    }
    at += length;
    if (at >= last) break;
  }
  return out;
}

/** The captions of each part, cut to it and moved to where the part sits in the clip. */
export function stitchCues(cues: readonly Cue[], parts: Parts): Cue[] {
  const out: Cue[] = [];
  let offset = 0;
  for (const [start, end] of parts) {
    for (const cue of clip(cues, start, end)) {
      out.push({
        ...cue,
        start: cue.start + offset,
        end: cue.end + offset,
        words: cue.words?.map((word) => ({ ...word, start: word.start + offset, end: word.end + offset })),
      });
    }
    offset += end - start;
  }
  return out;
}
