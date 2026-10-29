/* Moving backgrounds, drawn from the clip's time alone so the preview and the export show the same frame at the same
   moment: soft northern lights, a slowly turning gradient, bokeh, rising specks, ribbons of light, rays from above, a
   floor grid running toward the viewer, and film grain. Whatever is scattered is scattered from a seed made of the
   layer's id, so it lands in the same places on every frame and in every export. */
import type { Ambient, Layer } from "./layers.js";
import type { PaintBox, PaintEnv } from "./paint-env.js";

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;

/** What one frame of a moving background is drawn from. */
interface Frame {
  ctx: Ctx;
  box: PaintBox;
  /** Seconds into the clip, times the layer's pace. */
  t: number;
  /** How much the lights swell with the voice: 1 when the layer doesn't follow it. */
  swell: number;
  ground: string;
  light: string;
  glow: string;
  /** Whether the ground is dark, when lights add up; on a light ground they are laid over it instead. */
  dark: boolean;
  /** Laid over the design as an effect: only the lights are drawn, with no ground and no shading across the box. */
  overlay: boolean;
  seed: number;
  unit: number;
  /** The layer's fade as the painter set it, which every alpha here is a share of. */
  alpha: number;
}

/** A seed from a layer's id: FNV-1a over its characters. */
function seedOf(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A small seeded source of numbers from 0 to 1 (mulberry32). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value wrapped into 0 up to `span`, for things that leave one edge and come back at the other. */
const wrap = (value: number, span: number) => ((value % span) + span) % span;

/** The red, green and blue of a colour as #rgb, #rrggbb, #rrggbbaa or rgb()/rgba(), or null for anything else. */
function channels(color: string): [number, number, number] | null {
  const text = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1].slice(0, 6);
    const value = parseInt(digits, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/** A colour at an alpha; one that can't be read lights up as white. */
function tint(color: string, alpha: number): string {
  const [r, g, b] = channels(color) ?? [255, 255, 255];
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 1000})`;
}

/** A colour moved `amount` of the way toward another; one that can't be read is kept as it is. */
function mix(color: string, toward: string, amount: number): string {
  const from = channels(color);
  const to = channels(toward);
  if (!from || !to) return color;
  return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount)).join(", ")})`;
}

function isDark(color: string): boolean {
  const rgb = channels(color);
  if (!rgb) return true;
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.35;
}

/** Lights add up on a dark ground, the way light does; on a light one adding would wash out to white, so they are laid
 *  over it. */
function lights(frame: Frame) {
  frame.ctx.globalCompositeOperation = frame.dark ? "lighter" : "source-over";
}

/** Darker toward the corners, which gives a flat ground some depth. */
function vignette(frame: Frame, strength: number) {
  // Over a design, darkened corners would shade the words and pictures under the effect.
  if (frame.overlay) return;
  const { ctx, box } = frame;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const reach = Math.hypot(box.width, box.height) / 2;
  const shade = ctx.createRadialGradient(cx, cy, reach * 0.42, cx, cy, reach * 1.04);
  shade.addColorStop(0, "rgba(0, 0, 0, 0)");
  shade.addColorStop(1, `rgba(0, 0, 0, ${frame.dark ? strength : strength * 0.3})`);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = shade;
  ctx.fillRect(box.x, box.y, box.width, box.height);
}

/** A soft round light fading out to nothing at `radius`. */
function bloom(frame: Frame, x: number, y: number, radius: number, color: string, alpha: number) {
  const { ctx } = frame;
  const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
  light.addColorStop(0, tint(color, alpha));
  light.addColorStop(0.45, tint(color, alpha * 0.42));
  light.addColorStop(1, tint(color, 0));
  ctx.fillStyle = light;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function aurora(frame: Frame) {
  const { ctx, box, t, swell } = frame;
  const rand = random(frame.seed);
  const span = Math.max(box.width, box.height);
  lights(frame);
  for (let i = 0; i < 4; i++) {
    const homeX = 0.22 + rand() * 0.56;
    const homeY = 0.2 + rand() * 0.6;
    const reachX = 0.16 + rand() * 0.14;
    const reachY = 0.12 + rand() * 0.14;
    // Ten to thirty seconds a sweep: slow enough to feel like weather, not motion.
    const rateX = 1 / (17 + rand() * 13);
    const rateY = 1 / (21 + rand() * 15);
    const phaseX = rand() * TAU;
    const phaseY = rand() * TAU;
    const size = 0.36 + rand() * 0.22;
    const lean = rand() * TAU;
    const color = i === 2 ? frame.glow : frame.light;
    const x = box.x + box.width * (homeX + reachX * Math.sin(TAU * rateX * t + phaseX));
    const y = box.y + box.height * (homeY + reachY * Math.sin(TAU * rateY * t + phaseY));
    const radius = span * size * swell;
    const strength = (color === frame.glow ? 0.13 : 0.32) * (frame.dark ? 1 : 0.7) * swell;
    // Each light is stretched and slowly turned, so they read as drifting curtains rather than spots.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean + 0.35 * Math.sin(TAU * rateX * 0.6 * t + phaseY));
    ctx.scale(1.7, 0.62);
    bloom(frame, 0, 0, radius, color, strength);
    ctx.restore();
  }
  vignette(frame, 0.34);
}

function flow(frame: Frame) {
  const { ctx, box, t, swell } = frame;
  const rand = random(frame.seed);
  const start = rand() * TAU;
  const rateX = 1 / (19 + rand() * 9);
  const rateY = 1 / (23 + rand() * 9);
  const phase = rand() * TAU;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const reach = Math.hypot(box.width, box.height) / 2;
  // One turn a minute: the colours seem to drift rather than spin.
  const angle = start + (TAU * t) / 60;
  const dx = Math.cos(angle) * reach;
  const dy = Math.sin(angle) * reach;
  const sweep = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  const middle = 0.5 + 0.12 * Math.sin((TAU * t) / 17 + phase);
  sweep.addColorStop(0, mix(frame.ground, frame.light, 0.42));
  sweep.addColorStop(middle, frame.ground);
  sweep.addColorStop(1, mix(frame.ground, frame.glow, 0.16));
  // The sweep is a ground of its own; over a design only the wandering light is drawn.
  if (!frame.overlay) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = sweep;
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }
  lights(frame);
  const x = box.x + box.width * (0.5 + 0.3 * Math.sin(TAU * rateX * t + phase));
  const y = box.y + box.height * (0.5 + 0.28 * Math.sin(TAU * rateY * t));
  bloom(frame, x, y, Math.max(box.width, box.height) * 0.5 * swell, frame.light, 0.26 * swell);
  vignette(frame, 0.3);
}

function bokeh(frame: Frame) {
  const { ctx, box, t, swell } = frame;
  const rand = random(frame.seed);
  const short = Math.min(box.width, box.height);
  lights(frame);
  for (let i = 0; i < 28; i++) {
    const depth = rand();
    const x0 = rand();
    const y0 = rand();
    const swayRate = 1 / (8 + rand() * 9);
    const swayPhase = rand() * TAU;
    const pulseRate = 1 / (4 + rand() * 6);
    const pulsePhase = rand() * TAU;
    const pale = rand() < 0.28;
    // Near discs are bigger, softer and drift faster, which gives the field its depth.
    const radius = short * (0.02 + depth * depth * 0.075) * swell;
    const rise = box.height * (0.012 + depth * 0.028);
    const travel = box.height + radius * 2;
    const x = box.x + box.width * x0 + Math.sin(TAU * swayRate * t + swayPhase) * short * 0.03;
    const y = box.y + box.height + radius - wrap(y0 * travel + t * rise, travel);
    const pulse = 0.78 + 0.22 * Math.sin(TAU * pulseRate * t + pulsePhase);
    const strength = Math.min(1, (0.13 + (1 - depth) * 0.2) * pulse * swell * (frame.dark ? 1 : 0.8));
    const color = pale ? frame.glow : frame.light;
    const disc = ctx.createRadialGradient(x, y, 0, x, y, radius);
    // A lens disc is a little brighter at its rim; the nearest ones are too far out of focus to show it.
    const rim = depth > 0.72 ? 0.62 : 1;
    disc.addColorStop(0, tint(color, strength * 0.55));
    disc.addColorStop(0.72, tint(color, strength * (0.55 + 0.2 * rim)));
    disc.addColorStop(0.9, tint(color, strength * (0.55 + 0.4 * rim)));
    disc.addColorStop(1, tint(color, 0));
    ctx.fillStyle = disc;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  vignette(frame, 0.3);
}

function particles(frame: Frame) {
  const { ctx, box, t, swell } = frame;
  const rand = random(frame.seed);
  const short = Math.min(box.width, box.height);
  // The specks are gathered by colour and brightness, so eighty of them take eight fills instead of eighty.
  const levels = [0.3, 0.5, 0.72, 0.95];
  const groups = levels.flatMap((level) => [frame.light, frame.glow].map((color) => ({ color, level, specks: [] as number[] })));
  for (let i = 0; i < 80; i++) {
    const size = short * (0.0016 + rand() ** 2 * 0.0052);
    const x0 = rand();
    const y0 = rand();
    const speed = box.height * (0.012 + rand() * 0.03);
    const swayRate = 1 / (6 + rand() * 8);
    const sway = rand();
    const phase = rand() * TAU;
    const twinkleRate = 1 / (1.4 + rand() * 2.6);
    const level = Math.floor(rand() * levels.length);
    const tone = rand() < 0.62 ? 0 : 1;
    const travel = box.height + size * 8;
    const x = box.x + box.width * x0 + Math.sin(TAU * swayRate * t + phase) * short * 0.025 * sway;
    const y = box.y + box.height + size * 4 - wrap(y0 * travel + t * speed, travel);
    const twinkle = 0.5 + 0.5 * Math.sin(TAU * twinkleRate * t + phase * 2);
    groups[level * 2 + tone].specks.push(x, y, size * (0.55 + 0.65 * twinkle) * swell);
  }
  lights(frame);
  for (const { color, level, specks } of groups) {
    if (!specks.length) continue;
    ctx.fillStyle = tint(color, Math.min(1, level * swell));
    ctx.beginPath();
    for (let i = 0; i < specks.length; i += 3) {
      ctx.moveTo(specks[i] + specks[i + 2], specks[i + 1]);
      ctx.arc(specks[i], specks[i + 1], specks[i + 2], 0, TAU);
    }
    ctx.fill();
  }
  // The two brightest kinds of speck glow a little round themselves.
  for (const { color, level, specks } of groups) {
    if (level < levels[levels.length - 2] || !specks.length) continue;
    ctx.fillStyle = tint(color, 0.09 * level * swell);
    ctx.beginPath();
    for (let i = 0; i < specks.length; i += 3) {
      ctx.moveTo(specks[i] + specks[i + 2] * 3.4, specks[i + 1]);
      ctx.arc(specks[i], specks[i + 1], specks[i + 2] * 3.4, 0, TAU);
    }
    ctx.fill();
  }
  vignette(frame, 0.3);
}

function waves(frame: Frame) {
  const { ctx, box, t, swell } = frame;
  const rand = random(frame.seed);
  const steps = 12;
  const left = box.x - box.width * 0.1;
  const run = box.width * 1.2;
  lights(frame);
  for (let i = 0; i < 4; i++) {
    const level = 0.46 + i * 0.085 + (rand() - 0.5) * 0.04;
    // Under one wave and a bit across the page, and shallow: long silk folds rather than peaks.
    const height = Math.min(box.height, box.width * 1.4) * (0.03 + rand() * 0.03) * swell;
    const waveNumber = ((0.5 + rand() * 0.6) * TAU) / box.width;
    const speed = (TAU / (11 + rand() * 9)) * (i % 2 ? -1 : 1);
    const phase = rand() * TAU;
    const thickness = Math.min(box.height, box.width * 1.4) * (0.05 + rand() * 0.06);
    const color = i === 1 ? frame.glow : frame.light;
    const strength = (i === 1 ? 0.12 : 0.2) * (frame.dark ? 1 : 0.75) * swell;
    const centre = box.y + box.height * level;
    const edge = (x: number, side: number) => {
      const u = x - box.x;
      const swing = height * Math.sin(waveNumber * u + speed * t + phase) + height * 0.25 * Math.sin(waveNumber * 1.7 * u - speed * 1.3 * t + phase * 1.3);
      // The ribbon pinches and swells along its length, the way silk turns in the light.
      const half = (thickness / 2) * (0.2 + 0.8 * (0.5 + 0.5 * Math.sin(waveNumber * 1.3 * u + speed * 0.6 * t + phase * 0.7)));
      return centre + swing + side * half;
    };
    const along = (side: number, reverse: boolean) => {
      for (let k = 0; k <= steps; k++) {
        const j = reverse ? steps - k : k;
        const x = left + (run * j) / steps;
        const y = edge(x, side);
        if (k === 0) {
          if (reverse) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        } else {
          // Through the midpoints, with each sample as the control point, for a smooth curve from few points.
          const px = left + (run * (reverse ? j + 1 : j - 1)) / steps;
          const py = edge(px, side);
          ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
          if (k === steps) ctx.lineTo(x, y);
        }
      }
    };
    const shade = ctx.createLinearGradient(box.x, 0, box.x + box.width, 0);
    shade.addColorStop(0, tint(color, strength * 0.25));
    shade.addColorStop(0.5, tint(color, strength));
    shade.addColorStop(1, tint(color, strength * 0.25));
    ctx.beginPath();
    along(-1, false);
    along(1, true);
    ctx.closePath();
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.strokeStyle = tint(color, strength * 0.55);
    ctx.lineWidth = Math.max(1, frame.unit);
    ctx.stroke();
  }
  vignette(frame, 0.32);
}

function rays(frame: Frame) {
  const { ctx, box, t, swell } = frame;
  const rand = random(frame.seed);
  const ox = box.x + box.width / 2;
  const oy = box.y - box.height * 0.12;
  const reach = Math.hypot(box.width, box.height) * 1.15;
  const shaft = (color: string) => {
    const fade = ctx.createRadialGradient(ox, oy, 0, ox, oy, reach);
    fade.addColorStop(0, tint(color, 0.6));
    fade.addColorStop(0.32, tint(color, 0.24));
    fade.addColorStop(1, tint(color, 0));
    return fade;
  };
  const fills = [shaft(frame.glow), shaft(frame.light)];
  // The whole fan swings a few degrees over forty seconds.
  const swing = 0.07 * Math.sin((TAU * t) / 40 + rand() * TAU);
  const count = 12;
  lights(frame);
  for (let i = 0; i < count; i++) {
    const offset = (rand() - 0.5) * 0.12;
    const width = 0.025 + rand() * 0.06;
    const driftRate = 1 / (14 + rand() * 10);
    const driftPhase = rand() * TAU;
    const pulseRate = 1 / (6 + rand() * 7);
    const pulsePhase = rand() * TAU;
    const strength = 0.08 + rand() * 0.1;
    const tone = rand() < 0.6 ? 0 : 1;
    const at = (-0.5 + (i + 0.5) / count) * 2 + offset + swing + 0.035 * Math.sin(TAU * driftRate * t + driftPhase);
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(TAU * pulseRate * t + pulsePhase));
    // Each shaft is a faint wide wedge with a brighter narrow one inside, so its sides fade like light through haze.
    ctx.globalAlpha = frame.alpha * Math.min(1, (strength * pulse * swell * (frame.dark ? 1 : 0.8)) / 2);
    ctx.fillStyle = fills[tone];
    for (const share of [1, 0.45]) {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.arc(ox, oy, reach, Math.PI / 2 + at - (width * share) / 2, Math.PI / 2 + at + (width * share) / 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = frame.alpha;
  bloom(frame, ox, box.y, box.width * 0.55, frame.glow, 0.16 * swell);
  vignette(frame, 0.34);
}

function grid(frame: Frame) {
  const { ctx, box, t, swell } = frame;
  const horizon = box.y + box.height * 0.56;
  const bottom = box.y + box.height;
  const depth = bottom - horizon;
  const cx = box.x + box.width / 2;
  lights(frame);
  // A haze of light low in the sky, rising off the far end of the floor.
  const haze = ctx.createLinearGradient(0, horizon - box.height * 0.32, 0, horizon + depth * 0.18);
  haze.addColorStop(0, tint(frame.light, 0));
  haze.addColorStop(0.78, tint(frame.light, 0.2 * swell));
  haze.addColorStop(0.86, tint(frame.glow, 0.1 * swell));
  haze.addColorStop(1, tint(frame.light, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(box.x, horizon - box.height * 0.32, box.width, box.height * 0.32 + depth * 0.18);
  bloom(frame, cx, horizon, box.width * 0.4, frame.light, 0.22 * swell);

  // Lines fade out toward the horizon, where they would crowd into a blur.
  const fade = ctx.createLinearGradient(0, horizon, 0, bottom);
  fade.addColorStop(0, tint(frame.light, 0));
  fade.addColorStop(0.16, tint(frame.light, 0.2 * swell));
  fade.addColorStop(1, tint(frame.light, Math.min(1, 0.62 * swell)));
  ctx.strokeStyle = fade;
  ctx.lineWidth = Math.max(1, 1.4 * frame.unit);
  ctx.beginPath();
  const rails = 22;
  const spread = box.width * 2.6;
  for (let i = 0; i <= rails; i++) {
    ctx.moveTo(cx, horizon);
    ctx.lineTo(cx + (i / rails - 0.5) * spread, bottom);
  }
  // Rows at depths 1, 2, 3 and on, all sliding nearer; a row at depth z sits 1/z of the way down from the horizon,
  // and one that reaches the bottom is replaced by a new one at the far end.
  const travel = wrap(t * 0.4, 1);
  for (let i = 0; i < 16; i++) {
    const z = i + 1 - travel;
    if (z < 1) continue;
    const y = horizon + depth / z;
    ctx.moveTo(box.x, y);
    ctx.lineTo(box.x + box.width, y);
  }
  ctx.stroke();
  ctx.strokeStyle = tint(frame.light, 0.45 * swell);
  ctx.beginPath();
  ctx.moveTo(box.x, horizon);
  ctx.lineTo(box.x + box.width, horizon);
  ctx.stroke();
  vignette(frame, 0.36);
}

// Noise tiles by seed, made once each; null where no canvas can be made, such as outside a browser.
const tiles = new Map<number, CanvasImageSource | null>();
const TILE = 256;

function grainTile(seed: number): CanvasImageSource | null {
  if (tiles.has(seed)) return tiles.get(seed) ?? null;
  if (tiles.size > 8) tiles.clear();
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(TILE, TILE) : typeof document !== "undefined" ? Object.assign(document.createElement("canvas"), { width: TILE, height: TILE }) : null;
  const own = canvas?.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;
  if (!canvas || !own) {
    tiles.set(seed, null);
    return null;
  }
  const rand = random(seed ^ 0x9e3779b9);
  const image = own.createImageData(TILE, TILE);
  for (let i = 0; i < TILE * TILE; i++) {
    // Three draws averaged lean toward the middle, so most grains are faint and a few stand out, as on film. Each grain
    // is white or black by its sign, so it shows on a dark ground and a light one alike.
    const v = (rand() + rand() + rand()) / 3 - 0.5;
    const shade = v > 0 ? 255 : 0;
    image.data[i * 4] = shade;
    image.data[i * 4 + 1] = shade;
    image.data[i * 4 + 2] = shade;
    image.data[i * 4 + 3] = Math.min(255, Math.abs(v) * 2 * 255);
  }
  own.putImageData(image, 0, 0);
  tiles.set(seed, canvas);
  return canvas;
}

function grain(frame: Frame) {
  const { ctx, box, t, swell } = frame;
  const rand = random(frame.seed);
  const rateX = 1 / (23 + rand() * 9);
  const rateY = 1 / (29 + rand() * 9);
  const phase = rand() * TAU;
  // A soft leak of light wanders in from a corner, as on old film stock.
  lights(frame);
  const x = box.x + box.width * (0.2 + 0.18 * Math.sin(TAU * rateX * t + phase));
  const y = box.y + box.height * (0.18 + 0.14 * Math.sin(TAU * rateY * t));
  bloom(frame, x, y, Math.max(box.width, box.height) * 0.55 * swell, frame.light, 0.14 * swell);
  vignette(frame, 0.42);
  const tile = grainTile(frame.seed);
  if (!tile) return;
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  // A new scatter twenty-four times a second, the way grain changes from one film frame to the next.
  const shake = random(frame.seed ^ Math.imul(Math.floor(t * 24) + 1, 0x9e3779b1));
  const scale = Math.max(1, frame.unit);
  const ox = Math.floor(shake() * TILE);
  const oy = Math.floor(shake() * TILE);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = frame.alpha * 0.2;
  ctx.translate(box.x, box.y);
  ctx.scale(scale, scale);
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(ox, oy, box.width / scale, box.height / scale);
  ctx.restore();
}

const STYLES: Record<Ambient, (frame: Frame) => void> = { aurora, flow, bokeh, particles, waves, rays, grid, grain };

/** Draws a moving background over its box for the clip's time. */
export function paintAmbient(ctx: Ctx, layer: Layer, box: PaintBox, env: PaintEnv): void {
  if (!(box.width > 0 && box.height > 0)) return;
  // A fill of "none" lays the effect over the design: its lights alone, judged against the page's own colour.
  const overlay = layer.fill === "none";
  const groundPaint = overlay ? "background" : layer.fill ?? "background";
  const ground = env.flat(groundPaint, "accent");
  const level = layer.react ? Math.min(1, Math.max(0, env.level(env.time) || 0)) : 0;
  const frame: Frame = {
    ctx,
    box,
    t: env.time * (layer.pace ?? 1),
    swell: layer.react ? 0.85 + 0.3 * level : 1,
    ground,
    light: env.flat(layer.color ?? "accent", "accent"),
    glow: env.flat(layer.highlight ?? "text", "text"),
    dark: isDark(ground),
    seed: seedOf(layer.id),
    unit: env.unit,
    alpha: ctx.globalAlpha,
    overlay,
  };
  ctx.save();
  if (overlay) {
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.clip();
  } else {
    ctx.fillStyle = env.fill(groundPaint, "accent", box);
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }
  (STYLES[layer.ambient ?? "aurora"] ?? aurora)(frame);
  ctx.restore();
}

/** A new moving background covering the whole page, or with `over`, the same movement as an effect laid over the
 *  design: lights only, on no ground of its own. */
export function ambientLayer(style: Ambient, id: string, over = false): Layer {
  // A background's ground is named outright, so the toolbar's swatch shows the colour it is painted on.
  return { id, kind: "ambient", ambient: style, x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1, fill: over ? "none" : "background" };
}
