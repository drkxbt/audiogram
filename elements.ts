/* What the Elements panel offers, in sections: the clip's own parts, shapes, lines, photo frames and grids, charts,
   tables, mockups, 3D shapes and moving backgrounds. Each entry knows its name, the words it is found by, and the
   layers it adds, laid out for the frame it goes on. Free of the DOM, so it can be tested on its own. */
import { defaultLayers, FRAME_SIZES, type Ambient, type ChartKind, type Device, type Layer, type ShapeKind, type Solid } from "./layers.js";
import type { Layout, Visual } from "./render.js";
import { ambientLayer } from "./paint-ambient.js";
import { chartLayer } from "./paint-chart.js";
import { mockupLayer } from "./paint-mockup.js";
import { solidLayer } from "./paint-solid.js";
import { tableLayer, type TableStyle } from "./paint-table.js";

export type SectionId = "audio" | "shapes" | "lines" | "frames" | "grids" | "videos" | "charts" | "tables" | "mockups" | "solids";

export const SECTIONS: SectionId[] = ["audio", "shapes", "lines", "frames", "grids", "videos", "charts", "tables", "mockups", "solids"];

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

const CHARTS: Array<[ChartKind, string, string]> = [
  ["column", "Columns", "bar graph stats"],
  ["bar", "Bars", "graph ranking"],
  ["line", "Line", "graph trend growth"],
  ["area", "Area", "graph trend"],
  ["pie", "Pie", "share split"],
  ["donut", "Donut", "share split"],
  ["ring", "Progress ring", "percent goal"],
  ["progress", "Progress bar", "percent goal"],
  ["number", "Big number", "stat figure count"],
  ["poll", "Poll", "vote question answers"],
];

const TABLES: Array<[TableStyle, string, string]> = [
  ["simple", "Simple", "grid"],
  ["header", "With a header", "grid"],
  ["striped", "Striped", "grid rows"],
  ["schedule", "Schedule", "agenda running order time"],
  ["scoreboard", "Scoreboard", "scores results compare"],
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

/** Every entry of the panel, section by section. `parts` names the clip's own parts in the editor's words. */
export function elementTiles(parts: Record<"captions" | "bars" | "wave" | "pulse" | "time" | "avatar" | "name" | "handle" | "title" | "links", string>): ElementTile[] {
  const tiles: ElementTile[] = [];
  const sound: Array<[keyof typeof parts, Layer["kind"], Visual?]> = [
    ["captions", "captions"], ["bars", "visual", "bars"], ["wave", "visual", "wave"], ["pulse", "visual", "pulse"], ["time", "time"],
    ["avatar", "avatar"], ["name", "name"], ["handle", "handle"], ["title", "title"], ["links", "links"],
  ];
  for (const [key, kind, look] of sound) {
    tiles.push({
      id: `audio:${key}`,
      section: "audio",
      name: parts[key],
      tags: kind === "visual" ? "sound audio waveform equaliser" : kind === "captions" ? "subtitles words transcript" : "",
      part: { kind, look },
      make: (layout, newId) => {
        const classic = defaultLayers(layout).find((layer) => layer.kind === kind);
        return classic ? [{ ...classic, id: newId(kind), ...(look ? { visual: look } : {}) }] : [];
      },
    });
  }
  for (const [shape, name, tags, radius] of SHAPES) {
    tiles.push({ id: `shape:${shape}${radius ? "-rounded" : ""}`, section: "shapes", name, tags, make: (layout, newId) => [base(newId("shape"), "shape", 0, 0, 0, 0, { ...centred(layout, 0.3, shape === "banner" ? 3 : shape === "tag" ? 1.8 : shape === "quote" ? 1.3 : 1), shape, fill: "accent", radius })] });
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
    tiles.push({ id: `video:${style}`, section: "videos", name, tags: `moving background motion ${tags}`, under: true, make: (_, newId) => [{ ...ambientLayer(style, newId("ambient")) }] });
  }
  for (const [kind, name, tags] of CHARTS) {
    tiles.push({ id: `chart:${kind}`, section: "charts", name, tags: `chart data ${tags}`, make: (_, newId) => [chartLayer(kind, newId("chart"))] });
  }
  for (const [style, name, tags] of TABLES) {
    tiles.push({ id: `table:${style}`, section: "tables", name, tags: `table sheet cells ${tags}`, make: (_, newId) => [tableLayer(style, newId("table"))] });
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
