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
 * The parts' sound end to end. Each join fades out and back in over `fade` seconds, so a cut mid-word doesn't click;
 * the clip's own start and end are left as they are.
 */
export function stitch(samples: Float32Array, sampleRate: number, parts: Parts, fade = 0.15): Float32Array {
  const pieces = parts.map(([start, end]) => samples.subarray(Math.max(0, Math.round(start * sampleRate)), Math.min(samples.length, Math.round(end * sampleRate))));
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
