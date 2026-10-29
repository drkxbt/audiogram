/* Free editing on the picture, the way a design tool does it: press a layer to select it, drag it (it snaps to the
   frame's middle and edges and to other layers), pull a handle to size it, the round handle to turn it, press selected
   words again to type them, and use the bar above the picture for the font, the size, the colour and the rest. With the
   keyboard, Tab steps through the layers on the picture and Enter types into words. */

import { formatTime, parseTime } from "./captions.js";
import { alignToPage, DIRECTED, entranceLength, isBackgroundLayer, layerAt, moveLayer, pageCovers, resizeTurned, rotateLayer, snapMove, type Ambient, type Box, type ChartKind, type Clock, type Device, type Direction, type Entrance, type Guide, type Solid, type Handle, type Layer, type Loop, type PageEdge, type ShapeKind, type TextEffect } from "./layers.js";
import { colourPanel, COLOUR_LABELS, type ColourLabels } from "./colour.js";
import { FILTERS, metalCss, paintOf, type Theme, type Visual } from "./render.js";
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
  /** The colour picker's own words. */
  colourPicker?: ColourLabels;
  back: string;
  borderColour: string;
  showAgain: string;
  /** Charts, tables, mockups, 3D shapes and moving backgrounds. */
  chartType: string;
  chartNames: Record<ChartKind, string>;
  data: string;
  label: string;
  value: string;
  addRow: string;
  removeRow: (row: number) => string;
  pasteRows: string;
  pasteHint: string;
  pasteCellsHint: string;
  chartOptions: string;
  showLabels: string;
  showValues: string;
  showGrid: string;
  prefix: string;
  suffix: string;
  outOf: string;
  wordsColour: string;
  table: string;
  cells: string;
  cell: (row: number, column: number) => string;
  addColumn: string;
  removeColumn: string;
  removeLastRow: string;
  headerRow: string;
  stripes: string;
  rules: string;
  ruleNames: Record<"none" | "rows" | "grid", string>;
  device: string;
  deviceNames: Record<Device, string>;
  caption: string;
  addPhoto: string;
  form: string;
  solidNames: Record<Solid, string>;
  gloss: string;
  groundShadow: string;
  ambientStyle: string;
  ambientNames: Record<Ambient, string>;
  ground: string;
  light: string;
  secondLight: string;
  pace: string;
  withVoice: string;
  backgroundSet: string;
  backgroundPanelsHidden: string;
  detachBackground: string;
  fitText: string;
  options: (layer: string) => string;
  typing: (layer: string) => string;
  selected: (layer: string) => string;
  hidden: (layer: string) => string;
  deleted: (layer: string) => string;
  duplicated: (layer: string) => string;
  effects: string;
  shadow: string;
  /** Shapes: frosted glass, how much of what lies under them is blurred. */
  frost: string;
  /** Time layers: what the clock shows, and each way it can. */
  clock: string;
  clockNames: Record<Clock, string>;
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
  preview: string;
  noAnimation: string;
  recommended: string;
  basic: string;
  exaggerated: string;
  words: string;
  emphasis: string;
  direction: string;
  directionNames: Record<Direction, string>;
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
  /** The colours the design already uses, offered first in the colour picker. */
  documentColours?(): string[];
  /** A mockup's box for another device: its middle and height kept, its width from the device's shape. */
  deviceBox?(layer: Layer, device: Device): Partial<Layer>;
  /** A sound layer's change to another look, its box refitted when it goes between a ring and a strip. */
  soundLook?(layer: Layer, look: Visual): Partial<Layer>;
  /** Plays the way in, the way out or the loop of some layers once on the picture, the rest held still. */
  rehearse?(ids: string[], part: "enter" | "exit" | "loop"): void;
  /** Shows a message where the user can see it, with a key that undoes or follows up what just happened. */
  notify?(message: string, action?: { label: string; run(): void }): void;
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
  /** The topmost layer under a point on the screen, as a drop or a press there would find it. */
  layerAtClient(clientX: number, clientY: number): Layer | null;
}

const TEXT_KINDS = new Set(["name", "handle", "title", "links", "time", "text", "captions"]);
const TYPED_KINDS = new Set(["name", "handle", "title", "text"]);
const SINGLE_LINE = new Set(["name", "handle"]);
// Words that can be typed in a letter at a time: everything with words but the captions, which keep their own timing.
const TYPEWRITER_KINDS = new Set(["name", "handle", "title", "links", "time", "text"]);
const PICTURE_KINDS = new Set(["image", "video"]);
const EDGES: Array<[PageEdge, keyof typeof ICONS]> = [["left", "alignLeft"], ["center", "alignCenter"], ["right", "alignRight"], ["top", "alignTop"], ["middle", "alignMiddle"], ["bottom", "alignBottom"]];
// The Animate panel's groups. Slide is Pan by another name, so only Pan is offered.
const BASIC_WAYS: Entrance[] = ["fade", "rise", "pan", "wipe", "blur", "zoom", "drift", "baseline", "breathe", "clarify", "glide", "iris", "curtain", "unfold"];
const LIVELY_WAYS: Entrance[] = ["pop", "elastic", "bounce", "stomp", "tumble", "roll", "skate", "flip", "fall", "tectonic", "scrapbook", "flicker"];
const WORD_WAYS: Entrance[] = ["typewriter", "ascend", "shift", "merge", "burst", "cascade", "spread", "block", "shine"];
const LOOPS: Loop[] = ["pulse", "heartbeat", "wiggle", "sway", "float", "rotate", "shimmer", "flash", "slowZoom"];

/** The six ways in that suit a kind of layer best, shown first. */
function recommendedFor(kind: Layer["kind"]): Entrance[] {
  if (TYPEWRITER_KINDS.has(kind)) return ["ascend", "typewriter", "glide", "block", "rise", "fade"];
  if (PICTURE_KINDS.has(kind) || kind === "avatar" || kind === "mockup") return ["glide", "fade", "iris", "curtain", "pan", "clarify"];
  if (kind === "chart" || kind === "table") return ["grow", "fade", "rise", "wipe", "pop", "unfold"];
  if (kind === "visual" || kind === "captions") return ["fade", "rise", "wipe", "unfold", "pop", "glide"];
  return ["pop", "elastic", "iris", "fade", "roll", "wipe"];
}
const EFFECTS = ["none", "shadow", "lift", "hollow", "splice", "outline", "echo", "glitch", "neon", "background"] as const;
const FRAMES: Array<"none" | ShapeKind> = ["none", "ellipse", "rect", "squircle", "arch", "blob", "burst", "cloud", "hexagon", "diamond", "star", "heart", "triangle", "bubble"];
// What Copy style carries from one layer to another: its look, not its place or its words.
const STYLE_KEYS = ["font", "size", "weight", "italic", "color", "highlight", "align", "shadow", "outline", "background", "uppercase", "effect", "effectColor", "underline", "strike", "letterSpacing", "lineHeight", "list", "fill", "stroke", "strokeWidth", "dash", "radius", "frost", "opacity", "filter", "adjust", "clock"] as const;
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
// The colours of layers the picker can set; all take a metal finish but the captions' highlight, whose words take
// black or white by how light it is.
type PaintField = "color" | "highlight" | "fill" | "stroke" | "outline" | "background" | "effectColor";
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
// The Animate panel opens on the tab last used.
let animateTab: "enter" | "exit" | "loop" = "enter";
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
      // Too small for side handles: the corners are enough, and easier to hit. Words have no top and bottom handles,
      // so only their width counts.
      box.toggleAttribute("data-small", layer.w * width < 48 || (!TEXT_KINDS.has(layer.kind) && layer.h * height < 48));
      // The background fills the page and stays put: no handles to pull or turn.
      box.toggleAttribute("data-backdrop", layer.backdrop === true);
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
      // A drag from the empty page, or from the background, draws a box round the layers to pick.
      if ((!start || start.backdrop) && event.pointerType !== "touch") {
        gesture = { kind: "marquee", pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: null as unknown as Layer, moved: false, wasSelected: false, from: point };
        capture(event);
        return;
      }
    }
    // A locked layer is picked, to be unlocked, but stays where it is; so does the background.
    if (!start || start.locked || (start.backdrop && kind !== "group") || (kind === "group" && picked().some((layer) => layer.locked))) return;
    gesture = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, start, handle: kind === "resize" ? (handle as Handle) : undefined, moved: false, wasSelected: current?.id === start.id, starts: kind === "group" ? picked().filter((layer) => !layer.backdrop) : undefined };
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
      hover.hidden = !under || under.id === selectedId || under.backdrop === true;
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
      if (corner && TEXT_KINDS.has(start.kind) && start.size) next = { ...next, size: Math.min(400, Math.max(8, Math.round(start.size * (next.w / start.w)))) };
      if (!corner && start.kind === "text") next = { ...next, autoWidth: false };
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
        if (layer.backdrop) return false;
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
      replaceMany(new Map(picked().filter((item) => !item.backdrop).map((item) => [item.id, { ...item, ...moveLayer(item, dx / width, dy / height) }])), false);
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
    typing.style.letterSpacing = layer.letterSpacing ? `${((layer.letterSpacing / 1000) * px) / scale}px` : "";
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
      captionsOff(layer.id, name);
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
    if (lastCaptions) captionsOff(lastCaptions.id, host.layerName(lastCaptions));
    else host.announce(labels.deleted(labels.selection(leaving.length)));
    select(null);
    overlay.focus({ preventScroll: true });
  }

  /** The captions have gone from the picture: say so on screen, with a key that shows them again on top. */
  function captionsOff(id: string, name: string) {
    const back = () => {
      const layer = find(id);
      if (!layer) return;
      host.change([...host.layers().filter((item) => item.id !== id), { ...layer, hidden: false }], true);
      select(id);
    };
    if (host.notify) host.notify(labels.hidden(name), { label: labels.showAgain, run: back });
    else host.announce(labels.hidden(name));
  }

  /** Copies of `layers` moved a little down and right, with new ids and a new group for each group among them. */
  function twins(layers: Layer[]): Layer[] {
    const groups = new Map<string, string>();
    return layers.map((layer) => {
      const group = layer.group ? (groups.get(layer.group) ?? groups.set(layer.group, newId("group")).get(layer.group)) : undefined;
      return { ...moveLayer(layer, 0.03, 0.03), id: newId(layer.kind), hidden: false, locked: false, backdrop: undefined, group };
    });
  }

  /** Copies of the picked layers, on top of everything, in the order they were in; the copies are picked. */
  function duplicate() {
    const order = host.layers().map((item) => item.id);
    const originals = picked().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    if (!originals.length) return;
    const copies = twins(originals);
    host.change([...host.layers(), ...copies], true);
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

  /**
   * A picture or video stretched over the whole page and sent to the back, in place of any background before it. A
   * template's panel that covers most of the page would hide it, so such a panel is put away in the same step, and the
   * notice says where it went.
   */
  function setAsBackground(layer: Layer) {
    const full: Layer = { ...layer, x: 0, y: 0, w: 1, h: 1, rotation: 0, radius: 0, mask: undefined, crop: undefined, backdrop: true, locked: false };
    let covered = 0;
    const rest = host.layers()
      .filter((item, index) => item.id !== layer.id && !(index === 0 && isBackgroundLayer(item)) && !item.backdrop)
      .map((item) => (pageCovers(item) ? (covered++, { ...item, hidden: true }) : item));
    host.change([full, ...rest], true);
    buildToolbar(find(layer.id));
    draw();
    const message = covered ? labels.backgroundPanelsHidden : labels.backgroundSet;
    if (host.notify) host.notify(message);
    else host.announce(message);
  }

  /** The background let go of, as an ordinary picture that can be moved and stacked. */
  function detachBackground(layer: Layer) {
    update(layer, { backdrop: undefined });
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
      if (layer.backdrop && !multi()) items.push([labels.detachBackground, ICONS.background, () => detachBackground(layer)], null);
      else items.push([labels.toFront, ICONS.forward, () => arrange("front")], [labels.forward, ICONS.forward, () => arrange("forward")], [labels.backward, ICONS.backward, () => arrange("backward")], [labels.toBack, ICONS.backward, () => arrange("back")], null);
      if (multi()) items.push([labels.group, ICONS.group, group]);
      if (picked().some((item) => item.group)) items.push([labels.ungroup, ICONS.ungroup, ungroup]);
      items.push([layer.locked ? labels.unlock : labels.lock, layer.locked ? ICONS.unlock : ICONS.lock, () => lock(layer, !layer.locked)]);
      if (!multi()) items.push([labels.copyStyle, ICONS.copyStyle, () => copyStyle(layer)]);
      if (styleClip) items.push([labels.pasteStyle, ICONS.copyStyle, pasteStyle]);
      if (!multi() && PICTURE_KINDS.has(layer.kind) && !layer.backdrop) items.push([labels.setBackground, ICONS.background, () => setAsBackground(layer)]);
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
    pop.removeAttribute("data-wide");
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
  function openPop(anchor: HTMLElement, name: string, content: HTMLElement[], focus?: string, wide = false) {
    if (popFor === anchor) return closePop();
    closePop();
    popFor = anchor;
    anchor.setAttribute("aria-expanded", "true");
    pop.setAttribute("aria-label", name);
    pop.replaceChildren(...content);
    // Widened before it is measured, so it is kept inside the stage at its real width.
    pop.toggleAttribute("data-wide", wide);
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

  /** How a colour shows on a key: a metal as its gradient, a theme name as the theme's colour. */
  const swatchFill = (paint: string | undefined, fallback: "text" | "muted" | "accent") => metalCss(paint ?? "") ?? paintOf(paint, host.theme(), fallback);

  /**
   * The colour picker for one colour of the picked layers. A swatch takes effect at once and closes it, or goes back to
   * the panel it was opened from; a shade dragged on the square shows as it moves and is kept as one step when let go.
   * `also` adds to each change, such as a border weight for a border that had none.
   */
  function colourPop(anchor: HTMLElement, layer: Layer, field: PaintField, fallback: "text" | "muted" | "accent", options: { also?: () => Partial<Layer>; back?: () => void } = {}) {
    const change = (paint: string): Partial<Layer> => ({ [field]: paint, ...options.also?.() });
    const content: HTMLElement[] = [];
    if (options.back) {
      const back = keyButton("ag-pop-back", labels.back, ICONS.previous);
      back.addEventListener("click", () => options.back?.());
      content.push(back);
    }
    content.push(colourPanel({
      current: layer[field] ?? fallback,
      theme: host.theme(),
      used: host.documentColours?.() ?? [],
      themeColours: true,
      metals: field !== "highlight",
      labels: labels.colourPicker ?? COLOUR_LABELS,
      onPick: (choice, done, custom) => {
        if (typeof choice !== "string") return;
        if (done && !custom) {
          const key = anchorKey();
          updateAll(() => change(choice));
          if (options.back) options.back();
          else {
            closePop();
            focusKey(key);
          }
          return;
        }
        // A shade from the square: shown on the layers as it moves, kept when let go, the picker left open.
        replaceMany(new Map(picked().map((item) => [item.id, { ...item, ...change(choice) }])), done);
        const dot = anchor.querySelector<HTMLElement>(".ag-dot");
        if (dot) dot.style.background = swatchFill(choice, fallback);
      },
    }));
    openPop(anchor, anchor.getAttribute("aria-label") ?? labels.colour, content);
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
      field(labels.width, layer.w * width, (value) => ({ w: Math.max(4, value) / width, ...(layer.kind === "text" ? { autoWidth: false } : {}) })),
      ...(TEXT_KINDS.has(layer.kind) ? [] : [field(labels.height, layer.h * height, (value) => ({ h: Math.max(4, value) / height }))]),
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
    const content: HTMLElement[] = layer.backdrop && !multi()
      ? [act("position", labels.detachBackground, ICONS.background, () => detachBackground(find(layer.id)!))]
      : [popName(labels.arrange), arrangeKeys, popName(multi() ? labels.alignSelection : labels.alignPage), edges];
    if (picked().length >= 3) {
      const spread = element("div", "ag-pop-actions ag-pop-pair");
      spread.append(act("position", labels.distributeAcross, ICONS.distributeX, () => distribute("x")), act("position", labels.distributeDown, ICONS.distributeY, () => distribute("y")));
      content.push(popName(labels.distribute), spread);
    }
    if (!multi() && !layer.backdrop) content.push(popName(labels.advanced), positionFields(layer));
    if (!multi() && layer.kind === "text" && !layer.autoWidth) content.push(act("position", labels.fitText, ICONS.fit, () => update(find(layer.id)!, { autoWidth: true })));
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
    if (!multi() && PICTURE_KINDS.has(layer.kind) && !layer.backdrop) actions.append(act("more", labels.setBackground, ICONS.background, () => setAsBackground(find(layer.id)!)));
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
      const fallback = tinted === "outline" ? "text" : "accent";
      const home = () => toolbar.querySelector<HTMLElement>('[data-key="effects"]') ?? anchor;
      const key = colourKey("effect-colour", labels.effectColour, swatchFill(layer[tinted], fallback), () => {
        closePop();
        colourPop(home(), find(layer.id)!, tinted, fallback, { back: () => {
          closePop();
          effectsPop(home(), find(layer.id)!, "effect-colour");
        } });
      });
      key.dataset.popKey = "effect-colour";
      content.push(key);
    }
    if (TYPED_KINDS.has(layer.kind)) {
      content.push(slider(labels.curve, (layer.curve ?? 0) / 100, (value) => replaceLayer({ ...find(layer.id)!, curve: Math.round(value * 100) || undefined }, false), { min: -100, max: 100, suffix: "" }));
    }
    const caps = toggleKey(labels.capitals, ICONS.capitals, Boolean(layer.uppercase), () => set({ uppercase: !layer.uppercase }));
    content.push(caps);
    openPop(anchor, labels.effects, content, focus);
  }

  /** A shape's glass and shadow: how frosted it is, and a soft shadow under it. */
  function shapeEffectsPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const shadow = toggleKey(labels.shadow, ICONS.shadow, Boolean(layer.shadow), () => {
      const kept = popFocus();
      update(find(layer.id)!, { shadow: layer.shadow ? undefined : true });
      shapeEffectsPop(toolbar.querySelector<HTMLElement>('[data-key="effects"]') ?? anchor, find(layer.id)!, kept);
    });
    openPop(anchor, labels.effects, [
      slider(labels.frost, layer.frost ?? 0, (value) => replaceLayer({ ...find(layer.id)!, frost: value || undefined }, false), { max: 60, scale: 1, suffix: " px" }),
      shadow,
    ], focus);
  }

  /** What a time layer's clock shows: the time played and the length, the time played, the time left, or a percent. */
  function clockPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const ways: Clock[] = ["both", "elapsed", "remaining", "percent"];
    const current = layer.clock ?? "both";
    const row = element("div", "ag-segmented ag-segmented-four");
    row.setAttribute("role", "radiogroup");
    row.setAttribute("aria-label", labels.clock);
    for (const way of ways) {
      const button = element("button", "ag-segment");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(way === current));
      button.textContent = labels.clockNames[way];
      button.dataset.popKey = `clock:${way}`;
      button.addEventListener("click", () => {
        const kept = popFocus();
        update(find(layer.id)!, { clock: way === "both" ? undefined : way });
        clockPop(toolbar.querySelector<HTMLElement>('[data-key="clock"]') ?? anchor, find(layer.id)!, kept);
      });
      row.append(button);
    }
    openPop(anchor, labels.clock, [row], focus);
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
    const home = () => toolbar.querySelector<HTMLElement>('[data-key="border"]') ?? anchor;
    const colour = colourKey("border-colour", labels.borderColour, swatchFill(layer.stroke, "text"), () => {
      closePop();
      colourPop(home(), find(layer.id)!, "stroke", "text", {
        also: () => ({ strokeWidth: find(layer.id)!.strokeWidth || 6 }),
        back: () => {
          closePop();
          borderPop(home(), find(layer.id)!, "border-colour");
        },
      });
    });
    colour.dataset.popKey = "border-colour";
    content.push(colour);
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
  /**
   * How the picked layers come in, go and move while they show, in tabs: tiles in groups, each showing its movement
   * when pointed at, a direction for the ways that take one, the speed, and the stretch of the clip they show for.
   * Picking a tile plays it on the picture once.
   */
  function animatePop(anchor: HTMLElement, layer: Layer, focus?: string) {
    // With several layers picked, each change reaches all of them.
    const live = (change: Partial<Layer>) => replaceMany(new Map(picked().map((item) => [item.id, { ...item, ...change }])), false);
    const home = () => toolbar.querySelector<HTMLElement>('[data-key="animate"]') ?? anchor;
    const ids = () => picked().map((item) => item.id);
    const set = (change: Partial<Layer>, rehearse = true) => {
      const kept = popFocus();
      updateAll(() => change);
      animatePop(home(), find(layer.id)!, kept);
      if (rehearse) host.rehearse?.(ids(), animateTab);
    };
    const part = animateTab;
    const worded = TYPEWRITER_KINDS.has(layer.kind);
    const field = part === "exit" ? "exit" : "enter";
    const current: Entrance | Loop | undefined = part === "loop" ? layer.loop : layer[field];

    const tabs = element("div", "ag-anim-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", labels.animate);
    const parts = [["enter", labels.in, layer.enter], ["exit", labels.out, layer.exit], ["loop", labels.loopName, layer.loop]] as const;
    for (const [value, name, chosen] of parts) {
      const tab = element("button", "ag-anim-tab");
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(value === part));
      tab.tabIndex = value === part ? 0 : -1;
      tab.dataset.popKey = `tab:${value}`;
      tab.textContent = name;
      // A dot on a tab that has something set, so what is on is clear from any tab.
      if (chosen) tab.dataset.set = "";
      tab.addEventListener("click", () => {
        animateTab = value;
        // The panel is drawn again on the new tab, not closed as a second press of its key would.
        closePop();
        animatePop(home(), find(layer.id)!, `tab:${value}`);
      });
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const at = parts.findIndex(([item]) => item === part);
        const next = parts[(at + (event.key === "ArrowRight" ? 1 : parts.length - 1)) % parts.length][0];
        animateTab = next;
        closePop();
        animatePop(home(), find(layer.id)!, `tab:${next}`);
      });
      tabs.append(tab);
    }
    const preview = keyButton("ag-anim-preview", labels.preview, ICONS.play);
    preview.dataset.popKey = "preview";
    preview.disabled = !current;
    preview.addEventListener("click", () => host.rehearse?.(ids(), part));
    const head = element("div", "ag-anim-head");
    head.append(tabs, preview);

    const speed = Math.min(4, Math.max(0.25, layer.speed ?? 1));
    const summary = element("p", "ag-anim-summary");
    if (current && part !== "loop") {
      const way = current as Entrance;
      const direction = DIRECTED[way] ? labels.directionNames[layer.direction ?? DIRECTED[way]!] : "";
      summary.textContent = [labels.enterNames[way], direction, `${(Math.round((entranceLength(way) / speed) * 10) / 10).toFixed(1)} s`].filter(Boolean).join(" · ");
    } else summary.textContent = current ? labels.loopNames[current as Loop] : labels.noAnimation;

    const tile = (way: Entrance | Loop | null, name: string, apply: Partial<Layer>) => {
      const button = element("button", "ag-anim");
      button.type = "button";
      button.setAttribute("aria-pressed", String((current ?? null) === way));
      button.dataset.anim = way ?? "none";
      button.dataset.popKey = `${part}:${way ?? "none"}`;
      const art = element("span", "ag-anim-art");
      // Captions are words too, though they keep their own word timing.
      const wordy = worded || layer.kind === "captions";
      art.dataset.look = wordy ? "words" : PICTURE_KINDS.has(layer.kind) || layer.kind === "avatar" || layer.kind === "mockup" ? "picture" : "shape";
      if (wordy) {
        // Two words, so the ways that move words one at a time show it.
        for (const [index, word] of ["Aa", "Bb"].entries()) {
          const piece = element("span", "ag-anim-word");
          piece.textContent = word;
          piece.style.setProperty("--i", String(index));
          art.append(piece);
        }
      }
      const text = element("span", "ag-anim-name");
      text.textContent = name;
      button.append(art, text);
      button.addEventListener("click", () => set(apply, way !== null));
      return button;
    };
    const group = (title: string, ways: readonly Entrance[]) => {
      const box = element("div", "ag-anim-group");
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", title);
      const grid = element("div", "ag-anim-grid");
      for (const way of ways) {
        if (way === "typewriter" && !worded) continue;
        if (way === "grow" && layer.kind !== "chart" && layer.kind !== "table") continue;
        grid.append(tile(way, labels.enterNames[way], { [field]: way }));
      }
      box.append(popName(title), grid);
      return box;
    };
    const body = element("div", "ag-anim-body");
    if (part === "loop") {
      const box = element("div", "ag-anim-group");
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", labels.emphasis);
      const grid = element("div", "ag-anim-grid");
      grid.append(tile(null, labels.none, { loop: undefined }), ...LOOPS.map((loop) => tile(loop, labels.loopNames[loop], { loop })));
      box.append(popName(labels.emphasis), grid);
      body.append(box);
    } else {
      const first = group(labels.recommended, recommendedFor(layer.kind));
      first.querySelector(".ag-anim-grid")!.prepend(tile(null, labels.none, { [field]: undefined }));
      body.append(first, group(labels.basic, BASIC_WAYS), group(labels.exaggerated, LIVELY_WAYS));
      if (worded) body.append(group(labels.words, WORD_WAYS));
    }

    const footer = element("div", "ag-anim-footer");
    const directed = part !== "loop" && current ? DIRECTED[current as Entrance] : undefined;
    if (directed) {
      const row = element("div", "ag-anim-directions");
      row.setAttribute("role", "radiogroup");
      row.setAttribute("aria-label", labels.direction);
      const now = layer.direction ?? directed;
      const arrows: Record<Direction, string> = { up: "M12 19V5m0 0-5 5m5-5 5 5", down: "M12 5v14m0 0-5-5m5 5 5-5", left: "M19 12H5m0 0 5-5m-5 5 5 5", right: "M5 12h14m0 0-5-5m5 5-5 5" };
      for (const way of ["up", "down", "left", "right"] as const) {
        const button = iconButton("", labels.directionNames[way], `<path d="${arrows[way]}"/>`);
        button.setAttribute("role", "radio");
        button.setAttribute("aria-checked", String(now === way));
        button.dataset.popKey = `direction:${way}`;
        button.addEventListener("click", () => set({ direction: way === directed ? undefined : way }));
        row.append(button);
      }
      const name = popName(labels.direction);
      footer.append(name, row);
    }
    footer.append(slider(labels.speed, layer.speed ?? 1, (value) => live({ speed: value === 1 ? undefined : value }), { min: 25, max: 400, scale: 100, suffix: "%" }));
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
    const timing = element("details", "ag-anim-timing");
    const timingName = element("summary", "ag-pop-name");
    timingName.textContent = labels.timing;
    timing.open = layer.from !== undefined || layer.until !== undefined;
    timing.append(timingName, times, whole);
    footer.append(timing);
    openPop(anchor, labels.animate, [head, summary, body, footer], focus, true);
  }

  /** Chips that each set one value of the picked layers, the pop-over drawn again to show the one now on. */
  function choicePop<T extends string>(anchor: HTMLElement, key: string, name: string, values: readonly T[], names: Record<T, string>, current: T, change: (value: T) => Partial<Layer>, extra: HTMLElement[] = [], focus?: string) {
    const row = element("div", "ag-chips");
    for (const value of values) {
      const chip = toggleKey(names[value], ICONS.check, current === value, () => {
        const kept = popFocus();
        updateAll(() => change(value));
        reopen(key, kept);
      });
      chip.classList.add("ag-chip");
      chip.dataset.popKey = `${key}:${value}`;
      row.append(chip);
    }
    openPop(anchor, name, [row, ...extra], focus);
  }
  /** Opens a toolbar key's pop-over again once the bar has been rebuilt, focused where it was. */
  function reopen(key: string, focus?: string) {
    const button = toolbar.querySelector<HTMLElement>(`[data-key="${key}"]`);
    const layer = find(selectedId);
    if (!button || !layer) return;
    const open: Record<string, (anchor: HTMLElement, layer: Layer, focus?: string) => void> = { chart: chartPop, data: dataPop, "chart-options": chartOptionsPop, cells: cellsPop, table: tablePop, device: devicePop, form: solidPop, ambient: ambientPop };
    closePop();
    open[key]?.(button, layer, focus);
  }

  const CHART_KINDS: ChartKind[] = ["column", "bar", "line", "area", "pie", "donut", "ring", "progress", "number", "poll"];
  function chartPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    choicePop(anchor, "chart", labels.chartType, CHART_KINDS, labels.chartNames, layer.chart ?? "column", (chart) => ({ chart }), [], focus);
  }

  /** A chart's rows: a label and a value each, typed in place, with rows added, taken away or pasted from a sheet. */
  function dataPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const rows = layer.data ?? [];
    const list = element("div", "ag-data");
    const commit = (next: typeof rows, done: boolean) => replaceLayer({ ...find(layer.id)!, data: next }, done);
    rows.forEach((row, index) => {
      const line = element("div", "ag-data-row");
      const label = element("input", "ag-input");
      label.value = row.label;
      label.maxLength = 40;
      label.setAttribute("aria-label", `${labels.label} ${index + 1}`);
      label.dataset.popKey = `label:${index}`;
      const value = element("input", "ag-input ag-data-value");
      value.inputMode = "decimal";
      value.value = String(row.value);
      value.setAttribute("aria-label", `${labels.value} ${index + 1}`);
      value.dataset.popKey = `value:${index}`;
      const read = () => {
        const number = Number(value.value.replace(/,/g, ""));
        return (find(layer.id)!.data ?? rows).map((item, at) => (at === index ? { ...item, label: label.value, value: Number.isFinite(number) ? number : item.value } : item));
      };
      // Typing shows at once; leaving the field ends the step.
      label.addEventListener("input", () => commit(read(), false));
      value.addEventListener("input", () => commit(read(), false));
      for (const input of [label, value]) input.addEventListener("change", () => host.change(host.layers(), true));
      const remove = iconButton("", labels.removeRow(index + 1), ICONS.remove);
      remove.dataset.popKey = `remove:${index}`;
      remove.disabled = rows.length <= 1;
      remove.addEventListener("click", () => {
        commit((find(layer.id)!.data ?? rows).filter((_, at) => at !== index), true);
        reopen("data", `label:${Math.max(0, index - 1)}`);
      });
      line.append(label, value, remove);
      list.append(line);
    });
    const add = keyButton("", labels.addRow, ICONS.add);
    add.dataset.popKey = "add-row";
    add.disabled = rows.length >= 12;
    add.addEventListener("click", () => {
      const now = find(layer.id)!.data ?? rows;
      commit([...now, { label: `${labels.label} ${now.length + 1}`, value: now[now.length - 1]?.value ?? 10 }], true);
      reopen("data", `label:${rows.length}`);
    });
    const paste = element("textarea", "ag-input ag-paste");
    paste.placeholder = labels.pasteHint;
    paste.setAttribute("aria-label", labels.pasteRows);
    paste.rows = 3;
    paste.addEventListener("change", () => {
      // A label and a number on each line, split by a tab or a comma as a spreadsheet copies them.
      const pasted = paste.value.split(/\r?\n/).map((line) => line.split(/\t|,(?=[^,]*$)/)).flatMap(([label, value]) => {
        const number = Number((value ?? "").trim().replace(/,/g, ""));
        return label?.trim() && Number.isFinite(number) && value?.trim() ? [{ label: label.trim().slice(0, 40), value: number }] : [];
      }).slice(0, 12);
      if (!pasted.length) return;
      commit(pasted, true);
      reopen("data", "add-row");
    });
    openPop(anchor, labels.data, [list, add, popName(labels.pasteRows), paste], focus);
  }

  function chartOptionsPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const set = (change: Partial<Layer>) => {
      const kept = popFocus();
      updateAll(() => change);
      reopen("chart-options", kept);
    };
    const keys = element("div", "ag-pop-actions");
    keys.append(
      toggleKey(labels.showLabels, ICONS.text, layer.showLabels !== false, () => set({ showLabels: layer.showLabels === false ? undefined : false })),
      toggleKey(labels.showValues, ICONS.listNumbers, layer.showValues !== false, () => set({ showValues: layer.showValues === false ? undefined : false })),
      toggleKey(labels.showGrid, ICONS.gridFour, layer.showGrid === true, () => set({ showGrid: layer.showGrid ? undefined : true })),
    );
    const words = element("div", "ag-position");
    const field = (name: string, key: "prefix" | "suffix") => {
      const label = element("label", "ag-field");
      const text = element("span", "ag-field-name");
      text.textContent = name;
      const input = element("input", "ag-input");
      input.maxLength = 8;
      input.value = layer[key] ?? "";
      input.dataset.popKey = key;
      input.addEventListener("input", () => replaceLayer({ ...find(layer.id)!, [key]: input.value || undefined }, false));
      input.addEventListener("change", () => host.change(host.layers(), true));
      label.append(text, input);
      return label;
    };
    words.append(field(labels.prefix, "prefix"), field(labels.suffix, "suffix"));
    const content: HTMLElement[] = [keys, words];
    if (layer.chart === "ring" || layer.chart === "progress") {
      const label = element("label", "ag-field");
      const text = element("span", "ag-field-name");
      text.textContent = labels.outOf;
      const input = element("input", "ag-input");
      input.inputMode = "decimal";
      input.value = String(layer.max ?? 100);
      input.dataset.popKey = "max";
      input.addEventListener("change", () => {
        const number = Number(input.value);
        if (Number.isFinite(number) && number > 0) update(find(layer.id)!, { max: number });
      });
      label.append(text, input);
      content.push(label);
    }
    openPop(anchor, labels.chartOptions, content, focus);
  }

  /** A table's words, a field for each cell, a row at a time. */
  function cellsPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const cells = layer.cells?.length ? layer.cells : [[""]];
    const columns = Math.max(...cells.map((row) => row.length));
    const grid = element("div", "ag-cells");
    grid.style.setProperty("--ag-columns", String(columns));
    cells.forEach((row, r) => {
      for (let c = 0; c < columns; c++) {
        const input = element("input", "ag-input");
        input.value = row[c] ?? "";
        input.maxLength = 120;
        input.setAttribute("aria-label", labels.cell(r + 1, c + 1));
        input.dataset.popKey = `cell:${r}:${c}`;
        input.addEventListener("input", () => {
          const now = (find(layer.id)!.cells ?? cells).map((line) => [...line]);
          while (now[r].length < columns) now[r].push("");
          now[r][c] = input.value;
          replaceLayer({ ...find(layer.id)!, cells: now }, false);
        });
        input.addEventListener("change", () => host.change(host.layers(), true));
        grid.append(input);
      }
    });
    const shape = (next: string[][], key: string) => {
      replaceLayer({ ...find(layer.id)!, cells: next }, true);
      reopen("cells", key);
    };
    const keys = element("div", "ag-pop-actions ag-pop-pair");
    const addRow = keyButton("", labels.addRow, ICONS.add);
    addRow.dataset.popKey = "add-row";
    addRow.disabled = cells.length >= 10;
    const live = () => (find(layer.id)!.cells ?? cells).map((row) => [...row]);
    addRow.addEventListener("click", () => shape([...live(), Array.from({ length: columns }, () => "")], "add-row"));
    const removeRow = keyButton("", labels.removeLastRow, ICONS.minus);
    removeRow.dataset.popKey = "remove-row";
    removeRow.disabled = cells.length <= 1;
    removeRow.addEventListener("click", () => shape(live().slice(0, -1), "remove-row"));
    const addColumn = keyButton("", labels.addColumn, ICONS.add);
    addColumn.dataset.popKey = "add-column";
    addColumn.disabled = columns >= 6;
    addColumn.addEventListener("click", () => shape(live().map((row) => [...row, ""]), "add-column"));
    const removeColumn = keyButton("", labels.removeColumn, ICONS.minus);
    removeColumn.dataset.popKey = "remove-column";
    removeColumn.disabled = columns <= 1;
    removeColumn.addEventListener("click", () => shape(live().map((row) => row.slice(0, columns - 1)), "remove-column"));
    keys.append(addRow, removeRow, addColumn, removeColumn);
    const paste = element("textarea", "ag-input ag-paste");
    paste.placeholder = labels.pasteCellsHint;
    paste.setAttribute("aria-label", labels.pasteRows);
    paste.rows = 3;
    paste.addEventListener("change", () => {
      const rows = paste.value.split(/\r?\n/).filter((line) => line.trim()).slice(0, 10).map((line) => line.split(line.includes("\t") ? "\t" : ",").slice(0, 6).map((cell) => cell.trim().slice(0, 120)));
      if (rows.length) shape(rows, "add-row");
    });
    openPop(anchor, labels.cells, [grid, keys, popName(labels.pasteRows), paste], focus);
  }

  function tablePop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const set = (change: Partial<Layer>) => {
      const kept = popFocus();
      updateAll(() => change);
      reopen("table", kept);
    };
    const keys = element("div", "ag-pop-actions");
    keys.append(
      toggleKey(labels.headerRow, ICONS.table, layer.header === true, () => set({ header: layer.header ? undefined : true })),
      toggleKey(labels.stripes, ICONS.list, layer.stripes === true, () => set({ stripes: layer.stripes ? undefined : true })),
    );
    const rules = chipRow(["none", "rows", "grid"] as const, labels.ruleNames, layer.rules ?? "rows", (value) => set({ rules: value }));
    openPop(anchor, labels.table, [keys, popName(labels.rules), rules], focus);
  }

  const DEVICE_KINDS: Device[] = ["phone", "tablet", "laptop", "monitor", "tv", "browser", "polaroid", "vinyl"];
  function devicePop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const extra: HTMLElement[] = [];
    if (layer.device === "polaroid") {
      const label = element("label", "ag-field");
      const text = element("span", "ag-field-name");
      text.textContent = labels.caption;
      const input = element("input", "ag-input");
      input.maxLength = 120;
      input.value = layer.text ?? "";
      input.dataset.popKey = "caption";
      input.addEventListener("input", () => replaceLayer({ ...find(layer.id)!, text: input.value || undefined }, false));
      input.addEventListener("change", () => host.change(host.layers(), true));
      label.append(text, input);
      extra.push(label);
    }
    // A device keeps its middle and its height; its width follows the new device's shape.
    choicePop(anchor, "device", labels.device, DEVICE_KINDS, labels.deviceNames, layer.device ?? "phone", (device) => host.deviceBox?.(find(layer.id)!, device) ?? { device }, extra, focus);
  }

  const SOLID_KINDS: Solid[] = ["sphere", "cube", "cylinder", "cone", "torus", "pyramid", "capsule"];
  function solidPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const keys = element("div", "ag-pop-actions");
    const set = (change: Partial<Layer>) => {
      const kept = popFocus();
      updateAll(() => change);
      reopen("form", kept);
    };
    keys.append(
      toggleKey(labels.gloss, ICONS.sparkles, layer.gloss !== false, () => set({ gloss: layer.gloss === false ? undefined : false })),
      toggleKey(labels.groundShadow, ICONS.shadow, layer.shadow !== false, () => set({ shadow: layer.shadow === false ? undefined : false })),
    );
    choicePop(anchor, "form", labels.form, SOLID_KINDS, labels.solidNames, layer.solid ?? "sphere", (solid) => ({ solid }), [keys], focus);
  }

  const AMBIENT_KINDS: Ambient[] = ["aurora", "flow", "bokeh", "particles", "waves", "rays", "grid", "grain"];
  function ambientPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const pace = slider(labels.pace, layer.pace ?? 1, (value) => replaceMany(new Map(picked().map((item) => [item.id, { ...item, pace: value === 1 ? undefined : value }])), false), { min: 25, max: 300, scale: 100, suffix: "%" });
    const voice = toggleKey(labels.withVoice, ICONS.pulse, layer.react === true, () => {
      updateAll(() => ({ react: layer.react ? undefined : true }));
      reopen("ambient", labels.withVoice);
    });
    choicePop(anchor, "ambient", labels.ambientStyle, AMBIENT_KINDS, labels.ambientNames, layer.ambient ?? "aurora", (ambient) => ({ ambient }), [pace, voice], focus);
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
    for (const look of ["bars", "wave", "pulse", "ring"] as Visual[]) {
      keys.append(toggleKey(labels.visualNames[look], ICONS[look], (layer.visual ?? "") === look, () => {
        const current = find(layer.id)!;
        update(current, host.soundLook?.(current, look) ?? { visual: look });
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
      const colour = colourKey("colour", labels.colour, swatchFill(layer.color, quiet ? "muted" : "text"), (anchor) => colourPop(anchor, find(layer.id)!, "color", quiet ? "muted" : "text"));
      toolbar.append(fontKey, sizeGroup, colour, bold, italic, underline, strike);
      if (layer.kind === "captions") {
        toolbar.append(colourKey("highlight", labels.highlight, swatchFill(layer.highlight, "accent"), (anchor) => colourPop(anchor, find(layer.id)!, "highlight", "accent")));
      }
      const order = ["left", "center", "right"] as const;
      const align = layer.align ?? "left";
      const alignKey = iconKey("align", `${labels.align}: ${labels.alignNames[align]}`, ALIGN_ICONS[align], () => update(find(layer.id)!, { align: order[(order.indexOf(align) + 1) % order.length] }));
      toolbar.append(alignKey);
      if (layer.kind === "time") toolbar.append(popKey("clock", labels.clock, ICONS.clock, clockPop));
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
      toolbar.append(colourKey("fill", labels.fill, swatchFill(layer.fill, "accent"), (anchor) => colourPop(anchor, find(layer.id)!, "fill", "accent")), popKey("line", labels.line, ICONS.shapeLine, linePop));
    } else if (layer.kind === "shape" || layer.kind === "visual" || layer.kind === "graphic") {
      const property = layer.kind === "shape" ? "fill" : "color";
      const fallback = layer.kind === "graphic" ? "text" : "accent";
      const mono = layer.kind !== "graphic" || (layer.art?.paths.some((part) => part.fill === "currentColor" || part.stroke === "currentColor") ?? false);
      if (mono) toolbar.append(colourKey("fill", labels.fill, swatchFill(layer[property], fallback), (anchor) => colourPop(anchor, find(layer.id)!, property, fallback)));
      if (layer.kind === "shape") toolbar.append(popKey("border", labels.border, ICONS.border, borderPop), popKey("effects", labels.effects, ICONS.effects, shapeEffectsPop));
      if (layer.kind === "visual") toolbar.append(popKey("style", labels.style, ICONS[layer.visual ?? "bars"], stylePop));
      if (layer.kind === "graphic") toolbar.append(popKey("flip", labels.flip, ICONS.flip, flipPop));
    } else if (layer.kind === "image" || layer.kind === "avatar") {
      // An empty frame asks for a photo; a full one swaps it.
      const empty = layer.kind === "image" && !layer.image;
      const swap = keyed(keyButton("", empty ? labels.addPhoto : labels.replace, empty ? ICONS.upload : ICONS.photo), "replace");
      swap.addEventListener("click", () => host.replace(find(layer.id)!));
      toolbar.append(swap);
    } else if (layer.kind === "chart") {
      toolbar.append(
        popKey("chart", labels.chartType, ICONS.chart, chartPop),
        popKey("data", labels.data, ICONS.table, dataPop),
        colourKey("fill", labels.fill, swatchFill(layer.fill, "accent"), (anchor) => colourPop(anchor, find(layer.id)!, "fill", "accent")),
        colourKey("colour", labels.wordsColour, swatchFill(layer.color, "text"), (anchor) => colourPop(anchor, find(layer.id)!, "color", "text")),
        popKey("chart-options", labels.chartOptions, ICONS.adjust, chartOptionsPop),
      );
    } else if (layer.kind === "table") {
      toolbar.append(
        popKey("cells", labels.cells, ICONS.table, cellsPop),
        popKey("table", labels.table, ICONS.adjust, tablePop),
        colourKey("fill", labels.headerRow, swatchFill(layer.fill, "accent"), (anchor) => colourPop(anchor, find(layer.id)!, "fill", "accent")),
        colourKey("colour", labels.wordsColour, swatchFill(layer.color, "text"), (anchor) => colourPop(anchor, find(layer.id)!, "color", "text")),
      );
    } else if (layer.kind === "mockup") {
      const swap = keyed(keyButton("", layer.image ? labels.replace : labels.addPhoto, layer.image ? ICONS.photo : ICONS.upload), "replace");
      swap.addEventListener("click", () => host.replace(find(layer.id)!));
      toolbar.append(swap, popKey("device", labels.device, ICONS.device, devicePop), colourKey("fill", labels.fill, swatchFill(layer.fill, "text"), (anchor) => colourPop(anchor, find(layer.id)!, "fill", "text")));
      if (layer.image) toolbar.append(popKey("crop", labels.crop, ICONS.crop, cropPop), popKey("filters", labels.filters, ICONS.filters, filtersPop));
    } else if (layer.kind === "solid") {
      toolbar.append(colourKey("fill", labels.fill, swatchFill(layer.fill, "accent"), (anchor) => colourPop(anchor, find(layer.id)!, "fill", "accent")), popKey("form", labels.form, ICONS.cube, solidPop));
    } else if (layer.kind === "ambient") {
      toolbar.append(
        popKey("ambient", labels.ambientStyle, ICONS.sparkles, ambientPop),
        colourKey("fill", labels.ground, swatchFill(layer.fill ?? "background", "text"), (anchor) => colourPop(anchor, find(layer.id)!, "fill", "text")),
        colourKey("colour", labels.light, swatchFill(layer.color, "accent"), (anchor) => colourPop(anchor, find(layer.id)!, "color", "accent")),
        colourKey("highlight", labels.secondLight, swatchFill(layer.highlight, "text"), (anchor) => colourPop(anchor, find(layer.id)!, "highlight", "text")),
      );
    }
    if (PICTURE_KINDS.has(layer.kind)) {
      if (layer.image) toolbar.append(popKey("crop", labels.crop, ICONS.crop, cropPop));
      toolbar.append(popKey("frame", labels.frame, ICONS.frame, framePop), popKey("border", labels.border, ICONS.border, borderPop), popKey("filters", labels.filters, ICONS.filters, filtersPop), popKey("adjust", labels.adjust, ICONS.adjust, adjustPop), popKey("flip", labels.flip, ICONS.flip, flipPop));
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
    layerAtClient(clientX, clientY) {
      const rect = overlay.getBoundingClientRect();
      if (!rect.width || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
      const { width, height } = size();
      return layerAt(host.layers(), (clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height, width, height);
    },
    destroy() {
      gone.abort();
    },
  };
}
