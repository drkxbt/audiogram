/* What the Elements panel offers, in sections: the clip's own parts, shapes, decor, lines, photo frames and grids,
   charts, tables, mockups, 3D shapes and moving backgrounds. Each entry knows its name, the words it is found by, and the
   layers it adds, laid out for the frame it goes on. The drawings a host's sets bring are searched and placed here
   too. Free of the DOM, so it can be tested on its own. */
import { defaultLayers, FRAME_SIZES, type Ambient, type Art, type Device, type Layer, type ShapeKind, type Solid } from "./layers.js";
import { VISUALS, type Layout, type Visual } from "./render.js";
import type { Drawing } from "./editor.js";
import { arcsArt, blobArt, confettiArt, dotGridArt, halftoneCircleArt, halftoneFadeArt, pixelCornerArt, pixelFrameArt, raysArt, ringsArt, scallopArt, sparklesArt, squiggleArt, starburstArt, waveArt, zigzagArt } from "./decor.js";
import { ambientLayer } from "./paint-ambient.js";
import { mockupLayer } from "./paint-mockup.js";
import { solidLayer } from "./paint-solid.js";

export type SectionId = "audio" | "shapes" | "decor" | "lines" | "frames" | "grids" | "videos" | "mockups" | "solids";

// Charts and tables are no longer offered in Elements (the owner took them out); layers of those kinds still draw.
export const SECTIONS: SectionId[] = ["audio", "shapes", "decor", "lines", "frames", "grids", "videos", "mockups", "solids"];

export interface ElementTile {
  /** Stable across visits, so Recently used can keep it: the section and the entry, as "shape:star". */
  id: string;
  section: SectionId;
  name: string;
  /** More words it is found by in a search. */
  tags: string;
  /** The layers it adds, on top of the design; a background goes under it instead. */
  make(layout: Layout, newId: (kind: string) => string): Layer[];
  /** A sound part the clip has, such as its captions, which the editor places from its own classic layout. */
  part?: { kind: Layer["kind"]; look?: Visual };
  /** Goes to the bottom of the design, under everything. */
  under?: boolean;
}

const base = (id: string, kind: Layer["kind"], x: number, y: number, w: number, h: number, style: Partial<Layer> = {}): Layer => ({ id, kind, x, y, w, h, rotation: 0, opacity: 1, ...style });

/** A box `side` of the frame's shorter side across, `ratio` times as wide as tall, in the middle of the frame. */
function centred(layout: Layout, side: number, ratio = 1) {
  const { width, height } = FRAME_SIZES[layout];
  const short = Math.min(width, height) * side;
  const w = (ratio >= 1 ? short : short * ratio) / width;
  const h = (ratio >= 1 ? short / ratio : short) / height;
  return { x: 0.5 - w / 2, y: 0.5 - h / 2, w, h };
}

const SHAPES: Array<[ShapeKind, string, string, number?]> = [
  ["rect", "Square", "box rectangle"],
  ["rect", "Rounded square", "box card button", 0.18],
  ["ellipse", "Circle", "round dot oval"],
  ["triangle", "Triangle", "play"],
  ["diamond", "Diamond", "rhombus"],
  ["pentagon", "Pentagon", ""],
  ["hexagon", "Hexagon", "honeycomb"],
  ["octagon", "Octagon", "stop"],
  ["star", "Star", "rating favourite"],
  ["burst", "Burst", "badge seal new sale"],
  ["sparkle", "Sparkle", "shine twinkle"],
  ["heart", "Heart", "love like"],
  ["squircle", "Squircle", "app icon"],
  ["blob", "Blob", "organic"],
  ["ring", "Ring", "circle outline donut"],
  ["arch", "Arch", "door window"],
  ["cross", "Cross", "plus add"],
  ["parallelogram", "Slant", "parallelogram"],
  ["arrow", "Arrow", "right next"],
  ["chevron", "Chevron", "next"],
  ["check", "Tick", "check done yes"],
  ["bubble", "Speech bubble", "talk quote chat"],
  ["quote", "Quote marks", "quotation"],
  ["banner", "Ribbon", "banner label"],
  ["tag", "Tag", "label price"],
  ["cloud", "Cloud", "weather"],
  ["moon", "Moon", "night crescent"],
];

/** Generated decor: its key, name and search words, how much of the frame's shorter side it spans, and its drawing.
 *  The first few are the ones the panel shows before See all, so they are one of each kind. */
const DECOR: Array<[string, string, string, number, () => Art]> = [
  ["blob-soft", "Soft blob", "organic shape round splodge", 0.4, () => blobArt(8, 7, 0.22)],
  ["squiggle-long", "Long squiggle", "loops scribble doodle line", 0.6, () => squiggleArt(6, 26)],
  ["starburst-12", "Starburst, 12 points", "burst star badge sale new", 0.36, () => starburstArt(12, 0.7)],
  ["halftone-circle", "Halftone circle", "dots pattern retro print disc", 0.4, () => halftoneCircleArt()],
  ["blob-wobbly", "Wobbly blob", "organic shape splodge lumpy", 0.4, () => blobArt(9, 9, 0.36)],
  ["blob-pebble", "Pebble", "organic shape blob stone smooth", 0.36, () => blobArt(10, 5, 0.14)],
  ["squiggle-short", "Short squiggle", "loops scribble doodle line", 0.4, () => squiggleArt(3, 40)],
  ["wave", "Wavy line", "squiggle wave rule divider", 0.56, () => waveArt(4, 40)],
  ["zigzag", "Zigzag", "line chevron rule divider", 0.5, () => zigzagArt(6, 40)],
  ["starburst-8", "Starburst, 8 points", "burst star badge spiky", 0.36, () => starburstArt(8, 0.5)],
  ["seal-24", "Seal, 24 points", "burst starburst badge sticker sale", 0.36, () => starburstArt(24, 0.84)],
  ["rays", "Sun rays", "sunburst beams retro", 0.5, () => raysArt(16)],
  ["sparkles", "Sparkles", "shine twinkle stars glitter", 0.28, () => sparklesArt()],
  ["flower", "Flower", "daisy scallop badge petals", 0.32, () => scallopArt(8)],
  ["scallop", "Scalloped badge", "seal sticker scallop round", 0.34, () => scallopArt(24)],
  ["pixel-frame", "Pixel frame", "8-bit retro border box game", 0.62, () => pixelFrameArt(20, 20, 3)],
  ["pixel-frame-wide", "Wide pixel frame", "8-bit retro border box game", 0.8, () => pixelFrameArt(25, 14, 3)],
  ["pixel-corner", "Pixel corner", "8-bit retro bracket border game", 0.24, () => pixelCornerArt(8, 2)],
  ["halftone-fade", "Halftone fade", "dots pattern retro print gradient", 0.56, () => halftoneFadeArt()],
  ["dot-grid", "Dot grid", "dots pattern polka", 0.32, () => dotGridArt(8)],
  ["confetti", "Confetti", "party scatter celebrate bits", 0.5, () => confettiArt(7)],
  ["rings", "Concentric rings", "circles target ripple orbit", 0.4, () => ringsArt(5, 50)],
  ["arcs", "Rainbow arcs", "rainbow arches retro sunrise", 0.5, () => arcsArt(4, 70, 40)],
];

const LINES: Array<[string, string, string, Partial<Layer>]> = [
  ["line", "Line", "rule divider", { shape: "line", strokeWidth: 8 }],
  ["dashed", "Dashed line", "rule", { shape: "line", strokeWidth: 8, dash: "dashed" }],
  ["dotted", "Dotted line", "rule", { shape: "line", strokeWidth: 10, dash: "dotted" }],
  ["rounded", "Rounded line", "rule", { shape: "line", strokeWidth: 16, cap: "round" }],
  ["arrow", "Arrow", "pointer", { shape: "line", strokeWidth: 8, arrowEnd: true }],
  ["both", "Double arrow", "pointer", { shape: "line", strokeWidth: 8, arrowStart: true, arrowEnd: true }],
  ["curve", "Curved line", "wave bend", { shape: "line", strokeWidth: 8, cap: "round", bend: 60 }],
  ["curved-arrow", "Curved arrow", "pointer bend", { shape: "line", strokeWidth: 8, cap: "round", bend: 60, arrowEnd: true }],
  ["bar", "Bar", "rule thick", { shape: "rect", radius: 0.5 }],
];

const FRAMES: Array<[string, string, ShapeKind, Partial<Layer>]> = [
  ["square", "Square", "rect", {}],
  ["rounded", "Rounded", "rect", { radius: 0.12 }],
  ["circle", "Circle", "ellipse", {}],
  ["ring", "Circle with a ring", "ellipse", { stroke: "text", strokeWidth: 10 }],
  ["arch", "Arch", "arch", {}],
  ["squircle", "Squircle", "squircle", {}],
  ["blob", "Blob", "blob", {}],
  ["burst", "Burst", "burst", {}],
  ["cloud", "Cloud", "cloud", {}],
  ["hexagon", "Hexagon", "hexagon", {}],
  ["heart", "Heart", "heart", {}],
  ["star", "Star", "star", {}],
  ["bordered", "Square with a border", "rect", { stroke: "text", strokeWidth: 10, radius: 0.04 }],
];

/** Cells of a photo grid, as fractions of the area it fills. */
const GRIDS: Array<[string, string, Array<[number, number, number, number]>]> = [
  ["two", "Two across", [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]]],
  ["stacked", "Two stacked", [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]]],
  ["three", "Three across", [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]]],
  ["three-down", "Three down", [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]]],
  ["four", "Four", [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]]],
  ["big-left", "One big, two small", [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]]],
  ["big-right", "Two small, one big", [[0, 0, 0.4, 0.5], [0, 0.5, 0.4, 0.5], [0.4, 0, 0.6, 1]]],
  ["big-top", "One big over two", [[0, 0, 1, 0.6], [0, 0.6, 0.5, 0.4], [0.5, 0.6, 0.5, 0.4]]],
  ["six", "Six", [[0, 0, 1 / 3, 0.5], [1 / 3, 0, 1 / 3, 0.5], [2 / 3, 0, 1 / 3, 0.5], [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5]]],
  ["nine", "Nine", Array.from({ length: 9 }, (_, i) => [(i % 3) / 3, Math.floor(i / 3) / 3, 1 / 3, 1 / 3] as [number, number, number, number])],
];

const DEVICES: Array<[Device, string, string]> = [
  ["phone", "Phone", "mobile iphone screen"],
  ["tablet", "Tablet", "ipad screen"],
  ["laptop", "Laptop", "computer screen"],
  ["monitor", "Monitor", "desktop screen"],
  ["tv", "TV", "television screen"],
  ["browser", "Browser", "website window"],
  ["polaroid", "Polaroid", "photo print instant"],
  ["vinyl", "Vinyl", "record album music cover"],
];

const SOLIDS: Array<[Solid, string, string]> = [
  ["sphere", "Sphere", "ball orb"],
  ["cube", "Cube", "box block"],
  ["cylinder", "Cylinder", "tube"],
  ["cone", "Cone", ""],
  ["torus", "Ring", "donut torus"],
  ["pyramid", "Pyramid", ""],
  ["capsule", "Capsule", "pill"],
];

const AMBIENTS: Array<[Ambient, string, string]> = [
  ["aurora", "Aurora", "lights glow northern"],
  ["flow", "Flow", "gradient"],
  ["bokeh", "Bokeh", "lights blur"],
  ["particles", "Particles", "dust specks stars"],
  ["waves", "Waves", "sea ribbons"],
  ["rays", "Light rays", "beams sun"],
  ["grid", "Grid", "retro floor"],
  ["grain", "Film grain", "noise texture"],
];

// The sound styles drawn round a middle, which read best in a square box; the rest are made for a strip.
const ROUND = new Set<Visual | undefined>(["ring", "radial"]);

// Words a sound style is found by in a search, besides the ones every sound part has.
const SOUND_TAGS: Partial<Record<Visual, string>> = {
  radial: "sunburst circle",
  mirror: "reflection",
  line: "spectrum curve",
  dots: "led lights",
  blocks: "vu peak segments",
  scope: "oscilloscope",
};

/** A sound part where the classic layout puts it; a ring or radial bars read best round, so they get a square of their
 *  own there. */
export function soundPart(classic: Layer, look: Visual | undefined, layout: Layout): Layer {
  if (!ROUND.has(look)) return classic;
  const { width, height } = FRAME_SIZES[layout];
  const side = Math.min(width, height) * 0.32;
  return { ...classic, x: classic.x + classic.w / 2 - side / width / 2, y: classic.y + classic.h / 2 - side / height / 2, w: side / width, h: side / height };
}

/**
 * A sound layer changed from one look to another. A ring and radial bars sit in a square and the other styles in a
 * strip, so a change from round to a strip refits the box; a change within either keeps it.
 */
export function restyleSound(layer: Layer, from: Visual, to: Visual): Layer {
  // A strip keeps its box as a ring or radial bars, which the painter lays out along the strip: growing it into a round
  // box would cover the words a template sets around its strip. A round one becomes a strip along its own foot, clear
  // of a clock or a photo in its middle.
  if (!ROUND.has(from) || ROUND.has(to)) return layer;
  const h = layer.h / 5;
  return { ...layer, y: layer.y + layer.h - h, h };
}

/** A design's layers after its sound style goes from `from` to `to`: each sound layer takes the new look, the ones
 *  added with a look of their own included, unless it is kept to its own. */
export function restyleAll(layers: Layer[], from: Visual, to: Visual): Layer[] {
  return layers.map((layer) => (layer.kind === "visual" && !layer.keepLook ? { ...restyleSound(layer, layer.visual ?? from, to), visual: undefined } : layer));
}

/** Every entry of the panel, section by section. `parts` names the clip's own parts in the editor's words. */
export function elementTiles(parts: Record<"captions" | Visual | "time" | "avatar" | "name" | "handle" | "title" | "links", string>): ElementTile[] {
  const tiles: ElementTile[] = [];
  const sound: Array<[keyof typeof parts, Layer["kind"], Visual?]> = [
    ["captions", "captions"], ...VISUALS.map((look): [Visual, Layer["kind"], Visual] => [look, "visual", look]), ["time", "time"],
    ["avatar", "avatar"], ["name", "name"], ["handle", "handle"], ["title", "title"], ["links", "links"],
  ];
  for (const [key, kind, look] of sound) {
    tiles.push({
      id: `audio:${key}`,
      section: "audio",
      name: parts[key],
      tags: kind === "visual" ? `sound audio waveform equaliser ${SOUND_TAGS[look!] ?? ""}`.trim() : kind === "captions" ? "subtitles words transcript" : "",
      part: { kind, look },
      make: (layout, newId) => {
        const classic = defaultLayers(layout).find((layer) => layer.kind === kind);
        return classic ? [{ ...soundPart(classic, look, layout), id: newId(kind), ...(look ? { visual: look } : {}) }] : [];
      },
    });
  }
  for (const [shape, name, tags, radius] of SHAPES) {
    tiles.push({ id: `shape:${shape}${radius ? "-rounded" : ""}`, section: "shapes", name, tags, make: (layout, newId) => [base(newId("shape"), "shape", 0, 0, 0, 0, { ...centred(layout, 0.3, shape === "banner" ? 3 : shape === "tag" ? 1.8 : shape === "quote" ? 1.3 : 1), shape, fill: "accent", radius })] });
  }
  for (const [key, name, tags, side, draw] of DECOR) {
    tiles.push({
      id: `decor:${key}`,
      section: "decor",
      name,
      tags,
      make: (layout, newId) => {
        // Drawn afresh each time, so no two layers ever share one drawing.
        const art = draw();
        return [base(newId("graphic"), "graphic", 0, 0, 0, 0, { ...centred(layout, side, art.w / art.h), art, color: "accent" })];
      },
    });
  }
  for (const [key, name, tags, style] of LINES) {
    tiles.push({
      id: `line:${key}`,
      section: "lines",
      name,
      tags,
      make: (layout, newId) => {
        const { width, height } = FRAME_SIZES[layout];
        const across = Math.min(width, height) * 0.48;
        // A bent line needs height to bend in; a bar is just thin.
        const tall = style.bend ? across * 0.3 : key === "bar" ? Math.max(8, across * 0.04) : Math.max(40, across * 0.1);
        return [base(newId("shape"), "shape", 0.5 - across / width / 2, 0.5 - tall / height / 2, across / width, tall / height, { fill: "accent", ...style })];
      },
    });
  }
  for (const [key, name, mask, style] of FRAMES) {
    tiles.push({ id: `frame:${key}`, section: "frames", name, tags: "photo picture image mask", make: (layout, newId) => [base(newId("image"), "image", 0, 0, 0, 0, { ...centred(layout, 0.42), mask, ...style })] });
  }
  for (const [key, name, cells] of GRIDS) {
    tiles.push({
      id: `grid:${key}`,
      section: "grids",
      name,
      tags: "collage photos layout",
      make: (layout, newId) => {
        const { width, height } = FRAME_SIZES[layout];
        const gap = 12 / Math.min(width, height);
        const area = { x: 0.08, y: 0.18, w: 0.84, h: 0.64 };
        const group = newId("group");
        // Each cell gives up half the gap on each inner side, so neighbours are a whole gap apart.
        return cells.map(([x, y, w, h]) => {
          const left = x > 0 ? gap / 2 : 0;
          const right = x + w < 1 - 1e-9 ? gap / 2 : 0;
          const top = y > 0 ? gap / 2 : 0;
          const bottom = y + h < 1 - 1e-9 ? gap / 2 : 0;
          return base(newId("image"), "image", area.x + x * area.w + left, area.y + y * area.h + top, w * area.w - left - right, h * area.h - top - bottom, { group });
        });
      },
    });
  }
  for (const [style, name, tags] of AMBIENTS) {
    // A moving effect over the whole design, lights only, which can be moved and sized like any part.
    tiles.push({ id: `video:${style}`, section: "videos", name, tags: `moving effect overlay motion animated ${tags}`, make: (_, newId) => [{ ...ambientLayer(style, newId("ambient"), true) }] });
  }
  for (const [device, name, tags] of DEVICES) {
    tiles.push({
      id: `mockup:${device}`,
      section: "mockups",
      name,
      tags: `mockup device frame ${tags}`,
      make: (layout, newId) => {
        const { width, height } = FRAME_SIZES[layout];
        return [mockupLayer(device, newId("mockup"), width, height)];
      },
    });
  }
  for (const [solid, name, tags] of SOLIDS) {
    tiles.push({
      id: `solid:${solid}`,
      section: "solids",
      name,
      tags: `3d shape ${tags}`,
      make: (layout, newId) => {
        const { width, height } = FRAME_SIZES[layout];
        return [solidLayer(solid, newId("solid"), width, height)];
      },
    });
  }
  return tiles;
}

/** The entries a search finds: every word typed has to start a word of an entry's name or tags. */
export function searchTiles(tiles: ElementTile[], query: string): ElementTile[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return tiles;
  return tiles.filter((tile) => {
    const own = `${tile.name} ${tile.tags} ${tile.section}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return words.every((word) => own.some((part) => part.startsWith(word)));
  });
}

/** The drawings a search finds, in the order given: every word typed has to start a word of the name, a tag, or the
 *  id. Names are split on any letter or digit of any script, so a brand like Škoda is found by its own spelling. */
export function matchDrawings(drawings: Drawing[], query: string): Drawing[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return drawings;
  return drawings.filter((drawing) => {
    const own = [...drawing.name.toLowerCase().split(/[^\p{L}\p{N}]+/u), ...(drawing.tags ?? []).map((tag) => tag.toLowerCase()), drawing.id.toLowerCase()].filter(Boolean);
    return words.every((word) => own.some((part) => part.startsWith(word)));
  });
}

/** A drawing on the page as a graphic, its shape kept, its longer side a sixth of the page's shorter side, in the
 *  middle. Without a colour of its own it takes the accent, the colour a new shape gets. */
export function drawingLayer(drawing: Drawing, layout: Layout, id: string): Layer {
  const { w, h } = drawing.art;
  return base(id, "graphic", 0, 0, 0, 0, { ...centred(layout, 0.16, w > 0 && h > 0 ? w / h : 1), art: drawing.art, color: drawing.color ?? "accent" });
}

// The most pixels a preview is painted with, zoomed in: about eight million, so a frame drawn every frame stays smooth.
const PREVIEW_MOST = 8_000_000;

/**
 * How many pixels the preview of a `frame` is painted with, when it is shown `shownWidth` CSS pixels wide on a screen
 * of `ratio` device pixels to one: as many as the screen shows, zoomed in past the frame's own size too, so nothing is
 * ever stretched soft; never under half the frame (plenty for a small preview), and never over PREVIEW_MOST.
 */
export function previewPixels(frame: { width: number; height: number }, shownWidth: number, ratio: number): { width: number; height: number } {
  const most = Math.sqrt(PREVIEW_MOST / (frame.width * frame.height));
  const scale = Math.min(most, Math.max(0.5, (shownWidth * ratio) / frame.width || 0));
  return { width: Math.round(frame.width * scale), height: Math.round(frame.height * scale) };
}
