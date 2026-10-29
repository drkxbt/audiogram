/* The editor's building blocks: elements, icons, and the two kinds of button it uses. */

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function icon(markup: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = markup;
  return svg;
}

/** A button with an icon only, for controls everyone knows by sight; its name is for screen readers and the tooltip. */
export function iconButton(className: string, label: string, markup: string): HTMLButtonElement {
  const button = element("button", `ag-btn ${className}`);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(icon(markup));
  return button;
}

/** A button with an icon and its name written beside or under it, so no one has to guess what it does. */
export function keyButton(className: string, text: string, markup: string): HTMLButtonElement {
  const button = element("button", `ag-key ${className}`);
  button.type = "button";
  const name = element("span", "ag-key-text");
  name.textContent = text;
  button.append(icon(markup), name);
  return button;
}

/** Changes what a key button says, and its icon when one is given. */
export function rename(button: HTMLButtonElement, text: string, markup?: string): void {
  const name = button.querySelector(".ag-key-text");
  if (name) name.textContent = text;
  if (markup) button.querySelector("svg")?.replaceWith(icon(markup));
}

export const ICONS = {
  open: '<path d="M4 7.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18V9.5A1.5 1.5 0 0 0 18.5 8H12l-2-2.5H5.5A1.5 1.5 0 0 0 4 7Z"/>',
  play: '<path class="fill" d="M8 5.5v13l10.5-6.5Z"/>',
  pause: '<rect class="fill" x="6.5" y="5" width="4" height="14" rx="1"/><rect class="fill" x="13.5" y="5" width="4" height="14" rx="1"/>',
  export: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
  portrait: '<rect x="6" y="4" width="12" height="15" rx="1.5"/>',
  story: '<rect x="7.5" y="3" width="9" height="18" rx="1.5"/>',
  landscape: '<rect x="3" y="6.5" width="18" height="11" rx="1.5"/>',
  bars: '<path d="M5 10v4M8.5 7v10M12 4.5v15M15.5 7v10M19 10v4"/>',
  wave: '<path d="M3 12c2 0 2-5 4-5s2 10 4 10 2-13 4-13 2 8 4 8h2"/>',
  pulse: '<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7.5" opacity=".55"/>',
  ring: '<circle class="fill" cx="12" cy="4" r="1.15"/><circle class="fill" cx="17.66" cy="6.34" r="1.3"/><circle class="fill" cx="20" cy="12" r="1.5"/><circle class="fill" cx="17.66" cy="17.66" r="1.75"/><circle class="fill" cx="12" cy="20" r="1.15" opacity=".35"/><circle class="fill" cx="6.34" cy="17.66" r="1.15" opacity=".35"/><circle class="fill" cx="4" cy="12" r="1.15" opacity=".35"/><circle class="fill" cx="6.34" cy="6.34" r="1.15" opacity=".35"/>',
  radial: '<circle cx="12" cy="12" r="3.5"/><path d="M12 6.5V2M15.9 8.1l1.76-1.76M17.5 12H21M15.9 15.9l1.05 1.05M12 17.5v3M8.1 15.9l-1.05 1.05M6.5 12H3M8.1 8.1 6.34 6.34"/>',
  mirror: '<path d="M4 10.5V6M8 10.5V3.5M12 10.5V5.5M16 10.5V7.5M20 10.5V8.5"/><path d="M4 13.5V18M8 13.5v7M12 13.5v5M16 13.5v3M20 13.5v2" opacity=".45"/>',
  line: '<path class="fill" d="M3 17c2.5 0 3-9 6-9s3.5 6 6 6 3.5-5 6-5v11H3Z" opacity=".25"/><path d="M3 17c2.5 0 3-9 6-9s3.5 6 6 6 3.5-5 6-5"/>',
  dots: '<g class="fill"><circle cx="6" cy="18" r="1.4"/><circle cx="6" cy="14" r="1.4"/><circle cx="6" cy="10" r="1.4"/><circle cx="10" cy="18" r="1.4"/><circle cx="10" cy="14" r="1.4"/><circle cx="10" cy="10" r="1.4"/><circle cx="10" cy="6" r="1.4"/><circle cx="14" cy="18" r="1.4"/><circle cx="14" cy="14" r="1.4"/><circle cx="18" cy="18" r="1.4"/><circle cx="18" cy="14" r="1.4"/><circle cx="18" cy="10" r="1.4"/></g><g class="fill" opacity=".3"><circle cx="6" cy="6" r="1.4"/><circle cx="14" cy="10" r="1.4"/><circle cx="14" cy="6" r="1.4"/><circle cx="18" cy="6" r="1.4"/></g>',
  blocks: '<path d="M3.5 19h4M3.5 15.5h4M3.5 12h4M3.5 6h4M10 19h4M10 15.5h4M10 12h4M10 8.5h4M10 4h4M16.5 19h4M16.5 15.5h4M16.5 9.5h4"/>',
  scope: '<path d="M3 12h18" opacity=".3"/><path d="M3 12q1.125-2.4 2.25 0q1.125 5.2 2.25 0q1.125-8 2.25 0q1.125 10 2.25 0q1.125-10 2.25 0q1.125 8 2.25 0q1.125-5.2 2.25 0q1.125 2.4 2.25 0"/>',
  photo: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-8 8.5"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  design: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><circle cx="16.5" cy="16.5" r="3.5"/>',
  text: '<path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/>',
  captions: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 11.5h4M13 11.5h4M7 15h7M16 15h1"/>',
  tap: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.6a5 5 0 0 1-3.9-1.9L4.8 15a1.5 1.5 0 0 1 2.3-1.9L9 15"/>',
  spread: '<path d="M4 6h16M4 12h10M4 18h13"/>',
  file: '<path d="M6 4.5h8l4 4V19a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 19ZM14 4.5V9h4"/><path d="M9 13h6M9 16h4"/>',
  save: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  remove: '<path d="M6.5 6.5l11 11m0-11-11 11"/>',
  addRecording: '<path d="M3.5 10v4M7 7v10M10.5 9.5v5"/><path d="M17.5 8.5v7M14 12h7"/>',
  split: '<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.5 8.5 20 17M8.5 15.5 20 7"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5M8 10.5h5M10.5 8v5"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5M8 10.5h5"/>',
  fit: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  previous: '<path d="m14.5 6-6 6 6 6"/>',
  minus: '<path d="M5 12h14"/>',
  more: '<circle class="fill" cx="6" cy="12" r="1.5"/><circle class="fill" cx="12" cy="12" r="1.5"/><circle class="fill" cx="18" cy="12" r="1.5"/>',
  forward: '<rect x="8" y="4" width="12" height="12" rx="1.5"/><path d="M4 9v9.5A1.5 1.5 0 0 0 5.5 20H15"/>',
  backward: '<rect x="4" y="8" width="12" height="12" rx="1.5"/><path d="M8 4h10.5A1.5 1.5 0 0 1 20 5.5V16"/>',
  duplicate: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 4H5.5A1.5 1.5 0 0 0 4 5.5V16"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7M10.5 10.5v6M13.5 10.5v6"/>',
  hide: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/><path d="m4 4 16 16"/>',
  elements: '<path d="M12 3.5 15 9H9Z"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><circle cx="16.5" cy="16.5" r="3.5"/>',
  heading: '<path d="M6 5v14M18 5v14M6 12h12"/>',
  upload: '<path d="M12 16V5m0 0-4.5 4.5M12 5l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H12"/>',
  redo: '<path d="m15 7 4.5 4.5L15 16"/><path d="M19 11.5H9.5a5 5 0 0 0 0 10H12"/>',
  reset: '<path d="M5 12a7 7 0 1 0 2.05-4.95M5 4.5V9h4.5"/>',
  shapeSquare: '<rect x="5" y="5" width="14" height="14"/>',
  shapeRounded: '<rect x="5" y="5" width="14" height="14" rx="4"/>',
  shapeCircle: '<circle cx="12" cy="12" r="7.5"/>',
  shapeLine: '<path d="M4 12h16"/>',
  layers: '<path d="m12 4 8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/>',
  show: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  next: '<path d="m9.5 6 6 6-6 6"/>',
  shapeTriangle: '<path d="M12 5 20 19H4Z"/>',
  shapeDiamond: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12Z"/>',
  shapeStar: '<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8Z"/>',
  shapeHeart: '<path d="M12 19.5s-7.5-4.6-7.5-10A4 4 0 0 1 12 7.2a4 4 0 0 1 7.5 2.3c0 5.4-7.5 10-7.5 10Z"/>',
  shapeArrow: '<path d="M3.5 10h10V6l7 6-7 6v-4h-10Z"/>',
  shapeBubble: '<path d="M6 4.5h12A2.5 2.5 0 0 1 20.5 7v7a2.5 2.5 0 0 1-2.5 2.5h-8l-4 3.5v-3.5A2.5 2.5 0 0 1 3.5 14V7A2.5 2.5 0 0 1 6 4.5Z"/>',
  avatar: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18a6.5 6.5 0 0 1 11 0"/>',
  name: '<path d="M5 18.5a7 7 0 0 1 14 0"/><circle cx="12" cy="8.5" r="3.5"/>',
  handle: '<circle cx="12" cy="12" r="3.5"/><path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.4 6.8"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  video: '<rect x="3.5" y="6" width="12" height="12" rx="2"/><path d="m15.5 10.5 5-3v9l-5-3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 7.7-1.5"/>',
  flip: '<path d="M12 3.5v17"/><path d="M9 7 4 17h5ZM15 7l5 10h-5Z"/>',
  adjust: '<path d="M5 7h8M17 7h2M5 17h2M11 17h8"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  animate: '<path d="M4 15.5h5M3 11.5h7M5 7.5h4"/><circle cx="15.5" cy="11.5" r="5"/>',
  effects: '<path d="M7.5 18.5 14 6l6.5 12.5"/><path d="M10 13.5h8"/><path d="M4.5 5.5v3M3 7h3"/>',
  background: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="m3.5 15 5-5 4 4 3-3 5 5"/>',
  page: '<path d="M6 3.5h8.5l3.5 3.5v13.5H6Z"/><path d="M14.5 3.5V7H18"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 4H5.5A1.5 1.5 0 0 0 4 5.5V16"/>',
  paste: '<path d="M9 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H15"/><rect x="9" y="3" width="6" height="4" rx="1"/>',
  alignLeft: '<path d="M4.5 3.5v17"/><rect x="7.5" y="6" width="11" height="4" rx="1"/><rect x="7.5" y="14" width="7" height="4" rx="1"/>',
  alignCenter: '<path d="M12 3.5v17"/><rect x="5.5" y="6" width="13" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  alignRight: '<path d="M19.5 3.5v17"/><rect x="5.5" y="6" width="11" height="4" rx="1"/><rect x="9.5" y="14" width="7" height="4" rx="1"/>',
  alignTop: '<path d="M3.5 4.5h17"/><rect x="6" y="7.5" width="4" height="11" rx="1"/><rect x="14" y="7.5" width="4" height="7" rx="1"/>',
  alignMiddle: '<path d="M3.5 12h17"/><rect x="6" y="5.5" width="4" height="13" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  alignBottom: '<path d="M3.5 19.5h17"/><rect x="6" y="5.5" width="4" height="11" rx="1"/><rect x="14" y="9.5" width="4" height="7" rx="1"/>',
  template: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9h17M9 9v11.5"/>',
  sticker: '<path d="M20.5 12A8.5 8.5 0 1 1 12 3.5"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5H15a3 3 0 0 1-3-3Z"/><path d="M9 14.5a3.5 3.5 0 0 0 6 0"/>',
  capitals: '<path d="M3.5 18 7.5 6l4 12M5 14h5M13.5 18l3.5-12 3.5 12M14.8 14h4.4"/>',
  shadow: '<path d="M6 17 11 5l5 12"/><path d="M8 13h6"/><path d="M10 19.5h9M18 17v2.5" opacity=".55"/>',
  group: '<rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke-dasharray="3 2.5"/><rect x="7" y="7" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/>',
  ungroup: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  copyStyle: '<path d="M5 4h11v5H5Z"/><path d="M16 6.5h3v5h-7v3"/><path d="M11 14.5h2v6h-2Z"/>',
  select: '<path d="M5 4.5v15l4.5-4.5h6Z"/>',
  distributeX: '<path d="M4 4v16M20 4v16"/><rect x="9" y="8" width="6" height="8" rx="1"/>',
  distributeY: '<path d="M4 4h16M4 20h16"/><rect x="8" y="9" width="8" height="6" rx="1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrowLeft: '<path d="M20 12H5m0 0 5-5m-5 5 5 5"/>',
  arrowRight: '<path d="M4 12h15m0 0-5-5m5 5-5 5"/>',
  position: '<rect x="4" y="4" width="9" height="9" rx="1.5"/><path d="M17 8h3v12H8v-3"/>',
  transparency: '<rect x="4" y="4" width="16" height="16" rx="2"/><path class="fill" d="M4 4h4v4H4ZM12 4h4v4h-4ZM8 8h4v4H8ZM16 8h4v4h-4ZM4 12h4v4H4ZM12 12h4v4h-4ZM8 16h4v4H8ZM16 16h4v4h-4Z" opacity=".55"/>',
  list: '<path d="M10 7h10M10 12h10M10 17h10"/><circle class="fill" cx="5.5" cy="7" r="1.2"/><circle class="fill" cx="5.5" cy="12" r="1.2"/><circle class="fill" cx="5.5" cy="17" r="1.2"/>',
  listNumbers: '<path d="M10 7h10M10 12h10M10 17h10M4.5 5.5 6 5v4M4.5 14.5a1.5 1.5 0 0 1 2.6.6c0 1-2.6 1.4-2.6 2.4h2.8"/>',
  spacing: '<path d="M8 5v14M16 5v14M3 12h2M19 12h2"/><path d="m3.5 10.5-1 1.5 1 1.5M20.5 10.5l1 1.5-1 1.5"/>',
  border: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="4 3"/>',
  crop: '<path d="M7 3v14h14"/><path d="M3 7h14v14"/>',
  frame: '<circle cx="12" cy="12" r="8.5"/><path d="m6.5 17 4-4 3 3 2-2 3 3"/>',
  filters: '<circle cx="9" cy="9" r="5.5"/><circle cx="15" cy="9" r="5.5"/><circle cx="12" cy="14.5" r="5.5"/>',
  shapePentagon: '<path d="M12 4 20 10l-3 9.5H7L4 10Z"/>',
  shapeHexagon: '<path d="M12 3.5 19.5 8v8L12 20.5 4.5 16V8Z"/>',
  shapeOctagon: '<path d="M8.5 4h7L20 8.5v7L15.5 20h-7L4 15.5v-7Z"/>',
  shapeCross: '<path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5Z"/>',
  shapeSlant: '<path d="M8 6h13l-5 12H3Z"/>',
  shapeArch: '<path d="M5 20V11a7 7 0 0 1 14 0v9Z"/>',
  chart: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="7" rx="0.8"/><rect x="10.5" y="6" width="3" height="12" rx="0.8"/><rect x="15.5" y="13" width="3" height="5" rx="0.8"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  device: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 5.5h3"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  sparkles: '<path d="M12 3.5c.6 3.7 1.8 4.9 5.5 5.5-3.7.6-4.9 1.8-5.5 5.5-.6-3.7-1.8-4.9-5.5-5.5 3.7-.6 4.9-1.8 5.5-5.5Z"/><path d="M18.5 14.5c.3 1.8.9 2.4 2.5 2.7-1.6.3-2.2.9-2.5 2.6-.3-1.7-.9-2.3-2.5-2.6 1.6-.3 2.2-.9 2.5-2.7Z"/>',
  mockup: '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8.5 20h7M12 16.5V20"/>',
  lineDashed: '<path d="M3 12h4M10 12h4M17 12h4"/>',
  arrowBoth: '<path d="M7 12h10M3.5 12 7 8.5M3.5 12 7 15.5M20.5 12 17 8.5M20.5 12 17 15.5"/>',
  gridAcross: '<rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/>',
  gridDown: '<rect x="4" y="3" width="16" height="8" rx="1"/><rect x="4" y="13" width="16" height="8" rx="1"/>',
  gridThree: '<rect x="2.5" y="6" width="5.5" height="12" rx="1"/><rect x="9.25" y="6" width="5.5" height="12" rx="1"/><rect x="16" y="6" width="5.5" height="12" rx="1"/>',
  gridFour: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
};
