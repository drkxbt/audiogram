export interface MusicOptions {
  /** The music's level under the voice, 0 to 1. */
  gain: number;
  /** Seconds the music takes to come in at the start of the clip, and to leave at its end. */
  fadeIn?: number;
  fadeOut?: number;
}

/**
 * The voice with music under it, at the same sample rate. The music loops when it is shorter than the clip, comes in
 * and leaves gently, and the mix is brought down as a whole if it would clip.
 */
export function mixMusic(voice: Float32Array, music: Float32Array, sampleRate: number, { gain, fadeIn = 1, fadeOut = 1.5 }: MusicOptions): Float32Array<ArrayBuffer> {
  const out = new Float32Array(voice.length);
  out.set(voice);
  if (!music.length || gain <= 0) return out;
  const rampIn = Math.round(fadeIn * sampleRate);
  const rampOut = Math.round(fadeOut * sampleRate);
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    let level = gain;
    if (i < rampIn) level *= i / rampIn;
    const left = out.length - 1 - i;
    if (left < rampOut) level *= left / rampOut;
    out[i] += music[i % music.length] * level;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  // Just under full scale, so the AAC encoder has a little room.
  if (peak > 0.98) {
    const scale = 0.98 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= scale;
  }
  return out;
}
