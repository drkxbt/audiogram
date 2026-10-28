import { clip, cueAt, formatTime, markStart, paginate, parseSubtitles, spread, toSRT, type Cue } from "./captions.js";
import { exportClip, type ExportResult } from "./export.js";
import { Painter, SIZES, THEMES, type Layout, type Overlay, type Scene, type Theme, type Visual } from "./render.js";
import { peaks } from "./wave.js";

export interface Labels {
  editor: string;
  open: string;
  play: string;
  pause: string;
  export: string;
  exporting: (percent: number) => string;
  exported: (seconds: number) => string;
  failed: string;
  timeline: string;
  clipStart: string;
  clipEnd: string;
  layouts: Record<Layout, string>;
  visuals: Record<Visual, string>;
  theme: (name: string) => string;
  title: string;
  speaker: string;
  handle: string;
  cover: string;
  captions: string;
  tap: string;
  tapNext: (text: string) => string;
  transcript: string;
  spread: string;
  importCaptions: string;
  downloadCaptions: string;
  addCaption: string;
  removeCaption: string;
  seek: (time: string) => string;
  captionText: string;
  drop: string;
  loading: string;
  empty: string;
}

export interface EditorOptions {
  /** An address or a file of any audio the browser can decode. */
  audio?: string | Blob;
  /** Captions for the whole recording, in seconds from its start. */
  captions?: Cue[];
  /** The stretch to start with, in seconds. */
  range?: [number, number];
  title?: string;
  speaker?: string;
  handle?: string;
  cover?: string | Blob;
  layout?: Layout;
  visual?: Visual;
  theme?: number | Theme;
  /** The longest clip, in seconds. 140 by default: the longest video most X accounts can post. */
  maxLength?: number;
  font?: string;
  labels?: Partial<Labels>;
  /** Called with the finished video. Without it, the video downloads. */
  onExport?: (result: ExportResult) => void;
  /** Drawn over every frame of the preview and the export. */
  overlay?: Overlay;
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
  layout: Layout;
  visual: Visual;
  /** An index into THEMES, or the theme itself when it isn't one of them. */
  theme: number | Theme;
}

export interface Editor {
  readonly element: HTMLElement;
  readonly captions: Cue[];
  readonly range: [number, number];
  load(audio: string | Blob): Promise<void>;
  setCaptions(cues: Cue[]): void;
  setRange(start: number, end: number): void;
  play(): void;
  pause(): void;
  export(): Promise<ExportResult | null>;
  readonly settings: Settings;
  /** The recording on show, as it was opened or given; null before one is. */
  readonly source: string | Blob | null;
  setOverlay(overlay: Overlay | null): void;
  destroy(): void;
}

const DEFAULT_LABELS: Labels = {
  editor: "Clip maker",
  open: "Open an audio file",
  play: "Play the clip",
  pause: "Pause",
  export: "Export the video",
  exporting: (percent) => `Making the video, ${percent}%`,
  exported: (seconds) => `The video is ready: ${formatTime(seconds)} long.`,
  failed: "The video couldn't be made in this browser.",
  timeline: "The recording",
  clipStart: "Clip start",
  clipEnd: "Clip end",
  layouts: { square: "Square, 1:1", portrait: "Tall, 4:5", landscape: "Wide, 16:9" },
  visuals: { bars: "Bars", wave: "Wave", pulse: "Pulse" },
  theme: (name) => `${name} colours`,
  title: "Title",
  speaker: "Name",
  handle: "Handle",
  cover: "Choose a cover picture",
  captions: "Captions",
  tap: "Time the captions by tapping",
  tapNext: (text) => `Tap the picture when this starts: ${text}`,
  transcript: "Paste a transcript, one caption to a line",
  spread: "Spread the transcript over the clip",
  importCaptions: "Open captions from an SRT or VTT file",
  downloadCaptions: "Download the clip's captions as SRT",
  addCaption: "Add a caption at the playhead",
  removeCaption: "Remove this caption",
  seek: (time) => `Go to ${time}`,
  captionText: "Caption",
  drop: "Drop an audio file here",
  loading: "Reading the audio",
  empty: "Open a recording of a Space, a podcast or a voice note to start.",
};

const ICONS: Record<string, string> = {
  open: '<path d="M4 7.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18V9.5A1.5 1.5 0 0 0 18.5 8H12l-2-2.5H5.5A1.5 1.5 0 0 0 4 7Z"/>',
  play: '<path class="fill" d="M8 5.5v13l10.5-6.5Z"/>',
  pause: '<rect class="fill" x="6.5" y="5" width="4" height="14" rx="1"/><rect class="fill" x="13.5" y="5" width="4" height="14" rx="1"/>',
  export: '<path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
  portrait: '<rect x="6.5" y="3.5" width="11" height="17" rx="1.5"/>',
  landscape: '<rect x="3" y="6.5" width="18" height="11" rx="1.5"/>',
  bars: '<path d="M5 10v4M8.5 7v10M12 4.5v15M15.5 7v10M19 10v4"/>',
  wave: '<path d="M3 12c2 0 2-5 4-5s2 10 4 10 2-13 4-13 2 8 4 8h2"/>',
  pulse: '<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7.5" opacity=".55"/>',
  cover: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-8 8.5"/>',
  tap: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.6a5 5 0 0 1-3.9-1.9L4.8 15a1.5 1.5 0 0 1 2.3-1.9L9 15"/>',
  spread: '<path d="M4 6h16M4 12h10M4 18h13"/>',
  file: '<path d="M6 4.5h8l4 4V19a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 19ZM14 4.5V9h4"/><path d="M9 13h6M9 16h4"/>',
  save: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  remove: '<path d="M6.5 6.5l11 11m0-11-11 11"/>',
};

const MIN_LENGTH = 1;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function icon(markup: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = markup;
  return svg;
}

/** A button with an icon only; its name is for screen readers and the tooltip. */
function iconButton(className: string, label: string, markup: string): HTMLButtonElement {
  const button = element("button", `ag-btn ${className}`);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(icon(markup));
  return button;
}

/** Captions on screen break into pages short enough for the shape of the video. */
const pageLength = (layout: Layout) => (layout === "landscape" ? 46 : layout === "portrait" ? 34 : 32);

async function decode(source: string | Blob): Promise<{ samples: Float32Array; sampleRate: number; url: string }> {
  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
  const data = await blob.arrayBuffer();
  // Decoded at 48 kHz, the rate the AAC encoder and most players expect, and mixed down to one channel.
  const buffer = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(data);
  const samples = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const part = buffer.getChannelData(channel);
    for (let i = 0; i < part.length; i++) samples[i] += part[i] / buffer.numberOfChannels;
  }
  return { samples, sampleRate: buffer.sampleRate, url: URL.createObjectURL(blob) };
}

async function loadImage(source: string | Blob): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = typeof source === "string" ? source : URL.createObjectURL(source);
  await image.decode();
  return image;
}

export function audiogram(container: HTMLElement, options: EditorOptions = {}): Editor {
  const labels: Labels = { ...DEFAULT_LABELS, ...options.labels };
  const maxLength = options.maxLength ?? 140;
  let recording: { samples: Float32Array; sampleRate: number; url: string; duration: number } | null = null;
  let cues: Cue[] = [...(options.captions ?? [])].sort((a, b) => a.start - b.start);
  let range: [number, number] = options.range ?? [0, 0];
  let playhead = range[0];
  let layout: Layout = options.layout ?? "square";
  let visual: Visual = options.visual ?? "bars";
  let theme: Theme = typeof options.theme === "object" ? options.theme : THEMES[options.theme ?? 0] ?? THEMES[0];
  let title = options.title ?? "";
  let speaker = options.speaker ?? "";
  let handle = options.handle ?? "";
  let cover: HTMLImageElement | null = null;
  let coverSource: Blob | string | null = options.cover ?? null;
  let source: string | Blob | null = null;
  let overlay: Overlay | null = options.overlay ?? null;
  let tapping = false;
  let tapIndex = 0;
  let exporting = false;

  // The frame: the picture, the panel of choices, and the recording along the bottom.
  const root = element("div", "ag");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", labels.editor);

  const stage = element("div", "ag-stage");
  const preview = element("canvas", "ag-preview");
  preview.setAttribute("role", "img");
  preview.tabIndex = 0;
  const tapHint = element("p", "ag-tap-hint");
  tapHint.hidden = true;
  const emptyNote = element("p", "ag-empty");
  emptyNote.textContent = labels.empty;
  stage.append(preview, tapHint, emptyNote);

  const panel = element("div", "ag-panel");
  const choice = (name: string, items: Array<{ value: string; label: string; markup?: string; swatch?: Theme }>, current: string, apply: (value: string) => void) => {
    const group = element("div", "ag-choice");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", name);
    const buttons = items.map((item) => {
      const button = item.markup ? iconButton("ag-pick", item.label, item.markup) : element("button", "ag-btn ag-swatch");
      if (!item.markup) {
        button.type = "button";
        button.setAttribute("aria-label", item.label);
        button.title = item.label;
        const dot = element("span", "ag-dot");
        dot.style.background = `linear-gradient(135deg, ${item.swatch!.background} 50%, ${item.swatch!.accent} 50%)`;
        button.append(dot);
      }
      button.setAttribute("role", "radio");
      button.dataset.value = item.value;
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
    return group;
  };
  const layoutChoice = choice("Shape", (["square", "portrait", "landscape"] as Layout[]).map((value) => ({ value, label: labels.layouts[value], markup: ICONS[value] })), layout, (value) => {
    layout = value as Layout;
    rebuild();
    changed();
  });
  const visualChoice = choice("Visual", (["bars", "wave", "pulse"] as Visual[]).map((value) => ({ value, label: labels.visuals[value], markup: ICONS[value] })), visual, (value) => {
    visual = value as Visual;
    rebuild();
    changed();
  });
  const themeChoice = choice("Colours", THEMES.map((item, index) => ({ value: String(index), label: labels.theme(item.name), swatch: item })), String(Math.max(0, THEMES.indexOf(theme))), (value) => {
    theme = THEMES[Number(value)];
    rebuild();
    changed();
  });
  const looks = element("div", "ag-row");
  const coverButton = iconButton("ag-cover", labels.cover, ICONS.cover);
  const coverInput = element("input", "ag-hidden");
  coverInput.type = "file";
  coverInput.accept = "image/*";
  coverInput.tabIndex = -1;
  looks.append(layoutChoice, visualChoice, coverButton, coverInput);

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
  const fields = element("div", "ag-fields");
  fields.append(
    field(labels.title, title, (value) => (title = value)),
    field(labels.speaker, speaker, (value) => (speaker = value)),
    field(labels.handle, handle, (value) => (handle = value)),
  );

  const captionsHead = element("div", "ag-captions-head");
  const captionsTitle = element("h3", "ag-heading");
  captionsTitle.textContent = labels.captions;
  const tapButton = iconButton("ag-tap", labels.tap, ICONS.tap);
  tapButton.setAttribute("aria-pressed", "false");
  const importButton = iconButton("", labels.importCaptions, ICONS.file);
  const importInput = element("input", "ag-hidden");
  importInput.type = "file";
  importInput.accept = ".srt,.vtt,text/vtt";
  importInput.tabIndex = -1;
  const downloadButton = iconButton("", labels.downloadCaptions, ICONS.save);
  const addButton = iconButton("", labels.addCaption, ICONS.add);
  captionsHead.append(captionsTitle, element("span", "ag-grow"), tapButton, addButton, importButton, downloadButton, importInput);
  const cueList = element("ol", "ag-cues");
  const transcript = element("div", "ag-transcript");
  const transcriptLabel = element("label", "ag-field");
  const transcriptName = element("span", "ag-field-name");
  transcriptName.textContent = labels.transcript;
  const transcriptInput = element("textarea", "ag-input ag-textarea");
  transcriptInput.rows = 3;
  transcriptLabel.append(transcriptName, transcriptInput);
  const spreadButton = iconButton("", labels.spread, ICONS.spread);
  transcript.append(transcriptLabel, spreadButton);
  panel.append(looks, themeChoice, fields, captionsHead, cueList, transcript);

  const timeline = element("div", "ag-timeline");
  const openButton = iconButton("ag-open", labels.open, ICONS.open);
  const audioInput = element("input", "ag-hidden");
  audioInput.type = "file";
  audioInput.accept = "audio/*,video/*";
  audioInput.tabIndex = -1;
  const playButton = iconButton("ag-play", labels.play, ICONS.play);
  const clock = element("span", "ag-clock");
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
  const playheadLine = element("div", "ag-playhead");
  track.append(wave, selection, startHandle, endHandle, playheadLine);
  const exportButton = iconButton("ag-export", labels.export, ICONS.export);
  const meter = element("span", "ag-meter");
  exportButton.append(meter);
  timeline.append(openButton, audioInput, playButton, clock, track, exportButton);

  const live = element("div", "ag-live");
  live.setAttribute("role", "status");
  // The editor answers its own width, so the parts sit in a grid inside it rather than on it.
  const grid = element("div", "ag-grid");
  grid.append(stage, panel, timeline);
  root.append(grid, live);
  container.append(root);

  const audio = new Audio();
  audio.preload = "auto";

  const announce = (message: string) => {
    live.textContent = "";
    requestAnimationFrame(() => (live.textContent = message));
  };

  // The picture.

  const scene = (): Scene => ({
    layout,
    visual,
    theme,
    title,
    speaker,
    handle,
    cover,
    font: options.font,
    overlay: overlay ?? undefined,
    captions: paginate(clip(cues, range[0], range[1]), pageLength(layout)),
    audio: recording ? { samples: recording.samples, sampleRate: recording.sampleRate, start: range[0], end: range[1] } : { samples: new Float32Array(1), sampleRate: 48000, start: 0, end: 0 },
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
    painter.paint(ctx, playhead - range[0]);
    const index = cueAt(painter.scene.captions, playhead - range[0]);
    preview.setAttribute("aria-label", [title, speaker, index >= 0 ? painter.scene.captions[index].text : ""].filter(Boolean).join(". "));
  }

  const settings = (): Settings => ({
    title,
    speaker,
    handle,
    cover: coverSource,
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

  // The recording along the bottom.

  let peakCache: { width: number; data: Float32Array } | null = null;

  const toX = (time: number) => (recording ? (time / recording.duration) * 100 : 0);

  function drawWave() {
    const ratio = devicePixelRatio || 1;
    const width = Math.max(1, Math.round(track.clientWidth * ratio));
    const height = Math.max(1, Math.round(track.clientHeight * ratio));
    if (wave.width !== width || wave.height !== height) {
      wave.width = width;
      wave.height = height;
      peakCache = null;
    }
    const g = wave.getContext("2d")!;
    g.clearRect(0, 0, width, height);
    if (!recording) return;
    const bars = Math.floor(width / (3 * ratio));
    if (!peakCache || peakCache.width !== bars) peakCache = { width: bars, data: peaks(recording.samples, bars) };
    const style = getComputedStyle(root);
    const inside = style.getPropertyValue("--ag-wave-in").trim() || "#121212";
    const outside = style.getPropertyValue("--ag-wave").trim() || "#999";
    const mid = height / 2;
    for (let i = 0; i < bars; i++) {
      const low = peakCache.data[i * 2];
      const high = peakCache.data[i * 2 + 1];
      const time = ((i + 0.5) / bars) * recording.duration;
      g.fillStyle = time >= range[0] && time <= range[1] ? inside : outside;
      const amplitude = Math.max(1 * ratio, (high - low) * mid * 0.92);
      g.fillRect(i * 3 * ratio, mid - amplitude / 2, 2 * ratio, amplitude);
    }
  }

  function placeTimeline() {
    selection.style.left = `${toX(range[0])}%`;
    selection.style.width = `${toX(range[1]) - toX(range[0])}%`;
    startHandle.style.left = `${toX(range[0])}%`;
    endHandle.style.left = `${toX(range[1])}%`;
    playheadLine.style.left = `${toX(playhead)}%`;
    const length = range[1] - range[0];
    for (const [handleNode, value] of [[startHandle, range[0]], [endHandle, range[1]]] as const) {
      handleNode.setAttribute("aria-valuemin", "0");
      handleNode.setAttribute("aria-valuemax", String(Math.round((recording?.duration ?? 0) * 10) / 10));
      handleNode.setAttribute("aria-valuenow", String(Math.round(value * 10) / 10));
      handleNode.setAttribute("aria-valuetext", `${formatTime(value)}, clip ${formatTime(length)} long`);
    }
    clock.textContent = `${formatTime(Math.max(0, playhead - range[0]))} / ${formatTime(length)}`;
  }

  function setRange(start: number, end: number, which?: "start" | "end") {
    const total = recording?.duration ?? Math.max(start, end);
    start = Math.max(0, Math.min(start, total - MIN_LENGTH));
    end = Math.min(total, Math.max(end, start + MIN_LENGTH));
    // The longest clip X takes: the edge being dragged pushes the other along rather than going past it.
    if (end - start > maxLength) {
      if (which === "start") end = start + maxLength;
      else start = end - maxLength;
    }
    range = [start, end];
    if (playhead < start || playhead > end) playhead = start;
    drawWave();
    placeTimeline();
    rebuild();
  }

  // Playback: the picture follows the sound.

  let frame = 0;
  function tick() {
    frame = 0;
    if (audio.paused) return;
    playhead = audio.currentTime;
    if (playhead >= range[1]) {
      stop();
      playhead = range[0];
      painter.reset();
      paint();
      placeTimeline();
      return;
    }
    paint();
    placeTimeline();
    frame = requestAnimationFrame(tick);
  }

  function play() {
    if (!recording || exporting) return;
    if (playhead >= range[1] - 0.05 || playhead < range[0]) playhead = range[0];
    audio.currentTime = playhead;
    painter.reset();
    void audio.play();
    playButton.replaceChildren(icon(ICONS.pause));
    playButton.setAttribute("aria-label", labels.pause);
    playButton.title = labels.pause;
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    audio.pause();
    cancelAnimationFrame(frame);
    playButton.replaceChildren(icon(ICONS.play));
    playButton.setAttribute("aria-label", labels.play);
    playButton.title = labels.play;
    if (tapping) setTapping(false);
  }

  function seek(time: number) {
    playhead = Math.max(0, Math.min(recording?.duration ?? 0, time));
    if (!audio.paused) audio.currentTime = playhead;
    painter.reset();
    paint();
    placeTimeline();
  }

  // Captions: a list to edit, a transcript to spread, and timing by tapping along.

  function renderCues() {
    const shown = cues.map((cue, index) => ({ cue, index })).filter(({ cue }) => cue.end > range[0] && cue.start < range[1]);
    const active = cueAt(cues, playhead);
    const rows = shown.map(({ cue, index }) => {
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
        // New words lose the old ones' timings and share the caption's time again.
        cues[index] = { start: cue.start, end: cue.end, text: text.value.trim(), ...(cue.speaker ? { speaker: cue.speaker } : {}) };
        cues = cues.filter((item) => item.text);
        rebuild();
      });
      const remove = iconButton("ag-remove", labels.removeCaption, ICONS.remove);
      remove.addEventListener("click", () => {
        cues.splice(index, 1);
        rebuild();
      });
      row.append(time, text, remove);
      return row;
    });
    // Rebuilding the list would drop the focus of someone typing, so it is left alone while they are.
    if (cueList.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement) return;
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

  async function load(from: string | Blob) {
    stop();
    root.dataset.state = "loading";
    announce(labels.loading);
    const next = await decode(from);
    if (recording) URL.revokeObjectURL(recording.url);
    recording = { ...next, duration: next.samples.length / next.sampleRate };
    source = from;
    audio.src = recording.url;
    root.dataset.state = "ready";
    live.textContent = "";
    const [start, end] = range[1] > range[0] ? range : [0, Math.min(recording.duration, 30)];
    playhead = start;
    setRange(start, end);
  }

  // Exporting.

  async function exportVideo(): Promise<ExportResult | null> {
    if (!recording || exporting) return null;
    stop();
    exporting = true;
    root.dataset.state = "exporting";
    exportButton.disabled = true;
    try {
      const result = await exportClip(scene(), {
        onProgress: (fraction) => {
          meter.style.setProperty("--progress", String(fraction));
          exportButton.setAttribute("aria-label", labels.exporting(Math.round(fraction * 100)));
        },
      });
      announce(labels.exported(range[1] - range[0]));
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
      announce(labels.failed);
      throw error;
    } finally {
      exporting = false;
      root.dataset.state = "ready";
      exportButton.disabled = false;
      exportButton.setAttribute("aria-label", labels.export);
      meter.style.removeProperty("--progress");
    }
  }

  // Pointer on the recording: drag an edge, drag the clip along, or put the playhead down.

  let drag: { kind: "start" | "end" | "move"; pointerId: number; from: number; range: [number, number] } | null = null;
  const timeAt = (clientX: number) => {
    const box = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width)) * (recording?.duration ?? 0);
  };
  track.addEventListener("pointerdown", (event) => {
    if (!recording || event.button !== 0) return;
    const target = event.target as Element;
    const time = timeAt(event.clientX);
    const kind = target === startHandle ? "start" : target === endHandle ? "end" : time > range[0] && time < range[1] ? "move" : null;
    if (!kind) {
      seek(time);
      return;
    }
    drag = { kind, pointerId: event.pointerId, from: time, range: [...range] };
    try {
      track.setPointerCapture(event.pointerId);
    } catch {
      // A pointer from a script can't be captured; the drag still works while it stays over the track.
    }
    event.preventDefault();
  });
  track.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const delta = timeAt(event.clientX) - drag.from;
    const [start, end] = drag.range;
    if (drag.kind === "start") setRange(start + delta, end, "start");
    else if (drag.kind === "end") setRange(start, end + delta, "end");
    else {
      const total = recording!.duration;
      const shift = Math.max(-start, Math.min(total - end, delta));
      setRange(start + shift, end + shift);
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

  // Buttons and keys.

  playButton.addEventListener("click", () => (audio.paused ? play() : stop()));
  exportButton.addEventListener("click", () => void exportVideo().catch(() => {}));
  openButton.addEventListener("click", () => audioInput.click());
  audioInput.addEventListener("change", () => {
    const file = audioInput.files?.[0];
    if (file) void load(file);
    audioInput.value = "";
  });
  coverButton.addEventListener("click", () => coverInput.click());
  coverInput.addEventListener("change", async () => {
    const file = coverInput.files?.[0];
    coverInput.value = "";
    if (!file) return;
    cover = await loadImage(file);
    coverSource = file;
    rebuild();
    changed();
  });
  tapButton.addEventListener("click", () => setTapping(!tapping));
  preview.addEventListener("pointerdown", () => tapping && tap());
  addButton.addEventListener("click", () => {
    const start = Math.max(range[0], playhead);
    cues = [...cues, { start, end: Math.min(range[1], start + 2), text: labels.captionText }].sort((a, b) => a.start - b.start);
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
    rebuild();
  });

  // Space plays and pauses, unless someone is typing; while tapping, it marks the next caption instead.
  root.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, [role=radio], [role=slider]") || event.key !== " ") return;
    if (target.tagName === "BUTTON") return;
    event.preventDefault();
    if (tapping) tap();
    else if (audio.paused) play();
    else stop();
  });

  // A file dropped anywhere on the editor opens.
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
      rebuild();
      changed();
    });
    else if (/\.(srt|vtt)$/i.test(file.name)) void file.text().then((text) => {
      cues = parseSubtitles(text);
      rebuild();
    });
    else void load(file);
  });

  const observer = new ResizeObserver(() => drawWave());
  observer.observe(track);

  sizePreview();
  rebuild();
  placeTimeline();
  if (options.cover) void loadImage(options.cover).then((image) => {
    cover = image;
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
    async load(source) {
      await ready.catch(() => {});
      await load(source);
    },
    setCaptions(next) {
      cues = [...next].sort((a, b) => a.start - b.start);
      rebuild();
    },
    setRange: (start, end) => setRange(start, end),
    play,
    pause: stop,
    export: exportVideo,
    get settings() {
      return settings();
    },
    get source() {
      return source;
    },
    setOverlay(next) {
      overlay = next;
      rebuild();
    },
    destroy() {
      stop();
      observer.disconnect();
      if (recording) URL.revokeObjectURL(recording.url);
      root.remove();
    },
  };
}
