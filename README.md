# audiogram

Turn the recording of a Space, a podcast or a voice note into a video clip for X, TikTok, Reels, Shorts or LinkedIn, in the browser. Drag over the minute worth sharing, and it becomes a video with your picture and name, bars that move with the voice, and captions that light up word by word. Tap along to time the captions, pick a shape and colours, and export an MP4. Plain TypeScript, no dependencies; the audio never leaves the computer and there is no watermark.

Make a clip on [drk.vc](https://drk.vc/source/audiogram#preview), nothing to install.

![A MacBook and an iPhone running the clip maker in Safari: on the MacBook, a sample Space plays with green bars moving to the voice and the caption lighting up word by word, then the visual changes to a wave, the colours to mint and the shape to tall, and the captions are timed by tapping the picture; on the iPhone, the clip plays in the tall shape, is shortened from its end, and changes to the pulse visual and dusk colours](demo/preview.webp)

It is MIT licensed, with no plan to pay for and no watermark: use it in a product, change it, ship it.

- **Recordings of any length, clips of any length.** An MP3 or a WAV is read a stretch at a time instead of decoded whole, so a three-hour Space opens in a moment, with how far it has got shown as a percent, and its waveform fills in as it is read. A recording opens fully selected and plays from end to end; the clip can be all of it or any stretch of it. The preview holds a minute of sound around the playhead and the export works twenty seconds at a time, so a clip's length is bounded by the disk, not memory.
- **Pick the moment.** The whole recording is drawn as a waveform. Drag the clip's edges, slide it along, or drag across the rest of the waveform for a new stretch. The playhead has a strip of its own above it: drag it and the picture follows. Zoom in to pick seconds out of hours; an overview of the whole recording shows where you are.
- **Several moments, several recordings.** Split cuts the clip in two at the playhead, so each half can be trimmed or moved on its own. Add recording brings in another file from your computer and puts it after what is in the clip, as a part of its own; the waveform shows the recordings one after another, with a thin line where one ends, and a recording dropped on the timeline is added the same way. Each part gets a chip under the timeline: press one to edit it with the selection, drag it into a new order, or remove it. The parts play back to back; a join between two cuts fades over 0.15 s so it doesn't click, and the halves of a split play straight through.
- **Captions, word by word.** The word being said is marked as it is said, said words turn bright and the rest wait in grey. Long lines break into pages that fit the shape of the video.
- **Timing without a transcript service.** Paste a transcript and it is spread over the clip by how long each line takes to say; then tap the picture as each line starts and the captions snap to your taps. SRT and WebVTT files open, and the clip's captions save as SRT.
- **Named tools.** Design, Text, Photos, Music and Captions each have a labelled tab, down the left, or in a row under the timeline on a phone. One panel is open at a time, so no panel needs scrolling. Open audio and Download are at the top.
- **Edit the picture freely.** Every part of the frame is a layer. Press one to select it, drag it (it snaps to the middle, the edges and the other parts), pull a handle to size it or the round one to turn it, and double-click words to type them. Shift-click or drag a box on the page to pick several, then move, align, spread, group or delete them together; right-click for the same actions in a menu.
- **A bar for whatever is picked.**
  - Words: font, size, colour, bold, italic, underline, strikethrough, alignment, lists, letter and line spacing, and effects (shadow, lift, hollow, splice, outline, echo, glitch, neon, a colour behind, a curve, capitals).
  - Shapes: a border, solid, dashed or dotted, in any colour or a metal finish.
  - Lines: arrowheads, round ends and a curve.
  - Pictures and videos: crop by dragging inside the box, a frame shape with a border, filters, brightness, contrast, colour and blur, flips, and Set as background.
  - Charts: the kind, the rows (typed or pasted from a spreadsheet), labels, values, guide lines and the words before and after each value. Tables: the cells, rows and columns, a header row, stripes and rules. Mockups: the device and its picture. 3D shapes: the form, its shine and its shadow. Moving backgrounds: the style, its colours, its pace and whether it moves with the voice.
  - Every part: how it comes in, goes and moves while it shows, from an Animate panel of tiles that each show their movement: In, Out and Loop tabs; recommended ways for the kind of part; basic ways (fade, rise, pan, wipe, blur, zoom, drift, baseline, breathe, clarify, glide, iris, curtain, unfold), lively ones (pop, elastic, bounce, stomp, tumble, roll, skate, flip, fall, tectonic, scrapbook, flicker), ways that move words one at a time (typewriter, ascend, shift, merge, burst, cascade, spread, block, shine) and charts that grow; loops (pulse, heartbeat, wiggle, sway, float, spin, shimmer, flash, slow zoom); a direction, a speed, and the stretch of the clip it shows for. Preview plays it once on the picture. Position arranges, aligns and sets the exact place and size; transparency, copy style, lock and duplicate are a press away. Undo or redo any step; each shape keeps a layout of its own.
- **Start from a blank page.** Start from an empty page, the audiogram card, a page led by big captions, or any design a page passes in, and give the page any colour or gradient. Start over clears the design in one step that Undo takes back.
  - Elements has a section for each kind of part, each tile painted in the design's own colours, with See all, a search across every section, and Recently used first: the clip's own parts (captions, sound bars, a wave or a pulse, the clip's time, the profile picture, name, handle, title and links), 27 shapes, lines with arrowheads and curves, photo frames and grids, photos, moving backgrounds drawn from the clip's time (aurora, flow, bokeh, particles, waves, light rays, a grid, film grain), charts that grow in (columns, bars, line, area, pie, donut, ring, progress, a big number, a poll), tables, device mockups (phone, tablet, laptop, monitor, TV, browser, polaroid, vinyl) and shaded 3D shapes.
  - Empty frames show where a photo goes while you edit; drop a photo or video on one to fill it.
  - Captions taken off the picture can be shown again from the notice, from Elements or from Layers.
  - A background belongs to the design it is set on, stays under everything else, and is set with Set as background or the Photos tab.
  - Colours come from one picker: the design's own colours, the theme's, gold, rose gold, silver, bronze and champagne finishes, 24 defaults, gradients for the page, and any shade from a square and hue bar, a hex code or the eyedropper.
  - New words hug their text and grow as you type; pull a side handle to set a width they wrap in.
  - Text adds headings and pairs of fonts that go together.
  - Photos takes your photos and videos and any free photos a page offers.
  - A video plays muted in its layer, loops, and can be set as the background.
- **Timing and zoom.** Each layer's stretch of the clip is a bar in the Layers panel to drag. The picture zooms from the corner, with Ctrl and the wheel, or with Ctrl and plus or minus.
- **Downloads.** An MP4 at full size or two thirds of it, at 24, 30 or 60 frames a second, or a PNG of the moment at the playhead.
- **A look of your own.** Square, 4:5, 9:16 or 16:9. Bars that follow the voice's pitches, a scrolling wave, or rings that pulse. Five colour themes, your picture, name, handle and a title, the clip's time by the visual, and up to three links along the bottom.
- **An MP4 in seconds.** Where the browser has WebCodecs with H.264 and AAC, as Chrome and Edge do, the video is made faster than it plays, frame by frame, and written to an MP4 by a muxer in this package. Elsewhere it is recorded as it plays.
- **Private.** Nothing is uploaded: the audio is decoded, drawn and encoded in the page.
- **Accessible.** Every control is a labelled button, radio group or slider; the clip's edges and the playhead move with the arrow keys, and the picture describes what is on it.
- **Content Security Policy.** Nothing writes a `style` attribute or a `<style>` tag, so it runs under `style-src 'self'`. The audio and any picture you open are played from `blob:` addresses, so a strict policy needs `media-src 'self' blob:` and `img-src 'self' blob:`.

## Install

The package is not on npm. Install it from GitHub, which builds it on the way in:

```bash
npm install github:drkxbt/audiogram
```

It installs as `@drkxbt/audiogram`. Import it and its stylesheet:

```js
import { audiogram } from "@drkxbt/audiogram";
import "@drkxbt/audiogram/audiogram.css";
```

## Usage

```js
const editor = audiogram(document.querySelector("#clip"), {
  audio: "space.m4a",
  captions: await loadCaptions(),
  title: "Shipping in public",
  speaker: "drk",
  handle: "@drkxbt",
  cover: "avatar.jpg",
  onExport: ({ blob, extension }) => upload(blob, `clip.${extension}`),
});
```

Give the container a height; the editor fills it. Without `onExport`, the finished video downloads.

| Option | Default | |
| --- | --- | --- |
| `audio` | | An address or a `Blob` of anything the browser can decode: MP3, M4A, WAV, Ogg, or the sound of a video. An MP3 or a WAV can be any length; anything else is decoded whole, which suits recordings up to an hour or so. |
| `captions` | `[]` | `{ start, end, text, speaker?, words? }` in seconds from the start of the recording. `words` (`{ text, start }`) is used when it's there. |
| `range` | the whole recording | The clip to start with, `[start, end]` in seconds. |
| `title`, `speaker`, `handle`, `cover` | | What the video shows at the top. `cover` is an address or a `Blob`. |
| `background` | | A picture behind the whole clip, an address or a `Blob`. It is dimmed under the theme's colours so the words stay readable. |
| `logo` | | A brand mark, an address or a `Blob`, drawn small in the top left corner with its shape kept. Set it from code; the editor has no key for it. |
| `links` | `[]` | Up to three links, such as `"drk.vc"`, written small along the bottom of the clip. The editor has a box for each. |
| `layout` | `"square"` | `"square"`, `"portrait"` (4:5), `"story"` (9:16) or `"landscape"` (16:9). |
| `visual` | `"bars"` | `"bars"`, `"wave"` or `"pulse"`. |
| `theme` | `0` | An index into `THEMES`, or a theme of your own: `{ background, shade, text, muted, accent, onAccent }`. |
| `maxLength` | none | The longest clip, in seconds. |
| `blank` | `false` | Start from an empty white page rather than the audiogram card; layouts given in `layers` still apply. |
| `page` | the theme's | The page's colour, `{ color }`, or a gradient, `{ color, to, angle }`; `null` for the theme's. |
| `templates` | | More designs to start from: `{ id, name, make(shape) }`, where `make` returns `{ layers, page, theme? }`. |
| `library` | | Photos for the panels: `{ photos }`, each `{ id, name, url, thumb, width, height, credit }`. |
| `recent` | | The Elements added last time, newest first, as `settings.recent` gave them. |
| `font` | Geist, then the system font | The video's font, as a canvas font family. |
| `labels` | English | Every name and message, for other languages. |
| `music` | | Music under the voice, an address or a `Blob` of any audio the browser can decode. It loops, comes in over a second and leaves over a second and a half, and the mix is kept from clipping. The visual follows the voice alone. |
| `musicVolume` | `0.25` | The music's level, 0 to 1. |
| `layers` | | The frame as layers for any shape the user changed, as `settings.layers` gives them back. |
| `images` | | Uploaded pictures and videos by key, a `Blob` or an address each, as `settings.images` gives them back. |
| `fonts` | | Fonts to offer: `{ name, family, category, files: [{ url, weight, unicodeRange }] }`. Each file is fetched only when a layer uses it, and every font in use is loaded before a video is made. |
| `parts` | | Stretches of the timeline, `[start, end]` in seconds, played one after another as the clip; each join fades over 0.15 s, except where a part starts the moment the one before it ends, as the halves of a split do. With several recordings the timeline is all of them end to end, and a part stays inside one of them. Empty means the clip is the selected stretch. |
| `onParts` | | Called with the parts after they change in the editor: added, removed, reordered, split or trimmed. |
| `onRecordings` | | Called after another recording is added, with every recording on the timeline in order, as `recordings` gives them. |
| `overlay` | | `(ctx, frame) => void`, drawn last on every frame of the preview and the export. `frame` holds `time` and `duration` in seconds, the canvas's `width` and `height`, `unit` (one pixel of a 1080 px design at this size), `theme` and `font`. |
| `onChange` | | Called with the clip's look (`settings`) after the user changes it, at most once a frame. |

`audiogram()` returns `{ element, captions, range, duration, parts, recordings, settings, source, slots, load(audio), addRecording(audio), readAudio(start, end, sampleRate), selectTab(tab), setFonts(fonts), setImages(images), setParts(parts), setCaptions(cues), setRange(start, end), setOverlay(overlay), play(), pause(), export(), destroy() }`. `settings` is `{ title, speaker, handle, cover, background, logo, music, musicVolume, links, layout, visual, theme, layers, images, page }`, where `cover`, `background` and `logo` are the pictures the user opened (a `Blob`) or the addresses they were given, and `theme` is an index into `THEMES` or the theme itself, so a page can keep a look and start the next clip with it. `source` is the first recording on show, as it was opened (a `Blob`) or given. `load(audio)` opens a recording in place of all of them; `addRecording(audio)` puts another after them and keeps the clip. Every time the editor takes or gives, from `range` and `parts` to the captions, is on one timeline: the recordings end to end, `duration` seconds long. `recordings` lists them as `{ source, name, start, end }`. `readAudio(start, end, sampleRate)` reads one channel of that timeline at any rate, from the files as needed, so a page can work on an hour of audio without holding it all. `slots` holds three empty elements for a page's own controls: `header` after Open audio, `actions` before Download, and `captions` at the top of the Captions panel.

The parts work without the editor too. `defaultLayers(shape)` gives the classic layout as layers, `templateOf(id, shape)` the other starting points, and `layerAt`, `snapMove`, `resizeTurned`, `rotateLayer` and `alignToPage` do the geometry of editing them; `motionAt(layer, time, playing)` says where a layer is in its way in. `openSource(file, { onProgress })` opens a recording for reading a stretch at a time, with its outline filling in as it goes, and `indexMp3(bytes)` finds every frame of an MP3. `readClip(read, parts, from, to, sampleRate)` reads any window of a clip made of parts, the same sample for sample as the whole clip joined at once, and `readReel(reel, start, end, sampleRate)` reads recordings laid end to end (`{ offset, duration, read }` each) as one, so the two together read a clip whose parts come from several files. `Painter` draws any frame of a clip onto a canvas, `exportClip(scene, { prepare })` makes the video (`prepare(time)` runs before each frame, to put videos on it), `mux(tracks)` writes an MP4 from encoded H.264 and AAC and `Mp4Builder` writes one a sample at a time into Blobs, and the captions helpers (`parseSubtitles`, `toSRT`, `toVTT`, `spread`, `paginate`, `markStart`, `clip`) take plain arrays.

## Keyboard

| Keys | |
| --- | --- |
| Space | Play or pause; while timing captions, mark the next one |
| Left, Right on a clip edge or the playhead | Move it a tenth of a second; with Shift, a second |
| Ctrl or Cmd with the wheel over the waveform | Zoom in and out about the pointer |
| Shift with the wheel, or a sideways swipe | Move along the recording |
| Arrows in the tools | Move between Design, Elements, Text, Photos, Music and Captions |
| Arrows on the picture | Move the selected part a pixel; with Shift, ten |
| Enter, Delete, Escape on the picture | Type into the selected words, delete the part, let it go |
| Ctrl or Cmd with D, C, X, V | Duplicate, copy, cut or paste the selected parts |
| Ctrl or Cmd with A, G, Shift+G | Select every part, group the selected parts, take a group apart |
| Ctrl or Cmd with ] or [, with Shift | Bring forward or send backward; with Shift, to the front or the back |
| Ctrl or Cmd with B, I, U on words | Bold, italic, underline |
| T, R, C, L on the picture | Add text, a square, a circle or a line |
| Alt+Shift+L | Lock or unlock the selected parts |
| Ctrl or Cmd with plus, minus, 0 | Zoom in, zoom out, fit the page |
| Ctrl or Cmd with Z, with Shift (or Y) | Undo, redo |
| Arrows in a choice | Move along it and choose |

## Theming

```css
.ag {
  --ag-bg: #ffffff;
  --ag-text: #16161a;
  --ag-accent: #2ff0b8;
  --ag-stage: #e9e7e0;
  --ag-radius: 10px;
}
```

The editor's colours are custom properties on `.ag`. The video's colours are its theme, chosen in the editor or passed as `theme`.

## How it works

- **Long recordings.** An MP3's frame headers are read first, so any moment maps to the bytes that hold it; a stretch is decoded by handing the browser just those frames, with a few before them for the decoder to settle, one stretch at a time so a phone doesn't run out of memory. A WAV is read the same way with a header made for each stretch. The clip's own sound is read at 48 kHz a window at a time: a minute around the playhead for the picture, read ahead while it plays.
- **The sound.** The clip's sound is mixed to one channel. The waveform is the lowest and highest sample of each slice; the bars are a Hann-windowed FFT of the 40 milliseconds around each frame, gathered into bands spaced the way ears hear pitch, and eased so they rise quickly and fall slowly.
- **The captions.** Without word timings, words share a line's time by how long each takes to say, with a beat after commas and full stops. Tapping a line's start moves it and the end of the line before, and stretches their words to fit.
- **The video.** The clip is made twenty seconds at a time: that stretch's sound is read, mixed with any music at one level for the whole clip, and encoded as AAC, then each frame is drawn to a canvas, turned into a `VideoFrame` and encoded as H.264 with a key frame every two seconds. Encoded samples go into Blobs of a few megabytes as they come, which the browser can keep on disk, and the MP4's index, written from their sizes, goes before them, so the video can start playing before it has all arrived.
- **The fallback.** Without WebCodecs, the clip plays once into a canvas stream and a `MediaRecorder`, which makes WebM in most browsers and MP4 in Safari. X and Instagram don't take WebM, so use Chrome, Edge or Safari for clips you mean to post.

## What it doesn't do yet

It doesn't transcribe speech: captions come from what you type or paste, from an SRT or WebVTT file, or from your taps. It makes one speaker's card, not a card per voice. Issues and pull requests for either are welcome.

## Demo

```bash
npm install
npm run demo
```

Then open http://localhost:4330/demo/. It opens a made-up exchange read by two computer voices, with captions timed from the speech; open your own recording with Open audio, or drop it on the editor.

## Tests

```bash
npm test
```

Builds the package and tests the sound, the captions and the MP4 writer: waveform peaks and loudness, the FFT finding a tone in its own bin, the spectrum lighting the right band, meter easing, every common time format, SRT and WebVTT both ways with speakers, spreading lines, word timing, pages that keep their words' times, tapping a new start, clipping, and an MP4 read back box by box with every sample where its index says.

## License

[MIT](LICENSE). See [NOTICE](NOTICE) for the sample audio, the art and the fonts in the demo.
