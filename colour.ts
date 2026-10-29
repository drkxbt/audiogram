/* The colour picker every colour key opens: a key for any colour at all, the colours the design already uses, the
   theme's, metal finishes, a set of default colours and, for the page, gradients. Any colour is chosen on a square of
   shades under a hue bar, typed as hex, or taken from the screen where the browser can. */

import { METALS, metalCss, type Page, type Theme } from "./render.js";
import { element, icon, ICONS } from "./ui.js";

/** A colour as a layer takes it (CSS, a theme name or a metal), a gradient for the page, or null for the theme's page. */
export type ColourChoice = string | Page | null;

export interface ColourLabels {
  anyColour: string;
  documentColours: string;
  themeColours: string;
  metals: string;
  defaultColours: string;
  gradients: string;
  themePage: string;
  solid: string;
  gradient: string;
  shade: string;
  hue: string;
  hex: string;
  eyedropper: string;
  from: string;
  to: string;
  direction: string;
  fill: string;
  themeColour: (name: "text" | "muted" | "accent") => string;
}

export const COLOUR_LABELS: ColourLabels = {
  anyColour: "Any colour",
  documentColours: "In this design",
  themeColours: "Theme",
  metals: "Metallic",
  defaultColours: "Default colours",
  gradients: "Gradients",
  themePage: "The theme's page",
  solid: "Solid",
  gradient: "Gradient",
  shade: "Shade",
  hue: "Hue",
  hex: "Hex code",
  eyedropper: "Pick a colour from the screen",
  from: "First colour",
  to: "Second colour",
  direction: "Direction",
  fill: "Fill",
  themeColour: (name) => ({ text: "Theme text", muted: "Theme muted", accent: "Theme accent" })[name],
};

/** The default colours, light to dark down each column the way a design tool lays them out. */
export const DEFAULT_COLOURS = [
  "#000000", "#545454", "#737373", "#a6a6a6", "#d9d9d9", "#ffffff",
  "#ff3131", "#ff5757", "#ff66c4", "#cb6ce6", "#8c52ff", "#5e17eb",
  "#0097b2", "#0cc0df", "#5ce1e6", "#38b6ff", "#5170ff", "#004aad",
  "#00bf63", "#7ed957", "#c1ff72", "#ffde59", "#ffbd59", "#ff914d",
];

/** Ready-made gradients for the page, each running left to right. */
export const DEFAULT_GRADIENTS: Page[] = [
  ["#000000", "#737373"], ["#000000", "#c89116"], ["#000000", "#3533cd"], ["#a6a6a6", "#ffffff"],
  ["#ff3131", "#ff914d"], ["#ff5757", "#8c52ff"], ["#5170ff", "#ff66c4"], ["#004aad", "#cb6ce6"],
  ["#8c52ff", "#5ce1e6"], ["#5de0e6", "#004aad"], ["#8c52ff", "#00bf63"], ["#0cc0df", "#ffde59"],
  ["#ffde59", "#ff914d"], ["#ff66c4", "#ffde59"], ["#8c52ff", "#ff914d"], ["#0b1a33", "#3b2a10"],
].map(([color, to]) => ({ color, to, angle: 90 }));

const HEX = /^#?([0-9a-f]{6})$/i;
const SHORT_HEX = /^#?([0-9a-f]{3})$/i;

/** A hex colour from what someone typed, with or without the #, three digits or six; null when it isn't one. */
export function parseHex(text: string): string | null {
  const value = text.trim();
  const long = HEX.exec(value);
  if (long) return `#${long[1].toLowerCase()}`;
  const short = SHORT_HEX.exec(value);
  return short ? `#${[...short[1].toLowerCase()].map((digit) => digit + digit).join("")}` : null;
}

/** Hue in degrees, saturation and value from 0 to 1, as #rrggbb. */
export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** #rrggbb as hue in degrees, saturation and value from 0 to 1. */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const value = parseInt((parseHex(hex) ?? "#000000").slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const range = max - Math.min(r, g, b);
  let h = 0;
  if (range) {
    if (max === r) h = ((g - b) / range) % 6;
    else if (max === g) h = (b - r) / range + 2;
    else h = (r - g) / range + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? range / max : 0, v: max };
}

/** The colours a design already uses, as #rrggbb, most used first, without repeats; metals and theme names are left
 *  to their own rows. */
export function documentColours(paints: Array<string | undefined>, limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const paint of paints) {
    const hex = paint ? parseHex(paint) : null;
    if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex).slice(0, limit);
}

export interface ColourPanelOptions {
  current: ColourChoice;
  theme: Theme;
  /** Colours already in the design, shown first. */
  used: string[];
  /** Offer the theme's text, muted and accent colours, which follow the theme when it changes. */
  themeColours?: boolean;
  /** Offer metal finishes; only layers can take them. */
  metals?: boolean;
  /** Offer gradients and the theme's own page; only the page can take them. */
  page?: boolean;
  labels?: ColourLabels;
  /** A colour picked: from a swatch, or from the square, hue bar, hex field or eyedropper when `custom`. `done` is
   *  false while a shade or hue is still being dragged, so it can be shown without being kept as a step to undo. */
  onPick(choice: ColourChoice, done: boolean, custom: boolean): void;
}

const same = (a: ColourChoice, b: ColourChoice) => JSON.stringify(typeof a === "string" ? a.toLowerCase() : a) === JSON.stringify(typeof b === "string" ? b.toLowerCase() : b);

/** The picker, ready to go in a pop-over. */
export function colourPanel(options: ColourPanelOptions): HTMLElement {
  const labels = options.labels ?? COLOUR_LABELS;
  const panel = element("div", "ag-colours");
  const current = options.current;
  // The colour last picked here, so the shade square opens on it even though the panel was left in place.
  let latest: ColourChoice = current;
  const hexOf = (choice: ColourChoice) => (typeof choice === "string" ? parseHex(choice) : choice && typeof choice === "object" ? choice.color : null);

  const heading = (text: string) => {
    const node = element("p", "ag-colours-name");
    node.textContent = text;
    return node;
  };
  const swatch = (fill: string, name: string, choice: ColourChoice) => {
    const button = element("button", "ag-colour");
    button.type = "button";
    button.setAttribute("aria-label", name);
    button.title = name;
    button.setAttribute("aria-pressed", String(same(current, choice)));
    button.dataset.choice = JSON.stringify(choice);
    const dot = element("span", "ag-colour-dot");
    dot.style.background = fill;
    button.append(dot);
    button.addEventListener("click", () => {
      latest = choice;
      const hex = hexOf(choice);
      if (hex && !custom.box.hidden) custom.show(hex);
      options.onPick(choice, true, false);
    });
    return button;
  };
  const grid = (buttons: HTMLElement[]) => {
    const node = element("div", "ag-colour-grid");
    node.append(...buttons);
    return node;
  };

  // The key for any colour opens the shade square in place, above the rows.
  const any = element("button", "ag-colour ag-colour-any");
  any.type = "button";
  any.setAttribute("aria-label", labels.anyColour);
  any.title = labels.anyColour;
  any.setAttribute("aria-expanded", "false");
  any.append(icon(ICONS.add));
  // Shades picked on the square count as the latest too, so it reopens where it was left.
  const custom = customPicker(hexOf(current) ?? "#d4af37", labels, {
    ...options,
    onPick: (choice, done, fromSquare) => {
      latest = choice;
      options.onPick(choice, done, fromSquare);
    },
  });
  custom.box.hidden = true;
  any.addEventListener("click", () => {
    custom.box.hidden = !custom.box.hidden;
    any.setAttribute("aria-expanded", String(!custom.box.hidden));
    if (custom.box.hidden) return;
    const hex = hexOf(latest);
    if (hex) custom.show(hex);
    custom.box.querySelector<HTMLElement>(".ag-sv")?.focus();
  });

  const used = options.used.filter((hex) => !DEFAULT_COLOURS.includes(hex));
  const themePage = options.page ? [swatch(`linear-gradient(135deg, ${options.theme.background} 50%, ${options.theme.shade} 50%)`, labels.themePage, null)] : [];
  panel.append(heading(labels.documentColours), grid([any, ...themePage, ...used.map((hex) => swatch(hex, hex, hex))]), custom.box);
  if (options.themeColours) {
    panel.append(heading(labels.themeColours), grid((["text", "muted", "accent"] as const).map((name) => swatch(options.theme[name], labels.themeColour(name), name))));
  }
  if (options.metals) panel.append(heading(labels.metals), grid(Object.entries(METALS).map(([paint, metal]) => swatch(metalCss(paint)!, metal.name, paint))));
  const defaults = grid(DEFAULT_COLOURS.map((hex) => swatch(hex, hex, options.page ? { color: hex } : hex)));
  defaults.classList.add("ag-colour-grid-six");
  panel.append(heading(labels.defaultColours), defaults);
  if (options.page) {
    const gradients = grid(DEFAULT_GRADIENTS.map((page) => swatch(`linear-gradient(90deg, ${page.color}, ${page.to})`, `${page.color} to ${page.to}`, page)));
    gradients.classList.add("ag-colour-grid-eight");
    panel.append(heading(labels.gradients), gradients);
  }
  return panel;
}

/** Marks the swatch for `current` as picked, in a panel left in place while it is used. */
export function markPicked(panel: HTMLElement, current: ColourChoice): void {
  for (const button of panel.querySelectorAll<HTMLElement>("[data-choice]")) {
    button.setAttribute("aria-pressed", String(same(JSON.parse(button.dataset.choice!) as ColourChoice, current)));
  }
}

/** A square of shades for the hue picked under it, a hex field and, where the browser has one, an eyedropper; for the
 *  page, a second colour and a direction make a gradient. */
function customPicker(start: string, labels: ColourLabels, options: ColourPanelOptions): { box: HTMLElement; show(hex: string): void } {
  const box = element("div", "ag-custom");
  const startPage = options.page && options.current && typeof options.current === "object" && options.current.to ? options.current : null;
  let mode: "solid" | "gradient" = startPage ? "gradient" : "solid";
  // The two ends of a gradient; the solid colour is the first.
  const ends = [startPage?.color ?? start, startPage?.to ?? "#000000"];
  let editing = 0;
  let angle = startPage?.angle ?? 90;
  let hsv = hexToHsv(ends[0]);

  const choice = (): ColourChoice => (mode === "gradient" ? { color: ends[0], to: ends[1], angle } : options.page ? { color: ends[0] } : ends[0]);
  const send = (done: boolean) => options.onPick(choice(), done, true);

  const sv = element("div", "ag-sv");
  sv.tabIndex = 0;
  sv.setAttribute("role", "slider");
  sv.setAttribute("aria-label", labels.shade);
  sv.setAttribute("aria-valuemin", "0");
  sv.setAttribute("aria-valuemax", "100");
  const thumb = element("span", "ag-sv-thumb");
  sv.append(thumb);
  const hue = element("input", "ag-hue");
  hue.type = "range";
  hue.min = "0";
  hue.max = "360";
  hue.setAttribute("aria-label", labels.hue);
  const hexRow = element("div", "ag-hex-row");
  const preview = element("span", "ag-hex-dot");
  const hex = element("input", "ag-input ag-hex");
  hex.setAttribute("aria-label", labels.hex);
  hex.spellcheck = false;
  hex.autocomplete = "off";
  hex.maxLength = 7;
  hexRow.append(preview, hex);
  const dropper = (window as Window & { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
  if (dropper) {
    const pickScreen = element("button", "ag-btn ag-dropper");
    pickScreen.type = "button";
    pickScreen.setAttribute("aria-label", labels.eyedropper);
    pickScreen.title = labels.eyedropper;
    pickScreen.append(icon('<path d="m14.5 5.5 4 4M16.5 3.5a2.1 2.1 0 0 1 3 3l-2 2-3-3Z"/><path d="m14.5 7.5-9 9V19h2.5l9-9"/>'));
    pickScreen.addEventListener("click", () => {
      new dropper()
        .open()
        .then((result) => {
          const picked = parseHex(result.sRGBHex);
          if (picked) setHex(picked, true);
        })
        .catch(() => {});
    });
    hexRow.append(pickScreen);
  }

  function paint() {
    const colour = hsvToHex(hsv.h, hsv.s, hsv.v);
    ends[editing] = colour;
    sv.style.backgroundColor = hsvToHex(hsv.h, 1, 1);
    thumb.style.left = `${hsv.s * 100}%`;
    thumb.style.top = `${(1 - hsv.v) * 100}%`;
    thumb.style.background = colour;
    sv.setAttribute("aria-valuetext", colour);
    sv.setAttribute("aria-valuenow", String(Math.round(hsv.s * 100)));
    hue.value = String(Math.round(hsv.h));
    if (document.activeElement !== hex) hex.value = colour;
    preview.style.background = colour;
    stopKeys.forEach((key, index) => key.querySelector<HTMLElement>(".ag-colour-dot")!.style.background = ends[index]);
  }
  function setHex(colour: string, done: boolean) {
    hsv = hexToHsv(colour);
    paint();
    ends[editing] = colour;
    send(done);
  }

  // A press and drag on the square picks a shade, shown as it moves and kept on release.
  sv.addEventListener("pointerdown", (event) => {
    sv.setPointerCapture(event.pointerId);
    const at = (e: PointerEvent) => {
      const rect = sv.getBoundingClientRect();
      hsv = { ...hsv, s: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), v: 1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) };
      paint();
    };
    at(event);
    send(false);
    const move = (e: PointerEvent) => {
      at(e);
      send(false);
    };
    const up = (e: PointerEvent) => {
      at(e);
      send(true);
      sv.removeEventListener("pointermove", move);
      sv.removeEventListener("pointerup", up);
      sv.removeEventListener("pointercancel", up);
    };
    sv.addEventListener("pointermove", move);
    sv.addEventListener("pointerup", up);
    sv.addEventListener("pointercancel", up);
  });
  sv.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    hsv = { ...hsv, s: Math.min(1, Math.max(0, hsv.s + move[0])), v: Math.min(1, Math.max(0, hsv.v + move[1])) };
    paint();
    send(true);
  });
  hue.addEventListener("input", () => {
    hsv = { ...hsv, h: Number(hue.value) };
    // A grey has no hue to show; picking one brings its colour out.
    if (hsv.s < 0.05) hsv.s = 1;
    if (hsv.v < 0.05) hsv.v = 1;
    paint();
    send(false);
  });
  hue.addEventListener("change", () => send(true));
  const typed = () => {
    const colour = parseHex(hex.value);
    if (colour) setHex(colour, true);
    else hex.value = ends[editing];
  };
  hex.addEventListener("change", typed);
  hex.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      typed();
    }
  });

  // For the page: solid or gradient, which end is being set, and which way the gradient runs.
  const stopKeys: HTMLButtonElement[] = [];
  if (options.page) {
    const modes = element("div", "ag-segmented");
    modes.setAttribute("role", "radiogroup");
    modes.setAttribute("aria-label", labels.fill);
    const gradientRow = element("div", "ag-gradient-row");
    const modeKeys = (["solid", "gradient"] as const).map((value) => {
      const button = element("button", "ag-segment");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.textContent = value === "solid" ? labels.solid : labels.gradient;
      button.addEventListener("click", () => {
        mode = value;
        if (mode === "solid") editing = 0;
        markMode();
        send(true);
      });
      return button;
    });
    const markMode = () => {
      modeKeys.forEach((button, index) => button.setAttribute("aria-checked", String((index === 1) === (mode === "gradient"))));
      gradientRow.hidden = mode !== "gradient";
    };
    modes.append(...modeKeys);
    for (const [index, name] of [labels.from, labels.to].entries()) {
      const key = element("button", "ag-colour");
      key.type = "button";
      key.setAttribute("aria-label", name);
      key.title = name;
      key.append(element("span", "ag-colour-dot"));
      key.addEventListener("click", () => {
        editing = index;
        hsv = hexToHsv(ends[index]);
        stopKeys.forEach((stop, at) => stop.setAttribute("aria-pressed", String(at === index)));
        paint();
      });
      key.setAttribute("aria-pressed", String(index === 0));
      stopKeys.push(key);
    }
    const directions = element("div", "ag-directions");
    directions.setAttribute("role", "radiogroup");
    directions.setAttribute("aria-label", labels.direction);
    for (const [value, path] of [[90, "M4 12h14m0 0-4-4m4 4-4 4"], [180, "M12 4v14m0 0-4-4m4 4 4-4"], [135, "M6 6l11 11m0 0v-6m0 6h-6"], [45, "M6 18 17 7m0 0h-6m6 0v6"]] as const) {
      const button = element("button", "ag-btn");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-label", `${labels.direction} ${value}°`);
      button.title = `${value}°`;
      button.setAttribute("aria-checked", String(angle === value));
      button.append(icon(`<path d="${path}"/>`));
      button.addEventListener("click", () => {
        angle = value;
        for (const node of directions.children) node.setAttribute("aria-checked", String(node === button));
        send(true);
      });
      directions.append(button);
    }
    gradientRow.append(...stopKeys, directions);
    box.append(modes, gradientRow);
    markMode();
  }
  box.append(sv, hue, hexRow);
  paint();
  // Shows a colour on the square without picking it, as the picker opens on what is already chosen.
  const show = (hex: string) => {
    editing = 0;
    stopKeys.forEach((key, index) => key.setAttribute("aria-pressed", String(index === 0)));
    hsv = hexToHsv(hex);
    paint();
  };
  return { box, show };
}
