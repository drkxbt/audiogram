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
  addPart: '<path d="M4 7h11M4 12h11M4 17h7M18.5 14v7M15 17.5h7"/>',
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
  next: '<path d="m9.5 6 6 6-6 6"/>',
};
