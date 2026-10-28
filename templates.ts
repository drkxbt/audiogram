/* Designs to start from: an empty white page to build on, the classic audiogram card, and a page led by big
   captions. Free of the DOM, so it can be tested on its own. */

import { defaultLayers, FRAME_SIZES, type Layer, type LayerKind } from "./layers.js";
import type { Layout, Page } from "./render.js";

export type TemplateId = "blank" | "card" | "captions";

export const TEMPLATES: ReadonlyArray<{ id: TemplateId }> = [{ id: "blank" }, { id: "card" }, { id: "captions" }];

export interface Template {
  layers: Layer[];
  /** The page's own colour; null leaves the theme's. */
  page: Page | null;
  /** The theme it reads best on, by its place in THEMES, when it has one. */
  theme?: number;
}

// Paper: dark words on a light page.
const PAPER = 1;

/** A template laid out for a frame shape. */
export function templateOf(id: TemplateId, layout: Layout): Template {
  if (id === "blank") return { layers: [], page: { color: "#ffffff" }, theme: PAPER };
  if (id === "card") return { layers: defaultLayers(layout), page: null };
  return { layers: bigCaptions(layout), page: { color: "#f4efe6" }, theme: PAPER };
}

/** The words as the picture: a small name card on top, big captions, the sound bars under them, the links at the foot. */
function bigCaptions(layout: Layout): Layer[] {
  const { width, height } = FRAME_SIZES[layout];
  const unit = Math.min(width, height) / 1080;
  const pad = Math.round(Math.min(width, height) * 0.074);
  const box = (kind: LayerKind, x: number, y: number, w: number, h: number, style: Partial<Layer> = {}): Layer => ({
    id: kind,
    kind,
    x: x / width,
    y: y / height,
    w: w / width,
    h: h / height,
    rotation: 0,
    opacity: 1,
    ...style,
  });
  const avatar = 72 * unit;
  const nameX = pad + avatar + 20 * unit;
  const captionsTop = pad + avatar + height * 0.06;
  const captionsHeight = height * 0.5;
  const visualTop = captionsTop + captionsHeight + height * 0.04;
  const visualHeight = height * (layout === "landscape" ? 0.12 : 0.1);
  const label = 26 * unit * 1.6;
  return [
    box("avatar", pad, pad, avatar, avatar),
    box("name", nameX, pad + avatar / 2 - 40 * unit, width - nameX - pad, 40 * unit, { size: 34, weight: 650, color: "text", align: "left" }),
    box("handle", nameX, pad + avatar / 2 + 2 * unit, width - nameX - pad, 36 * unit, { size: 28, weight: 450, color: "muted", align: "left" }),
    box("captions", pad, captionsTop, width - pad * 2, captionsHeight, { size: layout === "landscape" ? 84 : 96, weight: 800, color: "text", highlight: "#ffd84d", align: "center" }),
    box("visual", pad, visualTop, width - pad * 2, visualHeight, { color: "accent", visual: "bars" }),
    box("time", pad, visualTop + visualHeight, width - pad * 2, label, { size: 26, weight: 500, color: "muted", align: "center" }),
    box("links", pad, height - pad * 0.68 - 22 * unit, width - pad * 2, 44 * unit, { size: 28, weight: 500, color: "muted", align: "center" }),
  ];
}
