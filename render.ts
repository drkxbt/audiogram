import { cueAt, timeWords, type Cue } from "./captions.js";
import { defaultLayers, FRAME_SIZES, motionAt, type Adjust, type Layer, type Paint, type ShapeKind } from "./layers.js";
import { rms, Smoother, spectrum } from "./wave.js";

export type Layout = "square" | "portrait" | "story" | "landscape";
export type Visual = "bars" | "wave" | "pulse";

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
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
function shapePath(ctx: CanvasRenderingContext2D, shape: ShapeKind | undefined, box: Box, radius: number) {
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

/** A picture's tone as a canvas filter, in pixels of the frame being drawn. */
function filterOf(adjust: Adjust, unit: number): string {
  const parts: string[] = [];
  if (adjust.brightness !== undefined && adjust.brightness !== 1) parts.push(`brightness(${adjust.brightness})`);
  if (adjust.contrast !== undefined && adjust.contrast !== 1) parts.push(`contrast(${adjust.contrast})`);
  if (adjust.saturation !== undefined && adjust.saturation !== 1) parts.push(`saturate(${adjust.saturation})`);
  if (adjust.blur) parts.push(`blur(${Math.round(adjust.blur * unit * 10) / 10}px)`);
  return parts.join(" ") || "none";
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

/** Draws a picture over a whole box, filling it the way object-fit: cover does. */
function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource, box: Box) {
  const size = sizeOf(image);
  if (!size.width || !size.height) return;
  const scale = Math.max(box.width / size.width, box.height / size.height);
  const width = size.width * scale;
  const height = size.height * scale;
  ctx.drawImage(image, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height);
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

/** A layer's colour as CSS: one of the theme's by name, or its own. */
export function paintOf(paint: Paint | undefined, theme: Theme, fallback: "text" | "muted" | "accent"): string {
  const key = paint ?? fallback;
  return key === "text" || key === "muted" || key === "accent" || key === "onAccent" || key === "background" ? theme[key] : key;
}

/** The canvas font for a text layer, its own family first and the scene's after it. */
export function fontOf(layer: Layer, family: string, unit: number, weight = 400): string {
  const size = Math.round((layer.size ?? 40) * unit);
  return `${layer.italic ? "italic " : ""}${layer.weight ?? weight} ${size}px ${layer.font ? `"${layer.font}", ${family}` : family}`;
}

/** Black or white, whichever reads better on a colour given as #rrggbb. */
function inkOn(color: string): string {
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
  return text.split("\n").flatMap((part) => (part.trim() ? wrap(ctx, part, width) : [""]));
}

/** How tall a text layer's words stand, as a share of the frame's height, at the frame's size. */
export function textHeight(ctx: CanvasRenderingContext2D, layer: Layer, text: string, family: string, width: number, height: number): number {
  const unit = Math.min(width, height) / 1080;
  ctx.font = fontOf(layer, family, unit);
  const shown = layer.uppercase ? text.toLocaleUpperCase() : text;
  return (Math.max(1, textLines(ctx, shown, layer.w * width).length) * (layer.size ?? 40) * unit * 1.15) / height;
}

// Layers drawn as one line, centred in their box; titles and free text wrap down from the top of theirs.
const SINGLE_LINE = new Set(["name", "handle", "links", "time"]);

/**
 * Paints frames of a clip. It keeps a little state from frame to frame, so the bars ease the way a meter does; paint
 * frames in order, and call `reset()` after jumping to another time.
 */
export class Painter {
  // Each sound layer eases on its own, so two of them never share a meter.
  private meters = new Map<string, Smoother>();
  /** The layers this painter draws, bottom first. */
  readonly layers: Layer[];
  /** Whether layers come in and leave at their times, as they do while the clip plays and in the export. Off while
   *  the picture is edited, so every layer shows as it ends up. */
  animate = true;

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
    const motion = motionAt(layer, time, this.animate);
    if (!motion) return;
    const w = layer.w * width;
    const h = layer.h * height;
    const box = { x: -w / 2, y: -h / 2, width: w, height: h };
    const { theme } = this.scene;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity ?? 1)) * motion.alpha;
    ctx.translate((layer.x + layer.w / 2) * width + motion.dx * w, (layer.y + layer.h / 2) * height + motion.dy * h);
    if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
    if (motion.scale !== 1) ctx.scale(motion.scale, motion.scale);
    if (layer.kind === "avatar") this.paintAvatar(ctx, box, font);
    else if (layer.kind === "visual") this.paintVisual(ctx, box, time, paintOf(layer.color, theme, "accent"), unit, layer.visual ?? this.scene.visual, this.meterFor(layer.id));
    else if (layer.kind === "captions") this.paintCaptions(ctx, box, time, layer, font, unit);
    else if (layer.kind === "image" || layer.kind === "video") {
      const image = this.scene.images?.get(layer.image ?? "");
      if (image) {
        if (layer.radius) {
          roundRect(ctx, box.x, box.y, w, h, layer.radius * Math.min(w, h));
          ctx.clip();
        }
        if (layer.flipX || layer.flipY) ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
        if (layer.adjust) ctx.filter = filterOf(layer.adjust, unit);
        drawCover(ctx, image, box);
      }
    } else if (layer.kind === "shape") {
      ctx.fillStyle = paintOf(layer.fill, theme, "accent");
      shapePath(ctx, layer.shape, box, (layer.radius ?? 0) * Math.min(w, h));
      ctx.fill();
    } else {
      const text = this.textOf(layer, time);
      // A typed-in layer shows its words a letter at a time.
      this.paintText(ctx, box, layer, motion.reveal < 1 ? [...text].slice(0, Math.round(motion.reveal * [...text].length)).join("") : text, font, unit);
    }
    ctx.restore();
  }

  /** Words drawn with a layer's effects: the colour behind the line first, then the outline, then the letters. */
  private drawWords(ctx: CanvasRenderingContext2D, layer: Layer, text: string, x: number, y: number, size: number, maxWidth?: number) {
    const { theme } = this.scene;
    if (layer.background) {
      const width = Math.min(maxWidth ?? Infinity, ctx.measureText(text).width);
      const left = ctx.textAlign === "center" ? x - width / 2 : ctx.textAlign === "right" ? x - width : x;
      const top = ctx.textBaseline === "top" ? y : y - size * 0.6;
      const fill = ctx.fillStyle;
      ctx.fillStyle = paintOf(layer.background, theme, "accent");
      roundRect(ctx, left - size * 0.22, top - size * 0.08, width + size * 0.44, size * 1.24, size * 0.18);
      ctx.fill();
      ctx.fillStyle = fill;
    }
    if (layer.shadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = size * 0.28;
      ctx.shadowOffsetY = size * 0.06;
    }
    if (layer.outline) {
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1, size * 0.14);
      ctx.strokeStyle = paintOf(layer.outline, theme, "text");
      ctx.strokeText(text, x, y, maxWidth);
      // One shadow, under the outline, not a second under the letters.
      ctx.shadowColor = "transparent";
    }
    ctx.fillText(text, x, y, maxWidth);
    ctx.shadowColor = "transparent";
  }

  /** What a text layer says: the scene's own words for the built-in ones, its own for the rest. */
  textOf(layer: Layer, time: number): string {
    const scene = this.scene;
    if (layer.kind === "name") return scene.speaker;
    if (layer.kind === "handle") return scene.handle;
    if (layer.kind === "title") return scene.title;
    if (layer.kind === "links") return (scene.links ?? []).map((link) => link.trim()).filter(Boolean).slice(0, 3).join("  ·  ");
    if (layer.kind === "time") return `${clock(Math.min(this.duration, Math.max(0, time)))} / ${clock(Math.round(this.duration))}`;
    return layer.text ?? "";
  }

  private paintText(ctx: CanvasRenderingContext2D, box: Box, layer: Layer, text: string, font: string, unit: number) {
    if (!text) return;
    if (layer.uppercase) text = text.toLocaleUpperCase();
    const quiet = layer.kind === "handle" || layer.kind === "links" || layer.kind === "time";
    ctx.font = fontOf(layer, font, unit, layer.kind === "title" ? 700 : 400);
    ctx.fillStyle = paintOf(layer.color, this.scene.theme, quiet ? "muted" : "text");
    const align = layer.align ?? "left";
    ctx.textAlign = align;
    const x = align === "center" ? box.x + box.width / 2 : align === "right" ? box.x + box.width : box.x;
    const size = (layer.size ?? 40) * unit;
    if (SINGLE_LINE.has(layer.kind)) {
      ctx.textBaseline = "middle";
      this.drawWords(ctx, layer, text, x, box.y + box.height / 2, size, box.width);
      return;
    }
    ctx.textBaseline = "top";
    const lineHeight = size * 1.15;
    let lines = textLines(ctx, text, box.width);
    // A title keeps to the lines its box has room for; free text runs as long as it is.
    if (layer.kind === "title") lines = lines.slice(0, Math.max(1, Math.floor(box.height / lineHeight + 0.05)));
    lines.forEach((line, index) => line && this.drawWords(ctx, layer, line, x, box.y + index * lineHeight, size));
  }

  private paintAvatar(ctx: CanvasRenderingContext2D, box: Box, font: string) {
    const { theme, cover, speaker, handle } = this.scene;
    const radius = Math.min(box.width, box.height) / 2;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    if (cover) return drawCircle(ctx, cover, cx, cy, radius);
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.onAccent;
    ctx.font = `700 ${Math.round(radius * 0.9)}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((speaker || handle || "?").replace(/^@/, "").charAt(0).toUpperCase(), cx, cy + radius * 0.04);
  }

  private level(time: number, window = 0.05): number {
    const { samples, sampleRate, start } = this.scene.audio;
    const center = (start + time) * sampleRate;
    return Math.min(1, rms(samples, center - (window * sampleRate) / 2, center + (window * sampleRate) / 2) * 4.2);
  }

  private paintVisual(ctx: CanvasRenderingContext2D, area: Box, time: number, color: string, unit: number, visual: Visual, meter: Smoother) {
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

  private paintCaptions(ctx: CanvasRenderingContext2D, area: Box, time: number, layer: Layer, font: string, unit: number) {
    const { captions, theme } = this.scene;
    // Between captions, the next one shows a moment before it is said, and the last one stays a moment after.
    let index = cueAt(captions, time);
    if (index < 0) index = captions.findIndex((cue) => cue.start > time && cue.start - time < 1.5);
    if (index < 0) index = captions.findLastIndex((cue) => cue.end <= time && time - cue.end < 0.8);
    if (index < 0) return;
    const cue = captions[index];
    const words = timeWords(cue);
    const size = Math.round((layer.size ?? 62) * unit);
    const highlight = paintOf(layer.highlight, theme, "accent");
    const onHighlight = layer.highlight && layer.highlight !== "accent" ? inkOn(highlight) : theme.onAccent;
    const said = paintOf(layer.color, theme, "text");
    ctx.font = fontOf(layer, font, unit, 650);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const space = ctx.measureText(" ").width;
    const lineHeight = size * 1.34;
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
        const done = time >= word.end;
        const saying = time >= word.start && time < word.end;
        if (saying) {
          ctx.fillStyle = highlight;
          roundRect(ctx, x - size * 0.14, y - size * 0.62, word.width + size * 0.28, size * 1.24, 10 * unit);
          ctx.fill();
        }
        ctx.fillStyle = saying ? onHighlight : done ? said : theme.muted;
        this.drawWords(ctx, wordStyle, word.text, x, y, size);
        x += word.width + space;
      }
    });
  }
}
