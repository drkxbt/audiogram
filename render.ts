import { cueAt, timeWords, type Cue } from "./captions.js";
import { defaultLayers, entranceLength, FRAME_SIZES, motionAt, PHOTO_KEY, UNIT_WAYS, type Adjust, type ClipFrom, type Clock, type Crop, type Layer, type Motion, type Paint, type ShapeKind } from "./layers.js";
import { rms, Smoother, spectrum } from "./wave.js";
import type { PaintEnv } from "./paint-env.js";
import { paintAmbient } from "./paint-ambient.js";
import { paintChart } from "./paint-chart.js";
import { paintMockup } from "./paint-mockup.js";
import { paintPlaceholder } from "./paint-placeholder.js";
import { paintSolid } from "./paint-solid.js";
import { paintTable } from "./paint-table.js";

export type Layout = "square" | "portrait" | "story" | "landscape";
export type Visual = "bars" | "wave" | "pulse" | "ring" | "radial" | "mirror" | "line" | "dots" | "blocks" | "scope";

/** Every sound style, in the order the editor offers them. */
export const VISUALS: Visual[] = ["bars", "wave", "pulse", "ring", "radial", "mirror", "line", "dots", "blocks", "scope"];

/** Video sizes: square and 4:5 for feeds, 9:16 for TikTok, Reels and Shorts, 16:9 for YouTube and LinkedIn. */
export const SIZES: Record<Layout, { width: number; height: number }> = FRAME_SIZES;

export interface Theme {
  name: string;
  background: string;
  /** The bottom of the background's gradient. */
  shade: string;
  text: string;
  muted: string;
  accent: string;
  /** Text on the accent, for the word being said. */
  onAccent: string;
}

export const THEMES: Theme[] = [
  { name: "Ink", background: "#0d0e10", shade: "#1a1c21", text: "#f2f1ec", muted: "#8d8c87", accent: "#2ff0b8", onAccent: "#04392a" },
  { name: "Paper", background: "#f5f4f0", shade: "#e6e3da", text: "#121212", muted: "#6a6b6f", accent: "#121212", onAccent: "#f5f4f0" },
  { name: "Mint", background: "#04392a", shade: "#0b5640", text: "#eafff7", muted: "#8cd3b9", accent: "#2ff0b8", onAccent: "#04392a" },
  { name: "Dusk", background: "#18122b", shade: "#2c2150", text: "#f4f0ff", muted: "#a499c9", accent: "#f0bf2f", onAccent: "#2a1d00" },
  { name: "Ember", background: "#2a0f0b", shade: "#4a1a12", text: "#fff1ea", muted: "#d19c8c", accent: "#ff6a4d", onAccent: "#2a0f0b" },
];

/** A picture that moves: its frames, and the second each one ends; it loops from the start after the last. */
export interface Animation {
  frames: CanvasImageSource[];
  ends: number[];
}

/** The page behind every layer: one colour, or a gradient from it to `to` at `angle` degrees (180 runs top to bottom). */
export interface Page {
  color: string;
  to?: string;
  angle?: number;
}

export interface Scene {
  layout: Layout;
  visual: Visual;
  theme: Theme;
  /** What the clip is from, such as the Space's title. */
  title: string;
  speaker: string;
  handle: string;
  cover: CanvasImageSource | null;
  /** In seconds from the start of the clip. */
  captions: Cue[];
  /**
   * The recording as one mono channel, and the stretch of it the clip covers, in seconds. For a clip too long to hold,
   * `samples` can be just a window of it, `start` placing the window, with `read` giving any stretch of the clip's
   * sound (in seconds from the clip's start) for the export.
   */
  audio: { samples: Float32Array; sampleRate: number; start: number; end: number; read?: (from: number, to: number) => Promise<Float32Array> };
  font?: string;
  /** Drawn over every frame, last, in the preview and the export alike. */
  overlay?: Overlay;
  /** A picture behind the whole frame, dimmed under the theme's colours so the words stay readable. */
  backdrop?: CanvasImageSource | null;
  /** A brand mark, small in the top left margin. */
  logo?: CanvasImageSource | null;
  /** Music for the export's sound only, at the clip's sample rate; the picture follows the voice alone. */
  music?: { samples: Float32Array; gain: number } | null;
  /** Where to find the speaker, up to three, written small along the bottom. */
  links?: string[];
  /** The frame as layers, bottom first; the classic layout for the shape when left out. */
  layers?: Layer[];
  /** The pictures and videos image and video layers show, by key. */
  images?: Map<string, CanvasImageSource>;
  /** Pictures that move, such as stickers, by the same keys: drawn a frame at a time from the clip's time, so the
   *  preview and the export show the same frame at the same moment. */
  animations?: Map<string, Animation>;
  /** The page's own colour; the theme's gradient when left out. */
  page?: Page | null;
}

/** Where a frame is, for an overlay: seconds into the clip, the canvas's size, and one design pixel at this size. */
export interface OverlayFrame {
  time: number;
  duration: number;
  width: number;
  height: number;
  unit: number;
  theme: Theme;
  font: string;
}

export type Overlay = (ctx: CanvasRenderingContext2D, frame: OverlayFrame) => void;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const FONT = "Geist, ui-sans-serif, system-ui, sans-serif";

/** Whole seconds as m:ss, or h:mm:ss from an hour up. */
export function clock(seconds: number): string {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const ss = String(whole % 60).padStart(2, "0");
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${ss}` : `${minutes}:${ss}`;
}

/** The clip's time as a time layer shows it, `time` seconds into a clip `duration` seconds long. */
function clockText(format: Clock | undefined, time: number, duration: number): string {
  const at = Math.min(duration, Math.max(0, time));
  if (format === "elapsed") return clock(at);
  // Counted down from the length in whole seconds, so the time played and the time left add up to the length shown.
  if (format === "remaining") return `-${clock(Math.max(0, Math.round(duration) - Math.floor(at)))}`;
  if (format === "percent") return `${duration > 0 ? Math.round((at / duration) * 100) : 0}%`;
  return `${clock(at)} / ${clock(Math.round(duration))}`;
}

/** Breaks text into lines no wider than `maxWidth` in the current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** The outline of a shape filling a box, as the current path. */
export function shapePath(ctx: CanvasRenderingContext2D, shape: ShapeKind | undefined, box: Box, radius: number) {
  const { x, y, width: w, height: h } = box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.beginPath();
  if (shape === "ellipse") {
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (shape === "triangle") {
    ctx.moveTo(cx, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  } else if (shape === "diamond") {
    ctx.moveTo(cx, y);
    ctx.lineTo(x + w, cy);
    ctx.lineTo(cx, y + h);
    ctx.lineTo(x, cy);
    ctx.closePath();
  } else if (shape === "star") {
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const reach = i % 2 ? 0.4 : 1;
      const px = cx + Math.cos(angle) * (w / 2) * reach;
      const py = cy + Math.sin(angle) * (h / 2) * reach + h * 0.05;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === "heart") {
    ctx.moveTo(cx, y + h);
    ctx.bezierCurveTo(x - w * 0.05, y + h * 0.6, x, y + h * 0.05, cx - w * 0.25, y + h * 0.05);
    ctx.bezierCurveTo(cx - w * 0.08, y + h * 0.05, cx, y + h * 0.18, cx, y + h * 0.28);
    ctx.bezierCurveTo(cx, y + h * 0.18, cx + w * 0.08, y + h * 0.05, cx + w * 0.25, y + h * 0.05);
    ctx.bezierCurveTo(x + w, y + h * 0.05, x + w * 1.05, y + h * 0.6, cx, y + h);
    ctx.closePath();
  } else if (shape === "arrow") {
    const shaft = h * 0.36;
    const head = Math.min(w * 0.45, h);
    ctx.moveTo(x, cy - shaft / 2);
    ctx.lineTo(x + w - head, cy - shaft / 2);
    ctx.lineTo(x + w - head, y);
    ctx.lineTo(x + w, cy);
    ctx.lineTo(x + w - head, y + h);
    ctx.lineTo(x + w - head, cy + shaft / 2);
    ctx.lineTo(x, cy + shaft / 2);
    ctx.closePath();
  } else if (shape === "pentagon" || shape === "hexagon" || shape === "octagon") {
    const sides = shape === "pentagon" ? 5 : shape === "hexagon" ? 6 : 8;
    // An octagon sits on a flat side; the others stand on a corner's opposite, their first point straight up.
    const turn = shape === "octagon" ? Math.PI / 8 : 0;
    for (let i = 0; i < sides; i++) {
      const angle = -Math.PI / 2 + turn + (i * 2 * Math.PI) / sides;
      const px = cx + Math.cos(angle) * (w / 2);
      const py = cy + Math.sin(angle) * (h / 2);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === "cross") {
    const a = w / 3;
    const b = h / 3;
    ctx.moveTo(x + a, y);
    ctx.lineTo(x + 2 * a, y);
    ctx.lineTo(x + 2 * a, y + b);
    ctx.lineTo(x + w, y + b);
    ctx.lineTo(x + w, y + 2 * b);
    ctx.lineTo(x + 2 * a, y + 2 * b);
    ctx.lineTo(x + 2 * a, y + h);
    ctx.lineTo(x + a, y + h);
    ctx.lineTo(x + a, y + 2 * b);
    ctx.lineTo(x, y + 2 * b);
    ctx.lineTo(x, y + b);
    ctx.lineTo(x + a, y + b);
    ctx.closePath();
  } else if (shape === "parallelogram") {
    const lean = w * 0.25;
    ctx.moveTo(x + lean, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - lean, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  } else if (shape === "arch") {
    // A doorway: straight sides and a round top.
    const rise = Math.min(w / 2, h);
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + rise);
    ctx.ellipse(cx, y + rise, w / 2, rise, 0, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  } else if (shape === "burst") {
    // A starburst badge: sixteen short points round the edge.
    for (let i = 0; i < 32; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 16;
      const reach = i % 2 ? 0.8 : 1;
      const px = cx + Math.cos(angle) * (w / 2) * reach;
      const py = cy + Math.sin(angle) * (h / 2) * reach;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === "sparkle") {
    // Four points drawn in to the middle along soft curves, as light catches on something.
    const k = 0.12;
    ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(cx + w * k, cy - h * k, x + w, cy);
    ctx.quadraticCurveTo(cx + w * k, cy + h * k, cx, y + h);
    ctx.quadraticCurveTo(cx - w * k, cy + h * k, x, cy);
    ctx.quadraticCurveTo(cx - w * k, cy - h * k, cx, y);
    ctx.closePath();
  } else if (shape === "squircle") {
    // Between a square and a circle: a superellipse of power four.
    for (let i = 0; i <= 48; i++) {
      const angle = (i / 48) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const px = cx + (w / 2) * Math.sign(c) * Math.abs(c) ** 0.5;
      const py = cy + (h / 2) * Math.sign(s) * Math.abs(s) ** 0.5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === "blob") {
    // A soft, uneven round, the same every time: curves through the middle of each pair of points.
    const reach = [1, 0.86, 0.97, 0.8, 0.95, 0.84, 1, 0.82];
    const at = (i: number) => {
      const angle = -Math.PI / 2 + (i / reach.length) * Math.PI * 2;
      const r = reach[i % reach.length];
      return { x: cx + Math.cos(angle) * (w / 2) * r, y: cy + Math.sin(angle) * (h / 2) * r };
    };
    const mid = (i: number) => ({ x: (at(i).x + at(i + 1).x) / 2, y: (at(i).y + at(i + 1).y) / 2 });
    ctx.moveTo(mid(0).x, mid(0).y);
    for (let i = 1; i <= reach.length; i++) ctx.quadraticCurveTo(at(i).x, at(i).y, mid(i).x, mid(i).y);
    ctx.closePath();
  } else if (shape === "ring") {
    // A ring: the inner round runs the other way, so it is left open.
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.moveTo(cx + w * 0.3, cy);
    ctx.ellipse(cx, cy, w * 0.3, h * 0.3, 0, 0, Math.PI * 2, true);
  } else if (shape === "quote") {
    // Two opening quotation marks, each a round with a tail rising from it.
    for (const left of [x + w * 0.04, x + w * 0.54]) {
      const r = Math.min(w * 0.21, h * 0.3);
      const mx = left + w * 0.21;
      const my = y + h * 0.66;
      ctx.moveTo(mx + r, my);
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.moveTo(mx - r * 0.95, my - r * 0.2);
      ctx.quadraticCurveTo(mx - r * 0.9, y + h * 0.08, mx + r * 0.6, y + h * 0.04);
      ctx.lineTo(mx + r * 0.7, y + h * 0.16);
      ctx.quadraticCurveTo(mx - r * 0.1, y + h * 0.22, mx, my - r);
      ctx.closePath();
    }
  } else if (shape === "banner") {
    // A ribbon with a notch cut into each end.
    const notch = Math.min(w * 0.08, h * 0.5);
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - notch, cy);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + notch, cy);
    ctx.closePath();
  } else if (shape === "tag") {
    // A label: pointed at the left, with a hole to thread.
    const point = Math.min(w * 0.22, h * 0.5);
    const r = Math.min(w, h) * 0.08;
    ctx.moveTo(x, cy);
    ctx.lineTo(x + point, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + point, y + h);
    ctx.closePath();
    ctx.moveTo(x + point * 0.85 + r, cy);
    ctx.arc(x + point * 0.85, cy, r, 0, Math.PI * 2, true);
  } else if (shape === "chevron") {
    const t = Math.min(w, h) * 0.32;
    ctx.moveTo(x, y);
    ctx.lineTo(x + t, y);
    ctx.lineTo(x + w, cy);
    ctx.lineTo(x + t, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w - t, cy);
    ctx.closePath();
  } else if (shape === "cloud") {
    // Rounds of a few sizes along a flat base, all drawn the same way, so they fill as one.
    const puffs: Array<[number, number, number]> = [[0.27, 0.62, 0.22], [0.47, 0.45, 0.28], [0.7, 0.55, 0.22], [0.84, 0.7, 0.15], [0.15, 0.74, 0.14]];
    for (const [px, py, pr] of puffs) {
      ctx.moveTo(x + w * px + w * pr, y + h * py);
      ctx.ellipse(x + w * px, y + h * py, w * pr, h * pr * 1.25, 0, 0, Math.PI * 2);
    }
    ctx.rect(x + w * 0.15, y + h * 0.62, w * 0.69, h * 0.26);
  } else if (shape === "moon") {
    // A crescent: the outer edge round one way, the inner bite round the other.
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, Math.PI * 0.5, Math.PI * 1.5);
    ctx.ellipse(cx + w * 0.12, cy, w * 0.36, h * 0.5, 0, Math.PI * 1.5, Math.PI * 0.5, true);
    ctx.closePath();
  } else if (shape === "check") {
    const t = Math.min(w, h) * 0.18;
    ctx.moveTo(x, y + h * 0.55);
    ctx.lineTo(x + t, y + h * 0.55 - t);
    ctx.lineTo(x + w * 0.38, y + h - t * 1.9);
    ctx.lineTo(x + w - t, y);
    ctx.lineTo(x + w, y + t);
    ctx.lineTo(x + w * 0.38, y + h);
    ctx.closePath();
  } else if (shape === "bubble") {
    // A rounded box with a tail from its lower left.
    const body = h * 0.8;
    const r = Math.min(w, body) * 0.22;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + body, r);
    ctx.arcTo(x + w, y + body, x, y + body, r);
    ctx.lineTo(x + w * 0.34, y + body);
    ctx.lineTo(x + w * 0.16, y + h);
    ctx.lineTo(x + w * 0.2, y + body);
    ctx.arcTo(x, y + body, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  } else {
    roundRect(ctx, x, y, w, h, radius);
  }
}

/** Ready-made looks for a picture, as canvas filters, by name. */
export const FILTERS: Record<string, string> = {
  vivid: "saturate(1.45) contrast(1.08)",
  warm: "sepia(0.22) saturate(1.25) brightness(1.03)",
  cool: "saturate(1.1) hue-rotate(-14deg) brightness(1.02)",
  fade: "contrast(0.82) brightness(1.1) saturate(0.78)",
  retro: "sepia(0.48) contrast(1.12) saturate(1.3)",
  dramatic: "contrast(1.42) saturate(1.18) brightness(0.92)",
  mono: "grayscale(1) contrast(1.08)",
  noir: "grayscale(1) contrast(1.55) brightness(0.9)",
  // One tone each, like a toned print: warm gold as through a foggy sunrise, a cool blue-grey, and a soft grey whose
  // blacks are lifted.
  amber: "grayscale(1) sepia(1) hue-rotate(6deg) saturate(1.4) contrast(0.86) brightness(1.06)",
  slate: "grayscale(1) sepia(0.5) hue-rotate(175deg) saturate(0.9) contrast(0.94) brightness(1.02)",
  ash: "grayscale(1) contrast(0.78) brightness(1.1)",
};

/** A border's dashes for its width: none, long dashes, or round dots. */
export function dashFor(ctx: CanvasRenderingContext2D, dash: Layer["dash"], width: number) {
  if (dash === "dashed") ctx.setLineDash([width * 3, width * 2]);
  else if (dash === "dotted") {
    ctx.lineCap = "round";
    ctx.setLineDash([0.01, width * 2]);
  } else ctx.setLineDash([]);
}

/** A picture's tone as a canvas filter, in pixels of the frame being drawn. */
export function filterOf(adjust: Adjust, unit: number): string {
  const parts: string[] = [];
  if (adjust.brightness !== undefined && adjust.brightness !== 1) parts.push(`brightness(${adjust.brightness})`);
  if (adjust.contrast !== undefined && adjust.contrast !== 1) parts.push(`contrast(${adjust.contrast})`);
  if (adjust.saturation !== undefined && adjust.saturation !== 1) parts.push(`saturate(${adjust.saturation})`);
  if (adjust.blur) parts.push(`blur(${Math.round(adjust.blur * unit * 10) / 10}px)`);
  return parts.join(" ") || "none";
}

/** A canvas `width` by `height` to draw on off screen, or null where none can be made. */
function newCanvas(width: number, height: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D } | null {
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : typeof document !== "undefined" ? Object.assign(document.createElement("canvas"), { width, height }) : null;
  const ctx = canvas?.getContext("2d") as CanvasRenderingContext2D | null | undefined;
  return canvas && ctx ? { canvas, ctx } : null;
}

/**
 * Draws `area` of `source` into the top left of `target`, blurred by `radius` pixels. Where the canvas has no filters
 * (older Safari) it is shrunk to a few pixels and drawn back up instead, which softens it about as much.
 */
function blurInto(target: CanvasRenderingContext2D, source: HTMLCanvasElement | OffscreenCanvas, area: Box, radius: number, spare: (name: "edge" | "small", width: number, height: number) => CanvasRenderingContext2D | null): boolean {
  // A blur reads about two and a half times its radius round each pixel, and past the source's edge there is nothing
  // to read: glass touching the frame's edge would fade to clear there and show the sharp picture under it. Where the
  // area meets that edge its last pixels are stretched out that far first; elsewhere the caller copied real ones.
  const reach = Math.ceil(radius * 2.5);
  const left = area.x <= 0 ? reach : 0;
  const top = area.y <= 0 ? reach : 0;
  const right = area.x + area.width >= source.width ? reach : 0;
  const bottom = area.y + area.height >= source.height ? reach : 0;
  let from: CanvasImageSource = source;
  let whole: Box = area;
  if (left || top || right || bottom) {
    whole = { x: 0, y: 0, width: area.width + left + right, height: area.height + top + bottom };
    const edge = spare("edge", whole.width, whole.height);
    if (!edge) return false;
    // The area in the middle, its edge columns and rows stretched across the sides, its corner pixels over the corners.
    // Unsmoothed, so a stretched pixel stays its own colour rather than blending with the clear canvas round it.
    edge.imageSmoothingEnabled = false;
    const columns = [[area.x, 1, 0, left], [area.x, area.width, left, area.width], [area.x + area.width - 1, 1, left + area.width, right]];
    const rows = [[area.y, 1, 0, top], [area.y, area.height, top, area.height], [area.y + area.height - 1, 1, top + area.height, bottom]];
    for (const [sx, sw, dx, dw] of columns) for (const [sy, sh, dy, dh] of rows) if (dw > 0 && dh > 0) edge.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    edge.imageSmoothingEnabled = true;
    from = edge.canvas;
  }
  // Without filters the property is missing from the context's prototype; an own one would only be a leftover value.
  if ("filter" in Object.getPrototypeOf(target)) {
    // All of it is blurred, so the stretched edges are read; only the area itself lands in the top left.
    target.filter = `blur(${Math.round(radius * 10) / 10}px)`;
    target.drawImage(from, whole.x, whole.y, whole.width, whole.height, -left, -top, whole.width, whole.height);
    target.filter = "none";
    return true;
  }
  // Shrunk by twice the radius and stretched back, a picture comes out about as soft as a blur of that radius.
  const step = Math.max(2, radius * 2);
  const width = Math.max(1, Math.round(whole.width / step));
  const height = Math.max(1, Math.round(whole.height / step));
  const tiny = spare("small", width, height);
  if (!tiny) return false;
  tiny.imageSmoothingEnabled = true;
  tiny.imageSmoothingQuality = "high";
  tiny.drawImage(from, whole.x, whole.y, whole.width, whole.height, 0, 0, width, height);
  target.imageSmoothingEnabled = true;
  target.imageSmoothingQuality = "high";
  target.drawImage(tiny.canvas, 0, 0, width, height, -left, -top, whole.width, whole.height);
  return true;
}

/** A linear gradient across a box at a CSS angle: 90 runs left to right, 180 top to bottom. */
function gradientAt(ctx: CanvasRenderingContext2D, width: number, height: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  return ctx.createLinearGradient(width / 2 - dx * half, height / 2 - dy * half, width / 2 + dx * half, height / 2 + dy * half);
}

function sizeOf(source: CanvasImageSource): { width: number; height: number } {
  const item = source as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number; width?: number | { baseVal: { value: number } }; height?: number | { baseVal: { value: number } } };
  const width = item.naturalWidth || item.videoWidth || (typeof item.width === "number" ? item.width : 0);
  const height = item.naturalHeight || item.videoHeight || (typeof item.height === "number" ? item.height : 0);
  return { width, height };
}

/**
 * Draws a picture over a whole box, filling it the way object-fit: cover does; a crop zooms in further and moves the
 * picture within what spills over, -1 showing its left or top edge and 1 its right or bottom.
 */
export function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource, box: Box, crop?: Crop) {
  const size = sizeOf(image);
  if (!size.width || !size.height) return;
  const scale = Math.max(box.width / size.width, box.height / size.height) * Math.max(1, crop?.zoom ?? 1);
  const width = size.width * scale;
  const height = size.height * scale;
  const x = box.x - (width - box.width) * (0.5 + Math.max(-1, Math.min(1, crop?.x ?? 0)) / 2);
  const y = box.y - (height - box.height) * (0.5 + Math.max(-1, Math.min(1, crop?.y ?? 0)) / 2);
  ctx.drawImage(image, x, y, width, height);
}

/** Draws a picture into a circle, filling it the way object-fit: cover does. */
function drawCircle(ctx: CanvasRenderingContext2D, image: CanvasImageSource, cx: number, cy: number, radius: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  drawCover(ctx, image, { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 });
  ctx.restore();
}

/**
 * Metal finishes a layer can take in place of a colour, by name: light caught across polished gold, silver and the
 * like, drawn as a gradient over the layer's box. `base` stands in where one flat colour is needed, such as a swatch.
 */
export const METALS: Record<string, { name: string; base: string; stops: string[] }> = {
  "metal:gold": { name: "Gold", base: "#d4af37", stops: ["#7d5a1b", "#c99a3c", "#f6e19a", "#fff6cf", "#d7ac4a", "#8f6823", "#e8c66d"] },
  "metal:rose": { name: "Rose gold", base: "#d29a88", stops: ["#7f4639", "#c98371", "#f3c7b6", "#fff0e8", "#d6998a", "#8e5446", "#ebb7a6"] },
  "metal:silver": { name: "Silver", base: "#c0c4ca", stops: ["#5e6268", "#a7adb4", "#e6e9ec", "#ffffff", "#b9bfc5", "#6c7076", "#d9dde1"] },
  "metal:bronze": { name: "Bronze", base: "#b0773b", stops: ["#4f2f12", "#99632d", "#d9a466", "#f3cf98", "#ad773d", "#5c3816", "#c9904f"] },
  "metal:champagne": { name: "Champagne", base: "#e3d2a8", stops: ["#8e7a55", "#cdb98d", "#f1e6c6", "#fffaea", "#d8c69c", "#9b8762", "#ece0bc"] },
};

/** A metal finish as a CSS gradient, for a swatch or a key showing it. */
export function metalCss(paint: string, angle = 120): string | null {
  const metal = METALS[paint];
  return metal ? `linear-gradient(${angle}deg, ${metal.stops.map((stop, index) => `${stop} ${Math.round((index / (metal.stops.length - 1)) * 100)}%`).join(", ")})` : null;
}

/** A layer's colour as CSS: one of the theme's by name, or its own; a metal gives its middle tone. */
export function paintOf(paint: Paint | undefined, theme: Theme, fallback: "text" | "muted" | "accent"): string {
  const key = paint ?? fallback;
  if (METALS[key]) return METALS[key].base;
  return key === "text" || key === "muted" || key === "accent" || key === "onAccent" || key === "background" ? theme[key] : key;
}

/** A layer's colour ready to fill or stroke with across `box`: a metal becomes its gradient, catching the light from the
 *  top left; any other colour is as paintOf gives it. */
export function fillOf(ctx: CanvasRenderingContext2D, paint: Paint | undefined, theme: Theme, fallback: "text" | "muted" | "accent", box: Box): string | CanvasGradient {
  const metal = METALS[paint ?? ""];
  if (!metal) return paintOf(paint, theme, fallback);
  const gradient = ctx.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
  metal.stops.forEach((stop, index) => gradient.addColorStop(index / (metal.stops.length - 1), stop));
  return gradient;
}

/** The canvas font for a text layer, its own family first and the scene's after it. */
export function fontOf(layer: Layer, family: string, unit: number, weight = 400): string {
  // Kept to a hundredth of a pixel, not a whole one: rounded, words set for a smaller export ran wider than at full size
  // and broke onto a line the box had no room for.
  const size = Math.round((layer.size ?? 40) * unit * 100) / 100;
  return `${layer.italic ? "italic " : ""}${layer.weight ?? weight} ${size}px ${layer.font ? `"${layer.font}", ${family}` : family}`;
}

/** Black or white, whichever reads better on a colour given as #rrggbb. */
export function inkOn(color: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return "#111111";
  const value = parseInt(match[1], 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.4 ? "#111111" : "#ffffff";
}

/** The lines a text layer's words fall into at its width, a new line typed counting as one. */
function textLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  // A sliver of slack: glyphs measure a little wider or narrower at each size, and a line that just fits in the editor
  // must still fit in an export drawn at another size.
  return text.split("\n").flatMap((part) => (part.trim() ? wrap(ctx, part, width * 1.015) : [""]));
}

/** A line ended with an ellipsis, to say words follow that there is no room for: as much of it as fits `width` with the
 *  ellipsis after, whole words first. */
function cutShort(ctx: CanvasRenderingContext2D, line: string, width: number): string {
  // A comma or a stop before the ellipsis reads as a typo.
  const end = (text: string) => text.replace(/[\s,.;:!?–—-]+$/u, "");
  let kept = end(line);
  while (kept && ctx.measureText(`${kept}…`).width > width) {
    const space = kept.lastIndexOf(" ");
    kept = end(space > 0 ? kept.slice(0, space) : [...kept].slice(0, -1).join(""));
  }
  return `${kept}…`;
}

/** Words as a layer shows them: in capitals when it says so, each line typed a bullet or a number of a list. */
/**
 * The scene a design's preview tile is painted from: the design as it comes, on the editor's recording and fonts, with
 * none of the user's own picture, logo, background, words, links, uploads or captions, so the tile stays a sample
 * whatever has been imported. `thumbs` are the library photos the design itself asks for.
 */
export function templatePreview(base: Scene, made: { layers: Layer[]; page?: Page | null; theme?: number }, thumbs: Array<[string, CanvasImageSource]>): Scene {
  return {
    ...base,
    title: "",
    speaker: "",
    handle: "",
    links: [],
    cover: null,
    logo: null,
    backdrop: null,
    captions: [],
    images: new Map(thumbs),
    overlay: undefined,
    layers: made.layers,
    page: made.page,
    theme: made.theme !== undefined ? THEMES[made.theme] ?? base.theme : base.theme,
  };
}

export function shownText(layer: Layer, text: string): string {
  let shown = layer.uppercase ? text.toLocaleUpperCase() : text;
  if (layer.list) {
    let count = 0;
    shown = shown.split("\n").map((line) => (line.trim() ? (layer.list === "number" ? `${++count}. ` : "• ") + line : line)).join("\n");
  }
  return shown;
}

/** The canvas's font and letter spacing for a text layer at a size. */
function typeset(ctx: CanvasRenderingContext2D, layer: Layer, family: string, unit: number, weight = 400) {
  ctx.font = fontOf(layer, family, unit, weight);
  // Thousandths of the font size, as design tools count it; a browser without letterSpacing leaves it out.
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = layer.letterSpacing ? `${Math.round((layer.letterSpacing / 1000) * (layer.size ?? 40) * unit * 100) / 100}px` : "0px";
}

/** How tall a text layer's words stand, as a share of the frame's height, at the frame's size. */
export function textHeight(ctx: CanvasRenderingContext2D, layer: Layer, text: string, family: string, width: number, height: number): number {
  const unit = Math.min(width, height) / 1080;
  // Measured in the weight the painter sets them in, so a bold title wraps here where it wraps on the picture.
  typeset(ctx, layer, family, unit, layer.kind === "title" ? 700 : 400);
  const shown = shownText(layer, text);
  // Words in a box that hugs them only break where a line was typed.
  const count = layer.autoWidth ? shown.split("\n").length : textLines(ctx, shown, layer.w * width).length;
  return (Math.max(1, count) * (layer.size ?? 40) * unit * (layer.lineHeight ?? 1.15)) / height;
}

/** How wide a text layer's longest typed line runs, as a share of the frame's width, without the space letter spacing
 *  leaves after its last letter. */
export function textWidth(ctx: CanvasRenderingContext2D, layer: Layer, text: string, family: string, width: number, height: number): number {
  const unit = Math.min(width, height) / 1080;
  typeset(ctx, layer, family, unit);
  const trail = layer.letterSpacing ? (layer.letterSpacing / 1000) * (layer.size ?? 40) * unit : 0;
  const widest = Math.max(0, ...shownText(layer, text).split("\n").map((line) => (line ? ctx.measureText(line).width - trail : 0)));
  return widest / width;
}

/**
 * Where a label's words stand in its box, in frame fractions: as the painter lays them out (one line for the
 * single-line kinds, wrapped at the box for the rest, from where they are aligned; captions in the middle of theirs, as
 * many lines as fit), so the editor can outline the words rather than the room the design gives them. Null when there
 * are no words.
 */
export function wordsSpan(ctx: CanvasRenderingContext2D, layer: Layer, text: string, family: string, width: number, height: number): { x: number; y: number; w: number; h: number } | null {
  const shown = shownText(layer, text).trim();
  if (!shown) return null;
  const unit = Math.min(width, height) / 1080;
  const captions = layer.kind === "captions";
  typeset(ctx, layer, family, unit, layer.kind === "title" ? 700 : captions ? 650 : 400);
  const room = layer.w * width;
  let lines = SINGLE_LINE.has(layer.kind) || (layer.kind === "text" && layer.autoWidth) ? shown.split("\n") : textLines(ctx, captions ? shown.replace(/\s+/g, " ") : shown, room);
  let y = layer.y;
  let h = layer.h;
  if (captions) {
    const lineHeight = (layer.size ?? 62) * unit * (layer.lineHeight ?? 1.34);
    lines = lines.slice(0, Math.max(1, Math.floor((layer.h * height) / lineHeight)));
    h = (lines.length * lineHeight) / height;
    y = layer.y + (layer.h - h) / 2;
  }
  // A slanted letter leans out past the width measured for it upright.
  const lean = layer.italic ? (layer.size ?? 40) * unit * 0.2 : 0;
  const widest = Math.min(room, Math.max(0, ...lines.map((line) => ctx.measureText(line).width)) + lean);
  const align = layer.align ?? (captions ? "center" : "left");
  const left = align === "center" ? (room - widest) / 2 : align === "right" ? room - widest : 0;
  return { x: layer.x + left / width, y, w: widest / width, h };
}

const easeOut = (p: number) => 1 - (1 - p) ** 3;
// Past its size and back, the way a letter bursts in: 0 at the start, 1 at the end.
const overshootUnit = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

/** The part of a box uncovered so far, as the current path: from an edge, from the middle line across or down, or as a
 *  circle from the centre. Without `boxed` it reaches well past the box's other sides, so a moving layer isn't cut. */
function uncover(ctx: CanvasRenderingContext2D, box: Box, clip: number, from: ClipFrom, boxed: boolean) {
  const spare = boxed ? 0 : Math.max(box.width, box.height);
  const { x, y, width: w, height: h } = box;
  const share = Math.min(1, Math.max(0, clip));
  if (share >= 1) return ctx.rect(x - spare, y - spare, w + spare * 2, h + spare * 2);
  if (from === "right") return ctx.rect(x + w * (1 - share), y - spare, w * share + spare, h + spare * 2);
  if (from === "top") return ctx.rect(x - spare, y - spare, w + spare * 2, spare + h * share);
  if (from === "bottom") return ctx.rect(x - spare, y + h * (1 - share), w + spare * 2, h * share + spare);
  if (from === "across") return ctx.rect(x + (w / 2) * (1 - share), y - spare, w * share, h + spare * 2);
  if (from === "down") return ctx.rect(x - spare, y + (h / 2) * (1 - share), w + spare * 2, h * share);
  if (from === "iris") return ctx.arc(x + w / 2, y + h / 2, Math.max(0.01, (Math.hypot(w, h) / 2) * share), 0, Math.PI * 2);
  ctx.rect(x - spare, y - spare, spare + w * share, h + spare * 2);
}

// Layers drawn as one line, centred in their box; titles and free text wrap down from the top of theirs.
const SINGLE_LINE = new Set(["name", "handle", "links", "time"]);

// The sound ring: its dots, and how many of the newest lit ones glow as the head of a comet.
const RING_DOTS = 60;
const RING_HEAD = 4;
// How bright an unlit light of the dots and blocks is, so the shape of the meter shows in silence too.
const UNLIT = 0.14;
// A blocks column's peak cap waits this long at the top, in seconds, then falls this share of the box a second.
const CAP_HOLD = 0.35;
const CAP_FALL = 0.5;
// The scope's stretch of sound, in seconds: a few periods of a speaking voice. And how far its line swings for a given
// sample, before it is eased off towards the edge of the box.
const SCOPE_SPAN = 0.03;
const SCOPE_GAIN = 3.2;

/** A band's loudness widened for a meter: a voice keeps most bands between a half and nine tenths full, which would
 *  hold blocks and lights near the top; this lets the quieter bands drop and the loud ones stand out. */
function widen(level: number): number {
  return Math.max(0, (level - 0.25) / 0.75) ** 1.4;
}

/** A smooth line through points, curving through the middle of each pair, so it never strays outside them. */
function smoothThrough(ctx: CanvasRenderingContext2D, xs: ArrayLike<number>, ys: ArrayLike<number>) {
  const last = xs.length - 1;
  ctx.moveTo(xs[0], ys[0]);
  for (let i = 1; i < last; i++) ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2);
  ctx.lineTo(xs[last], ys[last]);
}
// The point a still frame with no clip of its own shows the ring and the clock at: most of the way through a minute,
// so a thumbnail, or a design before there is a recording, reads as the design.
const SAMPLE_LENGTH = 60;
const SAMPLE_SHARE = 0.7;

/**
 * Paints frames of a clip. It keeps a little state from frame to frame, so the bars ease the way a meter does; paint
 * frames in order, and call `reset()` after jumping to another time.
 */
export class Painter {
  // Each sound layer eases on its own, so two of them never share a meter.
  private meters = new Map<string, Smoother>();
  // The blocks' peak caps, kept with the meter they top, so a reset drops both.
  private caps = new WeakMap<Smoother, { levels: Float32Array; since: Float32Array; at: number }>();
  /** The layers this painter draws, bottom first. */
  readonly layers: Layer[];
  /** Whether layers come in and leave at their times, as they do while the clip plays and in the export. Off while
   *  the picture is edited, so every layer shows as it ends up. */
  animate = true;
  /** Whether an empty frame shows where a picture goes, and the captions show a sample when none is near: on only
   *  while the picture is edited, so neither reaches an export. */
  placeholders = false;
  /** The hint on an empty frame, and the words a captions layer shows while there are no captions yet. */
  placeholderText = "";
  captionsSample = "";
  /** Words shown faintly, while the picture is edited, in a title, name or handle that has none yet, so a design's
   *  places for them can be seen and picked. */
  samples: Partial<Record<"title" | "name" | "handle", string>> = {};
  /** Some layers playing one movement on their own while the rest stay still: `at` seconds into their way in, way out
   *  or loop. Set only while the editor shows a movement once; an export never sets it. */
  rehearse: { ids: Set<string>; part: "enter" | "exit" | "loop"; at: number } | null = null;
  /** Whether the ring and every time layer show the same sample point, whatever the time, as there is no clip of its
   *  own to follow: for a template's or an element's thumbnail, and in the editor before a recording is open. */
  sampleProgress = false;

  /** Whether the editing aids show: placeholders asked for, and the picture held still rather than playing. */
  private get editing(): boolean {
    return this.placeholders && !this.animate;
  }
  // A metal outline is laid across the whole text box, not each line, so it is made once per layer.
  private metalStroke: string | CanvasGradient | null = null;

  constructor(public scene: Scene) {
    this.layers = scene.layers ?? defaultLayers(scene.layout);
  }

  reset(): void {
    this.meters.clear();
  }

  private meterFor(id: string): Smoother {
    let meter = this.meters.get(id);
    if (!meter) this.meters.set(id, (meter = new Smoother(0.55, 0.16)));
    return meter;
  }

  /** The clip's length in seconds. */
  get duration(): number {
    return Math.max(0, this.scene.audio.end - this.scene.audio.start);
  }

  /** How far into how long a clip the ring and the clock show at `time`: the playhead, or the sample point. One source
   *  for both, so a lit ring never sits round a clock that says it hasn't started. */
  private progress(time: number): { at: number; length: number } {
    return this.sampleProgress ? { at: SAMPLE_LENGTH * SAMPLE_SHARE, length: SAMPLE_LENGTH } : { at: time, length: this.duration };
  }

  paint(ctx: CanvasRenderingContext2D, time: number): void {
    const { width, height } = ctx.canvas;
    const scene = this.scene;
    const { theme } = scene;
    const font = scene.font ?? FONT;
    const unit = Math.min(width, height) / 1080;

    const page = scene.page;
    let ground: string | CanvasGradient;
    if (page && !page.to) ground = page.color;
    else {
      const gradient = page ? gradientAt(ctx, width, height, page.angle ?? 180) : ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, page?.color ?? theme.background);
      gradient.addColorStop(1, page?.to ?? theme.shade);
      ground = gradient;
    }
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, width, height);
    if (scene.backdrop) {
      drawCover(ctx, scene.backdrop, { x: 0, y: 0, width, height });
      // The page's own colours over the picture, so the name, the visual and the captions read on any of them.
      ctx.globalAlpha = 0.74;
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }

    for (const layer of this.layers) if (!layer.hidden) this.paintLayer(ctx, layer, time, font, unit, width, height);

    // The logo keeps its shape inside the empty margin above the header, which every shape leaves.
    const pad = Math.round(Math.min(width, height) * 0.074);
    const logoSize = scene.logo ? sizeOf(scene.logo) : null;
    if (scene.logo && logoSize?.width && logoSize.height) {
      const scale = Math.min((pad * 0.6) / logoSize.height, (width * 0.3) / logoSize.width);
      const w = logoSize.width * scale;
      const h = logoSize.height * scale;
      ctx.drawImage(scene.logo, pad, (pad - h) / 2, w, h);
    }

    if (scene.overlay) {
      ctx.save();
      scene.overlay(ctx, { time, duration: this.duration, width, height, unit, theme, font });
      ctx.restore();
    }
  }

  /**
   * One layer, drawn in its own frame: the origin at its centre, turned with it, faded by its opacity, and moved by
   * its way in while it comes in. Outside its times it isn't drawn while the clip plays.
   */
  private paintLayer(ctx: CanvasRenderingContext2D, layer: Layer, time: number, font: string, unit: number, width: number, height: number) {
    const motion = this.rehearse?.ids.has(layer.id) ? this.rehearsed(layer, this.rehearse) : motionAt(layer, time, this.animate, this.duration);
    if (!motion) return;
    const w = layer.w * width;
    const h = layer.h * height;
    const box = { x: -w / 2, y: -h / 2, width: w, height: h };
    const { theme } = this.scene;
    const opacity = Math.min(1, Math.max(0, layer.opacity ?? 1));
    ctx.save();
    ctx.globalAlpha = opacity * motion.alpha;
    ctx.translate((layer.x + layer.w / 2) * width, (layer.y + layer.h / 2) * height);
    if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
    // An uncovering shows the layer from an edge, the middle or the centre out, and a baseline holds it inside its box,
    // both where the layer ends up.
    if (motion.clip < 1 || motion.boxed) {
      ctx.beginPath();
      uncover(ctx, box, motion.clip, motion.clipFrom, motion.boxed);
      ctx.clip();
    }
    if (motion.dx || motion.dy) ctx.translate(motion.dx * w, motion.dy * h);
    if (motion.rotate) ctx.rotate((motion.rotate * Math.PI) / 180);
    if (motion.scale !== 1 || motion.sx !== 1) ctx.scale(motion.scale * motion.sx, motion.scale);
    const blur = motion.blur ? `blur(${Math.round(motion.blur * unit * 10) / 10}px)` : "";
    if (blur) ctx.filter = blur;
    // Glass and a shape's shadow go down on the canvas itself, under the shape, whatever else the layer is doing.
    if (layer.kind === "shape" && layer.shape !== "line" && (layer.frost || layer.shadow)) this.paintGlass(ctx, layer, box, unit, motion.alpha);
    const shine = motion.shine !== null ? this.shineCanvas(w, h) : null;
    if (shine) {
      // The layer is drawn on a canvas of its own, so the band of light lands on its letters or shape and nowhere else.
      const spare = shine.spare;
      const own = shine.ctx;
      own.setTransform(1, 0, 0, 1, 0, 0);
      own.globalCompositeOperation = "source-over";
      own.globalAlpha = 1;
      own.filter = "none";
      own.clearRect(0, 0, shine.width, shine.height);
      own.translate(w / 2 + spare, h / 2 + spare);
      this.paintContent(own, layer, box, time, font, unit, motion, "");
      own.setTransform(1, 0, 0, 1, 0, 0);
      own.globalCompositeOperation = "source-atop";
      const span = shine.width + shine.height;
      const at = -span * 0.26 + span * 1.4 * (motion.shine ?? 0);
      const light = own.createLinearGradient(at - span * 0.12, 0, at + span * 0.12, span * 0.18);
      light.addColorStop(0, "rgba(255, 255, 255, 0)");
      light.addColorStop(0.5, "rgba(255, 255, 255, 0.78)");
      light.addColorStop(1, "rgba(255, 255, 255, 0)");
      own.fillStyle = light;
      own.fillRect(0, 0, shine.width, shine.height);
      own.globalCompositeOperation = "source-over";
      ctx.drawImage(shine.canvas as CanvasImageSource, 0, 0, shine.width, shine.height, box.x - spare, box.y - spare, shine.width, shine.height);
    } else this.paintContent(ctx, layer, box, time, font, unit, motion, blur);
    if (motion.block !== null) {
      // A block of colour sweeps across: it grows over the layer, then pulls away to the far side, uncovering it.
      const q = motion.block;
      const ease = (v: number) => 1 - (1 - v) ** 3;
      const start = q < 0.5 ? 0 : ease((q - 0.5) * 2);
      const end = q < 0.5 ? ease(q * 2) : 1;
      ctx.globalAlpha = opacity;
      ctx.filter = "none";
      ctx.fillStyle = paintOf(layer.effectColor, theme, "accent");
      ctx.fillRect(box.x + w * start, box.y, w * Math.max(0, end - start), h);
    }
    ctx.restore();
  }

  /** A layer `at` seconds into its way in, out or loop, as the clip would play it there; settled once it is over. */
  private rehearsed(layer: Layer, { part, at }: NonNullable<Painter["rehearse"]>) {
    const from = layer.from ?? 0;
    const speed = Math.min(4, Math.max(0.25, layer.speed ?? 1));
    // Without a recording the clip has no length yet; the layer is given one long enough to come in, show and go.
    const span = (way: Layer["enter"]) => (way ? entranceLength(way) / speed : 0);
    const length = Math.max(this.duration, from + span(layer.enter) + span(layer.exit) + 3.5);
    const until = layer.until ?? length;
    const time = part === "exit" && layer.exit ? until - span(layer.exit) + at : from + at;
    return motionAt(layer, Math.min(until, Math.max(from, time)), true, length) ?? motionAt(layer, from, false, length)!;
  }

  private shine: { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D; spare: number } | null = null;

  /** A canvas at least the size of a layer and a margin round it, kept between frames, or null where none can be made. */
  private shineCanvas(w: number, h: number) {
    const spare = Math.ceil(Math.max(w, h) * 0.12);
    const width = Math.ceil(w + spare * 2);
    const height = Math.ceil(h + spare * 2);
    if (!this.shine || this.shine.canvas.width < width || this.shine.canvas.height < height) {
      const made = newCanvas(width, height);
      if (!made) return null;
      this.shine = { ...made, spare };
    }
    return { ...this.shine, spare, width, height };
  }

  /** The canvases glass and shadows draw through, kept between frames. A host that makes a new painter for every change
   *  (each step of a drag) hands them all one store, so they reuse these instead of making new ones each time. */
  scratches = new Map<string, { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D }>();

  /** A canvas kept between frames under `name`, at least `width` by `height`, cleared and set back to plain drawing;
   *  null where none can be made. */
  private scratch(name: string, width: number, height: number): CanvasRenderingContext2D | null {
    let kept = this.scratches.get(name);
    if (!kept || kept.canvas.width < width || kept.canvas.height < height) {
      const made = newCanvas(Math.max(width, kept?.canvas.width ?? 0), Math.max(height, kept?.canvas.height ?? 0));
      if (!made) return null;
      this.scratches.set(name, (kept = made));
    }
    const own = kept.ctx;
    own.setTransform(1, 0, 0, 1, 0, 0);
    own.globalAlpha = 1;
    own.globalCompositeOperation = "source-over";
    own.shadowColor = "transparent";
    own.clearRect(0, 0, width, height);
    return own;
  }

  /**
   * What a shape lays down before its fill: a soft shadow, outside its outline only so a see-through fill stays clear,
   * and for frosted glass a blurred copy of everything painted under it so far, cut to its outline. Only the shape's
   * own box, and the margin a blur reaches, is copied. Both follow the layer's movement in `fade`; the glass leaves out
   * the layer's opacity, which is there to set how strongly the fill tints it.
   */
  private paintGlass(ctx: CanvasRenderingContext2D, layer: Layer, box: Box, unit: number, fade: number) {
    const m = ctx.getTransform?.();
    if (!m || !Number.isFinite(m.a)) return;
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [x, y] of [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]) {
      xs.push(m.a * x + m.c * y + m.e);
      ys.push(m.b * x + m.d * y + m.f);
    }
    // The box as it lands on the canvas, grown by `spare` pixels each way and kept on the canvas.
    const around = (spare: number): Box | null => {
      const x = Math.max(0, Math.floor(Math.min(...xs) - spare));
      const y = Math.max(0, Math.floor(Math.min(...ys) - spare));
      const width = Math.min(ctx.canvas.width, Math.ceil(Math.max(...xs) + spare)) - x;
      const height = Math.min(ctx.canvas.height, Math.ceil(Math.max(...ys) + spare)) - y;
      return width > 0 && height > 0 ? { x, y, width, height } : null;
    };
    const corner = (layer.radius ?? 0) * Math.min(box.width, box.height);
    const outline = (on: CanvasRenderingContext2D) => shapePath(on, layer.shape, box, corner);
    // A scratch canvas laid on this one pixel for pixel, inside whatever clip the layer already has.
    const lay = (from: CanvasRenderingContext2D, area: Box, alpha: number) => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = alpha;
      ctx.filter = "none";
      ctx.drawImage(from.canvas, 0, 0, area.width, area.height, area.x, area.y, area.width, area.height);
      ctx.restore();
    };
    const shadowAlpha = layer.frost ? fade : ctx.globalAlpha;

    // Taken before the shadow goes down: glass shows what was under it, not its own shadow.
    const blur = Math.min(60, Math.max(0, layer.frost ?? 0)) * unit;
    let glass: { from: CanvasRenderingContext2D; area: Box } | null = null;
    if (blur >= 0.5) {
      // A blur draws from about two and a half times its radius, so that much more round the box is copied with it.
      const area = around(blur * 2.5);
      const own = area && this.scratch("frost", area.width, area.height);
      if (area && own && blurInto(own, ctx.canvas, area, blur, (name, width, height) => this.scratch(`frost-${name}`, width, height))) glass = { from: own, area };
    }

    if (layer.shadow) {
      const soft = Math.min(44 * unit, Math.max(8 * unit, Math.min(box.width, box.height) * 0.12));
      const drop = soft * 0.4;
      const area = around(soft * 1.6 + drop);
      const own = area && this.scratch("shadow", area.width, area.height);
      if (area && own) {
        // The shape is drawn off to the side with its shadow cast back into place, so only the shadow lands; then the
        // outline is cut out of it.
        const away = area.width + soft * 4;
        own.setTransform(m.a, m.b, m.c, m.d, m.e - area.x + away, m.f - area.y);
        own.shadowColor = "rgba(0, 0, 0, 0.24)";
        own.shadowBlur = soft;
        own.shadowOffsetX = -away;
        own.shadowOffsetY = drop;
        own.fillStyle = "#000000";
        outline(own);
        own.fill();
        own.shadowColor = "transparent";
        own.setTransform(m.a, m.b, m.c, m.d, m.e - area.x, m.f - area.y);
        own.globalCompositeOperation = "destination-out";
        outline(own);
        own.fill();
        own.globalCompositeOperation = "source-over";
        lay(own, area, shadowAlpha);
      }
    }

    if (glass) {
      ctx.save();
      outline(ctx);
      ctx.clip();
      lay(glass.from, glass.area, fade);
      ctx.restore();
    }
  }

  /** What a layer shows, drawn in its own box about the origin. */
  private paintContent(ctx: CanvasRenderingContext2D, layer: Layer, box: Box, time: number, font: string, unit: number, motion: Motion, blur: string) {
    const { theme } = this.scene;
    const w = box.width;
    const h = box.height;
    if (layer.kind === "avatar") this.paintAvatar(ctx, box, font, layer);
    else if (layer.kind === "visual") this.paintVisual(ctx, box, time, fillOf(ctx, layer.color, theme, "accent", box), unit, layer.visual ?? this.scene.visual, this.meterFor(layer.id));
    else if (layer.kind === "captions") this.paintCaptions(ctx, box, time, layer, font, unit);
    else if (layer.kind === "image" || layer.kind === "video") {
      const image = this.picture(layer, time);
      // The picture stays inside its box: a cover or a crop draws past it. A frame cuts it to its shape, and rounded
      // corners to theirs.
      ctx.save();
      shapePath(ctx, layer.mask ?? "rect", box, (layer.radius ?? 0) * Math.min(w, h));
      ctx.clip();
      if (image) {
        if (layer.flipX || layer.flipY) ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
        const tone = [layer.filter ? FILTERS[layer.filter] ?? "" : "", layer.adjust ? filterOf(layer.adjust, unit) : "", blur].filter((part) => part && part !== "none").join(" ");
        if (tone) ctx.filter = tone;
        drawCover(ctx, image, box, layer.crop);
        // A library photo still on its way, or one the library doesn't have, leaves its place empty rather than asking
        // for a picture.
      } else if (this.editing && !layer.image?.startsWith(PHOTO_KEY)) paintPlaceholder(ctx, box, unit, this.placeholderText, layer.mask ?? "rect", (layer.radius ?? 0) * Math.min(w, h));
      ctx.restore();
      if (layer.strokeWidth) {
        shapePath(ctx, layer.mask ?? "rect", box, (layer.radius ?? 0) * Math.min(w, h));
        ctx.lineWidth = layer.strokeWidth * unit;
        ctx.lineJoin = "round";
        ctx.strokeStyle = fillOf(ctx, layer.stroke, theme, "text", box);
        dashFor(ctx, layer.dash, ctx.lineWidth);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (layer.kind === "graphic") this.paintGraphic(ctx, layer, box);
    else if (layer.kind === "chart") paintChart(ctx, layer, box, this.envFor(ctx, time, font, unit, motion, layer));
    else if (layer.kind === "table") paintTable(ctx, layer, box, this.envFor(ctx, time, font, unit, motion, layer));
    else if (layer.kind === "solid") paintSolid(ctx, layer, box, this.envFor(ctx, time, font, unit, motion, layer));
    else if (layer.kind === "ambient") paintAmbient(ctx, layer, box, this.envFor(ctx, time, font, unit, motion, layer));
    else if (layer.kind === "mockup") paintMockup(ctx, layer, box, this.envFor(ctx, time, font, unit, motion, layer));
    else if (layer.kind === "shape" && layer.shape === "line") this.paintLine(ctx, layer, box, unit);
    else if (layer.kind === "shape") {
      ctx.fillStyle = fillOf(ctx, layer.fill, theme, "accent", box);
      shapePath(ctx, layer.shape, box, (layer.radius ?? 0) * Math.min(w, h));
      ctx.fill();
      if (layer.strokeWidth) {
        ctx.lineWidth = layer.strokeWidth * unit;
        ctx.lineJoin = "round";
        ctx.strokeStyle = fillOf(ctx, layer.stroke, theme, "text", box);
        dashFor(ctx, layer.dash, ctx.lineWidth);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      let text = this.textOf(layer, time);
      const sample = !text && this.editing && (layer.kind === "title" || layer.kind === "name" || layer.kind === "handle") ? this.samples[layer.kind] : undefined;
      if (sample) {
        text = sample;
        ctx.globalAlpha *= 0.45;
      }
      // A typed-in layer shows its words a letter at a time.
      this.paintText(ctx, box, layer, motion.reveal < 1 ? [...text].slice(0, Math.round(motion.reveal * [...text].length)).join("") : text, font, unit, motion);
    }
  }

  /** An empty frame, while the picture is edited: a soft tint with a small picture sign, to show where a photo goes. */
  /** A layer's picture at a time: a moving one's frame then, counted from when the layer comes in, or a still one. */
  private picture(layer: Layer, time: number, key = layer.image): CanvasImageSource | null {
    const moving = this.scene.animations?.get(key ?? "");
    if (moving?.frames.length) {
      const length = moving.ends[moving.ends.length - 1] || 1;
      const at = (((time - (layer.from ?? 0)) % length) + length) % length;
      const index = moving.ends.findIndex((end) => at < end);
      return moving.frames[index < 0 ? moving.frames.length - 1 : index];
    }
    return this.scene.images?.get(key ?? "") ?? null;
  }

  /** What the drawing of a chart, a table, a mockup, a solid or a moving background is handed for one frame. */
  private envFor(ctx: CanvasRenderingContext2D, time: number, font: string, unit: number, motion: Motion, layer: Layer): PaintEnv {
    const { theme } = this.scene;
    return {
      theme,
      family: font,
      unit,
      time,
      duration: this.duration,
      growth: motion.growth,
      fill: (paint, fallback, box) => fillOf(ctx, paint, theme, fallback, box),
      flat: (paint, fallback) => paintOf(paint, theme, fallback),
      image: (key) => this.picture(layer, time, key),
      placeholders: this.placeholders,
      placeholderText: this.placeholderText,
      level: (at) => this.level(at),
    };
  }

  /** A drawing of paths, fitted inside the box with its shape kept; "currentColor" takes the layer's colour. */
  private paintGraphic(ctx: CanvasRenderingContext2D, layer: Layer, box: Box) {
    const art = layer.art;
    if (!art?.paths.length || !art.w || !art.h) return;
    const scale = Math.min(box.width / art.w, box.height / art.h);
    if (layer.flipX || layer.flipY) ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
    ctx.translate(box.x + (box.width - art.w * scale) / 2, box.y + (box.height - art.h * scale) / 2);
    ctx.scale(scale, scale);
    // A metal is laid across the drawing's own box, so the light runs over the whole of it.
    const own = fillOf(ctx, layer.color, this.scene.theme, "text", { x: 0, y: 0, width: art.w, height: art.h });
    const tint = (paint: string) => (paint === "currentColor" ? own : paint);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const alpha = ctx.globalAlpha;
    for (const part of art.paths) {
      const path = new Path2D(part.d);
      // Set for every path, so one path's fade never carries to the next; the canvas ignores an alpha out of range,
      // which would keep the last one, so it is held to 0..1.
      const fade = part.opacity ?? 1;
      ctx.globalAlpha = alpha * (Number.isFinite(fade) ? Math.min(1, Math.max(0, fade)) : 1);
      if (part.fill && part.fill !== "none") {
        ctx.fillStyle = tint(part.fill);
        ctx.fill(path, part.rule ?? "nonzero");
      }
      if (part.stroke && part.stroke !== "none") {
        ctx.strokeStyle = tint(part.stroke);
        ctx.lineWidth = part.width ?? 1;
        ctx.stroke(path);
      }
    }
    ctx.globalAlpha = alpha;
  }

  /** A straight line across the middle of its box, in its colour and weight, with an arrowhead at either end. */
  private paintLine(ctx: CanvasRenderingContext2D, layer: Layer, box: Box, unit: number) {
    const color = fillOf(ctx, layer.fill, this.scene.theme, "accent", box);
    const weight = Math.max(1, (layer.strokeWidth ?? 8) * unit);
    const head = weight * 3.2;
    const y = box.y + box.height / 2;
    // A bend lifts the middle of the line through a curve, up to the box's own top or bottom edge.
    const lift = (Math.max(-100, Math.min(100, layer.bend ?? 0)) / 100) * Math.max(0, box.height / 2 - weight / 2);
    const control = { x: box.x + box.width / 2, y: y - lift * 2 };
    const left = box.x + (layer.arrowStart ? head * 0.9 : 0);
    const right = box.x + box.width - (layer.arrowEnd ? head * 0.9 : 0);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = weight;
    ctx.lineCap = layer.cap === "round" ? "round" : "butt";
    dashFor(ctx, layer.dash, weight);
    ctx.beginPath();
    ctx.moveTo(left, y);
    if (lift) ctx.quadraticCurveTo(control.x, control.y, right, y);
    else ctx.lineTo(right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    // Each head points along the line where it ends, so a bent line's arrows follow the curve.
    const arrow = (tipX: number, fromX: number, fromY: number) => {
      const angle = Math.atan2(y - fromY, tipX - fromX);
      const back = { x: tipX - Math.cos(angle) * head, y: y - Math.sin(angle) * head };
      const side = { x: -Math.sin(angle) * head * 0.62, y: Math.cos(angle) * head * 0.62 };
      ctx.beginPath();
      ctx.moveTo(tipX, y);
      ctx.lineTo(back.x + side.x, back.y + side.y);
      ctx.lineTo(back.x - side.x, back.y - side.y);
      ctx.closePath();
      ctx.fill();
    };
    if (layer.arrowEnd) arrow(box.x + box.width, lift ? control.x : left, lift ? control.y : y);
    if (layer.arrowStart) arrow(box.x, lift ? control.x : right, lift ? control.y : y);
  }

  /**
   * Words drawn with a layer's effects: the colour behind the line first, then any copies the effect sets behind the
   * words, then the outline, then the letters, then a rule under or through them.
   */
  private drawWords(ctx: CanvasRenderingContext2D, layer: Layer, text: string, x: number, y: number, size: number, maxWidth?: number, rules?: string | CanvasGradient | CanvasPattern) {
    const { theme } = this.scene;
    const color = ctx.fillStyle;
    // Letter spacing also falls after the last letter, so the words are measured and placed without that last space.
    const trail = layer.letterSpacing ? (layer.letterSpacing / 1000) * size : 0;
    if (trail) x += ctx.textAlign === "center" ? trail / 2 : ctx.textAlign === "right" ? trail : 0;
    const effect = layer.effect;
    const copy = (fill: string | CanvasGradient | CanvasPattern, dx: number, dy: number, alpha = 1) => {
      const was = ctx.globalAlpha;
      ctx.globalAlpha = was * alpha;
      ctx.fillStyle = fill;
      ctx.fillText(text, x + dx, y + dy, maxWidth);
      ctx.globalAlpha = was;
      ctx.fillStyle = color;
    };
    if (layer.background) {
      const width = Math.min(maxWidth ?? Infinity, ctx.measureText(text).width - trail);
      const left = ctx.textAlign === "center" ? x - width / 2 : ctx.textAlign === "right" ? x - width : x;
      const top = ctx.textBaseline === "top" ? y : y - size * 0.6;
      const fill = ctx.fillStyle;
      ctx.fillStyle = paintOf(layer.background, theme, "accent");
      roundRect(ctx, left - size * 0.22, top - size * 0.08, width + size * 0.44, size * 1.24, size * 0.18);
      ctx.fill();
      ctx.fillStyle = fill;
    }
    const accent = paintOf(layer.effectColor, theme, "accent");
    if (effect === "splice") copy(accent, size * 0.07, size * 0.07);
    else if (effect === "echo") {
      copy(color, size * 0.12, size * 0.12, 0.22);
      copy(color, size * 0.06, size * 0.06, 0.45);
    } else if (effect === "glitch") {
      copy("#00e5ff", -size * 0.045, 0);
      copy("#ff2bd6", size * 0.045, 0);
    }
    if (layer.shadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = size * 0.28;
      ctx.shadowOffsetY = size * 0.06;
    } else if (effect === "lift") {
      ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
      ctx.shadowBlur = size * 0.5;
      ctx.shadowOffsetY = size * 0.14;
    } else if (effect === "neon") {
      ctx.shadowColor = typeof color === "string" ? color : accent;
      ctx.shadowBlur = size * 0.45;
    }
    if (layer.outline) {
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1, size * 0.14);
      ctx.strokeStyle = (METALS[layer.outline] && this.metalStroke) || paintOf(layer.outline, theme, "text");
      ctx.strokeText(text, x, y, maxWidth);
      // One shadow, under the outline, not a second under the letters.
      if (effect !== "neon") ctx.shadowColor = "transparent";
    }
    if (effect === "hollow" || effect === "splice") {
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1, size * 0.045);
      ctx.strokeStyle = color;
      ctx.strokeText(text, x, y, maxWidth);
    } else ctx.fillText(text, x, y, maxWidth);
    ctx.shadowColor = "transparent";
    if (layer.underline || layer.strike) {
      const width = Math.min(maxWidth ?? Infinity, ctx.measureText(text).width - trail);
      const left = ctx.textAlign === "center" ? x - width / 2 : ctx.textAlign === "right" ? x - width : x;
      const top = ctx.textBaseline === "top" ? y : y - size * 0.5;
      const thick = Math.max(1, size * 0.06);
      ctx.fillStyle = rules ?? color;
      if (layer.underline) ctx.fillRect(left, top + size * 1.02, width, thick);
      if (layer.strike) ctx.fillRect(left, top + size * 0.52, width, thick);
    }
  }

  /** One line of words bent along an arc, a letter at a time, each turned to follow it. */
  private drawCurved(ctx: CanvasRenderingContext2D, layer: Layer, text: string, box: Box, size: number) {
    const letters = [...text];
    const widths = letters.map((letter) => ctx.measureText(letter).width);
    const total = widths.reduce((sum, width) => sum + width, 0);
    const bend = Math.max(-100, Math.min(100, layer.curve ?? 0)) / 100;
    // A full bend wraps the words three quarters of the way round a circle.
    const sweep = Math.max(0.05, Math.abs(bend) * Math.PI * 1.5);
    const radius = total / sweep;
    const smile = bend > 0;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2 + (smile ? radius : -radius);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const plain = { ...layer, background: undefined, underline: false, strike: false };
    let along = 0;
    letters.forEach((letter, index) => {
      const angle = -sweep / 2 + (along + widths[index] / 2) / radius;
      along += widths[index];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(smile ? angle : -angle);
      this.drawWords(ctx, plain, letter, 0, smile ? -radius : radius, size);
      ctx.restore();
    });
  }

  /** What a text layer says: the scene's own words for the built-in ones, its own for the rest. */
  textOf(layer: Layer, time: number): string {
    const scene = this.scene;
    if (layer.kind === "name") return scene.speaker;
    if (layer.kind === "handle") return scene.handle;
    if (layer.kind === "title") return scene.title;
    if (layer.kind === "links") return (scene.links ?? []).map((link) => link.trim()).filter(Boolean).slice(0, 3).join("  ·  ");
    if (layer.kind === "time") {
      const { at, length } = this.progress(time);
      return clockText(layer.clock, at, length);
    }
    return layer.text ?? "";
  }

  private paintText(ctx: CanvasRenderingContext2D, box: Box, layer: Layer, text: string, font: string, unit: number, motion?: Motion) {
    if (!text) return;
    text = shownText(layer, text);
    const quiet = layer.kind === "handle" || layer.kind === "links" || layer.kind === "time";
    typeset(ctx, layer, font, unit, layer.kind === "title" ? 700 : 400);
    ctx.fillStyle = fillOf(ctx, layer.color, this.scene.theme, quiet ? "muted" : "text", box);
    this.metalStroke = layer.outline && METALS[layer.outline] ? fillOf(ctx, layer.outline, this.scene.theme, "text", box) : null;
    const size = (layer.size ?? 40) * unit;
    const units = motion?.units ?? null;
    if (layer.curve) {
      // Bent words move as one: they fade in over the time their words would have taken.
      if (units) ctx.globalAlpha *= easeOut(units.p);
      return this.drawCurved(ctx, layer, text.replace(/\s*\n\s*/g, " "), box, size);
    }
    const align = layer.align ?? "left";
    ctx.textAlign = align;
    const x = align === "center" ? box.x + box.width / 2 : align === "right" ? box.x + box.width : box.x;
    let lines: Array<{ text: string; y: number }>;
    if (SINGLE_LINE.has(layer.kind)) {
      ctx.textBaseline = "middle";
      lines = [{ text, y: box.y + box.height / 2 }];
    } else {
      ctx.textBaseline = "top";
      const lineHeight = size * (layer.lineHeight ?? 1.15);
      // Words in a box that hugs them break only where a line was typed: rounding at a smaller preview never wraps them.
      let wrapped = layer.kind === "text" && layer.autoWidth ? text.split("\n") : textLines(ctx, text, box.width);
      // A title keeps to the lines its box has room for, the last one cut short where words are left out; free text
      // runs as long as it is.
      if (layer.kind === "title") {
        const room = Math.max(1, Math.floor(box.height / lineHeight + 0.05));
        const cut = wrapped.slice(room).some((line) => line.trim());
        wrapped = wrapped.slice(0, room);
        if (cut) {
          // The ellipsis ends the last kept line with words in it; blank lines after it would only push it apart.
          while (wrapped.length > 1 && !wrapped.at(-1)!.trim()) wrapped.pop();
          wrapped[wrapped.length - 1] = cutShort(ctx, wrapped.at(-1)!, box.width);
        }
      }
      lines = wrapped.map((line, index) => ({ text: line, y: box.y + index * lineHeight }));
    }
    // Letters spreading in: the lines are already laid out, so they widen about their alignment without rewrapping.
    if (motion?.spacing) {
      const own = (layer.letterSpacing ?? 0) / 1000;
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round((own + motion.spacing) * size * 100) / 100}px`;
    }
    const single = SINGLE_LINE.has(layer.kind) ? box.width : undefined;
    if (units) this.drawUnits(ctx, layer, lines, x, size, units, single);
    else for (const line of lines) if (line.text) this.drawWords(ctx, layer, line.text, x, line.y, size, single);
  }

  /**
   * Lines of words drawn a word or a letter at a time, each moving in on its own a little after the one before, so the
   * whole set settles as the way in ends. A line's colour behind it fades in with its first words.
   */
  private drawUnits(ctx: CanvasRenderingContext2D, layer: Layer, lines: Array<{ text: string; y: number }>, x: number, size: number, units: NonNullable<Motion["units"]>, maxWidth?: number) {
    const byLetter = UNIT_WAYS[units.way] === "letter";
    const trail = layer.letterSpacing ? (layer.letterSpacing / 1000) * size : 0;
    const split = (line: string) => (byLetter ? [...line] : line.split(/(\s+)/).filter(Boolean));
    const count = lines.reduce((sum, line) => sum + split(line.text).filter((part) => part.trim()).length, 0);
    const step = count > 1 ? 0.55 / (count - 1) : 0;
    const span = count > 1 ? 0.45 : 1;
    const align = ctx.textAlign;
    const middle = ctx.textBaseline === "middle";
    const plain = { ...layer, background: undefined, underline: false, strike: false };
    let index = 0;
    for (const line of lines) {
      if (!line.text) continue;
      if (layer.background || layer.underline || layer.strike) {
        // The line's own colour behind it and its rules, without its letters, fading in as the words start.
        const fill = ctx.fillStyle;
        const was = ctx.globalAlpha;
        ctx.globalAlpha = was * Math.min(1, units.p * 2.5);
        ctx.fillStyle = "rgba(0, 0, 0, 0)";
        this.drawWords(ctx, { ...layer, effect: undefined, outline: undefined, shadow: false }, line.text, x, line.y, size, maxWidth, fill);
        ctx.fillStyle = fill;
        ctx.globalAlpha = was;
      }
      const width = ctx.measureText(line.text).width - trail;
      const squeeze = maxWidth && width > maxWidth ? maxWidth / width : 1;
      if (squeeze < 1) {
        ctx.save();
        ctx.translate(x, 0);
        ctx.scale(squeeze, 1);
        ctx.translate(-x, 0);
      }
      let left = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
      const cy = middle ? line.y : line.y + size / 2;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (const part of split(line.text)) {
        const partWidth = ctx.measureText(part).width;
        if (part.trim()) {
          const up = Math.min(1, Math.max(0, (units.p - index * step) / span));
          const e = easeOut(up);
          const turn = units.direction === "left" ? 1 : -1;
          let dx = 0;
          let dy = 0;
          let scale = 1;
          let rotate = 0;
          let alpha = e;
          if (units.way === "ascend") dy = (units.direction === "down" ? -1 : 1) * (1 - e) * size * 0.55;
          else if (units.way === "shift") dx = turn * (1 - e) * size * 0.6;
          else if (units.way === "merge") dy = (index % 2 ? -1 : 1) * (1 - e) * size * 0.7;
          else if (units.way === "burst") {
            scale = Math.max(0.001, overshootUnit(up));
            alpha = Math.min(1, up * 3);
          } else if (units.way === "cascade") {
            dy = -(1 - e) * size;
            rotate = (1 - e) * -14;
          }
          if (alpha > 0.002) {
            ctx.save();
            ctx.globalAlpha *= alpha;
            ctx.translate(left + partWidth / 2 + dx, cy + dy);
            if (rotate) ctx.rotate((rotate * Math.PI) / 180);
            if (scale !== 1) ctx.scale(scale, scale);
            this.drawWords(ctx, plain, part, -partWidth / 2, 0, size);
            ctx.restore();
          }
          index++;
        }
        left += partWidth;
      }
      if (squeeze < 1) ctx.restore();
      ctx.textAlign = align;
      ctx.textBaseline = middle ? "middle" : "top";
    }
  }

  /** The speaker's picture in a circle; without one, their initial on a disc in the layer's own colour, or the
   *  theme's accent when it has none. */
  private paintAvatar(ctx: CanvasRenderingContext2D, box: Box, font: string, layer: Layer) {
    const { theme, cover, speaker, handle } = this.scene;
    const radius = Math.min(box.width, box.height) / 2;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    if (cover) return drawCircle(ctx, cover, cx, cy, radius);
    ctx.fillStyle = layer.fill ? fillOf(ctx, layer.fill, theme, "accent", box) : theme.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = layer.color ? paintOf(layer.color, theme, "text") : layer.fill ? inkOn(paintOf(layer.fill, theme, "accent")) : theme.onAccent;
    const initial = (speaker || handle).replace(/^@/, "").trim().charAt(0).toUpperCase();
    if (!initial) {
      ctx.beginPath();
      ctx.arc(cx, cy - radius * 0.2, radius * 0.3, 0, Math.PI * 2);
      ctx.moveTo(cx - radius * 0.56, cy + radius * 0.62);
      ctx.bezierCurveTo(cx - radius * 0.56, cy + radius * 0.12, cx + radius * 0.56, cy + radius * 0.12, cx + radius * 0.56, cy + radius * 0.62);
      ctx.closePath();
      ctx.fill();
      return;
    }
    ctx.font = `700 ${Math.round(radius * 0.9)}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial, cx, cy + radius * 0.04);
  }

  private level(time: number, window = 0.05): number {
    const { samples, sampleRate, start } = this.scene.audio;
    const center = (start + time) * sampleRate;
    return Math.min(1, rms(samples, center - (window * sampleRate) / 2, center + (window * sampleRate) / 2) * 4.2);
  }

  private paintVisual(ctx: CanvasRenderingContext2D, area: Box, time: number, color: string | CanvasGradient, unit: number, visual: Visual, meter: Smoother) {
    const { audio } = this.scene;
    const alpha = ctx.globalAlpha;
    const middle = area.y + area.height / 2;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (visual === "bars") {
      const count = 44;
      const center = Math.round((audio.start + time) * audio.sampleRate);
      const size = audio.sampleRate > 30000 ? 2048 : 1024;
      const raw = spectrum(audio.samples, audio.sampleRate, center, { size, bands: count / 2, low: 90, high: 5000 });
      const bands = meter.next(raw);
      const step = area.width / count;
      const barWidth = step * 0.56;
      for (let i = 0; i < count; i++) {
        // Low pitches in the middle, mirrored outwards, the way voices usually look.
        const band = bands[Math.abs(i - (count - 1) / 2) | 0] ?? 0;
        const barHeight = Math.max(barWidth, band * area.height * 0.92);
        roundRect(ctx, area.x + i * step + (step - barWidth) / 2, middle - barHeight / 2, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }
      return;
    }

    if (visual === "ring") return this.paintRing(ctx, area, time, meter);
    if (visual === "radial") return this.paintRadial(ctx, area, time, unit, meter);
    if (visual === "mirror") return this.paintMirror(ctx, area, time, unit, meter);
    if (visual === "line") return this.paintSpectrumLine(ctx, area, time, unit, meter);
    if (visual === "dots") return this.paintDots(ctx, area, time, meter);
    if (visual === "blocks") return this.paintBlocks(ctx, area, time, meter);
    if (visual === "scope") return this.paintScope(ctx, area, time, unit, meter);

    if (visual === "wave") {
      // The last few seconds of loudness, scrolling left, mirrored about the middle.
      const span = 4;
      const points = 120;
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const at = time - span + (i / points) * span;
        const x = area.x + (i / points) * area.width;
        const y = middle - (at < 0 ? 0 : this.level(at, 0.06)) * area.height * 0.46;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let i = points; i >= 0; i--) {
        const at = time - span + (i / points) * span;
        const x = area.x + (i / points) * area.width;
        ctx.lineTo(x, middle + (at < 0 ? 0 : this.level(at, 0.06)) * area.height * 0.46);
      }
      ctx.closePath();
      ctx.globalAlpha = alpha * 0.9;
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.fillRect(area.x + area.width - 3 * unit, area.y + area.height * 0.08, 6 * unit, area.height * 0.84);
      return;
    }

    // Pulse: rings that swell with the voice.
    const level = meter.next(Float32Array.of(this.level(time)))[0];
    const cx = area.x + area.width / 2;
    const base = area.height * 0.2;
    for (let ring = 3; ring >= 1; ring--) {
      ctx.globalAlpha = alpha * 0.16 * ring;
      ctx.beginPath();
      ctx.arc(cx, middle, base + level * area.height * 0.11 * ring, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(cx, middle, base * 0.86, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * A ring of dots round the middle of the box, lit in the layer's colour as far as the clip has played: the newest few
   * brighter and a little larger, like the head of a comet, the ones still to come dim. Each lit dot swells with the
   * voice in its own band, low pitches at the top and mirrored down both sides.
   */
  private paintRing(ctx: CanvasRenderingContext2D, area: Box, time: number, meter: Smoother) {
    const { audio } = this.scene;
    const alpha = ctx.globalAlpha;
    const center = Math.round((audio.start + time) * audio.sampleRate);
    const size = audio.sampleRate > 30000 ? 2048 : 1024;
    const bands = meter.next(spectrum(audio.samples, audio.sampleRate, center, { size, bands: RING_DOTS / 2, low: 90, high: 5000 }));
    const { at, length } = this.progress(time);
    const played = length > 0 ? Math.min(1, Math.max(0, at / length)) : 0;
    // In a strip the ring opens out into a row of dots across it, so a sound style picked for the whole design suits a
    // ring's square and a strip's slot alike.
    if (area.width >= area.height * 2.5) {
      const count = Math.max(12, Math.min(RING_DOTS, Math.round(area.width / (area.height * 0.9))));
      const lit = Math.floor(played * count + 1e-6);
      const gap = area.width / count;
      const dot = Math.min(gap * 0.22, area.height * 0.2);
      for (let i = 0; i < count; i++) {
        let shade = 0.2;
        let grow = 1;
        if (i < lit) {
          const head = Math.max(0, 1 - (lit - 1 - i) / RING_HEAD);
          const voice = bands[Math.min(bands.length - 1, Math.floor((i / count) * bands.length))] ?? 0;
          shade = 0.72 + 0.28 * head;
          grow = (1 + 0.35 * head) * (1 + 0.4 * voice);
        }
        ctx.globalAlpha = alpha * shade;
        ctx.beginPath();
        ctx.arc(area.x + gap * (i + 0.5), area.y + area.height / 2, Math.min(dot * grow, gap / 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
      return;
    }
    const lit = Math.floor(played * RING_DOTS + 1e-6);
    const outer = Math.min(area.width, area.height) / 2;
    const dot = outer * 0.03;
    // Room inside the box for the largest a dot gets: the head, swollen with a loud voice.
    const reach = outer - dot * 2;
    const cx = area.x + area.width / 2;
    const cy = area.y + area.height / 2;
    for (let i = 0; i < RING_DOTS; i++) {
      const angle = -Math.PI / 2 + (i / RING_DOTS) * Math.PI * 2;
      let shade = 0.2;
      let grow = 1;
      if (i < lit) {
        const head = Math.max(0, 1 - (lit - 1 - i) / RING_HEAD);
        const voice = bands[Math.min(bands.length - 1, i, RING_DOTS - i)] ?? 0;
        shade = 0.72 + 0.28 * head;
        grow = (1 + 0.35 * head) * (1 + 0.4 * voice);
      }
      ctx.globalAlpha = alpha * shade;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach, dot * grow, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }

  /** How loud each of `count` pitch bands is at `time`, low pitches first, eased by the layer's meter. */
  private bandsAt(time: number, count: number, meter: Smoother): Float32Array {
    const { audio } = this.scene;
    const center = Math.round((audio.start + time) * audio.sampleRate);
    const size = audio.sampleRate > 30000 ? 2048 : 1024;
    return meter.next(spectrum(audio.samples, audio.sampleRate, center, { size, bands: count, low: 90, high: 5000 }));
  }

  /** How much of the clip has played at `time`, from 0 to 1. */
  private played(time: number): number {
    const { at, length } = this.progress(time);
    return length > 0 ? Math.min(1, Math.max(0, at / length)) : 0;
  }

  /**
   * Bars standing out from a circle all round, like a sunburst, low pitches at the top and mirrored down both sides; the
   * circle inside them lights up as far as the clip has played. In a strip the circle opens out into a line along the
   * middle, the bars standing out from it both ways and the line lit from the left.
   */
  private paintRadial(ctx: CanvasRenderingContext2D, area: Box, time: number, unit: number, meter: Smoother) {
    const alpha = ctx.globalAlpha;
    const played = this.played(time);
    ctx.lineCap = "round";
    if (area.width >= area.height * 2.5) {
      const count = Math.max(24, Math.min(96, Math.round(area.width / (area.height * 0.14))));
      const bands = this.bandsAt(time, Math.ceil(count / 2), meter);
      const step = area.width / count;
      const thick = step * 0.42;
      const middle = area.y + area.height / 2;
      const line = Math.max(unit, thick * 0.4);
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillRect(area.x, middle - line / 2, area.width, line);
      ctx.globalAlpha = alpha;
      ctx.fillRect(area.x, middle - line / 2, area.width * played, line);
      ctx.lineWidth = thick;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        // Low pitches in the middle, mirrored outwards, as the circle has them at its top.
        const band = bands[Math.abs(i - (count - 1) / 2) | 0] ?? 0;
        const reach = (band * (area.height - thick)) / 2;
        const x = area.x + (i + 0.5) * step;
        ctx.moveTo(x, middle - reach);
        ctx.lineTo(x, middle + reach);
      }
      ctx.stroke();
      return;
    }
    const count = 72;
    const outer = Math.min(area.width, area.height) / 2;
    const inner = outer * 0.5;
    const thick = ((Math.PI * 2 * inner) / count) * 0.5;
    // The longest bar, its round end included, just reaches the edge of the box.
    const room = outer - inner - thick;
    const cx = area.x + area.width / 2;
    const cy = area.y + area.height / 2;
    const bands = this.bandsAt(time, count / 2, meter);
    const circle = inner - thick * 1.6;
    ctx.lineWidth = Math.max(unit, thick * 0.45);
    ctx.globalAlpha = alpha * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, circle, 0, Math.PI * 2);
    ctx.stroke();
    if (played > 0) {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(cx, cy, circle, -Math.PI / 2, -Math.PI / 2 + played * Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    ctx.lineWidth = thick;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
      const band = bands[Math.min(bands.length - 1, i, count - i)] ?? 0;
      const from = inner + thick / 2;
      const to = from + band * room;
      ctx.moveTo(cx + Math.cos(angle) * from, cy + Math.sin(angle) * from);
      ctx.lineTo(cx + Math.cos(angle) * to, cy + Math.sin(angle) * to);
    }
    ctx.stroke();
  }

  /** Bars along the pitches, low on the left, standing up from a line across the middle, each with its reflection hanging
   *  fainter under the line. */
  private paintMirror(ctx: CanvasRenderingContext2D, area: Box, time: number, unit: number, meter: Smoother) {
    const alpha = ctx.globalAlpha;
    const count = Math.max(16, Math.min(48, Math.round(area.width / (area.height * 0.16))));
    const bands = this.bandsAt(time, count, meter);
    const step = area.width / count;
    const width = step * 0.6;
    const middle = area.y + area.height / 2;
    const gap = Math.max(unit, area.height * 0.03);
    const half = (area.height - gap) / 2;
    for (const [side, shade] of [[-1, 1], [1, 0.42]]) {
      ctx.globalAlpha = alpha * shade;
      for (let i = 0; i < count; i++) {
        const tall = Math.max(Math.min(width, half), widen(bands[i]) * half);
        const x = area.x + i * step + (step - width) / 2;
        roundRect(ctx, x, side < 0 ? middle - gap / 2 - tall : middle + gap / 2, width, tall, width / 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = alpha;
  }

  /** The voice's pitches as one smooth curve, low on the left, over a fill that fades away towards the foot of the box. */
  private paintSpectrumLine(ctx: CanvasRenderingContext2D, area: Box, time: number, unit: number, meter: Smoother) {
    const alpha = ctx.globalAlpha;
    const count = 48;
    const raw = this.bandsAt(time, count, meter);
    // Each band eased into its neighbours, so the curve rolls rather than zigzags.
    const bands = raw.map((value, i) => (raw[Math.max(0, i - 1)] + 2 * value + raw[Math.min(count - 1, i + 1)]) / 4);
    const thick = Math.max(1, Math.min(Math.min(area.width, area.height) * 0.03, 4 * unit));
    const left = area.x + thick / 2;
    const right = area.x + area.width - thick / 2;
    const top = area.y + thick / 2;
    const foot = area.y + area.height - thick / 2;
    const xs = Array.from({ length: count }, (_, i) => left + (i / (count - 1)) * (right - left));
    const ys = Array.from(bands, (value) => foot - value * (foot - top));
    ctx.save();
    ctx.beginPath();
    smoothThrough(ctx, xs, ys);
    ctx.lineTo(right, foot);
    ctx.lineTo(left, foot);
    ctx.closePath();
    ctx.clip();
    // The fade as bands of colour under the curve, as a layer's colour can be a metal's gradient, which takes no
    // transparency of its own.
    const peak = Math.min(...ys);
    const stripes = 24;
    const span = foot - peak;
    for (let s = 0; s < stripes; s++) {
      ctx.globalAlpha = alpha * 0.45 * (1 - s / stripes) ** 1.6;
      ctx.fillRect(area.x, peak + (span * s) / stripes, area.width, span / stripes);
    }
    ctx.restore();
    ctx.lineWidth = thick;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    smoothThrough(ctx, xs, ys);
    ctx.stroke();
  }

  /** Columns of round lights, low pitches on the left, lit from the bottom up as loud as each pitch is, the unlit ones
   *  dim behind: an LED equaliser. */
  private paintDots(ctx: CanvasRenderingContext2D, area: Box, time: number, meter: Smoother) {
    const alpha = ctx.globalAlpha;
    // Lights as large as seven fit down the box, within a dozen to 64 across it.
    const cell = Math.min(area.width / 12, Math.max(area.height / 7, area.width / 64));
    const cols = Math.max(1, Math.floor(area.width / cell));
    const rows = Math.max(1, Math.floor(area.height / cell));
    const bands = this.bandsAt(time, cols, meter);
    const left = area.x + (area.width - cols * cell) / 2 + cell / 2;
    const foot = area.y + (area.height + rows * cell) / 2 - cell / 2;
    const radius = Math.min(cell * 0.34, area.height * 0.45);
    for (let c = 0; c < cols; c++) {
      const lit = widen(bands[c]) * rows;
      for (let r = 0; r < rows; r++) {
        // The top light fades in as its pitch rises towards it, so a column climbs smoothly rather than in jumps.
        const on = Math.min(1, Math.max(0, lit - r));
        ctx.globalAlpha = alpha * (UNLIT + (1 - UNLIT) * on);
        ctx.beginPath();
        ctx.arc(left + c * cell, foot - r * cell, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = alpha;
  }

  /** Meter columns of stacked blocks, low pitches on the left, lit from the bottom up, each topped by a thin cap that
   *  stays a moment at the loudest it reached and then falls slowly. */
  private paintBlocks(ctx: CanvasRenderingContext2D, area: Box, time: number, meter: Smoother) {
    const alpha = ctx.globalAlpha;
    const cols = Math.max(10, Math.min(32, Math.round(area.width / (area.height * 0.22))));
    const step = area.width / cols;
    const width = step * 0.7;
    const segments = Math.max(4, Math.min(18, Math.round(area.height / (width * 0.5))));
    const pitch = area.height / segments;
    const tall = pitch * 0.62;
    const corner = Math.min(width, tall) * 0.18;
    const bands = this.bandsAt(time, cols, meter).map(widen);
    const caps = this.capsFor(meter, bands, time);
    const foot = area.y + area.height;
    for (let c = 0; c < cols; c++) {
      const x = area.x + c * step + (step - width) / 2;
      const lit = Math.round(bands[c] * segments);
      for (let s = 0; s < segments; s++) {
        ctx.globalAlpha = alpha * (s < lit ? 1 : UNLIT);
        roundRect(ctx, x, foot - (s + 1) * pitch + (pitch - tall) / 2, width, tall, corner);
        ctx.fill();
      }
      // The cap sits in a block's place of its own, just over the lit ones at the least, so it never hides in them.
      const slot = Math.min(segments - 1, Math.max(lit, Math.round(caps[c] * segments)));
      const capTall = tall * 0.42;
      ctx.globalAlpha = alpha;
      roundRect(ctx, x, foot - (slot + 0.5) * pitch - capTall / 2, width, capTall, Math.min(corner, capTall / 2));
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }

  /** Each band's peak, held for a moment and then falling at its own pace; started afresh after a jump in time. */
  private capsFor(meter: Smoother, levels: Float32Array, time: number): Float32Array {
    let held = this.caps.get(meter);
    if (!held || held.levels.length !== levels.length || time < held.at || time - held.at > 1) {
      held = { levels: Float32Array.from(levels), since: new Float32Array(levels.length).fill(time), at: time };
      this.caps.set(meter, held);
    }
    const passed = time - held.at;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] >= held.levels[i]) {
        held.levels[i] = levels[i];
        held.since[i] = time;
      } else if (time - held.since[i] > CAP_HOLD) held.levels[i] = Math.max(levels[i], held.levels[i] - CAP_FALL * passed);
    }
    held.at = time;
    return held.levels;
  }

  /**
   * The sound itself round the playhead, as an oscilloscope draws it: one smooth line through the samples, tapering to
   * the middle at both ends, with a faint glow that grows with the voice.
   */
  private paintScope(ctx: CanvasRenderingContext2D, area: Box, time: number, unit: number, meter: Smoother) {
    const { samples, sampleRate, start } = this.scene.audio;
    const alpha = ctx.globalAlpha;
    const level = meter.next(Float32Array.of(this.level(time)))[0];
    const span = Math.max(2, Math.round(sampleRate * SCOPE_SPAN));
    let from = Math.round((start + time) * sampleRate) - (span >> 1);
    // Starting at a rising crossing just before the window, as a scope's trigger does, holds a steady note still rather
    // than letting it slide along.
    for (let i = from; i > from - (span >> 1); i--) {
      if (i > 0 && i < samples.length && samples[i - 1] < 0 && samples[i] >= 0) {
        from = i;
        break;
      }
    }
    const thick = Math.max(1, Math.min(Math.min(area.width, area.height) * 0.025, 3.5 * unit));
    const glow = thick * 4;
    const points = Math.max(24, Math.min(240, Math.round(area.width / 4)));
    const left = area.x + glow / 2;
    const across = area.width - glow;
    const middle = area.y + area.height / 2;
    const half = (area.height - glow) / 2;
    const xs = new Float32Array(points);
    const ys = new Float32Array(points);
    for (let p = 0; p < points; p++) {
      // Each point is the mean of its share of the samples, which smooths off hiss finer than the line can show.
      const a = from + Math.floor((p * span) / points);
      const b = Math.max(a + 1, from + Math.floor(((p + 1) * span) / points));
      let sum = 0;
      for (let i = Math.max(0, a); i < Math.min(samples.length, b); i++) sum += samples[i];
      const taper = Math.sin((Math.PI * p) / (points - 1)) ** 0.6;
      xs[p] = left + (p / (points - 1)) * across;
      ys[p] = middle - Math.tanh((sum / (b - a)) * SCOPE_GAIN) * taper * half;
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const [width, shade] of [[glow, 0.08 + 0.14 * level], [thick * 2.2, 0.16 + 0.24 * level], [thick, 1]]) {
      ctx.globalAlpha = alpha * shade;
      ctx.lineWidth = width;
      ctx.beginPath();
      smoothThrough(ctx, xs, ys);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
  }

  /** The caption shown at `time`, and whether it stands in for one: none when nothing shows. */
  private cueShown(time: number): { cue: Cue; sample: boolean } | null {
    const { captions } = this.scene;
    // Between captions, the next one shows a moment before it is said, and the last one stays a moment after.
    let index = cueAt(captions, time);
    if (index < 0) index = captions.findIndex((cue) => cue.start > time && cue.start - time < 1.5);
    if (index < 0) index = captions.findLastIndex((cue) => cue.end <= time && time - cue.end < 0.8);
    if (index >= 0) return { cue: captions[index], sample: false };
    // While the picture is edited the layer always shows words, so it can be found and styled: the next caption, the
    // last one, or a sample before there are any.
    if (!this.editing) return null;
    const cue = captions.find((item) => item.start > time) ?? captions[captions.length - 1] ?? (this.captionsSample ? { start: time, end: time, text: this.captionsSample } : null);
    return cue ? { cue, sample: true } : null;
  }

  /** The words a layer shows at `time` while the picture is edited, samples standing in for words not written yet. */
  shownWords(layer: Layer, time: number): string {
    if (layer.kind === "captions") return this.cueShown(time)?.cue.text ?? "";
    const text = this.textOf(layer, time);
    return text || (layer.kind === "title" || layer.kind === "name" || layer.kind === "handle" ? this.samples[layer.kind] ?? "" : "");
  }

  private paintCaptions(ctx: CanvasRenderingContext2D, area: Box, time: number, layer: Layer, font: string, unit: number) {
    const { theme } = this.scene;
    const shownCue = this.cueShown(time);
    if (!shownCue) return;
    const { cue, sample } = shownCue;
    const words = timeWords(cue);
    const size = Math.round((layer.size ?? 62) * unit);
    const highlight = paintOf(layer.highlight, theme, "accent");
    const onHighlight = layer.highlight && layer.highlight !== "accent" ? inkOn(highlight) : theme.onAccent;
    const said = paintOf(layer.color, theme, "text");
    this.metalStroke = layer.outline && METALS[layer.outline] ? fillOf(ctx, layer.outline, theme, "text", area) : null;
    typeset(ctx, layer, font, unit, 650);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const space = ctx.measureText(" ").width;
    const lineHeight = size * (layer.lineHeight ?? 1.34);
    // Lay the words out in lines first, so each can be drawn, and the one being said marked, in its place.
    const lines: Array<Array<{ text: string; width: number; start: number; end: number }>> = [[]];
    let lineWidth = 0;
    for (const said of words) {
      const word = layer.uppercase ? { ...said, text: said.text.toLocaleUpperCase() } : said;
      const width = ctx.measureText(word.text).width;
      if (lines[lines.length - 1].length && lineWidth + space + width > area.width) {
        lines.push([]);
        lineWidth = 0;
      }
      lines[lines.length - 1].push({ ...word, width });
      lineWidth += (lineWidth ? space : 0) + width;
    }
    const shown = lines.slice(0, Math.max(1, Math.floor(area.height / lineHeight)));
    const top = area.y + (area.height - shown.length * lineHeight) / 2 + lineHeight / 2;
    const align = layer.align ?? "center";
    const wordStyle = { ...layer, background: undefined };
    // At the sample point (a template's picture, or no clip yet) the sample is part said, so a design shows its marked
    // word and its said words as an export would, not every word faded.
    const marked = sample && this.sampleProgress ? Math.floor(words.length * 0.45) : -1;
    let counted = 0;
    shown.forEach((line, row) => {
      const total = line.reduce((sum, word) => sum + word.width, 0) + space * (line.length - 1);
      let x = align === "left" ? area.x : align === "right" ? area.x + area.width - total : area.x + (area.width - total) / 2;
      const y = top + row * lineHeight;
      // The colour behind a caption runs the width of its line; each word then goes without one of its own.
      if (layer.background) {
        ctx.fillStyle = paintOf(layer.background, theme, "accent");
        roundRect(ctx, x - size * 0.3, y - size * 0.7, total + size * 0.6, size * 1.4, size * 0.2);
        ctx.fill();
      }
      for (const word of line) {
        const done = sample ? counted < marked : time >= word.end;
        const saying = sample ? counted === marked : time >= word.start && time < word.end;
        counted++;
        if (saying) {
          ctx.fillStyle = highlight;
          roundRect(ctx, x - size * 0.1, y - size * 0.62, word.width + size * 0.2, size * 1.24, 10 * unit);
          ctx.fill();
        }
        ctx.fillStyle = saying ? onHighlight : done ? said : layer.color ? said : theme.muted;
        // A design's own caption colour stays its own for the words still to come, only fainter: at 72% white still
        // reads at 3:1 on a deep red or blue page, where half faded into a muddy pink.
        const was = ctx.globalAlpha;
        if (!saying && !done && layer.color) ctx.globalAlpha = was * 0.72;
        this.drawWords(ctx, wordStyle, word.text, x, y, size);
        ctx.globalAlpha = was;
        x += word.width + space;
      }
    });
  }
}
