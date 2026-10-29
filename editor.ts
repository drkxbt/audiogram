import { clip, cueAt, formatTime, markStart, paginate, parseSubtitles, spread, toSRT, type Cue } from "./captions.js";
import { exportClip, type ExportResult } from "./export.js";
import { clipTimeAt, partsLength, readClip, readReel, stitchCues, type Reel } from "./parts.js";
import { TEMPLATES, templateOf, type Template, type TemplateId } from "./templates.js";
import { Painter, SIZES, THEMES, type Animation, type Layout, type Overlay, type Page, type Scene, type Theme, type Visual } from "./render.js";
import { OUTLINE_RATE, openSource, type AudioSource } from "./source.js";
import { element, icon, iconButton, ICONS, keyButton, rename } from "./ui.js";
import { colourPanel, COLOUR_LABELS, documentColours, hexToHsv, markPicked, type ColourChoice } from "./colour.js";
import { initialView, outlineBars, panView, showSpan, zoomView, type View } from "./view.js";
import { backgroundOf, defaultLayers, entranceLength, isBackgroundLayer, moveLayer, showCaptions, stacked, widthAnchored, type Layer, type LayerKind } from "./layers.js";
import { createStage, type FontChoice, type StageLabels } from "./stage.js";
import { textHeight, textWidth } from "./render.js";
import { elementTiles, searchTiles, type ElementTile, type SectionId } from "./elements.js";
import { DEVICES } from "./paint-mockup.js";

export type Tab = "design" | "elements" | "text" | "photos" | "music" | "captions" | "layers";

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
  uploadFailed: string;
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
  addRecording: string;
  addRecordingHint: string;
  /** Over the picture while another recording is read in, with its name. */
  adding: (name: string) => string;
  added: (name: string, part: number) => string;
  addFailed: string;
  /** A recording opened without a file name, by its place on the clip. */
  recording: (index: number) => string;
  split: string;
  splitHint: string;
  partsFull: string;
  parts: string;
  /** A part's chip, read out: the recording it comes from when the clip has several, and its times in that recording. */
  part: (index: number, name: string, from: string, to: string) => string;
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
  /** Over the picture while a recording is read in, beside how far it has got. */
  importing: string;
  empty: string;
  stage: StageLabels;
  undo: string;
  redo: string;
  templates: string;
  templateNames: Record<TemplateId, string>;
  pageColour: string;
  shapes: string;
  shapeNames: { square: string; rounded: string; circle: string; line: string; triangle: string; diamond: string; star: string; heart: string; arrow: string; bubble: string; pentagon: string; hexagon: string; octagon: string; cross: string; parallelogram: string; arch: string };
  searchElements: string;
  lines: string;
  lineNames: { line: string; dashed: string; arrow: string; double: string };
  frames: string;
  grids: string;
  gridNames: { across: string; down: string; three: string; four: string };
  nothingFound: string;
  sectionNames: Record<SectionId | "recent" | "photos" | "illustrations" | "stickers" | "gifs" | "logos", string>;
  mediaSource: string;
  loadMore: string;
  loadingLibrary: string;
  mediaUnavailable: string;
  mediaFailed: string;
  mediaBy: (author: string, source: string) => string;
  seeAll: string;
  seeAllOf: (section: string) => string;
  backToElements: string;
  addElement: (name: string) => string;
  uploadVideo: string;
  addedUnder: (name: string) => string;
  dropPhoto: string;
  captionsSample: string;
  wordSamples: { title: string; name: string; handle: string };
  frameFilled: string;
  startOver: string;
  startOverTitle: string;
  startOverText: string;
  startOverConfirm: string;
  cancel: string;
  startedOver: string;
  fontCombos: string;
  details: string;
  stockPhotos: string;
  searchPhotos: string;
  photoBy: (name: string, credit: string) => string;
  moreTemplates: string;
  useTemplate: (name: string) => string;
  downloadPanel: string;
  fileType: string;
  videoFile: string;
  pictureFile: string;
  quality: string;
  frameRate: string;
  downloadNow: string;
  soundAndCaptions: string;
  elementNames: { captions: string; bars: string; wave: string; pulse: string; time: string; avatar: string; name: string; handle: string; title: string; links: string };
  addText: string;
  addHeading: string;
  addSubheading: string;
  addBody: string;
  newText: { heading: string; subheading: string; body: string };
  uploads: string;
  upload: string;
  addPicture: (name: string) => string;
  forgetPicture: string;
  pictureTooBig: string;
  videoTooBig: string;
  layersHelp: string;
  fitPage: string;
  zoomLevel: (percent: number) => string;
  layerNames: Record<Exclude<LayerKind, "text">, string>;
  textLayer: (words: string) => string;
  showLayer: (name: string) => string;
  hideLayer: (name: string) => string;
  selectLayer: (name: string) => string;
}

/** A design to start from, laid out for any shape, from the page using the editor. */
export interface TemplateChoice {
  id: string;
  name: string;
  make(layout: Layout): Template;
}

/** A photo the page offers, by address, with its small version for the panel. */
export interface StockPhoto {
  id: string;
  name: string;
  theme?: string;
  url: string;
  thumb: string;
  width: number;
  height: number;
  credit?: string;
}

/** The kinds of stock media a source can offer. */
export type MediaKind = "photo" | "illustration" | "video" | "sticker" | "gif";

/** One result from a stock source: a preview for the panel and the file to keep, with who made it. */
export interface MediaItem {
  id: string;
  kind: MediaKind;
  name: string;
  thumb: string;
  file: string;
  width: number;
  height: number;
  credit?: { name: string; url: string };
  link?: string;
}

export interface MediaPage {
  items: MediaItem[];
  more: boolean;
}

/** A stock source for one kind of media: its name, the line that credits it, and a search; an empty query asks for
 *  what is popular. */
export interface MediaFeed {
  kind: MediaKind;
  source: string;
  name: string;
  credit: string;
  url: string;
  search(query: string, page: number): Promise<MediaPage>;
}

/** A brand's logo, drawn in a 24 by 24 box, and its colour. */
export interface Logo {
  id: string;
  name: string;
  hex: string;
  path: string;
}

/** Free photos a page offers for the picture, stock sources to search, and logos to load when they are first shown. */
export interface Library {
  photos?: StockPhoto[];
  media?: MediaFeed[];
  logos?: () => Promise<{ featured: string[]; logos: Logo[] }>;
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
  /** The longest clip, in seconds; as long as the recording when left out. */
  maxLength?: number;
  /** Start from an empty white page rather than the audiogram card; layouts given in `layers` still apply. */
  blank?: boolean;
  /** The page's own colour or gradient; the theme's when left out. */
  page?: Page | null;
  /** More designs to start from, after the editor's own. */
  templates?: TemplateChoice[];
  /** Free photos to offer in the panels. */
  library?: Library;
  /** The Elements a user added last time, newest first, as Settings.recent gave them. */
  recent?: string[];
  font?: string;
  labels?: Partial<Labels>;
  /** Called with the finished video. Without it, the video downloads. */
  onExport?: (result: ExportResult) => void;
  /** Drawn over every frame of the preview and the export. */
  overlay?: Overlay;
  /** Stretches of the recording, [start, end] in seconds, played one after another as the clip. */
  parts?: Array<[number, number]>;
  /** Called after the parts change through the editor: added, removed, reordered, split or trimmed. */
  onParts?: (parts: Array<[number, number]>) => void;
  /** Called after another recording is added to the clip, with every recording on it in order. */
  onRecordings?: (recordings: Array<{ source: string | Blob; name: string; start: number; end: number }>) => void;
  /** Called after the look changes through the editor, at most once a frame. */
  onChange?: (settings: Settings) => void;
  /** The frame laid out as layers, for each shape that has been changed from the classic layout. */
  layers?: Partial<Record<Layout, Layer[]>>;
  /** The pictures and videos the user has uploaded, by key: the ones in the layers and the rest of their library. */
  images?: Record<string, Blob | string>;
  /** Fonts to offer, each loaded only when used. */
  fonts?: FontChoice[];
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
  /** The layout of each shape the user changed, and their uploaded pictures by key. */
  layers: Partial<Record<Layout, Layer[]>>;
  images: Record<string, Blob | string>;
  /** The page's own colour or gradient; null for the theme's. */
  page: Page | null;
  /** The Elements added lately, newest first, for Recently used. */
  recent: string[];
}

export interface Editor {
  readonly element: HTMLElement;
  readonly captions: Cue[];
  readonly range: [number, number];
  /**
   * How long the recordings last together, in seconds; 0 before one is open. Every time the editor gives or takes is
   * on this timeline: the recordings end to end, in the order they were added.
   */
  readonly duration: number;
  /** Opens a recording in place of every one on the clip. */
  load(audio: string | Blob): Promise<void>;
  /** Adds a recording after the ones on the timeline, as a part of the clip of its own; the clip so far stays as it is. */
  addRecording(audio: string | Blob): Promise<void>;
  /** The recordings on the timeline, in order: each as it was opened or given, its name, and where it starts and ends. */
  readonly recordings: Array<{ source: string | Blob; name: string; start: number; end: number }>;
  setCaptions(cues: Cue[]): void;
  setRange(start: number, end: number): void;
  play(): void;
  pause(): void;
  export(): Promise<ExportResult | null>;
  readonly settings: Settings;
  /** The parts the clip is made of, in order; empty when the clip is just the selected stretch. */
  readonly parts: Array<[number, number]>;
  setParts(parts: Array<[number, number]>): void;
  /** The first recording on the timeline, as it was opened or given; null before one is. */
  readonly source: string | Blob | null;
  /** One channel of the timeline from `start` to `end` seconds at `sampleRate`, read from the files as needed. */
  readAudio(start: number, end: number, sampleRate: number): Promise<Float32Array>;
  setOverlay(overlay: Overlay | null): void;
  /** Opens one of the tools, as pressing its tab does. */
  selectTab(tab: Tab): void;
  /** Places for a page's own controls: in the header after Open audio, in the header before Download, and at the top of the Captions tab. */
  readonly slots: { header: HTMLElement; actions: HTMLElement; captions: HTMLElement };
  /** Fonts to offer, for a page that loads its list after the editor opens. */
  setFonts(fonts: FontChoice[]): void;
  /** Uploaded pictures by key, for a page that keeps them somewhere slower to read than the options. */
  setImages(images: Record<string, Blob | string>): Promise<void>;
  /** Designs to start from, for a page that loads them after the editor opens. */
  setTemplates(templates: TemplateChoice[]): void;
  /** Graphics, stickers and photos, for a page that loads them after the editor opens. */
  setLibrary(library: Library): void;
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
  uploadFailed: "That file couldn't be opened. Try a JPG, PNG or WebP picture, or an MP4 or WebM video.",
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
  addRecording: "Add recording",
  addRecordingHint: "Add another recording from your computer. It plays after what is in the clip now.",
  adding: (name) => `Adding ${name}`,
  added: (name, part) => `${name} is in the clip as part ${part}.`,
  addFailed: "This recording couldn't be added. Save it as an MP3 or WAV and try again.",
  recording: (index) => `Recording ${index}`,
  split: "Split",
  splitHint: "Cut the clip in two at the playhead, then trim or move each half",
  partsFull: "The clip is already as long as it can be.",
  parts: "Parts of the clip, in order",
  part: (index, name, from, to) => (name ? `Part ${index}, ${name}, ${from} to ${to}` : `Part ${index}, ${from} to ${to}`),
  removePart: (index) => `Remove part ${index}`,
  tabs: { design: "Design", elements: "Elements", text: "Text", photos: "Photos", music: "Music", captions: "Captions", layers: "Layers" },
  shape: "Shape",
  layouts: { square: "Square", portrait: "Portrait", story: "Story", landscape: "Wide" },
  visual: "Sound style",
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
  importing: "Importing audio",
  empty: "Open a recording of a Space, a podcast or a voice note to start.",
  stage: {
    picture: "The picture. Tab to step through its parts, Enter to edit one, arrows to move it",
    defaultFont: "Geist (default)",
    font: "Font",
    searchFonts: "Search fonts",
    size: "Size",
    smaller: "Smaller",
    larger: "Larger",
    bold: "Bold",
    italic: "Italic",
    boldMissing: "This font has no bold",
    italicMissing: "This font has no italic",
    colour: "Colour",
    highlight: "Highlight",
    fill: "Colour",
    align: "Align",
    alignNames: { left: "left", center: "centre", right: "right" },
    editText: "Edit",
    replace: "Replace",
    more: "More",
    forward: "Bring forward",
    backward: "Send backward",
    duplicate: "Duplicate",
    remove: "Delete",
    hide: "Hide",
    opacity: "Opacity",
    corners: "Rounded corners",
    position: "Position",
    x: "Left",
    y: "Top",
    width: "Width",
    height: "Height",
    rotation: "Turn, in degrees",
    straighten: "Straighten",
    colourPicker: COLOUR_LABELS,
    back: "Back",
    borderColour: "Border colour",
    options: (layer) => `${layer} options`,
    typing: (layer) => `Edit ${layer}`,
    selected: (layer) => `${layer} selected`,
    hidden: (layer) => `${layer} taken off the picture`,
    deleted: (layer) => `${layer} deleted. Add it back from Elements, or undo`,
    duplicated: (layer) => `${layer} duplicated`,
    effects: "Effects",
    shadow: "Shadow",
    outline: "Outline",
    behind: "Colour behind",
    capitals: "Capitals",
    none: "None",
    animate: "Animate",
    enterNames: {
      fade: "Fade", rise: "Rise", pan: "Pan", slide: "Slide", pop: "Pop", wipe: "Wipe", blur: "Blur", zoom: "Zoom", breathe: "Breathe", baseline: "Baseline", drift: "Drift", tumble: "Tumble", stomp: "Stomp", bounce: "Bounce", flicker: "Flicker", typewriter: "Typewriter",
      ascend: "Ascend", shift: "Shift", merge: "Merge", burst: "Burst", cascade: "Cascade", spread: "Spread", block: "Block", clarify: "Clarify", glide: "Glide", roll: "Roll", skate: "Skate", elastic: "Elastic", flip: "Flip", unfold: "Unfold", iris: "Iris", curtain: "Curtain", fall: "Fall", tectonic: "Tectonic", scrapbook: "Scrapbook", shine: "Shine", grow: "Grow",
    },
    timing: "When it shows",
    showFrom: "From",
    showUntil: "Until",
    playhead: "Playhead",
    wholeClip: "Whole clip",
    timeHint: "Minutes and seconds into the clip, such as 1:05. Leave it empty for the whole clip.",
    flip: "Flip",
    flipX: "Flip across",
    flipY: "Flip upside down",
    adjust: "Adjust",
    brightness: "Brightness",
    contrast: "Contrast",
    saturation: "Colour",
    blur: "Blur",
    resetAdjust: "Reset",
    setBackground: "Set as background",
    lock: "Lock",
    unlock: "Unlock",
    locked: (layer) => `${layer} locked`,
    alignPage: "Align to page",
    edgeNames: { left: "Left", center: "Centre", right: "Right", top: "Top", middle: "Middle", bottom: "Bottom" },
    copy: "Copy",
    paste: "Paste",
    copied: (layer) => `${layer} copied`,
    style: "Style",
    visualNames: { bars: "Bars", wave: "Wave", pulse: "Pulse" },
    underline: "Underline",
    strike: "Strikethrough",
    list: "List",
    listNames: { none: "none", bullet: "bullets", number: "numbers" },
    spacing: "Spacing",
    letterSpacing: "Letter spacing",
    lineHeight: "Line spacing",
    curve: "Curve",
    effectNames: { none: "None", shadow: "Shadow", lift: "Lift", hollow: "Hollow", splice: "Splice", outline: "Outline", echo: "Echo", glitch: "Glitch", neon: "Neon", background: "Background" },
    effectColour: "Effect colour",
    transparency: "Transparency",
    positionPanel: "Position",
    arrange: "Arrange",
    toFront: "To front",
    toBack: "To back",
    advanced: "Exact place and size",
    alignSelection: "Align the selection",
    distribute: "Spread evenly",
    distributeAcross: "Across",
    distributeDown: "Down",
    group: "Group",
    ungroup: "Ungroup",
    selectAll: "Select all",
    copyStyle: "Copy style",
    pasteStyle: "Paste style",
    border: "Border",
    borderWeight: "Weight",
    borderStyle: "Style",
    dashNames: { solid: "Solid", dashed: "Dashed", dotted: "Dotted" },
    line: "Line",
    arrowStart: "Arrow at start",
    arrowEnd: "Arrow at end",
    crop: "Crop",
    zoom: "Zoom",
    resetCrop: "Reset crop",
    frame: "Frame",
    frameNames: { none: "None", rect: "Square", ellipse: "Circle", triangle: "Triangle", star: "Star", heart: "Heart", arrow: "Arrow", diamond: "Diamond", bubble: "Speech", pentagon: "Pentagon", hexagon: "Hexagon", octagon: "Octagon", cross: "Cross", parallelogram: "Slant", arch: "Arch", line: "Line", burst: "Burst", sparkle: "Sparkle", squircle: "Squircle", blob: "Blob", ring: "Ring", quote: "Quote", banner: "Banner", tag: "Tag", chevron: "Chevron", cloud: "Cloud", moon: "Moon", check: "Tick" },
    filters: "Filters",
    filterNames: { vivid: "Vivid", warm: "Warm", cool: "Cool", fade: "Faded", retro: "Retro", dramatic: "Dramatic", mono: "Mono", noir: "Noir" },
    original: "Original",
    in: "In",
    out: "Out",
    loopName: "Loop",
    preview: "Preview",
    noAnimation: "No animation yet",
    recommended: "Recommended",
    basic: "Basic",
    exaggerated: "Lively",
    words: "Word by word",
    emphasis: "While it shows",
    direction: "Direction",
    directionNames: { up: "Up", down: "Down", left: "Left", right: "Right" },
    loopNames: { pulse: "Pulse", wiggle: "Wiggle", rotate: "Spin", float: "Float", sway: "Sway", heartbeat: "Heartbeat", shimmer: "Shimmer", flash: "Flash", slowZoom: "Slow zoom" },
    speed: "Speed",
    selection: (count) => `${count} parts`,
    grouped: (count) => `${count} parts grouped`,
    ungrouped: "Group taken apart",
    showAgain: "Show again",
    backgroundSet: "Background set. It stays behind everything else",
    backgroundPanelsHidden: "Background set. The panel that covered it is hidden; show it again from Layers",
    detachBackground: "Detach from background",
    fitText: "Fit box to text",
    chartType: "Chart",
    chartNames: { column: "Columns", bar: "Bars", line: "Line", area: "Area", pie: "Pie", donut: "Donut", ring: "Ring", progress: "Progress", number: "Big number", poll: "Poll" },
    data: "Data",
    label: "Label",
    value: "Value",
    addRow: "Add a row",
    removeRow: (row) => `Remove row ${row}`,
    pasteRows: "Paste from a spreadsheet",
    pasteHint: "One row a line: a label, then a tab or a comma, then the number",
    pasteCellsHint: "One row a line, its cells split by tabs or commas",
    chartOptions: "Options",
    showLabels: "Labels",
    showValues: "Values",
    showGrid: "Guide lines",
    prefix: "Before each value",
    suffix: "After each value",
    outOf: "Out of",
    wordsColour: "Words",
    table: "Table",
    cells: "Cells",
    cell: (row, column) => `Row ${row}, column ${column}`,
    addColumn: "Add a column",
    removeColumn: "Remove a column",
    removeLastRow: "Remove a row",
    headerRow: "Header row",
    stripes: "Stripes",
    rules: "Lines between",
    ruleNames: { none: "None", rows: "Rows", grid: "Every cell" },
    device: "Device",
    deviceNames: { phone: "Phone", tablet: "Tablet", laptop: "Laptop", monitor: "Monitor", tv: "TV", browser: "Browser", polaroid: "Polaroid", vinyl: "Vinyl" },
    caption: "Caption",
    addPhoto: "Add photo",
    form: "Form",
    solidNames: { sphere: "Sphere", cube: "Cube", cylinder: "Cylinder", cone: "Cone", torus: "Ring", pyramid: "Pyramid", capsule: "Capsule" },
    gloss: "Shine",
    groundShadow: "Shadow under it",
    ambientStyle: "Style",
    ambientNames: { aurora: "Aurora", flow: "Flow", bokeh: "Bokeh", particles: "Particles", waves: "Waves", rays: "Light rays", grid: "Grid", grain: "Film grain" },
    ground: "Ground",
    light: "Light",
    secondLight: "Second light",
    pace: "Pace",
    withVoice: "Moves with the voice",
  },
  undo: "Undo",
  redo: "Redo",
  templates: "Start from",
  templateNames: { blank: "Blank page", card: "Audiogram card", captions: "Big captions" },
  pageColour: "Page colour",
  shapes: "Shapes",
  shapeNames: { square: "Square", rounded: "Rounded", circle: "Circle", line: "Bar", triangle: "Triangle", diamond: "Diamond", star: "Star", heart: "Heart", arrow: "Arrow", bubble: "Speech", pentagon: "Pentagon", hexagon: "Hexagon", octagon: "Octagon", cross: "Cross", parallelogram: "Slant", arch: "Arch" },
  searchElements: "Search elements",
  lines: "Lines",
  lineNames: { line: "Line", dashed: "Dashed", arrow: "Arrow", double: "Both ends" },
  frames: "Photo frames",
  grids: "Photo grids",
  gridNames: { across: "Two across", down: "Two down", three: "Three across", four: "Four" },
  nothingFound: "Nothing matches that. Try a shorter word.",
  sectionNames: { recent: "Recently used", audio: "Sound and captions", shapes: "Shapes", lines: "Lines", frames: "Photo frames", grids: "Photo grids", photos: "Photos", illustrations: "Illustrations", videos: "Videos", stickers: "Stickers", gifs: "GIFs", logos: "Social logos", charts: "Charts", tables: "Tables", mockups: "Mockups", solids: "3D shapes" },
  mediaSource: "Source",
  loadMore: "Load more",
  loadingLibrary: "Loading…",
  mediaUnavailable: "This library isn't available right now.",
  mediaFailed: "That one didn't come through. Try another, or try again in a moment.",
  mediaBy: (author, source) => `By ${author} on ${source}`,
  seeAll: "See all",
  seeAllOf: (section) => `See all ${section.toLowerCase()}`,
  backToElements: "All elements",
  addElement: (name) => `Add ${name}`,
  uploadVideo: "Upload a video",
  addedUnder: (name) => `${name} added behind everything`,
  dropPhoto: "Drop a photo",
  captionsSample: "Captions show here",
  wordSamples: { title: "Your episode title", name: "Your name", handle: "@yourhandle" },
  frameFilled: "Photo added to the frame",
  startOver: "Start over",
  startOverTitle: "Start over?",
  startOverText: "This clears the design on every shape: its layers, page colour and background, and the title, name and handle. Your recording, captions, music, profile picture, links and uploads stay, and Undo brings the design back.",
  startOverConfirm: "Clear the design",
  cancel: "Cancel",
  startedOver: "Started again on a blank page. Undo brings your design back.",
  fontCombos: "Font pairs",
  details: "The show and the speaker",
  stockPhotos: "Free photos",
  searchPhotos: "Search photos",
  photoBy: (name, credit) => (credit ? `${name}, by ${credit}` : name),
  moreTemplates: "Podcast designs",
  useTemplate: (name) => `Start from ${name}`,
  downloadPanel: "Download",
  fileType: "File type",
  videoFile: "Video (MP4)",
  pictureFile: "Picture of this moment (PNG)",
  quality: "Quality",
  frameRate: "Frames a second",
  downloadNow: "Download",
  soundAndCaptions: "Sound and captions",
  elementNames: { captions: "Captions", bars: "Sound bars", wave: "Sound wave", pulse: "Pulse", time: "Clip time", avatar: "Profile picture", name: "Name", handle: "Handle", title: "Title", links: "Links" },
  addText: "Add text",
  addHeading: "Add a heading",
  addSubheading: "Add a subheading",
  addBody: "Add a little text",
  newText: { heading: "Your heading", subheading: "Your subheading", body: "Your text" },
  uploads: "Your uploads",
  upload: "Upload photos or videos",
  addPicture: (name) => `Add ${name} to the picture`,
  forgetPicture: "Remove from your pictures",
  pictureTooBig: "That picture is over 20 MB. Try a smaller one.",
  videoTooBig: "That video is over 200 MB. Try a shorter one.",
  fitPage: "Fit the page",
  zoomLevel: (percent) => `Zoom ${percent}%`,
  layersHelp: "Top of the picture first. Press a name to select it; hidden parts can be shown again here.",
  layerNames: { avatar: "Profile picture", name: "Name", handle: "Handle", title: "Title", visual: "Sound", time: "Clip time", captions: "Captions", links: "Links", image: "Picture", video: "Video", shape: "Shape", graphic: "Graphic", chart: "Chart", table: "Table", mockup: "Mockup", solid: "3D shape", ambient: "Moving background" },
  textLayer: (words) => `Text: ${words}`,
  showLayer: (name) => `Show ${name}`,
  hideLayer: (name) => `Hide ${name}`,
  selectLayer: (name) => `Select ${name}`,
};

const TABS: Tab[] = ["design", "elements", "text", "photos", "music", "captions", "layers"];
const TAB_ICONS: Record<Tab, string> = { design: ICONS.design, elements: ICONS.elements, text: ICONS.text, photos: ICONS.photo, music: ICONS.music, captions: ICONS.captions, layers: ICONS.layers };
// Uploaded pictures: the kinds every browser draws, up to a size a phone can hold several of.
const PICTURE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];
const PICTURE_LIMIT = 20 * 1024 * 1024;
// Videos the browser can play in a layer, muted; the clip's sound stays the recording's.
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const VIDEO_LIMIT = 200 * 1024 * 1024;
const isVideo = (source: Blob | string) => (typeof source === "string" ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(source) : source.type.startsWith("video/"));
const LAYOUTS: Layout[] = ["square", "portrait", "story", "landscape"];
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

/** A video ready to draw: muted, looping, its first frame decoded. */
async function loadVideo(source: string | Blob): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  const loaded = new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("The video could not be opened"));
  });
  video.src = typeof source === "string" ? source : URL.createObjectURL(source);
  await loaded;
  return video;
}

// The browser's image decoder, where it has one, as much of it as moving pictures need.
interface FrameDecoder {
  tracks: { ready: Promise<void>; selectedTrack: { animated: boolean; frameCount: number } | null };
  decode(options: { frameIndex: number }): Promise<{ image: VideoFrame }>;
  close(): void;
}
type FrameDecoderClass = new (init: { data: ArrayBuffer; type: string }) => FrameDecoder;

/** A moving GIF, WebP or PNG as frames and their times, at most 150 frames no wider than 640 px; null for a still
 *  picture, or where the browser can't decode one a frame at a time, which then shows its first frame. */
async function decodeAnimation(blob: Blob): Promise<Animation | null> {
  const Decoder = (globalThis as { ImageDecoder?: FrameDecoderClass }).ImageDecoder;
  if (!Decoder || !/^image\/(gif|webp|png|apng)$/.test(blob.type)) return null;
  let decoder: FrameDecoder | null = null;
  try {
    decoder = new Decoder({ data: await blob.arrayBuffer(), type: blob.type });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    if (!track?.animated || track.frameCount < 2) return null;
    const frames: CanvasImageSource[] = [];
    const ends: number[] = [];
    let at = 0;
    for (let index = 0; index < Math.min(150, track.frameCount); index++) {
      const { image } = await decoder.decode({ frameIndex: index });
      const scale = Math.min(1, 640 / Math.max(1, image.displayWidth));
      frames.push(await createImageBitmap(image, { resizeWidth: Math.round(image.displayWidth * scale), resizeHeight: Math.round(image.displayHeight * scale) }));
      // A frame with no time of its own shows for a tenth of a second, as browsers play them.
      at += (image.duration || 100_000) / 1e6;
      ends.push(at);
      image.close();
    }
    return { frames, ends };
  } catch {
    return null;
  } finally {
    decoder?.close();
  }
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

/** A recording on the clip's timeline: its sound, what was opened, its name, where it starts, and its own player. */
interface Recording {
  source: AudioSource;
  input: string | Blob;
  name: string;
  offset: number;
  player: HTMLAudioElement;
}

function playerOf(url: string): HTMLAudioElement {
  const player = new Audio();
  player.preload = "auto";
  player.src = url;
  return player;
}

/** Lets go of a recording: its player stops and drops the file, and the file stops being read. */
function closeRecording({ source, player }: Recording) {
  player.pause();
  player.removeAttribute("src");
  player.load();
  source.close();
}

/** A caption moved `by` seconds along, its words with it. */
const shiftCue = (cue: Cue, by: number): Cue => ({
  ...cue,
  start: cue.start + by,
  end: cue.end + by,
  ...(cue.words ? { words: cue.words.map((word) => ({ ...word, start: word.start + by, end: word.end + by })) } : {}),
});

export function audiogram(container: HTMLElement, options: EditorOptions = {}): Editor {
  const labels: Labels = { ...DEFAULT_LABELS, ...options.labels };
  const maxLength = options.maxLength ?? Infinity;
  const id = `ag${++instances}`;
  // The recordings end to end on one timeline. The parts, the selection, the playhead and the captions are all times
  // along it, so a clip can take its parts from any of them.
  let recordings: Recording[] = [];
  // Bumped for each recording, so the clip's sound read from one is never taken for another's.
  let generation = 0;
  let cues: Cue[] = [...(options.captions ?? [])].sort((a, b) => a.start - b.start);
  let range: [number, number] = options.range ?? [0, 0];
  let playhead = range[0];
  let view: View = [0, 1];
  let layout: Layout = options.layout ?? "square";
  let visual: Visual = options.visual ?? "bars";
  // A blank page starts white, with the theme whose words read on white.
  let theme: Theme = typeof options.theme === "object" ? options.theme : THEMES[options.theme ?? (options.blank ? 1 : 0)] ?? THEMES[0];
  let page: Page | null = options.page !== undefined ? options.page : options.blank ? { color: "#ffffff" } : null;
  // Whether the clip is playing, so layers come in at their times; while it is still, they show as they end up.
  let animating = false;
  let title = options.title ?? "";
  let speaker = options.speaker ?? "";
  let handle = options.handle ?? "";
  let cover: HTMLImageElement | null = null;
  let coverSource: Blob | string | null = options.cover ?? null;
  // The key of the background the Photos row shows, so it is only redrawn when the design's background changes.
  let rowBackground: string | null | undefined;
  let logo: HTMLImageElement | null = null;
  const logoSource: Blob | string | null = options.logo ?? null;
  let music: { samples: Float32Array; url: string; duration: number; close(): void } | null = null;
  let musicSource: Blob | string | null = options.music ?? null;
  let musicVolume = Math.min(1, Math.max(0, options.musicVolume ?? 0.25));
  const links = [0, 1, 2].map((index) => options.links?.[index] ?? "");
  let overlay: Overlay | null = options.overlay ?? null;
  // The clip is the parts, back to back, when there are any; otherwise the selected stretch alone.
  let parts: Array<[number, number]> = (options.parts ?? []).map(([start, end]) => [start, end]);
  // The part the selection edits, while the clip has parts.
  let active = 0;
  // Whether another recording is being read in.
  let adding = false;
  const spans = (): Array<[number, number]> => (parts.length ? parts : [range]);
  const clipLength = () => (parts.length ? partsLength(parts) : range[1] - range[0]);
  const clipTime = () => (parts.length ? clipTimeAt(parts, playhead) ?? 0 : playhead - range[0]);
  const duration = () => {
    const last = recordings.at(-1);
    return last ? last.offset + last.source.duration : 0;
  };
  /** The recording `time` falls in; a join belongs to the recording that starts there. */
  const recordingAt = (time: number) => {
    let index = 0;
    while (index < recordings.length - 1 && time >= recordings[index + 1].offset) index++;
    return index;
  };
  // A part never crosses from one recording into the next, so its middle says which one it is in.
  const recordingOf = ([start, end]: readonly [number, number]) => recordingAt((start + end) / 2);
  const boundsOf = (index: number): [number, number] => [recordings[index].offset, recordings[index].offset + recordings[index].source.duration];
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
  // The frame's layers for each shape the user has changed; the classic layout stands for the rest.
  let designs: Partial<Record<Layout, Layer[]>> = Object.fromEntries(LAYOUTS.filter((name) => options.layers?.[name] || options.blank).map((name) => [name, (options.layers?.[name] ?? []).map((layer) => ({ ...layer }))]));
  const layersFor = (shape: Layout) => designs[shape] ?? defaultLayers(shape);
  // Uploaded pictures by key, as given and as drawn; `listed` ones show in the Photos panel.
  const pictures = new Map<string, { source: Blob | string; image: HTMLImageElement | null; video: HTMLVideoElement | null; url: string | null; listed: boolean; animation?: Animation | null }>();
  let editingLayer: string | null = null;
  let fontList: FontChoice[] = options.fonts ?? [];
  let hostTemplates: TemplateChoice[] = options.templates ?? [];
  let library: Library = options.library ?? {};
  const fontsAdded = new Set<string>();
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
  const undoButton = keyButton("ag-undo", labels.undo, ICONS.undo);
  const redoButton = keyButton("ag-redo", labels.redo, ICONS.redo);
  const startOverButton = keyButton("ag-start-over", labels.startOver, ICONS.reset);
  startOverButton.setAttribute("aria-haspopup", "dialog");
  startOverButton.setAttribute("aria-expanded", "false");
  header.append(openButton, audioInput, headerSlot, element("span", "ag-grow"), undoButton, redoButton, startOverButton, actionsSlot, exportButton);
  // Start over asks first, in a small panel under its key: what goes, what stays, and that Undo brings it back.
  const startOverPanel = element("div", "ag-download ag-confirm");
  startOverPanel.setAttribute("role", "alertdialog");
  startOverPanel.hidden = true;
  const startOverTitle = element("h2", "ag-download-title");
  startOverTitle.id = `${id}-start-over`;
  startOverTitle.textContent = labels.startOverTitle;
  startOverPanel.setAttribute("aria-labelledby", startOverTitle.id);
  const startOverText = element("p", "ag-help");
  startOverText.id = `${id}-start-over-text`;
  startOverPanel.setAttribute("aria-describedby", startOverText.id);
  startOverText.textContent = labels.startOverText;
  const startOverKeys = element("div", "ag-confirm-keys");
  const cancelStart = keyButton("", labels.cancel, ICONS.remove);
  const confirmStart = keyButton("ag-danger", labels.startOverConfirm, ICONS.reset);
  startOverKeys.append(cancelStart, confirmStart);
  startOverPanel.append(startOverTitle, startOverText, startOverKeys);
  header.append(startOverPanel);
  exportButton.setAttribute("aria-haspopup", "dialog");
  exportButton.setAttribute("aria-expanded", "false");
  // Download: what to make and how, then the key that makes it. The choices stay for the next download.
  const download = element("div", "ag-download");
  download.setAttribute("role", "dialog");
  download.setAttribute("aria-label", labels.downloadPanel);
  download.hidden = true;
  let downloadChoice: { kind: "video" | "picture"; scale: number; fps: number } = { kind: "video", scale: 1, fps: 30 };
  header.append(download);

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

  const stageArea = element("div", "ag-stage");
  const preview = element("canvas", "ag-preview");
  preview.setAttribute("role", "img");
  preview.tabIndex = -1;
  const tapHint = element("p", "ag-tap-hint");
  tapHint.hidden = true;
  const emptyNote = element("p", "ag-empty");
  emptyNote.textContent = labels.empty;
  const notice = element("p", "ag-notice");
  notice.hidden = true;
  // How far a recording has been read in: the file, then its waveform, which is most of the wait on a long one.
  const importCard = element("div", "ag-import");
  importCard.setAttribute("role", "progressbar");
  importCard.setAttribute("aria-label", labels.importing);
  importCard.setAttribute("aria-valuemin", "0");
  importCard.setAttribute("aria-valuemax", "100");
  importCard.dataset.done = "";
  const importName = element("span", "ag-import-name");
  importName.textContent = labels.importing;
  const importPercent = element("span", "ag-import-percent");
  importCard.append(importName, importPercent, element("span", "ag-import-bar"));
  // The picture sits in a scroller of its own, so it can be zoomed past the stage's size and moved around.
  const scroller = element("div", "ag-scroll");
  scroller.append(preview);
  const zoomBar = element("div", "ag-zoom-bar");
  const zoomOut = iconButton("", labels.zoomOut, ICONS.minus);
  const zoomLevel = element("button", "ag-zoom-level");
  zoomLevel.type = "button";
  zoomLevel.title = labels.fitPage;
  const zoomIn = iconButton("", labels.zoomIn, ICONS.add);
  zoomOut.title = labels.zoomOut;
  zoomIn.title = labels.zoomIn;
  zoomBar.append(zoomOut, zoomLevel, zoomIn);
  stageArea.append(scroller, tapHint, emptyNote, notice, importCard, zoomBar);
  body.append(rail, drawer, stageArea);

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
    applyZoom(zoom);
    renderTemplates();
    changed();
  });
  tiles(panes.design, labels.visual, (["bars", "wave", "pulse"] as Visual[]).map((value) => ({ value, text: labels.visuals[value], markup: ICONS[value] })), visual, (value) => {
    visual = value as Visual;
    // The animation picked here is every sound layer's, the ones added with a look of their own included.
    designs = Object.fromEntries(Object.entries(designs).map(([shape, list]) => [shape, list!.map((layer) => (layer.kind === "visual" ? { ...layer, visual: undefined } : layer))])) as typeof designs;
    rebuild();
    record();
    changed();
  });
  const themeTiles = tiles(panes.design, labels.colours, THEMES.map((item, index) => ({ value: String(index), text: item.name, swatch: item })), String(Math.max(0, THEMES.indexOf(theme))), (value) => {
    theme = THEMES[Number(value)];
    // A theme colours the page as well as the words, so they always read on it; a page colour can be picked after.
    page = null;
    renderPageSwatches();
    rebuild();
    record();
    changed();
  });
  themeTiles.classList.add("ag-swatches");
  heading(panes.design, labels.pageColour);
  const pageSwatches = element("div", "ag-page-swatches");
  panes.design.append(pageSwatches);
  heading(panes.design, labels.templates);
  const templateTiles = element("div", "ag-tiles");
  templateTiles.style.setProperty("--ag-count", "3");
  const templateIcons: Record<TemplateId, string> = { blank: ICONS.page, card: ICONS.template, captions: ICONS.captions };
  for (const { id } of TEMPLATES) {
    const tile = element("button", "ag-tile");
    tile.type = "button";
    const text = element("span", "ag-tile-text");
    text.textContent = labels.templateNames[id];
    tile.append(icon(templateIcons[id]), text);
    tile.addEventListener("click", () => applyTemplate(id));
    templateTiles.append(tile);
  }
  panes.design.append(templateTiles);
  const moreHeading = heading(panes.design, labels.moreTemplates);
  const templateGrid = element("div", "ag-template-grid");
  panes.design.append(templateGrid);

  const elementSearch = element("input", "ag-input ag-search");
  elementSearch.type = "search";
  elementSearch.placeholder = labels.searchElements;
  elementSearch.setAttribute("aria-label", labels.searchElements);
  elementSearch.autocomplete = "off";
  const elementsBody = element("div", "ag-elements");
  panes.elements.append(elementSearch, elementsBody);
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
    // A field's edit is one step to undo, ended when it is left.
    input.addEventListener("change", () => record());
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
    input.addEventListener("change", () => record());
    return input;
  }));
  heading(panes.text, labels.addText);
  const textPresets = element("div", "ag-text-presets");
  for (const [kind, name, size, weight] of [["heading", labels.addHeading, 96, 800], ["subheading", labels.addSubheading, 60, 650], ["body", labels.addBody, 38, 400]] as const) {
    const button = element("button", `ag-text-preset ag-text-${kind}`);
    button.type = "button";
    button.textContent = name;
    button.addEventListener("click", () => addText(labels.newText[kind], size, weight));
    textPresets.append(button);
  }
  heading(panes.text, labels.fontCombos);
  const comboGrid = element("div", "ag-combos");
  panes.text.append(comboGrid);
  const titleField = field(labels.title, title, (value) => (title = value));
  const speakerField = field(labels.speaker, speaker, (value) => (speaker = value));
  const handleField = field(labels.handle, handle, (value) => (handle = value));
  panes.text.insertBefore(textPresets, panes.text.querySelector(".ag-combos")!.previousElementSibling);
  heading(panes.text, labels.details);
  panes.text.append(titleField, speakerField, handleField, linkGroup);

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
      if (file && kind !== "sound" && !isVideo(file)) {
        const image = element("img", "");
        image.alt = "";
        image.src = typeof file === "string" ? file : (shown = URL.createObjectURL(file));
        thumb.append(image);
      } else thumb.append(icon(kind === "sound" ? ICONS.music : file ? ICONS.video : ICONS.photo));
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
    return { show, choose: () => input.click() };
  };
  const coverRow = fileRow(panes.photos, labels.cover, "image/*", "round", labels.pictureFailed, async (file) => {
    cover = file ? await loadImage(file) : null;
    coverSource = file;
    rebuild();
    changed();
  });
  // A background belongs to the design it is set on: it is that design's bottom layer, so other designs and the
  // templates keep their own, and Undo brings back the one a template replaced.
  const backgroundRow = fileRow(panes.photos, labels.background, [...PICTURE_TYPES, ...VIDEO_TYPES].join(","), "wide", labels.pictureFailed, async (file) => {
    // One background at a time: a new one takes the place of a picture, a video or a moving background before it.
    const rest = layersFor(layout).filter((layer, index) => !layer.backdrop && !(index === 0 && isBackgroundLayer(layer)));
    if (!file) return setLayers(rest, true);
    const video = VIDEO_TYPES.includes(file.type);
    if (!video && !PICTURE_TYPES.includes(file.type)) throw new Error("type");
    if (file.size > (video ? VIDEO_LIMIT : PICTURE_LIMIT)) throw new Error("size");
    const key = layerId("picture");
    await keepPicture(file, key, true);
    rowBackground = key;
    setLayers([{ id: layerId(isVideo(file) ? "video" : "image"), kind: isVideo(file) ? "video" : "image", image: key, x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1, backdrop: true }, ...rest], true);
    renderUploads();
    if (isVideo(file)) syncVideos(clipTime(), !audio.paused);
  });
  /** The picture or video behind the design on the page, as it was given. */
  function backgroundSource(): Blob | string | null {
    const key = backgroundOf(layersFor(layout))?.image;
    return key ? pictures.get(key)?.source ?? null : null;
  }
  /** The Photos row follows the background of the design on the page. */
  function showBackgroundRow() {
    const key = backgroundOf(layersFor(layout))?.image ?? null;
    if (key === rowBackground) return;
    rowBackground = key;
    backgroundRow.show(backgroundSource());
  }
  heading(panes.photos, labels.uploads);
  const uploadButton = keyButton("ag-upload", labels.upload, ICONS.upload);
  const uploadInput = element("input", "ag-hidden");
  uploadInput.type = "file";
  uploadInput.accept = [...PICTURE_TYPES, ...VIDEO_TYPES].join(",");
  uploadInput.multiple = true;
  uploadInput.tabIndex = -1;
  const uploadGrid = element("div", "ag-uploads");
  panes.photos.append(uploadButton, uploadInput, uploadGrid);
  const photosHeading = heading(panes.photos, labels.stockPhotos);
  const photoSearch = element("input", "ag-input ag-search");
  photoSearch.type = "search";
  photoSearch.placeholder = labels.searchPhotos;
  photoSearch.setAttribute("aria-label", labels.searchPhotos);
  photoSearch.autocomplete = "off";
  const photoGrid = element("div", "ag-photo-grid");
  panes.photos.append(photoSearch, photoGrid);
  // Another picture for a picture already on the frame.
  const replaceInput = element("input", "ag-hidden");
  replaceInput.type = "file";
  replaceInput.accept = [...PICTURE_TYPES, ...VIDEO_TYPES].join(",");
  replaceInput.tabIndex = -1;
  panes.photos.append(replaceInput);
  let replacing: string | null = null;

  const layersHelp = element("p", "ag-help");
  layersHelp.textContent = labels.layersHelp;
  const layerList = element("ol", "ag-layer-list");
  panes.layers.append(layersHelp, layerList);

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
  const splitButton = keyButton("ag-split", labels.split, ICONS.split);
  splitButton.title = labels.splitHint;
  const addRecordingButton = keyButton("ag-add-recording", labels.addRecording, ICONS.addRecording);
  addRecordingButton.title = labels.addRecordingHint;
  const recordingInput = element("input", "ag-hidden");
  recordingInput.type = "file";
  recordingInput.accept = audioInput.accept;
  recordingInput.tabIndex = -1;
  transport.append(playButton, clipClock, reading, element("span", "ag-grow"), zoomKeys, splitButton, addRecordingButton, recordingInput);

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
  const startHandle = element("div", "ag-handle ag-handle-start");
  const endHandle = element("div", "ag-handle ag-handle-end");
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

  // The player of the recording being played; a silent one stands in until a recording is open.
  let audio = new Audio();
  let current = 0;
  const reelTime = () => (recordings[current]?.offset ?? 0) + audio.currentTime;

  const announce = (message: string) => {
    live.textContent = "";
    setTimeout(() => (live.textContent = message), 50);
  };
  // A message on the picture for a few seconds, for what went wrong with something the user did.
  let noticeTimer = 0;
  const tell = (message: string, action?: { label: string; run(): void }) => {
    notice.replaceChildren(message);
    if (action) {
      const key = element("button", "ag-notice-key");
      key.type = "button";
      key.textContent = action.label;
      key.addEventListener("click", () => {
        action.run();
        notice.hidden = true;
        // The key goes with the notice; the picture takes the focus rather than the page.
        if (!document.activeElement || document.activeElement === document.body || notice.contains(document.activeElement)) stage.focus();
      });
      notice.append(" ", key);
    }
    notice.hidden = false;
    announce(action ? `${message}. ${action.label} is on the picture.` : message);
    noticeLength = action ? 9000 : 7000;
    holdNotice(false);
  };
  // A notice stays while it is pointed at or has focus, and goes a few seconds after it is let go.
  let noticeLength = 7000;
  const holdNotice = (held: boolean) => {
    clearTimeout(noticeTimer);
    if (!held && !notice.hidden) noticeTimer = window.setTimeout(() => (notice.hidden = true), noticeLength);
  };
  notice.addEventListener("pointerenter", () => holdNotice(true));
  notice.addEventListener("pointerleave", () => holdNotice(false));
  notice.addEventListener("focusin", () => holdNotice(true));
  notice.addEventListener("focusout", () => holdNotice(false));

  function selectTab(next: Tab) {
    if (next === "elements" && tab !== next && built) renderElements();
    tab = next;
    if (next === "elements") loadLogos();
    root.dataset.tab = next;
    tabButtons.forEach((button, index) => {
      const on = TABS[index] === next;
      button.setAttribute("aria-selected", String(on));
      button.tabIndex = on ? 0 : -1;
      panes[TABS[index]].hidden = !on;
    });
    if (next === "captions") measureCues();
    if (next === "layers") renderLayers();
  }

  // The picture.

  // The picture's sound is a window of the clip around the playhead, never the whole of it, so a clip can run for hours.
  let clipWindow: { key: string; from: number; to: number; samples: Float32Array } | null = null;
  let windowPending: { key: string; from: number } | null = null;
  const clipKey = () => `${generation}|${spans().map(([start, end]) => `${start.toFixed(3)}-${end.toFixed(3)}`).join(",")}`;

  /** The recordings as they stand now, end to end, to read any stretch of the timeline from. */
  const reel = (): Reel => recordings.map(({ source, offset }) => ({ offset, duration: source.duration, read: (start, end, rate) => source.read(start, end, rate) }));

  /** The clip's sound from `from` to `to` seconds into it, read from the recordings' parts as they stand now. */
  function clipReader(): (from: number, to: number) => Promise<Float32Array> {
    const shown = reel();
    const list = spans().map(([start, end]) => [start, end] as const);
    if (!shown.length) return async (from, to) => new Float32Array(Math.max(0, Math.round((to - from) * SAMPLE_RATE)));
    return (from, to) => readClip((start, end, rate) => readReel(shown, start, end, rate), list, from, to, SAMPLE_RATE);
  }

  const sceneAudio = (): Scene["audio"] => {
    const shown = clipWindow?.key === clipKey() ? clipWindow : null;
    const from = shown?.from ?? 0;
    return { samples: shown?.samples ?? SILENCE, sampleRate: SAMPLE_RATE, start: -from, end: Math.max(0, clipLength()) - from, read: clipReader() };
  };

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
    logo,
    links,
    layers: layersFor(layout).map((layer) => (layer.id === editingLayer ? { ...layer, hidden: true } : layer)),
    images: new Map([...pictures].flatMap(([key, picture]): Array<[string, CanvasImageSource]> => (picture.image ? [[key, picture.image]] : picture.video ? [[key, picture.video]] : []))),
    animations: new Map([...pictures].flatMap(([key, picture]): Array<[string, Animation]> => (picture.animation ? [[key, picture.animation]] : []))),
    page,
    music: music ? { samples: music.samples, gain: musicVolume } : null,
    captions: paginate(parts.length ? stitchCues(cues, parts) : clip(cues, range[0], range[1]), pageLength(layout)),
    audio: sceneAudio(),
  });

  let painter = new Painter(scene());
  const ctx = preview.getContext("2d", { alpha: false })!;
  const stage = createStage({
    stage: stageArea,
    canvas: preview,
    surface: scroller,
    labels: labels.stage,
    layers: () => layersFor(layout),
    change: setLayers,
    theme: () => theme,
    documentColours: () => usedColours(),
    notify: (message, action) => tell(message, action),
    rehearse: (ids, part) => rehearse(ids, part),
    deviceBox(layer, device) {
      // The mockup keeps its middle and height; its width follows the device's own shape.
      const { width, height } = SIZES[layout];
      let h = layer.h;
      let w = (h * height * DEVICES[device].aspect) / width;
      if (w > 0.9) {
        h *= 0.9 / w;
        w = 0.9;
      }
      return { device, w, h, x: layer.x + layer.w / 2 - w / 2, y: layer.y + layer.h / 2 - h / 2 };
    },
    fonts: () => fontList,
    loadFont: (name, sample) => loadFont(name, sample).then(refit),
    textOf: (layer) => painter.textOf(layer, 0),
    setText(layer, text) {
      if (layer.kind === "title") title = text;
      else if (layer.kind === "name") speaker = text;
      else if (layer.kind === "handle") handle = text;
      if (layer.kind === "text") setLayers(layersFor(layout).map((item) => (item.id === layer.id ? { ...item, text } : item)), false);
      else rebuild();
      titleField.querySelector("input")!.value = title;
      speakerField.querySelector("input")!.value = speaker;
      handleField.querySelector("input")!.value = handle;
    },
    setEditing(id) {
      editingLayer = id;
      rebuild();
    },
    enabled: () => !tapping && !exporting && root.dataset.state !== "empty",
    fontFamily: () => family,
    frameSize: () => SIZES[layout],
    layerName,
    announce,
    time: () => clipTime(),
    mediaSize(layer) {
      const picture = pictures.get(layer.image ?? "");
      if (picture?.image) return { width: picture.image.naturalWidth, height: picture.image.naturalHeight };
      if (picture?.video?.videoWidth) return { width: picture.video.videoWidth, height: picture.video.videoHeight };
      return null;
    },
    add(what) {
      if (what === "text") addText(labels.newText.body, 60, 400);
      else if (what === "line") addShape({ shape: "line", strokeWidth: 8, wide: true, line: true });
      else addShape(what === "circle" ? { shape: "ellipse" } : { shape: "rect", radius: 0 });
    },
    open(layer) {
      if (layer.kind === "links") {
        selectTab("text");
        linkGroup.querySelector("input")?.focus();
        return true;
      }
      if (layer.kind === "captions") {
        selectTab("captions");
        cueList.querySelector<HTMLElement>(".ag-cue-text")?.focus();
        return true;
      }
      return false;
    },
    replace(layer) {
      if (layer.kind === "avatar") coverRow.choose();
      else {
        replacing = layer.id;
        replaceInput.click();
      }
    },
  });

  // Zoom, as a share of the design's own size; null fits the page in the stage.
  const ZOOMS = [10, 25, 33, 50, 67, 75, 100, 125, 150, 200, 300];
  let zoom: number | null = null;
  /** The zoom the picture shows at now, fitted or not, as a share of the design's size. */
  const shownZoom = () => Math.round((preview.getBoundingClientRect().width / SIZES[layout].width) * 100);
  function applyZoom(next: number | null) {
    zoom = next;
    const { width, height } = SIZES[layout];
    if (zoom === null) {
      preview.style.removeProperty("width");
      preview.style.removeProperty("height");
      delete stageArea.dataset.zoomed;
    } else {
      preview.style.width = `${(width * zoom) / 100}px`;
      preview.style.height = `${(height * zoom) / 100}px`;
      stageArea.dataset.zoomed = "";
    }
    zoomLevel.textContent = `${shownZoom()}%`;
    zoomLevel.setAttribute("aria-label", `${labels.zoomLevel(shownZoom())}. ${labels.fitPage}`);
    zoomLevel.setAttribute("aria-pressed", String(zoom === null));
    stage?.refresh();
  }
  const zoomStep = (way: 1 | -1) => {
    const now = shownZoom();
    const next = way > 0 ? ZOOMS.find((level) => level > now + 1) : [...ZOOMS].reverse().find((level) => level < now - 1);
    applyZoom(next ?? (way > 0 ? ZOOMS[ZOOMS.length - 1] : ZOOMS[0]));
  };
  zoomIn.addEventListener("click", () => zoomStep(1));
  zoomOut.addEventListener("click", () => zoomStep(-1));
  zoomLevel.addEventListener("click", () => applyZoom(null));
  // Ctrl or Cmd with the wheel over the picture zooms, the way it does in a design tool.
  scroller.addEventListener("wheel", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    // In proportion to the wheel, so a trackpad's many small steps zoom smoothly and a mouse's few clicks still go far.
    applyZoom(Math.min(300, Math.max(10, Math.round(shownZoom() * Math.exp(-event.deltaY * 0.0025)))));
  }, { passive: false });
  const zoomWatch = new ResizeObserver(() => {
    if (zoom === null) zoomLevel.textContent = `${shownZoom()}%`;
  });
  zoomWatch.observe(scroller);

  function sizePreview() {
    // Half size: plenty for a preview, and a quarter of the pixels to paint every frame.
    const { width, height } = SIZES[layout];
    if (preview.width !== width / 2 || preview.height !== height / 2) {
      preview.width = width / 2;
      preview.height = height / 2;
    }
    stageArea.dataset.layout = layout;
  }

  function paint() {
    const time = clipTime();
    // Moving along the same clip reads the sound ahead; a changed clip waits for its edits to settle (scheduleClip).
    if (clipWindow?.key === clipKey()) loadWindow(time);
    painter.paint(ctx, time);
    const index = cueAt(painter.scene.captions, time);
    preview.setAttribute("aria-label", [title, speaker, index >= 0 ? painter.scene.captions[index].text : ""].filter(Boolean).join(". "));
  }

  const settings = (): Settings => ({
    title,
    speaker,
    handle,
    cover: coverSource,
    background: backgroundSource(),
    logo: logoSource,
    music: musicSource,
    musicVolume,
    links: links.map((link) => link.trim()).filter(Boolean),
    layout,
    visual,
    theme: THEMES.includes(theme) ? THEMES.indexOf(theme) : theme,
    layers: Object.fromEntries(Object.entries(designs).map(([name, list]) => [name, list!.map((layer) => ({ ...layer }))])),
    images: Object.fromEntries([...pictures].filter(([key, picture]) => picture.listed || usedPicture(key)).map(([key, picture]) => [key, picture.source])),
    page,
    recent: [...recent],
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
    placeCaptions();
    painter = new Painter(scene());
    painter.animate = animating;
    painter.placeholders = true;
    painter.placeholderText = labels.dropPhoto;
    painter.captionsSample = animating ? "" : labels.captionsSample;
    painter.samples = animating ? {} : labels.wordSamples;
    painter.rehearse = rehearsal;
    sizePreview();
    paint();
    renderCues();
    stage?.refresh();
    if (tab === "layers" && !timingHeld) renderLayers();
    if (built) showBackgroundRow();
  }

  // Free editing: layers, their history, what can be added, and the fonts and pictures they use.

  const measurer = element("canvas", "").getContext("2d")!;
  const family = options.font ?? "Geist, ui-sans-serif, system-ui, sans-serif";
  /** Free text grows and shrinks with its words: down as it wraps, and across too when its box hugs it. A box that
   *  would run past the page's margins stops there and wraps from then on. */
  const fitted = (start: Layer): Layer => {
    if (start.kind !== "text") return start;
    const { width, height } = SIZES[layout];
    let layer = start;
    if (layer.autoWidth) {
      const unit = Math.min(width, height) / 1080;
      const least = (0.6 * (layer.size ?? 40) * unit) / width;
      const most = 1 - (2 * Math.round(Math.min(width, height) * 0.074)) / width;
      // A hair to spare, so rounding at a smaller preview never pushes the last letter onto a line of its own.
      const natural = textWidth(measurer, layer, layer.text ?? "", family, width, height) + 2 / width;
      layer = widthAnchored(layer, Math.min(most, Math.max(least, natural)), width, height);
      if (natural >= most) layer = { ...layer, x: Math.min(Math.max(layer.x, (1 - most) / 2), 1 - (1 - most) / 2 - layer.w) };
    }
    const h = Math.max(0.02, textHeight(measurer, layer, layer.text ?? "", family, width, height));
    // The box grows down from its own top edge, which for a turned layer isn't straight down the frame.
    const grow = ((h - layer.h) * height) / 2;
    const angle = (layer.rotation * Math.PI) / 180;
    return { ...layer, h, x: layer.x - (Math.sin(angle) * grow) / width, y: layer.y + (Math.cos(angle) * grow) / height - (h - layer.h) / 2 };
  };
  const usedPicture = (key: string) => LAYOUTS.some((name) => layersFor(name).some((layer) => layer.image === key));

  // Each change ended by the user is a step to undo: the layers of every shape and the frame's own words.
  const history: string[] = [];
  let historyAt = -1;
  const snapshot = () => JSON.stringify({ designs, title, speaker, handle, page, theme: THEMES.includes(theme) ? THEMES.indexOf(theme) : theme });
  function record() {
    const now = snapshot();
    if (history[historyAt] === now) return;
    history.splice(historyAt + 1);
    history.push(now);
    if (history.length > 100) history.shift();
    historyAt = history.length - 1;
    undoButton.disabled = historyAt <= 0;
    redoButton.disabled = true;
  }
  /** A layer's name for people. */
  function layerName(layer: Layer): string {
    if (layer.kind === "text") return labels.textLayer((layer.text ?? "").split(/\s+/).slice(0, 4).join(" ") || "…");
    if (layer.kind === "visual") return labels.elementNames[layer.visual ?? visual];
    return labels.layerNames[layer.kind];
  }

  function renderLayers() {
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-layer]");
    const selectedId = stage?.selected?.id;
    layerList.replaceChildren(...[...layersFor(layout)].reverse().map((layer) => {
      const row = element("li", "ag-layer-row");
      if (layer.hidden) row.dataset.hidden = "";
      if (layer.id === selectedId) row.dataset.selected = "";
      const name = layerName(layer);
      const pick = element("button", "ag-layer-pick");
      pick.type = "button";
      pick.textContent = name;
      pick.dataset.layer = `${layer.id}:pick`;
      pick.setAttribute("aria-label", labels.selectLayer(name));
      pick.disabled = Boolean(layer.hidden);
      pick.addEventListener("click", () => {
        stage.select(layer.id);
        stage.focus();
      });
      const toggle = keyButton("ag-layer-toggle", layer.hidden ? labels.stage.hide : labels.tabs.layers, layer.hidden ? ICONS.hide : ICONS.show);
      rename(toggle, "");
      toggle.dataset.layer = `${layer.id}:toggle`;
      toggle.setAttribute("aria-label", layer.hidden ? labels.showLayer(name) : labels.hideLayer(name));
      toggle.title = toggle.getAttribute("aria-label")!;
      toggle.setAttribute("aria-pressed", String(!layer.hidden));
      toggle.addEventListener("click", () => {
        setLayers(layersFor(layout).map((item) => (item.id === layer.id ? { ...item, hidden: !item.hidden } : item)), true);
        announce(layer.hidden ? labels.selectLayer(name) : labels.stage.hidden(name));
      });
      row.append(pick, toggle);
      if (clipLength() > 0) row.append(timingTrack(layer, name));
      return row;
    }));
    if (focused?.dataset.layer) layerList.querySelector<HTMLElement>(`[data-layer="${focused.dataset.layer}"]`)?.focus();
  }

  // While a layer's time is dragged, the list stays as it is; it is drawn again when the drag ends.
  let timingHeld = false;

  /**
   * A layer's stretch of the clip, as a bar along the clip's length: drag its ends to set when it shows from and
   * until, or the bar to move both; arrows move an end a tenth of a second, a second with Shift.
   */
  function timingTrack(layer: Layer, name: string): HTMLElement {
    const length = clipLength();
    const track = element("div", "ag-layer-time");
    const bar = element("span", "ag-layer-bar");
    const ends = (["from", "until"] as const).map((which) => {
      const end = element("span", `ag-layer-end ag-layer-${which}`);
      end.setAttribute("role", "slider");
      end.tabIndex = 0;
      end.dataset.layer = `${layer.id}:${which}`;
      end.setAttribute("aria-label", `${name}: ${which === "from" ? labels.stage.showFrom : labels.stage.showUntil}`);
      end.setAttribute("aria-valuemin", "0");
      end.setAttribute("aria-valuemax", String(Math.round(length * 10) / 10));
      return end;
    });
    track.append(bar, ...ends);
    let start = Math.min(length, layer.from ?? 0);
    let stop = Math.min(length, layer.until ?? length);
    const place = () => {
      bar.style.left = `${(start / length) * 100}%`;
      bar.style.width = `${(Math.max(0, stop - start) / length) * 100}%`;
      ends[0].style.left = `${(start / length) * 100}%`;
      ends[1].style.left = `${(stop / length) * 100}%`;
      ends.forEach((end, index) => {
        const at = index ? stop : start;
        end.setAttribute("aria-valuenow", String(Math.round(at * 10) / 10));
        end.setAttribute("aria-valuetext", formatTime(at));
      });
    };
    place();
    // The whole clip is the same as no times at all, so the ends at the clip's edges clear them.
    const apply = (done: boolean) => {
      const from = start <= 0.05 ? undefined : Math.round(start * 10) / 10;
      const until = stop >= length - 0.05 ? undefined : Math.round(stop * 10) / 10;
      timingHeld = !done;
      setLayers(layersFor(layout).map((item) => (item.id === layer.id ? { ...item, from, until } : item)), done);
      if (done) renderLayers();
    };
    const drag = (which: "from" | "until" | "both") => (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = track.getBoundingClientRect();
      const x = event.clientX;
      const [first, last] = [start, stop];
      const move = (next: PointerEvent) => {
        const shift = ((next.clientX - x) / rect.width) * length;
        if (which === "from") start = Math.max(0, Math.min(last - 0.1, first + shift));
        else if (which === "until") stop = Math.min(length, Math.max(first + 0.1, last + shift));
        else {
          const span = last - first;
          start = Math.max(0, Math.min(length - span, first + shift));
          stop = start + span;
        }
        place();
        apply(false);
      };
      const end = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        apply(true);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    };
    ends[0].addEventListener("pointerdown", drag("from"));
    ends[1].addEventListener("pointerdown", drag("until"));
    bar.addEventListener("pointerdown", drag("both"));
    ends.forEach((end, index) => end.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 1 : 0.1;
      const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? step : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -step : 0;
      const jump = event.key === "Home" ? -Infinity : event.key === "End" ? Infinity : 0;
      if (!delta && !jump) return;
      event.preventDefault();
      if (index === 0) start = Math.max(0, Math.min(stop - 0.1, jump ? (jump < 0 ? 0 : stop - 0.1) : start + delta));
      else stop = Math.min(length, Math.max(start + 0.1, jump ? (jump > 0 ? length : start + 0.1) : stop + delta));
      place();
      apply(true);
    }));
    return track;
  }

  function travel(step: number) {
    const to = historyAt + step;
    if (to < 0 || to >= history.length) return;
    historyAt = to;
    const state = JSON.parse(history[to]) as { designs: typeof designs; title: string; speaker: string; handle: string; page: Page | null; theme: number | Theme };
    ({ designs, title, speaker, handle, page } = state);
    theme = typeof state.theme === "number" ? THEMES[state.theme] ?? theme : state.theme;
    markTheme();
    renderPageSwatches();
    titleField.querySelector("input")!.value = title;
    speakerField.querySelector("input")!.value = speaker;
    handleField.querySelector("input")!.value = handle;
    undoButton.disabled = historyAt <= 0;
    redoButton.disabled = historyAt >= history.length - 1;
    rebuild();
    changed();
  }

  function setLayers(next: Layer[], done: boolean) {
    designs = { ...designs, [layout]: stacked(next).map(fitted) };
    rebuild();
    if (done) {
      record();
      changed();
    }
  }

  /** A new layer in the middle of the frame, selected, on top of the rest. */
  function addLayer(layer: Layer) {
    setLayers([...layersFor(layout), fitted(layer)], true);
    stage.select(layer.id);
  }
  let added = 0;
  const layerId = (kind: string) => `${kind}-${Date.now().toString(36)}${(added++).toString(36)}`;

  function addText(text: string, size: number, weight: number) {
    const id = layerId("text");
    addLayer({ id, kind: "text", text, x: 0.1, y: 0.42, w: 0.8, h: 0.1, rotation: 0, opacity: 1, size, weight, align: "center", color: "text", autoWidth: true });
    stage.editText(id);
  }

  function addShape(shape: Partial<Layer> & { line?: boolean; wide?: boolean }) {
    const { width, height } = SIZES[layout];
    const side = 0.3 * Math.min(width, height);
    const { line, wide, ...style } = shape;
    const w = (line ? side * 1.6 : wide ? side * 1.4 : side) / width;
    // A drawn line needs room for its arrowheads; a bar is just thin.
    const h = (line ? (style.shape === "line" ? Math.max(40, side * 0.16) : Math.max(6, side * 0.03)) : side) / height;
    addLayer({ id: layerId("shape"), kind: "shape", x: 0.5 - w / 2, y: 0.5 - h / 2, w, h, rotation: 0, opacity: 1, fill: "accent", ...style });
  }

  function addCombo(pair: { heading: string; body: string; headingWeight: number; uppercase?: boolean }) {
    const group = layerId("group");
    const heading: Layer = { id: layerId("text"), kind: "text", group, text: labels.newText.heading, font: pair.heading, size: 96, weight: pair.headingWeight, uppercase: pair.uppercase, align: "center", color: "text", x: 0.1, y: 0.38, w: 0.8, h: 0.1, rotation: 0, opacity: 1, autoWidth: true };
    const body: Layer = { id: layerId("text"), kind: "text", group, text: labels.newText.subheading, font: pair.body, size: 40, weight: 400, align: "center", color: "text", x: 0.15, y: 0.5, w: 0.7, h: 0.06, rotation: 0, opacity: 1, autoWidth: true };
    void Promise.all([loadFont(pair.heading), loadFont(pair.body)]).then(refit);
    setLayers([...layersFor(layout), heading, body], true);
    stage.select(body.id);
  }

  /** A photo from the library, read in as a picture of the user's own so it stays with the design. */
  async function addStockPhoto(photo: StockPhoto) {
    const key = `photo-${photo.id}`;
    if (!pictures.has(key)) {
      try {
        const response = await fetch(photo.url);
        if (!response.ok) throw new Error(String(response.status));
        await keepPicture(await response.blob(), key, false);
      } catch {
        return tell(labels.pictureFailed);
      }
    }
    addPicture(key);
  }

  function renderTemplates() {
    templateGrid.replaceChildren(...hostTemplates.map((choice) => {
      const tile = element("button", "ag-template");
      tile.type = "button";
      tile.setAttribute("aria-label", labels.useTemplate(choice.name));
      const canvas = element("canvas", "ag-template-picture");
      canvas.setAttribute("aria-hidden", "true");
      const name = element("span", "ag-template-name");
      name.textContent = choice.name;
      tile.append(canvas, name);
      tile.dataset.template = choice.id;
      tile.addEventListener("click", () => applyHostTemplate(choice));
      templateWatch?.observe(tile);
      return tile;
    }));
    moreHeading.hidden = templateGrid.hidden = !hostTemplates.length;
  }

  // Each design's picture is drawn when its tile scrolls into view, with the fonts it uses once they arrive.
  const templateWatch = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      templateWatch!.unobserve(entry.target);
      const tile = entry.target as HTMLElement;
      const choice = hostTemplates.find((item) => item.id === tile.dataset.template);
      if (choice) drawTemplate(tile.querySelector("canvas")!, choice);
    }
  }, { root: drawer });

  function drawTemplate(canvas: HTMLCanvasElement, choice: TemplateChoice) {
    const made = choice.make(layout);
    const { width, height } = SIZES[layout];
    const scale = 240 / Math.max(width, height);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const paint = () => {
      // A thumbnail shows the template as it comes, without the user's background or other pictures.
      const painter = new Painter({ ...scene(), backdrop: null, layers: made.layers, page: made.page, theme: made.theme !== undefined ? THEMES[made.theme] ?? theme : theme, overlay: undefined });
      painter.animate = false;
      painter.placeholders = true;
      painter.captionsSample = labels.captionsSample;
      painter.samples = labels.wordSamples;
      painter.paint(canvas.getContext("2d")!, 0);
    };
    paint();
    const fonts = [...new Set(made.layers.map((layer) => layer.font).filter((font): font is string => Boolean(font)))];
    if (fonts.length) void Promise.all(fonts.map((font) => loadFont(font))).then(paint);
  }

  function applyHostTemplate(choice: TemplateChoice) {
    const made = choice.make(layout);
    page = made.page;
    if (made.theme !== undefined) theme = THEMES[made.theme] ?? theme;
    markTheme();
    renderPageSwatches();
    stage.select(null);
    setLayers(made.layers.map((layer) => ({ ...layer })), true);
    void loadUsedFonts().then(refit);
  }

  // Elements: a row of tiles a section, each painted to show what it adds in the design's colours; See all opens a
  // section whole, and the search looks through every one. What was added lately comes first.
  const allTiles = elementTiles(labels.elementNames);
  let recent: string[] = (options.recent ?? []).filter((tileId) => allTiles.some((tile) => tile.id === tileId)).slice(0, 8);
  // Stock media from the host's sources, a kind to a section, and logos. What a source shows is fetched once a query
  // and page, and kept for the visit.
  type MediaSection = "photos" | "illustrations" | "videos" | "stickers" | "gifs";
  type PanelView = SectionId | "recent" | MediaSection | "logos";
  const MEDIA_KIND: Record<MediaSection, MediaKind> = { photos: "photo", illustrations: "illustration", videos: "video", stickers: "sticker", gifs: "gif" };
  const isMedia = (view: PanelView): view is MediaSection => view in MEDIA_KIND;
  let openSection: PanelView | null = null;
  // In a section opened whole: which of its sources shows, and how many pages of it.
  let openFeed = 0;
  let openPages = 1;
  const ROW: Partial<Record<PanelView, number>> = { shapes: 8 };
  const feedsFor = (section: MediaSection) => (library.media ?? []).filter((feed) => feed.kind === MEDIA_KIND[section]);
  const mediaCache = new Map<string, Promise<MediaPage>>();
  function mediaPage(feed: MediaFeed, query: string, page: number): Promise<MediaPage> {
    const key = `${feed.source}|${feed.kind}|${query}|${page}`;
    let found = mediaCache.get(key);
    if (!found) {
      found = feed.search(query, page);
      mediaCache.set(key, found);
      // A failed page is asked for again next time rather than remembered.
      found.catch(() => mediaCache.delete(key));
    }
    return found;
  }
  let logoSet: { featured: string[]; logos: Logo[] } | null = null;
  let logosAsked = false;
  function loadLogos() {
    if (logosAsked || !library.logos) return;
    logosAsked = true;
    void library.logos().then((set) => (logoSet = set), () => (logoSet = { featured: [], logos: [] })).then(() => {
      if (tab === "elements") renderElements();
    });
  }
  const logosMatching = (query: string) => {
    if (!logoSet) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      const first = logoSet.featured.map((id) => logoSet!.logos.find((logo) => logo.id === id)).filter((logo): logo is Logo => Boolean(logo));
      return [...first, ...logoSet.logos.filter((logo) => !logoSet!.featured.includes(logo.id))];
    }
    return logoSet.logos.filter((logo) => words.every((word) => logo.name.toLowerCase().split(/[^a-z0-9]+/).some((part) => part.startsWith(word)) || logo.id.startsWith(word)));
  };

  function renderElements() {
    const query = elementSearch.value.trim();
    // The logo set is a few megabytes, so it's read when someone first opens Elements, not with the editor.
    if (tab === "elements") loadLogos();
    const grid = (tiles: ElementTile[]) => {
      const node = element("div", "ag-el-grid");
      node.append(...tiles.map(elementTile));
      return node;
    };
    const help = (text: string) => {
      const node = element("p", "ag-help");
      node.textContent = text;
      return node;
    };
    const head = (name: string, section: PanelView | "photos-tab", more: boolean) => {
      const row = element("div", "ag-el-head");
      const title = element("h3", "ag-heading");
      title.textContent = name;
      row.append(title);
      if (more) {
        const all = keyButton("ag-el-all", labels.seeAll, ICONS.next);
        all.setAttribute("aria-label", labels.seeAllOf(name));
        all.addEventListener("click", () => {
          if (section === "photos-tab") return selectTab("photos");
          openSection = section;
          openFeed = 0;
          openPages = 1;
          renderElements();
          elementsBody.querySelector<HTMLElement>(".ag-el-back")?.focus();
        });
        row.append(all);
      }
      return row;
    };
    // Each source shown is credited under its results, linked to it, as the sources ask.
    const credits = (feeds: MediaFeed[]) => {
      const line = element("p", "ag-el-credit");
      feeds.forEach((feed, index) => {
        const link = element("a", "");
        link.href = feed.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = feed.credit;
        line.append(...(index ? [" · ", link] : [link]));
      });
      return line;
    };
    const logoGrid = (logos: Logo[]) => {
      const node = element("div", "ag-el-grid");
      node.append(...logos.map(logoTile));
      return node;
    };
    /** A section of stock media: the first results of its first source, then the credits. */
    const mediaBlock = (section: MediaSection, extra: HTMLElement[] = []) => {
      const feeds = feedsFor(section);
      const block = element("section", "ag-el-section");
      block.dataset.section = section;
      block.append(head(labels.sectionNames[section], section, Boolean(feeds.length) || extra.length > 0), ...extra);
      if (feeds.length) block.append(mediaGrid(feeds[0], query, 1, query ? 8 : 4), credits(feeds));
      return block;
    };
    const parts: HTMLElement[] = [];
    if (query && !openSection) {
      const found = searchTiles(allTiles, query);
      if (found.length) parts.push(grid(found));
      for (const section of Object.keys(MEDIA_KIND) as MediaSection[]) if (feedsFor(section).length) parts.push(mediaBlock(section));
      const logos = logosMatching(query);
      if (logos.length) {
        const block = element("section", "ag-el-section");
        block.dataset.section = "logos";
        block.append(head(labels.sectionNames.logos, "logos", logos.length > 8), logoGrid(logos.slice(0, 8)));
        parts.push(block);
      }
      if (!parts.length) parts.push(help(labels.nothingFound));
    } else if (openSection) {
      const back = keyButton("ag-el-back", labels.backToElements, ICONS.previous);
      back.addEventListener("click", () => {
        const was = openSection;
        openSection = null;
        renderElements();
        elementsBody.querySelector<HTMLElement>(`[data-section="${was}"] .ag-el-all`)?.focus();
      });
      const name = element("h3", "ag-heading");
      name.textContent = labels.sectionNames[openSection];
      parts.push(back, name);
      if (openSection === "logos") {
        const logos = logosMatching(query);
        parts.push(logoGrid(logos.slice(0, openPages * 120)));
        if (!logoSet) parts.push(help(labels.loadingLibrary));
        if (logos.length > openPages * 120) parts.push(moreKey());
      } else {
        const tiles = openSection === "recent" ? recentTiles() : allTiles.filter((tile) => tile.section === openSection);
        const shownTiles = query ? searchTiles(tiles, query) : tiles;
        if (shownTiles.length) parts.push(grid(shownTiles));
        if (openSection === "videos") parts.push(uploadVideoTile());
        if (isMedia(openSection)) {
          const feeds = feedsFor(openSection);
          if (feeds.length > 1) {
            // One source at a time, picked from a row of keys.
            const row = element("div", "ag-chips ag-el-sources");
            row.setAttribute("role", "radiogroup");
            row.setAttribute("aria-label", labels.mediaSource);
            feeds.forEach((feed, index) => {
              const chip = element("button", "ag-key ag-chip");
              chip.type = "button";
              chip.setAttribute("role", "radio");
              chip.setAttribute("aria-checked", String(index === openFeed));
              chip.textContent = feed.name;
              chip.addEventListener("click", () => {
                openFeed = index;
                openPages = 1;
                renderElements();
                elementsBody.querySelector<HTMLElement>(".ag-el-sources [aria-checked=true]")?.focus();
              });
              row.append(chip);
            });
            parts.push(row);
          }
          const feed = feeds[Math.min(openFeed, feeds.length - 1)];
          if (feed) parts.push(mediaGrid(feed, query, openPages, undefined, true), credits([feed]));
        }
      }
    } else {
      const order: PanelView[] = [...(recent.length ? ["recent" as const] : []), "audio", "shapes", "lines", "frames", "grids", "photos", "illustrations", "videos", "stickers", "gifs", "logos", "charts", "tables", "mockups", "solids"];
      for (const section of order) {
        if (section === "logos") {
          if (!library.logos) continue;
          const block = element("section", "ag-el-section");
          block.dataset.section = "logos";
          block.append(head(labels.sectionNames.logos, "logos", true), logoSet ? logoGrid(logosMatching("").slice(0, 8)) : help(labels.loadingLibrary));
          parts.push(block);
          continue;
        }
        if (section === "videos") {
          const tiles = allTiles.filter((tile) => tile.section === "videos");
          parts.push(mediaBlock("videos", [grid(tiles.slice(0, 4))]));
          continue;
        }
        if (isMedia(section)) {
          if (feedsFor(section).length) parts.push(mediaBlock(section));
          // Without a photo source, the photos the page bundles stand in, the rest a press away in Photos.
          else if (section === "photos" && library.photos?.length) {
            const photos = element("section", "ag-el-section");
            photos.dataset.section = "photos";
            const row = element("div", "ag-el-grid");
            row.append(...library.photos.slice(0, 4).map((photo) => {
              const button = element("button", "ag-el");
              button.type = "button";
              button.setAttribute("aria-label", labels.addElement(photo.name));
              const picture = element("img", "ag-el-picture");
              picture.alt = "";
              picture.loading = "lazy";
              picture.src = photo.thumb;
              const name = element("span", "ag-el-name");
              name.textContent = photo.name;
              button.append(picture, name);
              button.addEventListener("click", () => void addStockPhoto(photo));
              return button;
            }));
            photos.append(head(labels.sectionNames.photos, "photos-tab", library.photos.length > 4), row);
            parts.push(photos);
          }
          continue;
        }
        const tiles = section === "recent" ? recentTiles() : allTiles.filter((tile) => tile.section === section);
        const shown = ROW[section] ?? 4;
        const block = element("section", "ag-el-section");
        block.dataset.section = section;
        block.append(head(labels.sectionNames[section], section, tiles.length > shown), grid(tiles.slice(0, shown)));
        parts.push(block);
      }
    }
    elementsBody.replaceChildren(...parts);
  }

  /** The key under a section opened whole that shows another page of it. */
  function moreKey() {
    const more = keyButton("ag-el-more", labels.loadMore, ICONS.add);
    more.addEventListener("click", () => {
      openPages++;
      renderElements();
      elementsBody.querySelector<HTMLElement>(".ag-el-more")?.focus();
    });
    return more;
  }

  /** A grid of one source's results, filled in when they arrive; `paged` adds a key for the next page. */
  function mediaGrid(feed: MediaFeed, query: string, pages: number, limit?: number, paged = false): HTMLElement {
    const box = element("div", "ag-el-media");
    const node = element("div", "ag-el-grid");
    node.setAttribute("aria-busy", "true");
    box.append(node);
    void Promise.all(Array.from({ length: pages }, (_, index) => mediaPage(feed, query, index + 1)))
      .then((all) => {
        const items = all.flatMap((page) => page.items).slice(0, limit);
        node.replaceChildren(...items.map((item) => mediaTile(item, feed)));
        if (!items.length) box.append(Object.assign(element("p", "ag-help"), { textContent: labels.nothingFound }));
        if (paged && all[all.length - 1]?.more) box.append(moreKey());
      })
      .catch(() => node.replaceChildren(Object.assign(element("p", "ag-help"), { textContent: labels.mediaUnavailable })))
      .finally(() => node.removeAttribute("aria-busy"));
    return box;
  }

  /** A stock result: its preview and name; pressing it brings the file in and puts it on the picture. */
  function mediaTile(item: MediaItem, feed: MediaFeed) {
    const button = element("button", "ag-el ag-el-stock");
    button.type = "button";
    button.dataset.kind = item.kind;
    const by = item.credit?.name ? labels.mediaBy(item.credit.name, feed.name) : feed.name;
    button.setAttribute("aria-label", `${labels.addElement(item.name)}. ${by}`);
    button.title = `${item.name}\n${by}`;
    const picture = element("img", "ag-el-picture");
    picture.alt = "";
    picture.loading = "lazy";
    picture.decoding = "async";
    picture.referrerPolicy = "no-referrer";
    picture.src = item.thumb;
    const name = element("span", "ag-el-name");
    name.textContent = item.name;
    button.append(picture, name);
    button.addEventListener("click", () => void addMedia(item, button));
    return button;
  }

  /** A brand's logo, drawn in its colour. */
  function logoTile(logo: Logo) {
    const button = element("button", "ag-el ag-el-logo");
    button.type = "button";
    button.setAttribute("aria-label", labels.addElement(logo.name));
    button.title = logo.name;
    const box = element("span", "ag-el-picture");
    const picture = icon("");
    picture.setAttribute("viewBox", "0 0 24 24");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", logo.path);
    path.setAttribute("fill", logo.hex);
    picture.append(path);
    box.append(picture);
    const name = element("span", "ag-el-name");
    name.textContent = logo.name;
    button.append(box, name);
    button.addEventListener("click", () => addLogo(logo));
    return button;
  }

  /** A logo on the picture, a sixth of the page across, in its brand's colour. */
  function addLogo(logo: Logo) {
    const { width, height } = SIZES[layout];
    const side = 0.16 * Math.min(width, height);
    addLayer({ id: layerId("graphic"), kind: "graphic", art: { w: 24, h: 24, paths: [{ d: logo.path, fill: "currentColor" }] }, color: logo.hex, x: 0.5 - side / width / 2, y: 0.5 - side / height / 2, w: side / width, h: side / height, rotation: 0, opacity: 1 });
  }

  /** A stock result brought in once and kept with the design, then put on the picture, or into the empty frame
   *  that is picked. Sources ask that what is used is kept, not linked to. */
  async function addMedia(item: MediaItem, button: HTMLElement) {
    if (button.getAttribute("aria-busy") === "true") return;
    button.setAttribute("aria-busy", "true");
    const key = `stock-${item.id}`;
    try {
      if (!pictures.has(key)) {
        const response = await fetch(item.file);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        const video = VIDEO_TYPES.includes(blob.type);
        if (!video && !PICTURE_TYPES.includes(blob.type)) throw new Error(blob.type);
        if (blob.size > (video ? VIDEO_LIMIT : PICTURE_LIMIT)) throw new Error("size");
        await keepPicture(blob, key, false);
      }
      addPicture(key);
    } catch {
      tell(labels.mediaFailed);
    } finally {
      button.removeAttribute("aria-busy");
    }
  }

  elementSearch.addEventListener("input", () => {
    openSection = null;
    // A pause in typing before the sources are asked, so each letter doesn't send a search.
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(renderElements, 300);
  });
  let searchTimer = 0;
  const recentTiles = () => recent.map((tileId) => allTiles.find((tile) => tile.id === tileId)).filter((tile): tile is ElementTile => Boolean(tile));

  /** Whether a colour has next to no hue, as the Paper theme's black accent has. */
  const neutral = (hex: string) => {
    const { s, v } = hexToHsv(hex);
    return s < 0.15 || v < 0.12;
  };
  /** A new element on a theme whose accent is black, white or grey takes gold for that accent, so it arrives with colour. */
  function vivid(layer: Layer): Layer {
    if (!neutral(theme.accent)) return layer;
    const gold = (paint: string | undefined) => (paint === undefined || paint === "accent" ? "metal:gold" : paint);
    if (layer.kind === "shape" || layer.kind === "chart" || layer.kind === "solid" || layer.kind === "table") return { ...layer, fill: gold(layer.fill) };
    if (layer.kind === "visual") return { ...layer, color: gold(layer.color) };
    return layer;
  }

  /** A tile: what it adds, painted small in the design's colours, and its name under it. */
  function elementTile(tile: ElementTile) {
    const button = element("button", "ag-el");
    button.type = "button";
    button.dataset.tile = tile.id;
    button.setAttribute("aria-label", labels.addElement(tile.name));
    button.title = tile.name;
    const picture = element("canvas", "ag-el-picture");
    picture.setAttribute("aria-hidden", "true");
    const name = element("span", "ag-el-name");
    name.textContent = tile.name;
    button.append(picture, name);
    button.addEventListener("click", () => addFromTile(tile));
    if (tileWatch) tileWatch.observe(button);
    else paintTile(picture, tile);
    return button;
  }
  function uploadVideoTile() {
    const button = element("button", "ag-el ag-el-upload");
    button.type = "button";
    const picture = element("span", "ag-el-picture");
    picture.append(icon(ICONS.video));
    const name = element("span", "ag-el-name");
    name.textContent = labels.uploadVideo;
    button.append(picture, name);
    button.addEventListener("click", () => uploadInput.click());
    const row = element("div", "ag-el-grid");
    row.append(button);
    return row;
  }
  const tileWatch = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      tileWatch!.unobserve(entry.target);
      const button = entry.target as HTMLElement;
      const tile = allTiles.find((item) => item.id === button.dataset.tile);
      if (tile) paintTile(button.querySelector("canvas")!, tile);
    }
  }, { root: drawer });

  // A tile's sound: a voice-like hum, so the sound tiles look alive; and a caption with a word being said.
  const TILE_RATE = 8000;
  const tileSound = Float32Array.from({ length: TILE_RATE * 6 }, (_, i) => (Math.sin((i / TILE_RATE) * 2 * Math.PI * 220) * 0.5 + Math.sin((i / TILE_RATE) * 2 * Math.PI * 660) * 0.3) * (0.4 + 0.6 * Math.abs(Math.sin((i / TILE_RATE) * 7))));
  function paintTile(canvas: HTMLCanvasElement, tile: ElementTile) {
    const side = 144;
    canvas.width = side;
    canvas.height = side;
    const made = tile.make("square", (kind) => `${kind}-tile`).map((layer) => {
      const shown = vivid(layer);
      // A sound visual's own box is a wide strip; in a tile it gets the height to show its bars, wave or pulse.
      return shown.kind === "visual" ? { ...shown, x: 0.12, y: 0.3, w: 0.76, h: 0.4 } : shown;
    });
    if (!made.length) return;
    // The tile shows the layers fitted into its middle, their shape kept; a full-page background fills it.
    const left = Math.min(...made.map((layer) => layer.x));
    const top = Math.min(...made.map((layer) => layer.y));
    const right = Math.max(...made.map((layer) => layer.x + layer.w));
    const bottom = Math.max(...made.map((layer) => layer.y + layer.h));
    const fill = tile.under ? 1 : 0.76 / Math.max(right - left, bottom - top);
    // Words, tables and lines true to scale would be a pixel or two at this size, so a tile draws them bolder.
    const line = (layer: Layer) => layer.kind === "shape" && layer.shape === "line";
    const worded = (layer: Layer) => layer.kind === "table" || layer.kind === "captions" || layer.kind === "text" || layer.kind === "title" || layer.kind === "name" || layer.kind === "handle" || layer.kind === "links" || layer.kind === "time";
    const layers = made.map((layer) => ({
      ...layer,
      x: 0.5 + (layer.x - (left + right) / 2) * fill,
      y: 0.5 + (layer.y - (top + bottom) / 2) * fill,
      w: layer.w * fill,
      h: layer.h * fill,
      size: worded(layer) ? (layer.size ?? (layer.kind === "table" ? 30 : 40)) * fill * 1.9 : layer.size,
      strokeWidth: layer.strokeWidth ? Math.max(3, layer.strokeWidth * fill * (line(layer) ? 3.2 : 1.4)) : layer.strokeWidth,
      enter: undefined,
      exit: undefined,
    }));
    const painter = new Painter({
      ...scene(),
      layout: "square",
      layers,
      page: { color: theme.background },
      backdrop: null,
      logo: null,
      overlay: undefined,
      captions: [{ start: 4.5, end: 6, text: labels.captionsSample }],
      audio: { samples: tileSound, sampleRate: TILE_RATE, start: 0, end: 6 },
    });
    painter.animate = false;
    painter.placeholders = true;
    // Sound bars ease towards the sound, so a few frames first let them rise to it.
    const ctx = canvas.getContext("2d")!;
    // Late in the hum, so a wave's few seconds behind the playhead are all sound.
    for (const at of [4.85, 4.9, 4.95, 5]) painter.paint(ctx, at);
  }

  /** Adds a tile's layers on top of the design, or a moving background under it, and keeps the tile for Recently used. */
  function addFromTile(tile: ElementTile) {
    recent = [tile.id, ...recent.filter((tileId) => tileId !== tile.id)].slice(0, 8);
    if (tile.part) addElement(tile.part.kind, tile.part.look);
    else {
      const made = tile.make(layout, layerId).map((layer) => fitted(vivid(tile.under ? { ...layer, backdrop: true } : layer)));
      if (!made.length) return;
      const kept = tile.under ? layersFor(layout).filter((layer, index) => !layer.backdrop && !(index === 0 && isBackgroundLayer(layer))) : layersFor(layout);
      setLayers(tile.under ? [...made, ...kept] : [...kept, ...made], true);
      stage.select(made[made.length - 1].id);
      if (tile.under) tell(labels.addedUnder(tile.name));
    }
    changed();
    // Recently used comes first when the panel is next drawn; drawn now, it would move the tile just pressed.
  }

  /** A picture or video put into a frame or a mockup's screen, in place of what it showed. */
  async function fillFrame(frameId: string, file: Blob) {
    const video = VIDEO_TYPES.includes(file.type);
    if (!video && !PICTURE_TYPES.includes(file.type)) return tell(labels.uploadFailed);
    if (file.size > (video ? VIDEO_LIMIT : PICTURE_LIMIT)) return tell(video ? labels.videoTooBig : labels.pictureTooBig);
    const key = layerId("picture");
    try {
      await keepPicture(file, key, true);
    } catch {
      return tell(video ? labels.uploadFailed : labels.pictureFailed);
    }
    setLayers(layersFor(layout).map((layer) => (layer.id !== frameId ? layer : { ...layer, image: key, crop: undefined, kind: layer.kind === "mockup" ? "mockup" : video ? "video" : "image" })), true);
    stage.select(frameId);
    renderUploads();
    if (video) syncVideos(clipTime(), !audio.paused);
    announce(labels.frameFilled);
  }

  /** A dropped picture or video, kept with the uploads and put on the picture on top of the rest. */
  async function uploadAndPlace(file: Blob) {
    const video = VIDEO_TYPES.includes(file.type);
    if (file.size > (video ? VIDEO_LIMIT : PICTURE_LIMIT)) return tell(video ? labels.videoTooBig : labels.pictureTooBig);
    const key = layerId("picture");
    try {
      await keepPicture(file, key, true);
    } catch {
      return tell(video ? labels.uploadFailed : labels.pictureFailed);
    }
    addPicture(key);
    renderUploads();
    changed();
  }

  // Showing a movement once: the picked layers play their way in, out or loop on the picture, the rest held still, for
  // the movement's length and a breath after it. Playing, an edit or a press on the picture ends it.
  /** Words measured before their font arrived are fitted again once it has, without making a step to undo. */
  function refit() {
    const before = JSON.stringify(layersFor(layout));
    const after = layersFor(layout).map(fitted);
    if (JSON.stringify(after) !== before) {
      designs = { ...designs, [layout]: after };
      if (historyAt >= 0) history[historyAt] = snapshot();
      changed();
    }
    rebuild();
  }

  let rehearsal: { ids: Set<string>; part: "enter" | "exit" | "loop"; at: number } | null = null;
  let rehearsalFrame = 0;
  function stopRehearsal() {
    cancelAnimationFrame(rehearsalFrame);
    if (!rehearsal) return;
    rehearsal = null;
    painter.rehearse = null;
    paint();
  }
  function rehearse(ids: string[], part: "enter" | "exit" | "loop") {
    stopRehearsal();
    if (!ids.length || animating) return;
    const chosen = layersFor(layout).filter((layer) => ids.includes(layer.id));
    const span = Math.max(...chosen.map((layer) => {
      const way = part === "enter" ? layer.enter : part === "exit" ? layer.exit : undefined;
      return (part === "loop" ? 3 : way ? entranceLength(way) : 0) / Math.min(4, Math.max(0.25, layer.speed ?? 1));
    }), 0);
    if (!span) return;
    const started = performance.now();
    const step = () => {
      const at = (performance.now() - started) / 1000;
      rehearsal = at <= span + 0.4 ? { ids: new Set(ids), part, at } : null;
      painter.rehearse = rehearsal;
      paint();
      if (rehearsal) rehearsalFrame = requestAnimationFrame(step);
    };
    step();
  }

  function renderPhotos() {
    const words = photoSearch.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const shown = (library.photos ?? []).filter((photo) => words.every((word) => `${photo.name} ${photo.theme ?? ""}`.toLowerCase().includes(word)));
    photoGrid.replaceChildren(...shown.map((photo) => {
      const button = element("button", "ag-photo");
      button.type = "button";
      button.title = labels.photoBy(photo.name, photo.credit ?? "");
      button.setAttribute("aria-label", labels.addPicture(photo.name));
      const thumb = element("img", "");
      thumb.alt = "";
      thumb.loading = "lazy";
      thumb.decoding = "async";
      thumb.src = photo.thumb;
      button.append(thumb);
      button.addEventListener("click", () => void addStockPhoto(photo));
      return button;
    }));
    photosHeading.hidden = photoSearch.hidden = photoGrid.hidden = !library.photos?.length;
  }
  photoSearch.addEventListener("input", renderPhotos);

  // Pairs of fonts that sit well together, offered once the fonts they need are on the list.
  const COMBOS = [
    { heading: "Bebas Neue", body: "Inter Variable", headingWeight: 400, uppercase: true },
    { heading: "Playfair Display Variable", body: "DM Sans Variable", headingWeight: 700 },
    { heading: "Anton", body: "Space Grotesk Variable", headingWeight: 400, uppercase: true },
    { heading: "Abril Fatface", body: "Raleway Variable", headingWeight: 400 },
    { heading: "Syne Variable", body: "Outfit Variable", headingWeight: 800 },
    { heading: "Archivo Black", body: "Archivo Variable", headingWeight: 400 },
    { heading: "DM Serif Display", body: "Montserrat Variable", headingWeight: 400 },
    { heading: "Unbounded Variable", body: "Nunito Variable", headingWeight: 700 },
  ];
  function renderCombos() {
    const known = new Set(fontList.map((font) => font.family));
    const usable = COMBOS.filter((pair) => known.has(pair.heading) && known.has(pair.body));
    comboGrid.replaceChildren(...usable.map((pair) => {
      const button = element("button", "ag-combo");
      button.type = "button";
      const big = element("span", "ag-combo-heading");
      big.textContent = labels.newText.heading;
      big.style.fontFamily = `"${pair.heading}", ${family}`;
      big.style.fontWeight = String(pair.headingWeight);
      if (pair.uppercase) big.style.textTransform = "uppercase";
      const small = element("span", "ag-combo-body");
      small.textContent = labels.newText.subheading;
      small.style.fontFamily = `"${pair.body}", ${family}`;
      button.append(big, small);
      button.setAttribute("aria-label", `${labels.fontCombos}: ${fontList.find((font) => font.family === pair.heading)?.name ?? pair.heading}, ${fontList.find((font) => font.family === pair.body)?.name ?? pair.body}`);
      button.addEventListener("click", () => addCombo(pair));
      // The pair's own fonts, so the button shows what it adds.
      void loadFont(pair.heading, labels.newText.heading);
      void loadFont(pair.body, labels.newText.subheading);
      return button;
    }));
    comboGrid.previousElementSibling?.toggleAttribute("hidden", !usable.length);
    comboGrid.hidden = !usable.length;
  }

  /** One of the clip's own parts, where the classic card has it, or a little off it when one is there already. */
  function addElement(kind: LayerKind, look?: Visual) {
    if (kind === "captions") {
      const shown = showCaptions(layersFor(layout));
      if (shown) {
        setLayers(shown, true);
        stage.select(shown[shown.length - 1].id);
        return;
      }
    }
    const classic = defaultLayers(layout).find((layer) => layer.kind === kind);
    if (!classic) return;
    const taken = layersFor(layout).some((layer) => layer.kind === kind && Math.abs(layer.x - classic.x) < 0.01 && Math.abs(layer.y - classic.y) < 0.01);
    addLayer({ ...(taken ? moveLayer(classic, 0.03, 0.03) : classic), id: layerId(kind), ...(look ? { visual: look } : {}) });
  }

  // Captions arriving on a page with no place for them get one, once; after that where they go is the user's call.
  let captionsPlaced = false;
  let built = false;
  function placeCaptions() {
    if (!built || captionsPlaced || !cues.length) return;
    captionsPlaced = true;
    let added = false;
    for (const shape of LAYOUTS) {
      const list = layersFor(shape);
      if (list.some((layer) => layer.kind === "captions")) continue;
      designs = { ...designs, [shape]: [...list, { ...defaultLayers(shape).find((layer) => layer.kind === "captions")!, id: layerId("captions") }] };
      added = true;
    }
    if (added) {
      record();
      changed();
    }
  }

  function applyTemplate(id: TemplateId) {
    const chosen = templateOf(id, layout);
    page = chosen.page;
    if (chosen.theme !== undefined) theme = THEMES[chosen.theme];
    markTheme();
    renderPageSwatches();
    stage.select(null);
    setLayers(chosen.layers, true);
  }

  function markTheme() {
    if (built && tab === "elements") renderElements();
    const index = String(THEMES.indexOf(theme));
    for (const button of themeTiles.querySelectorAll<HTMLButtonElement>("[data-value]")) {
      const on = button.dataset.value === index;
      button.setAttribute("aria-checked", String(on));
      button.tabIndex = on ? 0 : -1;
    }
  }

  /** A page colour picked: shown at once, and kept as a step to undo unless a shade is still being dragged. */
  function setPage(next: Page | null, done = true) {
    page = next;
    rebuild();
    if (!done) return;
    record();
    changed();
    markPicked(pageSwatches, page);
  }

  /** Every colour the design on the page uses, for the pickers' first row. */
  const usedColours = () => documentColours([
    page?.color,
    page?.to,
    ...layersFor(layout).flatMap((layer) => [layer.color, layer.fill, layer.stroke, layer.highlight, layer.outline, layer.background, layer.effectColor]),
  ]);

  /** The page's colour picker. It is drawn again when something else changes the page, such as a theme, a template or
   *  an undo, and left alone while it is used, so a shade can be dragged on it. */
  function renderPageSwatches() {
    const focused = pageSwatches.contains(document.activeElement) ? (document.activeElement as HTMLElement).getAttribute("aria-label") : null;
    pageSwatches.replaceChildren(colourPanel({
      current: page,
      theme,
      used: usedColours(),
      page: true,
      labels: labels.stage.colourPicker ?? COLOUR_LABELS,
      onPick: (choice: ColourChoice, done) => setPage(choice === null || typeof choice === "object" ? choice : { color: choice }, done),
    }));
    if (focused) [...pageSwatches.querySelectorAll<HTMLElement>("[aria-label]")].find((node) => node.getAttribute("aria-label") === focused)?.focus();
  }

  /** A picture or a video from the uploads, half the page's size, in the middle. */
  function addPicture(key: string) {
    const picture = pictures.get(key);
    const media = picture?.image ?? picture?.video;
    if (!media) return;
    const natural = media instanceof HTMLVideoElement ? { width: media.videoWidth, height: media.videoHeight } : { width: media.naturalWidth, height: media.naturalHeight };
    if (!natural.width || !natural.height) return;
    const { width, height } = SIZES[layout];
    const scale = Math.min((width * 0.5) / natural.width, (height * 0.5) / natural.height);
    const w = (natural.width * scale) / width;
    const h = (natural.height * scale) / height;
    const kind = picture?.video ? "video" : "image";
    // A picked empty frame takes the picture instead of a new layer.
    const frame = stage.selected;
    if (frame && (frame.kind === "image" || frame.kind === "video") && !frame.image) {
      setLayers(layersFor(layout).map((layer) => (layer.id === frame.id ? { ...layer, kind, image: key, crop: undefined } : layer)), true);
      stage.refresh();
      if (kind === "video") syncVideos(clipTime(), !audio.paused);
      return;
    }
    addLayer({ id: layerId(kind), kind, image: key, x: 0.5 - w / 2, y: 0.5 - h / 2, w, h, rotation: 0, opacity: 1 });
    if (kind === "video") syncVideos(clipTime(), !audio.paused);
  }

  async function keepPicture(source: Blob | string, key: string, listed: boolean) {
    if (isVideo(source)) {
      const video = await loadVideo(source);
      // A still picture shows the video's frame at the playhead once it has been found.
      video.addEventListener("seeked", () => {
        if (audio.paused && !exporting) paint();
      });
      pictures.set(key, { source, image: null, video, url: video.src.startsWith("blob:") ? video.src : null, listed });
      return;
    }
    const image = await loadImage(source);
    const animation = typeof source === "string" ? null : await decodeAnimation(source);
    pictures.set(key, { source, image, video: null, url: image.src.startsWith("blob:") ? image.src : null, listed, animation });
  }

  /** The videos on the page now, each once. */
  function videosShown(): HTMLVideoElement[] {
    const keys = new Set(layersFor(layout).filter((layer) => (layer.kind === "video" || layer.kind === "mockup") && !layer.hidden).map((layer) => layer.image ?? ""));
    return [...keys].map((key) => pictures.get(key)?.video).filter((video): video is HTMLVideoElement => Boolean(video));
  }

  /** Videos follow the clip, looping: playing along while it plays, held on the frame at the playhead while it doesn't. */
  function syncVideos(time: number, playing: boolean) {
    const shown = videosShown();
    // Videos taken off the page, or left playing by an export, rest.
    for (const picture of pictures.values()) if (picture.video && !shown.includes(picture.video) && !picture.video.paused) picture.video.pause();
    for (const video of shown) {
      const at = video.duration ? time % video.duration : 0;
      if (playing) {
        if (video.paused) {
          video.currentTime = at;
          void video.play().catch(() => {});
        } else if (Math.abs(video.currentTime - at) > 0.3) video.currentTime = at;
      } else {
        if (!video.paused) video.pause();
        if (Math.abs(video.currentTime - at) > 0.02) video.currentTime = at;
      }
    }
  }

  /** Each video put on the frame at `time` before it is painted, for the export. */
  async function videosAt(time: number, live: boolean) {
    if (live) return syncVideos(time, true);
    await Promise.all(videosShown().map((video) => {
      if (!video.paused) video.pause();
      const at = video.duration ? time % video.duration : 0;
      if (Math.abs(video.currentTime - at) < 1e-3) return undefined;
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        video.addEventListener("seeked", done, { once: true });
        // A frame that never arrives shouldn't stall the export.
        setTimeout(done, 1500);
        video.currentTime = at;
      });
    }));
  }

  function renderUploads() {
    uploadGrid.replaceChildren(...[...pictures].filter(([, picture]) => picture.listed && (picture.image || picture.video)).map(([key, picture]) => {
      const item = element("div", "ag-upload-item");
      const add = element("button", "ag-upload-add");
      add.type = "button";
      add.setAttribute("aria-label", labels.addPicture(picture.source instanceof File ? picture.source.name : key));
      if (picture.video) {
        const thumb = element("video", "");
        thumb.muted = true;
        thumb.playsInline = true;
        thumb.preload = "metadata";
        thumb.src = picture.video.src;
        add.append(thumb, icon(ICONS.video));
        add.classList.add("ag-upload-video");
      } else {
        const thumb = element("img", "");
        thumb.alt = "";
        thumb.src = picture.image!.src;
        add.append(thumb);
      }
      add.addEventListener("click", () => addPicture(key));
      const forget = iconButton("ag-upload-forget", labels.forgetPicture, ICONS.remove);
      forget.addEventListener("click", () => {
        picture.listed = false;
        renderUploads();
        changed();
      });
      item.append(add, forget);
      return item;
    }));
  }

  /** Registers a font's files once and loads the ones `sample` needs; the picture is drawn again when they arrive. */
  async function loadFont(name: string, sample = "Ab") {
    const font = fontList.find((item) => item.family === name);
    if (!font) return;
    if (!fontsAdded.has(name)) {
      fontsAdded.add(name);
      for (const file of font.files) document.fonts.add(new FontFace(name, `url("${file.url}") format("woff2")`, { weight: file.weight, unicodeRange: file.unicodeRange }));
    }
    await Promise.all([400, 700].map((weight) => document.fonts.load(`${weight} 40px "${name}"`, sample || "Ab").catch(() => [])));
  }
  /** Every font the layers use, loaded, so the picture and the export never fall back. */
  async function loadUsedFonts() {
    const used = new Map<string, string>();
    for (const shape of LAYOUTS) for (const layer of layersFor(shape)) if (layer.font && !layer.hidden) used.set(layer.font, `${used.get(layer.font) ?? ""} ${painter.textOf(layer, 0)} ${layer.kind === "captions" ? cues.map((cue) => cue.text).join(" ").slice(0, 2000) : ""}`);
    await Promise.all([...used].map(([name, sample]) => loadFont(name, sample)));
  }

  // A minute of the clip's sound at 48 kHz around the playhead: ten seconds behind it for the wave, the rest ahead.
  const WINDOW_BEHIND = 10;
  const WINDOW_AHEAD = 50;

  /** Reads the window of sound around `time` seconds into the clip, unless the one at hand still has room around it. */
  function loadWindow(time: number) {
    if (!recordings.length) return;
    const key = clipKey();
    const length = clipLength();
    const shown = clipWindow?.key === key ? clipWindow : null;
    // Five seconds behind for the wave; fifteen ahead, so the next window is read while this one still plays.
    const roomBehind = !shown || shown.from <= 0 || time - 5 >= shown.from;
    const roomAhead = !shown || shown.to >= length || time + 15 <= shown.to;
    if (shown && roomBehind && roomAhead) return;
    if (windowPending?.key === key && Math.abs(windowPending.from - Math.max(0, time - WINDOW_BEHIND)) < 20) return;
    const from = Math.max(0, time - WINDOW_BEHIND);
    const to = from + WINDOW_BEHIND + WINDOW_AHEAD;
    windowPending = { key, from };
    clipReader()(from, to).then((samples) => {
      if (windowPending?.key === key && windowPending.from === from) windowPending = null;
      if (key !== clipKey()) return;
      clipWindow = { key, from, to, samples };
      // The painter keeps its meter: swapping the sound under it mid-play shouldn't make the bars jump.
      painter.scene = { ...painter.scene, audio: sceneAudio() };
      if (audio.paused) paint();
    }, () => {
      if (windowPending?.key === key && windowPending.from === from) windowPending = null;
    });
  }
  let clipTimer = 0;
  function scheduleClip() {
    clearTimeout(clipTimer);
    if (recordings.length) clipTimer = window.setTimeout(() => loadWindow(clipTime()), 150);
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

  /**
   * The outline under `bars` bars across `[from, to]` of the timeline, as min, max pairs, each recording's in its own
   * stretch, and whether each bar's sound has been read yet.
   */
  function reelBars([from, to]: View, bars: number): { data: Float32Array; read: boolean[] } {
    const data = new Float32Array(bars * 2);
    const read = new Array<boolean>(bars).fill(false);
    const step = (to - from) / bars;
    for (const { source, offset } of recordings) {
      // The bars whose middles fall in this recording.
      const first = Math.max(0, Math.ceil((offset - from) / step - 0.5));
      const last = Math.min(bars, Math.ceil((offset + source.duration - from) / step - 0.5));
      if (last <= first) continue;
      data.set(outlineBars(source.outline, OUTLINE_RATE, [from + first * step - offset, from + last * step - offset], last - first), first * 2);
      for (let i = first; i < last; i++) read[i] = from + (i + 0.5) * step - offset <= source.outlined;
    }
    return { data, read };
  }

  /** A thin line down the canvas where one recording ends and the next begins, for each join inside `[from, to]`. */
  function drawJoins(g: CanvasRenderingContext2D, [from, to]: View, width: number, height: number, ratio: number, colour: string) {
    g.fillStyle = colour;
    for (const { offset } of recordings.slice(1)) {
      if (offset > from && offset < to) g.fillRect(Math.round(((offset - from) / (to - from)) * width), 0, Math.max(1, Math.round(ratio)), height);
    }
  }

  function drawWave() {
    const { width, height, ratio } = sizeCanvas(wave, track);
    const g = wave.getContext("2d")!;
    g.clearRect(0, 0, width, height);
    if (!recordings.length) return;
    const bars = Math.max(1, Math.floor(width / (3 * ratio)));
    const { data, read } = reelBars(view, bars);
    const style = getComputedStyle(root);
    const inside = style.getPropertyValue("--ag-wave-in").trim() || "#121212";
    const outside = style.getPropertyValue("--ag-wave").trim() || "#999";
    const mid = height / 2;
    for (let i = 0; i < bars; i++) {
      const time = view[0] + ((i + 0.5) / bars) * (view[1] - view[0]);
      const lit = (time >= range[0] && time <= range[1]) || parts.some(([start, end]) => time >= start && time <= end);
      g.fillStyle = lit ? inside : outside;
      // Not read yet: a faint flat line where the sound will show.
      g.globalAlpha = read[i] ? 1 : 0.4;
      const amplitude = Math.max(1 * ratio, (data[i * 2 + 1] - data[i * 2]) * mid * 0.92);
      g.fillRect(i * 3 * ratio, mid - amplitude / 2, 2 * ratio, amplitude);
    }
    g.globalAlpha = 1;
    drawJoins(g, view, width, height, ratio, style.getPropertyValue("--ag-edge").trim() || outside);
  }

  // The overview, shown while zoomed in: the whole timeline, where the view is, and where the clip is.
  function drawMap() {
    const whole = !recordings.length || view[1] - view[0] >= duration() - 1e-6;
    map.hidden = whole;
    if (whole) return;
    const { width, height, ratio } = sizeCanvas(mapCanvas, map);
    const g = mapCanvas.getContext("2d")!;
    g.clearRect(0, 0, width, height);
    const bars = Math.max(1, Math.floor(width / (2 * ratio)));
    const { data } = reelBars([0, duration()], bars);
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
    drawJoins(g, [0, duration()], width, height, ratio, style.getPropertyValue("--ag-edge").trim() || outside);
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
    playheadLine.hidden = !recordings.length || !inView(playhead);
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
    const outlined = recordings.reduce((sum, { source }) => sum + source.outlined, 0);
    reading.textContent = recordings.length && outlined < duration() - 1e-6 ? labels.reading(clock(outlined), clock(duration())) : "";
    // The zoom keys show for recordings long enough to need them, and rest at their limits.
    const span = view[1] - view[0];
    zoomKeys.hidden = !recordings.length || duration() <= ZOOMABLE;
    zoomInButton.disabled = span <= Math.min(10, duration()) + 1e-6;
    zoomOutButton.disabled = wholeButton.disabled = span >= duration() - 1e-6;
    // The clip is made once the recording being added is in it.
    exportButton.disabled = !recordings.length || adding;
    openButton.disabled = exporting;
    // Another recording can come in while the clip has room for some of it.
    const full = !hasRoom();
    addRecordingButton.disabled = !recordings.length || exporting || adding || root.dataset.state === "loading" || full;
    addRecordingButton.title = recordings.length && full ? labels.partsFull : labels.addRecordingHint;
    splitButton.disabled = !splittable();
  }

  function hasRoom() {
    return maxLength - clipLength() >= MIN_LENGTH - 1e-6;
  }

  /** Whether the part being edited can be cut at the playhead, leaving both halves long enough to keep. */
  /** The part the playhead could cut in two, by its place in the parts; -1 for the selection alone, null for none. */
  function splitPart(): number | null {
    const inside = ([start, end]: readonly [number, number]) => playhead >= start + MIN_LENGTH - 1e-6 && playhead <= end - MIN_LENGTH + 1e-6;
    if (!parts.length) return inside(range) ? -1 : null;
    const index = parts.findIndex(inside);
    return index < 0 ? null : index;
  }
  function splittable() {
    return Boolean(recordings.length) && !exporting && splitPart() !== null;
  }

  /**
   * Selects `[start, end]` inside recording `home`, the one the selection is in unless told otherwise. While the clip
   * has parts, the selection is the part being edited, and changes with it.
   */
  function setRange(start: number, end: number, which?: "start" | "end", reveal = true, home = recordingOf(range)) {
    if (exporting) return;
    const [lo, hi] = recordings.length ? boundsOf(home) : [0, Math.max(start, end)];
    start = Math.max(lo, Math.min(start, hi - MIN_LENGTH));
    end = Math.min(hi, Math.max(end, start + MIN_LENGTH));
    // The longest clip allowed, counting the other parts: the edge being dragged pushes the other along rather than
    // going past it.
    const longest = Math.max(MIN_LENGTH, maxLength - (parts.length ? partsLength(parts) - (parts[active][1] - parts[active][0]) : 0));
    if (end - start > longest) {
      if (which === "start") end = start + longest;
      else start = end - longest;
    }
    range = [start, end];
    if (parts.length) {
      const moved = parts[active][0] !== start || parts[active][1] !== end;
      parts[active] = [start, end];
      renderParts();
      if (moved) options.onParts?.(parts.map(([from, to]) => [from, to]));
    }
    if (playhead < start || playhead > end) playhead = start;
    if (reveal && recordings.length) view = showSpan(view, duration(), range);
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

  /** Plays on from `time` with the player of recording `index`, pausing the one before it. */
  function switchTo(index: number, time: number) {
    const next = recordings[index];
    if (next.player !== audio) audio.pause();
    audio = next.player;
    current = index;
    audio.currentTime = Math.max(0, time - next.offset);
    if (animating && audio.paused) void audio.play();
  }

  function tick() {
    frame = 0;
    // A player stops by itself at the end of its recording; the clip carries on into its next part.
    if (audio.paused && !audio.ended) return;
    const list = spans();
    playing = Math.min(playing, list.length - 1);
    playhead = audio.ended ? Math.max(reelTime(), list[playing][1]) : reelTime();
    if (playhead >= list[playing][1]) {
      const end = list[playing][1];
      playing++;
      if (playing >= list.length) {
        stop();
        playhead = list[0][0];
        painter.reset();
        syncVideos(clipTime(), false);
        paint();
        placeTimeline();
        return;
      }
      playhead = list[playing][0];
      // The second half of a split carries straight on from the first, so it plays on without a seek.
      const next = recordingOf(list[playing]);
      if (next !== current || playhead !== end) switchTo(next, playhead);
    }
    paint();
    placeTimeline();
    // The captions list keeps the one being said on show.
    const said = cueAt(cues, playhead);
    if (said !== shownCue) {
      shownCue = said;
      renderCues();
    }
    frame = requestAnimationFrame(tick);
  }

  function play() {
    if (!recordings.length || exporting) return;
    stopRehearsal();
    const list = spans();
    playing = list.findIndex(([start, end]) => playhead >= start && playhead < end - 0.05);
    if (playing < 0) {
      playing = 0;
      playhead = list[0][0];
    }
    loadWindow(clipTime());
    switchTo(recordingOf(list[playing]), playhead);
    painter.reset();
    void audio.play();
    animating = true;
    painter.animate = true;
    syncVideos(clipTime(), true);
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
    for (const { player } of recordings) player.pause();
    musicAudio.pause();
    cancelAnimationFrame(frame);
    if (animating) {
      animating = false;
      painter.animate = false;
      syncVideos(clipTime(), false);
      paint();
    }
    playButton.replaceChildren(icon(ICONS.play));
    playButton.setAttribute("aria-label", labels.play);
    playButton.title = labels.play;
    if (tapping) setTapping(false);
  }

  function seek(time: number) {
    playhead = intoClip(Math.max(0, Math.min(duration(), time)));
    if (animating && recordings.length) {
      // Playback goes on from the part the playhead is in now, with its recording's player.
      const list = spans();
      playing = Math.max(0, list.findIndex(([start, end]) => playhead >= start && playhead <= end));
      switchTo(recordingOf(list[playing]), playhead);
      if (music) musicAudio.currentTime = clipTime() % music.duration;
    }
    painter.reset();
    syncVideos(clipTime(), !audio.paused);
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
    stage.refresh();
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
    cues = markStart(cues, tapIndex, reelTime());
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

  let importShown = -1;
  function importProgress(fraction: number) {
    const percent = Math.min(100, Math.floor(fraction * 100));
    if (percent === importShown) return;
    importShown = percent;
    importPercent.textContent = `${percent}%`;
    importCard.style.setProperty("--progress", String(Math.min(1, fraction)));
    importCard.setAttribute("aria-valuenow", String(percent));
    if (percent >= 100) importCard.dataset.done = "";
    else delete importCard.dataset.done;
  }

  /** What a recording is called on its chip: its file's name, or its place on the timeline when it has none. */
  function nameOf(from: string | Blob, index: number): string {
    let name = from instanceof File ? from.name : "";
    if (typeof from === "string" && !/^(data|blob):/i.test(from)) {
      try {
        name = decodeURIComponent(from.split(/[?#]/)[0].split("/").pop() ?? "");
      } catch {
        // An address with a broken escape in it goes by its place instead.
      }
    }
    return name || labels.recording(index);
  }

  const recordingList = () => recordings.map(({ input, name, offset, source }) => ({ source: input, name, start: offset, end: offset + source.duration }));

  let opening = 0;
  async function load(from: string | Blob) {
    if (exporting) return;
    const mine = ++opening;
    stop();
    // Opening a recording takes over from one still being added.
    adding = false;
    root.dataset.state = "loading";
    announce(labels.loading);
    importName.textContent = labels.importing;
    importProgress(0);
    placeTimeline();
    let next: AudioSource;
    try {
      next = await openSource(from, { onOutline: outlineChanged, onProgress: (fraction) => mine === opening && importProgress(fraction) });
    } catch (error) {
      if (mine !== opening) return;
      importProgress(1);
      root.dataset.state = recordings.length ? "ready" : "empty";
      placeTimeline();
      tell(labels.openFailed);
      throw error;
    }
    // A recording picked after this one has taken its place.
    if (mine !== opening) return next.close();
    // The clip starts afresh: every recording on it goes, with its parts.
    for (const recording of recordings) closeRecording(recording);
    recordings = [{ source: next, input: from, name: nameOf(from, 1), offset: 0, player: playerOf(next.url) }];
    audio = recordings[0].player;
    current = 0;
    generation++;
    clipWindow = null;
    windowPending = null;
    active = 0;
    if (parts.length) {
      parts = [];
      renderParts();
      options.onParts?.([]);
    }
    root.dataset.state = "ready";
    live.textContent = "";
    const keep = firstLoad && range[1] > range[0] && range[1] <= next.duration;
    firstLoad = false;
    // The whole recording, to play from end to end and trim from either side; a clip can be as long as it is.
    const [start, end] = keep ? range : [0, maxLength < next.duration ? maxLength : next.duration];
    view = initialView(next.duration, [start, end]);
    playhead = start;
    setRange(start, end, undefined, true, 0);
  }

  /**
   * Adds a recording after the ones on the timeline. The clip so far stays as it is, as its first part when it had
   * none, and the new recording comes in after it as a part of its own, ready to trim.
   */
  async function append(from: string | Blob) {
    if (!recordings.length || exporting || adding || root.dataset.state === "loading") return;
    if (!hasRoom()) return tell(labels.partsFull);
    // An Open audio after this wins, as it does over an earlier one.
    const mine = ++opening;
    stop();
    adding = true;
    const name = nameOf(from, recordings.length + 1);
    announce(labels.adding(name));
    importName.textContent = labels.adding(name);
    importProgress(0);
    placeTimeline();
    let next: AudioSource;
    try {
      next = await openSource(from, { onOutline: outlineChanged, onProgress: (fraction) => mine === opening && importProgress(fraction) });
    } catch (error) {
      if (mine !== opening) return;
      adding = false;
      importProgress(1);
      placeTimeline();
      tell(labels.addFailed);
      throw error;
    }
    if (mine !== opening) return next.close();
    adding = false;
    stop();
    if (!parts.length) {
      parts = [[range[0], range[1]]];
      active = 0;
    }
    const room = maxLength - clipLength();
    const offset = duration();
    recordings.push({ source: next, input: from, name, offset, player: playerOf(next.url) });
    const span: [number, number] = [offset, offset + Math.min(next.duration, room)];
    parts.push(span);
    active = parts.length - 1;
    range = [...span];
    playhead = span[0];
    view = initialView(duration(), span);
    partsChanged();
    announce(labels.added(name, parts.length));
    options.onRecordings?.(recordingList());
  }

  // Exporting.

  async function exportVideo(choice: { fps?: number; scale?: number } = {}): Promise<ExportResult | null> {
    if (!recordings.length || exporting || adding) return null;
    stop();
    exporting = true;
    root.dataset.state = "exporting";
    exportButton.setAttribute("aria-disabled", "true");
    stage.refresh();
    placeTimeline();
    try {
      await loadUsedFonts();
      const result = await exportClip(scene(), {
        prepare: videosAt,
        fps: choice.fps,
        scale: choice.scale,
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
      // The export left the videos on its last frame, or playing; they go back to the playhead.
      syncVideos(clipTime(), false);
      root.dataset.state = "ready";
      exportButton.removeAttribute("aria-disabled");
      stage.refresh();
      placeTimeline();
      rename(exportButton, labels.export);
      exportButton.removeAttribute("aria-label");
      meter.style.removeProperty("--progress");
    }
  }

  // Parts: the selection edits one at a time, and each chip picks its part for it, removes it, or drags to a new
  // place. Split cuts the part being edited in two at the playhead; Add recording brings another file in after them.

  function partsChanged() {
    if (exporting) return;
    renderParts();
    drawWave();
    drawMap();
    // Playback carries on from where it is, in whichever part that is now; a still playhead stays inside the clip.
    if (animating) seek(playhead);
    else playhead = intoClip(playhead);
    placeTimeline();
    rebuild();
    scheduleClip();
    options.onParts?.(parts.map(([start, end]) => [start, end]));
  }

  /** Makes part `index` the one the selection edits. */
  function pickPart(index: number, reveal = true) {
    active = index;
    setRange(parts[index][0], parts[index][1], undefined, reveal, recordingOf(parts[index]));
  }

  /** A part as its chip shows it: with several recordings, which one it comes from and its times in that one. */
  function partName(index: number) {
    const [start, end] = parts[index];
    const recording = recordings.length > 1 ? recordings[recordingOf(parts[index])] : null;
    const shift = recording?.offset ?? 0;
    return { name: recording?.name ?? "", from: formatTime(start - shift), to: formatTime(end - shift) };
  }

  function renderParts() {
    // Drawing the chips again keeps the keyboard on the chip it was on.
    const focused = partList.contains(document.activeElement) ? (document.activeElement as HTMLElement).closest<HTMLElement>(".ag-part")?.dataset.index : undefined;
    // One part is just the clip, so the chips show once there are two to order.
    partList.hidden = parts.length < 2;
    partList.replaceChildren(...parts.map((_, index) => {
      const { name, from, to } = partName(index);
      const item = element("li", "ag-part");
      item.dataset.index = String(index);
      const pick = element("button", "ag-part-pick");
      pick.type = "button";
      if (name) {
        const named = element("span", "ag-part-name");
        named.textContent = name;
        named.title = name;
        pick.append(`${index + 1} · `, named, ` · ${from}–${to}`);
      } else pick.textContent = `${index + 1} · ${from}–${to}`;
      pick.setAttribute("aria-label", labels.part(index + 1, name, from, to));
      if (index === active) {
        item.dataset.active = "";
        pick.setAttribute("aria-current", "true");
      }
      pick.addEventListener("click", () => {
        if (reordered || exporting) return;
        pickPart(index);
        seek(parts[index][0]);
      });
      const remove = iconButton("ag-part-remove", labels.removePart(index + 1), ICONS.remove);
      remove.addEventListener("click", () => {
        if (exporting) return;
        parts.splice(index, 1);
        // The part after the removed one is edited next, or the one before it when it was the last.
        if (index < active || active >= parts.length) active = Math.max(0, active - 1);
        if (parts.length) range = [...parts[active]];
        partsChanged();
      });
      item.append(pick, remove);
      return item;
    }));
    if (focused !== undefined && !reordered) partList.querySelector<HTMLElement>(`[data-index="${focused}"] .ag-part-pick`)?.focus();
  }

  splitButton.addEventListener("click", () => {
    if (!splittable()) return;
    if (!parts.length) {
      parts = [[range[0], range[1]]];
      active = 0;
    } else active = splitPart() ?? active;
    // Both halves end and start on the very same time, so the clip plays straight through the cut until one is trimmed.
    const [start, end] = parts[active];
    const at = playhead;
    parts.splice(active, 1, [start, at], [at, end]);
    active++;
    range = [at, end];
    partsChanged();
    const { name, from, to } = partName(active);
    announce(labels.part(active + 1, name, from, to));
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
    // The part being edited stays the same part wherever it moves to.
    if (active === reorder.index) active = over;
    else if (reorder.index < active && over >= active) active--;
    else if (reorder.index > active && over <= active) active++;
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

  let drag: { kind: "start" | "end" | "move" | "new"; pointerId: number; from: number; x: number; range: [number, number]; home: number } | null = null;
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
    if (!recordings.length || exporting || event.button !== 0) return;
    const target = event.target as Element;
    const time = timeAt(event.clientX);
    const edge = target === startHandle || target === endHandle;
    // A press on another part picks it, as its chip does, and drags it along.
    const other = edge || (time > range[0] && time < range[1]) ? -1 : parts.findIndex(([start, end]) => time > start && time < end);
    if (other >= 0) pickPart(other, false);
    const kind = target === startHandle ? "start" : target === endHandle ? "end" : time > range[0] && time < range[1] ? "move" : "new";
    // A new stretch drawn on another recording redraws that recording's nearest part, when it has one.
    const pressed = recordingAt(time);
    if (kind === "new" && parts.length && pressed !== recordingOf(range)) {
      const gap = ([start, end]: [number, number]) => (time < start ? start - time : time > end ? time - end : 0);
      const nearest = parts.reduce((best, part, index) => (recordingOf(part) === pressed && (best < 0 || gap(part) < gap(parts[best])) ? index : best), -1);
      if (nearest >= 0) pickPart(nearest, false);
    }
    // A new stretch is drawn in the recording it starts in; an edge or a move keeps to the selection's own.
    const home = kind === "new" ? pressed : recordingOf(range);
    drag = { kind, pointerId: event.pointerId, from: time, x: event.clientX, range: [...range], home };
    capture(track, event.pointerId);
    event.preventDefault();
  });
  track.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const delta = timeAt(event.clientX) - drag.from;
    const [start, end] = drag.range;
    if (drag.kind === "start") setRange(start + delta, end, "start", false, drag.home);
    else if (drag.kind === "end") setRange(start, end + delta, "end", false, drag.home);
    else if (drag.kind === "new") {
      // A press that doesn't travel leaves the selection as it was.
      if (Math.abs(event.clientX - drag.x) < 4) return;
      const at = timeAt(event.clientX);
      setRange(Math.min(drag.from, at), Math.max(drag.from, at), at < drag.from ? "start" : "end", false, drag.home);
    } else {
      const [lo, hi] = boundsOf(drag.home);
      const shift = Math.max(lo - start, Math.min(hi - end, delta));
      setRange(start + shift, end + shift, undefined, false, drag.home);
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
    if (!recordings.length || event.button !== 0) return;
    scrubbing = { pointerId: event.pointerId, resume: animating && !tapping };
    if (animating) stop();
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
    if (!recordings.length) return;
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
    if (!recordings.length || event.button !== 0) return;
    mapping = event.pointerId;
    capture(map, event.pointerId);
    lookAt(event.clientX);
  });
  map.addEventListener("pointermove", (event) => mapping === event.pointerId && lookAt(event.clientX));
  map.addEventListener("pointerup", () => (mapping = null));
  map.addEventListener("pointercancel", () => (mapping = null));

  // Buttons and keys.

  playButton.addEventListener("click", () => (animating ? stop() : play()));
  function renderDownload() {
    const group = (name: string, choices: Array<[string, boolean, () => void]>) => {
      const box = element("div", "ag-field");
      const title = element("span", "ag-field-name");
      title.textContent = name;
      const row = element("div", "ag-chips");
      row.setAttribute("role", "radiogroup");
      row.setAttribute("aria-label", name);
      for (const [text, on, pick] of choices) {
        const chip = element("button", "ag-key ag-chip");
        chip.type = "button";
        chip.setAttribute("role", "radio");
        chip.setAttribute("aria-checked", String(on));
        chip.textContent = text;
        chip.addEventListener("click", () => {
          pick();
          renderDownload();
          download.querySelector<HTMLElement>(`[aria-label="${name}"] [aria-checked=true]`)?.focus();
        });
        row.append(chip);
      }
      box.append(title, row);
      return box;
    };
    const parts: HTMLElement[] = [group(labels.fileType, [
      [labels.videoFile, downloadChoice.kind === "video", () => (downloadChoice = { ...downloadChoice, kind: "video" })],
      [labels.pictureFile, downloadChoice.kind === "picture", () => (downloadChoice = { ...downloadChoice, kind: "picture" })],
    ])];
    const { width, height } = SIZES[layout];
    const short = Math.min(width, height);
    parts.push(group(labels.quality, [[`${Math.round(short * (2 / 3))}p`, downloadChoice.scale < 1, () => (downloadChoice = { ...downloadChoice, scale: 2 / 3 })], [`${short}p`, downloadChoice.scale === 1, () => (downloadChoice = { ...downloadChoice, scale: 1 })]]));
    if (downloadChoice.kind === "video") parts.push(group(labels.frameRate, [24, 30, 60].map((fps) => [String(fps), downloadChoice.fps === fps, () => (downloadChoice = { ...downloadChoice, fps })])));
    const go = keyButton("ag-download-go", labels.downloadNow, ICONS.export);
    go.addEventListener("click", () => {
      closeDownload();
      exportButton.focus();
      if (downloadChoice.kind === "picture") void downloadFrame(downloadChoice.scale).catch(() => tell(labels.failed));
      else void exportVideo({ fps: downloadChoice.fps, scale: downloadChoice.scale }).catch(() => {});
    });
    download.replaceChildren(...parts, go);
  }
  function closeDownload() {
    download.hidden = true;
    exportButton.setAttribute("aria-expanded", "false");
  }
  exportButton.addEventListener("click", () => {
    if (exporting || adding || !recordings.length) return;
    if (!download.hidden) return closeDownload();
    renderDownload();
    download.hidden = false;
    exportButton.setAttribute("aria-expanded", "true");
    download.querySelector<HTMLElement>("[aria-checked=true]")?.focus();
  });
  download.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeDownload();
    exportButton.focus();
  });
  function closeStartOver(refocus: boolean) {
    startOverPanel.hidden = true;
    startOverButton.setAttribute("aria-expanded", "false");
    if (refocus) startOverButton.focus();
  }
  startOverButton.addEventListener("click", () => {
    if (!startOverPanel.hidden) return closeStartOver(false);
    closeDownload();
    startOverPanel.hidden = false;
    startOverButton.setAttribute("aria-expanded", "true");
    cancelStart.focus();
  });
  cancelStart.addEventListener("click", () => closeStartOver(true));
  confirmStart.addEventListener("click", () => startOver());
  startOverPanel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeStartOver(true);
  });

  /** The design cleared back to how the editor opens: no layers, the opening page and theme, and none of the frame's
   *  own words. The recording, captions, music, profile picture, links and uploads stay, and Undo brings it back. */
  function startOver() {
    closeStartOver(false);
    stage.select(null);
    cancelAnimationFrame(rehearsalFrame);
    rehearsal = null;
    designs = options.blank ? Object.fromEntries(LAYOUTS.map((shape) => [shape, []])) : {};
    page = options.blank ? { color: "#ffffff" } : null;
    theme = THEMES[options.blank ? 1 : 0];
    title = speaker = handle = "";
    titleField.querySelector("input")!.value = "";
    speakerField.querySelector("input")!.value = "";
    handleField.querySelector("input")!.value = "";
    captionsPlaced = false;
    markTheme();
    renderPageSwatches();
    applyZoom(null);
    rebuild();
    placeCaptions();
    record();
    changed();
    tell(labels.startedOver, { label: labels.undo, run: () => travel(-1) });
    startOverButton.focus();
  }
  const gone = new AbortController();
  document.addEventListener("pointerdown", (event) => {
    if (!download.hidden && !download.contains(event.target as Node) && !exportButton.contains(event.target as Node)) closeDownload();
    if (!startOverPanel.hidden && !startOverPanel.contains(event.target as Node) && !startOverButton.contains(event.target as Node)) closeStartOver(false);
  }, { signal: gone.signal });

  /** The picture at the playhead as a PNG, the way the video shows it at that moment. */
  async function downloadFrame(scale: number) {
    await loadUsedFonts();
    const time = clipTime();
    await videosAt(time, false);
    const { width, height } = SIZES[layout];
    const canvas = element("canvas", "");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    new Painter(scene()).paint(canvas.getContext("2d", { alpha: false })!, time);
    syncVideos(time, false);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The picture could not be made");
    const result: ExportResult = { blob, type: "image/png", extension: "png" };
    if (options.onExport) options.onExport(result);
    else {
      const link = element("a", "");
      link.href = URL.createObjectURL(blob);
      link.download = "clip.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    }
  }
  openButton.addEventListener("click", () => audioInput.click());
  audioInput.addEventListener("change", () => {
    const file = audioInput.files?.[0];
    if (file) void load(file).catch(() => {});
    audioInput.value = "";
  });
  addRecordingButton.addEventListener("click", () => recordingInput.click());
  recordingInput.addEventListener("change", () => {
    const file = recordingInput.files?.[0];
    if (file) void append(file).catch(() => {});
    recordingInput.value = "";
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
  /**
   * Captions read from a file are timed from the start of their recording, the one the selection is in: they move to
   * where it starts on the timeline and take the place of its captions, leaving the other recordings' alone.
   */
  function importCaptions(text: string) {
    const read = parseSubtitles(text);
    if (!recordings.length) cues = read;
    else {
      const home = recordingOf(range);
      const [lo, end] = boundsOf(home);
      const hi = home < recordings.length - 1 ? end : Infinity;
      const kept = cues.filter((cue) => cue.end <= lo || cue.start >= hi);
      cues = [...kept, ...read.map((cue) => shiftCue(cue, lo)).filter((cue) => cue.start < hi)].sort((a, b) => a.start - b.start);
    }
    rebuild();
  }
  importButton.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (!file) return;
    importCaptions(await file.text());
  });
  downloadButton.addEventListener("click", () => {
    const link = element("a", "");
    link.href = URL.createObjectURL(new Blob([toSRT(parts.length ? stitchCues(cues, parts) : clip(cues, range[0], range[1]))], { type: "text/plain" }));
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

  undoButton.addEventListener("click", () => travel(-1));
  redoButton.addEventListener("click", () => travel(1));
  replaceInput.addEventListener("change", async () => {
    const file = replaceInput.files?.[0];
    replaceInput.value = "";
    const id = replacing;
    replacing = null;
    if (!file || !id) return;
    await fillFrame(id, file);
  });
  uploadButton.addEventListener("click", () => uploadInput.click());
  uploadInput.addEventListener("change", async () => {
    const files = [...(uploadInput.files ?? [])];
    uploadInput.value = "";
    for (const file of files) {
      const video = VIDEO_TYPES.includes(file.type);
      if (!video && !PICTURE_TYPES.includes(file.type)) {
        tell(labels.uploadFailed);
        continue;
      }
      if (file.size > (video ? VIDEO_LIMIT : PICTURE_LIMIT)) {
        tell(video ? labels.videoTooBig : labels.pictureTooBig);
        continue;
      }
      const key = layerId("picture");
      try {
        await keepPicture(file, key, true);
      } catch {
        tell(video ? labels.uploadFailed : labels.pictureFailed);
        continue;
      }
      // One upload goes straight onto the frame; several wait in the panel to be placed.
      if (files.length === 1) addPicture(key);
    }
    renderUploads();
    changed();
  });
  // Ctrl or Cmd with Z undoes, with Shift (or Y) redoes, unless someone is typing.
  root.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (!(event.ctrlKey || event.metaKey) || target.closest("input, textarea")) return;
    const key = event.key.toLowerCase();
    if (key === "z" || key === "y") {
      event.preventDefault();
      travel(key === "y" || event.shiftKey ? 1 : -1);
    } else if (key === "=" || key === "+" || key === "-" || key === "0") {
      event.preventDefault();
      if (key === "0") applyZoom(null);
      else zoomStep(key === "-" ? -1 : 1);
    }
  });

  // Space plays and pauses, unless someone is typing; while tapping, it marks the next caption instead.
  root.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, summary, [role=radio], [role=slider], [role=tab]") || event.key !== " ") return;
    if (target.tagName === "BUTTON") return;
    event.preventDefault();
    if (tapping) tap();
    else if (animating) stop();
    else play();
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
    const under = (PICTURE_TYPES.includes(file.type) || VIDEO_TYPES.includes(file.type)) ? stage.layerAtClient?.(event.clientX, event.clientY) ?? null : null;
    if (under?.kind === "avatar" && file.type.startsWith("image/")) void loadImage(file).then((image) => {
      cover = image;
      coverSource = file;
      coverRow.show(file);
      rebuild();
      changed();
    }).catch(() => tell(labels.pictureFailed));
    else if (under && !under.locked && (under.kind === "image" || under.kind === "video" || under.kind === "mockup")) void fillFrame(under.id, file);
    else if (PICTURE_TYPES.includes(file.type) || VIDEO_TYPES.includes(file.type)) void uploadAndPlace(file);
    else if (/\.(srt|vtt)$/i.test(file.name)) void file.text().then(importCaptions);
    // A recording dropped on the timeline or the parts joins the clip; anywhere else it opens in place of it.
    else if (recordings.length && (timeline.contains(event.target as Node) || partList.contains(event.target as Node))) void append(file).catch(() => {});
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
  musicRow.show(musicSource);
  if (options.cover) void loadImage(options.cover).then((image) => {
    cover = image;
    rebuild();
  });
  // A host's background from before backgrounds were layers: it goes under the design on the page, at the strength
  // the old wash of the page's colour over it left it.
  if (options.background) {
    const source = options.background;
    void keepPicture(source, "background", false).then(() => {
      if (backgroundOf(layersFor(layout))) return;
      designs = { ...designs, [layout]: [{ id: layerId("image"), kind: "image", image: "background", x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 0.26, backdrop: true }, ...layersFor(layout)] };
      rebuild();
      record();
      changed();
    }).catch(() => {});
  }
  if (options.music) void setMusic(options.music).then(() => musicRow.show(options.music!)).catch(() => musicRow.show(null));
  for (const [key, source] of Object.entries(options.images ?? {})) void keepPicture(source, key, true).then(() => {
    renderUploads();
    rebuild();
  }).catch(() => {});
  void loadUsedFonts().then(refit);
  renderPageSwatches();
  renderTemplates();
  renderElements();
  renderPhotos();
  renderCombos();
  built = true;
  showBackgroundRow();
  placeCaptions();
  record();
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
    async addRecording(next) {
      await ready.catch(() => {});
      await (recordings.length ? append(next) : load(next));
    },
    get recordings() {
      return recordingList();
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
    setRange: (start, end) => setRange(start, end, undefined, true, recordingAt((start + end) / 2)),
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
      // Each part is kept inside the recording it lies in, and the selection edits the first.
      const fit = ([start, end]: [number, number]): [number, number] => {
        if (!recordings.length) return [start, end];
        const [lo, hi] = boundsOf(recordingAt((start + end) / 2));
        return [Math.max(lo, start), Math.min(hi, end)];
      };
      parts = next.map(fit).filter(([start, end]) => end > start);
      active = 0;
      if (parts.length) range = [...parts[0]];
      if (animating) seek(playhead);
      else playhead = intoClip(playhead);
      renderParts();
      drawWave();
      drawMap();
      placeTimeline();
      rebuild();
      scheduleClip();
    },
    get source() {
      return recordings[0]?.input ?? null;
    },
    readAudio(start, end, sampleRate) {
      return recordings.length ? readReel(reel(), start, end, sampleRate) : Promise.reject(new Error("No recording is open"));
    },
    setOverlay(next) {
      overlay = next;
      rebuild();
    },
    selectTab,
    slots: { header: headerSlot, actions: actionsSlot, captions: captionsSlot },
    setFonts(next) {
      fontList = next;
      void loadUsedFonts().then(refit);
      renderTemplates();
      renderCombos();
      stage.refresh();
    },
    async setImages(next) {
      await Promise.all(Object.entries(next).filter(([key]) => !pictures.has(key)).map(([key, image]) => keepPicture(image, key, !key.startsWith("photo-")).catch(() => {})));
      renderUploads();
      rebuild();
    },
    setTemplates(next) {
      hostTemplates = next;
      renderTemplates();
    },
    setLibrary(next) {
      library = next;
      renderElements();
      renderPhotos();
    },
    destroy() {
      stop();
      observer.disconnect();
      zoomWatch.disconnect();
      templateWatch?.disconnect();
      tileWatch?.disconnect();
      stopRehearsal();
      clearTimeout(noticeTimer);
      gone.abort();
      stage.destroy();
      for (const recording of recordings) closeRecording(recording);
      recordings = [];
      music?.close();
      for (const picture of pictures.values()) {
        picture.video?.pause();
        if (picture.url) URL.revokeObjectURL(picture.url);
      }
      root.remove();
    },
  };
}
