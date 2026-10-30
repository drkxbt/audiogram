import { test } from "node:test";
import assert from "node:assert/strict";
import { Painter, textHeight, textWidth, THEMES } from "../dist/render.js";
import { defaultLayers } from "../dist/layers.js";

// Paths as the canvas takes them, so graphics can be drawn outside a browser.
globalThis.Path2D ??= class Path2D {
  constructor(d) {
    this.d = d;
  }
};

// A 2D context that keeps every call, with the drawing state at the moment of each fillText and drawImage.
function canvasLog(width, height) {
  const calls = [];
  const state = { font: "", fillStyle: "", strokeStyle: "", globalAlpha: 1, textAlign: "start", textBaseline: "alphabetic", lineWidth: 1 };
  const stack = [];
  const ops = {
    save: () => stack.push({ ...state }),
    restore: () => Object.assign(state, stack.pop()),
    measureText: (text) => ({ width: text.length * (Number(state.font.match(/(\d+(?:\.\d+)?)px/)?.[1]) || 10) * 0.5 }),
    createLinearGradient: () => ({ addColorStop: (at, color) => calls.push({ op: "addColorStop", at, color }) }),
    createRadialGradient: () => ({ addColorStop: (at, color) => calls.push({ op: "addColorStop", at, color }) }),
    fillText: (text, x, y) => calls.push({ op: "fillText", text, x, y, ...state }),
    drawImage: (image, ...rect) => calls.push({ op: "drawImage", image, rect, ...state }),
  };
  const ctx = new Proxy(state, {
    get: (target, key) => (key === "canvas" ? { width, height } : key in ops ? ops[key] : key in target ? target[key] : (...args) => calls.push({ op: key, args, ...state })),
    set: (target, key, value) => ((target[key] = value), true),
  });
  return { ctx, calls };
}

const scene = (extra = {}) => ({
  layout: "square", visual: "bars", theme: THEMES[0], title: "Shipping in public", speaker: "drk", handle: "@drkxbt", cover: null,
  captions: [], audio: { samples: new Float32Array(48000), sampleRate: 48000, start: 0, end: 6 }, font: "Geist", ...extra,
});

test("a text layer is painted where it sits, turned about its centre, in its own font, size and colour", () => {
  const layer = { id: "t1", kind: "text", text: "Hello there", x: 0.1, y: 0.2, w: 0.5, h: 0.1, rotation: 30, opacity: 0.5, font: "Anton", size: 80, weight: 400, color: "#ff3366", align: "left" };
  const { ctx, calls } = canvasLog(1080, 1080);
  new Painter(scene({ layers: [layer] })).paint(ctx, 1);
  const text = calls.find((call) => call.op === "fillText" && call.text === "Hello there");
  assert.ok(text, calls.filter((call) => call.op === "fillText").map((call) => call.text).join(" | "));
  assert.match(text.font, /80px/);
  assert.match(text.font, /Anton/);
  assert.equal(text.fillStyle, "#ff3366");
  assert.equal(text.globalAlpha, 0.5);
  const turn = calls.find((call) => call.op === "translate");
  assert.ok(Math.abs(turn.args[0] - 0.35 * 1080) < 1e-6 && Math.abs(turn.args[1] - 0.25 * 1080) < 1e-6, `translate ${turn.args}`);
  assert.ok(calls.some((call) => call.op === "rotate" && Math.abs(call.args[0] - Math.PI / 6) < 1e-9));
});

test("hidden layers are not painted, and theme colours follow the theme", () => {
  const layers = defaultLayers("square").map((layer) => (layer.kind === "handle" ? { ...layer, hidden: true } : layer.kind === "name" ? { ...layer, color: "accent" } : layer));
  const { ctx, calls } = canvasLog(1080, 1080);
  new Painter(scene({ layers, theme: THEMES[3] })).paint(ctx, 1);
  const texts = calls.filter((call) => call.op === "fillText");
  assert.ok(!texts.some((call) => call.text === "@drkxbt"), "the hidden handle");
  assert.equal(texts.find((call) => call.text === "drk").fillStyle, THEMES[3].accent);
  assert.equal(texts.find((call) => call.text === "Shipping in public").fillStyle, THEMES[3].text);
});

test("a picture layer draws its picture inside its box, and a shape fills its own", () => {
  const picture = { width: 800, height: 400 };
  const layers = [
    { id: "p", kind: "image", image: "a", x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 },
    { id: "s", kind: "shape", shape: "ellipse", fill: "#00ff00", x: 0, y: 0, w: 0.1, h: 0.1, rotation: 0, opacity: 1 },
  ];
  const { ctx, calls } = canvasLog(1000, 1000);
  new Painter(scene({ layers, images: new Map([["a", picture]]) })).paint(ctx, 1);
  const draw = calls.find((call) => call.op === "drawImage" && call.image === picture);
  assert.ok(draw, "the picture is drawn");
  // In the layer's own frame, centred on the origin after the translate: a 400 by 200 box.
  const [x, y, w, h] = draw.rect;
  assert.ok(Math.abs(x + w / 2) < 1e-6 && Math.abs(y + h / 2) < 1e-6 && Math.abs(w - 400) < 1e-6 && Math.abs(h - 200) < 1e-6, `${draw.rect}`);
  assert.ok(calls.some((call) => call.op === "ellipse"));
  assert.ok(calls.some((call) => call.op === "fill" && call.fillStyle === "#00ff00"));
});

test("captions take their layer's font, size and highlight", () => {
  const cue = { start: 0, end: 4, text: "ship it now", words: [{ text: "ship", start: 0, end: 1 }, { text: "it", start: 1, end: 2 }, { text: "now", start: 2, end: 3 }] };
  const layers = defaultLayers("square").map((layer) => (layer.kind === "captions" ? { ...layer, font: "Bebas Neue", size: 90, highlight: "#ffcc00", color: "#ffffff" } : layer));
  const { ctx, calls } = canvasLog(1080, 1080);
  new Painter(scene({ layers, captions: [cue] })).paint(ctx, 1.5);
  const said = calls.find((call) => call.op === "fillText" && call.text === "ship");
  assert.match(said.font, /90px/);
  assert.match(said.font, /Bebas Neue/);
  assert.equal(said.fillStyle, "#ffffff");
  // The word being said sits on the highlight.
  assert.ok(calls.some((call) => call.op === "fill" && call.fillStyle === "#ffcc00"));
});

test("a text layer's height follows its lines: more words, a narrower box or a bigger size make it taller", () => {
  const { ctx } = canvasLog(1080, 1080);
  const layer = { id: "t", kind: "text", text: "one two three four five six seven", x: 0, y: 0, w: 0.5, h: 0.1, rotation: 0, opacity: 1, size: 40 };
  const one = textHeight(ctx, { ...layer, text: "one" }, "one", "Geist", 1080, 1080);
  const many = textHeight(ctx, layer, layer.text, "Geist", 1080, 1080);
  const narrow = textHeight(ctx, { ...layer, w: 0.2 }, layer.text, "Geist", 1080, 1080);
  const big = textHeight(ctx, { ...layer, size: 80 }, layer.text, "Geist", 1080, 1080);
  assert.ok(Math.abs(one - (40 * 1.15) / 1080) < 1e-9, `${one}`);
  assert.ok(many >= one && narrow > many && big > many, `${one} ${many} ${narrow} ${big}`);
  // A new line typed counts as a line.
  assert.ok(Math.abs(textHeight(ctx, layer, "a\nb", "Geist", 1080, 1080) - (2 * 40 * 1.15) / 1080) < 1e-9);
});

test("the classic title has room for two lines on a square, a tall and a story frame, and four on a wide one", () => {
  const long = "A long title about shipping in public every single week of the year and then some more";
  for (const [layout, lines] of [["square", 2], ["portrait", 2], ["story", 2], ["landscape", 4]]) {
    const { ctx, calls } = canvasLog(layout === "landscape" ? 1920 : 1080, layout === "story" ? 1920 : layout === "portrait" ? 1350 : 1080);
    new Painter(scene({ layout, title: long })).paint(ctx, 1);
    const titleFont = calls.find((call) => call.op === "fillText" && long.startsWith(call.text))?.font;
    const painted = calls.filter((call) => call.op === "fillText" && call.font === titleFont && long.includes(call.text.replace(/…$/, "")));
    assert.equal(painted.length, lines, `${layout}: ${painted.map((call) => call.text).join(" / ")}`);
    assert.ok(painted.at(-1).text.endsWith("…"), `${layout}: the last line says there is more`);
  }
});

test("a title with more lines than its box holds ends the last one it keeps with an ellipsis, and one that fits ends as typed", () => {
  // 40 px words measure 20 px a letter here, so the 540 px box takes 27 letters a line and its 92 px two lines.
  const layer = { id: "t", kind: "title", x: 0, y: 0, w: 0.5, h: 92 / 1080, rotation: 0, opacity: 1, size: 40 };
  const lines = (title) => {
    const { ctx, calls } = canvasLog(1080, 1080);
    new Painter(scene({ title, layers: [layer] })).paint(ctx, 1);
    return calls.filter((call) => call.op === "fillText").map((call) => call.text);
  };
  // The second line is full, so its last word makes way for the ellipsis, and the comma before it goes too.
  assert.deepEqual(lines("Shipping in public every week, all year, unfailingly and then some"), ["Shipping in public every", "week, all year…"]);
  assert.deepEqual(lines("Shipping in public every week, all year, without fail"), ["Shipping in public every", "week, all year, without…"]);
  assert.deepEqual(lines("Shipping in public every week"), ["Shipping in public every", "week"]);
  assert.deepEqual(lines("Shipping in public\n\n"), ["Shipping in public"], "blank lines left out leave nothing to say");
  assert.deepEqual(lines("Shipping in public\n\nPart two"), ["Shipping in public…"], "the ellipsis ends the last line with words, not a blank one");
});

test("the page is painted in its own colour, or its gradient, before any layer", () => {
  const { ctx, calls } = canvasLog(1080, 1080);
  new Painter(scene({ page: { color: "#ffffff" }, layers: [] })).paint(ctx, 0);
  const fill = calls.find((call) => call.op === "fillRect");
  assert.equal(fill.fillStyle, "#ffffff");
  const log = canvasLog(1080, 1080);
  new Painter(scene({ page: { color: "#ff0000", to: "#0000ff", angle: 90 }, layers: [] })).paint(log.ctx, 0);
  assert.deepEqual(log.calls.filter((call) => call.op === "addColorStop").map(({ at, color }) => [at, color]), [[0, "#ff0000"], [1, "#0000ff"]]);
});

test("words can have an outline, a shadow, a colour behind them and capital letters", () => {
  const layer = { id: "t", kind: "text", text: "Big news", x: 0.1, y: 0.1, w: 0.8, h: 0.2, rotation: 0, opacity: 1, size: 60, color: "#ffffff", outline: "#000000", shadow: true, background: "#ff0000", uppercase: true };
  const { ctx, calls } = canvasLog(1080, 1080);
  new Painter(scene({ layers: [layer] })).paint(ctx, 0);
  const fill = calls.find((call) => call.op === "fillText" && call.text === "BIG NEWS");
  assert.ok(fill, "the words in capitals");
  assert.ok(fill.shadowBlur > 0, "with a shadow");
  const stroke = calls.findIndex((call) => call.op === "strokeText");
  assert.ok(stroke >= 0 && stroke < calls.indexOf(fill), "the outline is drawn under the fill");
  assert.equal(calls[stroke].strokeStyle, "#000000");
  const behind = calls.findIndex((call) => call.op === "fill" && call.fillStyle === "#ff0000");
  assert.ok(behind >= 0 && behind < calls.indexOf(fill), "the colour behind the words comes first");
});

test("a picture can be flipped and adjusted, and a video layer draws its current frame", () => {
  const picture = { width: 800, height: 400 };
  const video = { videoWidth: 640, videoHeight: 360 };
  const layers = [
    { id: "p", kind: "image", image: "a", x: 0, y: 0, w: 0.4, h: 0.2, rotation: 0, opacity: 1, flipX: true, adjust: { brightness: 1.2, saturation: 0 } },
    { id: "v", kind: "video", image: "v", x: 0.5, y: 0.5, w: 0.4, h: 0.3, rotation: 0, opacity: 1 },
  ];
  const { ctx, calls } = canvasLog(1000, 1000);
  new Painter(scene({ layers, images: new Map([["a", picture], ["v", video]]) })).paint(ctx, 0);
  const drawn = calls.find((call) => call.op === "drawImage" && call.image === picture);
  assert.match(drawn.filter, /brightness\(1\.2\)/);
  assert.match(drawn.filter, /saturate\(0\)/);
  assert.ok(calls.some((call) => call.op === "scale" && call.args[0] === -1 && call.args[1] === 1), "flipped across");
  assert.ok(calls.some((call) => call.op === "drawImage" && call.image === video), "the video frame is drawn");
});

test("each sound layer keeps its own look", () => {
  const layers = [{ id: "v", kind: "visual", visual: "pulse", x: 0.1, y: 0.1, w: 0.8, h: 0.3, rotation: 0, opacity: 1 }];
  const { ctx, calls } = canvasLog(1080, 1080);
  new Painter(scene({ visual: "bars", layers })).paint(ctx, 1);
  assert.ok(calls.some((call) => call.op === "arc"), "rings, not bars");
});

test("new shapes are drawn as their own outlines", () => {
  const outline = (shape) => {
    const layers = [{ id: "s", kind: "shape", shape, fill: "#123456", x: 0.1, y: 0.1, w: 0.3, h: 0.3, rotation: 0, opacity: 1 }];
    const { ctx, calls } = canvasLog(1000, 1000);
    new Painter(scene({ layers })).paint(ctx, 0);
    assert.ok(calls.some((call) => call.op === "fill" && call.fillStyle === "#123456"), `${shape} is filled`);
    return calls.filter((call) => ["moveTo", "lineTo", "bezierCurveTo", "quadraticCurveTo", "arcTo", "arc"].includes(call.op)).map((call) => call.op).join(" ");
  };
  const seen = new Map([[outline("rect"), "rect"]]);
  for (const shape of ["triangle", "star", "heart", "arrow", "diamond", "bubble"]) {
    const path = outline(shape);
    assert.ok(!seen.has(path), `${shape} is drawn like ${seen.get(path)}`);
    seen.set(path, shape);
  }
  assert.equal(outline("star").split(" ").filter((op) => op === "lineTo").length, 9, "five points, ten corners");
});

test("a layer comes in its own way while the clip plays, and stays put while it is edited", () => {
  const layer = { id: "t", kind: "text", text: "Hi", x: 0.1, y: 0.1, w: 0.5, h: 0.1, rotation: 0, opacity: 1, enter: "fade", until: 4 };
  const playing = canvasLog(1080, 1080);
  new Painter(scene({ layers: [layer] })).paint(playing.ctx, 0.1);
  assert.ok(playing.calls.find((call) => call.op === "fillText" && call.text === "Hi").globalAlpha < 1);
  const gone = canvasLog(1080, 1080);
  new Painter(scene({ layers: [layer] })).paint(gone.ctx, 5);
  assert.ok(!gone.calls.some((call) => call.op === "fillText" && call.text === "Hi"), "gone after its time");
  const editing = canvasLog(1080, 1080);
  const painter = new Painter(scene({ layers: [layer] }));
  painter.animate = false;
  painter.paint(editing.ctx, 0.1);
  assert.equal(editing.calls.find((call) => call.op === "fillText" && call.text === "Hi").globalAlpha, 1);
});

test("capitals are measured as they are drawn, so a box sized for them holds every line", () => {
  // Capitals measure wider than small letters here, as they do in most fonts.
  const ctx = { font: "", measureText: (text) => ({ width: [...text].reduce((sum, letter) => sum + (letter === letter.toUpperCase() && letter.trim() ? 30 : 20), 0) }) };
  const layer = { id: "t", kind: "text", x: 0, y: 0, w: 0.3, h: 0.1, rotation: 0, opacity: 1, size: 40 };
  const words = "aaaa bbbb cccc dddd eeee ffff";
  const lower = textHeight(ctx, layer, words, "Geist", 1080, 1080);
  const upper = textHeight(ctx, { ...layer, uppercase: true }, words, "Geist", 1080, 1080);
  assert.ok(upper > lower, `${upper} > ${lower}`);
});

const words = (extra) => ({ id: "w", kind: "text", text: "Hello", x: 0.1, y: 0.1, w: 0.8, h: 0.2, rotation: 0, opacity: 1, size: 60, color: "#222222", ...extra });

test("words can be underlined, struck through and spaced out", () => {
  const plain = canvasLog(1080, 1080);
  new Painter(scene({ layers: [words({})] })).paint(plain.ctx, 0);
  const marked = canvasLog(1080, 1080);
  new Painter(scene({ layers: [words({ underline: true, strike: true, letterSpacing: 100 })] })).paint(marked.ctx, 0);
  const rules = (calls) => calls.filter((call) => call.op === "fillRect").length;
  assert.equal(rules(marked.calls) - rules(plain.calls), 2, "a rule under the words and one through them");
  const text = marked.calls.find((call) => call.op === "fillText" && call.text === "Hello");
  assert.equal(text.letterSpacing, "6px", "a tenth of an em at 60 px");
});

test("hollow words are outlined only, and splice adds a shifted copy behind them", () => {
  const hollow = canvasLog(1080, 1080);
  new Painter(scene({ layers: [words({ effect: "hollow" })] })).paint(hollow.ctx, 0);
  assert.ok(hollow.calls.some((call) => call.op === "strokeText"));
  assert.ok(!hollow.calls.some((call) => call.op === "fillText" && call.text === "Hello"));
  const splice = canvasLog(1080, 1080);
  new Painter(scene({ layers: [words({ effect: "splice", effectColor: "#ff00aa" })] })).paint(splice.ctx, 0);
  assert.ok(splice.calls.some((call) => call.op === "fillText" && call.fillStyle === "#ff00aa"));
  for (const effect of ["lift", "echo", "glitch", "neon"]) {
    const log = canvasLog(1080, 1080);
    new Painter(scene({ layers: [words({ effect })] })).paint(log.ctx, 0);
    assert.ok(log.calls.filter((call) => call.op === "fillText" && call.text === "Hello").length >= 1, effect);
  }
});

test("a list puts a bullet or a number before each line typed, and line height spreads the lines", () => {
  const log = canvasLog(1080, 1080);
  new Painter(scene({ layers: [words({ text: "One\nTwo", list: "bullet" })] })).paint(log.ctx, 0);
  assert.ok(log.calls.some((call) => call.op === "fillText" && call.text === "• One"));
  const numbered = canvasLog(1080, 1080);
  new Painter(scene({ layers: [words({ text: "One\nTwo", list: "number" })] })).paint(numbered.ctx, 0);
  assert.ok(numbered.calls.some((call) => call.op === "fillText" && call.text === "2. Two"));
  const ctx = { font: "", measureText: (text) => ({ width: text.length * 20 }) };
  const base = textHeight(ctx, words({ text: "One\nTwo" }), "One\nTwo", "Geist", 1080, 1080);
  const spread = textHeight(ctx, words({ text: "One\nTwo", lineHeight: 2.3 }), "One\nTwo", "Geist", 1080, 1080);
  assert.ok(Math.abs(spread / base - 2) < 0.01, `${spread / base}`);
});

test("curved words are set a letter at a time along an arc", () => {
  const log = canvasLog(1080, 1080);
  new Painter(scene({ layers: [words({ text: "Curve", curve: 60 })] })).paint(log.ctx, 0);
  const letters = log.calls.filter((call) => call.op === "fillText").map((call) => call.text);
  assert.deepEqual(letters, ["C", "u", "r", "v", "e"]);
  assert.ok(log.calls.filter((call) => call.op === "rotate").length >= 5);
});

test("a graphic draws its paths in its own colour, fitted to its box", () => {
  const art = { w: 24, h: 24, paths: [{ d: "M2 2L22 22", stroke: "currentColor", width: 2 }, { d: "M0 0h4v4z", fill: "#123456" }] };
  const log = canvasLog(1000, 1000);
  new Painter(scene({ layers: [{ id: "g", kind: "graphic", art, color: "#ff0000", x: 0.1, y: 0.1, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }] })).paint(log.ctx, 0);
  assert.ok(log.calls.some((call) => call.op === "stroke" && call.strokeStyle === "#ff0000"), "a stroke in the layer's colour");
  assert.ok(log.calls.some((call) => call.op === "fill" && call.fillStyle === "#123456"), "a fill in its own colour");
});

test("a graphic's path can be faded on its own, as a part of the layer's opacity, and the next path is not", () => {
  const art = { w: 24, h: 24, paths: [{ d: "M0 0h24v24z", fill: "#111111", opacity: 0.2 }, { d: "M0 0h4v4z", fill: "#222222" }] };
  const log = canvasLog(1000, 1000);
  new Painter(scene({ layers: [{ id: "g", kind: "graphic", art, x: 0.1, y: 0.1, w: 0.2, h: 0.2, rotation: 0, opacity: 0.5 }] })).paint(log.ctx, 0);
  const faded = log.calls.find((call) => call.op === "fill" && call.fillStyle === "#111111");
  const next = log.calls.find((call) => call.op === "fill" && call.fillStyle === "#222222");
  assert.ok(Math.abs(faded.globalAlpha - 0.1) < 1e-9, `${faded.globalAlpha}`);
  assert.ok(Math.abs(next.globalAlpha - 0.5) < 1e-9, `${next.globalAlpha}`);
});

test("a frame clips its picture to a shape, and an empty frame shows a placeholder only while editing", () => {
  const picture = { width: 800, height: 400 };
  const framed = { id: "f", kind: "image", image: "a", mask: "ellipse", x: 0.1, y: 0.1, w: 0.4, h: 0.4, rotation: 0, opacity: 1 };
  const log = canvasLog(1000, 1000);
  new Painter(scene({ layers: [framed], images: new Map([["a", picture]]) })).paint(log.ctx, 0);
  const clip = log.calls.findIndex((call) => call.op === "clip");
  const ellipse = log.calls.findIndex((call) => call.op === "ellipse");
  const draw = log.calls.findIndex((call) => call.op === "drawImage" && call.image === picture);
  assert.ok(ellipse >= 0 && ellipse < clip && clip < draw, `${ellipse} ${clip} ${draw}`);
  const empty = { ...framed, image: undefined };
  const editing = canvasLog(1000, 1000);
  const painter = new Painter(scene({ layers: [empty] }));
  painter.animate = false;
  painter.placeholders = true;
  painter.paint(editing.ctx, 0);
  const playing = canvasLog(1000, 1000);
  new Painter(scene({ layers: [empty] })).paint(playing.ctx, 0);
  const marks = (calls) => calls.filter((call) => call.op === "fill" || call.op === "stroke").length;
  assert.ok(marks(editing.calls) > marks(playing.calls), "a placeholder while editing, nothing in the video");
});

test("a cropped picture is zoomed and moved inside its box, with any filter it has", () => {
  const picture = { width: 1000, height: 1000 };
  const layer = { id: "p", kind: "image", image: "a", x: 0, y: 0, w: 0.5, h: 0.5, rotation: 0, opacity: 1, crop: { x: 0, y: 0, zoom: 2 }, filter: "mono" };
  const log = canvasLog(1000, 1000);
  new Painter(scene({ layers: [layer], images: new Map([["a", picture]]) })).paint(log.ctx, 0);
  const draw = log.calls.find((call) => call.op === "drawImage" && call.image === picture);
  assert.ok(Math.abs(draw.rect[2] - 1000) < 1e-6, `twice the 500 px box: ${draw.rect}`);
  assert.match(draw.filter, /grayscale\(1\)/);
});

test("a shape can have a dashed border, and a line can end in an arrow", () => {
  const log = canvasLog(1000, 1000);
  new Painter(scene({ layers: [{ id: "s", kind: "shape", shape: "rect", fill: "#eeeeee", stroke: "#111111", strokeWidth: 6, dash: "dashed", x: 0.1, y: 0.1, w: 0.3, h: 0.3, rotation: 0, opacity: 1 }] })).paint(log.ctx, 0);
  assert.ok(log.calls.some((call) => call.op === "setLineDash" && call.args[0].length > 0));
  assert.ok(log.calls.some((call) => call.op === "stroke" && call.strokeStyle === "#111111"));
  const line = canvasLog(1000, 1000);
  new Painter(scene({ layers: [{ id: "l", kind: "shape", shape: "line", fill: "#00aa00", strokeWidth: 8, arrowEnd: true, x: 0.1, y: 0.5, w: 0.5, h: 0.04, rotation: 0, opacity: 1 }] })).paint(line.ctx, 0);
  assert.ok(line.calls.some((call) => call.op === "stroke" && call.strokeStyle === "#00aa00"), "the line");
  assert.ok(line.calls.some((call) => call.op === "fill" && call.fillStyle === "#00aa00"), "its arrowhead");
  for (const shape of ["pentagon", "hexagon", "octagon", "cross", "parallelogram", "arch"]) {
    const each = canvasLog(1000, 1000);
    new Painter(scene({ layers: [{ id: "x", kind: "shape", shape, fill: "#abcdef", x: 0.1, y: 0.1, w: 0.3, h: 0.3, rotation: 0, opacity: 1 }] })).paint(each.ctx, 0);
    assert.ok(each.calls.some((call) => call.op === "fill" && call.fillStyle === "#abcdef"), shape);
  }
});

test("a layer's way in can wipe it on, clipped to what has been uncovered", () => {
  const log = canvasLog(1080, 1080);
  new Painter(scene({ layers: [words({ enter: "wipe", from: 0 })] })).paint(log.ctx, 0.1);
  const clip = log.calls.findIndex((call) => call.op === "clip");
  const text = log.calls.findIndex((call) => call.op === "fillText" && call.text === "Hello");
  assert.ok(clip >= 0 && clip < text);
});

test("a picture is always held inside its box, framed or not, so a cover or a crop never spills past it", () => {
  const picture = { width: 1600, height: 900 };
  const layer = { id: "p", kind: "image", image: "a", x: 0.1, y: 0.1, w: 0.3, h: 0.3, rotation: 0, opacity: 1 };
  const log = canvasLog(1000, 1000);
  new Painter(scene({ layers: [layer], images: new Map([["a", picture]]) })).paint(log.ctx, 0);
  const clip = log.calls.findIndex((call) => call.op === "clip");
  const draw = log.calls.findIndex((call) => call.op === "drawImage" && call.image === picture);
  assert.ok(clip >= 0 && clip < draw, `${clip} ${draw}`);
});

test("a flipped graphic is mirrored, and captions keep the line spacing set for them", () => {
  const art = { w: 24, h: 24, paths: [{ d: "M2 2L22 22", stroke: "currentColor", width: 2 }] };
  const log = canvasLog(1000, 1000);
  new Painter(scene({ layers: [{ id: "g", kind: "graphic", art, flipX: true, x: 0.1, y: 0.1, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }] })).paint(log.ctx, 0);
  assert.ok(log.calls.some((call) => call.op === "scale" && call.args[0] === -1), "mirrored across");
  const cue = { start: 0, end: 4, text: "one two three four five six seven eight nine ten eleven twelve", words: undefined };
  const rows = (lineHeight) => {
    const each = canvasLog(1080, 1080);
    new Painter(scene({ captions: [cue], layers: [{ id: "c", kind: "captions", x: 0.1, y: 0.1, w: 0.4, h: 0.8, rotation: 0, opacity: 1, size: 60, lineHeight }] })).paint(each.ctx, 1);
    const ys = [...new Set(each.calls.filter((call) => call.op === "fillText").map((call) => Math.round(call.y)))].sort((a, b) => a - b);
    return ys[1] - ys[0];
  };
  assert.ok(rows(2.5) > rows(1.15) * 1.5, `${rows(2.5)} vs ${rows(1.15)}`);
});

test("spaced-out words are centred on their letters, not on the space after the last one", () => {
  const plain = canvasLog(1080, 1080);
  const layer = { id: "w", kind: "text", text: "Hi", x: 0.1, y: 0.1, w: 0.8, h: 0.2, rotation: 0, opacity: 1, size: 60, align: "center" };
  new Painter(scene({ layers: [layer] })).paint(plain.ctx, 0);
  const spaced = canvasLog(1080, 1080);
  new Painter(scene({ layers: [{ ...layer, letterSpacing: 500 }] })).paint(spaced.ctx, 0);
  const x = (calls) => calls.find((call) => call.op === "fillText" && call.text === "Hi").x;
  assert.ok(Math.abs(x(spaced.calls) - x(plain.calls) - 15) < 1e-6, `moved by half of 30 px: ${x(spaced.calls) - x(plain.calls)}`);
});

test("a title that just fits one line at full size keeps to one line in a smaller export", () => {
  // 20 letters at 64 px run 640 px in the log's measure: the box is exactly that wide and one line tall.
  const layer = { id: "t", kind: "title", x: 0.1, y: 0.1, w: 640 / 1080, h: (64 * 1.15) / 1080, rotation: 0, opacity: 1, size: 64 };
  for (const side of [1080, 720]) {
    const log = canvasLog(side, side);
    new Painter(scene({ layers: [layer], title: "SMALL BETS BIG WEEKS" })).paint(log.ctx, 0);
    const lines = log.calls.filter((call) => call.op === "fillText").map((call) => call.text);
    assert.deepEqual(lines, ["SMALL BETS BIG WEEKS"], `at ${side} px`);
  }
});

test("words in a box that hugs them break only where a line was typed, and the box is as wide as the longest line", () => {
  const layer = { id: "t", kind: "text", text: "A long line that would wrap\nShort", autoWidth: true, x: 0, y: 0, w: 0.1, h: 0.1, rotation: 0, opacity: 1, size: 40 };
  const log = canvasLog(1000, 1000);
  new Painter(scene({ layers: [layer] })).paint(log.ctx, 0);
  const lines = log.calls.filter((call) => call.op === "fillText").map((call) => call.text);
  assert.deepEqual(lines, ["A long line that would wrap", "Short"]);
  // measureText in the log runs half the size a letter; 40 design pixels are 37.04 on a 1000 px frame.
  assert.ok(Math.abs(textWidth(log.ctx, layer, layer.text, "Geist", 1000, 1000) - (27 * 37.04 * 0.5) / 1000) < 1e-9);
  assert.ok(Math.abs(textHeight(log.ctx, layer, layer.text, "Geist", 1000, 1000) - (2 * 40 * (1000 / 1080) * 1.15) / 1000) < 1e-9, "two typed lines tall");
});

test("a captions layer shows sample words while the picture is edited, and nothing in the video", () => {
  const layer = { id: "c", kind: "captions", x: 0.1, y: 0.4, w: 0.8, h: 0.3, rotation: 0, opacity: 1 };
  const editing = canvasLog(1000, 1000);
  const painter = new Painter(scene({ layers: [layer] }));
  painter.animate = false;
  painter.placeholders = true;
  painter.captionsSample = "Captions show here";
  painter.paint(editing.ctx, 0);
  assert.ok(editing.calls.some((call) => call.op === "fillText" && call.text === "Captions"), "the sample's words");
  assert.ok(editing.calls.filter((call) => call.op === "fillText").every((call) => call.fillStyle === THEMES[0].muted), "unsaid, so muted");
  const playing = canvasLog(1000, 1000);
  new Painter(scene({ layers: [layer] })).paint(playing.ctx, 0);
  assert.ok(!playing.calls.some((call) => call.op === "fillText"));
});

test("words that ascend move one at a time, the first ahead of the last", () => {
  const layer = { id: "t", kind: "text", text: "One two three", x: 0, y: 0, w: 1, h: 0.2, rotation: 0, opacity: 1, size: 40, enter: "ascend" };
  const log = canvasLog(1000, 1000);
  new Painter(scene({ layers: [layer] })).paint(log.ctx, 0.8);
  const words = log.calls.filter((call) => call.op === "fillText");
  assert.deepEqual(words.map((call) => call.text), ["One", "two", "three"]);
  assert.ok(words[0].globalAlpha > words[2].globalAlpha, `${words.map((call) => call.globalAlpha)}`);
});

test("a metal colour is laid on as a gradient across the layer", () => {
  const layer = { id: "s", kind: "shape", shape: "rect", fill: "metal:gold", x: 0, y: 0, w: 0.5, h: 0.5, rotation: 0, opacity: 1 };
  const log = canvasLog(1000, 1000);
  new Painter(scene({ layers: [layer] })).paint(log.ctx, 0);
  assert.ok(log.calls.filter((call) => call.op === "addColorStop").length >= 5, "the gold's stops");
});

test("a layer being shown once moves while the rest of the picture stays still", () => {
  const moving = { id: "a", kind: "text", text: "Hi", x: 0, y: 0, w: 0.5, h: 0.1, rotation: 0, opacity: 1, enter: "fade" };
  const still = { ...moving, id: "b", text: "There" };
  const log = canvasLog(1000, 1000);
  const painter = new Painter(scene({ layers: [moving, still] }));
  painter.animate = false;
  painter.rehearse = { ids: new Set(["a"]), part: "enter", at: 0.1 };
  painter.paint(log.ctx, 3);
  const alpha = (text) => log.calls.find((call) => call.op === "fillText" && call.text === text).globalAlpha;
  assert.ok(alpha("Hi") < 0.9, `fading in: ${alpha("Hi")}`);
  assert.equal(alpha("There"), 1);
});

test("a moving picture shows the frame for the clip's time, counted from when its layer comes in, and loops", () => {
  const frames = [{ width: 10, height: 10, name: "a" }, { width: 10, height: 10, name: "b" }, { width: 10, height: 10, name: "c" }];
  const layer = { id: "s", kind: "image", image: "s", from: 1, x: 0, y: 0, w: 0.2, h: 0.2, rotation: 0, opacity: 1 };
  const drawn = (time) => {
    const log = canvasLog(1000, 1000);
    new Painter(scene({ layers: [layer], images: new Map([["s", frames[0]]]), animations: new Map([["s", { frames, ends: [0.1, 0.2, 0.3] }]]) })).paint(log.ctx, time);
    return log.calls.find((call) => call.op === "drawImage")?.image.name;
  };
  assert.equal(drawn(1.05), "a");
  assert.equal(drawn(1.15), "b");
  assert.equal(drawn(1.25), "c");
  assert.equal(drawn(1.35), "a", "back to the start");
});

test("at the sample point (a template's picture, or no clip yet) the sample is part said: words said, one marked, the rest to come", () => {
  const layer = { id: "c", kind: "captions", x: 0.1, y: 0.4, w: 0.8, h: 0.3, rotation: 0, opacity: 1, color: "#ffffff", highlight: "#ffcc00" };
  const log = canvasLog(1000, 1000);
  const painter = new Painter(scene({ layers: [layer] }));
  painter.animate = false;
  painter.placeholders = true;
  painter.sampleProgress = true;
  painter.captionsSample = "We spent two years building this";
  painter.paint(log.ctx, 0);
  const words = log.calls.filter((call) => call.op === "fillText");
  assert.equal(words.length, 6);
  const marked = words.findIndex((call) => call.fillStyle !== "#ffffff");
  assert.ok(marked > 0 && marked < 5, `one word in the middle is marked: ${marked}`);
  assert.ok(words.slice(0, marked).every((call) => call.globalAlpha === 1), "the words before it are said");
  assert.ok(words.slice(marked + 1).every((call) => call.globalAlpha === 0.72), "the words after it are still to come");
  assert.ok(log.calls.some((call) => call.op === "fill" && call.fillStyle === "#ffcc00"), "the mark is drawn in the highlight");
});

test("words still to come stay readable on a strong page: the caption's colour at 72%, not half", () => {
  const cue = { start: 0, end: 4, text: "ship it now", words: [{ text: "ship", start: 0, end: 1 }, { text: "it", start: 1, end: 2 }, { text: "now", start: 2, end: 3 }] };
  const layer = { id: "c", kind: "captions", x: 0.1, y: 0.4, w: 0.8, h: 0.3, rotation: 0, opacity: 1, color: "#ffffff", highlight: "#ffcc00" };
  const { ctx, calls } = canvasLog(1080, 1080);
  new Painter(scene({ layers: [layer], captions: [cue], page: { color: "#a8121b" } })).paint(ctx, 0.5);
  const now = calls.find((call) => call.op === "fillText" && call.text === "now");
  assert.equal(now.fillStyle, "#ffffff");
  assert.equal(now.globalAlpha, 0.72);
});

test("the words of a label take up only part of its box, across from where they are aligned", async () => {
  const { wordsSpan } = await import("../dist/render.js");
  // The test context measures 20 px a letter for 40 px words, so "drk" is 60 px of a 1080 frame.
  const ctx = canvasLog(1080, 1080).ctx;
  const name = { id: "n", kind: "name", x: 0.1, y: 0.5, w: 0.5, h: 0.05, rotation: 0, opacity: 1, size: 40, align: "left" };
  const left = wordsSpan(ctx, name, "drk", "Geist", 1080, 1080);
  assert.ok(Math.abs(left.x - 0.1) < 1e-9 && Math.abs(left.w * 1080 - 60) < 1, JSON.stringify(left));
  const centred = wordsSpan(ctx, { ...name, align: "center" }, "drk", "Geist", 1080, 1080);
  assert.ok(Math.abs(centred.x + centred.w / 2 - 0.35) < 1e-9, "centred on the box's middle");
  const right = wordsSpan(ctx, { ...name, align: "right" }, "drk", "Geist", 1080, 1080);
  assert.ok(Math.abs(right.x + right.w - 0.6) < 1e-9, "ending at the box's right edge");
  const long = wordsSpan(ctx, name, "x".repeat(60), "Geist", 1080, 1080);
  assert.ok(Math.abs(long.w - 0.5) < 1e-9 && Math.abs(long.x - 0.1) < 1e-9, "words longer than the box fill it");
  const title = wordsSpan(ctx, { ...name, kind: "title", h: 0.2 }, "Shipping in public every week", "Geist", 1080, 1080);
  assert.ok(title.w <= 0.5 + 1e-9 && title.w * 1080 >= 20 * 20, `a wrapped title spans its widest line: ${title.w * 1080}`);
  assert.equal(wordsSpan(ctx, name, "", "Geist", 1080, 1080), null, "no words, no span");
  // A short caption in a tall box is outlined one line tall, about the box's middle, where the painter sets it.
  const room = { ...name, kind: "captions", x: 0.1, y: 0.4, w: 0.8, h: 0.3, size: 40, align: undefined };
  const caption = wordsSpan(ctx, room, "hi there", "Geist", 1080, 1080);
  assert.ok(Math.abs(caption.h * 1080 - 40 * 1.34) < 1e-6, `one line tall: ${caption.h * 1080}`);
  assert.ok(Math.abs(caption.y + caption.h / 2 - 0.55) < 1e-9, "about the box's middle");
  assert.ok(Math.abs(caption.x + caption.w / 2 - 0.5) < 1e-9, "centred, as captions are by default");
});
