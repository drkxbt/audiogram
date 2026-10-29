/* Uploaded SVG pictures. They are shown through an <img> from a blob, where scripts never run, but a kept file can be
   opened somewhere else later, so it is cleaned before it is kept: anything that runs code or reaches outside the file
   goes. Each one also gets a size in pixels, since a picture without one has no shape to place. The cleaning works on
   any tree with the few DOM calls below, so it can be tested without a browser. */

export const SVG_TYPE = "image/svg+xml";
/** An SVG is text: one bigger than this is a drawing too heavy to paint on every frame. */
export const SVG_LIMIT = 2 * 1024 * 1024;

const SVG_NS = "http://www.w3.org/2000/svg";
// What carries code, or a page of its own, in an SVG.
const DROPPED = new Set(["script", "foreignobject", "handler", "listener"]);
// Animations that could point a link outside the file, or set a handler, once the picture is opened on its own.
const ANIMATIONS = new Set(["set", "animate"]);
// Pictures and fonts written into the file itself, the only data a reference may carry; an SVG in an SVG could not be
// cleaned the same way, so it goes.
const INSIDE_DATA = /^data:(?:image\/(?:png|jpe?g|gif|webp|avif)|font\/[\w.+-]+|application\/(?:x-)?font[\w.+-]*)[;,]/i;
const URL_REF = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
// Browsers size an <img> of an SVG that says nothing about its size this way.
const FALLBACK = { width: 300, height: 150 };
// A size from the viewBox alone: its longer side this many pixels, as the drawing is sharp at any size anyway.
const VIEWBOX_SIDE = 1024;
const MOST_SIDE = 8192;
const UNITS: Record<string, number> = { "": 1, px: 1, pt: 4 / 3, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, em: 16, rem: 16, ex: 8 };

/** The parts of a DOM element the cleaning reads and changes. */
export interface SvgNode {
  readonly localName: string;
  readonly namespaceURI: string | null;
  readonly attributes: ArrayLike<{ readonly name: string; readonly value: string }>;
  readonly children: ArrayLike<SvgNode>;
  textContent: string | null;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  remove(): void;
}

const inside = (target: string) => target.startsWith("#") || INSIDE_DATA.test(target);

/** CSS or an attribute's value with every url() that points outside the file taken out. */
function keepInside(text: string): string {
  return text.replace(URL_REF, (whole, _quote: string, target: string) => (inside(target.trim()) ? whole : "none"));
}

/** A length in pixels, or null for one with no size of its own, such as a share of a page. */
function lengthOf(value: string | null): number | null {
  const match = /^\s*([+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(value ?? "");
  const unit = match ? UNITS[match[2].toLowerCase()] : undefined;
  if (!match || unit === undefined) return null;
  const pixels = Number(match[1]) * unit;
  return pixels > 0 && Number.isFinite(pixels) ? pixels : null;
}

/** A viewBox's width and height, or null when it isn't four numbers with a size. */
export function viewBoxOf(value: string | null): { width: number; height: number } | null {
  const numbers = (value ?? "").trim().split(/[\s,]+/).map(Number);
  if (numbers.length !== 4 || numbers.some((number) => !Number.isFinite(number))) return null;
  const [, , width, height] = numbers;
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * An SVG's size in whole pixels, from its width, height and viewBox, its shape kept: both lengths when it gives them;
 * one of them and the viewBox's shape; or the viewBox alone, scaled up or down to a 1024 px longer side. With none of
 * these it takes the size browsers give it, 300 by 150. The longer side never passes 8192.
 */
export function svgSize(width: string | null, height: string | null, viewBox: string | null): { width: number; height: number } {
  const box = viewBoxOf(viewBox);
  let w = lengthOf(width);
  let h = lengthOf(height);
  if (box && w === null && h === null) [w, h] = box.width >= box.height ? [VIEWBOX_SIDE, (VIEWBOX_SIDE * box.height) / box.width] : [(VIEWBOX_SIDE * box.width) / box.height, VIEWBOX_SIDE];
  else if (box && w === null) w = (h! * box.width) / box.height;
  else if (box && h === null) h = (w! * box.height) / box.width;
  w ??= FALLBACK.width;
  h ??= FALLBACK.height;
  const scale = Math.min(1, MOST_SIDE / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

function cleanNode(node: SvgNode) {
  for (const { name, value } of Array.from(node.attributes)) {
    const lower = name.toLowerCase();
    if (lower.startsWith("on")) node.removeAttribute(name);
    else if (lower === "href" || lower.endsWith(":href")) {
      if (!inside(value.trim())) node.removeAttribute(name);
    } else if (/url\(/i.test(value)) node.setAttribute(name, keepInside(value));
  }
  if (node.localName.toLowerCase() === "style") node.textContent = keepInside((node.textContent ?? "").replace(/@import[^;]*;?/gi, ""));
  for (const child of Array.from(node.children)) {
    const name = child.localName.toLowerCase();
    const target = (child.getAttribute("attributeName") ?? "").toLowerCase();
    if (child.namespaceURI !== SVG_NS || DROPPED.has(name) || (ANIMATIONS.has(name) && (target.endsWith("href") || target.startsWith("on")))) child.remove();
    else cleanNode(child);
  }
}

/**
 * Cleans an SVG in place and gives it a size in pixels: false, and left as it is, when the root isn't an <svg>.
 * Scripts, foreignObject, event handlers and links or url() references to anything outside the file are removed, and
 * so are elements outside the SVG namespace, which only an editor reads. One with no viewBox gets one matching its
 * size, so the drawing scales with the picture rather than being cut off by it.
 */
export function cleanSvg(root: SvgNode): boolean {
  if (root.localName !== "svg" || root.namespaceURI !== SVG_NS) return false;
  cleanNode(root);
  const viewBox = root.getAttribute("viewBox");
  const size = svgSize(root.getAttribute("width"), root.getAttribute("height"), viewBox);
  if (!viewBoxOf(viewBox)) {
    // With no viewBox the drawing's units are pixels, so the box is the size the picture had.
    const own = svgSize(root.getAttribute("width"), root.getAttribute("height"), null);
    root.setAttribute("viewBox", `0 0 ${own.width} ${own.height}`);
  }
  root.setAttribute("width", String(size.width));
  root.setAttribute("height", String(size.height));
  return true;
}

/** An uploaded SVG, cleaned and sized, ready to keep. Throws "size" for one over 2 MB and "type" for a file that isn't
 *  a whole SVG. */
export async function cleanSvgFile(file: Blob): Promise<Blob> {
  if (file.size > SVG_LIMIT) throw new Error("size");
  const document = new DOMParser().parseFromString(await file.text(), SVG_TYPE);
  const root = document.documentElement;
  if (document.getElementsByTagName("parsererror").length || !cleanSvg(root)) throw new Error("type");
  return new Blob([new XMLSerializer().serializeToString(root)], { type: SVG_TYPE });
}
