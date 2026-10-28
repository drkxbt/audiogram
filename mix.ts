export interface MusicOptions {
  /** The music's level under the voice, 0 to 1. */
  gain: number;
  /** Seconds the music takes to come in at the start of the clip, and to leave at its end. */
  fadeIn?: number;
  fadeOut?: number;
  /** For a stretch of a longer clip: the sample of the clip the voice starts at. */
  offset?: number;
  /** For a stretch of a longer clip: the clip's whole length in samples, where the music leaves. */
  length?: number;
  /** The level the whole mix is set to. Left out, a mix that would clip is brought down by its own peak; a clip mixed a
   *  stretch at a time is given one scale for all of them, so the level doesn't change from one stretch to the next. */
  scale?: number;
}

/**
 * The voice with music under it, at the same sample rate. The music loops when it is shorter than the clip, comes in
 * and leaves gently, and the mix is brought down as a whole if it would clip.
 */
export function mixMusic(voice: Float32Array, music: Float32Array, sampleRate: number, { gain, fadeIn = 1, fadeOut = 1.5, offset = 0, length, scale }: MusicOptions): Float32Array<ArrayBuffer> {
  const out = new Float32Array(voice.length);
  out.set(voice);
  if (!music.length || gain <= 0) return out;
  const total = length ?? offset + out.length;
  const rampIn = Math.round(fadeIn * sampleRate);
  const rampOut = Math.round(fadeOut * sampleRate);
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    const at = offset + i;
    let level = gain;
    if (at < rampIn) level *= at / rampIn;
    const left = total - 1 - at;
    if (left < rampOut) level *= Math.max(0, left) / rampOut;
    out[i] += music[at % music.length] * level;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  // Just under full scale, so the AAC encoder has a little room.
  const factor = scale ?? (peak > 0.98 ? 0.98 / peak : 1);
  if (factor !== 1) for (let i = 0; i < out.length; i++) out[i] *= factor;
  return out;
}
