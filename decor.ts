/* The decor bold podcast covers use, drawn as paths: organic blobs, squiggles, starbursts, stepped pixel frames,
   halftone dot fields and the like. Each comes out the same every time (a seed stands in for chance), its numbers
   to a tenth, and small enough to be saved with a design: at most 64 paths and 20,000 characters a path. Filled or
   stroked in "currentColor", so a drawing takes the colour of its layer. Free of the DOM, so it can be tested alone. */
import type { Art } from "./layers.js";

type Point = [number, number];

const INK = "currentColor";
// A drawing is 1000 units across; a tall or flat one keeps that width and takes the height it needs.
const SIZE = 1000;
const MIDDLE = SIZE / 2;
// Under the 20,000 a saved path may hold, with room to spare; a field of dots runs over several paths instead.
const PATH_ROOM = 18_000;

/** A number for path data, to a tenth: finer than a drawing ever shows, and short. Never "-0". */
const num = (value: number) => String(Math.round(value * 10) / 10 || 0);
const pair = ([x, y]: Point) => `${num(x)} ${num(y)}`;

/** The same run of numbers in 0..1 for the same seed (mulberry32), so a tile always adds the same drawing. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const polar = (radius: number, angle: number, centre: Point = [MIDDLE, MIDDLE]): Point => [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];

/** The cubic Béziers of a smooth curve through every point (Catmull-Rom), as each one's two handles and its end. */
function smooth(points: Point[], closed: boolean): Point[][] {
  const n = points.length;
  const at = (i: number) => (closed ? points[(i + n) % n] : points[Math.min(n - 1, Math.max(0, i))]);
  return Array.from({ length: closed ? n : n - 1 }, (_, i) => {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    return [[p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2];
  });
}

/** A smooth curve through every point, closed back to the first when `closed`. */
function curve(points: Point[], closed: boolean): string {
  const d = `M${pair(points[0])}${smooth(points, closed).map((segment) => `C${segment.map(pair).join(" ")}`).join("")}`;
  return closed ? `${d}Z` : d;
}

const polygon = (points: Point[]) => `M${points.map(pair).join("L")}Z`;

/** A dot as a path of two half circles, since path data has no circle of its own. */
const dot = ([x, y]: Point, r: number) => `M${num(x - r)} ${num(y)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0Z`;

/** Shapes filled in the layer's colour, as few paths as fit, so a field of hundreds of dots stays within a path's room. */
function filled(shapes: string[], rule?: "evenodd"): Art["paths"] {
  const runs: string[] = [];
  let d = "";
  for (const shape of shapes) {
    if (d && d.length + shape.length > PATH_ROOM) {
      runs.push(d);
      d = "";
    }
    d += shape;
  }
  if (d) runs.push(d);
  return runs.map((run) => (rule ? { d: run, fill: INK, rule } : { d: run, fill: INK }));
}

/**
 * A line through `points` as a drawing SIZE across, stroked `weight` thick with room for its round ends, as tall as the
 * line needs. Smooth unless `straight`.
 */
function stroked(points: Point[], weight: number, straight = false): Art {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const pad = weight / 2 + 4;
  const scale = (SIZE - 2 * pad) / (Math.max(...xs) - left);
  const fitted = points.map(([x, y]): Point => [pad + (x - left) * scale, pad + (y - top) * scale]);
  const d = straight ? `M${fitted.map(pair).join("L")}` : curve(fitted, false);
  return { w: SIZE, h: Math.ceil((Math.max(...ys) - top) * scale + 2 * pad), paths: [{ d, stroke: INK, width: weight }] };
}

/** An organic blob of `lobes` bumps; `wobble` from 0 (round) to about 0.4 (lumpy) sets how far they wander. */
export function blobArt(seed: number, lobes = 7, wobble = 0.25): Art {
  const random = seeded(seed);
  const turn = random() * Math.PI * 2;
  const points = Array.from({ length: lobes }, (_, i) => {
    const angle = turn + ((i + (random() - 0.5) * 0.5) / lobes) * Math.PI * 2;
    return polar(460 * (1 - wobble * random()), angle);
  });
  // Grown to fill the box by the curve's handles: a Bézier never strays past them, so the blob stays inside.
  const handles = [...points, ...smooth(points, true).flat()];
  const xs = handles.map(([x]) => x);
  const ys = handles.map(([, y]) => y);
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  const [across, down] = [Math.max(...xs) - left, Math.max(...ys) - top];
  const scale = (SIZE - 40) / Math.max(across, down);
  const fitted = points.map(([x, y]): Point => [(SIZE - across * scale) / 2 + (x - left) * scale, (SIZE - down * scale) / 2 + (y - top) * scale]);
  return { w: SIZE, h: SIZE, paths: filled([curve(fitted, true)]) };
}

/** A loopy hand-drawn squiggle of `loops` turns, a stroke `weight` thick. */
export function squiggleArt(loops: number, weight: number): Art {
  // A prolate cycloid: a point on a spoke well past a rolling wheel's rim loops back on itself once a turn.
  const steps = loops * 16;
  const points = Array.from({ length: steps + 1 }, (_, i): Point => {
    const t = (i / steps) * loops * Math.PI * 2 + Math.PI;
    return [t - 2.4 * Math.sin(t), 2.4 * Math.cos(t)];
  });
  return stroked(points, weight);
}

/** A wavy line of `waves` crests. */
export function waveArt(waves: number, weight: number): Art {
  const steps = waves * 12;
  return stroked(Array.from({ length: steps + 1 }, (_, i): Point => [i, Math.sin((i / 12) * Math.PI * 2) * 2.6]), weight);
}

/** A zigzag of `teeth` points. */
export function zigzagArt(teeth: number, weight: number): Art {
  return stroked(Array.from({ length: teeth * 2 + 1 }, (_, i): Point => [i, i % 2 ? 0 : 1.2]), weight, true);
}

/** A starburst of `points` spikes, its valleys `inner` of the way out. */
export function starburstArt(points: number, inner: number): Art {
  const corners = Array.from({ length: points * 2 }, (_, i) => polar(i % 2 ? 490 * inner : 490, (i / (points * 2)) * Math.PI * 2 - Math.PI / 2));
  return { w: SIZE, h: SIZE, paths: filled([polygon(corners)]) };
}

/** Sun rays: `count` wedges fanning out from a small gap in the middle. */
export function raysArt(count: number): Art {
  const slot = (Math.PI * 2) / count;
  const rays = Array.from({ length: count }, (_, i) => {
    const angle = i * slot - Math.PI / 2;
    // A wedge takes half its slot at the rim, so rays and gaps are alike.
    return polygon([polar(70, angle - slot * 0.06), polar(495, angle - slot / 4), polar(495, angle + slot / 4), polar(70, angle + slot * 0.06)]);
  });
  return { w: SIZE, h: SIZE, paths: filled(rays) };
}

/** A four-point sparkle with curved sides, `r` from its middle to a tip. */
function sparkle(centre: Point, r: number): string {
  const [x, y] = centre;
  const k = r * 0.14;
  return `M${pair([x, y - r])}Q${pair([x + k, y - k])} ${pair([x + r, y])}Q${pair([x + k, y + k])} ${pair([x, y + r])}Q${pair([x - k, y + k])} ${pair([x - r, y])}Q${pair([x - k, y - k])} ${pair([x, y - r])}Z`;
}

/** Three sparkles, big, middling and small, the way they gather in a corner. */
export function sparklesArt(): Art {
  return { w: SIZE, h: SIZE, paths: filled([sparkle([370, 590], 360), sparkle([775, 235], 200), sparkle([800, 790], 120)]) };
}

/** A round badge with a scalloped rim of `bumps` half circles: a flower with few, a seal with many. */
export function scallopArt(bumps: number): Art {
  const half = Math.PI / bumps;
  // The bumps sit on a ring sized so the furthest of them just meets the edge.
  const ring = 495 / (Math.cos(half) + Math.sin(half));
  const r = ring * Math.sin(half);
  const corners = Array.from({ length: bumps }, (_, i) => polar(ring, i * 2 * half - Math.PI / 2));
  const d = `M${pair(corners[0])}${corners.map((_, i) => `A${num(r)} ${num(r)} 0 0 1 ${pair(corners[(i + 1) % bumps])}`).join("")}Z`;
  return { w: SIZE, h: SIZE, paths: filled([d]) };
}

/**
 * The cells of a pixel outline one cell thick around a `cols` by `rows` box with stepped corners `corner` cells deep,
 * as rows of runs: the stair an 8-bit window has.
 */
function pixelOutline(cols: number, rows: number, corner: number): boolean[][] {
  const inset = (row: number) => Math.max(0, corner - Math.min(row, rows - 1 - row));
  const inside = (c: number, r: number) => r >= 0 && r < rows && c >= inset(r) && c < cols - inset(r);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      if (!inside(c, r)) return false;
      // An edge cell is one with a neighbour, on a side or a corner, outside the box.
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (!inside(c + dc, r + dr)) return true;
      return false;
    }),
  );
}

/** Filled cells as one rectangle a run, `cell` units square. */
function pixels(grid: boolean[][], cell: number): string[] {
  const runs: string[] = [];
  grid.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      let end = c;
      while (row[end + 1]) end++;
      const w = (end - c + 1) * cell;
      runs.push(`M${num(c * cell)} ${num(r * cell)}h${num(w)}v${num(cell)}h${num(-w)}Z`);
      c = end;
    }
  });
  return runs;
}

/** A pixel frame `cols` by `rows` cells, SIZE across, its corners stepped `corner` cells deep. */
export function pixelFrameArt(cols: number, rows: number, corner: number): Art {
  const cell = SIZE / cols;
  return { w: SIZE, h: rows * cell, paths: filled(pixels(pixelOutline(cols, rows, corner), cell)) };
}

/** One corner of a pixel frame: a stepped bracket `arm` cells long each way, for a corner of a photo or the page. */
export function pixelCornerArt(arm: number, corner: number): Art {
  const whole = pixelOutline(arm * 2, arm * 2, corner);
  return { w: SIZE, h: SIZE, paths: filled(pixels(whole.slice(0, arm).map((row) => row.slice(0, arm)), SIZE / arm)) };
}

/**
 * A halftone field of staggered dots `gap` apart, each as big as `shade` says at its place (0 none, 1 touching its
 * neighbours), in a `w` by `h` box.
 */
function halftone(w: number, h: number, gap: number, shade: (x: number, y: number) => number): string[] {
  const dots: string[] = [];
  const rise = gap * 0.866;
  // As many rows and columns as fit whole, every other row shifted half a gap, the lot centred in the box.
  const rows = Math.floor((h - gap) / rise) + 1;
  const cols = Math.floor((w - gap * 1.5) / gap) + 1;
  const left = (w - (cols - 1) * gap - gap / 2) / 2;
  const top = (h - (rows - 1) * rise) / 2;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = left + col * gap + (row % 2 ? gap / 2 : 0);
      const y = top + row * rise;
      // Dots too small to see are left out, which keeps the path short.
      const r = (gap / 2) * 0.96 * Math.min(1, shade(x, y));
      if (r >= 2) dots.push(dot([x, y], r));
    }
  }
  return dots;
}

/** A halftone disc: big dots in the middle shrinking to nothing at the rim. */
export function halftoneCircleArt(gap = 60): Art {
  return { w: SIZE, h: SIZE, paths: filled(halftone(SIZE, SIZE, gap, (x, y) => 1 - Math.hypot(x - MIDDLE, y - MIDDLE) / MIDDLE)) };
}

/** A halftone band fading from full dots at the left to nothing at the right, `h` tall. */
export function halftoneFadeArt(h = 600, gap = 50): Art {
  return { w: SIZE, h, paths: filled(halftone(SIZE, h, gap, (x) => 1.15 * (1 - x / SIZE))) };
}

/** A square grid of `count` by `count` even dots. */
export function dotGridArt(count: number): Art {
  const gap = SIZE / count;
  const dots = Array.from({ length: count * count }, (_, i) => dot([gap * ((i % count) + 0.5), gap * (Math.floor(i / count) + 0.5)], gap * 0.2));
  return { w: SIZE, h: SIZE, paths: filled(dots) };
}

/** A scatter of `count` bits of confetti, strips, dots, triangles and squares, none on top of another. */
export function confettiArt(seed: number, count = 36): Art {
  const random = seeded(seed);
  const placed: Point[] = [];
  const bits: string[] = [];
  for (let tries = 0; placed.length < count && tries < count * 40; tries++) {
    const at: Point = [80 + random() * (SIZE - 160), 80 + random() * (SIZE - 160)];
    const kind = Math.floor(random() * 4);
    const size = 1.3 + random() * 0.6;
    const turn = random() * Math.PI * 2;
    if (placed.some(([x, y]) => Math.hypot(x - at[0], y - at[1]) < 130)) continue;
    placed.push(at);
    if (kind === 1) {
      bits.push(dot(at, 17 * size));
      continue;
    }
    // A strip is long and thin, a triangle three corners, a square four, each turned its own way.
    const corners: Point[] =
      kind === 0 ? [[-36, -12], [36, -12], [36, 12], [-36, 12]] : kind === 2 ? [[0, -30], [26, 15], [-26, 15]] : [[-17, -17], [17, -17], [17, 17], [-17, 17]];
    bits.push(polygon(corners.map(([x, y]): Point => [at[0] + size * (x * Math.cos(turn) - y * Math.sin(turn)), at[1] + size * (x * Math.sin(turn) + y * Math.cos(turn))])));
  }
  return { w: SIZE, h: SIZE, paths: filled(bits) };
}

/** Concentric rings, `count` of them, each `band` units thick with an equal gap, the outermost at the edge. */
export function ringsArt(count: number, band: number): Art {
  // Every circle flips the fill, even-odd, so pairs of circles make rings.
  const circles = Array.from({ length: count * 2 }, (_, i) => dot([MIDDLE, MIDDLE], 495 - i * band)).filter((_, i) => 495 - i * band > 0);
  return { w: SIZE, h: SIZE, paths: filled(circles, "evenodd") };
}

/** Rainbow arcs: `count` half rings, `band` thick with a gap of `gap`, standing on the drawing's foot. */
export function arcsArt(count: number, band: number, gap: number): Art {
  const h = MIDDLE;
  const arcs = Array.from({ length: count }, (_, i) => {
    const outer = 495 - i * (band + gap);
    const inner = outer - band;
    return `M${num(MIDDLE - outer)} ${h}A${num(outer)} ${num(outer)} 0 0 1 ${num(MIDDLE + outer)} ${h}L${num(MIDDLE + inner)} ${h}A${num(inner)} ${num(inner)} 0 0 0 ${num(MIDDLE - inner)} ${h}Z`;
  }).filter((_, i) => 495 - i * (band + gap) - band > 0);
  return { w: SIZE, h, paths: filled(arcs) };
}
