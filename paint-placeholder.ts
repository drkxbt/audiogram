/* An empty photo frame while the picture is edited: a small sunny landscape that says a picture goes here. Its colours
   are fixed, so it reads the same on a black page and a white one. It is drawn inside the clip the caller has already
   set to the frame's shape. */
import type { ShapeKind } from "./layers.js";
import type { PaintBox } from "./paint-env.js";
import { shapePath } from "./render.js";

const INK = "#2f4a6e";
const FONT = "Geist, ui-sans-serif, system-ui, sans-serif";
// Below these sides, in canvas pixels, the badge and then the hint would crowd the drawing.
const BADGE_FROM = 72;
const HINT_FROM = 140;

/**
 * Fills `box` with the empty-frame drawing: sky, sun and hills, a white badge with a picture sign once there is room,
 * and the hint under it with a dashed outline once there is more. `shape` and `radius` (in pixels) trace the outline
 * the way the frame is cut.
 */
export function paintPlaceholder(ctx: CanvasRenderingContext2D, box: PaintBox, unit: number, text: string, shape: ShapeKind = "rect", radius = 0): void {
  const side = Math.min(box.width, box.height);
  if (!(side > 0)) return;
  ctx.save();
  paintLandscape(ctx, box, side);
  if (side >= HINT_FROM) paintOutline(ctx, box, side, unit, shape, radius);
  if (side >= BADGE_FROM) paintBadge(ctx, box, side, unit, side >= HINT_FROM ? text : "");
  ctx.restore();
}

function paintLandscape(ctx: CanvasRenderingContext2D, box: PaintBox, side: number) {
  const { x, y, width: w, height: h } = box;
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, "#cfe1f7");
  sky.addColorStop(1, "#eef4fb");
  ctx.fillStyle = sky;
  // A pixel past every edge, so no seam of the page shows round an antialiased clip.
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

  const sunX = x + w * 0.72;
  const sunY = y + h * 0.3;
  const sunR = side * 0.075;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, sunR * 4.2);
  glow.addColorStop(0, "rgba(255, 233, 170, 0.75)");
  glow.addColorStop(0.45, "rgba(255, 241, 205, 0.28)");
  glow.addColorStop(1, "rgba(255, 246, 222, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - sunR * 4.2, sunY - sunR * 4.2, sunR * 8.4, sunR * 8.4);
  const disc = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  disc.addColorStop(0, "#fff3cf");
  disc.addColorStop(1, "#ffe08f");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  ridge(ctx, box, 0.74, 0.13, false, "#a6c2ea", "#c3d6f1");
  ridge(ctx, box, 0.87, 0.11, true, "#6f95cc", "#8eb0de");
}

/** Rolling hills across the box: two humps rising `swell` of the height above `level`, mirrored when `flip` is set,
 *  shaded from `top` at the crests to `bottom` at the foot. */
function ridge(ctx: CanvasRenderingContext2D, box: PaintBox, level: number, swell: number, flip: boolean, top: string, bottom: string) {
  const { x, y, width: w, height: h } = box;
  const at = (share: number) => (flip ? x + w * (1 - share) : x + w * share);
  const base = y + h * level;
  // Held to the width too, so a tall narrow frame gets rolling hills rather than peaks.
  const lift = Math.min(h, w * 0.7) * swell;
  const shade = ctx.createLinearGradient(0, base - lift, 0, y + h);
  shade.addColorStop(0, top);
  shade.addColorStop(1, bottom);
  ctx.fillStyle = shade;
  ctx.beginPath();
  // Level at every crest and valley, so the ground rolls without a crease.
  ctx.moveTo(at(-0.02), y + h + 1);
  ctx.lineTo(at(-0.02), base - lift * 0.2);
  ctx.bezierCurveTo(at(0.06), base - lift * 0.75, at(0.15), base - lift, at(0.26), base - lift);
  ctx.bezierCurveTo(at(0.37), base - lift, at(0.45), base - lift * 0.25, at(0.56), base - lift * 0.25);
  ctx.bezierCurveTo(at(0.66), base - lift * 0.25, at(0.71), base - lift * 0.85, at(0.81), base - lift * 0.85);
  ctx.bezierCurveTo(at(0.91), base - lift * 0.85, at(0.97), base - lift * 0.6, at(1.02), base - lift * 0.5);
  ctx.lineTo(at(1.02), y + h + 1);
  ctx.closePath();
  ctx.fill();
}

function paintOutline(ctx: CanvasRenderingContext2D, box: PaintBox, side: number, unit: number, shape: ShapeKind, radius: number) {
  const inset = Math.max(6 * unit, side * 0.045);
  const inner = { x: box.x + inset, y: box.y + inset, width: box.width - inset * 2, height: box.height - inset * 2 };
  shapePath(ctx, shape, inner, Math.max(0, radius - inset));
  ctx.strokeStyle = "rgba(47, 74, 110, 0.4)";
  ctx.lineWidth = Math.max(1, 1.5 * unit);
  ctx.lineCap = "round";
  ctx.setLineDash([6 * unit, 5 * unit]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** The white badge with a picture sign in the middle, and the hint under it when there is one. */
function paintBadge(ctx: CanvasRenderingContext2D, box: PaintBox, side: number, unit: number, text: string) {
  const size = Math.max(28 * unit, Math.min(side * 0.2, 76 * unit));
  const textSize = Math.max(11 * unit, Math.min(side * 0.06, 22 * unit));
  const gap = textSize * 0.7;
  const cx = box.x + box.width / 2;
  // With a hint the pair is centred together, so the badge sits a little above the middle.
  const cy = box.y + box.height * 0.46 - (text ? (gap + textSize) / 2 : 0);

  ctx.save();
  ctx.shadowColor = "rgba(47, 74, 110, 0.24)";
  ctx.shadowBlur = size * 0.32;
  ctx.shadowOffsetY = size * 0.08;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // A framed picture: its border, a mountain and a sun, in the badge's middle.
  const gw = size * 0.46;
  const gh = size * 0.36;
  const gx = cx - gw / 2;
  const gy = cy - gh / 2;
  const line = Math.max(1, size * 0.05);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = line;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(gx + line, gy);
  ctx.arcTo(gx + gw, gy, gx + gw, gy + gh, line * 1.4);
  ctx.arcTo(gx + gw, gy + gh, gx, gy + gh, line * 1.4);
  ctx.arcTo(gx, gy + gh, gx, gy, line * 1.4);
  ctx.arcTo(gx, gy, gx + gw, gy, line * 1.4);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gx + gw * 0.12, gy + gh * 0.84);
  ctx.lineTo(gx + gw * 0.4, gy + gh * 0.46);
  ctx.lineTo(gx + gw * 0.6, gy + gh * 0.7);
  ctx.lineTo(gx + gw * 0.72, gy + gh * 0.58);
  ctx.lineTo(gx + gw * 0.88, gy + gh * 0.84);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(gx + gw * 0.72, gy + gh * 0.3, size * 0.035, 0, Math.PI * 2);
  ctx.fill();

  if (!text) return;
  ctx.font = `600 ${Math.round(textSize * 10) / 10}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  // A soft white halo keeps the hint readable where it falls on the hills.
  ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
  ctx.shadowBlur = textSize * 0.6;
  ctx.fillText(text, cx, cy + size / 2 + gap, box.width * 0.86);
  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  ctx.shadowBlur = 0;
}
