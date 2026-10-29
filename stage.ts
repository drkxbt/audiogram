/* Free editing on the picture, the way a design tool does it: press a layer to select it, drag it (it snaps to the
   frame's middle and edges and to other layers), pull a handle to size it, the round handle to turn it, press selected
   words again to type them, and use the bar above the picture for the font, the size, the colour and the rest. With the
   keyboard, Tab steps through the layers on the picture and Enter types into words. */

import { formatTime, parseTime } from "./captions.js";
import { alignToPage, layerAt, moveLayer, resizeTurned, rotateLayer, snapMove, type Box, type Entrance, type Guide, type Handle, type Layer, type Loop, type PageEdge, type ShapeKind, type TextEffect } from "./layers.js";
import { FILTERS, paintOf, type Theme, type Visual } from "./render.js";
import { element, iconButton, ICONS, keyButton } from "./ui.js";

/** A font the editor offers: its family as the canvas names it, and its files, each loaded only when needed. */
export interface FontChoice {
  name: string;
  family: string;
  category: string;
  files: Array<{ url: string; weight: string; style?: string; unicodeRange?: string }>;
}

export interface StageLabels {
  picture: string;
  defaultFont: string;
  font: string;
  searchFonts: string;
  size: string;
  smaller: string;
  larger: string;
  bold: string;
  italic: string;
  boldMissing: string;
  italicMissing: string;
  colour: string;
  highlight: string;
  fill: string;
  align: string;
  alignNames: { left: string; center: string; right: string };
  editText: string;
  replace: string;
  more: string;
  forward: string;
  backward: string;
  duplicate: string;
  remove: string;
  hide: string;
  opacity: string;
  corners: string;
  position: string;
  x: string;
  y: string;
  width: string;
  height: string;
  rotation: string;
  straighten: string;
  themeColours: string;
  colours: string;
  custom: string;
  themeColour: (name: "text" | "muted" | "accent") => string;
  paletteNames: string[];
  options: (layer: string) => string;
  typing: (layer: string) => string;
  selected: (layer: string) => string;
  hidden: (layer: string) => string;
  deleted: (layer: string) => string;
  duplicated: (layer: string) => string;
  effects: string;
  shadow: string;
  outline: string;
  behind: string;
  capitals: string;
  none: string;
  animate: string;
  enterNames: Record<Entrance, string>;
  timing: string;
  showFrom: string;
  showUntil: string;
  playhead: string;
  wholeClip: string;
  timeHint: string;
  flip: string;
  flipX: string;
  flipY: string;
  adjust: string;
  brightness: string;
  contrast: string;
  saturation: string;
  blur: string;
  resetAdjust: string;
  setBackground: string;
  lock: string;
  unlock: string;
  locked: (layer: string) => string;
  alignPage: string;
  edgeNames: Record<PageEdge, string>;
  copy: string;
  paste: string;
  copied: (layer: string) => string;
  style: string;
  visualNames: Record<Visual, string>;
  underline: string;
  strike: string;
  list: string;
  listNames: { none: string; bullet: string; number: string };
  spacing: string;
  letterSpacing: string;
  lineHeight: string;
  curve: string;
  effectNames: Record<"none" | "shadow" | "outline" | "background" | TextEffect, string>;
  effectColour: string;
  transparency: string;
  positionPanel: string;
  arrange: string;
  toFront: string;
  toBack: string;
  advanced: string;
  alignSelection: string;
  distribute: string;
  distributeAcross: string;
  distributeDown: string;
  group: string;
  ungroup: string;
  selectAll: string;
  copyStyle: string;
  pasteStyle: string;
  border: string;
  borderWeight: string;
  borderStyle: string;
  dashNames: { solid: string; dashed: string; dotted: string };
  line: string;
  arrowStart: string;
  arrowEnd: string;
  crop: string;
  zoom: string;
  resetCrop: string;
  frame: string;
  frameNames: Record<"none" | ShapeKind, string>;
  filters: string;
  filterNames: Record<string, string>;
  original: string;
  in: string;
  out: string;
  loopName: string;
  loopNames: Record<Loop, string>;
  speed: string;
  selection: (count: number) => string;
  grouped: (count: number) => string;
  ungrouped: string;
}

export interface StageHost {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  /** Where the picture scrolls when it is zoomed in; the overlay over it goes in here. The stage when left out. */
  surface?: HTMLElement;
  labels: StageLabels;
  layers(): Layer[];
  /** Puts `next` in place of the layers; `done` ends a gesture, so it is undone as one step. */
  change(next: Layer[], done: boolean): void;
  theme(): Theme;
  /** The font family the picture uses where a layer names none. */
  fontFamily(): string;
  /** The frame's size in design pixels, for the exact position fields. */
  frameSize(): { width: number; height: number };
  fonts(): FontChoice[];
  loadFont(family: string, sample?: string): Promise<void>;
  /** The words a text layer shows, and a way to change them as they are typed. */
  textOf(layer: Layer): string;
  setText(layer: Layer, text: string): void;
  /** The layer being typed into, which the picture leaves out while the box over it shows the words. */
  setEditing(id: string | null): void;
  /** Whether the picture can be edited now: not while captions are tapped out or a video is made. */
  enabled(): boolean;
  /** A layer's name for people: "Title", "Captions", "Text: Big news". */
  layerName(layer: Layer): string;
  announce(message: string): void;
  /** Edits a layer whose words live elsewhere (links, captions); returns false when there is nothing to open. */
  open(layer: Layer): boolean;
  /** Puts another picture in a picture layer or the profile picture. */
  replace(layer: Layer): void;
  /** Where the playhead is, in seconds into the clip, for a layer's times. */
  time(): number;
  /** A picture or video layer's own size in pixels, for cropping it; null while it isn't loaded. */
  mediaSize(layer: Layer): { width: number; height: number } | null;
  /** Adds a part from a key on the picture: T for text, R for a square, C for a circle, L for a line. */
  add(what: "text" | "rect" | "circle" | "line"): void;
}

export interface Stage {
  readonly selected: Layer | null;
  /** Lets go of the listeners the stage put on the document. */
  destroy(): void;
  select(id: string | null): void;
  /** Lines the selection and the bar up again after the picture or its layers change. */
  refresh(): void;
  editText(id: string): void;
  focus(): void;
}

const TEXT_KINDS = new Set(["name", "handle", "title", "links", "time", "text", "captions"]);
const TYPED_KINDS = new Set(["name", "handle", "title", "text"]);
const SINGLE_LINE = new Set(["name", "handle"]);
// Words that can be typed in a letter at a time: everything with words but the captions, which keep their own timing.
const TYPEWRITER_KINDS = new Set(["name", "handle", "title", "links", "time", "text"]);
const PICTURE_KINDS = new Set(["image", "video"]);
const EDGES: Array<[PageEdge, keyof typeof ICONS]> = [["left", "alignLeft"], ["center", "alignCenter"], ["right", "alignRight"], ["top", "alignTop"], ["middle", "alignMiddle"], ["bottom", "alignBottom"]];
const ENTRANCES: Entrance[] = ["fade", "rise", "pan", "pop", "wipe", "blur", "zoom", "breathe", "baseline", "drift", "tumble", "stomp", "bounce", "flicker", "typewriter"];
const EXITS: Entrance[] = ["fade", "rise", "pan", "pop", "wipe", "blur", "zoom", "drift", "tumble"];
const LOOPS: Loop[] = ["pulse", "wiggle", "rotate", "float"];
const EFFECTS = ["none", "shadow", "lift", "hollow", "splice", "outline", "echo", "glitch", "neon", "background"] as const;
const FRAMES: Array<"none" | ShapeKind> = ["none", "ellipse", "rect", "triangle", "diamond", "star", "heart", "hexagon", "arch", "bubble"];
// What Copy style carries from one layer to another: its look, not its place or its words.
const STYLE_KEYS = ["font", "size", "weight", "italic", "color", "highlight", "align", "shadow", "outline", "background", "uppercase", "effect", "effectColor", "underline", "strike", "letterSpacing", "lineHeight", "list", "fill", "stroke", "strokeWidth", "dash", "radius", "opacity", "filter", "adjust"] as const;
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const PALETTE = ["#ffffff", "#111111", "#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#2ff0b8", "#0a84ff", "#5e5ce6", "#bf5af2", "#ff2d55", "#8e8e93"];
const ALIGN_ICONS = {
  left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
};

let made = 0;
const newId = (kind: string) => `${kind}-${Date.now().toString(36)}${(made++).toString(36)}`;
// The layers Copy took, ready to paste into any picture on the page, and the look Copy style took.
let clipboard: Layer[] = [];
let styleClip: Partial<Layer> | null = null;
let pops = 0;

/** The heaviest weight a font's files cover: 900 for a variable 100–900 font, 400 for a single regular file. */
const heaviest = (font: FontChoice) => Math.max(...font.files.map((file) => Number(file.weight.split(/\s+/).pop()) || 400));

export function createStage(host: StageHost): Stage {
  const { labels } = host;
  const overlay = element("div", "ag-overlay");
  overlay.tabIndex = 0;
  overlay.setAttribute("role", "group");
  overlay.setAttribute("aria-label", labels.picture);
  const guides = element("div", "ag-guides");
  const hover = element("div", "ag-hover");
  hover.hidden = true;
  const box = element("div", "ag-select");
  box.hidden = true;
  for (const handle of HANDLES) {
    const grip = element("span", `ag-grip ag-grip-${handle}`);
    grip.dataset.handle = handle;
    box.append(grip);
  }
  const turn = element("span", "ag-turn");
  turn.dataset.handle = "rotate";
  box.append(turn);
  const typing = element("textarea", "ag-type");
  typing.hidden = true;
  typing.rows = 1;
  typing.spellcheck = true;
  const marquee = element("div", "ag-marquee");
  marquee.hidden = true;
  const members = element("div", "ag-members");
  overlay.append(guides, members, hover, box, marquee, typing);
  const menu = element("div", "ag-menu");
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  const toolbar = element("div", "ag-context");
  toolbar.setAttribute("role", "toolbar");
  toolbar.hidden = true;
  const pop = element("div", "ag-pop");
  pop.hidden = true;
  pop.setAttribute("role", "dialog");
  pop.id = `ag-pop-${++pops}`;
  const surface = host.surface ?? host.stage;
  surface.append(overlay);
  host.stage.append(toolbar, pop, menu);
  surface.addEventListener("scroll", () => draw(), { passive: true });

  const gone = new AbortController();
  let selectedId: string | null = null;
  // The rest of the selection when more than one layer is picked, the one picked last being selectedId.
  let others: string[] = [];
  let editing: string | null = null;
  let toolbarFor = "";
  const find = (id: string | null) => host.layers().find((layer) => layer.id === id) ?? null;
  const size = () => ({ width: overlay.clientWidth || 1, height: overlay.clientHeight || 1 });
  const visible = () => host.layers().filter((layer) => !layer.hidden && !layer.locked);

  // The overlay sits exactly over the picture, wherever the stage has put it and however far it is scrolled.
  function place() {
    const canvas = host.canvas.getBoundingClientRect();
    const stage = surface.getBoundingClientRect();
    overlay.style.left = `${canvas.left - stage.left + (surface === host.stage ? 0 : surface.scrollLeft)}px`;
    overlay.style.top = `${canvas.top - stage.top + (surface === host.stage ? 0 : surface.scrollTop)}px`;
    overlay.style.width = `${canvas.width}px`;
    overlay.style.height = `${canvas.height}px`;
  }

  const frameOf = (node: HTMLElement, layer: Layer) => {
    const { width, height } = size();
    node.style.left = `${layer.x * width}px`;
    node.style.top = `${layer.y * height}px`;
    node.style.width = `${layer.w * width}px`;
    node.style.height = `${layer.h * height}px`;
    node.style.transform = layer.rotation ? `rotate(${layer.rotation}deg)` : "";
  };

  /** Every picked layer, the one picked last first. */
  const picked = () => [selectedId, ...others].map(find).filter((layer): layer is Layer => layer !== null && !layer.hidden);
  const multi = () => others.length > 0;
  /** The upright box round some layers, turned or not, in frame fractions. */
  function bounds(layers: Layer[]): Box {
    const { width, height } = size();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const layer of layers) {
      const angle = (layer.rotation * Math.PI) / 180;
      const halfX = (Math.abs(layer.w * width * Math.cos(angle)) + Math.abs(layer.h * height * Math.sin(angle))) / 2 / width;
      const halfY = (Math.abs(layer.w * width * Math.sin(angle)) + Math.abs(layer.h * height * Math.cos(angle))) / 2 / height;
      const cx = layer.x + layer.w / 2;
      const cy = layer.y + layer.h / 2;
      left = Math.min(left, cx - halfX);
      right = Math.max(right, cx + halfX);
      top = Math.min(top, cy - halfY);
      bottom = Math.max(bottom, cy + halfY);
    }
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  function draw() {
    place();
    const layer = find(selectedId);
    const group = multi() ? picked() : [];
    members.replaceChildren(...group.map((member) => {
      const node = element("span", "ag-member");
      frameOf(node, member);
      return node;
    }));
    box.hidden = !layer || layer.hidden === true || !host.enabled() || editing !== null;
    box.toggleAttribute("data-multi", group.length > 1);
    if (layer && !box.hidden && group.length > 1) frameOf(box, { ...layer, ...bounds(group), rotation: 0 });
    else if (layer && !box.hidden) {
      frameOf(box, layer);
      const { width, height } = size();
      box.toggleAttribute("data-words", TEXT_KINDS.has(layer.kind));
      // Pictures keep their shape, so only their corners pull.
      box.toggleAttribute("data-keep", PICTURE_KINDS.has(layer.kind) || layer.kind === "avatar");
      // Too small for side handles: the corners are enough, and easier to hit.
      box.toggleAttribute("data-small", layer.w * width < 48 || layer.h * height < 48);
      // Locked: outlined, with no handles to pull.
      box.toggleAttribute("data-locked", layer.locked === true);
    }
    toolbar.hidden = !layer || !host.enabled();
  }

  function showGuides(lines: Guide[]) {
    guides.replaceChildren(...lines.map((line) => {
      const node = element("span", `ag-guide ag-guide-${line.axis}`);
      if (line.axis === "x") node.style.left = `${line.at * 100}%`;
      else node.style.top = `${line.at * 100}%`;
      return node;
    }));
  }

  // Set while the stage makes a change of its own, which its bar and pop-over already show.
  let changing = false;
  function replaceLayer(layer: Layer, done: boolean) {
    changing = true;
    try {
      host.change(host.layers().map((item) => (item.id === layer.id ? layer : item)), done);
    } finally {
      changing = false;
    }
    if (layer.id === selectedId) toolbarFor = JSON.stringify(find(layer.id));
    draw();
  }

  function update(layer: Layer, change: Partial<Layer>) {
    replaceLayer({ ...layer, ...change }, true);
    buildToolbar(find(layer.id));
  }

  /** Several layers changed at once, as one step when `done`. */
  function replaceMany(next: Map<string, Layer>, done: boolean) {
    changing = true;
    try {
      host.change(host.layers().map((item) => next.get(item.id) ?? item), done);
    } finally {
      changing = false;
    }
    if (selectedId && next.has(selectedId)) toolbarFor = JSON.stringify(find(selectedId));
    draw();
  }

  /** The same change to every picked layer, as one step. */
  function updateAll(change: (layer: Layer) => Partial<Layer>) {
    replaceMany(new Map(picked().map((layer) => [layer.id, { ...layer, ...change(layer) }])), true);
    buildToolbar(find(selectedId));
  }

  // Pointer: select, move, size and turn. On a touch screen a first touch only selects, so a swipe over the picture
  // still scrolls the page; the selected layer can then be dragged.

  let gesture: { kind: "move" | "resize" | "rotate" | "group" | "marquee" | "crop"; pointerId: number; x: number; y: number; start: Layer; handle?: Handle; moved: boolean; wasSelected: boolean; starts?: Layer[]; from?: { x: number; y: number } } | null = null;
  // The picture layer whose crop is open: a drag on it moves the picture inside its box.
  let cropping: string | null = null;
  const pointAt = (event: PointerEvent | MouseEvent) => {
    const rect = overlay.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  overlay.addEventListener("pointerdown", (event) => {
    if (!host.enabled() || event.button !== 0 || event.target === typing) return;
    closeMenu();
    const handle = (event.target as HTMLElement).dataset.handle;
    const current = find(selectedId);
    const point = pointAt(event);
    const { width, height } = size();
    const under = layerAt(host.layers(), point.x, point.y, width, height);
    // While a crop is open, a drag on its picture moves the picture inside the box.
    if (cropping && under?.id === cropping && !handle) {
      gesture = { kind: "crop", pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: under, moved: false, wasSelected: true };
      try {
        overlay.setPointerCapture(event.pointerId);
      } catch {
        // A pointer from a script can't be captured; the drag still follows it over the picture.
      }
      event.preventDefault();
      return;
    }
    closePop();
    let start: Layer | null = null;
    let kind: "move" | "resize" | "rotate" | "group" | "marquee" = "move";
    if (handle && current && !multi()) {
      start = current;
      kind = handle === "rotate" ? "rotate" : "resize";
    } else if (event.shiftKey && under) {
      // Shift adds a layer to the selection, or takes it out.
      toggle(under.id);
      return;
    } else if (under && multi() && picked().some((layer) => layer.id === under.id)) {
      start = under;
      kind = "group";
    } else {
      start = under;
      const already = start !== null && start.id === selectedId;
      select(start?.id ?? null);
      if (start && multi()) kind = "group";
      if (event.pointerType === "touch" && !already) return;
      // A drag from the empty page draws a box round the layers to pick.
      if (!start && event.pointerType !== "touch") {
        gesture = { kind: "marquee", pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: null as unknown as Layer, moved: false, wasSelected: false, from: point };
        capture(event);
        return;
      }
    }
    // A locked layer is picked, to be unlocked, but stays where it is.
    if (!start || start.locked || (kind === "group" && picked().some((layer) => layer.locked))) return;
    gesture = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, start, handle: kind === "resize" ? (handle as Handle) : undefined, moved: false, wasSelected: current?.id === start.id, starts: kind === "group" ? picked() : undefined };
    capture(event);
    event.preventDefault();
  });

  function capture(event: PointerEvent) {
    try {
      overlay.setPointerCapture(event.pointerId);
    } catch {
      // A pointer from a script can't be captured; the drag still follows it over the picture.
    }
    // Focus for the keys, without the ring a keyboard user would see.
    overlay.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    event.preventDefault();
  }

  overlay.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) {
      // Hovering outlines what a press would pick.
      if (!host.enabled() || gesture || event.pointerType === "touch") return;
      const point = pointAt(event);
      const { width, height } = size();
      const under = layerAt(host.layers(), point.x, point.y, width, height);
      hover.hidden = !under || under.id === selectedId;
      if (under && !hover.hidden) frameOf(hover, under);
      return;
    }
    const { width, height } = size();
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 3) return;
    gesture.moved = true;
    hover.hidden = true;
    const start = gesture.start;
    if (gesture.kind === "marquee") {
      const from = gesture.from!;
      const to = pointAt(event);
      const area = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(to.x - from.x), h: Math.abs(to.y - from.y) };
      marquee.hidden = false;
      marquee.style.left = `${area.x * width}px`;
      marquee.style.top = `${area.y * height}px`;
      marquee.style.width = `${area.w * width}px`;
      marquee.style.height = `${area.h * height}px`;
      return;
    }
    if (gesture.kind === "crop") {
      const media = host.mediaSize(start);
      if (!media) return;
      // How far the picture spills past its box on each side, in pixels on screen, sets how far a drag moves it.
      const boxW = start.w * width;
      const boxH = start.h * height;
      const scale = Math.max(boxW / media.width, boxH / media.height) * Math.max(1, start.crop?.zoom ?? 1);
      const spareX = media.width * scale - boxW;
      const spareY = media.height * scale - boxH;
      const crop = { zoom: 1, x: 0, y: 0, ...start.crop };
      const angle = (-start.rotation * Math.PI) / 180;
      const along = (dx * Math.cos(angle) - dy * Math.sin(angle)) * (start.flipX ? -1 : 1);
      const down = (dx * Math.sin(angle) + dy * Math.cos(angle)) * (start.flipY ? -1 : 1);
      replaceLayer({ ...start, crop: { ...crop, x: spareX > 1 ? Math.max(-1, Math.min(1, crop.x - (along * 2) / spareX)) : 0, y: spareY > 1 ? Math.max(-1, Math.min(1, crop.y - (down * 2) / spareY)) : 0 } }, false);
      return;
    }
    if (gesture.kind === "group") {
      const starts = gesture.starts!;
      const area = bounds(starts);
      const moved = { ...area, x: area.x + dx / width, y: area.y + dy / height };
      const ids = new Set(starts.map((layer) => layer.id));
      const snapped = event.altKey ? { ...moved, guides: [] } : snapMove(moved, visible().filter((layer) => !ids.has(layer.id)), width, height, 6);
      showGuides(snapped.guides);
      replaceMany(new Map(starts.map((layer) => [layer.id, { ...layer, ...moveLayer(layer, snapped.x - area.x, snapped.y - area.y) }])), false);
      return;
    }
    let next: Layer;
    if (gesture.kind === "move") {
      const moved = moveLayer(start, dx / width, dy / height);
      const others = visible().filter((layer) => layer.id !== start.id);
      // Alt moves freely, without snapping.
      const snapped = event.altKey ? { ...moved, guides: [] } : snapMove(moved, others, width, height, 6);
      showGuides(snapped.guides);
      // A snap may not carry a thin layer off the frame; a tenth of it always stays to grab.
      next = moveLayer({ ...start, x: snapped.x, y: snapped.y }, 0, 0);
    } else if (gesture.kind === "rotate") {
      const point = pointAt(event);
      next = rotateLayer(start, point.x, point.y, width, height, event.shiftKey);
    } else {
      const corner = gesture.handle!.length === 2;
      // Pictures and the profile picture keep their shape; words keep theirs from a corner, and grow with it.
      const keep = event.shiftKey || PICTURE_KINDS.has(start.kind) || start.kind === "avatar" || (corner && TEXT_KINDS.has(start.kind));
      next = resizeTurned(start, gesture.handle!, dx, dy, keep, width, height);
      if (corner && TEXT_KINDS.has(start.kind) && start.size) next = { ...next, size: Math.max(8, Math.round(start.size * (next.w / start.w))) };
    }
    replaceLayer(next, false);
  });

  const endGesture = (event: PointerEvent) => {
    if (!gesture) return;
    const { moved, start, wasSelected, kind, from } = gesture;
    gesture = null;
    showGuides([]);
    if (kind === "marquee") {
      marquee.hidden = true;
      if (!moved || !from) return;
      const to = pointAt(event);
      const area = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(to.x - from.x), h: Math.abs(to.y - from.y) };
      const inside = visible().filter((layer) => {
        const edge = bounds([layer]);
        return edge.x < area.x + area.w && edge.x + edge.w > area.x && edge.y < area.y + area.h && edge.y + edge.h > area.y;
      });
      selectMany(inside.map((layer) => layer.id));
      return;
    }
    if (moved && kind === "crop") {
      host.change(host.layers(), true);
      return;
    }
    if (moved) {
      host.change(host.layers(), true);
      buildToolbar(find(start.id));
    } else if (event.type === "pointerup" && kind === "move" && wasSelected && TYPED_KINDS.has(start.kind)) {
      // Pressing selected words again types into them, as a second tap does in a design tool.
      editText(start.id);
    }
    draw();
  };
  overlay.addEventListener("pointerup", endGesture);
  overlay.addEventListener("pointercancel", endGesture);
  overlay.addEventListener("pointerleave", () => (hover.hidden = true));
  // Pressing the grey around the picture lets go.
  host.stage.addEventListener("pointerdown", (event) => {
    if (event.target === host.stage || event.target === surface) select(null);
  });

  overlay.addEventListener("dblclick", (event) => {
    if (!host.enabled()) return;
    const point = pointAt(event);
    const { width, height } = size();
    const under = layerAt(host.layers(), point.x, point.y, width, height);
    if (under) openLayer(under);
  });

  /** Types into words, crops a picture (or asks for one when the frame is empty), or opens the panel a layer's words
   *  come from. */
  function openLayer(layer: Layer) {
    if (layer.locked) return;
    if (TYPED_KINDS.has(layer.kind)) editText(layer.id);
    else if (PICTURE_KINDS.has(layer.kind) && layer.image && host.mediaSize(layer)) {
      select(layer.id);
      const key = toolbar.querySelector<HTMLElement>('[data-key="crop"]');
      if (key) cropPop(key, layer);
    } else if (layer.kind === "image" || layer.kind === "avatar") host.replace(layer);
    else host.open(layer);
  }

  // The menu a right click opens on the picture, with what the bar and the keys do for the layers under it.
  overlay.addEventListener("contextmenu", (event) => {
    if (!host.enabled()) return;
    event.preventDefault();
    const point = pointAt(event);
    const { width, height } = size();
    const under = layerAt(host.layers(), point.x, point.y, width, height);
    if (under && !picked().some((layer) => layer.id === under.id)) select(under.id);
    if (!under && !multi()) select(null);
    openMenu(event.clientX, event.clientY);
  });

  // Keys on the picture. Tab steps through the layers and on past the last; arrows nudge a pixel (ten with Shift);
  // Enter types into words; Delete removes; Ctrl or Cmd with D duplicates, C copies, X cuts and V pastes; Escape lets go.
  let nudgeTimer = 0;
  overlay.addEventListener("keydown", (event) => {
    if (event.target === typing || !host.enabled()) return;
    const layer = find(selectedId);
    if (event.key === "Tab" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      // Topmost first, the way the eye reads a design.
      const order = visible().reverse();
      const index = layer ? order.findIndex((item) => item.id === layer.id) : -1;
      const next = event.shiftKey ? index - 1 : index + 1;
      // Past either end, Tab carries on out of the picture.
      if (next < 0 || next >= order.length || (event.shiftKey && index < 0)) {
        select(null);
        return;
      }
      event.preventDefault();
      select(order[next].id);
      return;
    }
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (command && (key === "z" || key === "y") && nudgeTimer) {
      clearTimeout(nudgeTimer);
      nudgeTimer = 0;
      host.change(host.layers(), true);
    }
    if (command && key === "v" && clipboard.length) {
      event.preventDefault();
      paste();
      return;
    }
    if (command && key === "a") {
      event.preventDefault();
      selectMany(visible().map((item) => item.id));
      return;
    }
    if (!layer) {
      const order = visible();
      if ((event.key === "Enter" || event.key === "ArrowDown") && order.length) {
        event.preventDefault();
        select(order[order.length - 1].id);
        return;
      }
      // Single keys add a part, as in a design tool: T text, R a square, C a circle, L a line.
      const adds: Record<string, "text" | "rect" | "circle" | "line"> = { t: "text", r: "rect", c: "circle", l: "line" };
      if (!command && !event.altKey && adds[key]) {
        event.preventDefault();
        host.add(adds[key]);
      }
      return;
    }
    if (command && (key === "c" || key === "x")) {
      event.preventDefault();
      copy();
      if (key === "x" && !picked().some((item) => item.locked)) removeLayers();
      return;
    }
    if (event.key === "Escape") return select(null);
    if (command && key === "g") {
      event.preventDefault();
      if (event.shiftKey) ungroup();
      else group();
      return;
    }
    if (event.altKey && event.shiftKey && event.code === "KeyL") {
      event.preventDefault();
      lock(layer, !layer.locked);
      return;
    }
    // A locked layer keeps still: only Tab, Escape, Copy and Unlock reach it.
    if (picked().some((item) => item.locked)) return;
    if (command && (event.code === "BracketRight" || event.code === "BracketLeft")) {
      event.preventDefault();
      arrange(event.code === "BracketRight" ? (event.shiftKey ? "front" : "forward") : event.shiftKey ? "back" : "backward");
      return;
    }
    if (command && !multi() && TEXT_KINDS.has(layer.kind) && (key === "b" || key === "i" || key === "u")) {
      event.preventDefault();
      if (key === "b") update(layer, { weight: (layer.weight ?? 400) >= 600 ? 400 : 700 });
      else if (key === "i") update(layer, { italic: !layer.italic });
      else update(layer, { underline: !layer.underline });
      return;
    }
    const { width, height } = size();
    const step = event.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (nudge[event.key]) {
      event.preventDefault();
      const [dx, dy] = nudge[event.key];
      replaceMany(new Map(picked().map((item) => [item.id, { ...item, ...moveLayer(item, dx / width, dy / height) }])), false);
      // A run of nudges is one step to undo.
      clearTimeout(nudgeTimer);
      nudgeTimer = window.setTimeout(() => {
        nudgeTimer = 0;
        host.change(host.layers(), true);
        buildToolbar(find(selectedId));
      }, 400);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeLayers();
    } else if (command && key === "d") {
      event.preventDefault();
      duplicate();
    } else if (event.key === "Enter" && !multi()) {
      event.preventDefault();
      openLayer(layer);
    }
  });

  // Typing into words, in a box over them in their own font. The box is set at 16 px or more and scaled down to the
  // words' size, so a phone doesn't zoom in when it takes focus.

  function editText(id: string) {
    const layer = find(id);
    if (!layer || !TYPED_KINDS.has(layer.kind)) return;
    select(id);
    editing = id;
    host.setEditing(id);
    placeTyping(layer);
    // Words shown in capitals are typed in capitals too.
    typing.style.textTransform = layer.uppercase ? "uppercase" : "";
    typing.setAttribute("aria-label", labels.typing(host.layerName(layer)));
    typing.value = host.textOf(layer);
    typing.hidden = false;
    fitTyping();
    typing.focus();
    typing.select();
    draw();
  }

  function placeTyping(layer: Layer) {
    const { width, height } = size();
    const px = (layer.size ?? 40) * (Math.min(width, height) / 1080);
    const scale = Math.min(1, px / 16);
    const w = (layer.w * width) / scale;
    const h = (layer.h * height) / scale;
    const cx = (layer.x + layer.w / 2) * width;
    const cy = (layer.y + layer.h / 2) * height;
    const single = SINGLE_LINE.has(layer.kind);
    typing.style.left = "0";
    typing.style.top = "0";
    typing.style.width = `${w}px`;
    typing.style.minHeight = `${h}px`;
    typing.style.transformOrigin = "0 0";
    typing.style.transform = `translate(${cx}px, ${cy}px) rotate(${layer.rotation}deg) scale(${scale}) translate(${-w / 2}px, ${-h / 2}px)`;
    typing.style.font = `${layer.italic ? "italic " : ""}${layer.weight ?? (layer.kind === "title" ? 700 : 400)} ${px / scale}px ${layer.font ? `"${layer.font}", ` : ""}${host.fontFamily()}`;
    typing.style.lineHeight = "1.15";
    typing.style.whiteSpace = single ? "nowrap" : "pre-wrap";
    // One line sits in the middle of its box, as it is painted.
    typing.style.paddingTop = single ? `${Math.max(0, (h - (px / scale) * 1.15) / 2)}px` : "0";
    typing.style.color = paintOf(layer.color, host.theme(), layer.kind === "handle" ? "muted" : "text");
    typing.style.textAlign = layer.align ?? "left";
  }
  function fitTyping() {
    typing.style.height = "auto";
    typing.style.height = `${typing.scrollHeight}px`;
  }

  function finishTyping(refocus: boolean) {
    if (!editing) return;
    editing = null;
    typing.hidden = true;
    host.setEditing(null);
    host.change(host.layers(), true);
    draw();
    if (refocus) overlay.focus({ preventScroll: true });
  }
  typing.addEventListener("input", () => {
    const layer = find(editing);
    if (!layer) return;
    host.setText(layer, typing.value);
    const now = find(editing);
    if (now) placeTyping(now);
    fitTyping();
  });
  typing.addEventListener("keydown", (event) => {
    const layer = find(editing);
    // A name or a handle is one line; Enter is done with it. Escape is done with any.
    if (event.key === "Escape" || (event.key === "Enter" && (!layer || layer.kind !== "text" || event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      finishTyping(true);
    }
  });
  // Leaving the box ends the typing, without pulling focus back from where the user went.
  typing.addEventListener("blur", () => finishTyping(false));

  // Changes from the bar and the keys.

  // Any layer can go: the Elements panel adds back the name, the captions or anything else. The last captions layer
  // is hidden rather than deleted, so captions arriving later, this visit or the next, don't put one back.
  function removeLayer(layer: Layer) {
    const name = host.layerName(layer);
    if (layer.kind === "captions" && !host.layers().some((other) => other.kind === "captions" && other.id !== layer.id && !other.hidden)) {
      replaceLayer({ ...layer, hidden: true }, true);
      host.announce(labels.hidden(name));
    } else {
      host.change(host.layers().filter((item) => item.id !== layer.id), true);
      host.announce(labels.deleted(name));
    }
    select(null);
    overlay.focus({ preventScroll: true });
  }

  /** Every picked layer goes, as one step. */
  function removeLayers() {
    const leaving = picked();
    if (leaving.length === 1) return removeLayer(leaving[0]);
    const ids = new Set(leaving.map((layer) => layer.id));
    const captionsLeft = host.layers().some((item) => item.kind === "captions" && !item.hidden && !ids.has(item.id));
    const lastCaptions = captionsLeft ? null : leaving.find((layer) => layer.kind === "captions");
    host.change(host.layers().flatMap((item) => (item.id === lastCaptions?.id ? [{ ...item, hidden: true }] : ids.has(item.id) ? [] : [item])), true);
    host.announce(labels.deleted(labels.selection(leaving.length)));
    select(null);
    overlay.focus({ preventScroll: true });
  }

  /** Copies of `layers` moved a little down and right, with new ids and a new group for each group among them. */
  function twins(layers: Layer[]): Layer[] {
    const groups = new Map<string, string>();
    return layers.map((layer) => {
      const group = layer.group ? (groups.get(layer.group) ?? groups.set(layer.group, newId("group")).get(layer.group)) : undefined;
      return { ...moveLayer(layer, 0.03, 0.03), id: newId(layer.kind), hidden: false, locked: false, group };
    });
  }

  /** Copies of the picked layers, each over its original; the copies are picked. */
  function duplicate() {
    const originals = picked();
    if (!originals.length) return;
    const copies = twins(originals);
    const byOriginal = new Map(originals.map((layer, index) => [layer.id, copies[index]]));
    host.change(host.layers().flatMap((item) => (byOriginal.has(item.id) ? [item, byOriginal.get(item.id)!] : [item])), true);
    selectMany(copies.map((layer) => layer.id));
    host.announce(labels.duplicated(originals.length === 1 ? host.layerName(originals[0]) : labels.selection(originals.length)));
  }

  function copy() {
    const layers = picked();
    if (!layers.length) return;
    // In their order on the page, so a paste stacks them the same way.
    const order = host.layers().map((item) => item.id);
    clipboard = layers.map((layer) => ({ ...layer })).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    host.announce(labels.copied(layers.length === 1 ? host.layerName(layers[0]) : labels.selection(layers.length)));
  }

  /** The copied layers, on top, a little down and to the right of where they were so the two can be told apart. */
  function paste() {
    if (!clipboard.length) return;
    const copies = twins(clipboard);
    clipboard = copies.map((layer) => ({ ...layer }));
    host.change([...host.layers(), ...copies], true);
    selectMany(copies.map((layer) => layer.id));
    host.announce(labels.duplicated(copies.length === 1 ? host.layerName(copies[0]) : labels.selection(copies.length)));
  }

  /** The picked layers become one group, picked and moved together from then on. */
  function group() {
    const layers = picked();
    if (layers.length < 2) return;
    const id = newId("group");
    replaceMany(new Map(layers.map((layer) => [layer.id, { ...layer, group: id }])), true);
    host.announce(labels.grouped(layers.length));
    buildToolbar(find(selectedId));
  }

  function ungroup() {
    const layers = picked().filter((layer) => layer.group);
    if (!layers.length) return;
    replaceMany(new Map(layers.map((layer) => [layer.id, { ...layer, group: undefined }])), true);
    host.announce(labels.ungrouped);
    buildToolbar(find(selectedId));
  }

  /** The picked layers moved up or down the stack together, one step or all the way. */
  function arrange(way: "forward" | "backward" | "front" | "back") {
    const ids = new Set(picked().map((layer) => layer.id));
    if (!ids.size) return;
    const list = host.layers();
    const moving = list.filter((layer) => ids.has(layer.id));
    const rest = list.filter((layer) => !ids.has(layer.id));
    let next: Layer[];
    if (way === "front") next = [...rest, ...moving];
    else if (way === "back") next = [...moving, ...rest];
    else {
      next = [...list];
      const step = way === "forward" ? 1 : -1;
      const order = way === "forward" ? [...moving].reverse() : moving;
      for (const layer of order) {
        const at = next.findIndex((item) => item.id === layer.id);
        const to = at + step;
        if (to < 0 || to >= next.length || ids.has(next[to].id)) continue;
        [next[at], next[to]] = [next[to], next[at]];
      }
    }
    host.change(next, true);
    draw();
  }

  /** The picked layers lined up on one of the selection's edges or its middle. */
  function alignSelection(edge: PageEdge) {
    const layers = picked();
    const area = bounds(layers);
    const { width, height } = size();
    replaceMany(new Map(layers.map((layer) => {
      const own = bounds([layer]);
      const shift = edge === "left" ? area.x - own.x : edge === "right" ? area.x + area.w - (own.x + own.w) : edge === "center" ? area.x + area.w / 2 - (own.x + own.w / 2) : 0;
      const drop = edge === "top" ? area.y - own.y : edge === "bottom" ? area.y + area.h - (own.y + own.h) : edge === "middle" ? area.y + area.h / 2 - (own.y + own.h / 2) : 0;
      return [layer.id, { ...layer, x: layer.x + shift, y: layer.y + drop }];
    })), true);
    void width;
    void height;
    buildToolbar(find(selectedId));
  }

  /** Three or more layers spread so the gaps between them are equal, across or down. */
  function distribute(axis: "x" | "y") {
    const layers = picked();
    if (layers.length < 3) return;
    const spans = layers.map((layer) => ({ layer, box: bounds([layer]) })).sort((a, b) => (axis === "x" ? a.box.x - b.box.x : a.box.y - b.box.y));
    const first = spans[0].box;
    const last = spans[spans.length - 1].box;
    const total = axis === "x" ? last.x + last.w - first.x : last.y + last.h - first.y;
    const used = spans.reduce((sum, { box: each }) => sum + (axis === "x" ? each.w : each.h), 0);
    const gap = (total - used) / (spans.length - 1);
    let at = axis === "x" ? first.x : first.y;
    const next = new Map<string, Layer>();
    for (const { layer, box: each } of spans) {
      const shift = at - (axis === "x" ? each.x : each.y);
      next.set(layer.id, axis === "x" ? { ...layer, x: layer.x + shift } : { ...layer, y: layer.y + shift });
      at += (axis === "x" ? each.w : each.h) + gap;
    }
    replaceMany(next, true);
    buildToolbar(find(selectedId));
  }

  function copyStyle(layer: Layer) {
    styleClip = Object.fromEntries(STYLE_KEYS.map((key) => [key, layer[key]])) as Partial<Layer>;
  }

  function pasteStyle() {
    const style = styleClip;
    if (!style) return;
    updateAll(() => style);
  }

  /** A picture or video stretched over the whole page and sent to the back. */
  function setAsBackground(layer: Layer) {
    const full = { ...layer, x: 0, y: 0, w: 1, h: 1, rotation: 0, radius: 0 };
    host.change([full, ...host.layers().filter((item) => item.id !== layer.id)], true);
    buildToolbar(find(layer.id));
    draw();
  }

  // The right-click menu: arrow keys move along it, Enter or a click runs an item, Escape or a click elsewhere closes it.
  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    menu.replaceChildren();
  }
  function openMenu(clientX: number, clientY: number) {
    closePop();
    const layer = find(selectedId);
    const items: Array<[string, string, () => void] | null> = [];
    if (layer && picked().some((item) => item.locked)) {
      items.push([labels.copy, ICONS.copy, copy], [labels.unlock, ICONS.unlock, () => lock(layer, false)]);
    } else if (layer) {
      items.push([labels.copy, ICONS.copy, copy]);
      if (clipboard.length) items.push([labels.paste, ICONS.paste, paste]);
      items.push([labels.duplicate, ICONS.duplicate, duplicate], [labels.remove, ICONS.trash, removeLayers], null);
      items.push([labels.toFront, ICONS.forward, () => arrange("front")], [labels.forward, ICONS.forward, () => arrange("forward")], [labels.backward, ICONS.backward, () => arrange("backward")], [labels.toBack, ICONS.backward, () => arrange("back")], null);
      if (multi()) items.push([labels.group, ICONS.group, group]);
      if (picked().some((item) => item.group)) items.push([labels.ungroup, ICONS.ungroup, ungroup]);
      items.push([layer.locked ? labels.unlock : labels.lock, layer.locked ? ICONS.unlock : ICONS.lock, () => lock(layer, !layer.locked)]);
      if (!multi()) items.push([labels.copyStyle, ICONS.copyStyle, () => copyStyle(layer)]);
      if (styleClip) items.push([labels.pasteStyle, ICONS.copyStyle, pasteStyle]);
      if (!multi() && PICTURE_KINDS.has(layer.kind)) items.push([labels.setBackground, ICONS.background, () => setAsBackground(layer)]);
    } else {
      if (clipboard.length) items.push([labels.paste, ICONS.paste, paste]);
      items.push([labels.selectAll, ICONS.select, () => selectMany(visible().map((item) => item.id))]);
    }
    menu.replaceChildren(...items.map((item) => {
      if (!item) {
        const rule = element("span", "ag-menu-rule");
        rule.setAttribute("role", "separator");
        return rule;
      }
      const [text, markup, run] = item;
      const button = keyButton("ag-menu-item", text, markup);
      button.setAttribute("role", "menuitem");
      button.tabIndex = -1;
      button.addEventListener("click", () => {
        closeMenu();
        run();
        if (!document.activeElement || document.activeElement === document.body) overlay.focus({ preventScroll: true });
      });
      return button;
    }));
    menu.hidden = false;
    const stage = host.stage.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(stage.width - menu.offsetWidth - 8, clientX - stage.left))}px`;
    menu.style.top = `${Math.max(8, Math.min(stage.height - menu.offsetHeight - 8, clientY - stage.top))}px`;
    menu.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }
  menu.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll<HTMLElement>("[role=menuitem]")];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      overlay.focus({ preventScroll: true });
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      items[(at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (event.key === "Tab") closeMenu();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!menu.hidden && !menu.contains(event.target as Node)) closeMenu();
  }, { signal: gone.signal });

  // Pop-overs from the bar: one at a time, focused when they open, closed by Escape, by pressing elsewhere, or by
  // focus leaving them.

  let popFor: HTMLElement | null = null;
  let fontWatch: IntersectionObserver | null = null;
  function closePop() {
    if (cropping) {
      cropping = null;
      box.removeAttribute("data-crop");
    }
    fontWatch?.disconnect();
    fontWatch = null;
    pop.hidden = true;
    pop.replaceChildren();
    popFor?.setAttribute("aria-expanded", "false");
    popFor = null;
  }
  /** Opens a pop-over under `anchor`, focused on the control keyed `focus` when it is rebuilt after a change. */
  function openPop(anchor: HTMLElement, name: string, content: HTMLElement[], focus?: string) {
    if (popFor === anchor) return closePop();
    closePop();
    popFor = anchor;
    anchor.setAttribute("aria-expanded", "true");
    pop.setAttribute("aria-label", name);
    pop.replaceChildren(...content);
    pop.hidden = false;
    const stage = host.stage.getBoundingClientRect();
    const at = anchor.getBoundingClientRect();
    pop.style.top = `${at.bottom - stage.top + 6}px`;
    pop.style.left = `${Math.max(8, Math.min(stage.width - pop.offsetWidth - 8, at.left - stage.left))}px`;
    const kept = focus ? [...pop.querySelectorAll<HTMLElement>("[data-pop-key]")].find((node) => node.dataset.popKey === focus) : null;
    (kept ?? pop.querySelector<HTMLElement>("[aria-pressed=true]") ?? pop.querySelector<HTMLElement>("input[type=search], button, input") ?? pop).focus();
  }
  const anchorKey = () => popFor?.dataset.key;
  /** Focus back on the bar's control with this key, wherever the bar was rebuilt. */
  const focusKey = (key: string | undefined) => {
    if (key) toolbar.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
  };
  document.addEventListener("pointerdown", (event) => {
    if (cropping && overlay.contains(event.target as Node)) return;
    if (!pop.hidden && !pop.contains(event.target as Node) && !(popFor?.contains(event.target as Node) ?? false)) closePop();
  }, { signal: gone.signal });
  pop.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    const key = anchorKey();
    closePop();
    focusKey(key);
  });
  pop.addEventListener("focusout", (event) => {
    const next = event.relatedTarget as Node | null;
    if (cropping && next === overlay) return;
    if (next && !pop.contains(next) && !(popFor?.contains(next) ?? false)) closePop();
  });
  toolbar.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!pop.hidden) return closePop();
    select(null);
    overlay.focus({ preventScroll: true });
  });

  const swatch = (color: string, name: string, pressed: boolean, apply: () => void) => {
    const button = element("button", "ag-swatch-key");
    button.type = "button";
    button.setAttribute("aria-label", name);
    button.title = name;
    button.setAttribute("aria-pressed", String(pressed));
    const dot = element("span", "ag-dot");
    dot.style.background = color;
    button.append(dot);
    button.addEventListener("click", apply);
    return button;
  };

  function colourPop(anchor: HTMLElement, current: string | undefined, fallback: "text" | "muted" | "accent", apply: (paint: string) => void) {
    const theme = host.theme();
    const chosen = (current ?? fallback).toLowerCase();
    const pick = (paint: string) => {
      const key = anchorKey();
      apply(paint);
      closePop();
      focusKey(key);
    };
    const heading = (text: string) => {
      const node = element("p", "ag-pop-name");
      node.textContent = text;
      return node;
    };
    const themeRow = element("div", "ag-swatch-row");
    for (const name of ["text", "muted", "accent"] as const) themeRow.append(swatch(theme[name], labels.themeColour(name), chosen === name, () => pick(name)));
    const paletteRow = element("div", "ag-swatch-row");
    PALETTE.forEach((color, index) => paletteRow.append(swatch(color, labels.paletteNames[index] ?? color, chosen === color, () => pick(color))));
    const custom = element("label", "ag-custom-colour");
    const input = element("input", "");
    input.type = "color";
    const resolved = paintOf(current, theme, fallback);
    input.value = /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : "#ffffff";
    input.addEventListener("change", () => pick(input.value));
    const name = element("span", "");
    name.textContent = labels.custom;
    custom.append(input, name);
    openPop(anchor, anchor.getAttribute("aria-label") ?? labels.colour, [heading(labels.themeColours), themeRow, heading(labels.colours), paletteRow, custom]);
  }

  function fontPop(anchor: HTMLElement, layer: Layer) {
    const search = element("input", "ag-input ag-font-search");
    search.type = "search";
    search.placeholder = labels.searchFonts;
    search.setAttribute("aria-label", labels.searchFonts);
    search.autocomplete = "off";
    const list = element("div", "ag-font-list");
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", labels.font);
    const choose = (family: string | undefined) => {
      const key = anchorKey();
      closePop();
      // The font arrives first, so words are measured and saved in it, not in the one standing in for it.
      const apply = () => {
        update(find(layer.id)!, { font: family });
        focusKey(key);
      };
      if (family) void host.loadFont(family, host.textOf(layer)).catch(() => {}).then(apply);
      else apply();
    };
    const options: HTMLButtonElement[] = [];
    const item = (name: string, family: string | undefined) => {
      const button = element("button", "ag-font-item");
      button.type = "button";
      button.setAttribute("role", "option");
      const on = layer.font === family;
      button.setAttribute("aria-selected", String(on));
      button.tabIndex = on ? 0 : -1;
      button.textContent = name;
      button.style.fontFamily = family ? `"${family}", ${host.fontFamily()}` : host.fontFamily();
      if (family) button.dataset.family = family;
      button.addEventListener("click", () => choose(family));
      options.push(button);
      return button;
    };
    list.append(item(labels.defaultFont, undefined));
    const groups = new Map<string, FontChoice[]>();
    for (const font of host.fonts()) groups.set(font.category, [...(groups.get(font.category) ?? []), font]);
    let group = 0;
    for (const [category, fonts] of groups) {
      const wrap = element("div", "ag-font-group");
      wrap.setAttribute("role", "group");
      const name = element("p", "ag-pop-name");
      name.id = `${pop.id}-group-${group++}`;
      name.textContent = category;
      wrap.setAttribute("aria-labelledby", name.id);
      wrap.append(name, ...fonts.map((font) => item(font.name, font.family)));
      list.append(wrap);
    }
    // Arrows move through the fonts on show, Home and End to either end.
    list.addEventListener("keydown", (event) => {
      const shown = options.filter((option) => !option.hidden && !(option.parentElement as HTMLElement).hidden);
      const at = shown.indexOf(document.activeElement as HTMLButtonElement);
      const to = event.key === "ArrowDown" ? at + 1 : event.key === "ArrowUp" ? at - 1 : event.key === "Home" ? 0 : event.key === "End" ? shown.length - 1 : null;
      if (to === null) return;
      event.preventDefault();
      if (to < 0) return search.focus();
      shown[Math.min(shown.length - 1, to)]?.focus();
    });
    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      for (const option of options) option.hidden = Boolean(query) && !option.textContent!.toLowerCase().includes(query);
      list.querySelectorAll<HTMLElement>(".ag-font-group").forEach((wrap) => (wrap.hidden = ![...wrap.querySelectorAll<HTMLElement>(".ag-font-item")].some((option) => !option.hidden)));
    });
    search.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "Enter") return;
      event.preventDefault();
      const first = options.find((option) => !option.hidden && !(option.parentElement as HTMLElement).hidden);
      if (event.key === "Enter") first?.click();
      else first?.focus();
    });
    openPop(anchor, labels.font, [search, list]);
    search.focus();
    // Each font's name shows in that font once it scrolls into view.
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const family = (entry.target as HTMLElement).dataset.family;
        if (entry.isIntersecting && family) {
          watch.unobserve(entry.target);
          void host.loadFont(family, (entry.target as HTMLElement).textContent ?? "").catch(() => {});
        }
      }
    }, { root: list });
    fontWatch = watch;
    list.querySelectorAll<HTMLElement>("[data-family]").forEach((node) => watch.observe(node));
    list.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView({ block: "nearest" });
  }

  /** A slider showing `value` times `scale` (a percent by default), up to `max`. */
  function slider(name: string, value: number, apply: (value: number) => void, { min = 0, max = 100, scale = 100, suffix = "%" } = {}) {
    const label = element("label", "ag-field");
    const head = element("span", "ag-field-head");
    const text = element("span", "ag-field-name");
    text.textContent = name;
    const shown = element("output", "ag-field-value");
    head.append(text, shown);
    const input = element("input", "ag-slider");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    const show = () => {
      shown.textContent = `${input.value}${suffix}`;
      input.setAttribute("aria-valuetext", `${input.value}${suffix}`);
    };
    input.value = String(Math.round(value * scale));
    show();
    input.addEventListener("input", () => {
      show();
      apply(Number(input.value) / scale);
    });
    // A slider's drag is one step to undo, ended when it is let go.
    input.addEventListener("change", () => host.change(host.layers(), true));
    input.dataset.popKey = name;
    label.append(head, input);
    return label;
  }

  /** Exact place, size and turn, in the frame's own pixels, for keyboards and steady hands. */
  function positionFields(layer: Layer) {
    const { width, height } = host.frameSize();
    const grid = element("div", "ag-position");
    const field = (name: string, value: number, apply: (value: number) => Partial<Layer>) => {
      const label = element("label", "ag-field");
      const text = element("span", "ag-field-name");
      text.textContent = name;
      const input = element("input", "ag-input");
      input.type = "number";
      input.value = String(Math.round(value));
      input.addEventListener("change", () => {
        const number = Number(input.value);
        if (Number.isFinite(number)) replaceLayer({ ...find(layer.id)!, ...apply(number) }, true);
      });
      label.append(text, input);
      return label;
    };
    grid.append(
      field(labels.x, layer.x * width, (value) => ({ x: value / width })),
      field(labels.y, layer.y * height, (value) => ({ y: value / height })),
      field(labels.width, layer.w * width, (value) => ({ w: Math.max(4, value) / width })),
      field(labels.height, layer.h * height, (value) => ({ h: Math.max(4, value) / height })),
      field(labels.rotation, layer.rotation, (value) => ({ rotation: ((value % 360) + 360) % 360 })),
    );
    return grid;
  }

  // The pop-over takes its focus with it as it closes; the key that opened it, or the picture once the bar has gone,
  // gets it back unless the action put it somewhere itself.
  const settle = (key: string) => {
    if (!document.activeElement || document.activeElement === document.body) (toolbar.querySelector<HTMLElement>(`[data-key="${key}"]`) ?? overlay).focus({ preventScroll: true });
  };
  /** A key in a pop-over that runs an action and closes it. */
  const act = (key: string, text: string, markup: string, run: () => void) => {
    const button = keyButton("", text, markup);
    button.dataset.popKey = text;
    button.addEventListener("click", () => {
      run();
      closePop();
      settle(key);
    });
    return button;
  };

  /** Arrange, align and, for one layer, its exact place, size and turn. */
  function positionPop(anchor: HTMLElement, layer: Layer) {
    const arrangeKeys = element("div", "ag-pop-actions ag-pop-pair");
    arrangeKeys.append(
      act("position", labels.forward, ICONS.forward, () => arrange("forward")),
      act("position", labels.backward, ICONS.backward, () => arrange("backward")),
      act("position", labels.toFront, ICONS.forward, () => arrange("front")),
      act("position", labels.toBack, ICONS.backward, () => arrange("back")),
    );
    const edges = element("div", "ag-edge-grid");
    for (const [edge, markup] of EDGES) {
      const button = keyButton("", labels.edgeNames[edge], ICONS[markup]);
      button.addEventListener("click", () => {
        if (multi()) alignSelection(edge);
        else {
          const { width, height } = host.frameSize();
          update(find(layer.id)!, alignToPage(find(layer.id)!, edge, width, height));
        }
        settle("position");
      });
      edges.append(button);
    }
    const content: HTMLElement[] = [popName(labels.arrange), arrangeKeys, popName(multi() ? labels.alignSelection : labels.alignPage), edges];
    if (picked().length >= 3) {
      const spread = element("div", "ag-pop-actions ag-pop-pair");
      spread.append(act("position", labels.distributeAcross, ICONS.distributeX, () => distribute("x")), act("position", labels.distributeDown, ICONS.distributeY, () => distribute("y")));
      content.push(popName(labels.distribute), spread);
    }
    if (!multi()) content.push(popName(labels.advanced), positionFields(layer));
    openPop(anchor, labels.positionPanel, content);
  }

  /** Copying, locking, the look to copy, and what else a layer can do. */
  function morePop(anchor: HTMLElement, layer: Layer) {
    const actions = element("div", "ag-pop-actions");
    actions.append(act("more", labels.duplicate, ICONS.duplicate, duplicate), act("more", labels.copy, ICONS.copy, copy));
    if (clipboard.length) actions.append(act("more", labels.paste, ICONS.paste, paste));
    if (multi()) actions.append(act("more", labels.group, ICONS.group, group));
    if (picked().some((item) => item.group)) actions.append(act("more", labels.ungroup, ICONS.ungroup, ungroup));
    if (!multi()) actions.append(act("more", labels.copyStyle, ICONS.copyStyle, () => copyStyle(find(layer.id)!)));
    if (styleClip) actions.append(act("more", labels.pasteStyle, ICONS.copyStyle, pasteStyle));
    actions.append(act("more", labels.lock, ICONS.lock, () => lock(find(layer.id)!, true)));
    if (!multi() && layer.rotation) actions.append(act("more", labels.straighten, ICONS.reset, () => update(find(layer.id)!, { rotation: 0 })));
    if (!multi() && PICTURE_KINDS.has(layer.kind)) actions.append(act("more", labels.setBackground, ICONS.background, () => setAsBackground(find(layer.id)!)));
    openPop(anchor, labels.more, [actions]);
  }

  function transparencyPop(anchor: HTMLElement, layer: Layer) {
    openPop(anchor, labels.transparency, [slider(labels.transparency, layer.opacity ?? 1, (value) => replaceMany(new Map(picked().map((item) => [item.id, { ...item, opacity: value }])), false))]);
  }

  function lock(layer: Layer, locked: boolean) {
    const all = multi() ? picked() : [layer];
    replaceMany(new Map(all.map((item) => [item.id, { ...item, locked }])), true);
    buildToolbar(find(selectedId));
    if (locked) host.announce(labels.locked(all.length === 1 ? host.layerName(layer) : labels.selection(all.length)));
    focusKey(locked ? "unlock" : "more");
  }

  const popName = (text: string) => {
    const node = element("p", "ag-pop-name");
    node.textContent = text;
    return node;
  };

  /** A key that is on or off, for a pop-over. */
  const toggleKey = (text: string, markup: string, on: boolean, run: () => void) => {
    const button = keyButton("", text, markup);
    button.dataset.popKey = text;
    button.setAttribute("aria-pressed", String(on));
    button.addEventListener("click", run);
    return button;
  };
  /** The pop-over control that has focus, to find it again once the pop-over is rebuilt. */
  const popFocus = () => (pop.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.popKey : undefined);

  /** A layer's look for words, one at a time: a shadow, a lift, hollow letters, a splice, an outline, an echo, a
   *  glitch, neon or a colour behind; then the colour the look uses, a curve, and capitals. */
  function effectsPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const set = (change: Partial<Layer>) => {
      const kept = popFocus();
      update(find(layer.id)!, change);
      effectsPop(toolbar.querySelector<HTMLElement>('[data-key="effects"]') ?? anchor, find(layer.id)!, kept);
    };
    const current = layer.shadow ? "shadow" : layer.outline ? "outline" : layer.background ? "background" : layer.effect ?? "none";
    const clear: Partial<Layer> = { shadow: undefined, outline: undefined, background: undefined, effect: undefined };
    const styles = element("div", "ag-chips");
    for (const style of EFFECTS) {
      const change: Partial<Layer> = style === "none" ? clear : style === "shadow" ? { ...clear, shadow: true } : style === "outline" ? { ...clear, outline: layer.outline ?? "#111111" } : style === "background" ? { ...clear, background: layer.background ?? "accent" } : { ...clear, effect: style };
      const chip = toggleKey(labels.effectNames[style], ICONS.effects, current === style, () => set(change));
      chip.classList.add("ag-chip");
      styles.append(chip);
    }
    const content: HTMLElement[] = [popName(labels.effects), styles];
    const tinted = current === "outline" ? "outline" : current === "background" ? "background" : current === "splice" ? "effectColor" : null;
    if (tinted) {
      const row = element("div", "ag-swatch-row");
      const chosen = String(layer[tinted] ?? "").toLowerCase();
      PALETTE.forEach((color, index) => {
        const key = swatch(color, `${labels.effectColour}: ${labels.paletteNames[index] ?? color}`, chosen === color, () => set({ [tinted]: color }));
        key.dataset.popKey = key.getAttribute("aria-label")!;
        row.append(key);
      });
      content.push(popName(labels.effectColour), row);
    }
    if (TYPED_KINDS.has(layer.kind)) {
      content.push(slider(labels.curve, (layer.curve ?? 0) / 100, (value) => replaceLayer({ ...find(layer.id)!, curve: Math.round(value * 100) || undefined }, false), { min: -100, max: 100, suffix: "" }));
    }
    const caps = toggleKey(labels.capitals, ICONS.capitals, Boolean(layer.uppercase), () => set({ uppercase: !layer.uppercase }));
    content.push(caps);
    openPop(anchor, labels.effects, content, focus);
  }

  /** The space between letters and between lines. */
  function spacingPop(anchor: HTMLElement, layer: Layer) {
    openPop(anchor, labels.spacing, [
      slider(labels.letterSpacing, (layer.letterSpacing ?? 0) / 100, (value) => replaceLayer({ ...find(layer.id)!, letterSpacing: Math.round(value * 100) || undefined }, false), { min: -200, max: 800, scale: 100, suffix: "" }),
      slider(labels.lineHeight, layer.lineHeight ?? 1.15, (value) => replaceLayer({ ...find(layer.id)!, lineHeight: value }, false), { min: 50, max: 250, scale: 100, suffix: "%" }),
    ]);
  }

  const chipRow = <T extends string>(values: readonly T[], names: Record<T, string>, current: T, apply: (value: T) => void) => {
    const row = element("div", "ag-chips");
    for (const value of values) {
      const chip = toggleKey(names[value], ICONS.check, current === value, () => apply(value));
      chip.classList.add("ag-chip");
      row.append(chip);
    }
    return row;
  };

  /** A shape's border: its weight, its dashes, its colour and, for a box, its corners. */
  function borderPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const set = (change: Partial<Layer>) => {
      const kept = popFocus();
      update(find(layer.id)!, change);
      borderPop(toolbar.querySelector<HTMLElement>('[data-key="border"]') ?? anchor, find(layer.id)!, kept);
    };
    const content: HTMLElement[] = [
      slider(labels.borderWeight, layer.strokeWidth ?? 0, (value) => replaceLayer({ ...find(layer.id)!, strokeWidth: value || undefined }, false), { max: 40, scale: 1, suffix: " px" }),
      popName(labels.borderStyle),
      chipRow(["solid", "dashed", "dotted"] as const, labels.dashNames, layer.dash ?? "solid", (dash) => set({ dash, strokeWidth: find(layer.id)!.strokeWidth || 6 })),
    ];
    const row = element("div", "ag-swatch-row");
    const chosen = String(layer.stroke ?? "").toLowerCase();
    PALETTE.forEach((color, index) => {
      const key = swatch(color, `${labels.border}: ${labels.paletteNames[index] ?? color}`, chosen === color, () => set({ stroke: color, strokeWidth: find(layer.id)!.strokeWidth || 6 }));
      key.dataset.popKey = key.getAttribute("aria-label")!;
      row.append(key);
    });
    content.push(popName(labels.colour), row);
    if (!layer.shape || layer.shape === "rect") content.push(slider(labels.corners, (layer.radius ?? 0) * 2, (value) => replaceLayer({ ...find(layer.id)!, radius: value / 2 }, false)));
    openPop(anchor, labels.border, content, focus);
  }

  /** A line's weight and dashes, and an arrowhead at either end. */
  function linePop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const set = (change: Partial<Layer>) => {
      const kept = popFocus();
      update(find(layer.id)!, change);
      linePop(toolbar.querySelector<HTMLElement>('[data-key="line"]') ?? anchor, find(layer.id)!, kept);
    };
    const ends = element("div", "ag-pop-actions ag-pop-pair");
    ends.append(
      toggleKey(labels.arrowStart, ICONS.arrowLeft, Boolean(layer.arrowStart), () => set({ arrowStart: !layer.arrowStart })),
      toggleKey(labels.arrowEnd, ICONS.arrowRight, Boolean(layer.arrowEnd), () => set({ arrowEnd: !layer.arrowEnd })),
    );
    openPop(anchor, labels.line, [
      slider(labels.borderWeight, layer.strokeWidth ?? 8, (value) => replaceLayer({ ...find(layer.id)!, strokeWidth: Math.max(1, value) }, false), { max: 40, scale: 1, suffix: " px" }),
      popName(labels.borderStyle),
      chipRow(["solid", "dashed", "dotted"] as const, labels.dashNames, layer.dash ?? "solid", (dash) => set({ dash })),
      ends,
    ], focus);
  }

  /** Cropping: a zoom, and the picture dragged inside its box while this is open. */
  function cropPop(anchor: HTMLElement, layer: Layer) {
    const reset = keyButton("", labels.resetCrop, ICONS.reset);
    reset.addEventListener("click", () => {
      update(find(layer.id)!, { crop: undefined });
      cropPop(toolbar.querySelector<HTMLElement>('[data-key="crop"]') ?? anchor, find(layer.id)!);
    });
    openPop(anchor, labels.crop, [slider(labels.zoom, layer.crop?.zoom ?? 1, (value) => {
      const now = find(layer.id)!;
      replaceLayer({ ...now, crop: { x: 0, y: 0, ...now.crop, zoom: Math.max(1, value) } }, false);
    }, { min: 100, max: 400, scale: 100, suffix: "%" }), reset]);
    // Opening the pop-over closes any other, which ends a crop, so the crop starts once it is open.
    cropping = layer.id;
    box.toggleAttribute("data-crop", true);
  }

  /** The shape a picture is cut to. */
  function framePop(anchor: HTMLElement, layer: Layer) {
    const shapes = element("div", "ag-chips");
    for (const shape of FRAMES) {
      const chip = toggleKey(labels.frameNames[shape], ICONS.check, (layer.mask ?? "none") === shape, () => {
        update(find(layer.id)!, { mask: shape === "none" ? undefined : shape });
        closePop();
        focusKey("frame");
      });
      chip.classList.add("ag-chip");
      shapes.append(chip);
    }
    openPop(anchor, labels.frame, [shapes]);
  }

  /** A ready-made look for a picture. */
  function filtersPop(anchor: HTMLElement, layer: Layer) {
    const looks = element("div", "ag-chips");
    for (const name of ["original", ...Object.keys(FILTERS)]) {
      const chip = toggleKey(name === "original" ? labels.original : labels.filterNames[name] ?? name, ICONS.check, (layer.filter ?? "original") === name, () => {
        update(find(layer.id)!, { filter: name === "original" ? undefined : name });
        closePop();
        focusKey("filters");
      });
      chip.classList.add("ag-chip");
      looks.append(chip);
    }
    openPop(anchor, labels.filters, [looks]);
  }

  /** How a layer comes in, and the stretch of the clip it shows for. */
  function animatePop(anchor: HTMLElement, layer: Layer, focus?: string) {
    // With several layers picked, each change reaches all of them.
    const live = (change: Partial<Layer>) => replaceMany(new Map(picked().map((item) => [item.id, { ...item, ...change }])), false);
    const set = (change: Partial<Layer>) => {
      const kept = popFocus();
      updateAll(() => change);
      animatePop(toolbar.querySelector<HTMLElement>('[data-key="animate"]') ?? anchor, find(layer.id)!, kept);
    };
    const ways = (list: Entrance[], current: Entrance | undefined, field: "enter" | "exit") => {
      const row = element("div", "ag-chips");
      const none = toggleKey(labels.none, ICONS.remove, !current, () => set({ [field]: undefined }));
      none.dataset.popKey = `${field}:none`;
      none.classList.add("ag-chip");
      row.append(none);
      for (const way of list) {
        if (way === "typewriter" && !TYPEWRITER_KINDS.has(layer.kind)) continue;
        const chip = toggleKey(labels.enterNames[way], ICONS.animate, current === way, () => set({ [field]: way }));
        chip.dataset.popKey = `${field}:${way}`;
        chip.classList.add("ag-chip");
        row.append(chip);
      }
      return row;
    };
    const loops = element("div", "ag-chips");
    const still = toggleKey(labels.none, ICONS.remove, !layer.loop, () => set({ loop: undefined }));
    still.dataset.popKey = "loop:none";
    still.classList.add("ag-chip");
    loops.append(still);
    for (const loop of LOOPS) {
      const chip = toggleKey(labels.loopNames[loop], ICONS.animate, layer.loop === loop, () => set({ loop }));
      chip.dataset.popKey = `loop:${loop}`;
      chip.classList.add("ag-chip");
      loops.append(chip);
    }
    const times = element("div", "ag-position ag-times");
    const timeField = (name: string, field: "from" | "until") => {
      const label = element("label", "ag-field");
      const text = element("span", "ag-field-name");
      text.textContent = name;
      const row = element("span", "ag-time-row");
      // A plain text field: a phone's number pad has no colon for minutes and seconds.
      const input = element("input", "ag-input");
      input.type = "text";
      input.placeholder = labels.wholeClip;
      input.dataset.popKey = `${field}:time`;
      const value = layer[field];
      input.value = value === undefined ? "" : formatTime(value);
      input.title = labels.timeHint;
      // Each readable time takes effect as it is typed, so a click away keeps it; leaving the field ends the step.
      input.addEventListener("input", () => {
        const typed = input.value.trim();
        const seconds = typed ? parseTime(typed) : undefined;
        if (seconds !== undefined && !Number.isFinite(seconds)) return;
        live({ [field]: seconds === undefined ? undefined : Math.max(0, seconds) });
      });
      input.addEventListener("change", () => host.change(host.layers(), true));
      const now = keyButton("", labels.playhead, ICONS.clock);
      now.dataset.popKey = `${field}:now`;
      now.addEventListener("click", () => set({ [field]: Math.max(0, Math.round(host.time() * 10) / 10) }));
      row.append(input, now);
      label.append(text, row);
      return label;
    };
    times.append(timeField(labels.showFrom, "from"), timeField(labels.showUntil, "until"));
    const whole = keyButton("", labels.wholeClip, ICONS.fit);
    whole.dataset.popKey = "whole";
    whole.addEventListener("click", () => set({ from: undefined, until: undefined }));
    const speed = slider(labels.speed, layer.speed ?? 1, (value) => live({ speed: value === 1 ? undefined : value }), { min: 25, max: 200, scale: 100, suffix: "%" });
    openPop(anchor, labels.animate, [popName(labels.in), ways(ENTRANCES, layer.enter, "enter"), popName(labels.out), ways(EXITS, layer.exit, "exit"), popName(labels.loopName), loops, speed, popName(labels.timing), times, whole], focus);
  }

  function flipPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const set = (change: Partial<Layer>) => {
      const kept = popFocus();
      update(find(layer.id)!, change);
      flipPop(toolbar.querySelector<HTMLElement>('[data-key="flip"]') ?? anchor, find(layer.id)!, kept);
    };
    const keys = element("div", "ag-pop-actions");
    keys.append(
      toggleKey(labels.flipX, ICONS.flip, Boolean(layer.flipX), () => set({ flipX: !layer.flipX })),
      toggleKey(labels.flipY, ICONS.flip, Boolean(layer.flipY), () => set({ flipY: !layer.flipY })),
    );
    openPop(anchor, labels.flip, [keys], focus);
  }

  /** Brightness, contrast and colour as percents of the picture's own, and a blur in pixels. */
  function adjustPop(anchor: HTMLElement, layer: Layer) {
    const tone = { brightness: 1, contrast: 1, saturation: 1, blur: 0, ...layer.adjust };
    const set = (name: keyof typeof tone, value: number) => {
      const current = find(layer.id)!;
      replaceLayer({ ...current, adjust: { ...current.adjust, [name]: value } }, false);
    };
    const reset = keyButton("", labels.resetAdjust, ICONS.reset);
    reset.addEventListener("click", () => {
      update(find(layer.id)!, { adjust: undefined });
      closePop();
      focusKey("adjust");
    });
    openPop(anchor, labels.adjust, [
      slider(labels.brightness, tone.brightness, (value) => set("brightness", value), { max: 200 }),
      slider(labels.contrast, tone.contrast, (value) => set("contrast", value), { max: 200 }),
      slider(labels.saturation, tone.saturation, (value) => set("saturation", value), { max: 200 }),
      slider(labels.blur, tone.blur, (value) => set("blur", value), { max: 20, scale: 1, suffix: " px" }),
      reset,
    ]);
  }

  function stylePop(anchor: HTMLElement, layer: Layer) {
    const keys = element("div", "ag-pop-actions");
    for (const look of ["bars", "wave", "pulse"] as Visual[]) {
      keys.append(toggleKey(labels.visualNames[look], ICONS[look], (layer.visual ?? "") === look, () => {
        update(find(layer.id)!, { visual: look });
        closePop();
        focusKey("style");
      }));
    }
    openPop(anchor, labels.style, [keys]);
  }

  /** A key on the bar with a swatch for its icon and its name beside it. */
  function colourKey(key: string, name: string, color: string, open: (anchor: HTMLButtonElement) => void) {
    const button = keyButton("ag-colour-key", name, "");
    button.querySelector("svg")?.remove();
    const dot = element("span", "ag-dot");
    dot.style.background = color;
    button.prepend(dot);
    button.dataset.key = key;
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", pop.id);
    button.addEventListener("click", () => open(button));
    return button;
  }

  function buildToolbar(layer: Layer | null) {
    const active = toolbar.contains(document.activeElement) ? (document.activeElement as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset.key : undefined;
    closePop();
    toolbar.replaceChildren();
    toolbarFor = layer ? JSON.stringify(layer) : "";
    if (!layer) return;
    const theme = host.theme();
    toolbar.setAttribute("aria-label", labels.options(host.layerName(layer)));
    const keyed = <T extends HTMLElement>(node: T, key: string) => {
      node.dataset.key = key;
      return node;
    };
    const popKey = (key: string, text: string, markup: string, open: (anchor: HTMLElement, layer: Layer) => void) => {
      const button = keyed(keyButton("", text, markup), key);
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", pop.id);
      button.addEventListener("click", () => open(button, find(layer.id)!));
      return button;
    };
    const iconKey = (key: string, text: string, markup: string, run: () => void, pressed?: boolean) => {
      const button = keyed(iconButton("", text, markup), key);
      button.title = text;
      if (pressed !== undefined) button.setAttribute("aria-pressed", String(pressed));
      button.addEventListener("click", run);
      return button;
    };
    const tail = () => {
      toolbar.append(
        popKey("position", labels.positionPanel, ICONS.position, positionPop),
        keyed(popIcon("transparency", labels.transparency, ICONS.transparency, transparencyPop), "transparency"),
        popKey("more", labels.more, ICONS.more, morePop),
        iconKey("remove", labels.remove, ICONS.trash, removeLayers),
      );
      nameKeys();
      focusKey(active);
    };
    // On a narrow stage some keys show only their icons, so each keeps its name for screen readers and as a tooltip.
    const nameKeys = () => {
      for (const key of toolbar.querySelectorAll<HTMLElement>(".ag-key")) {
        const text = key.querySelector(".ag-key-text")?.textContent ?? "";
        if (!key.hasAttribute("aria-label") && text) key.setAttribute("aria-label", text);
        if (!key.title) key.title = key.getAttribute("aria-label") ?? text;
      }
    };
    const popIcon = (key: string, text: string, markup: string, open: (anchor: HTMLElement, layer: Layer) => void) => {
      const button = keyed(iconButton("", text, markup), key);
      button.title = text;
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", pop.id);
      button.addEventListener("click", () => open(button, find(layer.id)!));
      return button;
    };
    if (layer.locked || picked().some((item) => item.locked)) {
      const unlock = keyed(keyButton("", labels.unlock, ICONS.unlock), "unlock");
      unlock.addEventListener("click", () => lock(find(layer.id)!, false));
      toolbar.append(unlock);
      focusKey(active);
      return;
    }
    if (multi()) {
      // Several layers: what applies to all of them at once.
      toolbar.setAttribute("aria-label", labels.options(labels.selection(picked().length)));
      const name = element("span", "ag-size-name");
      name.textContent = labels.selection(picked().length);
      const together = picked().every((item) => item.group && item.group === picked()[0].group);
      const groupKey = keyed(keyButton("", together ? labels.ungroup : labels.group, together ? ICONS.ungroup : ICONS.group), "group");
      groupKey.addEventListener("click", () => (together ? ungroup() : group()));
      toolbar.append(name, groupKey, popKey("animate", labels.animate, ICONS.animate, animatePop));
      return tail();
    }
    if (TEXT_KINDS.has(layer.kind)) {
      const font = host.fonts().find((item) => item.family === layer.font);
      const fontKey = keyed(keyButton("ag-font-key", font?.name ?? labels.defaultFont, ICONS.text), "font");
      fontKey.setAttribute("aria-haspopup", "dialog");
      fontKey.setAttribute("aria-expanded", "false");
      fontKey.setAttribute("aria-controls", pop.id);
      fontKey.setAttribute("aria-label", `${labels.font}: ${font?.name ?? labels.defaultFont}`);
      fontKey.addEventListener("click", () => fontPop(fontKey, find(layer.id)!));
      const sizeGroup = element("div", "ag-size");
      const sizeName = element("span", "ag-size-name");
      sizeName.textContent = labels.size;
      sizeName.setAttribute("aria-hidden", "true");
      const smaller = keyed(iconButton("", labels.smaller, ICONS.minus), "smaller");
      const larger = keyed(iconButton("", labels.larger, ICONS.add), "larger");
      const sizeInput = keyed(element("input", "ag-input ag-size-input"), "size");
      sizeInput.type = "number";
      sizeInput.min = "8";
      sizeInput.max = "400";
      sizeInput.value = String(Math.round(layer.size ?? 40));
      sizeInput.setAttribute("aria-label", labels.size);
      const setSize = (value: number) => update(find(layer.id)!, { size: Math.min(400, Math.max(8, Math.round(value))) });
      smaller.addEventListener("click", () => setSize((find(layer.id)!.size ?? 40) - 2));
      larger.addEventListener("click", () => setSize((find(layer.id)!.size ?? 40) + 2));
      sizeInput.addEventListener("change", () => setSize(Number(sizeInput.value) || 40));
      sizeGroup.append(sizeName, smaller, sizeInput, larger);
      const weight = layer.weight ?? (layer.kind === "title" ? 700 : layer.kind === "captions" ? 650 : 400);
      const strong = weight >= 600;
      // A font with no heavier or slanted files would be faked by each browser its own way, so those keys rest.
      const canBold = !font || heaviest(font) >= 600;
      const canItalic = !font || font.files.some((file) => file.style === "italic");
      const glyph = (key: string, text: string, label: string, pressed: boolean, allowed: boolean, missing: string, run: () => void) => {
        const button = keyed(element("button", `ag-btn ag-glyph${key === "italic" ? " ag-italic" : ""}`), key);
        button.type = "button";
        button.textContent = text;
        button.setAttribute("aria-label", label);
        button.title = allowed ? label : missing;
        button.setAttribute("aria-pressed", String(pressed));
        if (!allowed && !pressed) button.setAttribute("aria-disabled", "true");
        button.addEventListener("click", () => (allowed || pressed) && run());
        return button;
      };
      const bold = glyph("bold", "B", labels.bold, strong, canBold, labels.boldMissing, () => update(find(layer.id)!, { weight: strong ? 400 : 700 }));
      const italic = glyph("italic", "I", labels.italic, Boolean(layer.italic), canItalic, labels.italicMissing, () => update(find(layer.id)!, { italic: !find(layer.id)!.italic }));
      const underline = glyph("underline", "U", labels.underline, Boolean(layer.underline), true, "", () => update(find(layer.id)!, { underline: !find(layer.id)!.underline }));
      underline.classList.add("ag-underline");
      const strike = glyph("strike", "S", labels.strike, Boolean(layer.strike), true, "", () => update(find(layer.id)!, { strike: !find(layer.id)!.strike }));
      strike.classList.add("ag-strike");
      const quiet = layer.kind === "handle" || layer.kind === "links" || layer.kind === "time";
      const colour = colourKey("colour", labels.colour, paintOf(layer.color, theme, quiet ? "muted" : "text"), (anchor) => colourPop(anchor, layer.color, quiet ? "muted" : "text", (paint) => update(find(layer.id)!, { color: paint })));
      toolbar.append(fontKey, sizeGroup, colour, bold, italic, underline, strike);
      if (layer.kind === "captions") {
        toolbar.append(colourKey("highlight", labels.highlight, paintOf(layer.highlight, theme, "accent"), (anchor) => colourPop(anchor, layer.highlight, "accent", (paint) => update(find(layer.id)!, { highlight: paint }))));
      }
      const order = ["left", "center", "right"] as const;
      const align = layer.align ?? "left";
      const alignKey = iconKey("align", `${labels.align}: ${labels.alignNames[align]}`, ALIGN_ICONS[align], () => update(find(layer.id)!, { align: order[(order.indexOf(align) + 1) % order.length] }));
      toolbar.append(alignKey);
      if (layer.kind === "text") {
        const lists = ["none", "bullet", "number"] as const;
        const list = layer.list ?? "none";
        toolbar.append(iconKey("list", `${labels.list}: ${labels.listNames[list]}`, list === "number" ? ICONS.listNumbers : ICONS.list, () => {
          const next = lists[(lists.indexOf(list) + 1) % lists.length];
          update(find(layer.id)!, { list: next === "none" ? undefined : next });
        }, list !== "none"));
      }
      toolbar.append(popIcon("spacing", labels.spacing, ICONS.spacing, spacingPop), popKey("effects", labels.effects, ICONS.effects, effectsPop));
    } else if (layer.kind === "shape" && layer.shape === "line") {
      toolbar.append(colourKey("fill", labels.fill, paintOf(layer.fill, theme, "accent"), (anchor) => colourPop(anchor, layer.fill, "accent", (paint) => update(find(layer.id)!, { fill: paint }))), popKey("line", labels.line, ICONS.shapeLine, linePop));
    } else if (layer.kind === "shape" || layer.kind === "visual" || layer.kind === "graphic") {
      const property = layer.kind === "shape" ? "fill" : "color";
      const fallback = layer.kind === "graphic" ? "text" : "accent";
      const mono = layer.kind !== "graphic" || (layer.art?.paths.some((part) => part.fill === "currentColor" || part.stroke === "currentColor") ?? false);
      if (mono) toolbar.append(colourKey("fill", labels.fill, paintOf(layer[property], theme, fallback), (anchor) => colourPop(anchor, layer[property], fallback, (paint) => update(find(layer.id)!, { [property]: paint } as Partial<Layer>))));
      if (layer.kind === "shape") toolbar.append(popKey("border", labels.border, ICONS.border, borderPop));
      if (layer.kind === "visual") toolbar.append(popKey("style", labels.style, ICONS[layer.visual ?? "bars"], stylePop));
      if (layer.kind === "graphic") toolbar.append(popKey("flip", labels.flip, ICONS.flip, flipPop));
    } else if (layer.kind === "image" || layer.kind === "avatar") {
      const swap = keyed(keyButton("", labels.replace, ICONS.photo), "replace");
      swap.addEventListener("click", () => host.replace(find(layer.id)!));
      toolbar.append(swap);
    }
    if (PICTURE_KINDS.has(layer.kind)) {
      if (layer.image) toolbar.append(popKey("crop", labels.crop, ICONS.crop, cropPop));
      toolbar.append(popKey("frame", labels.frame, ICONS.frame, framePop), popKey("filters", labels.filters, ICONS.filters, filtersPop), popKey("adjust", labels.adjust, ICONS.adjust, adjustPop), popKey("flip", labels.flip, ICONS.flip, flipPop));
    }
    toolbar.append(popKey("animate", labels.animate, ICONS.animate, animatePop));
    tail();
  }

  /** Picks one layer, with the rest of its group. */
  function select(id: string | null) {
    if (editing && id !== editing) finishTyping(false);
    const layer = find(id);
    const group = layer?.group ? host.layers().filter((item) => item.group === layer.group && item.id !== layer.id && !item.hidden).map((item) => item.id) : [];
    const changed = id !== selectedId || group.join() !== others.join();
    selectedId = id;
    others = group;
    hover.hidden = true;
    if (!id || changed) {
      cropping = null;
      box.removeAttribute("data-crop");
    }
    if (changed) {
      buildToolbar(layer);
      if (layer) host.announce(group.length ? labels.selection(group.length + 1) : labels.selected(host.layerName(layer)));
    }
    draw();
  }

  /** Picks several layers at once, the last of them leading. */
  function selectMany(ids: string[]) {
    const unique = [...new Set(ids)].filter((id) => find(id));
    if (unique.length <= 1) return select(unique[0] ?? null);
    if (editing) finishTyping(false);
    selectedId = unique[unique.length - 1];
    others = unique.slice(0, -1);
    cropping = null;
    box.removeAttribute("data-crop");
    buildToolbar(find(selectedId));
    host.announce(labels.selection(unique.length));
    draw();
  }

  /** Adds a layer and its group to the selection, or takes them out. */
  function toggle(id: string) {
    const layer = find(id);
    if (!layer) return;
    const group = layer.group ? host.layers().filter((item) => item.group === layer.group && !item.hidden).map((item) => item.id) : [id];
    const now = picked().map((item) => item.id);
    const has = now.includes(id);
    selectMany(has ? now.filter((item) => !group.includes(item)) : [...now, ...group.filter((item) => item !== id), id]);
  }

  new ResizeObserver(draw).observe(host.stage);

  return {
    get selected() {
      return find(selectedId);
    },
    select,
    refresh() {
      const layer = find(selectedId);
      others = others.filter((id) => find(id) && !find(id)!.hidden);
      if (selectedId && (!layer || layer.hidden)) {
        selectedId = null;
        others = [];
        buildToolbar(null);
      } else if (layer && !gesture && !changing && JSON.stringify(layer) !== toolbarFor) {
        // Changed from elsewhere, as by undo: the bar, and any pop-over showing the layer as it was, are built again.
        buildToolbar(layer);
      }
      draw();
    },
    editText,
    focus() {
      overlay.focus({ preventScroll: true });
    },
    destroy() {
      gone.abort();
    },
  };
}
