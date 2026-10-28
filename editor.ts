import { clip, cueAt, formatTime, markStart, paginate, parseSubtitles, spread, toSRT, type Cue } from "./captions.js";
import { exportClip, type ExportResult } from "./export.js";
import { clipTimeAt, joinParts, partsLength, stitchCues } from "./parts.js";
import { Painter, SIZES, THEMES, type Layout, type Overlay, type Scene, type Theme, type Visual } from "./render.js";
import { OUTLINE_RATE, openSource, type AudioSource } from "./source.js";
import { element, icon, iconButton, ICONS, keyButton, rename } from "./ui.js";
import { initialView, outlineBars, panView, showSpan, zoomView, type View } from "./view.js";

export type Tab = "design" | "text" | "photos" | "music" | "captions";

export interface Labels {
  editor: string;
  tools: string;
  open: string;
  play: string;
  pause: string;
  export: string;
  exporting: (percent: number) => string;
  exported: (seconds: number) => string;
  failed: string;
  openFailed: string;
  pictureFailed: string;
  musicFailed: string;
  timeline: string;
  overview: string;
  playhead: string;
  clipStart: string;
  clipEnd: string;
  zoom: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  whole: string;
  reading: (done: string, total: string) => string;
  addPart: string;
  addPartHint: string;
  partsFull: string;
  parts: string;
  part: (index: number, from: string, to: string) => string;
  removePart: (index: number) => string;
  tabs: Record<Tab, string>;
  shape: string;
  layouts: Record<Layout, string>;
  visual: string;
  visuals: Record<Visual, string>;
  colours: string;
  theme: (name: string) => string;
  title: string;
  speaker: string;
  handle: string;
  links: string;
  link: (index: number) => string;
  linkHints: string[];
  cover: string;
  background: string;
  choose: string;
  replace: string;
  remove: string;
  none: string;
  music: string;
  musicVolume: string;
  captions: string;
  tap: string;
  tapTitle: string;
  tapNext: (text: string) => string;
  addCaption: string;
  importCaptions: string;
  importTitle: string;
  downloadCaptions: string;
  downloadTitle: string;
  removeCaption: string;
  seek: (time: string) => string;
  captionText: string;
  noCaptions: string;
  page: (from: number, to: number, total: number) => string;
  earlier: string;
  later: string;
  transcript: string;
  transcriptHelp: string;
  spread: string;
  loading: string;
  empty: string;
}

export interface EditorOptions {
  /** An address or a file of any audio the browser can play. An MP3 or a WAV can be any length. */
  audio?: string | Blob;
  /** Captions for the whole recording, in seconds from its start. */
  captions?: Cue[];
  /** The stretch to start with, in seconds. */
  range?: [number, number];
  title?: string;
  speaker?: string;
  handle?: string;
  cover?: string | Blob;
  /** A picture behind the whole clip, dimmed under the theme. */
  background?: string | Blob;
  /** A brand mark, small in the top left corner. Set from code; the editor has no key for it. */
  logo?: string | Blob;
  /** Where to find the speaker, up to three, written small along the bottom of the clip. */
  links?: string[];
  /** Music under the voice, any audio the browser can decode; it loops and fades in and out. */
  music?: string | Blob;
  /** The music's level, 0 to 1. 0.25 by default, well under the voice. */
  musicVolume?: number;
  layout?: Layout;
  visual?: Visual;
  theme?: number | Theme;
  /** The longest clip, in seconds. 140 by default: 2:20, the most X lets a free account post; Reels, Shorts, TikTok and LinkedIn all take it. */
  maxLength?: number;
  font?: string;
  labels?: Partial<Labels>;
  /** Called with the finished video. Without it, the video downloads. */
  onExport?: (result: ExportResult) => void;
  /** Drawn over every frame of the preview and the export. */
  overlay?: Overlay;
  /** Stretches of the recording, [start, end] in seconds, played one after another as the clip. */
  parts?: Array<[number, number]>;
  /** Called after the parts change through the editor: added, removed or reordered. */
  onParts?: (parts: Array<[number, number]>) => void;
  /** Called after the look changes through the editor, at most once a frame. */
  onChange?: (settings: Settings) => void;
}

/** The look of the clip as it stands: what a page would keep to start the next clip the same way. */
export interface Settings {
  title: string;
  speaker: string;
  handle: string;
  /** The picture the user opened, or the address it was given; null for none. */
  cover: Blob | string | null;
  /** The background picture and the logo, the same way; null for none. */
  background: Blob | string | null;
  logo: Blob | string | null;
  /** The music the user opened, or the address it was given; null for none. Its level, 0 to 1. */
  music: Blob | string | null;
  musicVolume: number;
  /** The links as typed, empty ones left out. */
  links: string[];
  layout: Layout;
  visual: Visual;
  /** An index into THEMES, or the theme itself when it isn't one of them. */
  theme: number | Theme;
}

export interface Editor {
  readonly element: HTMLElement;
  readonly captions: Cue[];
  readonly range: [number, number];
  /** The open recording's length in seconds; 0 before one is open. */
  readonly duration: number;
  load(audio: string | Blob): Promise<void>;
  setCaptions(cues: Cue[]): void;
  setRange(start: number, end: number): void;
  play(): void;
  pause(): void;
  export(): Promise<ExportResult | null>;
  readonly settings: Settings;
  /** The parts the clip is made of, in order; empty when the clip is just the selected stretch. */
  readonly parts: Array<[number, number]>;
  setParts(parts: Array<[number, number]>): void;
  /** The recording on show, as it was opened or given; null before one is. */
  readonly source: string | Blob | null;
  /** One channel of the open recording from `start` to `end` seconds at `sampleRate`, read from the file as needed. */
  readAudio(start: number, end: number, sampleRate: number): Promise<Float32Array>;
  setOverlay(overlay: Overlay | null): void;
  /** Opens one of the tools, as pressing its tab does. */
  selectTab(tab: Tab): void;
  /** Places for a page's own controls: in the header after Open audio, in the header before Download, and at the top of the Captions tab. */
  readonly slots: { header: HTMLElement; actions: HTMLElement; captions: HTMLElement };
  destroy(): void;
}

const DEFAULT_LABELS: Labels = {
  editor: "Clip maker",
  tools: "Tools",
  open: "Open audio",
  play: "Play",
  pause: "Pause",
  export: "Download",
  exporting: (percent) => `Making the video, ${percent}%`,
  exported: (seconds) => `The video is ready: ${formatTime(seconds)} long.`,
  failed: "The video couldn't be made in this browser. Try Chrome, Edge or Safari.",
  openFailed: "This recording couldn't be opened. Save it as an MP3 or WAV and try again.",
  pictureFailed: "This picture couldn't be opened. Try a JPG, PNG or WebP.",
  musicFailed: "This track couldn't be opened. Try an MP3 or WAV.",
  timeline: "The recording",
  overview: "The whole recording",
  playhead: "Play from",
  clipStart: "Clip start",
  clipEnd: "Clip end",
  zoom: "Zoom",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit",
  whole: "Show the whole recording",
  reading: (done, total) => `Loading waveform · ${done} of ${total}`,
  addPart: "Add to clip",
  addPartHint: "Keep this moment in the clip, then select another. They play back to back.",
  partsFull: "The clip is already as long as it can be.",
  parts: "Parts of the clip, in order",
  part: (index, from, to) => `Part ${index}, ${from} to ${to}`,
  removePart: (index) => `Remove part ${index}`,
  tabs: { design: "Design", text: "Text", photos: "Photos", music: "Music", captions: "Captions" },
  shape: "Shape",
  layouts: { square: "Square", portrait: "Portrait", story: "Story", landscape: "Wide" },
  visual: "Animation",
  visuals: { bars: "Bars", wave: "Wave", pulse: "Pulse" },
  colours: "Colours",
  theme: (name) => `${name} colours`,
  title: "Title",
  speaker: "Name",
  handle: "Handle",
  links: "Links",
  link: (index) => `Link ${index}`,
  linkHints: ["yoursite.com", "x.com/you", "youtube.com/@you"],
  cover: "Profile picture",
  background: "Background picture",
  choose: "Choose",
  replace: "Replace",
  remove: "Remove",
  none: "None yet",
  music: "Background music",
  musicVolume: "Volume",
  captions: "Captions",
  tap: "Tap to time",
  tapTitle: "Play the clip and tap the picture as each caption starts",
  tapNext: (text) => `Tap the picture when this starts: ${text}`,
  addCaption: "Add caption",
  importCaptions: "Open captions",
  importTitle: "Open an SRT or VTT file",
  downloadCaptions: "Save captions",
  downloadTitle: "Download this clip's captions as an SRT file",
  removeCaption: "Remove this caption",
  seek: (time) => `Go to ${time}`,
  captionText: "Caption",
  noCaptions: "No captions in this clip yet.",
  page: (from, to, total) => `${from}–${to} of ${total}`,
  earlier: "Earlier captions",
  later: "Later captions",
  transcript: "Paste a transcript",
  transcriptHelp: "Put one caption on each line. Each line gets as long as it takes to say, and together they replace the captions in the selected stretch.",
  spread: "Use as captions",
  loading: "Opening the recording",
  empty: "Open a recording of a Space, a podcast or a voice note to start.",
};

const TABS: Tab[] = ["design", "text", "photos", "music", "captions"];
const TAB_ICONS: Record<Tab, string> = { design: ICONS.design, text: ICONS.text, photos: ICONS.photo, music: ICONS.music, captions: ICONS.captions };
const RATIOS: Record<Layout, string> = { square: "1:1", portrait: "4:5", story: "9:16", landscape: "16:9" };

const MIN_LENGTH = 1;
const SAMPLE_RATE = 48000;
const SILENCE = new Float32Array(1);
// The waveform's zoom keys show only for recordings long enough to need them.
const ZOOMABLE = 20;
// The first stretch of music is all a clip can use; it loops under longer ones.
const MUSIC_LENGTH = 180;

let instances = 0;

/** Captions on screen break into pages short enough for the shape of the video. */
const pageLength = (layout: Layout) => (layout === "landscape" ? 46 : layout === "portrait" ? 34 : 32);

/** A time as m:ss, or h:mm:ss from an hour. */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = String(whole % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}

async function loadImage(source: string | Blob): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  // Waits for the load event rather than decode(), which some browsers hold back while the tab is out of sight.
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The picture could not be opened"));
  });
  image.src = typeof source === "string" ? source : URL.createObjectURL(source);
  await loaded;
  return image;
}

export function audiogram(container: HTMLElement, options: EditorOptions = {}): Editor {
  const labels: Labels = { ...DEFAULT_LABELS, ...options.labels };
  const maxLength = options.maxLength ?? 140;
  const id = `ag${++instances}`;
  let source: AudioSource | null = null;
  let sourceInput: string | Blob | null = null;
  // Bumped for each recording, so the clip's sound read from one is never taken for another's.
  let generation = 0;
  let cues: Cue[] = [...(options.captions ?? [])].sort((a, b) => a.start - b.start);
  let range: [number, number] = options.range ?? [0, 0];
  let playhead = range[0];
  let view: View = [0, 1];
  let layout: Layout = options.layout ?? "square";
  let visual: Visual = options.visual ?? "bars";
  let theme: Theme = typeof options.theme === "object" ? options.theme : THEMES[options.theme ?? 0] ?? THEMES[0];
  let title = options.title ?? "";
  let speaker = options.speaker ?? "";
  let handle = options.handle ?? "";
  let cover: HTMLImageElement | null = null;
  let coverSource: Blob | string | null = options.cover ?? null;
  let backdrop: HTMLImageElement | null = null;
  let backdropSource: Blob | string | null = options.background ?? null;
  let logo: HTMLImageElement | null = null;
  const logoSource: Blob | string | null = options.logo ?? null;
  let music: { samples: Float32Array; url: string; duration: number; close(): void } | null = null;
  let musicSource: Blob | string | null = options.music ?? null;
  let musicVolume = Math.min(1, Math.max(0, options.musicVolume ?? 0.25));
  const links = [0, 1, 2].map((index) => options.links?.[index] ?? "");
  let overlay: Overlay | null = options.overlay ?? null;
  // The clip is the parts, back to back, when there are any; otherwise the selected stretch alone.
  let parts: Array<[number, number]> = (options.parts ?? []).map(([start, end]) => [start, end]);
  const spans = (): Array<[number, number]> => (parts.length ? parts : [range]);
  const clipLength = () => (parts.length ? partsLength(parts) : range[1] - range[0]);
  const clipTime = () => (parts.length ? clipTimeAt(parts, playhead) ?? 0 : playhead - range[0]);
  const duration = () => source?.duration ?? 0;
  // The playhead stays inside the clip: on one of the parts, or in the selected stretch when there are none.
  const intoClip = (time: number) => {
    let nearest = time;
    let gap = Infinity;
    for (const [start, end] of spans()) {
      const at = Math.min(end, Math.max(start, time));
      if (Math.abs(at - time) < gap) [nearest, gap] = [at, Math.abs(at - time)];
    }
    return nearest;
  };
  let tapping = false;
  let tapIndex = 0;
  let exporting = false;
  let tab: Tab = "design";
  // The range given with the options belongs to the first recording; another one opens at its own start.
  let firstLoad = true;

  // The frame: a header with the main actions, the tools down the left, the picture, and the recording along the bottom.
  const root = element("div", "ag");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", labels.editor);
  // The root answers its own width for the layout; the frame inside it is what lays out.
  const shell = element("div", "ag-frame");
  root.append(shell);

  const header = element("div", "ag-header");
  const openButton = keyButton("ag-open", labels.open, ICONS.open);
  const audioInput = element("input", "ag-hidden");
  audioInput.type = "file";
  audioInput.accept = "audio/*,video/*,.mp3,.m4a,.wav";
  audioInput.tabIndex = -1;
  const headerSlot = element("div", "ag-slot");
  const actionsSlot = element("div", "ag-slot");
  const exportButton = keyButton("ag-export", labels.export, ICONS.export);
  const meter = element("span", "ag-meter");
  exportButton.append(meter);
  header.append(openButton, audioInput, headerSlot, element("span", "ag-grow"), actionsSlot, exportButton);

  const body = element("div", "ag-body");
  const rail = element("div", "ag-rail");
  rail.setAttribute("role", "tablist");
  rail.setAttribute("aria-label", labels.tools);
  rail.setAttribute("aria-orientation", "vertical");
  const drawer = element("div", "ag-drawer");
  const panes = {} as Record<Tab, HTMLElement>;
  const tabButtons = TABS.map((name) => {
    const button = element("button", "ag-tab");
    button.type = "button";
    button.id = `${id}-tab-${name}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `${id}-pane-${name}`);
    const text = element("span", "ag-tab-text");
    text.textContent = labels.tabs[name];
    button.append(icon(TAB_ICONS[name]), text);
    button.addEventListener("click", () => selectTab(name));
    const pane = element("section", "ag-pane");
    pane.id = `${id}-pane-${name}`;
    pane.setAttribute("role", "tabpanel");
    pane.setAttribute("aria-labelledby", button.id);
    panes[name] = pane;
    drawer.append(pane);
    return button;
  });
  rail.append(...tabButtons);
  // Arrow keys move along the tools, as along any tab list.
  rail.addEventListener("keydown", (event) => {
    const at = tabButtons.indexOf(document.activeElement as HTMLButtonElement);
    const last = tabButtons.length - 1;
    const to = event.key === "Home" ? 0 : event.key === "End" ? last
      : event.key === "ArrowDown" || event.key === "ArrowRight" ? (at + 1) % tabButtons.length
        : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (at + last) % tabButtons.length
          : -1;
    if (at < 0 || to < 0) return;
    event.preventDefault();
    const next = tabButtons[to];
    next.focus();
    next.click();
  });

  const stage = element("div", "ag-stage");
  const preview = element("canvas", "ag-preview");
  preview.setAttribute("role", "img");
  preview.tabIndex = 0;
  const tapHint = element("p", "ag-tap-hint");
  tapHint.hidden = true;
  const emptyNote = element("p", "ag-empty");
  emptyNote.textContent = labels.empty;
  const notice = element("p", "ag-notice");
  notice.hidden = true;
  stage.append(preview, tapHint, emptyNote, notice);
  body.append(rail, drawer, stage);

  const heading = (pane: HTMLElement, text: string) => {
    const node = element("h3", "ag-heading");
    node.id = `${pane.id}-${pane.childElementCount}`;
    node.textContent = text;
    pane.append(node);
    return node;
  };

  // Design: the shape, the animation and the colours, each a row of tiles that say what they are.
  const tiles = (pane: HTMLElement, name: string, items: Array<{ value: string; text: string; detail?: string; markup?: string; swatch?: Theme }>, current: string, apply: (value: string) => void) => {
    const label = heading(pane, name);
    const group = element("div", "ag-tiles");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-labelledby", label.id);
    group.style.setProperty("--ag-count", String(items.length));
    const buttons = items.map((item) => {
      const button = element("button", "ag-tile");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.dataset.value = item.value;
      if (item.markup) button.append(icon(item.markup));
      else {
        const dot = element("span", "ag-dot");
        dot.style.background = `linear-gradient(135deg, ${item.swatch!.background} 50%, ${item.swatch!.accent} 50%)`;
        button.append(dot);
      }
      const text = element("span", "ag-tile-text");
      text.textContent = item.text;
      button.append(text);
      if (item.detail) {
        const detail = element("span", "ag-tile-detail");
        detail.textContent = item.detail;
        button.append(detail);
      }
      button.addEventListener("click", () => {
        apply(item.value);
        mark(item.value);
      });
      return button;
    });
    const mark = (value: string) => buttons.forEach((button) => {
      const on = button.dataset.value === value;
      button.setAttribute("aria-checked", String(on));
      button.tabIndex = on ? 0 : -1;
    });
    // Arrow keys move along a radio group, and choose as they go.
    group.addEventListener("keydown", (event) => {
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
      if (at < 0 || !step) return;
      event.preventDefault();
      const next = buttons[(at + step + buttons.length) % buttons.length];
      next.focus();
      next.click();
    });
    group.append(...buttons);
    mark(current);
    pane.append(group);
    return group;
  };
  tiles(panes.design, labels.shape, (["square", "portrait", "story", "landscape"] as Layout[]).map((value) => ({ value, text: labels.layouts[value], detail: RATIOS[value], markup: ICONS[value] })), layout, (value) => {
    layout = value as Layout;
    rebuild();
    changed();
  });
  tiles(panes.design, labels.visual, (["bars", "wave", "pulse"] as Visual[]).map((value) => ({ value, text: labels.visuals[value], markup: ICONS[value] })), visual, (value) => {
    visual = value as Visual;
    rebuild();
    changed();
  });
  const themeTiles = tiles(panes.design, labels.colours, THEMES.map((item, index) => ({ value: String(index), text: item.name, swatch: item })), String(Math.max(0, THEMES.indexOf(theme))), (value) => {
    theme = THEMES[Number(value)];
    rebuild();
    changed();
  });
  themeTiles.classList.add("ag-swatches");
  for (const [index, button] of [...themeTiles.children].entries()) button.setAttribute("aria-label", labels.theme(THEMES[index].name));

  // Text: what the frame says, and up to three links.
  const field = (text: string, value: string, apply: (value: string) => void) => {
    const label = element("label", "ag-field");
    const name = element("span", "ag-field-name");
    name.textContent = text;
    const input = element("input", "ag-input");
    input.type = "text";
    input.value = value;
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      apply(input.value);
      rebuild();
      changed();
    });
    label.append(name, input);
    return label;
  };
  const linkGroup = element("fieldset", "ag-field ag-links");
  const linkName = element("legend", "ag-field-name");
  linkName.textContent = labels.links;
  linkGroup.append(linkName, ...links.map((value, index) => {
    const input = element("input", "ag-input");
    input.type = "text";
    input.inputMode = "url";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = 80;
    input.value = value;
    input.placeholder = labels.linkHints[index] ?? "";
    input.setAttribute("aria-label", labels.link(index + 1));
    input.addEventListener("input", () => {
      links[index] = input.value;
      rebuild();
      changed();
    });
    return input;
  }));
  panes.text.append(
    field(labels.title, title, (value) => (title = value)),
    field(labels.speaker, speaker, (value) => (speaker = value)),
    field(labels.handle, handle, (value) => (handle = value)),
    linkGroup,
  );

  // Photos and music: each a row with what is on now, a key to choose one, and a key to take it off.
  const fileRow = (pane: HTMLElement, name: string, accept: string, kind: "round" | "wide" | "sound", failed: string, apply: (file: Blob | null) => Promise<void>) => {
    heading(pane, name);
    const row = element("div", "ag-file");
    const thumb = element("span", `ag-thumb ag-thumb-${kind}`);
    const what = element("span", "ag-file-name");
    const choose = keyButton("ag-choose", labels.choose, ICONS.add);
    const remove = keyButton("ag-take-off", labels.remove, ICONS.remove);
    const input = element("input", "ag-hidden");
    input.type = "file";
    input.accept = accept;
    input.tabIndex = -1;
    let shown: string | null = null;
    const show = (file: Blob | string | null) => {
      if (shown) URL.revokeObjectURL(shown);
      shown = null;
      thumb.replaceChildren();
      if (file && kind !== "sound") {
        const image = element("img", "");
        image.alt = "";
        image.src = typeof file === "string" ? file : (shown = URL.createObjectURL(file));
        thumb.append(image);
      } else thumb.append(icon(kind === "sound" ? ICONS.music : ICONS.photo));
      what.textContent = file ? (file instanceof File ? file.name : typeof file === "string" && !file.startsWith("data:") ? file.split("/").pop() || name : name) : labels.none;
      rename(choose, file ? labels.replace : labels.choose);
      remove.hidden = !file;
    };
    choose.addEventListener("click", () => input.click());
    remove.addEventListener("click", async () => {
      await apply(null);
      show(null);
      choose.focus();
    });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      try {
        await apply(file);
        show(file);
      } catch {
        tell(failed);
      }
    });
    row.append(thumb, what, choose, remove, input);
    pane.append(row);
    return { show };
  };
  const coverRow = fileRow(panes.photos, labels.cover, "image/*", "round", labels.pictureFailed, async (file) => {
    cover = file ? await loadImage(file) : null;
    coverSource = file;
    rebuild();
    changed();
  });
  const backgroundRow = fileRow(panes.photos, labels.background, "image/*", "wide", labels.pictureFailed, async (file) => {
    backdrop = file ? await loadImage(file) : null;
    backdropSource = file;
    rebuild();
    changed();
  });

  const musicAudio = new Audio();
  musicAudio.loop = true;
  musicAudio.preload = "auto";
  const musicLevel = element("label", "ag-field ag-music-level");
  const setMusic = async (file: Blob | string | null) => {
    music?.close();
    music = null;
    musicAudio.pause();
    musicAudio.removeAttribute("src");
    if (file) {
      const opened = await openSource(file, { outline: false });
      const samples = await opened.read(0, Math.min(opened.duration, MUSIC_LENGTH), SAMPLE_RATE);
      music = { samples, url: opened.url, duration: opened.duration, close: () => opened.close() };
      musicAudio.src = opened.url;
      musicAudio.volume = musicVolume;
    }
    musicSource = file;
    musicLevel.hidden = !music;
  };
  const musicRow = fileRow(panes.music, labels.music, "audio/*,.mp3,.m4a,.wav", "sound", labels.musicFailed, async (file) => {
    await setMusic(file);
    changed();
  });
  const musicLevelName = element("span", "ag-field-name");
  musicLevelName.textContent = labels.musicVolume;
  const musicSlider = element("input", "ag-slider");
  musicSlider.type = "range";
  musicSlider.min = "0";
  musicSlider.max = "100";
  musicSlider.value = String(Math.round(musicVolume * 100));
  musicLevel.append(musicLevelName, musicSlider);
  musicLevel.hidden = true;
  panes.music.append(musicLevel);
  musicSlider.addEventListener("input", () => {
    musicVolume = Number(musicSlider.value) / 100;
    musicAudio.volume = musicVolume;
    changed();
  });

  // Captions: the page's own controls first, then the editor's tools, a page of the clip's captions, and a transcript.
  const captionsSlot = element("div", "ag-slot ag-slot-block");
  const captionTools = element("div", "ag-tools");
  const tapButton = keyButton("ag-tap", labels.tap, ICONS.tap);
  tapButton.setAttribute("aria-pressed", "false");
  const addButton = keyButton("", labels.addCaption, ICONS.add);
  const importButton = keyButton("", labels.importCaptions, ICONS.file);
  const importInput = element("input", "ag-hidden");
  importInput.type = "file";
  importInput.accept = ".srt,.vtt,text/vtt";
  importInput.tabIndex = -1;
  const downloadButton = keyButton("", labels.downloadCaptions, ICONS.save);
  tapButton.title = labels.tapTitle;
  importButton.title = labels.importTitle;
  downloadButton.title = labels.downloadTitle;
  captionTools.append(tapButton, addButton, importButton, downloadButton, importInput);
  const cueList = element("ol", "ag-cues");
  const pager = element("div", "ag-pager");
  const earlierButton = iconButton("", labels.earlier, ICONS.previous);
  const laterButton = iconButton("", labels.later, ICONS.next);
  const pageText = element("span", "ag-page");
  pager.append(earlierButton, pageText, laterButton);
  const transcript = element("details", "ag-more");
  const transcriptSummary = element("summary", "");
  transcriptSummary.textContent = labels.transcript;
  const transcriptHelp = element("p", "ag-help");
  transcriptHelp.textContent = labels.transcriptHelp;
  const transcriptInput = element("textarea", "ag-input ag-textarea");
  transcriptInput.rows = 3;
  transcriptInput.setAttribute("aria-label", labels.transcript);
  const spreadButton = keyButton("", labels.spread, ICONS.spread);
  transcript.append(transcriptSummary, transcriptHelp, transcriptInput, spreadButton);
  panes.captions.append(captionsSlot, captionTools, cueList, pager, transcript);

  // The recording: transport, an overview when zoomed in, the playhead's strip, and the waveform to select on.
  const timeline = element("div", "ag-timeline");
  const transport = element("div", "ag-transport");
  const playButton = iconButton("ag-play", labels.play, ICONS.play);
  const clipClock = element("span", "ag-clock");
  const reading = element("span", "ag-reading");
  const zoomOutButton = iconButton("ag-zoom", labels.zoomOut, ICONS.zoomOut);
  const zoomInButton = iconButton("ag-zoom", labels.zoomIn, ICONS.zoomIn);
  const wholeButton = keyButton("ag-fit", labels.fit, ICONS.fit);
  wholeButton.title = labels.whole;
  const zoomKeys = element("div", "ag-zoom-keys");
  const zoomName = element("span", "ag-zoom-name");
  zoomName.textContent = labels.zoom;
  zoomName.setAttribute("aria-hidden", "true");
  zoomKeys.append(zoomName, zoomOutButton, zoomInButton, wholeButton);
  const addPartButton = keyButton("ag-add-part", labels.addPart, ICONS.addPart);
  addPartButton.title = labels.addPartHint;
  transport.append(playButton, clipClock, reading, element("span", "ag-grow"), zoomKeys, addPartButton);

  const map = element("div", "ag-map");
  map.setAttribute("role", "img");
  map.setAttribute("aria-label", labels.overview);
  const mapCanvas = element("canvas", "ag-map-wave");
  const mapView = element("span", "ag-map-view");
  map.append(mapCanvas, mapView);
  const zoomed = element("div", "ag-zoomed");
  const scrub = element("div", "ag-scrub");
  scrub.setAttribute("role", "slider");
  scrub.setAttribute("aria-label", labels.playhead);
  scrub.tabIndex = 0;
  const track = element("div", "ag-track");
  track.setAttribute("role", "group");
  track.setAttribute("aria-label", labels.timeline);
  const wave = element("canvas", "ag-wave");
  wave.setAttribute("aria-hidden", "true");
  const selection = element("div", "ag-selection");
  const startHandle = element("div", "ag-handle");
  const endHandle = element("div", "ag-handle");
  for (const [handleNode, name] of [[startHandle, labels.clipStart], [endHandle, labels.clipEnd]] as const) {
    handleNode.setAttribute("role", "slider");
    handleNode.setAttribute("aria-label", name);
    handleNode.tabIndex = 0;
  }
  track.append(wave, selection, startHandle, endHandle);
  const playheadLine = element("div", "ag-playhead");
  playheadLine.append(element("span", "ag-knob"));
  zoomed.append(scrub, track, playheadLine);
  const lane = element("div", "ag-lane");
  lane.append(map, zoomed);
  timeline.append(transport, lane);
  const partList = element("ol", "ag-parts");
  partList.setAttribute("aria-label", labels.parts);

  const live = element("div", "ag-live");
  live.setAttribute("role", "status");
  shell.append(header, body, timeline, partList, live);
  container.append(root);

  const audio = new Audio();
  audio.preload = "auto";

  const announce = (message: string) => {
    live.textContent = "";
    setTimeout(() => (live.textContent = message), 50);
  };
  // A message on the picture for a few seconds, for what went wrong with something the user did.
  let noticeTimer = 0;
  const tell = (message: string) => {
    notice.textContent = message;
    notice.hidden = false;
    announce(message);
    clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => (notice.hidden = true), 7000);
  };

  function selectTab(next: Tab) {
    tab = next;
    root.dataset.tab = next;
    tabButtons.forEach((button, index) => {
      const on = TABS[index] === next;
      button.setAttribute("aria-selected", String(on));
      button.tabIndex = on ? 0 : -1;
      panes[TABS[index]].hidden = !on;
    });
    if (next === "captions") measureCues();
  }

  // The picture.

  let clipAudio: { key: string; samples: Float32Array } | null = null;
  let clipPending: { key: string; promise: Promise<Float32Array> } | null = null;
  const clipKey = () => `${generation}|${spans().map(([start, end]) => `${start.toFixed(3)}-${end.toFixed(3)}`).join(",")}`;

  const scene = (samples?: Float32Array): Scene => ({
    layout,
    visual,
    theme,
    title,
    speaker,
    handle,
    cover,
    font: options.font,
    overlay: overlay ?? undefined,
    backdrop,
    logo,
    links,
    music: music ? { samples: music.samples, gain: musicVolume } : null,
    captions: paginate(parts.length ? stitchCues(cues, parts) : clip(cues, range[0], range[1]), pageLength(layout)),
    audio: { samples: samples ?? (clipAudio?.key === clipKey() ? clipAudio.samples : SILENCE), sampleRate: SAMPLE_RATE, start: 0, end: Math.max(0, clipLength()) },
  });

  let painter = new Painter(scene());
  const ctx = preview.getContext("2d", { alpha: false })!;

  function sizePreview() {
    // Half size: plenty for a preview, and a quarter of the pixels to paint every frame.
    const { width, height } = SIZES[layout];
    if (preview.width !== width / 2 || preview.height !== height / 2) {
      preview.width = width / 2;
      preview.height = height / 2;
    }
    stage.dataset.layout = layout;
  }

  function paint() {
    const time = clipTime();
    painter.paint(ctx, time);
    const index = cueAt(painter.scene.captions, time);
    preview.setAttribute("aria-label", [title, speaker, index >= 0 ? painter.scene.captions[index].text : ""].filter(Boolean).join(". "));
  }

  const settings = (): Settings => ({
    title,
    speaker,
    handle,
    cover: coverSource,
    background: backdropSource,
    logo: logoSource,
    music: musicSource,
    musicVolume,
    links: links.map((link) => link.trim()).filter(Boolean),
    layout,
    visual,
    theme: THEMES.includes(theme) ? THEMES.indexOf(theme) : theme,
  });

  // The page hears about a change to the look once a frame, however many inputs moved in it.
  let changePending = false;
  function changed() {
    if (!options.onChange || changePending) return;
    changePending = true;
    requestAnimationFrame(() => {
      changePending = false;
      options.onChange?.(settings());
    });
  }

  /** Something the picture shows has changed: draw it again from scratch. */
  function rebuild() {
    painter = new Painter(scene());
    sizePreview();
    paint();
    renderCues();
  }

  // The clip's own sound, read from the recording at 48 kHz once its stretches settle, for the picture and the export.
  function loadClip(): Promise<Float32Array> {
    const key = clipKey();
    if (clipAudio?.key === key) return Promise.resolve(clipAudio.samples);
    if (clipPending?.key === key) return clipPending.promise;
    if (!source) return Promise.resolve(SILENCE);
    const from = source;
    const promise = Promise.all(spans().map(([start, end]) => from.read(start, end, SAMPLE_RATE))).then((pieces) => {
      const samples = pieces.length > 1 ? joinParts(pieces, SAMPLE_RATE) : pieces[0];
      if (key === clipKey()) {
        clipAudio = { key, samples };
        rebuild();
      }
      return samples;
    });
    clipPending = { key, promise };
    void promise.catch(() => {}).finally(() => {
      if (clipPending?.key === key) clipPending = null;
    });
    return promise;
  }
  let clipTimer = 0;
  function scheduleClip() {
    clearTimeout(clipTimer);
    if (source) clipTimer = window.setTimeout(() => void loadClip().catch(() => {}), 150);
  }

  // The recording along the bottom.

  const toX = (time: number) => ((time - view[0]) / Math.max(1e-6, view[1] - view[0])) * 100;
  const inView = (time: number) => time >= view[0] && time <= view[1];

  function sizeCanvas(canvas: HTMLCanvasElement, box: HTMLElement) {
    const ratio = devicePixelRatio || 1;
    const width = Math.max(1, Math.round(box.clientWidth * ratio));
    const height = Math.max(1, Math.round(box.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { width, height, ratio };
  }

  function drawWave() {
    const { width, height, ratio } = sizeCanvas(wave, track);
    const g = wave.getContext("2d")!;
    g.clearRect(0, 0, width, height);
    if (!source) return;
    const bars = Math.max(1, Math.floor(width / (3 * ratio)));
    const data = outlineBars(source.outline, OUTLINE_RATE, view, bars);
    const style = getComputedStyle(root);
    const inside = style.getPropertyValue("--ag-wave-in").trim() || "#121212";
    const outside = style.getPropertyValue("--ag-wave").trim() || "#999";
    const mid = height / 2;
    for (let i = 0; i < bars; i++) {
      const time = view[0] + ((i + 0.5) / bars) * (view[1] - view[0]);
      const lit = (time >= range[0] && time <= range[1]) || parts.some(([start, end]) => time >= start && time <= end);
      g.fillStyle = lit ? inside : outside;
      // Not read yet: a faint flat line where the sound will show.
      g.globalAlpha = time > source.outlined ? 0.4 : 1;
      const amplitude = Math.max(1 * ratio, (data[i * 2 + 1] - data[i * 2]) * mid * 0.92);
      g.fillRect(i * 3 * ratio, mid - amplitude / 2, 2 * ratio, amplitude);
    }
    g.globalAlpha = 1;
  }

  // The overview, shown while zoomed in: the whole recording, where the view is, and where the clip is.
  function drawMap() {
    const whole = !source || view[1] - view[0] >= duration() - 1e-6;
    map.hidden = whole;
    if (whole || !source) return;
    const { width, height, ratio } = sizeCanvas(mapCanvas, map);
    const g = mapCanvas.getContext("2d")!;
    g.clearRect(0, 0, width, height);
    const bars = Math.max(1, Math.floor(width / (2 * ratio)));
    const data = outlineBars(source.outline, OUTLINE_RATE, [0, duration()], bars);
    const style = getComputedStyle(root);
    const outside = style.getPropertyValue("--ag-wave").trim() || "#999";
    const accent = style.getPropertyValue("--ag-accent").trim() || "#2ff0b8";
    const mid = height / 2;
    for (let i = 0; i < bars; i++) {
      const time = ((i + 0.5) / bars) * duration();
      g.fillStyle = spans().some(([start, end]) => time >= start && time <= end) ? accent : outside;
      const amplitude = Math.max(ratio, (data[i * 2 + 1] - data[i * 2]) * mid * 0.9);
      g.fillRect(i * 2 * ratio, mid - amplitude / 2, ratio, amplitude);
    }
    mapView.style.left = `${(view[0] / duration()) * 100}%`;
    mapView.style.width = `${((view[1] - view[0]) / duration()) * 100}%`;
  }

  function setView(next: View) {
    view = next;
    drawWave();
    drawMap();
    placeTimeline();
  }

  function placeTimeline() {
    selection.style.left = `${toX(range[0])}%`;
    selection.style.width = `${toX(range[1]) - toX(range[0])}%`;
    startHandle.style.left = `${toX(range[0])}%`;
    endHandle.style.left = `${toX(range[1])}%`;
    startHandle.hidden = !inView(range[0]);
    endHandle.hidden = !inView(range[1]);
    playheadLine.style.left = `${toX(playhead)}%`;
    playheadLine.hidden = !source || !inView(playhead);
    // The strip lights where the clip is, which is where the playhead can go.
    const clamp = (value: number) => Math.min(100, Math.max(0, value));
    const lit = [...spans()].sort((a, b) => a[0] - b[0]).flatMap(([start, end]) => [`transparent ${clamp(toX(start))}%`, `var(--ag-accent) ${clamp(toX(start))}%`, `var(--ag-accent) ${clamp(toX(end))}%`, `transparent ${clamp(toX(end))}%`]);
    scrub.style.setProperty("--ag-lit", `linear-gradient(to right, ${["transparent 0%", ...lit, "transparent 100%"].join(", ")})`);
    scrub.setAttribute("aria-valuemin", "0");
    scrub.setAttribute("aria-valuemax", String(Math.round(duration() * 10) / 10));
    scrub.setAttribute("aria-valuenow", String(Math.round(playhead * 10) / 10));
    scrub.setAttribute("aria-valuetext", formatTime(playhead));
    const length = range[1] - range[0];
    for (const [handleNode, value] of [[startHandle, range[0]], [endHandle, range[1]]] as const) {
      handleNode.setAttribute("aria-valuemin", "0");
      handleNode.setAttribute("aria-valuemax", String(Math.round(duration() * 10) / 10));
      handleNode.setAttribute("aria-valuenow", String(Math.round(value * 10) / 10));
      handleNode.setAttribute("aria-valuetext", `${formatTime(value)}, clip ${formatTime(length)} long`);
    }
    clipClock.textContent = `${formatTime(Math.max(0, clipTime()))} / ${formatTime(clipLength())}`;
    const outlined = source?.outlined ?? 0;
    reading.textContent = source && outlined < duration() ? labels.reading(clock(outlined), clock(duration())) : "";
    // The zoom keys show for recordings long enough to need them, and rest at their limits.
    const span = view[1] - view[0];
    zoomKeys.hidden = !source || duration() <= ZOOMABLE;
    zoomInButton.disabled = span <= Math.min(10, duration()) + 1e-6;
    zoomOutButton.disabled = wholeButton.disabled = span >= duration() - 1e-6;
    // A part can be added while the clip has room for the whole selected stretch.
    exportButton.disabled = !source;
    openButton.disabled = exporting;
    const full = !source || partsLength(parts) + length > maxLength + 1e-6;
    addPartButton.disabled = full;
    addPartButton.title = source && full ? labels.partsFull : labels.addPartHint;
  }

  function setRange(start: number, end: number, which?: "start" | "end", reveal = true) {
    if (exporting) return;
    const total = duration() || Math.max(start, end);
    start = Math.max(0, Math.min(start, total - MIN_LENGTH));
    end = Math.min(total, Math.max(end, start + MIN_LENGTH));
    // The longest clip allowed: the edge being dragged pushes the other along rather than going past it.
    if (end - start > maxLength) {
      if (which === "start") end = start + maxLength;
      else start = end - maxLength;
    }
    range = [start, end];
    if (playhead < start || playhead > end) playhead = start;
    if (reveal && source) view = showSpan(view, duration(), range);
    drawWave();
    drawMap();
    placeTimeline();
    rebuild();
    scheduleClip();
  }

  // Playback: the picture follows the sound.

  let frame = 0;
  let playing = 0;
  let shownCue = -1;
  function tick() {
    frame = 0;
    if (audio.paused) return;
    playhead = audio.currentTime;
    const list = spans();
    if (playhead >= list[playing][1]) {
      playing++;
      if (playing >= list.length) {
        stop();
        playhead = list[0][0];
        painter.reset();
        paint();
        placeTimeline();
        return;
      }
      playhead = list[playing][0];
      audio.currentTime = playhead;
    }
    paint();
    placeTimeline();
    // The captions list keeps the one being said on show.
    const active = cueAt(cues, playhead);
    if (active !== shownCue) {
      shownCue = active;
      renderCues();
    }
    frame = requestAnimationFrame(tick);
  }

  function play() {
    if (!source || exporting) return;
    const list = spans();
    playing = list.findIndex(([start, end]) => playhead >= start && playhead < end - 0.05);
    if (playing < 0) {
      playing = 0;
      playhead = list[0][0];
    }
    void loadClip().catch(() => {});
    audio.currentTime = playhead;
    painter.reset();
    void audio.play();
    if (music) {
      musicAudio.currentTime = clipTime() % music.duration;
      musicAudio.volume = musicVolume;
      void musicAudio.play();
    }
    playButton.replaceChildren(icon(ICONS.pause));
    playButton.setAttribute("aria-label", labels.pause);
    playButton.title = labels.pause;
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    audio.pause();
    musicAudio.pause();
    cancelAnimationFrame(frame);
    playButton.replaceChildren(icon(ICONS.play));
    playButton.setAttribute("aria-label", labels.play);
    playButton.title = labels.play;
    if (tapping) setTapping(false);
  }

  function seek(time: number) {
    playhead = intoClip(Math.max(0, Math.min(duration(), time)));
    if (!audio.paused) {
      audio.currentTime = playhead;
      if (music) musicAudio.currentTime = clipTime() % music.duration;
    }
    painter.reset();
    paint();
    placeTimeline();
    renderCues();
  }

  // Captions: a page of the clip's captions to edit, a transcript to spread, and timing by tapping along.

  let cuePage = 0;
  // How many rows fit, measured from the list's room on a wide editor; a narrow one lists them all.
  let perPage = 0;
  function measureCues() {
    const wide = root.clientWidth >= 760;
    // A real row's height, since touch screens make them taller; 36 px until one is on show.
    const row = (cueList.querySelector<HTMLElement>(".ag-cue")?.offsetHeight ?? 32) + 4;
    const next = wide && cueList.clientHeight ? Math.max(1, Math.floor((cueList.clientHeight + 4) / row)) : 0;
    if (next !== perPage) {
      perPage = next;
      renderCues();
    }
  }

  // Captions can arrive while a row is open for typing, so a row finds its caption again by what it is, not where it was.
  const findCue = (cue: Cue) => cues.findIndex((item) => item === cue || (item.start === cue.start && item.end === cue.end && item.text === cue.text));

  function renderCues() {
    const shown = cues.map((cue, index) => ({ cue, index })).filter(({ cue }) => cue.end > range[0] && cue.start < range[1]);
    const active = cueAt(cues, playhead);
    const size = perPage || Math.max(1, shown.length);
    const pages = Math.max(1, Math.ceil(shown.length / size));
    if (!audio.paused) {
      const at = shown.findIndex(({ index }) => index === active);
      if (at >= 0) cuePage = Math.floor(at / size);
    }
    cuePage = Math.min(Math.max(0, cuePage), pages - 1);
    const page = shown.slice(cuePage * size, cuePage * size + size);
    const rows = page.map(({ cue, index }) => {
      const row = element("li", "ag-cue");
      if (index === active) row.dataset.active = "";
      const time = element("button", "ag-time");
      time.type = "button";
      time.textContent = formatTime(cue.start);
      time.setAttribute("aria-label", labels.seek(formatTime(cue.start)));
      time.addEventListener("click", () => seek(cue.start));
      const text = element("input", "ag-input ag-cue-text");
      text.type = "text";
      text.value = cue.text;
      text.autocomplete = "off";
      text.setAttribute("aria-label", `${labels.captionText} ${formatTime(cue.start)}`);
      text.addEventListener("change", () => {
        const at = findCue(cue);
        // New words lose the old ones' timings and share the caption's time again.
        if (at >= 0) cues[at] = { start: cue.start, end: cue.end, text: text.value.trim(), ...(cue.speaker ? { speaker: cue.speaker } : {}) };
        cues = cues.filter((item) => item.text);
        rebuild();
      });
      const remove = iconButton("ag-remove", labels.removeCaption, ICONS.remove);
      remove.addEventListener("click", () => {
        const at = findCue(cue);
        if (at >= 0) cues.splice(at, 1);
        rebuild();
      });
      row.append(time, text, remove);
      return row;
    });
    pager.hidden = pages <= 1;
    pageText.textContent = shown.length ? labels.page(cuePage * size + 1, Math.min(shown.length, (cuePage + 1) * size), shown.length) : "";
    earlierButton.disabled = cuePage === 0;
    laterButton.disabled = cuePage >= pages - 1;
    // Rebuilding the list would drop the focus of someone typing, so it is left alone while they are.
    if (cueList.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement) return;
    if (!rows.length) {
      const empty = element("li", "ag-cues-empty");
      empty.textContent = labels.noCaptions;
      rows.push(empty);
    }
    cueList.replaceChildren(...rows);
  }

  function setTapping(on: boolean) {
    if (on) {
      // Timing starts over from the top of the clip, so every caption in it gets a tap.
      tapping = false;
      stop();
      playhead = range[0];
      tapIndex = Math.max(0, cues.findIndex((cue) => cue.end > range[0]));
    }
    tapping = on;
    tapButton.setAttribute("aria-pressed", String(on));
    root.toggleAttribute("data-tapping", on);
    if (on) {
      showTapHint();
      play();
      preview.focus({ preventScroll: true });
    } else tapHint.hidden = true;
  }

  function showTapHint() {
    const next = cues[tapIndex];
    tapHint.hidden = !next;
    if (next) tapHint.textContent = labels.tapNext(next.text);
  }

  function tap() {
    if (!tapping || tapIndex >= cues.length) return;
    cues = markStart(cues, tapIndex, audio.currentTime);
    tapIndex++;
    showTapHint();
    painter = new Painter(scene());
    renderCues();
  }

  // Loading.

  let outlineTimer = 0;
  function outlineChanged() {
    if (outlineTimer) return;
    outlineTimer = window.setTimeout(() => {
      outlineTimer = 0;
      drawWave();
      drawMap();
      placeTimeline();
    }, 150);
  }

  let opening = 0;
  async function load(from: string | Blob) {
    if (exporting) return;
    const mine = ++opening;
    stop();
    root.dataset.state = "loading";
    announce(labels.loading);
    let next: AudioSource;
    try {
      next = await openSource(from, { onOutline: outlineChanged });
    } catch (error) {
      if (mine !== opening) return;
      root.dataset.state = source ? "ready" : "empty";
      tell(labels.openFailed);
      throw error;
    }
    // A recording picked after this one has taken its place.
    if (mine !== opening) return next.close();
    source?.close();
    source = next;
    sourceInput = from;
    generation++;
    clipAudio = null;
    if (parts.length) {
      parts = [];
      renderParts();
      options.onParts?.([]);
    }
    audio.src = next.url;
    root.dataset.state = "ready";
    live.textContent = "";
    const keep = firstLoad && range[1] > range[0] && range[1] <= next.duration;
    firstLoad = false;
    const [start, end] = keep ? range : [0, Math.min(next.duration, 30)];
    view = initialView(next.duration, [start, end]);
    playhead = start;
    setRange(start, end);
  }

  // Exporting.

  async function exportVideo(): Promise<ExportResult | null> {
    if (!source || exporting) return null;
    stop();
    exporting = true;
    root.dataset.state = "exporting";
    exportButton.setAttribute("aria-disabled", "true");
    try {
      const frozen = scene();
      const samples = await loadClip();
      const result = await exportClip({ ...frozen, audio: { ...frozen.audio, samples } }, {
        onProgress: (fraction) => {
          const percent = Math.round(fraction * 100);
          meter.style.setProperty("--progress", String(fraction));
          rename(exportButton, `${percent}%`);
          exportButton.setAttribute("aria-label", labels.exporting(percent));
        },
      });
      announce(labels.exported(clipLength()));
      if (options.onExport) options.onExport(result);
      else {
        const link = element("a", "");
        link.href = URL.createObjectURL(result.blob);
        link.download = `clip.${result.extension}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      }
      return result;
    } catch (error) {
      tell(labels.failed);
      throw error;
    } finally {
      exporting = false;
      root.dataset.state = "ready";
      exportButton.removeAttribute("aria-disabled");
      rename(exportButton, labels.export);
      exportButton.removeAttribute("aria-label");
      meter.style.removeProperty("--progress");
    }
  }

  // Parts: the add key keeps the selected stretch; each chip selects its part, removes it, or drags to a new place.

  function partsChanged() {
    if (exporting) return;
    renderParts();
    drawWave();
    drawMap();
    placeTimeline();
    rebuild();
    scheduleClip();
    options.onParts?.(parts.map(([start, end]) => [start, end]));
  }

  function renderParts() {
    partList.replaceChildren(...parts.map(([start, end], index) => {
      const item = element("li", "ag-part");
      item.dataset.index = String(index);
      const pick = element("button", "ag-part-pick");
      pick.type = "button";
      pick.textContent = `${index + 1} · ${formatTime(start)}–${formatTime(end)}`;
      pick.setAttribute("aria-label", labels.part(index + 1, formatTime(start), formatTime(end)));
      pick.addEventListener("click", () => {
        if (reordered) return;
        setRange(start, end);
        seek(start);
      });
      const remove = iconButton("ag-part-remove", labels.removePart(index + 1), ICONS.remove);
      remove.addEventListener("click", () => {
        if (exporting) return;
        parts.splice(index, 1);
        partsChanged();
      });
      item.append(pick, remove);
      return item;
    }));
  }

  addPartButton.addEventListener("click", () => {
    if (!source || exporting || partsLength(parts) + range[1] - range[0] > maxLength + 1e-6) return;
    parts.push([range[0], range[1]]);
    partsChanged();
    announce(labels.part(parts.length, formatTime(range[0]), formatTime(range[1])));
  });

  let reorder: { pointerId: number; index: number; x: number } | null = null;
  let reordered = false;
  partList.addEventListener("pointerdown", (event) => {
    const item = (event.target as Element).closest<HTMLElement>(".ag-part");
    if (!item || exporting || (event.target as Element).closest(".ag-part-remove") || event.button !== 0) return;
    reorder = { pointerId: event.pointerId, index: Number(item.dataset.index), x: event.clientX };
    reordered = false;
  });
  partList.addEventListener("pointermove", (event) => {
    if (!reorder || event.pointerId !== reorder.pointerId) return;
    // A few pixels of travel before it counts as a drag, so a tap still picks the part.
    if (!reordered && Math.abs(event.clientX - reorder.x) < 6) return;
    if (!reordered) {
      reordered = true;
      capture(partList, event.pointerId);
      root.dataset.reordering = "";
    }
    const over = [...partList.children].findIndex((child) => {
      const box = child.getBoundingClientRect();
      return event.clientX >= box.left && event.clientX <= box.right;
    });
    if (over < 0 || over === reorder.index) return;
    const [moved] = parts.splice(reorder.index, 1);
    parts.splice(over, 0, moved);
    reorder.index = over;
    renderParts();
  });
  const endReorder = () => {
    if (reorder && reordered) partsChanged();
    reorder = null;
    delete root.dataset.reordering;
    // The click that ends a drag isn't a pick.
    setTimeout(() => (reordered = false));
  };
  partList.addEventListener("pointerup", endReorder);
  partList.addEventListener("pointercancel", endReorder);
  renderParts();

  // Pointer on the recording: drag an edge, drag the clip along, or drag across the rest to select a new stretch.

  let drag: { kind: "start" | "end" | "move" | "new"; pointerId: number; from: number; x: number; range: [number, number] } | null = null;
  const timeAt = (clientX: number) => {
    const box = track.getBoundingClientRect();
    return view[0] + Math.max(0, Math.min(1, (clientX - box.left) / box.width)) * (view[1] - view[0]);
  };
  function capture(node: HTMLElement, pointerId: number) {
    try {
      node.setPointerCapture(pointerId);
    } catch {
      // A pointer from a script can't be captured; the drag still works while it stays over the element.
    }
  }
  track.addEventListener("pointerdown", (event) => {
    if (!source || exporting || event.button !== 0) return;
    const target = event.target as Element;
    const time = timeAt(event.clientX);
    const kind = target === startHandle ? "start" : target === endHandle ? "end" : time > range[0] && time < range[1] ? "move" : "new";
    drag = { kind, pointerId: event.pointerId, from: time, x: event.clientX, range: [...range] };
    capture(track, event.pointerId);
    event.preventDefault();
  });
  track.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const delta = timeAt(event.clientX) - drag.from;
    const [start, end] = drag.range;
    if (drag.kind === "start") setRange(start + delta, end, "start", false);
    else if (drag.kind === "end") setRange(start, end + delta, "end", false);
    else if (drag.kind === "new") {
      // A press that doesn't travel leaves the selection as it was.
      if (Math.abs(event.clientX - drag.x) < 4) return;
      const at = timeAt(event.clientX);
      setRange(Math.min(drag.from, at), Math.max(drag.from, at), at < drag.from ? "start" : "end", false);
    } else {
      const shift = Math.max(-start, Math.min(duration() - end, delta));
      setRange(start + shift, end + shift, undefined, false);
    }
  });
  const endDrag = () => (drag = null);
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  for (const [handleNode, which] of [[startHandle, "start"], [endHandle, "end"]] as const) {
    handleNode.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 1 : 0.1;
      const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? step : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -step : 0;
      if (!delta) return;
      event.preventDefault();
      if (which === "start") setRange(range[0] + delta, range[1], "start");
      else setRange(range[0], range[1] + delta, "end");
    });
  }

  // Pointer on the strip: press anywhere and drag, and the playhead and the picture follow. Playback pauses while it
  // moves and carries on from where it is let go.
  let scrubbing: { pointerId: number; resume: boolean } | null = null;
  scrub.addEventListener("pointerdown", (event) => {
    if (!source || event.button !== 0) return;
    scrubbing = { pointerId: event.pointerId, resume: !audio.paused && !tapping };
    if (!audio.paused) stop();
    root.dataset.scrubbing = "";
    capture(scrub, event.pointerId);
    event.preventDefault();
    scrub.focus({ preventScroll: true });
    seek(timeAt(event.clientX));
  });
  scrub.addEventListener("pointermove", (event) => {
    if (scrubbing?.pointerId === event.pointerId) seek(timeAt(event.clientX));
  });
  const endScrub = () => {
    if (!scrubbing) return;
    const { resume } = scrubbing;
    scrubbing = null;
    delete root.dataset.scrubbing;
    if (resume) play();
  };
  scrub.addEventListener("pointerup", endScrub);
  scrub.addEventListener("pointercancel", endScrub);
  scrub.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 1 : 0.1;
    const list = spans();
    const to = event.key === "ArrowRight" || event.key === "ArrowUp" ? playhead + step
      : event.key === "ArrowLeft" || event.key === "ArrowDown" ? playhead - step
        : event.key === "Home" ? list[0][0]
          : event.key === "End" ? list[list.length - 1][1]
            : null;
    if (to === null) return;
    event.preventDefault();
    seek(to);
  });

  // Zoom: the keys, Ctrl or Cmd with the wheel about the pointer, and a sideways swipe or Shift with the wheel to move.
  const zoomAnchor = () => (inView((range[0] + range[1]) / 2) ? (range[0] + range[1]) / 2 : (view[0] + view[1]) / 2);
  zoomInButton.addEventListener("click", () => setView(zoomView(view, duration(), 0.5, zoomAnchor())));
  zoomOutButton.addEventListener("click", () => setView(zoomView(view, duration(), 2, zoomAnchor())));
  wholeButton.addEventListener("click", () => setView([0, duration()]));
  zoomed.addEventListener("wheel", (event) => {
    if (!source) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      setView(zoomView(view, duration(), Math.exp(event.deltaY * 0.002), timeAt(event.clientX)));
    } else if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      event.preventDefault();
      const delta = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
      setView(panView(view, duration(), (delta / Math.max(1, track.clientWidth)) * (view[1] - view[0])));
    }
  }, { passive: false });
  // The overview moves the view: press where to look, and drag.
  let mapping: number | null = null;
  const lookAt = (clientX: number) => {
    const box = map.getBoundingClientRect();
    const time = Math.max(0, Math.min(1, (clientX - box.left) / box.width)) * duration();
    setView(panView(view, duration(), time - (view[0] + view[1]) / 2));
  };
  map.addEventListener("pointerdown", (event) => {
    if (!source || event.button !== 0) return;
    mapping = event.pointerId;
    capture(map, event.pointerId);
    lookAt(event.clientX);
  });
  map.addEventListener("pointermove", (event) => mapping === event.pointerId && lookAt(event.clientX));
  map.addEventListener("pointerup", () => (mapping = null));
  map.addEventListener("pointercancel", () => (mapping = null));

  // Buttons and keys.

  playButton.addEventListener("click", () => (audio.paused ? play() : stop()));
  exportButton.addEventListener("click", () => void exportVideo().catch(() => {}));
  openButton.addEventListener("click", () => audioInput.click());
  audioInput.addEventListener("change", () => {
    const file = audioInput.files?.[0];
    if (file) void load(file).catch(() => {});
    audioInput.value = "";
  });
  tapButton.addEventListener("click", () => setTapping(!tapping));
  preview.addEventListener("pointerdown", () => tapping && tap());
  addButton.addEventListener("click", () => {
    const start = Math.max(range[0], playhead);
    cues = [...cues, { start, end: Math.min(range[1], start + 2), text: labels.captionText }].sort((a, b) => a.start - b.start);
    // The new caption's page comes up, with its text ready to type over.
    const shown = cues.filter((cue) => cue.end > range[0] && cue.start < range[1]);
    const at = shown.findIndex((cue) => cue.start === start && cue.text === labels.captionText);
    if (perPage && at >= 0) cuePage = Math.floor(at / perPage);
    rebuild();
    const input = [...cueList.querySelectorAll<HTMLInputElement>(".ag-cue-text")].find((item) => item.value === labels.captionText);
    input?.focus();
    input?.select();
  });
  importButton.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (!file) return;
    cues = parseSubtitles(await file.text());
    rebuild();
  });
  downloadButton.addEventListener("click", () => {
    const link = element("a", "");
    link.href = URL.createObjectURL(new Blob([toSRT(clip(cues, range[0], range[1]))], { type: "text/plain" }));
    link.download = "clip.srt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  });
  spreadButton.addEventListener("click", () => {
    const lines = transcriptInput.value.split("\n");
    const outside = cues.filter((cue) => cue.end <= range[0] || cue.start >= range[1]);
    cues = [...outside, ...spread(lines, range[0], range[1])].sort((a, b) => a.start - b.start);
    cuePage = 0;
    rebuild();
  });
  earlierButton.addEventListener("click", () => {
    cuePage--;
    renderCues();
  });
  laterButton.addEventListener("click", () => {
    cuePage++;
    renderCues();
  });

  // Space plays and pauses, unless someone is typing; while tapping, it marks the next caption instead.
  root.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, summary, [role=radio], [role=slider], [role=tab]") || event.key !== " ") return;
    if (target.tagName === "BUTTON") return;
    event.preventDefault();
    if (tapping) tap();
    else if (audio.paused) play();
    else stop();
  });

  // A file dropped anywhere on the editor opens: a recording, captions, or a picture for the profile.
  root.addEventListener("dragover", (event) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    root.dataset.drop = "";
  });
  root.addEventListener("dragleave", (event) => {
    if (!root.contains(event.relatedTarget as Node)) delete root.dataset.drop;
  });
  root.addEventListener("drop", (event) => {
    delete root.dataset.drop;
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    event.preventDefault();
    if (file.type.startsWith("image/")) void loadImage(file).then((image) => {
      cover = image;
      coverSource = file;
      coverRow.show(file);
      rebuild();
      changed();
    }).catch(() => tell(labels.pictureFailed));
    else if (/\.(srt|vtt)$/i.test(file.name)) void file.text().then((text) => {
      cues = parseSubtitles(text);
      rebuild();
    });
    else void load(file).catch(() => {});
  });

  const observer = new ResizeObserver(() => {
    rail.setAttribute("aria-orientation", root.clientWidth < 760 ? "horizontal" : "vertical");
    drawWave();
    drawMap();
    measureCues();
  });
  observer.observe(track);
  observer.observe(cueList);
  observer.observe(root);

  selectTab(tab);
  sizePreview();
  rebuild();
  placeTimeline();
  coverRow.show(coverSource);
  backgroundRow.show(backdropSource);
  musicRow.show(musicSource);
  if (options.cover) void loadImage(options.cover).then((image) => {
    cover = image;
    rebuild();
  });
  if (options.background) void loadImage(options.background).then((image) => {
    backdrop = image;
    rebuild();
  });
  if (options.music) void setMusic(options.music).then(() => musicRow.show(options.music!)).catch(() => musicRow.show(null));
  if (options.logo) void loadImage(options.logo).then((image) => {
    logo = image;
    rebuild();
  });
  const ready = options.audio ? load(options.audio) : Promise.resolve();
  root.dataset.state = options.audio ? "loading" : "empty";

  return {
    element: root,
    get captions() {
      return cues.map((cue) => ({ ...cue }));
    },
    get range() {
      return [...range] as [number, number];
    },
    get duration() {
      return duration();
    },
    async load(next) {
      await ready.catch(() => {});
      await load(next);
    },
    setCaptions(next) {
      // While tapping, the caption waiting for its tap stays the one waited for, wherever new captions put it.
      const waiting = tapping ? cues[tapIndex] : null;
      cues = [...next].sort((a, b) => a.start - b.start);
      if (waiting) {
        const at = cues.findIndex((cue) => cue.text === waiting.text && Math.abs(cue.start - waiting.start) < 1e-3);
        tapIndex = at >= 0 ? at : Math.max(0, cues.findIndex((cue) => cue.start >= waiting.start));
      }
      rebuild();
    },
    setRange: (start, end) => setRange(start, end),
    play,
    pause: stop,
    export: exportVideo,
    get settings() {
      return settings();
    },
    get parts() {
      return parts.map(([start, end]) => [start, end] as [number, number]);
    },
    setParts(next) {
      if (exporting) return;
      parts = next.filter(([start, end]) => end > start).map(([start, end]) => [start, end]);
      renderParts();
      drawWave();
      drawMap();
      placeTimeline();
      rebuild();
      scheduleClip();
    },
    get source() {
      return sourceInput;
    },
    readAudio(start, end, sampleRate) {
      return source ? source.read(start, end, sampleRate) : Promise.reject(new Error("No recording is open"));
    },
    setOverlay(next) {
      overlay = next;
      rebuild();
    },
    selectTab,
    slots: { header: headerSlot, actions: actionsSlot, captions: captionsSlot },
    destroy() {
      stop();
      observer.disconnect();
      source?.close();
      source = null;
      music?.close();
      root.remove();
    },
  };
}
