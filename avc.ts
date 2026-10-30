/* H.264 settings for a frame size and rate: the codec strings to try, and a bitrate that keeps the picture clean. Free
   of the DOM, so it can be tested on its own. */

// The levels a clip can need, each with the most macroblocks a frame may have and a second may carry (H.264, A-1).
const LEVELS: Array<[hex: string, frame: number, second: number]> = [
  ["28", 8192, 245_760], // 4.0
  ["2A", 8704, 522_240], // 4.2
  ["32", 22_080, 589_824], // 5.0
  ["33", 36_864, 983_040], // 5.1
  ["34", 36_864, 2_073_600], // 5.2
];

/** The codec strings for a `width` by `height` clip at `fps`, Baseline, Main and High, at the lowest level that fits. */
export function avcCodecs(width: number, height: number, fps: number): string[] {
  const blocks = Math.ceil(width / 16) * Math.ceil(height / 16);
  const level = LEVELS.find(([, frame, second]) => blocks <= frame && blocks * fps <= second) ?? LEVELS[LEVELS.length - 1];
  return ["42E0", "4D40", "6400"].map((profile) => `avc1.${profile}${level[0]}`);
}

/** Bits a second for the picture: 5 Mb/s for a 1080 by 1080 frame at 30 fps, more for a bigger one or a faster rate. */
export function videoBitrate(width: number, height: number, fps: number): number {
  const bits = 5_000_000 * ((width * height) / (1080 * 1080)) * (fps > 30 ? 1.5 : 1);
  return Math.max(1_500_000, Math.round(bits / 100_000) * 100_000);
}
