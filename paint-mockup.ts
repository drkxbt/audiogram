/* Devices and objects a picture is shown in: a phone, a tablet, a laptop, a monitor, a television, a browser window, a
   polaroid and a record in its sleeve. Each is drawn in its box with the picture on its screen, cut to the screen's
   corners and toned like any picture; an empty screen shows the empty-frame drawing while the design is edited. */
import type { Device, Layer } from "./layers.js";
import type { PaintBox, PaintEnv } from "./paint-env.js";
import { paintPlaceholder } from "./paint-placeholder.js";
import { drawCover, FILTERS, filterOf, fontOf, inkOn, roundRect } from "./render.js";

type Ctx = CanvasRenderingContext2D;
type Fill = string | CanvasGradient;

function inset(box: PaintBox, by: number): PaintBox {
  return { x: box.x + by, y: box.y + by, width: Math.max(0, box.width - by * 2), height: Math.max(0, box.height - by * 2) };
}

/* Where each part of a device sits in its box. Bezels and frames are measured from the width, so they stay even
   all round when the box is stretched. */

function phoneParts(box: PaintBox) {
  const key = box.width * 0.012;
  const body = { x: box.x + key, y: box.y, width: Math.max(0, box.width - key * 2), height: box.height };
  const band = body.width * 0.022;
  const glass = inset(body, band);
  return { key, body, corner: Math.min(body.width * 0.17, body.height / 2), band, glass, screen: inset(glass, body.width * 0.032) };
}

function tabletParts(box: PaintBox) {
  const key = box.width * 0.008;
  const body = { x: box.x + key, y: box.y, width: Math.max(0, box.width - key * 2), height: box.height };
  const band = body.width * 0.012;
  const glass = inset(body, band);
  return { key, body, corner: Math.min(body.width * 0.08, body.height / 2), band, glass, screen: inset(glass, body.width * 0.045) };
}

function laptopParts(box: PaintBox) {
  const w = box.width;
  const deckHeight = Math.min(w * 0.035, box.height * 0.2);
  const deck = { x: box.x, y: box.y + box.height - deckHeight, width: w, height: deckHeight };
  const lid = { x: box.x + w * 0.08, y: box.y, width: w * 0.84, height: box.height - deckHeight };
  const rim = w * 0.006;
  const glass = inset(lid, rim);
  // A thin bezel at the sides and top, a deeper chin at the bottom.
  const screen = { x: glass.x + w * 0.016, y: glass.y + w * 0.022, width: Math.max(0, glass.width - w * 0.032), height: Math.max(0, glass.height - w * 0.052) };
  return { deck, lid, rim, glass, screen };
}

function monitorParts(box: PaintBox) {
  const w = box.width;
  const stand = Math.min(w * 0.188, box.height * 0.4);
  const display = { x: box.x, y: box.y, width: w, height: box.height - stand };
  const rim = w * 0.004;
  const bezel = w * 0.008;
  const screen = { x: box.x + rim + bezel, y: box.y + rim + bezel, width: Math.max(0, w - (rim + bezel) * 2), height: Math.max(0, display.height - rim - bezel - w * 0.045) };
  const glass = { x: box.x + rim, y: box.y + rim, width: Math.max(0, w - rim * 2), height: screen.height + bezel * 2 };
  return { display, stand, glass, screen };
}

function tvParts(box: PaintBox) {
  const w = box.width;
  const feet = Math.min(w * 0.045, box.height * 0.2);
  const display = { x: box.x, y: box.y, width: w, height: box.height - feet };
  const rim = w * 0.003;
  const bezel = w * 0.005;
  const screen = { x: box.x + rim + bezel, y: box.y + rim + bezel, width: Math.max(0, w - (rim + bezel) * 2), height: Math.max(0, display.height - rim - bezel - w * 0.014) };
  const glass = { x: box.x + rim, y: box.y + rim, width: Math.max(0, w - rim * 2), height: screen.height + bezel * 2 };
  return { display, feet, glass, screen };
}

function browserParts(box: PaintBox) {
  const bar = Math.min(box.width * 0.062, box.height * 0.2);
  return { bar, screen: { x: box.x, y: box.y + bar, width: box.width, height: Math.max(0, box.height - bar) } };
}

function polaroidParts(box: PaintBox) {
  const margin = box.width * 0.06;
  const side = Math.max(0, box.width - margin * 2);
  // A square picture, and below it the wide strip a caption goes on.
  return { margin, screen: { x: box.x + margin, y: box.y + margin, width: side, height: Math.max(0, Math.min(side, box.height - margin - box.height * 0.16)) } };
}

function vinylParts(box: PaintBox) {
  const sleeve = { x: box.x, y: box.y, width: box.width / 1.62, height: box.height };
  // The record is pulled out to the right far enough that its whole label shows.
  return { sleeve, cx: sleeve.x + sleeve.width * 1.16, cy: box.y + box.height / 2, rx: sleeve.width * 0.46, ry: box.height * 0.46, screen: sleeve };
}

export const DEVICES: Record<Device, { aspect: number /* width over height of the whole mockup */; screen(box: PaintBox): PaintBox; screenRadius: number /* share of the screen's shorter side */ }> = {
  phone: { aspect: 0.49, screen: (box) => phoneParts(box).screen, screenRadius: 0.13 },
  tablet: { aspect: 0.75, screen: (box) => tabletParts(box).screen, screenRadius: 0.024 },
  laptop: { aspect: 1.7, screen: (box) => laptopParts(box).screen, screenRadius: 0.012 },
  monitor: { aspect: 1.26, screen: (box) => monitorParts(box).screen, screenRadius: 0.006 },
  tv: { aspect: 1.62, screen: (box) => tvParts(box).screen, screenRadius: 0.003 },
  browser: { aspect: 1.6, screen: (box) => browserParts(box).screen, screenRadius: 0 },
  polaroid: { aspect: 0.84, screen: (box) => polaroidParts(box).screen, screenRadius: 0 },
  vinyl: { aspect: 1.62, screen: (box) => vinylParts(box).screen, screenRadius: 0.008 },
};

/** Where a device shows its picture, in a mockup's box. */
export function mockupScreen(device: Device, box: PaintBox): PaintBox {
  return (DEVICES[device] ?? DEVICES.phone).screen(box);
}

function cornerOf(device: Device, screen: PaintBox): number {
  return DEVICES[device].screenRadius * Math.min(screen.width, screen.height);
}

/** A soft shadow on the floor under something standing on it. */
function floor(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, strength: number) {
  if (!(rx > 0 && ry > 0)) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  shade.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
  shade.addColorStop(0.5, `rgba(0, 0, 0, ${strength * 0.4})`);
  shade.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = shade;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/**
 * A device's body: its colour, with a drop shadow under it when `lift` is given, light falling across it from the top
 * left, and a thin bright edge just inside its outline, which keeps a dark device visible on a dark page.
 */
function shell(ctx: Ctx, trace: () => void, fill: Fill, area: PaintBox, unit: number, lift = 0) {
  ctx.save();
  if (lift) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
    ctx.shadowBlur = lift;
    ctx.shadowOffsetY = lift * 0.4;
  }
  trace();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  ctx.save();
  trace();
  ctx.clip();
  const light = ctx.createLinearGradient(area.x, area.y, area.x + area.width, area.y + area.height);
  light.addColorStop(0, "rgba(255, 255, 255, 0.14)");
  light.addColorStop(0.4, "rgba(255, 255, 255, 0.03)");
  light.addColorStop(0.62, "rgba(0, 0, 0, 0)");
  light.addColorStop(1, "rgba(0, 0, 0, 0.2)");
  ctx.fillStyle = light;
  ctx.fillRect(area.x, area.y, area.width, area.height);
  const edge = ctx.createLinearGradient(0, area.y, 0, area.y + area.height);
  edge.addColorStop(0, "rgba(255, 255, 255, 0.36)");
  edge.addColorStop(0.5, "rgba(255, 255, 255, 0.12)");
  edge.addColorStop(1, "rgba(255, 255, 255, 0.22)");
  trace();
  ctx.strokeStyle = edge;
  // Twice the width, since only the half inside the clip shows.
  ctx.lineWidth = Math.max(1, unit) * 2;
  ctx.stroke();
  ctx.restore();
}

/** The layer's picture over `area`, toned as the layer says, or what stands in for it when there is none. Draws into
 *  the clip already set. */
function showPicture(ctx: Ctx, layer: Layer, area: PaintBox, env: PaintEnv, corner: number) {
  const image = env.image(layer.image);
  if (image) {
    // Keep any blur the layer's movement has already set, adding the picture's own tone after it.
    const before = typeof ctx.filter === "string" && ctx.filter !== "none" ? ctx.filter : "";
    const tone = [before, layer.filter ? FILTERS[layer.filter] ?? "" : "", layer.adjust ? filterOf(layer.adjust, env.unit) : ""].filter((part) => part && part !== "none").join(" ");
    if (tone) ctx.filter = tone;
    drawCover(ctx, image, area, layer.crop);
    if (tone) ctx.filter = before || "none";
  } else if (env.placeholders) paintPlaceholder(ctx, area, env.unit, env.placeholderText, "rect", corner);
  else {
    const dark = ctx.createLinearGradient(area.x, area.y, area.x + area.width, area.y + area.height);
    dark.addColorStop(0, "#1c1f26");
    dark.addColorStop(1, "#060709");
    ctx.fillStyle = dark;
    ctx.fillRect(area.x, area.y, area.width, area.height);
  }
}

/** Light caught on glass: brighter over the top left, ending in a soft diagonal edge. */
function glare(ctx: Ctx, area: PaintBox, strength: number) {
  const light = ctx.createLinearGradient(area.x, area.y, area.x + area.width, area.y + area.height);
  light.addColorStop(0, `rgba(255, 255, 255, ${0.13 * strength})`);
  light.addColorStop(0.42, `rgba(255, 255, 255, ${0.045 * strength})`);
  light.addColorStop(0.5, "rgba(255, 255, 255, 0)");
  light.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = light;
  ctx.fillRect(area.x, area.y, area.width, area.height);
}

/** A screen: black glass cut to its corners, the picture on it, and the glare over it. */
function paintScreen(ctx: Ctx, layer: Layer, screen: PaintBox, corner: number, env: PaintEnv, shine = 1) {
  if (!(screen.width > 0 && screen.height > 0)) return;
  ctx.save();
  roundRect(ctx, screen.x, screen.y, screen.width, screen.height, corner);
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.clip();
  showPicture(ctx, layer, screen, env, corner);
  if (shine) glare(ctx, screen, shine);
  ctx.restore();
}

/** A camera lens: dark glass with a faint blue glint. */
function lens(ctx: Ctx, x: number, y: number, r: number) {
  const glassy = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  glassy.addColorStop(0, "#2c3a55");
  glassy.addColorStop(0.6, "#0d1220");
  glassy.addColorStop(1, "#030407");
  ctx.fillStyle = glassy;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(150, 175, 255, 0.4)";
  ctx.beginPath();
  ctx.arc(x - r * 0.32, y - r * 0.32, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

/** Buttons standing out from a device's sides: each is a share of the height down, and a share of the height long. */
function keys(ctx: Ctx, fill: Fill, body: PaintBox, key: number, left: number[][], right: number[][]) {
  const one = (x: number, at: number, length: number) => {
    roundRect(ctx, x, body.y + body.height * at, key * 2.4, body.height * length, key);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.fill();
  };
  for (const [at, length] of left) one(body.x - key, at, length);
  for (const [at, length] of right) one(body.x + body.width - key * 1.4, at, length);
}

function phone(ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv) {
  const p = phoneParts(box);
  const fill = env.fill(layer.fill ?? "#111214", "text", p.body);
  keys(ctx, fill, p.body, p.key, [[0.17, 0.035], [0.245, 0.062], [0.325, 0.062]], [[0.27, 0.095]]);
  shell(ctx, () => roundRect(ctx, p.body.x, p.body.y, p.body.width, p.body.height, p.corner), fill, p.body, env.unit, Math.min(p.body.width, p.body.height) * 0.08);
  roundRect(ctx, p.glass.x, p.glass.y, p.glass.width, p.glass.height, p.corner - p.band);
  ctx.fillStyle = "#050506";
  ctx.fill();
  paintScreen(ctx, layer, p.screen, cornerOf("phone", p.screen), env);
  // The camera's pill at the top of the screen, over the picture.
  const width = p.screen.width * 0.3;
  const height = p.screen.width * 0.088;
  const x = p.screen.x + (p.screen.width - width) / 2;
  const y = p.screen.y + p.screen.width * 0.032;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = "#000000";
  ctx.fill();
  lens(ctx, x + width - height * 0.56, y + height / 2, height * 0.24);
}

function tablet(ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv) {
  const p = tabletParts(box);
  const fill = env.fill(layer.fill ?? "#1b1c1f", "text", p.body);
  keys(ctx, fill, p.body, p.key, [], [[0.1, 0.05], [0.17, 0.05]]);
  shell(ctx, () => roundRect(ctx, p.body.x, p.body.y, p.body.width, p.body.height, p.corner), fill, p.body, env.unit, Math.min(p.body.width, p.body.height) * 0.06);
  roundRect(ctx, p.glass.x, p.glass.y, p.glass.width, p.glass.height, p.corner - p.band);
  ctx.fillStyle = "#050506";
  ctx.fill();
  paintScreen(ctx, layer, p.screen, cornerOf("tablet", p.screen), env);
  lens(ctx, p.screen.x + p.screen.width / 2, (p.glass.y + p.screen.y) / 2, (p.screen.y - p.glass.y) * 0.14);
}

function laptop(ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv) {
  const p = laptopParts(box);
  const w = box.width;
  const corner = w * 0.018;
  floor(ctx, box.x + w / 2, p.deck.y + p.deck.height, w * 0.54, p.deck.height * 0.9, 0.4);
  // A colour of its own paints the whole machine; left alone it is a dark lid on a silver base.
  const lid = env.fill(layer.fill ?? "#2a2b2f", "text", p.lid);
  shell(ctx, () => roundRect(ctx, p.lid.x, p.lid.y, p.lid.width, p.lid.height + corner, corner), lid, p.lid, env.unit);
  roundRect(ctx, p.glass.x, p.glass.y, p.glass.width, p.glass.height, corner - p.rim);
  ctx.fillStyle = "#08090a";
  ctx.fill();
  paintScreen(ctx, layer, p.screen, cornerOf("laptop", p.screen), env);
  // The notch the camera sits in, cut into the top of the screen.
  const notchWidth = w * 0.07;
  const notchHeight = w * 0.014;
  const nx = p.screen.x + (p.screen.width - notchWidth) / 2;
  ctx.beginPath();
  ctx.moveTo(nx, p.screen.y - 1);
  ctx.lineTo(nx + notchWidth, p.screen.y - 1);
  ctx.arcTo(nx + notchWidth, p.screen.y + notchHeight, nx, p.screen.y + notchHeight, notchHeight * 0.45);
  ctx.arcTo(nx, p.screen.y + notchHeight, nx, p.screen.y, notchHeight * 0.45);
  ctx.closePath();
  ctx.fillStyle = "#08090a";
  ctx.fill();
  lens(ctx, nx + notchWidth / 2, p.screen.y + notchHeight * 0.45, notchHeight * 0.24);

  const d = p.deck;
  const deck = () => {
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + d.width, d.y);
    ctx.quadraticCurveTo(d.x + d.width, d.y + d.height * 0.72, d.x + d.width - d.height * 1.3, d.y + d.height);
    ctx.lineTo(d.x + d.height * 1.3, d.y + d.height);
    ctx.quadraticCurveTo(d.x, d.y + d.height * 0.72, d.x, d.y);
    ctx.closePath();
  };
  deck();
  ctx.fillStyle = env.fill(layer.fill ?? "#c9ccd1", "text", d);
  ctx.fill();
  // The top face catches the light; the front falls away under it.
  const face = ctx.createLinearGradient(0, d.y, 0, d.y + d.height);
  face.addColorStop(0, "rgba(255, 255, 255, 0.5)");
  face.addColorStop(0.28, "rgba(255, 255, 255, 0.16)");
  face.addColorStop(0.34, "rgba(0, 0, 0, 0.04)");
  face.addColorStop(1, "rgba(0, 0, 0, 0.3)");
  ctx.fillStyle = face;
  ctx.fill();
  // The scoop at the front edge that a thumb lifts the lid by.
  ctx.save();
  deck();
  ctx.clip();
  const scoop = ctx.createLinearGradient(0, d.y, 0, d.y + d.height * 0.45);
  scoop.addColorStop(0, "rgba(0, 0, 0, 0.34)");
  scoop.addColorStop(1, "rgba(0, 0, 0, 0.08)");
  ctx.fillStyle = scoop;
  ctx.beginPath();
  ctx.ellipse(d.x + d.width / 2, d.y, d.width * 0.075, d.height * 0.45, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = Math.max(1, env.unit);
  ctx.beginPath();
  ctx.moveTo(d.x + d.height * 0.2, d.y + ctx.lineWidth / 2);
  ctx.lineTo(d.x + d.width - d.height * 0.2, d.y + ctx.lineWidth / 2);
  ctx.stroke();
}

function monitor(ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv) {
  const p = monitorParts(box);
  const w = box.width;
  const cx = box.x + w / 2;
  const paint = layer.fill ?? "#1c1d20";
  const bottom = box.y + box.height;
  const footY = bottom - w * 0.022;
  const footRx = w * 0.19;
  const footRy = Math.min(w * 0.022, p.stand * 0.2);
  floor(ctx, cx, bottom - footRy * 0.2, footRx * 1.25, footRy * 1.6, 0.42);

  // The neck, darker where it disappears behind the screen.
  const neck = { x: cx - w * 0.05, y: p.display.y + p.display.height - w * 0.04, width: w * 0.1, height: footY - (p.display.y + p.display.height - w * 0.04) };
  ctx.fillStyle = env.fill(paint, "text", neck);
  ctx.fillRect(neck.x, neck.y, neck.width, neck.height);
  const round = ctx.createLinearGradient(neck.x, 0, neck.x + neck.width, 0);
  round.addColorStop(0, "rgba(255, 255, 255, 0.16)");
  round.addColorStop(0.35, "rgba(255, 255, 255, 0.05)");
  round.addColorStop(1, "rgba(0, 0, 0, 0.28)");
  ctx.fillStyle = round;
  ctx.fillRect(neck.x, neck.y, neck.width, neck.height);
  const under = ctx.createLinearGradient(0, neck.y, 0, neck.y + neck.height);
  under.addColorStop(0, "rgba(0, 0, 0, 0.55)");
  under.addColorStop(0.45, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = under;
  ctx.fillRect(neck.x, neck.y, neck.width, neck.height);

  // The foot, a flat plate seen a little from above.
  const foot = { x: cx - footRx, y: footY - footRy, width: footRx * 2, height: footRy * 2 };
  ctx.beginPath();
  ctx.ellipse(cx, footY, footRx, footRy, 0, 0, Math.PI * 2);
  ctx.fillStyle = env.fill(paint, "text", foot);
  ctx.fill();
  const plate = ctx.createLinearGradient(0, foot.y, 0, foot.y + foot.height);
  plate.addColorStop(0, "rgba(255, 255, 255, 0.22)");
  plate.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
  plate.addColorStop(1, "rgba(0, 0, 0, 0.3)");
  ctx.fillStyle = plate;
  ctx.fill();

  const corner = w * 0.01;
  shell(ctx, () => roundRect(ctx, p.display.x, p.display.y, p.display.width, p.display.height, corner), env.fill(paint, "text", p.display), p.display, env.unit);
  roundRect(ctx, p.glass.x, p.glass.y, p.glass.width, p.glass.height, Math.max(0, corner - w * 0.004));
  ctx.fillStyle = "#050506";
  ctx.fill();
  paintScreen(ctx, layer, p.screen, cornerOf("monitor", p.screen), env);
  // A small light on the chin, the only mark on the front.
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.arc(cx, (p.glass.y + p.glass.height + p.display.y + p.display.height) / 2, Math.max(1, w * 0.0025), 0, Math.PI * 2);
  ctx.fill();
}

function tv(ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv) {
  const p = tvParts(box);
  const w = box.width;
  const bottom = box.y + box.height;
  const paint = layer.fill ?? "#141517";
  const top = p.display.y + p.display.height - w * 0.004;
  floor(ctx, box.x + w / 2, bottom, w * 0.5, p.feet * 0.5, 0.36);
  // Slim blade feet near each end, leaning out.
  for (const side of [-1, 1]) {
    const inner = box.x + w / 2 + side * w * 0.355;
    const outer = box.x + w / 2 + side * w * 0.395;
    const area = { x: Math.min(inner, outer) - w * 0.02, y: top, width: w * 0.08, height: bottom - top };
    ctx.beginPath();
    ctx.moveTo(inner, top);
    ctx.lineTo(inner + side * w * 0.016, top);
    ctx.lineTo(outer + side * w * 0.012, bottom);
    ctx.lineTo(outer - side * w * 0.012, bottom);
    ctx.closePath();
    ctx.fillStyle = env.fill(paint, "text", area);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fill();
  }
  const corner = w * 0.006;
  shell(ctx, () => roundRect(ctx, p.display.x, p.display.y, p.display.width, p.display.height, corner), env.fill(paint, "text", p.display), p.display, env.unit);
  roundRect(ctx, p.glass.x, p.glass.y, p.glass.width, p.glass.height, Math.max(0, corner - w * 0.003));
  ctx.fillStyle = "#040405";
  ctx.fill();
  paintScreen(ctx, layer, p.screen, cornerOf("tv", p.screen), env);
  ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
  ctx.beginPath();
  ctx.arc(box.x + w / 2, (p.glass.y + p.glass.height + p.display.y + p.display.height) / 2, Math.max(1, w * 0.0018), 0, Math.PI * 2);
  ctx.fill();
}

function browser(ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv) {
  const p = browserParts(box);
  const corner = Math.min(box.width * 0.016, box.height * 0.08);
  const frame = () => roundRect(ctx, box.x, box.y, box.width, box.height, corner);
  const paint = layer.fill ?? "#f4f4f6";
  const light = inkOn(env.flat(paint, "text")) === "#111111";
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = Math.min(box.width, box.height) * 0.07;
  ctx.shadowOffsetY = ctx.shadowBlur * 0.3;
  frame();
  ctx.fillStyle = env.fill(paint, "text", box);
  ctx.fill();
  ctx.restore();

  ctx.save();
  frame();
  ctx.clip();
  const bar = ctx.createLinearGradient(0, box.y, 0, box.y + p.bar);
  bar.addColorStop(0, light ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.08)");
  bar.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = bar;
  ctx.fillRect(box.x, box.y, box.width, p.bar);
  paintScreen(ctx, layer, p.screen, 0, env, 0);
  ctx.fillStyle = light ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.1)";
  ctx.fillRect(box.x, p.screen.y - Math.max(1, env.unit) / 2, box.width, Math.max(1, env.unit));
  ctx.restore();

  const cy = box.y + p.bar / 2;
  const dot = p.bar * 0.12;
  ["#ff5f57", "#febc2e", "#28c840"].forEach((color, index) => {
    ctx.beginPath();
    ctx.arc(box.x + p.bar * 0.6 + index * dot * 3.3, cy, dot, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
    ctx.lineWidth = Math.max(0.5, env.unit * 0.75);
    ctx.stroke();
  });
  // The address field: a padlock and a faint line where the address would be.
  const pillHeight = p.bar * 0.52;
  const pillWidth = Math.min(box.width * 0.46, box.width - p.bar * 4);
  const px = box.x + (box.width - pillWidth) / 2;
  const py = cy - pillHeight / 2;
  roundRect(ctx, px, py, pillWidth, pillHeight, pillHeight * 0.32);
  ctx.fillStyle = light ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.1)";
  ctx.fill();
  const mark = light ? "rgba(0, 0, 0, 0.34)" : "rgba(255, 255, 255, 0.46)";
  const lockX = px + pillHeight * 0.62;
  const lockSize = pillHeight * 0.3;
  ctx.fillStyle = mark;
  roundRect(ctx, lockX - lockSize / 2, cy - lockSize * 0.15, lockSize, lockSize * 0.8, lockSize * 0.15);
  ctx.fill();
  ctx.strokeStyle = mark;
  ctx.lineWidth = Math.max(0.75, lockSize * 0.16);
  ctx.beginPath();
  ctx.arc(lockX, cy - lockSize * 0.15, lockSize * 0.3, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, lockX + lockSize, cy - pillHeight * 0.07, pillWidth * 0.36, pillHeight * 0.14, pillHeight * 0.07);
  ctx.fillStyle = light ? "rgba(0, 0, 0, 0.13)" : "rgba(255, 255, 255, 0.18)";
  ctx.fill();

  frame();
  ctx.strokeStyle = light ? "rgba(0, 0, 0, 0.14)" : "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = Math.max(1, env.unit);
  ctx.stroke();
}

function polaroid(ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv) {
  const p = polaroidParts(box);
  const paint = layer.fill ?? "#fbfaf7";
  const card = () => roundRect(ctx, box.x, box.y, box.width, box.height, box.width * 0.008);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = box.width * 0.06;
  ctx.shadowOffsetY = box.width * 0.022;
  card();
  ctx.fillStyle = env.fill(paint, "text", box);
  ctx.fill();
  ctx.restore();
  // Card stock: a touch brighter where the light falls, a touch greyer away from it.
  const paper = ctx.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
  paper.addColorStop(0, "rgba(255, 255, 255, 0.5)");
  paper.addColorStop(1, "rgba(0, 0, 0, 0.05)");
  card();
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
  ctx.lineWidth = Math.max(1, env.unit);
  ctx.stroke();

  paintScreen(ctx, layer, p.screen, 0, env, 0.5);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.16)";
  ctx.lineWidth = Math.max(1, env.unit);
  ctx.strokeRect(p.screen.x + ctx.lineWidth / 2, p.screen.y + ctx.lineWidth / 2, p.screen.width - ctx.lineWidth, p.screen.height - ctx.lineWidth);

  const caption = layer.text?.trim();
  if (!caption) return;
  const strip = box.y + box.height - (p.screen.y + p.screen.height);
  const size = layer.size ?? (strip * 0.3) / Math.max(env.unit, 1e-6);
  ctx.font = fontOf({ ...layer, size }, env.family, env.unit, 500);
  ctx.fillStyle = layer.color ? env.flat(layer.color, "text") : inkOn(env.flat(paint, "text")) === "#111111" ? "#34322d" : "#f4f2ec";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(caption, box.x + box.width / 2, p.screen.y + p.screen.height + strip / 2, box.width - p.margin * 2);
}

function vinyl(ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv) {
  const p = vinylParts(box);
  const { cx, cy, rx, ry } = p;
  const hole = Math.min(rx, ry) * 0.03;
  const disc = { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 };
  const ring = (scale: number) => ctx.ellipse(cx, cy, rx * scale, ry * scale, 0, 0, Math.PI * 2);
  const withHole = (scale: number) => {
    ctx.beginPath();
    ring(scale);
    ctx.moveTo(cx + hole, cy);
    ctx.arc(cx, cy, hole, 0, Math.PI * 2);
  };

  ctx.save();
  withHole(1);
  ctx.fillStyle = env.fill(layer.fill ?? "#0e0e10", "text", disc);
  ctx.fill("evenodd");
  ctx.clip("evenodd");
  const depth = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.3, cx, cy, Math.max(rx, ry));
  depth.addColorStop(0, "rgba(255, 255, 255, 0.04)");
  depth.addColorStop(1, "rgba(0, 0, 0, 0.3)");
  ctx.fillStyle = depth;
  ctx.fillRect(disc.x, disc.y, disc.width, disc.height);
  // Grooves, with three wider gaps between the tracks.
  ctx.lineWidth = Math.max(0.6, Math.min(rx, ry) * 0.004);
  for (let i = 0; i < 16; i++) {
    ctx.strokeStyle = i % 2 ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ring(0.4 + (i * 0.56) / 15);
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(1, Math.min(rx, ry) * 0.009);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  for (const gap of [0.58, 0.72, 0.85]) {
    ctx.beginPath();
    ring(gap);
    ctx.stroke();
  }
  // Light lies across the grooves in two opposite fans, the way it does on a real record; each fan is four layered
  // wedges, wide to narrow, so its sides fade instead of ending in a line.
  const sheen = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  sheen.addColorStop(0.36, "rgba(255, 255, 255, 0)");
  sheen.addColorStop(0.7, "rgba(255, 255, 255, 0.035)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0.01)");
  ctx.fillStyle = sheen;
  for (const at of [-Math.PI / 4, (Math.PI * 3) / 4]) {
    for (const spread of [0.46, 0.32, 0.2, 0.09]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.ellipse(cx, cy, rx, ry, 0, at - spread, at + spread);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = Math.max(1, env.unit);
  ctx.beginPath();
  ring(1);
  ctx.stroke();

  // The label: the picture again, or plain paper while there is none.
  const label = 0.34;
  const labelBox = { x: cx - rx * label, y: cy - ry * label, width: rx * label * 2, height: ry * label * 2 };
  ctx.save();
  withHole(label);
  ctx.clip("evenodd");
  const image = env.image(layer.image);
  if (image) showPicture(ctx, layer, labelBox, env, 0);
  else {
    ctx.fillStyle = "#efe6d2";
    ctx.fillRect(labelBox.x, labelBox.y, labelBox.width, labelBox.height);
  }
  const press = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) * label);
  press.addColorStop(0, "rgba(0, 0, 0, 0.12)");
  press.addColorStop(0.3, "rgba(0, 0, 0, 0)");
  press.addColorStop(0.86, "rgba(0, 0, 0, 0)");
  press.addColorStop(1, "rgba(0, 0, 0, 0.28)");
  ctx.fillStyle = press;
  ctx.fillRect(labelBox.x, labelBox.y, labelBox.width, labelBox.height);
  ctx.restore();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = Math.max(1, env.unit);
  ctx.beginPath();
  ctx.arc(cx, cy, hole, 0, Math.PI * 2);
  ctx.stroke();

  // The sleeve over the record, throwing a soft shadow onto it.
  const s = p.sleeve;
  const corner = DEVICES.vinyl.screenRadius * Math.min(s.width, s.height);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = s.width * 0.07;
  ctx.shadowOffsetX = s.width * 0.02;
  ctx.shadowOffsetY = s.width * 0.012;
  roundRect(ctx, s.x, s.y, s.width, s.height, corner);
  ctx.fillStyle = "#151518";
  ctx.fill();
  ctx.restore();
  paintScreen(ctx, layer, s, corner, env, 0.45);
  ctx.save();
  roundRect(ctx, s.x, s.y, s.width, s.height, corner);
  ctx.clip();
  // The opening along the right edge, where the record slides out.
  const opening = ctx.createLinearGradient(s.x + s.width, 0, s.x + s.width * 0.96, 0);
  opening.addColorStop(0, "rgba(0, 0, 0, 0.3)");
  opening.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = opening;
  ctx.fillRect(s.x + s.width * 0.96, s.y, s.width * 0.04, s.height);
  roundRect(ctx, s.x, s.y, s.width, s.height, corner);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = Math.max(1, env.unit) * 2;
  ctx.stroke();
  ctx.restore();
}

const PAINTERS: Record<Device, (ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv) => void> = { phone, tablet, laptop, monitor, tv, browser, polaroid, vinyl };

/** Draws a mockup layer's device in its box, with the layer's picture on its screen. */
export function paintMockup(ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv): void {
  if (!(box.width > 0 && box.height > 0)) return;
  ctx.save();
  (PAINTERS[layer.device ?? "phone"] ?? phone)(ctx, layer, box, env);
  ctx.restore();
}

/**
 * A new mockup layer for a device, in the middle of a page `frameWidth` by `frameHeight`: shaped to the device and
 * taking as much room as a square 0.45 of the page's shorter side, so a tall phone and a wide laptop look equally
 * weighty, while never reaching past nine tenths of the page either way.
 */
export function mockupLayer(device: Device, id: string, frameWidth: number, frameHeight: number): Layer {
  const { aspect } = DEVICES[device] ?? DEVICES.phone;
  const side = Math.min(frameWidth, frameHeight) * 0.45;
  let width = side * Math.sqrt(aspect);
  let height = side / Math.sqrt(aspect);
  const fit = Math.min(1, (frameWidth * 0.9) / width, (frameHeight * 0.9) / height);
  width *= fit;
  height *= fit;
  return {
    id,
    kind: "mockup",
    device,
    x: (frameWidth - width) / 2 / frameWidth,
    y: (frameHeight - height) / 2 / frameHeight,
    w: width / frameWidth,
    h: height / frameHeight,
    rotation: 0,
    opacity: 1,
  };
}
