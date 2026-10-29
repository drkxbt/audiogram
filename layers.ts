/* The frame as layers that can be moved, sized, turned and restyled, the way a design tool treats them. Positions are
   fractions of the frame's width and height, so a layout survives any export size. Free of the DOM, so it can be tested
   on its own. */

import type { Layout, Visual } from "./render.js";

export type LayerKind = "avatar" | "name" | "handle" | "title" | "visual" | "time" | "captions" | "links" | "text" | "image" | "video" | "shape" | "graphic";

export type ShapeKind = "rect" | "ellipse" | "triangle" | "star" | "heart" | "arrow" | "diamond" | "bubble" | "pentagon" | "hexagon" | "octagon" | "cross" | "parallelogram" | "arch" | "line";

/** How a layer comes in when its time starts, or goes as it ends. */
export type Entrance = "fade" | "rise" | "pan" | "slide" | "pop" | "wipe" | "blur" | "zoom" | "breathe" | "baseline" | "drift" | "tumble" | "stomp" | "bounce" | "flicker" | "typewriter";

/** A movement that repeats for as long as the layer shows. */
export type Loop = "pulse" | "wiggle" | "rotate" | "float";

/** A look for words, one at a time, beyond the shadow, outline and colour behind them. */
export type TextEffect = "lift" | "hollow" | "splice" | "echo" | "glitch" | "neon";

/** A drawing made of paths in a `w` by `h` box; "currentColor" in a path takes the layer's colour. */
export interface Art {
  w: number;
  h: number;
  paths: Array<{ d: string; fill?: string; stroke?: string; width?: number; rule?: "evenodd" }>;
}

/** Where a picture sits in its box when it is cropped: zoomed in by `zoom`, moved by `x` and `y` from -1 to 1. */
export interface Crop {
  x: number;
  y: number;
  zoom: number;
}

/** A picture's tone: 1 leaves brightness, contrast and colour as they are; blur is in pixels of a 1080 frame. */
export interface Adjust {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
}

/** A colour as CSS, or one of the theme's own, so a layer follows the theme until it is given a colour of its own. */
export type Paint = string;

export interface Layer {
  id: string;
  kind: LayerKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, clockwise about the layer's centre. */
  rotation: number;
  opacity: number;
  hidden?: boolean;
  locked?: boolean;
  /** For a text layer, what it says. */
  text?: string;
  /** A font family as the canvas takes it; the scene's font when left out. */
  font?: string;
  /** In pixels of a frame whose shorter side is 1080. */
  size?: number;
  weight?: number;
  italic?: boolean;
  align?: "left" | "center" | "right";
  color?: Paint;
  /** Captions: the colour behind the word being said. */
  highlight?: Paint;
  /** For an image or a video layer, the key of its picture or video. */
  image?: string;
  /** Corners, as a share of the shorter side: 0.5 makes a circle of a square. */
  radius?: number;
  shape?: ShapeKind;
  fill?: Paint;
  /** A sound layer's own look; the scene's when left out. */
  visual?: Visual;
  /** Pictures and videos: mirrored across, or upside down. */
  flipX?: boolean;
  flipY?: boolean;
  adjust?: Adjust;
  /** Words: a soft shadow under them, an outline round each letter, a colour behind each line, all in capitals. */
  shadow?: boolean;
  outline?: Paint;
  background?: Paint;
  uppercase?: boolean;
  /** Words: one of the styled looks, with the colour it uses where it has one. */
  effect?: TextEffect;
  effectColor?: Paint;
  underline?: boolean;
  strike?: boolean;
  /** Thousandths of the font size between letters, as design tools count it. */
  letterSpacing?: number;
  /** Lines apart, as a multiple of the font size; 1.15 when left out. */
  lineHeight?: number;
  list?: "bullet" | "number";
  /** Bends one line of words along an arc, from -100 (a frown) to 100 (a smile). */
  curve?: number;
  /** Shapes: a border, in pixels of a 1080 frame, solid, dashed or dotted. Lines take `fill` as their colour. */
  stroke?: Paint;
  strokeWidth?: number;
  dash?: "solid" | "dashed" | "dotted";
  arrowStart?: boolean;
  arrowEnd?: boolean;
  /** Pictures: the shape the picture is cut to, where it sits when cropped, and a ready-made look. */
  mask?: ShapeKind;
  crop?: Crop;
  filter?: string;
  /** A graphic's drawing. */
  art?: Art;
  /** Layers with the same group are picked, moved and copied together. */
  group?: string;
  /** How it comes in, goes, and moves while it shows, how fast, and the seconds into the clip it shows from and until;
   *  the whole clip when left out. */
  enter?: Entrance;
  exit?: Entrance;
  loop?: Loop;
  speed?: number;
  from?: number;
  until?: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The theme colours a layer can name instead of a CSS colour. */
export const THEME_PAINTS = ["text", "muted", "accent", "onAccent", "background"] as const;

export const FRAME_SIZES: Record<Layout, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
};

/** The classic layout, as layers: a name card at the top, the visual, the captions, and the links along the bottom. */
export function defaultLayers(layout: Layout): Layer[] {
  const { width, height } = FRAME_SIZES[layout];
  const unit = Math.min(width, height) / 1080;
  const pad = Math.round(Math.min(width, height) * 0.074);
  const box = (id: LayerKind, x: number, y: number, w: number, h: number, style: Partial<Layer> = {}): Layer => ({
    id,
    kind: id,
    x: x / width,
    y: y / height,
    w: w / width,
    h: h / height,
    rotation: 0,
    opacity: 1,
    ...style,
  });
  const radius = Math.round(84 * unit);
  const landscape = layout === "landscape";
  const column = landscape ? { x: pad, y: pad, w: width * 0.36, h: height - pad * 2 } : { x: pad, y: pad, w: width - pad * 2, h: 0 };
  const nameX = column.x + radius * 2 + Math.round(32 * unit);
  const titleSize = landscape ? 64 : 58;
  const titleTop = column.y + radius * 2 + Math.round(26 * unit);
  const titleLines = landscape ? 4 : 2;
  const layers: Layer[] = [
    box("avatar", column.x, column.y, radius * 2, radius * 2),
    box("name", nameX, column.y + radius - 56 * unit, column.x + column.w - nameX, 56 * unit, { size: 46, weight: 650, color: "text", align: "left" }),
    box("handle", nameX, column.y + radius + 12 * unit, column.x + column.w - nameX, 44 * unit, { size: 36, weight: 450, color: "muted", align: "left" }),
    box("title", column.x, titleTop, column.w, titleSize * unit * 1.15 * titleLines + 2 * unit, { size: titleSize, weight: 700, color: "text", align: "left" }),
  ];
  const label = 26 * unit * 1.6;
  if (landscape) {
    const rightX = column.x + column.w + pad;
    const right = { x: rightX, y: pad, w: width - rightX - pad, h: height - pad * 2 };
    const visual = right.h * 0.42;
    layers.push(
      box("visual", right.x, right.y, right.w, visual - label, { color: "accent" }),
      box("time", right.x, right.y + visual - label, right.w, label, { size: 26, weight: 500, color: "muted", align: "center" }),
      box("captions", right.x, right.y + right.h * 0.48, right.w, right.h * 0.44, { size: 60, weight: 650, color: "text", highlight: "accent", align: "left" }),
    );
  } else {
    const inner = width - pad * 2;
    const header = height * (layout === "story" ? 0.2 : layout === "portrait" ? 0.24 : 0.25);
    const visual = height * (layout === "story" ? 0.2 : layout === "portrait" ? 0.26 : 0.22);
    const visualTop = pad + header + pad * 0.4;
    const captionsTop = visualTop + visual + pad * 0.5;
    layers.push(
      box("visual", pad, visualTop, inner, visual - label, { color: "accent" }),
      box("time", pad, visualTop + visual - label, inner, label, { size: 26, weight: 500, color: "muted", align: "center" }),
      box("captions", pad, captionsTop, inner, height - captionsTop - pad * 1.4, { size: 62, weight: 650, color: "text", highlight: "accent", align: "center" }),
    );
  }
  const footer = height - pad * (landscape ? 0.6 : 0.68);
  layers.push(box("links", pad, footer - 22 * unit, width - pad * 2, 44 * unit, { size: 28, weight: 500, color: "muted", align: "center" }));
  return layers;
}

/** Where a point in frame fractions falls in a layer's own unturned box, about its centre, in pixels. */
function local(layer: Box & { rotation: number }, x: number, y: number, width: number, height: number) {
  const cx = (layer.x + layer.w / 2) * width;
  const cy = (layer.y + layer.h / 2) * height;
  const angle = (-layer.rotation * Math.PI) / 180;
  const dx = x * width - cx;
  const dy = y * height - cy;
  return { x: dx * Math.cos(angle) - dy * Math.sin(angle), y: dx * Math.sin(angle) + dy * Math.cos(angle) };
}

/** The topmost shown layer at a point, in frame fractions, on a frame `width` by `height`. A locked one is found too, so
 *  it can be picked and unlocked; it just doesn't move. */
export function layerAt(layers: Layer[], x: number, y: number, width: number, height: number): Layer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.hidden) continue;
    const point = local(layer, x, y, width, height);
    if (Math.abs(point.x) <= (layer.w * width) / 2 && Math.abs(point.y) <= (layer.h * height) / 2) return layer;
  }
  return null;
}

export interface Guide {
  axis: "x" | "y";
  /** Where the line runs, as a fraction of the frame. */
  at: number;
}

/**
 * A box being moved, pulled onto the frame's centre and edges and onto the edges and centres of `others` when within
 * `reach` pixels, with the lines it lined up on.
 */
export function snapMove(box: Box, others: Box[], width: number, height: number, reach = 6): Box & { guides: Guide[] } {
  const guides: Guide[] = [];
  const snap = (axis: "x" | "y", start: number, size: number, scale: number) => {
    const targets = [0, 0.5, 1, ...others.flatMap((other) => (axis === "x" ? [other.x, other.x + other.w / 2, other.x + other.w] : [other.y, other.y + other.h / 2, other.y + other.h]))];
    let best: { shift: number; at: number } | null = null;
    for (const edge of [start, start + size / 2, start + size]) {
      for (const target of targets) {
        const shift = target - edge;
        if (Math.abs(shift) * scale <= reach && (!best || Math.abs(shift) < Math.abs(best.shift))) best = { shift, at: target };
      }
    }
    if (!best) return start;
    guides.push({ axis, at: best.at });
    return start + best.shift;
  };
  return { ...box, x: snap("x", box.x, box.w, width), y: snap("y", box.y, box.h, height), guides };
}

/** A layer moved by `dx`, `dy` frame fractions, never wholly off the frame: a tenth of it always stays to grab. */
export function moveLayer<T extends Box>(layer: T, dx: number, dy: number): T {
  const keep = (start: number, size: number) => Math.min(1 - size * 0.1, Math.max(-size * 0.9, start));
  return { ...layer, x: keep(layer.x + dx, layer.w), y: keep(layer.y + dy, layer.h) };
}

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/**
 * A layer resized by pulling `handle` by `dx`, `dy` frame fractions, the opposite edge or corner staying put. With
 * `keepShape` a corner pull keeps the box's proportions. It never shrinks below a sliver.
 */
export function resizeLayer<T extends Box>(layer: T, handle: Handle, dx: number, dy: number, keepShape: boolean): T {
  const least = 0.02;
  let { x, y, w, h } = layer;
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");
  let dw = east ? dx : west ? -dx : 0;
  let dh = south ? dy : north ? -dy : 0;
  if (keepShape && (east || west) && (north || south)) {
    const grow = Math.abs(dw / w) > Math.abs(dh / h) ? dw / w : dh / h;
    dw = w * grow;
    dh = h * grow;
  }
  // Only a side being pulled is held to a sliver; the other keeps its size, so a thin line stays thin.
  const nextW = dw ? Math.max(least, w + dw) : w;
  const nextH = dh ? Math.max(least, h + dh) : h;
  if (west) x += w - nextW;
  if (north) y += h - nextH;
  w = nextW;
  h = nextH;
  return { ...layer, x, y, w, h };
}

/**
 * A turned layer resized by a pointer moved `dx`, `dy` screen pixels on a frame `width` by `height`: the pull is taken
 * along the layer's own sides, and the side or corner opposite the handle stays where it was on screen.
 */
export function resizeTurned<T extends Box & { rotation: number }>(layer: T, handle: Handle, dx: number, dy: number, keepShape: boolean, width: number, height: number): T {
  const angle = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const next = resizeLayer(layer, handle, (dx * cos + dy * sin) / width, (-dx * sin + dy * cos) / height, keepShape);
  // The far side's middle, or the far corner, in screen pixels.
  const anchor = (box: Box) => {
    const ax = (handle.includes("e") ? -box.w / 2 : handle.includes("w") ? box.w / 2 : 0) * width;
    const ay = (handle.includes("s") ? -box.h / 2 : handle.includes("n") ? box.h / 2 : 0) * height;
    return { x: (box.x + box.w / 2) * width + ax * cos - ay * sin, y: (box.y + box.h / 2) * height + ax * sin + ay * cos };
  };
  const before = anchor(layer);
  const after = anchor(next);
  return { ...next, x: next.x + (before.x - after.x) / width, y: next.y + (before.y - after.y) / height };
}

/** A layer turned to face the pointer from its centre, upright when the pointer is straight above; `step` snaps to 15°, and it settles on quarter turns. */
export function rotateLayer<T extends Box & { rotation: number }>(layer: T, x: number, y: number, width: number, height: number, step: boolean): T {
  const cx = (layer.x + layer.w / 2) * width;
  const cy = (layer.y + layer.h / 2) * height;
  let degrees = (Math.atan2(x * width - cx, -(y * height - cy)) * 180) / Math.PI;
  if (step) degrees = Math.round(degrees / 15) * 15;
  // Upright and each quarter turn hold the layer when it comes within a few degrees, since a finger has no Shift.
  else if (Math.abs(degrees - Math.round(degrees / 90) * 90) <= 4) degrees = Math.round(degrees / 90) * 90;
  return { ...layer, rotation: ((degrees % 360) + 360) % 360 };
}

export type PageEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

/** A layer moved to an edge or the middle of the page, by the box it takes up on screen when turned. */
export function alignToPage<T extends Box & { rotation: number }>(layer: T, edge: PageEdge, width: number, height: number): T {
  const angle = (layer.rotation * Math.PI) / 180;
  const w = layer.w * width;
  const h = layer.h * height;
  // Half the width and height of the box the turned layer fills, in fractions of the frame.
  const halfX = (Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))) / 2 / width;
  const halfY = (Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))) / 2 / height;
  let cx = layer.x + layer.w / 2;
  let cy = layer.y + layer.h / 2;
  if (edge === "left") cx = halfX;
  else if (edge === "center") cx = 0.5;
  else if (edge === "right") cx = 1 - halfX;
  else if (edge === "top") cy = halfY;
  else if (edge === "middle") cy = 0.5;
  else cy = 1 - halfY;
  return { ...layer, x: cx - layer.w / 2, y: cy - layer.h / 2 };
}

/** Where a layer is in its movement, for one frame: its fade, its shift as shares of its own size, its scale and turn
 *  in degrees, a blur in pixels of a 1080 frame, the share of it uncovered from the left, the share of its words shown
 *  so far, and whether it is held inside its own box while it moves. */
export interface Motion {
  alpha: number;
  dx: number;
  dy: number;
  scale: number;
  rotate: number;
  blur: number;
  clip: number;
  reveal: number;
  boxed: boolean;
}

// Seconds each movement takes at its usual speed: most come in in a little over half a second; a slow one, or letters
// typed one at a time, take longer.
const DURATIONS: Partial<Record<Entrance, number>> = { breathe: 1.2, drift: 1.4, typewriter: 1.4, bounce: 1, flicker: 0.8 };
const DURATION = 0.6;
const SETTLED: Motion = { alpha: 1, dx: 0, dy: 0, scale: 1, rotate: 0, blur: 0, clip: 1, reveal: 1, boxed: false };

const easeOut = (p: number) => 1 - (1 - p) ** 3;
// Past its size and back, the way a sticker lands.
const overshoot = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;
// A ball dropped onto the floor: three bounces, each lower.
function bounced(p: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
}

/** A movement `p` of the way through, from 0 (just starting) to 1 (settled), as changes to the settled layer. */
function moving(way: Entrance, p: number): Partial<Motion> {
  const e = easeOut(p);
  switch (way) {
    case "fade":
      return { alpha: e };
    case "rise":
      return { alpha: e, dy: (1 - e) * 0.4 };
    case "pan":
    case "slide":
      return { alpha: e, dx: (e - 1) * 0.4 };
    case "pop":
      return { alpha: Math.min(1, p * 3), scale: 0.5 + 0.5 * overshoot(p) };
    case "wipe":
      return { clip: e };
    case "blur":
      return { alpha: e, blur: (1 - e) * 24 };
    case "zoom":
      return { alpha: e, scale: 1 + (1 - e) * 0.35, blur: (1 - e) * 10 };
    case "breathe":
      return { alpha: e, scale: 0.85 + 0.15 * e };
    case "baseline":
      return { dy: (1 - e) * 1.1, boxed: p < 1 };
    case "drift":
      return { alpha: e, dx: (e - 1) * 0.12 };
    case "tumble":
      return { alpha: e, rotate: (1 - e) * -90, scale: 0.6 + 0.4 * e };
    case "stomp":
      return { alpha: Math.min(1, p * 4), scale: 1.8 - 0.8 * overshoot(p) };
    case "bounce":
      return { alpha: Math.min(1, p * 4), dy: -(1 - bounced(p)) * 0.6 };
    case "flicker":
      return { alpha: p >= 1 ? 1 : [0, 1, 0.15, 1, 0.45, 1][Math.min(5, Math.floor(p * 6))] };
    case "typewriter":
      return { reveal: p };
  }
}

/** A repeating movement `t` seconds after the layer appeared. */
function looping(loop: Loop, t: number): Partial<Motion> {
  if (loop === "pulse") return { scale: 1 + 0.04 * Math.sin((2 * Math.PI * t) / 1.2) };
  if (loop === "wiggle") return { rotate: 4 * Math.sin((2 * Math.PI * t) / 0.6) };
  if (loop === "rotate") return { rotate: (t * 90) % 360 };
  return { dy: 0.03 * Math.sin((2 * Math.PI * t) / 2) };
}

/** Two movements at once: fades and scales multiply, shifts and turns add, the least uncovered wins. */
function combine(a: Motion, b: Partial<Motion>): Motion {
  return {
    alpha: a.alpha * (b.alpha ?? 1),
    dx: a.dx + (b.dx ?? 0),
    dy: a.dy + (b.dy ?? 0),
    scale: a.scale * (b.scale ?? 1),
    rotate: a.rotate + (b.rotate ?? 0),
    blur: a.blur + (b.blur ?? 0),
    clip: Math.min(a.clip, b.clip ?? 1),
    reveal: Math.min(a.reveal, b.reveal ?? 1),
    boxed: a.boxed || (b.boxed ?? false),
  };
}

/**
 * A layer at `time` seconds into a clip `length` seconds long. While the clip plays it shows only between its times,
 * coming in, going and moving in its own ways; a layer with no end of its own goes as the clip ends. While it is
 * edited every layer is shown as it ends up, faint when the playhead is outside its times. Null means it isn't drawn.
 */
export function motionAt(layer: Pick<Layer, "enter" | "exit" | "loop" | "speed" | "from" | "until">, time: number, playing: boolean, length = Infinity): Motion | null {
  const from = layer.from ?? 0;
  const until = layer.until ?? length;
  const inside = time >= from && time <= until;
  if (!playing) return inside ? SETTLED : { ...SETTLED, alpha: 0.3 };
  if (!inside) return null;
  const speed = Math.min(4, Math.max(0.25, layer.speed ?? 1));
  const span = (way: Entrance) => (DURATIONS[way] ?? DURATION) / speed;
  let motion = SETTLED;
  if (layer.enter) motion = combine(motion, moving(layer.enter, Math.min(1, Math.max(0, (time - from) / span(layer.enter)))));
  if (layer.exit && Number.isFinite(until)) motion = combine(motion, moving(layer.exit, Math.min(1, Math.max(0, (until - time) / span(layer.exit)))));
  if (layer.loop) motion = combine(motion, looping(layer.loop, (time - from) * speed));
  return motion;
}
