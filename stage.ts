/* Free editing on the picture, the way a design tool does it: press a layer to select it, drag it (it snaps to the
   frame's middle and edges and to other layers), pull a handle to size it, the round handle to turn it, press selected
   words again to type them, and use the bar above the picture for the font, the size, the colour and the rest. With the
   keyboard, Tab steps through the layers on the picture and Enter types into words. */

import { formatTime, parseTime } from "./captions.js";
import { alignToPage, layerAt, moveLayer, resizeTurned, rotateLayer, snapMove, type Entrance, type Guide, type Handle, type Layer, type PageEdge } from "./layers.js";
import { paintOf, type Theme, type Visual } from "./render.js";
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
}

export interface StageHost {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
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
}

export interface Stage {
  readonly selected: Layer | null;
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
const ENTRANCES: Entrance[] = ["fade", "rise", "pop", "slide", "typewriter"];
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const PALETTE = ["#ffffff", "#111111", "#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#2ff0b8", "#0a84ff", "#5e5ce6", "#bf5af2", "#ff2d55", "#8e8e93"];
const ALIGN_ICONS = {
  left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
};

let made = 0;
const newId = (kind: string) => `${kind}-${Date.now().toString(36)}${(made++).toString(36)}`;
// The layer Copy took, ready to paste into any picture on the page.
let clipboard: Layer | null = null;
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
  overlay.append(guides, hover, box, typing);
  const toolbar = element("div", "ag-context");
  toolbar.setAttribute("role", "toolbar");
  toolbar.hidden = true;
  const pop = element("div", "ag-pop");
  pop.hidden = true;
  pop.setAttribute("role", "dialog");
  pop.id = `ag-pop-${++pops}`;
  host.stage.append(overlay, toolbar, pop);

  let selectedId: string | null = null;
  let editing: string | null = null;
  let toolbarFor = "";
  const find = (id: string | null) => host.layers().find((layer) => layer.id === id) ?? null;
  const size = () => ({ width: overlay.clientWidth || 1, height: overlay.clientHeight || 1 });
  const visible = () => host.layers().filter((layer) => !layer.hidden && !layer.locked);

  // The overlay sits exactly over the picture, wherever the stage has put it.
  function place() {
    const canvas = host.canvas.getBoundingClientRect();
    const stage = host.stage.getBoundingClientRect();
    overlay.style.left = `${canvas.left - stage.left}px`;
    overlay.style.top = `${canvas.top - stage.top}px`;
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

  function draw() {
    place();
    const layer = find(selectedId);
    box.hidden = !layer || layer.hidden === true || !host.enabled() || editing !== null;
    if (layer && !box.hidden) {
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

  // Pointer: select, move, size and turn. On a touch screen a first touch only selects, so a swipe over the picture
  // still scrolls the page; the selected layer can then be dragged.

  let gesture: { kind: "move" | "resize" | "rotate"; pointerId: number; x: number; y: number; start: Layer; handle?: Handle; moved: boolean; wasSelected: boolean } | null = null;
  const pointAt = (event: PointerEvent | MouseEvent) => {
    const rect = overlay.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  overlay.addEventListener("pointerdown", (event) => {
    if (!host.enabled() || event.button !== 0 || event.target === typing) return;
    closePop();
    const handle = (event.target as HTMLElement).dataset.handle;
    const current = find(selectedId);
    let start: Layer | null = null;
    let kind: "move" | "resize" | "rotate" = "move";
    if (handle && current) {
      start = current;
      kind = handle === "rotate" ? "rotate" : "resize";
    } else {
      const point = pointAt(event);
      const { width, height } = size();
      start = layerAt(host.layers(), point.x, point.y, width, height);
      const already = start !== null && start.id === selectedId;
      select(start?.id ?? null);
      if (event.pointerType === "touch" && !already) return;
    }
    // A locked layer is picked, to be unlocked, but stays where it is.
    if (!start || start.locked) return;
    gesture = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, start, handle: kind === "resize" ? (handle as Handle) : undefined, moved: false, wasSelected: current?.id === start.id };
    try {
      overlay.setPointerCapture(event.pointerId);
    } catch {
      // A pointer from a script can't be captured; the drag still follows it over the picture.
    }
    // Focus for the keys, without the ring a keyboard user would see.
    overlay.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    event.preventDefault();
  });

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
    const { moved, start, wasSelected, kind } = gesture;
    gesture = null;
    showGuides([]);
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
    if (event.target === host.stage) select(null);
  });

  overlay.addEventListener("dblclick", (event) => {
    if (!host.enabled()) return;
    const point = pointAt(event);
    const { width, height } = size();
    const under = layerAt(host.layers(), point.x, point.y, width, height);
    if (under) openLayer(under);
  });

  /** Types into words, or opens the panel where a layer's words or picture come from. */
  function openLayer(layer: Layer) {
    if (layer.locked) return;
    if (TYPED_KINDS.has(layer.kind)) editText(layer.id);
    else if (layer.kind === "image" || layer.kind === "avatar") host.replace(layer);
    else host.open(layer);
  }

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
    if (command && event.key.toLowerCase() === "v" && clipboard) {
      event.preventDefault();
      paste();
      return;
    }
    if (!layer) {
      const order = visible();
      if ((event.key === "Enter" || event.key === "ArrowDown") && order.length) {
        event.preventDefault();
        select(order[order.length - 1].id);
      }
      return;
    }
    if (command && (event.key.toLowerCase() === "c" || event.key.toLowerCase() === "x")) {
      event.preventDefault();
      copy(layer);
      if (event.key.toLowerCase() === "x" && !layer.locked) removeLayer(layer);
      return;
    }
    if (event.key === "Escape") return select(null);
    // A locked layer keeps still: only Tab, Escape and Copy reach it.
    if (layer.locked) return;
    const { width, height } = size();
    const step = event.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (nudge[event.key]) {
      event.preventDefault();
      const [dx, dy] = nudge[event.key];
      replaceLayer({ ...layer, ...moveLayer(layer, dx / width, dy / height) }, false);
      // A run of nudges is one step to undo.
      clearTimeout(nudgeTimer);
      nudgeTimer = window.setTimeout(() => {
        host.change(host.layers(), true);
        buildToolbar(find(selectedId));
      }, 400);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeLayer(layer);
    } else if (command && event.key.toLowerCase() === "d") {
      event.preventDefault();
      duplicate(layer);
    } else if (event.key === "Enter") {
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

  function duplicate(layer: Layer) {
    const twin = { ...moveLayer(layer, 0.03, 0.03), id: newId(layer.kind), locked: false };
    const list = host.layers();
    const at = list.findIndex((item) => item.id === layer.id);
    host.change([...list.slice(0, at + 1), twin, ...list.slice(at + 1)], true);
    select(twin.id);
    host.announce(labels.duplicated(host.layerName(layer)));
  }

  function copy(layer: Layer) {
    clipboard = { ...layer };
    host.announce(labels.copied(host.layerName(layer)));
  }

  /** The copied layer, on top, a little down and to the right of where it was so the two can be told apart. */
  function paste() {
    if (!clipboard) return;
    const twin = { ...moveLayer(clipboard, 0.03, 0.03), id: newId(clipboard.kind), hidden: false, locked: false };
    clipboard = twin;
    host.change([...host.layers(), twin], true);
    select(twin.id);
    host.announce(labels.duplicated(host.layerName(twin)));
  }

  /** A picture or video stretched over the whole page and sent to the back. */
  function setAsBackground(layer: Layer) {
    const full = { ...layer, x: 0, y: 0, w: 1, h: 1, rotation: 0, radius: 0 };
    host.change([full, ...host.layers().filter((item) => item.id !== layer.id)], true);
    buildToolbar(find(layer.id));
    draw();
  }

  function reorder(layer: Layer, step: number) {
    const list = [...host.layers()];
    const at = list.findIndex((item) => item.id === layer.id);
    const to = Math.min(list.length - 1, Math.max(0, at + step));
    if (to === at) return;
    list.splice(to, 0, ...list.splice(at, 1));
    host.change(list, true);
    draw();
  }

  // Pop-overs from the bar: one at a time, focused when they open, closed by Escape, by pressing elsewhere, or by
  // focus leaving them.

  let popFor: HTMLElement | null = null;
  let fontWatch: IntersectionObserver | null = null;
  function closePop() {
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
    if (!pop.hidden && !pop.contains(event.target as Node) && !(popFor?.contains(event.target as Node) ?? false)) closePop();
  });
  pop.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    const key = anchorKey();
    closePop();
    focusKey(key);
  });
  pop.addEventListener("focusout", (event) => {
    const next = event.relatedTarget as Node | null;
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
  function slider(name: string, value: number, apply: (value: number) => void, { max = 100, scale = 100, suffix = "%" } = {}) {
    const label = element("label", "ag-field");
    const head = element("span", "ag-field-head");
    const text = element("span", "ag-field-name");
    text.textContent = name;
    const shown = element("output", "ag-field-value");
    head.append(text, shown);
    const input = element("input", "ag-slider");
    input.type = "range";
    input.min = "0";
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
        if (Number.isFinite(number)) update(find(layer.id)!, apply(number));
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

  function morePop(anchor: HTMLElement, layer: Layer) {
    const actions = element("div", "ag-pop-actions");
    // The pop-over takes its focus with it as it closes; the bar's More key, or the picture once the bar has gone, gets
    // it back unless the action put it somewhere itself.
    const settle = () => {
      if (!document.activeElement || document.activeElement === document.body) (toolbar.querySelector<HTMLElement>('[data-key="more"]') ?? overlay).focus({ preventScroll: true });
    };
    const act = (text: string, markup: string, run: () => void) => {
      const button = keyButton("", text, markup);
      button.addEventListener("click", () => {
        run();
        closePop();
        settle();
      });
      return button;
    };
    actions.append(
      act(labels.forward, ICONS.forward, () => reorder(find(layer.id)!, 1)),
      act(labels.backward, ICONS.backward, () => reorder(find(layer.id)!, -1)),
      act(labels.duplicate, ICONS.duplicate, () => duplicate(find(layer.id)!)),
      act(labels.copy, ICONS.copy, () => copy(find(layer.id)!)),
    );
    if (clipboard) actions.append(act(labels.paste, ICONS.paste, paste));
    actions.append(act(labels.lock, ICONS.lock, () => lock(find(layer.id)!, true)));
    if (layer.rotation) actions.append(act(labels.straighten, ICONS.reset, () => update(find(layer.id)!, { rotation: 0 })));
    const name = element("p", "ag-pop-name");
    name.textContent = labels.alignPage;
    const edges = element("div", "ag-edge-grid");
    for (const [edge, markup] of EDGES) {
      const button = keyButton("", labels.edgeNames[edge], ICONS[markup]);
      button.addEventListener("click", () => {
        const { width, height } = host.frameSize();
        update(find(layer.id)!, alignToPage(find(layer.id)!, edge, width, height));
        settle();
      });
      edges.append(button);
    }
    const content: HTMLElement[] = [actions, name, edges, slider(labels.opacity, layer.opacity ?? 1, (value) => replaceLayer({ ...find(layer.id)!, opacity: value }, false))];
    if (PICTURE_KINDS.has(layer.kind) || (layer.kind === "shape" && (!layer.shape || layer.shape === "rect"))) {
      content.push(slider(labels.corners, (layer.radius ?? 0) * 2, (value) => replaceLayer({ ...find(layer.id)!, radius: value / 2 }, false)));
    }
    const heading = element("p", "ag-pop-name");
    heading.textContent = labels.position;
    content.push(heading, positionFields(layer));
    openPop(anchor, labels.more, content);
  }

  function lock(layer: Layer, locked: boolean) {
    update(layer, { locked });
    if (locked) host.announce(labels.locked(host.layerName(layer)));
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

  /** A row of colours with None first, for an effect that can be off. */
  function effectColours(name: string, current: string | undefined, apply: (paint: string | undefined) => void) {
    const row = element("div", "ag-swatch-row");
    const none = element("button", "ag-swatch-key ag-swatch-none");
    none.type = "button";
    none.setAttribute("aria-label", `${name}: ${labels.none}`);
    none.title = labels.none;
    none.setAttribute("aria-pressed", String(!current));
    none.dataset.popKey = `${name}: ${labels.none}`;
    none.addEventListener("click", () => apply(undefined));
    row.append(none);
    const chosen = current?.toLowerCase();
    PALETTE.forEach((color, index) => {
      const key = swatch(color, `${name}: ${labels.paletteNames[index] ?? color}`, chosen === color, () => apply(color));
      key.dataset.popKey = key.getAttribute("aria-label")!;
      row.append(key);
    });
    return [popName(name), row];
  }

  /** Effects on words: a shadow, capitals, an outline and a colour behind them. */
  function effectsPop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const set = (change: Partial<Layer>) => {
      const kept = popFocus();
      update(find(layer.id)!, change);
      effectsPop(toolbar.querySelector<HTMLElement>('[data-key="effects"]') ?? anchor, find(layer.id)!, kept);
    };
    const keys = element("div", "ag-pop-actions ag-pop-pair");
    keys.append(
      toggleKey(labels.shadow, ICONS.shadow, Boolean(layer.shadow), () => set({ shadow: !layer.shadow })),
      toggleKey(labels.capitals, ICONS.capitals, Boolean(layer.uppercase), () => set({ uppercase: !layer.uppercase })),
    );
    openPop(anchor, labels.effects, [keys, ...effectColours(labels.outline, layer.outline, (paint) => set({ outline: paint })), ...effectColours(labels.behind, layer.background, (paint) => set({ background: paint }))], focus);
  }

  /** How a layer comes in, and the stretch of the clip it shows for. */
  function animatePop(anchor: HTMLElement, layer: Layer, focus?: string) {
    const set = (change: Partial<Layer>) => {
      const kept = popFocus();
      update(find(layer.id)!, change);
      animatePop(toolbar.querySelector<HTMLElement>('[data-key="animate"]') ?? anchor, find(layer.id)!, kept);
    };
    const ways = element("div", "ag-pop-actions ag-pop-pair");
    ways.append(toggleKey(labels.none, ICONS.remove, !layer.enter, () => set({ enter: undefined })));
    for (const way of ENTRANCES) {
      if (way === "typewriter" && !TYPEWRITER_KINDS.has(layer.kind)) continue;
      ways.append(toggleKey(labels.enterNames[way], ICONS.animate, layer.enter === way, () => set({ enter: way })));
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
        replaceLayer({ ...find(layer.id)!, [field]: seconds === undefined ? undefined : Math.max(0, seconds) }, false);
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
    openPop(anchor, labels.animate, [popName(labels.animate), ways, popName(labels.timing), times, whole], focus);
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
    if (layer.locked) {
      const unlock = keyed(keyButton("", labels.unlock, ICONS.unlock), "unlock");
      unlock.addEventListener("click", () => lock(find(layer.id)!, false));
      toolbar.append(unlock);
      focusKey(active);
      return;
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
      const quiet = layer.kind === "handle" || layer.kind === "links" || layer.kind === "time";
      const colour = colourKey("colour", labels.colour, paintOf(layer.color, theme, quiet ? "muted" : "text"), (anchor) => colourPop(anchor, layer.color, quiet ? "muted" : "text", (paint) => update(find(layer.id)!, { color: paint })));
      toolbar.append(fontKey, sizeGroup, bold, italic, colour);
      if (layer.kind === "captions") {
        toolbar.append(colourKey("highlight", labels.highlight, paintOf(layer.highlight, theme, "accent"), (anchor) => colourPop(anchor, layer.highlight, "accent", (paint) => update(find(layer.id)!, { highlight: paint }))));
      }
      const order = ["left", "center", "right"] as const;
      const align = layer.align ?? "left";
      const alignKey = keyed(keyButton("", labels.align, ALIGN_ICONS[align]), "align");
      alignKey.setAttribute("aria-label", `${labels.align}: ${labels.alignNames[align]}`);
      alignKey.addEventListener("click", () => update(find(layer.id)!, { align: order[(order.indexOf(align) + 1) % order.length] }));
      toolbar.append(alignKey, popKey("effects", labels.effects, ICONS.effects, effectsPop));
      if (TYPED_KINDS.has(layer.kind)) {
        const edit = keyed(keyButton("", labels.editText, ICONS.text), "edit");
        edit.addEventListener("click", () => editText(layer.id));
        toolbar.append(edit);
      }
    } else if (layer.kind === "shape" || layer.kind === "visual") {
      const property = layer.kind === "shape" ? "fill" : "color";
      toolbar.append(colourKey("fill", labels.fill, paintOf(layer[property], theme, "accent"), (anchor) => colourPop(anchor, layer[property], "accent", (paint) => update(find(layer.id)!, { [property]: paint } as Partial<Layer>))));
      if (layer.kind === "visual") toolbar.append(popKey("style", labels.style, ICONS[layer.visual ?? "bars"], stylePop));
    } else if (layer.kind === "image" || layer.kind === "avatar") {
      const swap = keyed(keyButton("", labels.replace, ICONS.photo), "replace");
      swap.addEventListener("click", () => host.replace(find(layer.id)!));
      toolbar.append(swap);
    }
    if (PICTURE_KINDS.has(layer.kind)) {
      const background = keyed(keyButton("", labels.setBackground, ICONS.background), "background");
      background.addEventListener("click", () => setAsBackground(find(layer.id)!));
      toolbar.append(popKey("flip", labels.flip, ICONS.flip, flipPop), popKey("adjust", labels.adjust, ICONS.adjust, adjustPop), background);
    }
    toolbar.append(popKey("animate", labels.animate, ICONS.animate, animatePop));
    const more = keyed(keyButton("ag-more-key", labels.more, ICONS.more), "more");
    more.setAttribute("aria-haspopup", "dialog");
    more.setAttribute("aria-expanded", "false");
    more.setAttribute("aria-controls", pop.id);
    more.addEventListener("click", () => morePop(more, find(layer.id)!));
    const remove = keyed(keyButton("ag-remove-key", labels.remove, ICONS.trash), "remove");
    remove.addEventListener("click", () => removeLayer(find(layer.id)!));
    toolbar.append(more, remove);
    focusKey(active);
  }

  function select(id: string | null) {
    if (editing && id !== editing) finishTyping(false);
    const changed = id !== selectedId;
    selectedId = id;
    hover.hidden = true;
    if (changed) {
      const layer = find(id);
      buildToolbar(layer);
      if (layer) host.announce(labels.selected(host.layerName(layer)));
    }
    draw();
  }

  new ResizeObserver(draw).observe(host.stage);

  return {
    get selected() {
      return find(selectedId);
    },
    select,
    refresh() {
      const layer = find(selectedId);
      if (selectedId && (!layer || layer.hidden)) {
        selectedId = null;
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
  };
}
