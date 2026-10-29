/* Tables on the frame: rows of cells, a header row in the layer's fill, stripes and rules, the words fitted to their
   cells. While the table grows in, each row fades and rises into place a moment after the one above it. */

import type { Layer } from "./layers.js";
import type { PaintBox, PaintEnv } from "./paint-env.js";
import { fontOf, inkOn, roundRect } from "./render.js";

export type TableStyle = "simple" | "header" | "striped" | "schedule" | "scoreboard";

const MAX_ROWS = 10;
const MAX_COLUMNS = 6;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

let segmenter: Intl.Segmenter | null | undefined;

/** A string's letters as a reader sees them, so an accent or an emoji is never cut in half. */
function graphemes(text: string): string[] {
  if (segmenter === undefined) segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("en", { granularity: "grapheme" }) : null;
  return segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);
}

/** Words cut to fit `width` in the canvas's current font, ending in an ellipsis when they had to be cut; empty when not
 *  even the ellipsis fits. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  const letters = graphemes(text);
  const cut = (count: number) => `${letters.slice(0, count).join("").trimEnd()}…`;
  const fits = (count: number) => ctx.measureText(cut(count)).width <= width;
  let low = 0;
  let high = letters.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) low = middle;
    else high = middle - 1;
  }
  return fits(low) ? cut(low) : "";
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Each column's width by the room its words take: every column first gets what it needs up to an even share, the
 *  columns needing more share what is left over, and any room still spare goes half evenly and half by need. So a
 *  column of times stays whole and narrow beside a long column of topics. */
function columnWidths(ctx: CanvasRenderingContext2D, cells: string[][], columns: number, width: number, pad: number, fonts: { body: string; head: string }, header: boolean): number[] {
  const need = Array.from({ length: columns }, (_, column) =>
    cells.reduce((most, row, index) => {
      ctx.font = header && index === 0 ? fonts.head : fonts.body;
      return Math.max(most, ctx.measureText(row[column] ?? "").width);
    }, 0) + pad * 2,
  );
  const even = width / columns;
  const base = need.map((value) => Math.min(value, even));
  const short = need.map((value, column) => value - base[column]);
  const covered = sum(short) > 0 ? Math.min(1, (width - sum(base)) / sum(short)) : 0;
  const granted = base.map((value, column) => value + short[column] * covered);
  const spare = Math.max(0, width - sum(granted));
  const needed = sum(need) || 1;
  return granted.map((value, column) => value + spare / 2 / columns + ((spare / 2) * need[column]) / needed);
}

/** Draws a table layer's cells in its box. */
export function paintTable(ctx: CanvasRenderingContext2D, layer: Layer, box: PaintBox, env: PaintEnv): void {
  const shown = (text: string) => (layer.uppercase ? text.toLocaleUpperCase() : text);
  const cells = (layer.cells ?? []).slice(0, MAX_ROWS).map((row) => row.slice(0, MAX_COLUMNS).map((cell) => shown(cell ?? "")));
  const rows = cells.length;
  const columns = Math.max(0, ...cells.map((row) => row.length));
  if (!rows || !columns || box.width <= 0 || box.height <= 0) return;

  const unit = env.unit;
  const size = layer.size ?? 28;
  const pad = size * unit * 0.5;
  const fonts = {
    body: fontOf({ ...layer, size }, env.family, unit, 500),
    head: fontOf({ ...layer, size, weight: Math.max(layer.weight ?? 0, 700) }, env.family, unit),
  };
  const header = Boolean(layer.header);
  const rules = layer.rules ?? "rows";
  const rowHeight = box.height / rows;
  const widths = columnWidths(ctx, cells, columns, box.width, pad, fonts, header);
  const lefts = widths.map((_, column) => box.x + widths.slice(0, column).reduce((sum, value) => sum + value, 0));
  const radius = Math.max(0, layer.radius ?? 0) * Math.min(box.width, box.height);

  const headPaint = env.fill(layer.fill, "accent", { x: box.x, y: box.y, width: box.width, height: rowHeight });
  const headInk = inkOn(env.flat(layer.fill, "accent"));
  const ink = env.fill(layer.color, "text", box);
  // A stripe in the theme's own words colour only tints the row; one the user picked shows as picked.
  const stripe = env.fill(layer.background, "text", box);
  const stripeAlpha = layer.background ? 1 : 0.07;
  const rule = env.fill(layer.stroke, "muted", box);
  const ruleAlpha = layer.stroke ? 1 : 0.55;
  const ruleWidth = Math.max(0, layer.strokeWidth ?? 1.5) * unit;

  ctx.save();
  const alpha = ctx.globalAlpha;
  if (radius > 0) {
    roundRect(ctx, box.x, box.y, box.width, box.height, radius);
    ctx.clip();
  }
  ctx.textBaseline = "middle";
  const align = layer.align ?? "left";
  ctx.textAlign = align;
  const stagger = 1 + 0.3 * (rows - 1);
  for (let row = 0; row < rows; row++) {
    const p = clamp(env.growth * stagger - row * 0.3);
    if (p <= 0) continue;
    const top = box.y + row * rowHeight + (1 - p) * rowHeight * 0.4;
    const head = header && row === 0;
    const body = row - (header ? 1 : 0);
    if (head || (layer.stripes && body % 2 === 1)) {
      ctx.globalAlpha = alpha * p * (head ? 1 : stripeAlpha);
      ctx.fillStyle = head ? headPaint : stripe;
      // A hair over the row's own height, so neighbouring fills never show a seam between them.
      ctx.fillRect(box.x, top, box.width, rowHeight + (row < rows - 1 ? 0.5 : 0));
    }
    // A rule under a filled header would only blur its edge.
    const under = row < rows - 1 && !head;
    const between = rules === "grid" && columns > 1;
    if (ruleWidth > 0 && rules !== "none" && (under || between)) {
      ctx.globalAlpha = alpha * p * ruleAlpha;
      ctx.strokeStyle = rule;
      ctx.lineWidth = ruleWidth;
      ctx.beginPath();
      if (under) {
        ctx.moveTo(box.x, top + rowHeight);
        ctx.lineTo(box.x + box.width, top + rowHeight);
      }
      if (between)
        for (let column = 1; column < columns; column++) {
          ctx.moveTo(lefts[column], top);
          ctx.lineTo(lefts[column], top + rowHeight);
        }
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * p;
    ctx.font = head ? fonts.head : fonts.body;
    ctx.fillStyle = head ? headInk : ink;
    cells[row].forEach((cell, column) => {
      if (!cell.trim()) return;
      const text = fitText(ctx, cell, widths[column] - pad * 2);
      if (!text) return;
      const x = align === "center" ? lefts[column] + widths[column] / 2 : align === "right" ? lefts[column] + widths[column] - pad : lefts[column] + pad;
      ctx.fillText(text, x, top + rowHeight / 2);
    });
  }
  if (rules === "grid" && ruleWidth > 0) {
    // The border comes in with the first row, so the table's outline is there before its rows fill it.
    ctx.globalAlpha = alpha * clamp(env.growth * stagger) * ruleAlpha;
    ctx.strokeStyle = rule;
    ctx.lineWidth = ruleWidth;
    // Inset by half the line, so the clip doesn't shave the border's outer half.
    const inset = ruleWidth / 2;
    roundRect(ctx, box.x + inset, box.y + inset, box.width - ruleWidth, box.height - ruleWidth, Math.max(0, radius - inset));
    ctx.stroke();
  }
  ctx.restore();
}

// Sample rows a host types over; they read as stand-ins, never as real figures.
const TABLES: Record<TableStyle, Partial<Layer> & { cells: string[][] }> = {
  simple: {
    rules: "rows",
    cells: [
      ["First item", "Detail"],
      ["Second item", "Detail"],
      ["Third item", "Detail"],
    ],
  },
  header: {
    header: true,
    rules: "rows",
    radius: 0.03,
    cells: [
      ["Name", "Role", "Since"],
      ["Guest name", "Founder", "Year"],
      ["Host name", "Host", "Year"],
      ["Co-host name", "Producer", "Year"],
    ],
  },
  striped: {
    header: true,
    stripes: true,
    rules: "none",
    radius: 0.03,
    cells: [
      ["Option", "Price", "Notes"],
      ["Option A", "$10", "Your note"],
      ["Option B", "$20", "Your note"],
      ["Option C", "$30", "Your note"],
    ],
  },
  schedule: {
    header: true,
    rules: "rows",
    radius: 0.03,
    cells: [
      ["Time", "Topic"],
      ["0:00", "Welcome and intro"],
      ["12:30", "Main conversation"],
      ["48:00", "Listener questions"],
    ],
  },
  scoreboard: {
    header: true,
    rules: "grid",
    align: "center",
    radius: 0.03,
    cells: [
      ["Player", "Points", "Wins"],
      ["Player one", "120", "4"],
      ["Player two", "95", "3"],
      ["Player three", "80", "2"],
    ],
  },
};

/** A table layer ready to add, centred on the frame, with sample cells in one of the ready-made styles. */
export function tableLayer(style: TableStyle, id: string): Layer {
  const look = TABLES[style];
  const w = 0.7;
  const h = Math.min(0.6, look.cells.length * 0.08);
  return { id, kind: "table", x: (1 - w) / 2, y: (1 - h) / 2, w, h, rotation: 0, opacity: 1, enter: "grow", ...look, cells: look.cells.map((row) => [...row]) };
}
