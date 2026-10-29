/* Shaded forms that look solid: a sphere, a cube, a cylinder, a capsule, a cone, a torus and a pyramid, lit from the
   top left, with a bounce of light on the far side and a soft shadow where each meets the floor. Every form is drawn in
   a square the width of its box, then stretched to the box's height, so a resized form stays one piece. */
import type { Layer, Solid } from "./layers.js";
import type { PaintBox, PaintEnv } from "./paint-env.js";
import { METALS } from "./render.js";

type Ctx = CanvasRenderingContext2D;

/** The colours one form is shaded with, from its lit side to its shaded side, worked out from one base colour. */
interface Tones {
  base: string;
  /** Lightest to darkest. */
  peak: string;
  lit: string;
  shade: string;
  deep: string;
  /** Light bouncing back from the floor onto the far edge. */
  bounce: string;
  /** The shadow on the floor, tinted by the form. */
  cast: string;
  metal: boolean;
  gloss: boolean;
}

/** The red, green and blue of a colour written as #rgb or #rrggbb, or null for any other way of writing one. */
function channels(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) return null;
  const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
  const value = parseInt(digits, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** A colour moved `amount` of the way toward another, both as #rgb or #rrggbb; a colour written any other way is
 *  returned as it is. */
export function mix(hex: string, toward: string, amount: number): string {
  const from = channels(hex);
  const to = channels(toward);
  if (!from || !to) return hex;
  const share = Math.min(1, Math.max(0, amount));
  return `#${from.map((channel, index) => Math.round(channel + (to[index] - channel) * share).toString(16).padStart(2, "0")).join("")}`;
}

/** A colour as rgba at an alpha, for gradients that fade it out; an unreadable colour fades from white. */
function alpha(color: string, amount: number): string {
  const [r, g, b] = channels(color) ?? [255, 255, 255];
  return `rgba(${r}, ${g}, ${b}, ${Math.round(Math.min(1, Math.max(0, amount)) * 1000) / 1000})`;
}

function tonesOf(layer: Layer, env: PaintEnv): Tones {
  const paint = layer.fill ?? "accent";
  const metal = METALS[paint];
  const base = metal ? metal.base : env.flat(paint, "accent");
  // Polished metal throws back more light and falls darker on its far side than a painted surface does.
  const reach = metal ? 1.25 : 1;
  return {
    base,
    peak: mix(base, "#ffffff", 0.62 * reach),
    lit: mix(base, "#ffffff", 0.24 * reach),
    shade: mix(base, "#000000", 0.32 * reach),
    deep: mix(base, "#000000", 0.58 * reach),
    bounce: mix(base, "#ffffff", 0.42),
    cast: mix(base, "#000000", 0.82),
    metal: !!metal,
    gloss: layer.gloss !== false,
  };
}

/** Draws a solid layer's form in its box. */
export function paintSolid(ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv): void {
  if (!(box.width > 0 && box.height > 0)) return;
  const tones = tonesOf(layer, env);
  const side = box.width;
  ctx.save();
  ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
  ctx.scale(1, box.height / box.width);
  const form = FORMS[layer.solid ?? "sphere"] ?? FORMS.sphere;
  form(ctx, side, tones, layer.shadow !== false);
  ctx.restore();
}

/** A soft shadow on the floor: a wide faint one and a tight darker one where the form touches down. */
function floorShadow(ctx: Ctx, cx: number, cy: number, width: number, tones: Tones) {
  const blot = (rx: number, ry: number, strength: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    fade.addColorStop(0, alpha(tones.cast, strength));
    fade.addColorStop(0.55, alpha(tones.cast, strength * 0.45));
    fade.addColorStop(1, alpha(tones.cast, 0));
    ctx.fillStyle = fade;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  };
  blot(width * 0.92, width * 0.16, 0.3);
  blot(width * 0.42, width * 0.055, 0.5);
}

/** Light gathered in a soft spot, for a shine on a curved surface: `rx` across, `ry` up and down, turned by `turn`. */
function glint(ctx: Ctx, x: number, y: number, rx: number, ry: number, turn: number, strength: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.scale(1, ry / rx);
  const light = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  light.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
  light.addColorStop(0.35, `rgba(255, 255, 255, ${strength * 0.45})`);
  light.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = light;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Shading across a round body seen side on, left to right: lit, a band of highlight, the base, then into shadow with
 *  a little bounce of light right at the edge. */
function across(ctx: Ctx, left: number, right: number, tones: Tones) {
  const shading = ctx.createLinearGradient(left, 0, right, 0);
  shading.addColorStop(0, tones.shade);
  shading.addColorStop(0.08, tones.lit);
  shading.addColorStop(0.24, tones.peak);
  shading.addColorStop(0.36, tones.lit);
  shading.addColorStop(0.58, tones.base);
  shading.addColorStop(0.84, tones.deep);
  shading.addColorStop(0.95, tones.shade);
  shading.addColorStop(1, mix(tones.shade, tones.bounce, 0.35));
  return shading;
}

/** A tall narrow streak of light, for glossy round bodies, from `top` to `bottom` and `width` wide at `x`. */
function streak(ctx: Ctx, x: number, top: number, bottom: number, width: number, strength: number) {
  const light = ctx.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
  light.addColorStop(0, "rgba(255, 255, 255, 0)");
  light.addColorStop(0.5, `rgba(255, 255, 255, ${strength})`);
  light.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = light;
  ctx.fillRect(x - width / 2, top, width, bottom - top);
}

/** The band a polished metal shows of the world round it: a dark horizon across the middle and a bright one under it. */
function horizon(ctx: Ctx, top: number, bottom: number, at: number) {
  const band = ctx.createLinearGradient(0, top, 0, bottom);
  band.addColorStop(0, "rgba(0, 0, 0, 0)");
  band.addColorStop(Math.max(0, at - 0.22), "rgba(0, 0, 0, 0)");
  band.addColorStop(at, "rgba(0, 0, 0, 0.14)");
  band.addColorStop(Math.min(1, at + 0.12), "rgba(255, 255, 255, 0.1)");
  band.addColorStop(Math.min(1, at + 0.34), "rgba(255, 255, 255, 0)");
  band.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = band;
  ctx.fillRect(-1e4, top, 2e4, bottom - top);
}

/** Fills the current path and strokes it in the same colour with round joins, which softens its corners and closes the
 *  hairline seams between faces. */
function face(ctx: Ctx, fill: string | CanvasGradient, soften: number) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = fill;
  ctx.lineWidth = soften;
  ctx.lineJoin = "round";
  ctx.stroke();
}

type Form = (ctx: Ctx, side: number, tones: Tones, shadow: boolean) => void;

function sphere(ctx: Ctx, s: number, tones: Tones, shadow: boolean) {
  const r = s * 0.4;
  const cy = -s * 0.04;
  if (shadow) floorShadow(ctx, s * 0.03, cy + r * 0.97, r, tones);
  const lx = -r * 0.36;
  const ly = cy - r * 0.42;
  const body = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 1.6);
  body.addColorStop(0, tones.peak);
  body.addColorStop(0.16, tones.lit);
  body.addColorStop(0.42, tones.base);
  body.addColorStop(0.74, tones.shade);
  body.addColorStop(1, tones.deep);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.clip();
  // Light thrown back from the floor along the lower right edge, which keeps the dark side round instead of flat.
  const bounce = ctx.createRadialGradient(-r * 0.2, cy - r * 0.25, r * 0.92, -r * 0.2, cy - r * 0.25, r * 1.32);
  bounce.addColorStop(0, alpha(tones.bounce, 0));
  bounce.addColorStop(1, alpha(tones.bounce, tones.metal ? 0.5 : 0.38));
  ctx.fillStyle = bounce;
  ctx.fillRect(-r, cy - r, r * 2, r * 2);
  if (tones.metal) horizon(ctx, cy - r, cy + r, 0.56);
  if (tones.gloss) {
    glint(ctx, -r * 0.34, cy - r * 0.4, r * 0.36, r * 0.26, -0.6, tones.metal ? 0.95 : 0.75);
    glint(ctx, -r * 0.38, cy - r * 0.44, r * 0.09, r * 0.07, -0.6, 0.95);
  }
  ctx.restore();
}

function cube(ctx: Ctx, s: number, tones: Tones, shadow: boolean) {
  const e = s * 0.4;
  const half = e * Math.cos(Math.PI / 6);
  const top = -s * 0.46;
  const T = [0, top];
  const R = [half, top + e / 2];
  const C = [0, top + e];
  const L = [-half, top + e / 2];
  const drop = (point: number[]) => [point[0], point[1] + e];
  if (shadow) floorShadow(ctx, s * 0.05, top + e * 2 - e * 0.18, e * 1.05, tones);
  const path = (...points: number[][]) => {
    ctx.beginPath();
    points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  const soften = s * 0.012;

  const left = ctx.createLinearGradient(0, L[1], 0, drop(C)[1]);
  left.addColorStop(0, mix(tones.base, tones.lit, 0.45));
  left.addColorStop(1, mix(tones.base, tones.shade, 0.45));
  path(L, C, drop(C), drop(L));
  face(ctx, left, soften);

  const right = ctx.createLinearGradient(C[0], C[1], drop(R)[0], drop(R)[1]);
  right.addColorStop(0, tones.shade);
  right.addColorStop(0.8, tones.deep);
  right.addColorStop(1, mix(tones.deep, tones.bounce, 0.18));
  path(C, R, drop(R), drop(C));
  face(ctx, right, soften);

  const lid = ctx.createLinearGradient(L[0], L[1] - e * 0.3, R[0], R[1] + e * 0.3);
  lid.addColorStop(0, tones.peak);
  lid.addColorStop(0.55, tones.lit);
  lid.addColorStop(1, mix(tones.lit, tones.base, 0.5));
  path(T, R, C, L);
  face(ctx, lid, soften);

  if (tones.gloss) {
    ctx.save();
    path(T, R, C, L);
    ctx.clip();
    glint(ctx, -half * 0.28, top + e * 0.42, e * 0.62, e * 0.3, -0.5, 0.42);
    ctx.restore();
  }
  // A thin bevel catching the light along the three near edges.
  ctx.lineCap = "round";
  ctx.lineWidth = s * 0.006;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  ctx.beginPath();
  ctx.moveTo(L[0], L[1]);
  ctx.lineTo(C[0], C[1]);
  ctx.lineTo(R[0], R[1]);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.beginPath();
  ctx.moveTo(C[0], C[1]);
  ctx.lineTo(C[0], C[1] + e);
  ctx.stroke();
}

function cylinder(ctx: Ctx, s: number, tones: Tones, shadow: boolean) {
  const rx = s * 0.3;
  const ry = rx * 0.3;
  const top = -s * 0.34;
  const bottom = s * 0.3;
  if (shadow) floorShadow(ctx, s * 0.04, bottom + ry * 0.4, rx * 1.15, tones);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-rx, top);
  ctx.lineTo(-rx, bottom);
  ctx.ellipse(0, bottom, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(rx, top);
  ctx.ellipse(0, top, rx, ry, 0, 0, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = across(ctx, -rx, rx, tones);
  ctx.fill();
  ctx.clip();
  // The shine goes on first, so the darkening toward the floor dims it too.
  if (tones.gloss) streak(ctx, -rx * 0.5, top, bottom + ry, rx * 0.2, tones.metal ? 0.7 : 0.5);
  // Darker toward the floor, where less light reaches.
  const ground = ctx.createLinearGradient(0, top, 0, bottom + ry);
  ground.addColorStop(0, "rgba(0, 0, 0, 0)");
  ground.addColorStop(0.7, "rgba(0, 0, 0, 0)");
  ground.addColorStop(1, alpha(tones.cast, 0.32));
  ctx.fillStyle = ground;
  ctx.fillRect(-rx, top, rx * 2, bottom + ry - top);
  if (tones.metal) horizon(ctx, top, bottom + ry, 0.6);
  ctx.restore();

  const lid = ctx.createLinearGradient(-rx, top - ry, rx, top + ry);
  lid.addColorStop(0, tones.peak);
  lid.addColorStop(0.6, tones.lit);
  lid.addColorStop(1, mix(tones.lit, tones.base, 0.6));
  ctx.beginPath();
  ctx.ellipse(0, top, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = lid;
  ctx.fill();
  ctx.lineWidth = s * 0.005;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
  ctx.stroke();
}

function capsule(ctx: Ctx, s: number, tones: Tones, shadow: boolean) {
  const a = s * 0.19;
  const top = -s * 0.46;
  const bottom = s * 0.36;
  if (shadow) floorShadow(ctx, s * 0.03, bottom - a * 0.04, a * 1.3, tones);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, top + a, a, Math.PI, 0);
  ctx.lineTo(a, bottom - a);
  ctx.arc(0, bottom - a, a, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = across(ctx, -a, a, tones);
  ctx.fill();
  ctx.clip();
  if (tones.gloss) streak(ctx, -a * 0.45, top + a * 0.7, bottom - a * 0.6, a * 0.26, tones.metal ? 0.7 : 0.5);
  // The domed ends: lit from above at the top, falling into shadow at the bottom.
  const ends = ctx.createLinearGradient(0, top, 0, bottom);
  ends.addColorStop(0, alpha(tones.peak, 0.5));
  ends.addColorStop(0.22, alpha(tones.peak, 0));
  ends.addColorStop(0.78, "rgba(0, 0, 0, 0)");
  ends.addColorStop(1, alpha(tones.cast, 0.42));
  ctx.fillStyle = ends;
  ctx.fillRect(-a, top, a * 2, bottom - top);
  if (tones.metal) horizon(ctx, top, bottom, 0.55);
  if (tones.gloss) glint(ctx, -a * 0.4, top + a * 0.55, a * 0.34, a * 0.24, -0.5, 0.8);
  ctx.restore();
}

function cone(ctx: Ctx, s: number, tones: Tones, shadow: boolean) {
  const rx = s * 0.34;
  const ry = rx * 0.3;
  const apex = -s * 0.46;
  const base = s * 0.3;
  if (shadow) floorShadow(ctx, s * 0.05, base + ry * 0.4, rx * 1.15, tones);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, apex);
  ctx.lineTo(-rx, base);
  ctx.ellipse(0, base, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = across(ctx, -rx, rx, tones);
  ctx.fill();
  ctx.clip();
  // The slope faces the light more near the tip, so it lifts toward the top.
  const slope = ctx.createLinearGradient(0, apex, 0, base + ry);
  slope.addColorStop(0, alpha(tones.peak, 0.28));
  slope.addColorStop(0.5, alpha(tones.peak, 0));
  slope.addColorStop(0.85, "rgba(0, 0, 0, 0)");
  slope.addColorStop(1, alpha(tones.cast, 0.3));
  ctx.fillStyle = slope;
  ctx.fillRect(-rx, apex, rx * 2, base + ry - apex);
  if (tones.gloss) {
    // A shine running from the tip down the lit side, widening as the cone does: wedges laid one inside another, each
    // faint, so the shine is brightest along its middle and fades out at its sides.
    ctx.fillStyle = `rgba(255, 255, 255, ${tones.metal ? 0.15 : 0.11})`;
    for (const spread of [0.22, 0.15, 0.09, 0.04]) {
      ctx.beginPath();
      ctx.moveTo(0, apex);
      ctx.lineTo(-rx * (0.42 + spread), base + ry * 0.75);
      ctx.lineTo(-rx * (0.42 - spread), base + ry * 0.9);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function torus(ctx: Ctx, s: number, tones: Tones, shadow: boolean) {
  const cy = -s * 0.02;
  const ox = s * 0.44;
  const oy = ox * 0.6;
  const hx = s * 0.17;
  const hy = hx * 0.42;
  const hcy = cy - s * 0.02;
  const tube = ox - hx;
  if (shadow) floorShadow(ctx, s * 0.04, cy + oy * 0.95, ox * 0.92, tones);
  const ring = () => {
    ctx.beginPath();
    ctx.ellipse(0, cy, ox, oy, 0, 0, Math.PI * 2);
    ctx.moveTo(hx, hcy);
    ctx.ellipse(0, hcy, hx, hy, 0, 0, Math.PI * 2);
  };
  const body = ctx.createRadialGradient(-ox * 0.45, cy - oy * 0.7, 0, -ox * 0.45, cy - oy * 0.7, ox * 1.9);
  body.addColorStop(0, tones.peak);
  body.addColorStop(0.18, tones.lit);
  body.addColorStop(0.45, tones.base);
  body.addColorStop(0.78, tones.shade);
  body.addColorStop(1, tones.deep);
  ctx.save();
  ring();
  ctx.fillStyle = body;
  ctx.fill("evenodd");
  ctx.clip("evenodd");

  // The tube rounds away at its outer edge.
  ctx.save();
  ctx.translate(0, cy);
  ctx.scale(1, oy / ox);
  const edge = ctx.createRadialGradient(0, 0, ox * 0.74, 0, 0, ox);
  edge.addColorStop(0, "rgba(0, 0, 0, 0)");
  edge.addColorStop(1, alpha(tones.cast, 0.42));
  ctx.fillStyle = edge;
  ctx.fillRect(-ox, -ox, ox * 2, ox * 2);
  ctx.restore();

  // The tube curves down into the hole all round, most deeply in shadow on the far side, just under the hole's top
  // edge; the shading's centre sits a little above the hole's for that.
  ctx.save();
  ctx.translate(0, hcy - hy * 0.15);
  ctx.scale(1, hy / hx);
  const hollow = ctx.createRadialGradient(0, 0, hx * 0.95, 0, 0, hx * 1.55);
  hollow.addColorStop(0, alpha(tones.cast, 0.5));
  hollow.addColorStop(1, alpha(tones.cast, 0));
  ctx.fillStyle = hollow;
  ctx.fillRect(-hx * 1.6, -hx * 1.6, hx * 3.2, hx * 3.2);
  ctx.restore();

  // Light along the top of the tube all the way round: a ring that rises and falls away softly on both sides, drawn
  // as a radial gradient squashed to the ring's tilt.
  const midX = (ox + hx) / 2;
  const midY = (oy + hy) / 2;
  ctx.save();
  ctx.translate(0, cy - tube * 0.14);
  ctx.scale(1, midY / midX);
  const band = ctx.createRadialGradient(0, 0, 0, 0, 0, ox);
  const at = (radius: number) => Math.min(1, Math.max(0, radius / ox));
  const peak = tones.gloss ? (tones.metal ? 0.42 : 0.3) : 0.16;
  band.addColorStop(at(midX - tube * 0.42), "rgba(255, 255, 255, 0)");
  band.addColorStop(at(midX - tube * 0.04), `rgba(255, 255, 255, ${peak})`);
  band.addColorStop(at(midX + tube * 0.32), "rgba(255, 255, 255, 0)");
  ctx.fillStyle = band;
  ctx.fillRect(-ox, -ox, ox * 2, ox * 2);
  ctx.restore();
  if (tones.gloss) glint(ctx, -ox * 0.52, cy - oy * 0.52, tube * 0.4, tube * 0.2, -0.45, 0.7);
  ctx.restore();
}

function pyramid(ctx: Ctx, s: number, tones: Tones, shadow: boolean) {
  const apex = [s * 0.02, -s * 0.46];
  const left = [-s * 0.43, s * 0.2];
  const front = [s * 0.09, s * 0.36];
  const right = [s * 0.43, s * 0.17];
  if (shadow) floorShadow(ctx, s * 0.07, s * 0.3, s * 0.5, tones);
  const soften = s * 0.01;
  const tri = (a: number[], b: number[], c: number[]) => {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.closePath();
  };
  const lit = ctx.createLinearGradient(apex[0], apex[1], (left[0] + front[0]) / 2, (left[1] + front[1]) / 2);
  lit.addColorStop(0, tones.peak);
  lit.addColorStop(0.45, tones.lit);
  lit.addColorStop(1, mix(tones.base, tones.lit, 0.3));
  tri(apex, left, front);
  face(ctx, lit, soften);

  const dark = ctx.createLinearGradient(apex[0], apex[1], (front[0] + right[0]) / 2, (front[1] + right[1]) / 2);
  dark.addColorStop(0, tones.shade);
  dark.addColorStop(0.85, tones.deep);
  dark.addColorStop(1, mix(tones.deep, tones.bounce, 0.16));
  tri(apex, front, right);
  face(ctx, dark, soften);

  if (tones.gloss) {
    ctx.save();
    tri(apex, left, front);
    ctx.clip();
    glint(ctx, -s * 0.08, -s * 0.12, s * 0.22, s * 0.1, -1.1, tones.metal ? 0.55 : 0.36);
    ctx.restore();
  }
  // The ridge nearest the viewer catches a line of light.
  ctx.lineCap = "round";
  ctx.lineWidth = s * 0.006;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.beginPath();
  ctx.moveTo(apex[0], apex[1]);
  ctx.lineTo(front[0], front[1]);
  ctx.stroke();
}

const FORMS: Record<Solid, Form> = { sphere, cube, cylinder, capsule, cone, torus, pyramid };

/** A new solid layer: square on the page, about a third of its shorter side, in the middle. */
export function solidLayer(solid: Solid, id: string, frameWidth: number, frameHeight: number): Layer {
  const side = Math.min(frameWidth, frameHeight) * 0.32;
  return {
    id,
    kind: "solid",
    solid,
    x: (frameWidth - side) / 2 / frameWidth,
    y: (frameHeight - side) / 2 / frameHeight,
    w: side / frameWidth,
    h: side / frameHeight,
    rotation: 0,
    opacity: 1,
  };
}
