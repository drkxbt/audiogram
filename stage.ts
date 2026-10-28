/* Free editing on the picture, the way a design tool does it: press a layer to select it, drag it (it snaps to the
   frame's middle and edges and to other layers), pull a handle to size it, the round handle to turn it, double-click
   words to type them, and use the bar above the picture for the font, the size, the colour and the rest. */

import { layerAt, moveLayer, resizeTurned, rotateLayer, snapMove, type Guide, type Handle, type Layer } from "./layers.js";
import { paintOf, type Theme } from "./render.js";
import { element, iconButton, ICONS, keyButton } from "./ui.js";

/** A font the editor offers: its family as the canvas names it, and its files, each loaded only when needed. */
export interface FontChoice {
  name: string;
  family: string;
  category: string;
  files: Array<{ url: string; weight: string; unicodeRange?: string }>;
}

export interface StageLabels {
  picture: string;
  defaultFont: string;
  font: string;
  size: string;
  smaller: string;
  larger: string;
  bold: string;
  italic: string;
  colour: string;
  highlight: string;
  fill: string;
  align: string;
  more: string;
  forward: string;
  backward: string;
  duplicate: string;
  remove: string;
  hide: string;
  opacity: string;
  corners: string;
  themeColours: string;
  colours: string;
  custom: string;
  themeColour: (name: string) => string;
}

export interface StageHost {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  labels: StageLabels;
  layers(): Layer[];
  /** Puts `next` in place of the layers; `done` ends a gesture, so it is undone as one step. */
  change(next: Layer[], done: boolean): void;
  theme(): Theme;
  fonts(): FontChoice[];
  loadFont(family: string, sample?: string): Promise<void>;
  /** The words a text layer shows, and a way to change them as they are typed. */
  textOf(layer: Layer): string;
  setText(layer: Layer, text: string): void;
  /** The layer being typed into, which the picture leaves out while the box over it shows the words. */
  setEditing(id: string | null): void;
  /** Whether the picture can be edited now: not while captions are tapped out or a video is made. */
  enabled(): boolean;
}

export interface Stage {
  readonly selected: Layer | null;
  select(id: string | null): void;
  /** Lines the selection and the bar up again after the picture or its layers change. */
  refresh(): void;
  editText(id: string): void;
}

const TEXT_KINDS = new Set(["name", "handle", "title", "links", "time", "text", "captions"]);
const TYPED_KINDS = new Set(["name", "handle", "title", "text"]);
const ADDED_KINDS = new Set(["text", "image", "shape"]);
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const PALETTE = ["#ffffff", "#111111", "#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#2ff0b8", "#0a84ff", "#5e5ce6", "#bf5af2", "#ff2d55", "#8e8e93"];
const ALIGN_ICONS = {
  left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
};

let made = 0;
const newId = (kind: string) => `${kind}-${Date.now().toString(36)}${(made++).toString(36)}`;

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
  typing.spellcheck = true;
  overlay.append(guides, hover, box, typing);
  const toolbar = element("div", "ag-context");
  toolbar.setAttribute("role", "toolbar");
  toolbar.hidden = true;
  const pop = element("div", "ag-pop");
  pop.hidden = true;
  host.stage.append(overlay, toolbar, pop);

  let selectedId: string | null = null;
  let editing: string | null = null;
  const find = (id: string | null) => host.layers().find((layer) => layer.id === id) ?? null;
  const size = () => ({ width: overlay.clientWidth || 1, height: overlay.clientHeight || 1 });

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
      box.toggleAttribute("data-words", TEXT_KINDS.has(layer.kind));
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

  function replace(layer: Layer, done: boolean) {
    host.change(host.layers().map((item) => (item.id === layer.id ? layer : item)), done);
    draw();
  }

  function update(layer: Layer, change: Partial<Layer>) {
    const next = { ...layer, ...change };
    replace(next, true);
    buildToolbar(next);
  }

  // Pointer: select, move, size and turn.

  let gesture: { kind: "move" | "resize" | "rotate"; pointerId: number; x: number; y: number; start: Layer; handle?: Handle; moved: boolean } | null = null;
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
      select(start?.id ?? null);
    }
    if (!start) return;
    gesture = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, start, handle: kind === "resize" ? (handle as Handle) : undefined, moved: false };
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
      if (!host.enabled() || gesture) return;
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
      const others = host.layers().filter((layer) => layer.id !== start.id && !layer.hidden);
      // Alt moves freely, without snapping.
      const snapped = event.altKey ? { ...moved, guides: [] } : snapMove(moved, others, width, height, 6);
      showGuides(snapped.guides);
      next = { ...start, x: snapped.x, y: snapped.y };
    } else if (gesture.kind === "rotate") {
      const point = pointAt(event);
      next = rotateLayer(start, point.x, point.y, width, height, event.shiftKey);
    } else {
      const corner = gesture.handle!.length === 2;
      // Pictures and the profile picture keep their shape; words keep theirs from a corner, and grow with it.
      const keep = event.shiftKey || start.kind === "image" || start.kind === "avatar" || (corner && TEXT_KINDS.has(start.kind));
      next = resizeTurned(start, gesture.handle!, dx, dy, keep, width, height);
      if (corner && TEXT_KINDS.has(start.kind) && start.size) next = { ...next, size: Math.max(8, Math.round(start.size * (next.w / start.w))) };
    }
    replace(next, false);
  });

  const endGesture = () => {
    if (!gesture) return;
    const { moved, start } = gesture;
    gesture = null;
    showGuides([]);
    if (moved) {
      host.change(host.layers(), true);
      buildToolbar(find(start.id));
    }
    draw();
  };
  overlay.addEventListener("pointerup", endGesture);
  overlay.addEventListener("pointercancel", endGesture);
  overlay.addEventListener("pointerleave", () => (hover.hidden = true));

  overlay.addEventListener("dblclick", (event) => {
    if (!host.enabled()) return;
    const point = pointAt(event);
    const { width, height } = size();
    const under = layerAt(host.layers(), point.x, point.y, width, height);
    if (under && TYPED_KINDS.has(under.kind)) editText(under.id);
  });

  // Keys on the picture: arrows nudge a pixel (ten with Shift), Delete removes, Ctrl or Cmd with D duplicates, Escape lets go.
  overlay.addEventListener("keydown", (event) => {
    if (event.target === typing || !host.enabled()) return;
    const layer = find(selectedId);
    if (!layer) return;
    const { width, height } = size();
    const step = event.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (nudge[event.key]) {
      event.preventDefault();
      const [dx, dy] = nudge[event.key];
      update(layer, moveLayer(layer, dx / width, dy / height));
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeLayer(layer);
    } else if (event.key === "Escape") select(null);
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault();
      duplicate(layer);
    } else if (event.key === "Enter" && TYPED_KINDS.has(layer.kind)) {
      event.preventDefault();
      editText(layer.id);
    }
  });

  // Typing into words, in a box over them in their own font.

  function editText(id: string) {
    const layer = find(id);
    if (!layer || !TYPED_KINDS.has(layer.kind)) return;
    select(id);
    editing = id;
    host.setEditing(id);
    const { width, height } = size();
    const unit = Math.min(width, height) / 1080;
    frameOf(typing, layer);
    typing.style.minHeight = `${layer.h * height}px`;
    typing.style.height = "auto";
    typing.style.font = `${layer.italic ? "italic " : ""}${layer.weight ?? (layer.kind === "title" ? 700 : 400)} ${(layer.size ?? 40) * unit}px ${layer.font ? `"${layer.font}", ` : ""}${getComputedStyle(host.stage).fontFamily}`;
    typing.style.color = paintOf(layer.color, host.theme(), layer.kind === "handle" ? "muted" : "text");
    typing.style.textAlign = layer.align ?? "left";
    typing.value = host.textOf(layer);
    typing.hidden = false;
    typing.style.height = `${typing.scrollHeight}px`;
    typing.focus();
    typing.select();
    draw();
  }

  function finishTyping() {
    if (!editing) return;
    editing = null;
    typing.hidden = true;
    host.setEditing(null);
    host.change(host.layers(), true);
    draw();
    overlay.focus({ preventScroll: true });
  }
  typing.addEventListener("input", () => {
    const layer = find(editing);
    if (!layer) return;
    host.setText(layer, typing.value);
    typing.style.height = "auto";
    typing.style.height = `${typing.scrollHeight}px`;
  });
  typing.addEventListener("keydown", (event) => {
    const layer = find(editing);
    // A name or a handle is one line; Enter is done with it. Escape is done with any.
    if (event.key === "Escape" || (event.key === "Enter" && (!layer || layer.kind !== "text" || event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      finishTyping();
    }
  });
  typing.addEventListener("blur", finishTyping);

  // Changes from the bar and the keys.

  function removeLayer(layer: Layer) {
    if (ADDED_KINDS.has(layer.kind)) host.change(host.layers().filter((item) => item.id !== layer.id), true);
    else replace({ ...layer, hidden: true }, true);
    select(null);
  }

  function duplicate(layer: Layer) {
    if (!ADDED_KINDS.has(layer.kind)) return;
    const copy = { ...moveLayer(layer, 0.03, 0.03), id: newId(layer.kind) };
    const list = host.layers();
    const at = list.findIndex((item) => item.id === layer.id);
    host.change([...list.slice(0, at + 1), copy, ...list.slice(at + 1)], true);
    select(copy.id);
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

  // The bar above the picture: what can be changed about the selected layer.

  let popFor: HTMLElement | null = null;
  function closePop() {
    pop.hidden = true;
    pop.replaceChildren();
    popFor?.setAttribute("aria-expanded", "false");
    popFor = null;
  }
  function openPop(anchor: HTMLElement, content: HTMLElement[]) {
    if (popFor === anchor) return closePop();
    closePop();
    popFor = anchor;
    anchor.setAttribute("aria-expanded", "true");
    pop.replaceChildren(...content);
    pop.hidden = false;
    const stage = host.stage.getBoundingClientRect();
    const at = anchor.getBoundingClientRect();
    pop.style.top = `${at.bottom - stage.top + 6}px`;
    pop.style.left = `${Math.max(8, Math.min(stage.width - pop.offsetWidth - 8, at.left - stage.left))}px`;
  }
  document.addEventListener("pointerdown", (event) => {
    if (!pop.hidden && !pop.contains(event.target as Node) && !(popFor?.contains(event.target as Node) ?? false)) closePop();
  });
  pop.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const anchor = popFor;
    closePop();
    anchor?.focus();
  });

  const swatch = (color: string, label: string, apply: () => void) => {
    const button = element("button", "ag-swatch-key");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    const dot = element("span", "ag-dot");
    dot.style.background = color;
    button.append(dot);
    button.addEventListener("click", apply);
    return button;
  };

  function colourPop(anchor: HTMLElement, current: string | undefined, fallback: "text" | "muted" | "accent", apply: (paint: string) => void) {
    const theme = host.theme();
    const pick = (paint: string) => {
      apply(paint);
      closePop();
      anchor.focus();
    };
    const heading = (text: string) => {
      const node = element("p", "ag-pop-name");
      node.textContent = text;
      return node;
    };
    const themeRow = element("div", "ag-swatch-row");
    for (const name of ["text", "muted", "accent"] as const) themeRow.append(swatch(theme[name], labels.themeColour(name), () => pick(name)));
    const paletteRow = element("div", "ag-swatch-row");
    for (const color of PALETTE) paletteRow.append(swatch(color, color, () => pick(color)));
    const custom = element("label", "ag-custom-colour");
    const input = element("input", "");
    input.type = "color";
    input.value = /^#[0-9a-f]{6}$/i.test(paintOf(current, theme, fallback)) ? paintOf(current, theme, fallback) : "#ffffff";
    input.addEventListener("change", () => pick(input.value));
    const name = element("span", "");
    name.textContent = labels.custom;
    custom.append(input, name);
    openPop(anchor, [heading(labels.themeColours), themeRow, heading(labels.colours), paletteRow, custom]);
  }

  function fontPop(anchor: HTMLElement, layer: Layer) {
    const list = element("div", "ag-font-list");
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", labels.font);
    const choose = (family: string | undefined) => {
      update(layer, { font: family });
      if (family) void host.loadFont(family, host.textOf(layer)).then(() => host.change(host.layers(), false));
      closePop();
      anchor.focus();
    };
    const item = (name: string, family: string | undefined) => {
      const button = element("button", "ag-font-item");
      button.type = "button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(layer.font === family));
      button.textContent = name;
      if (family) {
        button.dataset.family = family;
        button.style.fontFamily = `"${family}", ${getComputedStyle(host.stage).fontFamily}`;
      }
      button.addEventListener("click", () => choose(family));
      return button;
    };
    list.append(item(labels.defaultFont, undefined));
    const groups = new Map<string, FontChoice[]>();
    for (const font of host.fonts()) groups.set(font.category, [...(groups.get(font.category) ?? []), font]);
    for (const [category, fonts] of groups) {
      const name = element("p", "ag-pop-name");
      name.textContent = category;
      list.append(name, ...fonts.map((font) => item(font.name, font.family)));
    }
    openPop(anchor, [list]);
    // Each font's name shows in that font once it scrolls into view.
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const family = (entry.target as HTMLElement).dataset.family;
        if (entry.isIntersecting && family) {
          seen.unobserve(entry.target);
          void host.loadFont(family, (entry.target as HTMLElement).textContent ?? "").catch(() => {});
        }
      }
    }, { root: list });
    list.querySelectorAll<HTMLElement>("[data-family]").forEach((node) => seen.observe(node));
    (list.querySelector("[aria-selected=true]") as HTMLElement | null)?.scrollIntoView({ block: "nearest" });
    (list.querySelector("[aria-selected=true]") as HTMLElement | null)?.focus();
  }

  function slider(name: string, value: number, apply: (value: number) => void) {
    const label = element("label", "ag-field");
    const text = element("span", "ag-field-name");
    text.textContent = name;
    const input = element("input", "ag-slider");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.value = String(Math.round(value * 100));
    input.addEventListener("input", () => apply(Number(input.value) / 100));
    label.append(text, input);
    return label;
  }

  function morePop(anchor: HTMLElement, layer: Layer) {
    const actions = element("div", "ag-pop-actions");
    const act = (text: string, markup: string, run: () => void) => {
      const button = keyButton("", text, markup);
      button.addEventListener("click", () => {
        run();
        closePop();
      });
      return button;
    };
    actions.append(act(labels.forward, ICONS.forward, () => reorder(layer, 1)), act(labels.backward, ICONS.backward, () => reorder(layer, -1)));
    if (ADDED_KINDS.has(layer.kind)) actions.append(act(labels.duplicate, ICONS.duplicate, () => duplicate(layer)));
    const content: HTMLElement[] = [actions, slider(labels.opacity, layer.opacity ?? 1, (value) => replace({ ...find(layer.id)!, opacity: value }, false))];
    if (layer.kind === "image" || (layer.kind === "shape" && layer.shape !== "ellipse")) {
      content.push(slider(labels.corners, (layer.radius ?? 0) * 2, (value) => replace({ ...find(layer.id)!, radius: value / 2 }, false)));
    }
    openPop(anchor, content);
    // A slider's drag is one step to undo, ended when it is let go.
    pop.querySelectorAll("input[type=range]").forEach((input) => input.addEventListener("change", () => host.change(host.layers(), true)));
  }

  function buildToolbar(layer: Layer | null) {
    closePop();
    toolbar.replaceChildren();
    if (!layer) return;
    const theme = host.theme();
    if (TEXT_KINDS.has(layer.kind)) {
      const font = host.fonts().find((item) => item.family === layer.font);
      const fontKey = keyButton("ag-font-key", font?.name ?? labels.defaultFont, ICONS.text);
      fontKey.setAttribute("aria-haspopup", "listbox");
      fontKey.setAttribute("aria-label", `${labels.font}: ${font?.name ?? labels.defaultFont}`);
      fontKey.addEventListener("click", () => fontPop(fontKey, find(layer.id)!));
      const sizeGroup = element("div", "ag-size");
      const smaller = iconButton("", labels.smaller, ICONS.minus);
      const larger = iconButton("", labels.larger, ICONS.add);
      const sizeInput = element("input", "ag-input ag-size-input");
      sizeInput.type = "number";
      sizeInput.min = "8";
      sizeInput.max = "400";
      sizeInput.value = String(Math.round(layer.size ?? 40));
      sizeInput.setAttribute("aria-label", labels.size);
      const setSize = (value: number) => update(find(layer.id)!, { size: Math.min(400, Math.max(8, Math.round(value))) });
      smaller.addEventListener("click", () => setSize((find(layer.id)!.size ?? 40) - 2));
      larger.addEventListener("click", () => setSize((find(layer.id)!.size ?? 40) + 2));
      sizeInput.addEventListener("change", () => setSize(Number(sizeInput.value) || 40));
      sizeGroup.append(smaller, sizeInput, larger);
      const strong = (layer.weight ?? (layer.kind === "title" ? 700 : layer.kind === "captions" ? 650 : 400)) >= 600;
      const bold = element("button", "ag-btn ag-glyph");
      bold.type = "button";
      bold.textContent = "B";
      bold.setAttribute("aria-label", labels.bold);
      bold.title = labels.bold;
      bold.setAttribute("aria-pressed", String(strong));
      bold.addEventListener("click", () => update(find(layer.id)!, { weight: strong ? 400 : 700 }));
      const italic = element("button", "ag-btn ag-glyph ag-italic");
      italic.type = "button";
      italic.textContent = "I";
      italic.setAttribute("aria-label", labels.italic);
      italic.title = labels.italic;
      italic.setAttribute("aria-pressed", String(Boolean(layer.italic)));
      italic.addEventListener("click", () => update(find(layer.id)!, { italic: !find(layer.id)!.italic }));
      const quiet = layer.kind === "handle" || layer.kind === "links" || layer.kind === "time";
      const colour = swatch(paintOf(layer.color, theme, quiet ? "muted" : "text"), labels.colour, () => colourPop(colour, layer.color, quiet ? "muted" : "text", (paint) => update(find(layer.id)!, { color: paint })));
      colour.setAttribute("aria-haspopup", "dialog");
      toolbar.append(fontKey, sizeGroup, bold, italic, colour);
      if (layer.kind === "captions") {
        const highlight = swatch(paintOf(layer.highlight, theme, "accent"), labels.highlight, () => colourPop(highlight, layer.highlight, "accent", (paint) => update(find(layer.id)!, { highlight: paint })));
        highlight.classList.add("ag-highlight-key");
        toolbar.append(highlight);
      }
      const order = ["left", "center", "right"] as const;
      const align = layer.align ?? "left";
      const alignKey = iconButton("", `${labels.align}: ${align}`, ALIGN_ICONS[align]);
      alignKey.addEventListener("click", () => update(find(layer.id)!, { align: order[(order.indexOf(align) + 1) % order.length] }));
      toolbar.append(alignKey);
    } else if (layer.kind === "shape" || layer.kind === "visual") {
      const key = layer.kind === "shape" ? "fill" : "color";
      const fill = swatch(paintOf(layer[key], theme, "accent"), labels.fill, () => colourPop(fill, layer[key], "accent", (paint) => update(find(layer.id)!, { [key]: paint } as Partial<Layer>)));
      toolbar.append(fill);
    }
    const more = keyButton("ag-more-key", labels.more, ICONS.more);
    more.setAttribute("aria-haspopup", "dialog");
    more.addEventListener("click", () => morePop(more, find(layer.id)!));
    const added = ADDED_KINDS.has(layer.kind);
    const remove = keyButton("ag-remove-key", added ? labels.remove : labels.hide, added ? ICONS.trash : ICONS.hide);
    remove.addEventListener("click", () => removeLayer(find(layer.id)!));
    toolbar.append(more, remove);
  }

  function select(id: string | null) {
    if (editing && id !== editing) finishTyping();
    const changed = id !== selectedId;
    selectedId = id;
    hover.hidden = true;
    if (changed) buildToolbar(find(id));
    draw();
  }

  new ResizeObserver(draw).observe(host.stage);

  return {
    get selected() {
      return find(selectedId);
    },
    select,
    refresh() {
      if (selectedId && !find(selectedId)) {
        selectedId = null;
        buildToolbar(null);
      }
      draw();
    },
    editText,
  };
}
