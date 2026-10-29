/* Charts on the frame: columns and bars, a line or the area under it, a pie or a donut, a ring or a bar of progress,
   one big number, and a poll. Each is drawn from the layer's rows inside its box and grows in with the layer, so a
   chart builds itself up on screen while the host talks about it. */

import type { ChartKind, Datum, Layer, Paint } from "./layers.js";
import type { PaintBox, PaintEnv } from "./paint-env.js";
import { fitText } from "./paint-table.js";
import { fontOf, roundRect } from "./render.js";

type Fill = string | CanvasGradient;

/** What every form of chart draws with, worked out once per frame. */
interface Kit {
  ctx: CanvasRenderingContext2D;
  layer: Layer;
  env: PaintEnv;
  box: PaintBox;
  /** How far the chart has grown in, from 0 to 1. */
  growth: number;
  /** The words' size, in canvas pixels. */
  size: number;
  /** The layer's own fade; every faint part is a share of it. */
  alpha: number;
  series: Fill;
  guide: Fill;
  ink: Fill;
  labels: boolean;
  values: boolean;
  grid: boolean;
}

interface Scale {
  lo: number;
  hi: number;
  step: number;
}

interface Point {
  x: number;
  y: number;
}

const MAX_ROWS = 12;
// How strongly the guide colour shows: the zero line, the guide lines, and the tracks rings, progress bars and polls
// fill up.
const BASELINE = 0.5;
const GRIDLINE = 0.22;
const TRACK = 0.2;
// Labels sit a step back from the values they name.
const LABEL = 0.72;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** How far bar `index` of `count` has grown: each starts a little after the one before, and all are whole at the end. */
const staggered = (growth: number, index: number, count: number) => clamp(growth * 1.4 - (index * 0.4) / count);

/** The canvas font for a chart's words at `px` canvas pixels; the layer's own weight wins over `weight`. */
function fontAt(k: Kit, px: number, weight: number): string {
  return fontOf({ ...k.layer, size: Math.max(1, px) / k.env.unit }, k.env.family, k.env.unit, weight);
}

const labelFont = (k: Kit, scale = 1) => fontAt(k, k.size * scale, 500);
const valueFont = (k: Kit) => fontAt(k, k.size, 650);

function widest(ctx: CanvasRenderingContext2D, font: string, texts: string[]): number {
  ctx.font = font;
  return texts.reduce((most, text) => Math.max(most, ctx.measureText(text).width), 0);
}

/** The largest size up to `most` canvas pixels at which `text` fits `width`. */
function fitSize(k: Kit, text: string, most: number, width: number, weight: number): number {
  k.ctx.font = fontAt(k, most, weight);
  const measured = k.ctx.measureText(text).width;
  return Math.max(1, measured > width ? most * (width / measured) : most);
}

/** How many decimals a value is written with: its own, up to four, ignoring the dust sums leave behind. */
function decimalsOf(value: number): number {
  for (let places = 0; places < 4; places++) {
    const scaled = Math.abs(value) * 10 ** places;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6 * Math.max(1, scaled)) return places;
  }
  return 4;
}

/** A value as the chart writes it: en-US digits whatever the machine, the layer's words before and after, and a minus
 *  sign ahead of a currency sign. */
function valueText(layer: Layer, value: number, decimals = decimalsOf(value)): string {
  const digits = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const negative = value < 0 && Math.round(Math.abs(value) * 10 ** decimals) > 0;
  return `${negative ? "-" : ""}${layer.prefix ?? ""}${digits}${layer.suffix ?? ""}`;
}

/** A round step of about `rough`: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(rough: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  return ([1, 2, 2.5, 5, 10].find((times) => times * magnitude >= rough * (1 - 1e-9)) ?? 10) * magnitude;
}

/** The axis values are drawn on: from zero, or the lowest value below it, up to the highest, each end rounded out to a
 *  whole step of about a quarter of the span. A max set on the layer is the top instead, when nothing passes it. */
function scaleOf(values: number[], max: number | undefined): Scale {
  const target = max !== undefined && max > 0 ? max : 0;
  const top = Math.max(0, target, ...values);
  const bottom = Math.min(0, ...values);
  const step = niceStep((top - bottom || 1) / 4);
  const lo = Math.floor(bottom / step + 1e-9) * step;
  const hi = target && target >= top ? target : Math.ceil(top / step - 1e-9) * step || step;
  return { lo, hi, step };
}

function ticksOf(scale: Scale): number[] {
  const count = Math.min(12, Math.floor((scale.hi - scale.lo) / scale.step + 1e-9));
  return Array.from({ length: count + 1 }, (_, index) => Number((scale.lo + index * scale.step).toFixed(10)));
}

type Rgb = [number, number, number];

function rgbOf(css: string): Rgb | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i.exec(css.trim());
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
    const value = parseInt(digits, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(css.trim());
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

const hexOf = (colour: Rgb) => `#${colour.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
const rgba = (colour: Rgb, alpha: number) => `rgba(${colour.map(Math.round).join(", ")}, ${alpha})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const apart = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function luminance(colour: Rgb): number {
  const [r, g, b] = colour.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Colours for rows without their own, made from the theme: the series colour first, then the theme's words and muted
 *  colours and blends of them with the series colour, each kept only when it stands apart from those before it and
 *  shows on the page. A theme whose accent is its words colour still gets distinct greys this way. */
function paletteOf(k: Kit): Paint[] {
  const { env, layer } = k;
  const first = layer.fill ?? "accent";
  const own = rgbOf(env.flat(layer.fill, "accent"));
  const accent = rgbOf(env.flat(undefined, "accent"));
  const text = rgbOf(env.flat(undefined, "text"));
  const muted = rgbOf(env.flat(undefined, "muted"));
  const page = rgbOf(env.theme.background);
  if (!own || !accent || !text || !muted || !page) return [first, "text", "muted"];
  const kept: Rgb[] = [own];
  const palette: Paint[] = [first];
  // The theme's accent comes last: beside a colour of the user's own, such as rose gold, it would clash.
  for (const colour of [text, muted, mix(own, page, 0.45), mix(own, text, 0.5), mix(muted, page, 0.4), mix(own, muted, 0.5), mix(text, muted, 0.5), accent]) {
    if (contrast(colour, page) < 1.45 || kept.some((other) => apart(other, colour) < 48)) continue;
    kept.push(colour);
    palette.push(hexOf(colour));
  }
  return palette;
}

/** Each row's colour: its own, or the palette's in turn. */
function rowPaints(k: Kit, rows: Datum[]): Paint[] {
  const palette = paletteOf(k);
  return rows.map((row, index) => row.color ?? palette[index % palette.length]);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
}

/** A bar standing on its base at (x, y) and reaching `length` along (dx, dy), as the current path. Only the far corners
 *  are rounded, so the bar sits square on the zero line. */
function barPath(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, length: number, thickness: number, radius: number) {
  const r = Math.max(0, Math.min(radius, thickness / 2, length));
  const px = (-dy * thickness) / 2;
  const py = (dx * thickness) / 2;
  const fx = x + dx * length;
  const fy = y + dy * length;
  ctx.beginPath();
  ctx.moveTo(x - px, y - py);
  ctx.arcTo(fx - px, fy - py, fx + px, fy + py, r);
  ctx.arcTo(fx + px, fy + py, x + px, y + py, r);
  ctx.lineTo(x + px, y + py);
  ctx.closePath();
}

/** A smooth line on from the current point through each of `points` after the first, spaced evenly across. It bends
 *  without overshooting, so a peak never reads higher than its value. */
function curveThrough(ctx: CanvasRenderingContext2D, points: Point[]) {
  const n = points.length;
  if (n < 3) {
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    return;
  }
  const slopes = points.slice(1).map((point, index) => (point.y - points[index].y) / (point.x - points[index].x || 1));
  const tangents = points.map((_, index) => {
    if (index === 0 || index === n - 1) return 0;
    const a = slopes[index - 1];
    const b = slopes[index];
    return a * b <= 0 ? 0 : Math.sign(a) * Math.min(2 * Math.abs(a), 2 * Math.abs(b), Math.abs(a + b) / 2);
  });
  tangents[0] = (3 * slopes[0] - tangents[1]) / 2;
  tangents[n - 1] = (3 * slopes[n - 2] - tangents[n - 2]) / 2;
  for (let index = 0; index < n - 1; index++) {
    const a = points[index];
    const b = points[index + 1];
    const third = (b.x - a.x) / 3;
    ctx.bezierCurveTo(a.x + third, a.y + tangents[index] * third, b.x - third, b.y - tangents[index + 1] * third, b.x, b.y);
  }
}

/** The space columns and lines are drawn in: a band under it for the labels, room over it for the values, and with
 *  guides on a gutter at the left for their values. Labels or values that would run into each other are left out. */
interface Plot {
  left: number;
  right: number;
  top: number;
  bottom: number;
  slot: number;
  labels: boolean;
  values: boolean;
  /** Where the labels' middle sits, under the plot. */
  labelY: number;
  x(index: number): number;
  y(value: number): number;
}

/** `under` keeps room below the plot for values written under its ends, as a column reaching below zero has. */
function plotOf(k: Kit, rows: Datum[], scale: Scale, under = false): Plot {
  const { ctx, box, size } = k;
  const tall = box.height >= size * 4;
  const ticks = k.grid ? ticksOf(scale) : [];
  const gutter = ticks.length ? widest(ctx, labelFont(k, 0.8), ticks.map((tick) => valueText(k.layer, tick, decimalsOf(scale.step)))) + size * 0.5 : 0;
  const left = box.x + gutter;
  const right = box.x + box.width;
  const slot = (right - left) / rows.length;
  const labels = k.labels && tall && widest(ctx, labelFont(k), rows.map((row) => row.label)) <= slot * 0.92;
  const values = k.values && tall && widest(ctx, valueFont(k), rows.map((row) => valueText(k.layer, row.value))) <= slot * 0.96;
  // A guide's value is centred on its line, so the top and bottom guides need half a line of room past them.
  const top = box.y + (values ? size * 1.4 : ticks.length ? size * 0.5 : 0);
  const band = box.y + box.height - (labels ? size * 1.6 : ticks.length ? size * 0.5 : 0);
  const bottom = band - (values && under && scale.lo < 0 ? size * 1.4 : 0);
  const span = scale.hi - scale.lo || 1;
  return { left, right, top, bottom, slot, labels, values, labelY: band + size * 0.85, x: (index) => left + slot * (index + 0.5), y: (value) => bottom - ((value - scale.lo) / span) * (bottom - top) };
}

/** The zero line and, with guides on, a faint line at every step with its value in the gutter. */
function guides(k: Kit, plot: Plot, scale: Scale) {
  const { ctx } = k;
  ctx.strokeStyle = k.guide;
  ctx.lineWidth = Math.max(1, k.env.unit * 1.5);
  if (k.grid) {
    ctx.font = labelFont(k, 0.8);
    ctx.textAlign = "right";
    ctx.fillStyle = k.ink;
    for (const tick of ticksOf(scale)) {
      const y = plot.y(tick);
      if (tick !== 0) {
        ctx.globalAlpha = k.alpha * GRIDLINE;
        line(ctx, plot.left, y, plot.right, y);
      }
      ctx.globalAlpha = k.alpha * LABEL * 0.8;
      ctx.fillText(valueText(k.layer, tick, decimalsOf(scale.step)), plot.left - k.size * 0.35, y);
    }
  }
  ctx.globalAlpha = k.alpha * BASELINE;
  line(ctx, plot.left, plot.y(0), plot.right, plot.y(0));
}

function categoryLabels(k: Kit, plot: Plot, rows: Datum[]) {
  if (!plot.labels) return;
  const { ctx } = k;
  ctx.font = labelFont(k);
  ctx.textAlign = "center";
  ctx.fillStyle = k.ink;
  ctx.globalAlpha = k.alpha * LABEL;
  rows.forEach((row, index) => ctx.fillText(row.label, plot.x(index), plot.labelY));
}

function columns(k: Kit, rows: Datum[]) {
  const { ctx, env, size } = k;
  const n = rows.length;
  const scale = scaleOf(rows.map((row) => row.value), k.layer.max);
  const plot = plotOf(k, rows, scale, true);
  guides(k, plot, scale);
  categoryLabels(k, plot, rows);
  const width = plot.slot * (n === 1 ? 0.42 : n <= 3 ? 0.52 : 0.62);
  const zero = plot.y(0);
  rows.forEach((row, index) => {
    const p = staggered(k.growth, index, n);
    const value = row.value * p;
    const end = plot.y(value);
    const up = value >= 0;
    ctx.globalAlpha = k.alpha;
    ctx.fillStyle = row.color ? env.fill(row.color, "accent", k.box) : k.series;
    barPath(ctx, plot.x(index), zero, 0, up ? -1 : 1, Math.abs(zero - end), width, width * 0.18);
    ctx.fill();
    if (plot.values && p > 0) {
      ctx.globalAlpha = k.alpha * clamp(p * 2.5);
      ctx.fillStyle = k.ink;
      ctx.font = valueFont(k);
      ctx.textAlign = "center";
      ctx.fillText(valueText(k.layer, value, decimalsOf(row.value)), plot.x(index), end + (up ? -size * 0.75 : size * 0.75));
    }
  });
}

function bars(k: Kit, rows: Datum[]) {
  const { ctx, env, box, size } = k;
  const n = rows.length;
  const scale = scaleOf(rows.map((row) => row.value), k.layer.max);
  const rowHeight = box.height / n;
  const roomy = rowHeight >= size * 1.2;
  let labelWidth = k.labels && roomy ? Math.min(widest(ctx, labelFont(k), rows.map((row) => row.label)), box.width * 0.36) : 0;
  let valueWidth = k.values && roomy ? widest(ctx, valueFont(k), rows.map((row) => valueText(k.layer, row.value))) : 0;
  // A box too narrow for words beside its bars keeps just the bars.
  if (box.width - labelWidth - valueWidth - size * 1.05 < box.width * 0.35) labelWidth = valueWidth = 0;
  const left = box.x + (labelWidth ? labelWidth + size * 0.6 : 0);
  const right = box.x + box.width - (valueWidth ? valueWidth + size * 0.45 : 0);
  const span = scale.hi - scale.lo || 1;
  const x = (value: number) => left + ((value - scale.lo) / span) * (right - left);
  const zero = x(0);
  ctx.strokeStyle = k.guide;
  ctx.lineWidth = Math.max(1, env.unit * 1.5);
  if (k.grid) {
    ctx.globalAlpha = k.alpha * GRIDLINE;
    for (const tick of ticksOf(scale)) if (tick !== 0) line(ctx, x(tick), box.y, x(tick), box.y + box.height);
  }
  ctx.globalAlpha = k.alpha * BASELINE;
  line(ctx, zero, box.y, zero, box.y + box.height);
  const thickness = Math.min(rowHeight * 0.62, size * 2.2);
  rows.forEach((row, index) => {
    const p = staggered(k.growth, index, n);
    const value = row.value * p;
    const end = x(value);
    const forward = value >= 0;
    const cy = box.y + rowHeight * (index + 0.5);
    ctx.globalAlpha = k.alpha;
    ctx.fillStyle = row.color ? env.fill(row.color, "accent", box) : k.series;
    barPath(ctx, zero, cy, forward ? 1 : -1, 0, Math.abs(end - zero), thickness, thickness * 0.18);
    ctx.fill();
    ctx.fillStyle = k.ink;
    if (labelWidth) {
      ctx.globalAlpha = k.alpha * LABEL;
      ctx.font = labelFont(k);
      ctx.textAlign = "left";
      const label = fitText(ctx, row.label, labelWidth);
      if (label) ctx.fillText(label, box.x, cy);
    }
    if (valueWidth && p > 0) {
      ctx.globalAlpha = k.alpha * clamp(p * 2.5);
      ctx.font = valueFont(k);
      ctx.textAlign = forward ? "left" : "right";
      ctx.fillText(valueText(k.layer, value, decimalsOf(row.value)), end + (forward ? size * 0.45 : -size * 0.45), cy);
    }
  });
}

/** The area under a line: the series colour fading toward the zero line. A metal fades in its middle tone, since its
 *  bands of light laid on faint only look muddy; a colour that can't be read is laid on flat and faint. */
function areaFill(k: Kit, top: number, zero: number): { fill: Fill; alpha: number } {
  const flat = rgbOf(k.env.flat(k.layer.fill, "accent"));
  if (!flat) return { fill: k.series, alpha: 0.25 };
  const gradient = k.ctx.createLinearGradient(0, top, 0, zero);
  gradient.addColorStop(0, rgba(flat, 0.36));
  gradient.addColorStop(1, rgba(flat, 0.04));
  return { fill: gradient, alpha: 1 };
}

function lines(k: Kit, rows: Datum[], area: boolean) {
  const { ctx, env, box, size } = k;
  const scale = scaleOf(rows.map((row) => row.value), k.layer.max);
  const plot = plotOf(k, rows, scale);
  guides(k, plot, scale);
  categoryLabels(k, plot, rows);
  const points = rows.map((row, index) => ({ x: plot.x(index), y: plot.y(row.value) }));
  const width = Math.max(2 * env.unit, size * 0.13);
  const first = points[0].x;
  const last = points[points.length - 1].x;
  // Uncovered from the left; the reach runs a little past the last point, so its dot is whole when the line is.
  const lead = width * 6;
  const reach = first + (last - first + lead) * k.growth;
  const zero = plot.y(0);
  if (points.length > 1) {
    ctx.save();
    if (k.growth < 1) {
      ctx.beginPath();
      ctx.rect(box.x - lead, box.y - size * 2, reach - box.x + lead, box.height + size * 4);
      ctx.clip();
    }
    if (area) {
      ctx.beginPath();
      ctx.moveTo(first, zero);
      ctx.lineTo(points[0].x, points[0].y);
      curveThrough(ctx, points);
      ctx.lineTo(last, zero);
      ctx.closePath();
      const under = areaFill(k, plot.top, zero);
      ctx.globalAlpha = k.alpha * under.alpha;
      ctx.fillStyle = under.fill;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    curveThrough(ctx, points);
    ctx.globalAlpha = k.alpha;
    ctx.strokeStyle = k.series;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }
  const radius = width * 1.6;
  rows.forEach((row, index) => {
    const point = points[index];
    const shown = clamp((reach - point.x) / lead);
    if (shown <= 0) return;
    ctx.fillStyle = row.color ? env.fill(row.color, "accent", box) : k.series;
    if (index === rows.length - 1) {
      // The latest value wears a soft halo: the point the eye should land on.
      ctx.globalAlpha = k.alpha * 0.2 * shown;
      circle(ctx, point.x, point.y, radius * 2.3 * shown);
      ctx.fill();
    }
    ctx.globalAlpha = k.alpha;
    circle(ctx, point.x, point.y, radius * shown);
    ctx.fill();
    if (plot.values) {
      ctx.globalAlpha = k.alpha * shown;
      ctx.fillStyle = k.ink;
      ctx.font = valueFont(k);
      ctx.textAlign = "center";
      // Always over the point: under it, the lowest point's value would run into the labels.
      ctx.fillText(valueText(k.layer, row.value), point.x, point.y - size * 0.85);
    }
  });
}

/** A slice of a pie or a donut from `start` to `end`, as the current path. Each straight side is set in by half of
 *  `gap`, so neighbouring slices sit an even gap apart; false when the slice is too thin to show past its gap. */
function wedge(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number, start: number, end: number, gap: number): boolean {
  const half = gap / 2;
  const sweep = end - start;
  const outerInset = Math.asin(Math.min(1, half / outer));
  if (sweep <= outerInset * 2 + 1e-6) return false;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, start + outerInset, end - outerInset);
  const innerInset = inner > 0 ? Math.asin(Math.min(1, half / inner)) : 0;
  if (inner > 0 && sweep > innerInset * 2) ctx.arc(cx, cy, inner, end - innerInset, start + innerInset, true);
  else {
    // Where the two set-in sides meet, on the line through the slice's middle.
    const middle = (start + end) / 2;
    const reach = half > 0 ? Math.min(outer * 0.9, half / Math.sin(sweep / 2)) : 0;
    ctx.lineTo(cx + Math.cos(middle) * reach, cy + Math.sin(middle) * reach);
  }
  ctx.closePath();
  return true;
}

/** Where one row's key goes: its dot's left edge and middle, the room for its label, and the right edge its value lines
 *  up on in a column of keys, or null when the value follows the label. */
interface Key {
  x: number;
  y: number;
  labelWidth: number;
  valueX: number | null;
}

const KEY_DOT = 0.95;
const KEY_GAP = 0.7;

/** Room for a pie and its keys: a column of keys beside a wide box, lines of keys under a tall one, centred together,
 *  or no keys and the whole box for the pie when they would crowd it. */
function pieLayout(k: Kit, rows: Datum[]): { cx: number; cy: number; radius: number; keys: Key[] } {
  const { ctx, box, size } = k;
  const whole = { cx: box.x + box.width / 2, cy: box.y + box.height / 2, radius: Math.min(box.width, box.height) / 2, keys: [] as Key[] };
  if (!k.labels && !k.values) return whole;
  const dot = size * KEY_DOT;
  const between = k.labels && k.values ? size * KEY_GAP : 0;
  ctx.font = labelFont(k);
  const labelWidths = rows.map((row) => (k.labels ? ctx.measureText(row.label).width : 0));
  ctx.font = valueFont(k);
  const valueWidths = rows.map((row) => (k.values ? ctx.measureText(valueText(k.layer, row.value)).width : 0));
  const lineHeight = size * 1.6;
  if (box.width >= box.height * 1.25) {
    const valueWidth = Math.max(...valueWidths);
    const width = Math.min(dot + Math.max(...labelWidths) + between + valueWidth, box.width * 0.48);
    const gap = size * 1.4;
    const diameter = Math.min(box.height, box.width - width - gap);
    const step = Math.min(lineHeight, box.height / rows.length);
    if (step < size * 1.15 || diameter < box.height * 0.4) return whole;
    const left = box.x + (box.width - diameter - gap - width) / 2;
    const x = left + diameter + gap;
    const keys = rows.map((_, index) => ({ x, y: whole.cy + (index - (rows.length - 1) / 2) * step, labelWidth: width - dot - between - valueWidth, valueX: k.values ? x + width : null }));
    return { cx: left + diameter / 2, cy: whole.cy, radius: diameter / 2, keys };
  }
  const gap = size * 1.2;
  const widths = rows.map((_, index) => Math.min(box.width, dot + labelWidths[index] + between + valueWidths[index]));
  const flow: number[][] = [[]];
  let used = 0;
  widths.forEach((width, index) => {
    const current = flow[flow.length - 1];
    if (current.length && used + gap + width > box.width) {
      flow.push([index]);
      used = width;
    } else {
      used += (current.length ? gap : 0) + width;
      current.push(index);
    }
  });
  const keysHeight = flow.length * lineHeight;
  const room = size * 0.8;
  const diameter = Math.min(box.width, box.height - keysHeight - room);
  if (diameter < Math.min(box.width, box.height) * 0.45) return whole;
  const top = box.y + (box.height - diameter - room - keysHeight) / 2;
  const keys: Key[] = [];
  flow.forEach((indices, lineIndex) => {
    let x = box.x + (box.width - indices.reduce((sum, index) => sum + widths[index], 0) - gap * (indices.length - 1)) / 2;
    for (const index of indices) {
      keys[index] = { x, y: top + diameter + room + lineHeight * (lineIndex + 0.5), labelWidth: widths[index] - dot - between - valueWidths[index], valueX: null };
      x += widths[index] + gap;
    }
  });
  return { cx: whole.cx, cy: top + diameter / 2, radius: diameter / 2, keys };
}

function drawKeys(k: Kit, rows: Datum[], keys: Key[], paints: Paint[]) {
  const { ctx, env, size } = k;
  const fade = k.alpha * clamp(k.growth * 1.6);
  const dot = size * 0.27;
  rows.forEach((row, index) => {
    const key = keys[index];
    if (!key) return;
    ctx.globalAlpha = fade;
    // A metal's bands of light would only smudge a dot this small, so it takes the metal's middle tone.
    ctx.fillStyle = env.flat(paints[index], "accent");
    circle(ctx, key.x + dot, key.y, dot);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = k.ink;
    let after = key.x + size * KEY_DOT;
    if (k.labels) {
      ctx.font = labelFont(k);
      ctx.globalAlpha = fade * 0.86;
      const label = fitText(ctx, row.label, key.labelWidth);
      if (label) ctx.fillText(label, after, key.y);
      after += ctx.measureText(label).width + size * KEY_GAP;
    }
    if (k.values) {
      ctx.font = valueFont(k);
      ctx.globalAlpha = fade;
      if (key.valueX !== null) ctx.textAlign = "right";
      ctx.fillText(valueText(k.layer, row.value), key.valueX ?? after, key.y);
    }
  });
}

/** A big value counting up in the middle of a ring or a donut, its label under it when there is room. */
function centreWords(k: Kit, cx: number, cy: number, inner: number, row: Datum) {
  const { ctx } = k;
  if (!k.values || inner < k.size * 1.2) return;
  const px = fitSize(k, valueText(k.layer, row.value), inner * 0.62, inner * 1.5, 700);
  const label = k.labels ? row.label : "";
  const labelPx = Math.min(k.size, inner * 0.26);
  const gap = labelPx * 0.35;
  const y = label ? cy - (labelPx + gap) / 2 : cy;
  ctx.textAlign = "center";
  ctx.fillStyle = k.ink;
  ctx.globalAlpha = k.alpha;
  ctx.font = fontAt(k, px, 700);
  ctx.fillText(valueText(k.layer, row.value * k.growth, decimalsOf(row.value)), cx, y);
  if (!label) return;
  ctx.font = fontAt(k, labelPx, 500);
  ctx.globalAlpha = k.alpha * LABEL;
  const fitted = fitText(ctx, label, inner * 1.5);
  if (fitted) ctx.fillText(fitted, cx, y + px / 2 + gap + labelPx / 2);
}

function pie(k: Kit, rows: Datum[], donut: boolean) {
  const { ctx, env } = k;
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  const paints = rowPaints(k, rows);
  const { cx, cy, radius, keys } = pieLayout(k, rows);
  const inner = donut ? radius * 0.6 : 0;
  const disc = { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 };
  if (total <= 0) {
    // Nothing to share out: an empty track, so the chart still shows where it is.
    ctx.globalAlpha = k.alpha * TRACK;
    ctx.fillStyle = k.guide;
    wedge(ctx, cx, cy, radius, inner, -Math.PI / 2, Math.PI * 1.5, 0);
    ctx.fill();
  } else {
    const gap = rows.length > 1 ? Math.max(1.5 * env.unit, radius * 0.02) : 0;
    const sweep = Math.PI * 2 * k.growth;
    let start = -Math.PI / 2;
    ctx.globalAlpha = k.alpha;
    rows.forEach((row, index) => {
      const end = start + (Math.max(0, row.value) / total) * sweep;
      ctx.fillStyle = env.fill(paints[index], "accent", disc);
      if (wedge(ctx, cx, cy, radius, inner, start, end, gap)) ctx.fill();
      start = end;
    });
  }
  drawKeys(k, rows, keys, paints);
  if (donut) centreWords(k, cx, cy, inner, rows[0]);
}

function ring(k: Kit, row: Datum) {
  const { ctx, env, box } = k;
  const max = k.layer.max && k.layer.max > 0 ? k.layer.max : 100;
  const radius = Math.min(box.width, box.height) / 2;
  const thickness = Math.max(3 * env.unit, radius * 0.15);
  const middle = radius - thickness / 2;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.globalAlpha = k.alpha * TRACK;
  ctx.strokeStyle = k.guide;
  ctx.beginPath();
  ctx.arc(cx, cy, middle, 0, Math.PI * 2);
  ctx.stroke();
  const turn = Math.PI * 2 * clamp(row.value / max) * k.growth;
  if (turn > 0) {
    ctx.globalAlpha = k.alpha;
    ctx.strokeStyle = row.color ? env.fill(row.color, "accent", box) : k.series;
    ctx.beginPath();
    ctx.arc(cx, cy, middle, -Math.PI / 2, -Math.PI / 2 + turn);
    ctx.stroke();
  }
  centreWords(k, cx, cy, radius - thickness, row);
}

function progress(k: Kit, row: Datum) {
  const { ctx, env, box, size } = k;
  const max = k.layer.max && k.layer.max > 0 ? k.layer.max : 100;
  const label = k.labels ? row.label : "";
  let band = label || k.values ? size * 1.6 : 0;
  if (box.height < band + 4 * env.unit) band = 0;
  const thickness = Math.max(2 * env.unit, Math.min(size * 0.7, box.height - band));
  const top = box.y + (box.height - band - thickness) / 2;
  const trackY = top + band;
  ctx.globalAlpha = k.alpha * TRACK;
  ctx.fillStyle = k.guide;
  roundRect(ctx, box.x, trackY, box.width, thickness, thickness / 2);
  ctx.fill();
  const length = box.width * clamp(row.value / max) * k.growth;
  if (length > 0) {
    ctx.globalAlpha = k.alpha;
    ctx.fillStyle = row.color ? env.fill(row.color, "accent", box) : k.series;
    roundRect(ctx, box.x, trackY, length, thickness, thickness / 2);
    ctx.fill();
  }
  if (!band) return;
  const y = top + band * 0.38;
  ctx.fillStyle = k.ink;
  let valueWidth = 0;
  if (k.values) {
    ctx.font = valueFont(k);
    valueWidth = ctx.measureText(valueText(k.layer, row.value)).width;
    ctx.globalAlpha = k.alpha;
    ctx.textAlign = "right";
    ctx.fillText(valueText(k.layer, row.value * k.growth, decimalsOf(row.value)), box.x + box.width, y);
  }
  if (label) {
    ctx.font = labelFont(k);
    ctx.globalAlpha = k.alpha * LABEL;
    ctx.textAlign = "left";
    const fitted = fitText(ctx, label, box.width - valueWidth - (valueWidth ? size : 0));
    if (fitted) ctx.fillText(fitted, box.x, y);
  }
}

function number(k: Kit, row: Datum) {
  const { ctx, env, box, size } = k;
  const label = k.labels ? row.label : "";
  const band = label && box.height >= size * 3.2 ? size * 1.7 : 0;
  const final = valueText(k.layer, row.value);
  // Sized by the value it ends on, so the counting never makes it jump.
  const px = fitSize(k, final, (box.height - band) * 0.84, box.width * 0.98, 700);
  const top = box.y + (box.height - px - band) / 2;
  const align = k.layer.align ?? "center";
  const x = align === "left" ? box.x : align === "right" ? box.x + box.width : box.x + box.width / 2;
  ctx.textAlign = align;
  ctx.font = fontAt(k, px, 700);
  const width = ctx.measureText(final).width;
  const left = align === "left" ? x : align === "right" ? x - width : x - width / 2;
  ctx.globalAlpha = k.alpha;
  // A metal is laid across the number itself, so its light falls on the figures rather than the empty box.
  ctx.fillStyle = env.fill(row.color ?? k.layer.fill, "accent", { x: left, y: top, width, height: px });
  ctx.fillText(valueText(k.layer, row.value * k.growth, decimalsOf(row.value)), x, top + px / 2);
  if (!band) return;
  ctx.font = labelFont(k);
  ctx.globalAlpha = k.alpha * LABEL;
  ctx.fillStyle = k.ink;
  const fitted = fitText(ctx, label, box.width);
  if (fitted) ctx.fillText(fitted, x, top + px + band * 0.5);
}

function poll(k: Kit, rows: Datum[]) {
  const { ctx, env, box, size } = k;
  const n = rows.length;
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0) || 1;
  const shares = rows.map((row) => Math.max(0, row.value) / total);
  const leader = shares.indexOf(Math.max(...shares));
  const paints = rowPaints(k, rows);
  const rowHeight = box.height / n;
  const thickness = Math.max(3 * env.unit, Math.min(size * 0.5, rowHeight * 0.24));
  const lineHeight = size * 1.3;
  const gap = size * 0.3;
  const words = (k.labels || k.values) && rowHeight >= size * 1.15;
  // Words over each bar when the rows have room for both; otherwise the label before the bar and the share after it.
  const stacked = words && rowHeight >= lineHeight + gap + thickness + size * 0.2;
  const percentWidth = k.values ? widest(ctx, valueFont(k), ["100%"]) : 0;
  const labelColumn = words && !stacked && k.labels ? Math.min(widest(ctx, labelFont(k), rows.map((row) => row.label)), box.width * 0.3) + size * 0.6 : 0;
  const trackLeft = box.x + labelColumn;
  const trackRight = box.x + box.width - (words && !stacked && k.values ? percentWidth + size * 0.5 : 0);
  const trackWidth = Math.max(0, trackRight - trackLeft);
  rows.forEach((row, index) => {
    const p = staggered(k.growth, index, n);
    const rowTop = box.y + rowHeight * index;
    const block = stacked ? lineHeight + gap + thickness : thickness;
    const barY = rowTop + (rowHeight - block) / 2 + (stacked ? lineHeight + gap : 0);
    const textY = stacked ? rowTop + (rowHeight - block) / 2 + lineHeight / 2 : rowTop + rowHeight / 2;
    ctx.globalAlpha = k.alpha * TRACK;
    ctx.fillStyle = k.guide;
    roundRect(ctx, trackLeft, barY, trackWidth, thickness, thickness / 2);
    ctx.fill();
    const length = trackWidth * shares[index] * p;
    if (length > 0) {
      ctx.globalAlpha = k.alpha;
      ctx.fillStyle = env.fill(paints[index], "accent", box);
      roundRect(ctx, trackLeft, barY, length, thickness, thickness / 2);
      ctx.fill();
    }
    if (!words) return;
    // The leading answer is set bold, the way a result is read out.
    const lead = index === leader;
    ctx.fillStyle = k.ink;
    ctx.globalAlpha = k.alpha * (lead ? 1 : 0.86);
    if (k.values) {
      ctx.font = fontAt(k, size, lead ? 750 : 600);
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(shares[index] * 100 * p)}%`, box.x + box.width, textY);
    }
    if (k.labels) {
      ctx.font = fontAt(k, size, lead ? 700 : 500);
      ctx.textAlign = "left";
      const label = fitText(ctx, row.label, stacked ? box.width - percentWidth - size : labelColumn - size * 0.6);
      if (label) ctx.fillText(label, box.x, textY);
    }
  });
}

function kitOf(ctx: CanvasRenderingContext2D, layer: Layer, box: PaintBox, env: PaintEnv): Kit {
  return {
    ctx,
    layer,
    env,
    box,
    growth: clamp(env.growth),
    size: (layer.size ?? 28) * env.unit,
    alpha: ctx.globalAlpha,
    series: env.fill(layer.fill, "accent", box),
    guide: env.fill(layer.stroke, "muted", box),
    ink: env.fill(layer.color, "text", box),
    labels: layer.showLabels !== false,
    values: layer.showValues !== false,
    grid: layer.showGrid === true,
  };
}

/** Draws a chart layer's rows in its box, grown in as far as `env.growth` says. */
export function paintChart(ctx: CanvasRenderingContext2D, layer: Layer, box: PaintBox, env: PaintEnv): void {
  const rows = (layer.data ?? []).filter((row) => Number.isFinite(row.value)).slice(0, MAX_ROWS);
  if (!rows.length || box.width <= 0 || box.height <= 0) return;
  ctx.save();
  const k = kitOf(ctx, layer, box, env);
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const kind = layer.chart ?? "column";
  if (kind === "column") columns(k, rows);
  else if (kind === "bar") bars(k, rows);
  else if (kind === "line" || kind === "area") lines(k, rows, kind === "area");
  else if (kind === "pie" || kind === "donut") pie(k, rows, kind === "donut");
  else if (kind === "ring") ring(k, rows[0]);
  else if (kind === "progress") progress(k, rows[0]);
  else if (kind === "number") number(k, rows[0]);
  else poll(k, rows);
  ctx.restore();
}

const week = (values: number[]): Datum[] => values.map((value, index) => ({ label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index], value }));

/** Rows each form starts with: weekdays, answers to a question, a share, a number, all plainly there to be typed over. */
export const CHART_SAMPLES: Record<ChartKind, Datum[]> = {
  column: week([12, 19, 15, 24, 21, 30, 27]),
  bar: week([18, 26, 21, 32, 28]),
  line: week([14, 18, 16, 23, 21, 28, 31]),
  area: week([9, 14, 12, 19, 24, 22, 29]),
  pie: [
    { label: "Yes", value: 58 },
    { label: "No", value: 27 },
    { label: "Not sure", value: 15 },
  ],
  donut: [
    { label: "Yes", value: 64 },
    { label: "No", value: 36 },
  ],
  ring: [{ label: "Sample", value: 72 }],
  progress: [{ label: "Sample goal", value: 64 }],
  number: [{ label: "Sample number", value: 1250 }],
  poll: [
    { label: "Yes", value: 48 },
    { label: "No", value: 32 },
    { label: "Not sure", value: 20 },
  ],
};

// Each form's usual size on the frame, as shares of its width and height; the rest take 0.6 by 0.4.
const CHART_BOXES: Partial<Record<ChartKind, { w: number; h: number }>> = { number: { w: 0.4, h: 0.25 }, ring: { w: 0.32, h: 0.32 }, progress: { w: 0.6, h: 0.12 }, poll: { w: 0.6, h: 0.36 } };
// The samples that are shares of a hundred say so.
const CHART_SUFFIXES: Partial<Record<ChartKind, string>> = { pie: "%", donut: "%", ring: "%", progress: "%" };

/** A chart layer ready to add, centred on the frame, with the form's sample rows, growing in as it appears. */
export function chartLayer(kind: ChartKind, id: string): Layer {
  const { w, h } = CHART_BOXES[kind] ?? { w: 0.6, h: 0.4 };
  const suffix = CHART_SUFFIXES[kind];
  return { id, kind: "chart", chart: kind, data: CHART_SAMPLES[kind].map((row) => ({ ...row })), x: (1 - w) / 2, y: (1 - h) / 2, w, h, rotation: 0, opacity: 1, enter: "grow", ...(suffix ? { suffix } : {}) };
}
