/* What the painter hands to the drawing of one kind of layer: the scene's colours, font and size, the clip's time, and
   the ways to turn a layer's colours and pictures into what the canvas takes. Each kind is drawn in its own box, about
   the origin, with the layer's place, turn, fade and movement already applied. */
import type { Paint } from "./layers.js";
import type { Theme } from "./render.js";

/** A layer's box in canvas pixels, about the origin: x and y are minus half the width and height. */
export interface PaintBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaintEnv {
  theme: Theme;
  /** The scene's font family as the canvas takes it; a layer's own `font` goes before it. */
  family: string;
  /** One design pixel: 1 on a frame whose shorter side is 1080. Sizes and weights in layers are in these. */
  unit: number;
  /** Seconds into the clip, and the clip's length. */
  time: number;
  duration: number;
  /** How far a chart or table has grown in, from 0 to 1; 1 when it has settled or while the picture is edited. */
  growth: number;
  /** A colour ready to fill or stroke with across `box`: a theme name, a CSS colour, or a metal as its gradient. */
  fill(paint: Paint | undefined, fallback: "text" | "muted" | "accent", box: PaintBox): string | CanvasGradient;
  /** One flat CSS colour for a paint, for sums on it and for choosing words that read on it. */
  flat(paint: Paint | undefined, fallback: "text" | "muted" | "accent"): string;
  /** The picture or video an image key names, or null when there is none. */
  image(key: string | undefined): CanvasImageSource | null;
  /** Whether an empty frame shows where a picture goes: only while the picture is edited, never in an export. */
  placeholders: boolean;
  /** The hint written on an empty frame, such as "Drop a photo". */
  placeholderText: string;
  /** How loud the voice is at a time in the clip, from 0 to 1. */
  level(time: number): number;
}
