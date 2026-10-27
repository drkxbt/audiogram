/* Sound as numbers to draw: the outline of a whole recording, how loud it is from moment to moment, and how that
   loudness spreads from low pitches to high. Free of the DOM, so it can be tested on its own. */

/** The lowest and highest sample in each of `buckets` equal slices of `samples[start, end)`, as min, max pairs:
 *  enough to draw the outline of a recording at any width. */
export function peaks(samples: Float32Array, buckets: number, start = 0, end = samples.length): Float32Array {
  const out = new Float32Array(buckets * 2);
  const span = Math.max(0, end - start) / buckets;
  for (let bucket = 0; bucket < buckets; bucket++) {
    const from = Math.floor(start + bucket * span);
    const to = Math.min(end, Math.max(from + 1, Math.floor(start + (bucket + 1) * span)));
    let low = 0;
    let high = 0;
    for (let i = from; i < to; i++) {
      const value = samples[i];
      if (value < low) low = value;
      if (value > high) high = value;
    }
    out[bucket * 2] = low;
    out[bucket * 2 + 1] = high;
  }
  return out;
}

/** Root-mean-square loudness of `samples[from, to)`, from 0 for silence to 1 for a full-scale square wave. */
export function rms(samples: Float32Array, from: number, to: number): number {
  from = Math.max(0, Math.floor(from));
  to = Math.min(samples.length, Math.floor(to));
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (to - from));
}

/** An in-place radix-2 FFT. Both arrays have the same length, a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n & (n - 1)) throw new Error("FFT length must be a power of two");
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const stepRe = Math.cos(angle);
    const stepIm = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k;
        const b = a + size / 2;
        const tRe = re[b] * wRe - im[b] * wIm;
        const tIm = re[b] * wIm + im[b] * wRe;
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const next = wRe * stepRe - wIm * stepIm;
        wIm = wRe * stepIm + wIm * stepRe;
        wRe = next;
      }
    }
  }
}

export interface SpectrumOptions {
  /** Samples in the window; a power of two. */
  size?: number;
  bands?: number;
  /** The pitch range the bands cover, in hertz, spaced evenly on a log scale as ears hear them. */
  low?: number;
  high?: number;
  /** The loudness, in decibels, that reads as empty and as full. */
  floor?: number;
  ceiling?: number;
}

/** How loud each pitch band is in a window of samples around `center`, from 0 to 1. */
export function spectrum(samples: Float32Array, sampleRate: number, center: number, options: SpectrumOptions = {}): Float32Array {
  const { size = 2048, bands = 32, low = 80, high = 8000, floor = -72, ceiling = -12 } = options;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const from = Math.floor(center - size / 2);
  for (let i = 0; i < size; i++) {
    const index = from + i;
    // A Hann window, so the edges of the slice don't smear into every band.
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    re[i] = index >= 0 && index < samples.length ? samples[index] * window : 0;
  }
  fft(re, im);
  const out = new Float32Array(bands);
  const top = Math.min(high, sampleRate / 2);
  const binOf = (hz: number) => (hz * size) / sampleRate;
  for (let band = 0; band < bands; band++) {
    const fromHz = low * (top / low) ** (band / bands);
    const toHz = low * (top / low) ** ((band + 1) / bands);
    const first = Math.max(1, Math.floor(binOf(fromHz)));
    const last = Math.max(first, Math.min(size / 2 - 1, Math.ceil(binOf(toHz))));
    let power = 0;
    for (let bin = first; bin <= last; bin++) power = Math.max(power, re[bin] * re[bin] + im[bin] * im[bin]);
    // The window halves the energy, and a full-scale sine lands at size / 4 in its own bin.
    const amplitude = Math.sqrt(power) / (size / 4);
    const db = 20 * Math.log10(amplitude + 1e-9);
    out[band] = Math.min(1, Math.max(0, (db - floor) / (ceiling - floor)));
  }
  return out;
}

/** Eases values from one frame to the next the way a level meter moves: quick to rise, slower to fall. */
export class Smoother {
  private last: Float32Array | null = null;

  constructor(
    private readonly attack = 0.65,
    private readonly release = 0.18,
  ) {}

  next(values: Float32Array): Float32Array {
    if (!this.last || this.last.length !== values.length) {
      this.last = Float32Array.from(values);
      return Float32Array.from(values);
    }
    for (let i = 0; i < values.length; i++) {
      const rate = values[i] > this.last[i] ? this.attack : this.release;
      this.last[i] += (values[i] - this.last[i]) * rate;
    }
    return Float32Array.from(this.last);
  }

  reset(): void {
    this.last = null;
  }
}
