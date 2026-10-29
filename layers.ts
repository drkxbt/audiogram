/* The frame as layers that can be moved, sized, turned and restyled, the way a design tool treats them. Positions are
   fractions of the frame's width and height, so a layout survives any export size. Free of the DOM, so it can be tested
   on its own. */

import type { Layout, Visual } from "./render.js";

export type LayerKind = "avatar" | "name" | "handle" | "title" | "visual" | "time" | "captions" | "links" | "text" | "image" | "video" | "shape" | "graphic" | "chart" | "table" | "mockup" | "solid" | "ambient";

/** A chart's form: columns or bars, a line or the area under it, a pie or a donut, a ring or a bar of progress, one
 *  big number, or a poll of answers with their shares. */
export type ChartKind = "column" | "bar" | "line" | "area" | "pie" | "donut" | "ring" | "progress" | "number" | "poll";

/** A device or object a picture is shown in. */
export type Device = "phone" | "tablet" | "laptop" | "monitor" | "tv" | "browser" | "polaroid" | "vinyl";

/** A shaded form that looks solid. */
export type Solid = "sphere" | "cube" | "cylinder" | "cone" | "torus" | "pyramid" | "capsule";

/** A moving background drawn from the clip's time: soft lights, a drifting gradient, bokeh, rising specks, waves,
 *  slow rays, a receding grid, or film grain. */
export type Ambient = "aurora" | "flow" | "bokeh" | "particles" | "waves" | "rays" | "grid" | "grain";

/** One row of a chart's data. */
export interface Datum {
  label: string;
  value: number;
  color?: Paint;
}

export type ShapeKind =
  | "rect" | "ellipse" | "triangle" | "star" | "heart" | "arrow" | "diamond" | "bubble" | "pentagon" | "hexagon" | "octagon" | "cross" | "parallelogram" | "arch" | "line"
  | "burst" | "sparkle" | "squircle" | "blob" | "ring" | "quote" | "banner" | "tag" | "chevron" | "cloud" | "moon" | "check";

/** How a layer comes in when its time starts, or goes as it ends. Some move words one at a time: ascend, shift and
 *  merge by the word, burst and cascade by the letter; on a layer without words they move it whole. */
export type Entrance =
  | "fade" | "rise" | "pan" | "slide" | "pop" | "wipe" | "blur" | "zoom" | "breathe" | "baseline" | "drift" | "tumble" | "stomp" | "bounce" | "flicker" | "typewriter"
  | "ascend" | "shift" | "merge" | "burst" | "cascade" | "spread" | "block" | "clarify" | "glide" | "roll" | "skate" | "elastic" | "flip" | "unfold" | "iris" | "curtain" | "fall" | "tectonic" | "scrapbook" | "shine"
  | "grow";

/** A movement that repeats for as long as the layer shows. */
export type Loop = "pulse" | "wiggle" | "rotate" | "float" | "sway" | "heartbeat" | "shimmer" | "flash" | "slowZoom";

/** The way a layer moves as it comes in: up means it rises into place. */
export type Direction = "up" | "down" | "left" | "right";

/** The ways in that move words one at a time, and whether by the word or the letter. */
export const UNIT_WAYS: Partial<Record<Entrance, "word" | "letter">> = { ascend: "word", shift: "word", merge: "word", burst: "letter", cascade: "letter" };

/** The ways in that take a direction, and the one each takes when none is set. */
export const DIRECTED: Partial<Record<Entrance, Direction>> = { rise: "up", pan: "right", slide: "right", wipe: "right", drift: "right", shift: "right", roll: "right", skate: "right", tectonic: "right", fall: "down", baseline: "up" };

/** How a time layer shows the clip's time: played and length ("0:16 / 1:00"), played ("0:16"), still to play ("-0:44"),
 *  or the share played ("27%"). */
export type Clock = "both" | "elapsed" | "remaining" | "percent";

/** A look for words, one at a time, beyond the shadow, outline and colour behind them. */
export type TextEffect = "lift" | "hollow" | "splice" | "echo" | "glitch" | "neon";

/** A drawing made of paths in a `w` by `h` box; "currentColor" in a path takes the layer's colour. A path's `opacity`
 *  is a fraction of the layer's own, as shaded emoji use for their highlights. */
export interface Art {
  w: number;
  h: number;
  paths: Array<{ d: string; fill?: string; stroke?: string; width?: number; rule?: "evenodd"; opacity?: number }>;
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
  /** Words: a soft shadow under them, an outline round each letter, a colour behind each line, all in capitals. A shape
   *  takes the shadow too, soft and faint under its outline. */
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
  /** Shapes: frosted glass. What lies under the shape shows through it blurred by this many pixels of a 1080 frame, 0
   *  to 60, tinted by its fill; the layer's opacity sets how strong the tint is, not the glass. */
  frost?: number;
  /** Time layers: what the clock shows; both when left out. */
  clock?: Clock;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  /** Lines: round ends, and a bend through the box from -100 (bowed down) to 100 (bowed up). */
  cap?: "round";
  bend?: number;
  /** Pictures: the shape the picture is cut to, where it sits when cropped, and a ready-made look. */
  mask?: ShapeKind;
  crop?: Crop;
  filter?: string;
  /** A graphic's drawing. */
  art?: Art;
  /** Words: the box hugs them, a new line only where one is typed; false once the user sets the width, when they wrap. */
  autoWidth?: boolean;
  /** A picture or video set as the page's background: it covers the page and stays under every other layer. */
  backdrop?: boolean;
  /** Charts: the form, its rows, the value a ring or progress bar is out of, words before and after each value, and
   *  whether to show the labels, the values and guide lines. `fill` colours the series, `stroke` the track and guides,
   *  `color` the words. */
  chart?: ChartKind;
  data?: Datum[];
  max?: number;
  prefix?: string;
  suffix?: string;
  showLabels?: boolean;
  showValues?: boolean;
  showGrid?: boolean;
  /** Tables: rows of cells, the first row as a header in `fill`, every other row tinted with `background`, and rules
   *  between rows or round every cell in `stroke`. */
  cells?: string[][];
  header?: boolean;
  stripes?: boolean;
  rules?: "none" | "rows" | "grid";
  /** Mockups: the device; its picture is `image`, its body colour `fill`, a polaroid's caption `text`. */
  device?: Device;
  /** Solids: the form, in `fill`, with a shine on it unless `gloss` is false; `shadow` false leaves out the shadow
   *  under it. */
  solid?: Solid;
  gloss?: boolean;
  /** Moving backgrounds: the style, how fast it moves (1 as made), and whether it swells with the voice; `fill` is its
   *  ground, `color` and `highlight` its two lights. */
  ambient?: Ambient;
  pace?: number;
  react?: boolean;
  /** Layers with the same group are picked, moved and copied together. */
  group?: string;
  /** How it comes in, goes, and moves while it shows, how fast, and the seconds into the clip it shows from and until;
   *  the whole clip when left out. */
  enter?: Entrance;
  exit?: Entrance;
  loop?: Loop;
  /** The way it moves as it comes in, for the ways that take one; it leaves the same way, carrying on. */
  direction?: Direction;
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

/** An image key that asks for one of the host's library photos by its id, as a template puts one in: "photo:" and the
 *  id. The picture is kept under the key itself once it is brought in. */
export const PHOTO_KEY = "photo:";

/** The library photos a set of layers asks for, each once, with the key it is drawn under. An id the library doesn't
 *  have is left out, so its layer just draws nothing. */
export function libraryPhotos<T extends { id: string }>(layers: ReadonlyArray<Pick<Layer, "image">>, photos: readonly T[] = []): Array<{ key: string; photo: T }> {
  const found = new Map<string, T>();
  for (const { image } of layers) {
    if (!image?.startsWith(PHOTO_KEY) || found.has(image)) continue;
    const id = image.slice(PHOTO_KEY.length);
    const photo = photos.find((item) => item.id === id);
    if (photo) found.set(image, photo);
  }
  return [...found].map(([key, photo]) => ({ key, photo }));
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

/** Whether a layer is a design's background: one set as the background, or, from before that was marked, a picture
 *  or a video filling the whole frame. */
export function isBackgroundLayer(layer: Layer): boolean {
  if (layer.backdrop) return true;
  return (layer.kind === "image" || layer.kind === "video") && !layer.rotation && layer.x <= 0.001 && layer.y <= 0.001 && layer.x + layer.w >= 0.999 && layer.y + layer.h >= 0.999;
}

/** A design's background, which always sits at the bottom of its layers, or null when it has none. */
export function backgroundOf(layers: Layer[]): Layer | null {
  return layers[0] && isBackgroundLayer(layers[0]) ? layers[0] : null;
}

/** Layers in painting order with any background first: whatever is added, pasted, moved forward or brought back by an
 *  undo lands above it. The same array comes back when it is already in order. */
export function stacked<T extends { backdrop?: boolean }>(layers: T[]): T[] {
  const first = layers.findIndex((layer) => !layer.backdrop);
  if (first < 0 || !layers.slice(first).some((layer) => layer.backdrop)) return layers;
  return [...layers.filter((layer) => layer.backdrop), ...layers.filter((layer) => !layer.backdrop)];
}

/** Whether a layer is a panel that covers most of the page, so a background set under it would hardly show. */
export function pageCovers(layer: Layer): boolean {
  return layer.kind === "shape" && layer.shape !== "line" && !layer.hidden && (layer.opacity ?? 1) >= 0.9 && !layer.rotation && layer.w * layer.h >= 0.7;
}

/** The layers with captions shown again when they were only hidden, brought to the top so nothing covers them; null
 *  when some are already showing or there are none to show. */
export function showCaptions(layers: Layer[]): Layer[] | null {
  if (layers.some((layer) => layer.kind === "captions" && !layer.hidden)) return null;
  const index = layers.findLastIndex((layer) => layer.kind === "captions");
  if (index < 0) return null;
  return [...layers.slice(0, index), ...layers.slice(index + 1), { ...layers[index], hidden: false }];
}

/** A layer given a new width `w` (a share of the frame's width) about the edge its words line up on: the left edge for
 *  left-aligned words, the middle for centred, the right edge for right-aligned, along the layer's own turn, so the
 *  words stay exactly where they were. */
export function widthAnchored<T extends Box & { rotation: number; align?: "left" | "center" | "right" }>(layer: T, w: number, width: number, height: number): T {
  const align = layer.align ?? "left";
  const shift = align === "center" ? 0 : ((w - layer.w) * width) / 2 * (align === "right" ? -1 : 1);
  const angle = (layer.rotation * Math.PI) / 180;
  const cx = (layer.x + layer.w / 2) * width + Math.cos(angle) * shift;
  const cy = (layer.y + layer.h / 2) * height + Math.sin(angle) * shift;
  return { ...layer, w, x: cx / width - w / 2, y: cy / height - layer.h / 2 };
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
 *  in degrees, a blur in pixels of a 1080 frame, the share of it uncovered and from where, the share of its words shown
 *  so far, and whether it is held inside its own box while it moves. Beyond those: a squeeze across, a block of colour
 *  sweeping over it, its words moving one at a time, letters spread apart by a share of the size, and a band of light
 *  crossing it. */
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
  sx: number;
  clipFrom: ClipFrom;
  /** How far a chart or table has grown in, from 0 to 1. */
  growth: number;
  block: number | null;
  units: { way: Entrance; p: number; direction: Direction } | null;
  spacing: number;
  shine: number | null;
}

/** Where an uncovering starts: an edge, the middle line across or down, or the centre as a growing circle. */
export type ClipFrom = "left" | "right" | "top" | "bottom" | "across" | "down" | "iris";

// Seconds each movement takes at its usual speed: most come in in a little over half a second; a slow one, or words
// and letters moving one at a time, take longer.
const DURATIONS: Partial<Record<Entrance, number>> = {
  breathe: 1.2, drift: 1.4, typewriter: 1.4, bounce: 1, flicker: 0.8,
  ascend: 1.1, shift: 1, merge: 1, burst: 1, cascade: 1.2, spread: 1, block: 0.9, clarify: 1, glide: 1.6, roll: 0.9,
  skate: 0.8, elastic: 1.1, flip: 0.7, unfold: 0.7, iris: 0.8, curtain: 0.8, fall: 0.8, tectonic: 0.8, scrapbook: 0.8, shine: 1.4, grow: 1.2,
};
const DURATION = 0.6;
const SETTLED: Motion = { alpha: 1, dx: 0, dy: 0, scale: 1, rotate: 0, blur: 0, clip: 1, reveal: 1, boxed: false, sx: 1, clipFrom: "left", growth: 1, block: null, units: null, spacing: 0, shine: null };

/** How long a way in takes at its usual speed, in seconds. */
export function entranceLength(way: Entrance): number {
  return DURATIONS[way] ?? DURATION;
}

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

// Springing past its mark and back a few times before it settles.
function elastic(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return 2 ** (-10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

/** The shift a layer starts from to move `direction`, as shares of its size: up starts below, right starts to the left. */
function startFrom(direction: Direction, distance: number): { dx: number; dy: number } {
  if (direction === "up") return { dx: 0, dy: distance };
  if (direction === "down") return { dx: 0, dy: -distance };
  if (direction === "left") return { dx: distance, dy: 0 };
  return { dx: -distance, dy: 0 };
}

const WIPE_FROM: Record<Direction, ClipFrom> = { right: "left", left: "right", down: "top", up: "bottom" };

/** A movement `p` of the way through, from 0 (just starting) to 1 (settled), as changes to the settled layer. Words
 *  that move one at a time are handed to the painter when `words` says the layer has them. */
function moving(way: Entrance, p: number, direction: Direction, words: boolean): Partial<Motion> {
  const e = easeOut(p);
  const from = (distance: number, eased = e) => {
    const start = startFrom(direction, distance);
    return { dx: start.dx * (1 - eased), dy: start.dy * (1 - eased) };
  };
  if (words && UNIT_WAYS[way]) return { units: { way, p, direction } };
  switch (way) {
    case "fade":
      return { alpha: e };
    case "rise":
    case "ascend":
    case "pan":
    case "slide":
    case "shift":
      return { alpha: e, ...from(0.4) };
    case "pop":
    case "burst":
      return { alpha: Math.min(1, p * 3), scale: 0.5 + 0.5 * overshoot(p) };
    case "merge":
      return { alpha: e, scale: 0.8 + 0.2 * e };
    case "cascade":
      return { alpha: e, dy: -(1 - e) * 0.5 };
    case "wipe":
      return { clip: e, clipFrom: WIPE_FROM[direction] };
    case "unfold":
      return { clip: e, clipFrom: "across" };
    case "curtain":
      return { clip: e, clipFrom: "down" };
    case "iris":
      return { clip: e, clipFrom: "iris" };
    case "block":
      return { alpha: p < 0.5 ? 0 : 1, block: p };
    case "spread":
      return { alpha: e, spacing: (1 - e) * 0.45, blur: (1 - e) * 6 };
    case "clarify":
      return { alpha: e, blur: (1 - e) * 18, scale: 1.12 - 0.12 * e };
    case "glide":
      return { alpha: e, ...from(0.14), blur: (1 - e) * 8 };
    case "roll":
      return { alpha: e, ...from(0.9), rotate: (1 - e) * (direction === "left" ? 360 : -360) };
    case "skate":
      return { alpha: Math.min(1, p * 3), ...from(0.5, overshoot(p)), rotate: (1 - e) * (direction === "left" ? 8 : -8) };
    case "elastic":
      return { alpha: Math.min(1, p * 4), scale: Math.max(0.001, elastic(p)) };
    case "flip":
      return { alpha: Math.min(1, p * 2), sx: Math.max(0.001, Math.sin((e * Math.PI) / 2)) };
    case "fall":
      return { alpha: e, ...from(0.5), rotate: (1 - e) * 6 };
    case "tectonic":
      return { alpha: Math.min(1, p * 4), ...from(0.3, overshoot(p)), rotate: (1 - overshoot(p)) * -4 };
    case "scrapbook":
      return { alpha: Math.min(1, p * 3), scale: 0.5 + 0.5 * overshoot(p), rotate: (1 - overshoot(p)) * 18 };
    case "shine":
      return { alpha: Math.min(1, p / 0.35), shine: p < 0.35 || p >= 1 ? null : (p - 0.35) / 0.65 };
    case "grow":
      return { alpha: Math.min(1, p * 4), growth: e };
    case "blur":
      return { alpha: e, blur: (1 - e) * 24 };
    case "zoom":
      return { alpha: e, scale: 1 + (1 - e) * 0.35, blur: (1 - e) * 10 };
    case "breathe":
      return { alpha: e, scale: 0.85 + 0.15 * e };
    case "baseline":
      return { ...from(1.1), boxed: p < 1 };
    case "drift":
      return { alpha: e, ...from(0.12) };
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
  const wave = (period: number) => Math.sin((2 * Math.PI * t) / period);
  if (loop === "pulse") return { scale: 1 + 0.04 * wave(1.2) };
  if (loop === "wiggle") return { rotate: 4 * wave(0.6) };
  if (loop === "rotate") return { rotate: (t * 90) % 360 };
  if (loop === "sway") return { rotate: 3 * wave(3.2) };
  if (loop === "heartbeat") {
    // Two beats close together, then a rest, the way a heart sounds.
    const phase = (t % 1.4) / 1.4;
    const beat = (at: number) => Math.exp(-(((phase - at) / 0.05) ** 2));
    return { scale: 1 + 0.07 * (beat(0.1) + 0.6 * beat(0.3)) };
  }
  if (loop === "shimmer") {
    // A band of light crosses in the first third of every 3.2 seconds.
    const phase = (t % 3.2) / 3.2;
    return { shine: phase < 0.34 ? phase / 0.34 : null };
  }
  if (loop === "flash") return { alpha: 0.7 + 0.3 * Math.cos((2 * Math.PI * t) / 1.6) };
  if (loop === "slowZoom") return { scale: 1 + 0.08 * ((1 - Math.cos((2 * Math.PI * t) / 20)) / 2) };
  return { dy: 0.03 * wave(2) };
}

/** Two movements at once: fades and scales multiply, shifts and turns add, the least uncovered wins, and the later of
 *  two sweeps, word movements or bands of light is the one drawn. */
function combine(a: Motion, b: Partial<Motion>): Motion {
  const clip = b.clip ?? 1;
  return {
    alpha: a.alpha * (b.alpha ?? 1),
    dx: a.dx + (b.dx ?? 0),
    dy: a.dy + (b.dy ?? 0),
    scale: a.scale * (b.scale ?? 1),
    rotate: a.rotate + (b.rotate ?? 0),
    blur: a.blur + (b.blur ?? 0),
    clip: Math.min(a.clip, clip),
    clipFrom: clip < a.clip ? b.clipFrom ?? "left" : a.clipFrom,
    reveal: Math.min(a.reveal, b.reveal ?? 1),
    boxed: a.boxed || (b.boxed ?? false),
    sx: a.sx * (b.sx ?? 1),
    block: b.block ?? a.block,
    units: b.units ?? a.units,
    spacing: a.spacing + (b.spacing ?? 0),
    shine: b.shine ?? a.shine,
    growth: Math.min(a.growth, b.growth ?? 1),
  };
}

const OPPOSITE: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };
// The layers whose words the painter can move one at a time.
const WORDED = new Set<LayerKind>(["text", "title", "name", "handle", "links", "time"]);

/**
 * A layer at `time` seconds into a clip `length` seconds long. While the clip plays it shows only between its times,
 * coming in, going and moving in its own ways; a layer with no end of its own goes as the clip ends. While it is
 * edited every layer is shown as it ends up, faint when the playhead is outside its times. Null means it isn't drawn.
 */
export function motionAt(layer: Pick<Layer, "enter" | "exit" | "loop" | "speed" | "from" | "until" | "direction"> & { kind?: LayerKind }, time: number, playing: boolean, length = Infinity): Motion | null {
  const from = layer.from ?? 0;
  const until = layer.until ?? length;
  const inside = time >= from && time <= until;
  if (!playing) return inside ? SETTLED : { ...SETTLED, alpha: 0.3 };
  if (!inside) return null;
  const speed = Math.min(4, Math.max(0.25, layer.speed ?? 1));
  const span = (way: Entrance) => entranceLength(way) / speed;
  const words = layer.kind !== undefined && WORDED.has(layer.kind);
  const direction = (way: Entrance) => layer.direction ?? DIRECTED[way] ?? "up";
  let motion = SETTLED;
  if (layer.enter) motion = combine(motion, moving(layer.enter, Math.min(1, Math.max(0, (time - from) / span(layer.enter))), direction(layer.enter), words));
  // Going plays the way in backwards and turned round, so a layer that rose in carries on up and out.
  if (layer.exit && Number.isFinite(until) && until - time < span(layer.exit)) motion = combine(motion, moving(layer.exit, Math.min(1, Math.max(0, (until - time) / span(layer.exit))), OPPOSITE[direction(layer.exit)], words));
  if (layer.loop) motion = combine(motion, looping(layer.loop, (time - from) * speed));
  return motion;
}
