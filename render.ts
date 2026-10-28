import { cueAt, timeWords, type Cue } from "./captions.js";
import { rms, Smoother, spectrum } from "./wave.js";

export type Layout = "square" | "portrait" | "landscape";
export type Visual = "bars" | "wave" | "pulse";

/** Video sizes that X shows without cropping. */
export const SIZES: Record<Layout, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1920, height: 1080 },
};

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
  /** The recording as one mono channel, and the stretch of it the clip covers, in seconds. */
  audio: { samples: Float32Array; sampleRate: number; start: number; end: number };
  font?: string;
  /** Drawn over every frame, last, in the preview and the export alike. */
  overlay?: Overlay;
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

/** Where each part of the frame goes, for each shape of video. */
function arrange(layout: Layout, width: number, height: number) {
  const pad = Math.round(Math.min(width, height) * 0.074);
  if (layout === "landscape") {
    const left = { x: pad, y: pad, width: width * 0.36, height: height - pad * 2 };
    const rightX = left.x + left.width + pad;
    const right = { x: rightX, y: pad, width: width - rightX - pad, height: height - pad * 2 };
    return {
      pad,
      header: { ...left, height: left.height * 0.62 },
      visual: { ...right, height: right.height * 0.42 },
      captions: { ...right, y: right.y + right.height * 0.48, height: right.height * 0.44 },
      progress: { x: pad, y: height - pad * 0.62, width: width - pad * 2, height: 6 },
      stacked: false,
    };
  }
  const inner = width - pad * 2;
  const headerHeight = height * (layout === "portrait" ? 0.24 : 0.25);
  const visualHeight = height * (layout === "portrait" ? 0.26 : 0.22);
  const header = { x: pad, y: pad, width: inner, height: headerHeight };
  const visual = { x: pad, y: header.y + headerHeight + pad * 0.4, width: inner, height: visualHeight };
  const captionsTop = visual.y + visualHeight + pad * 0.5;
  return {
    pad,
    header,
    visual,
    captions: { x: pad, y: captionsTop, width: inner, height: height - captionsTop - pad * 1.4 },
    progress: { x: pad, y: height - pad * 0.7, width: inner, height: 6 },
    stacked: true,
  };
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

function sizeOf(source: CanvasImageSource): { width: number; height: number } {
  const item = source as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number; width?: number | { baseVal: { value: number } }; height?: number | { baseVal: { value: number } } };
  const width = item.naturalWidth || item.videoWidth || (typeof item.width === "number" ? item.width : 0);
  const height = item.naturalHeight || item.videoHeight || (typeof item.height === "number" ? item.height : 0);
  return { width, height };
}

/** Draws a picture into a circle, filling it the way object-fit: cover does. */
function drawCircle(ctx: CanvasRenderingContext2D, image: CanvasImageSource, cx: number, cy: number, radius: number) {
  const { width, height } = sizeOf(image);
  if (!width || !height) return;
  const scale = (radius * 2) / Math.min(width, height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, cx - (width * scale) / 2, cy - (height * scale) / 2, width * scale, height * scale);
  ctx.restore();
}

/**
 * Paints frames of a clip. It keeps a little state from frame to frame, so the bars ease the way a meter does; paint
 * frames in order, and call `reset()` after jumping to another time.
 */
export class Painter {
  private meter = new Smoother(0.55, 0.16);

  constructor(public scene: Scene) {}

  reset(): void {
    this.meter.reset();
  }

  /** The clip's length in seconds. */
  get duration(): number {
    return Math.max(0, this.scene.audio.end - this.scene.audio.start);
  }

  paint(ctx: CanvasRenderingContext2D, time: number): void {
    const { width, height } = ctx.canvas;
    const scene = this.scene;
    const { theme } = scene;
    const font = scene.font ?? "Geist, ui-sans-serif, system-ui, sans-serif";
    const box = arrange(scene.layout, width, height);
    const unit = Math.min(width, height) / 1080;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, theme.background);
    gradient.addColorStop(1, theme.shade);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    this.paintHeader(ctx, box.header, box.stacked, font, unit);
    this.paintVisual(ctx, box.visual, time, unit);
    this.paintCaptions(ctx, box.captions, time, font, unit);

    // How far through the clip, along the bottom.
    const progress = this.duration ? Math.min(1, Math.max(0, time / this.duration)) : 0;
    ctx.fillStyle = theme.muted;
    ctx.globalAlpha = 0.28;
    roundRect(ctx, box.progress.x, box.progress.y, box.progress.width, box.progress.height, box.progress.height / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.accent;
    roundRect(ctx, box.progress.x, box.progress.y, Math.max(box.progress.height, box.progress.width * progress), box.progress.height, box.progress.height / 2);
    ctx.fill();

    if (scene.overlay) {
      ctx.save();
      scene.overlay(ctx, { time, duration: this.duration, width, height, unit, theme, font });
      ctx.restore();
    }
  }

  private paintHeader(ctx: CanvasRenderingContext2D, area: Box, stacked: boolean, font: string, unit: number) {
    const { theme, cover, speaker, handle, title } = this.scene;
    const radius = Math.round(84 * unit);
    const cx = area.x + radius;
    const cy = area.y + radius;
    if (cover) drawCircle(ctx, cover, cx, cy, radius);
    else {
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
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const nameX = cx + radius + Math.round(32 * unit);
    ctx.fillStyle = theme.text;
    ctx.font = `650 ${Math.round(46 * unit)}px ${font}`;
    ctx.fillText(speaker, nameX, cy - 6 * unit, area.x + area.width - nameX);
    ctx.fillStyle = theme.muted;
    ctx.font = `450 ${Math.round(36 * unit)}px ${font}`;
    ctx.fillText(handle, nameX, cy + 44 * unit, area.x + area.width - nameX);

    if (!title) return;
    ctx.fillStyle = theme.text;
    const size = Math.round((stacked ? 58 : 64) * unit);
    ctx.font = `700 ${size}px ${font}`;
    const lines = wrap(ctx, title, area.width).slice(0, stacked ? 2 : 4);
    lines.forEach((line, index) => ctx.fillText(line, area.x, cy + radius + size * 1.35 + index * size * 1.12));
  }

  private level(time: number, window = 0.05): number {
    const { samples, sampleRate, start } = this.scene.audio;
    const center = (start + time) * sampleRate;
    return Math.min(1, rms(samples, center - (window * sampleRate) / 2, center + (window * sampleRate) / 2) * 4.2);
  }

  private paintVisual(ctx: CanvasRenderingContext2D, area: Box, time: number, unit: number) {
    const { theme, visual, audio } = this.scene;
    const middle = area.y + area.height / 2;
    ctx.fillStyle = theme.accent;
    ctx.strokeStyle = theme.accent;

    if (visual === "bars") {
      const count = 44;
      const center = Math.round((audio.start + time) * audio.sampleRate);
      const size = audio.sampleRate > 30000 ? 2048 : 1024;
      const raw = spectrum(audio.samples, audio.sampleRate, center, { size, bands: count / 2, low: 90, high: 5000 });
      const bands = this.meter.next(raw);
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
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillRect(area.x + area.width - 3 * unit, area.y + area.height * 0.08, 6 * unit, area.height * 0.84);
      return;
    }

    // Pulse: rings that swell with the voice.
    const level = this.meter.next(Float32Array.of(this.level(time)))[0];
    const cx = area.x + area.width / 2;
    const base = area.height * 0.2;
    for (let ring = 3; ring >= 1; ring--) {
      ctx.globalAlpha = 0.16 * ring;
      ctx.beginPath();
      ctx.arc(cx, middle, base + level * area.height * 0.11 * ring, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, middle, base * 0.86, 0, Math.PI * 2);
    ctx.fill();
  }

  private paintCaptions(ctx: CanvasRenderingContext2D, area: Box, time: number, font: string, unit: number) {
    const { captions, theme } = this.scene;
    // Between captions, the next one shows a moment before it is said, and the last one stays a moment after.
    let index = cueAt(captions, time);
    if (index < 0) index = captions.findIndex((cue) => cue.start > time && cue.start - time < 1.5);
    if (index < 0) index = captions.findLastIndex((cue) => cue.end <= time && time - cue.end < 0.8);
    if (index < 0) return;
    const cue = captions[index];
    const words = timeWords(cue);
    const size = Math.round(this.scene.layout === "landscape" ? 60 * unit : 62 * unit);
    ctx.font = `650 ${size}px ${font}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const space = ctx.measureText(" ").width;
    const lineHeight = size * 1.34;
    // Lay the words out in lines first, so each can be drawn, and the one being said marked, in its place.
    const lines: Array<Array<{ text: string; width: number; start: number; end: number }>> = [[]];
    let lineWidth = 0;
    for (const word of words) {
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
    shown.forEach((line, row) => {
      const total = line.reduce((sum, word) => sum + word.width, 0) + space * (line.length - 1);
      let x = this.scene.layout === "landscape" ? area.x : area.x + (area.width - total) / 2;
      const y = top + row * lineHeight;
      for (const word of line) {
        const said = time >= word.end;
        const saying = time >= word.start && time < word.end;
        if (saying) {
          ctx.fillStyle = theme.accent;
          roundRect(ctx, x - size * 0.14, y - size * 0.62, word.width + size * 0.28, size * 1.24, 10 * unit);
          ctx.fill();
        }
        ctx.fillStyle = saying ? theme.onAccent : said ? theme.text : theme.muted;
        ctx.fillText(word.text, x, y);
        x += word.width + space;
      }
    });
  }
}
