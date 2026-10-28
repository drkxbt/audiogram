# audiogram

Turn the recording of a Space, a podcast or a voice note into a video clip for X, in the browser. Drag over the minute worth sharing, and it becomes a video with your picture and name, bars that move with the voice, and captions that light up word by word. Tap along to time the captions, pick a shape and colours, and export an MP4. Plain TypeScript, no dependencies; the audio never leaves the computer and there is no watermark.

Make a clip on [drk.vc](https://drk.vc/repo?id=audiogram#preview), nothing to install.

![A MacBook and an iPhone running the clip maker in Safari: on the MacBook, a sample Space plays with green bars moving to the voice and the caption lighting up word by word, then the visual changes to a wave, the colours to mint and the shape to tall, and the captions are timed by tapping the picture; on the iPhone, the clip plays in the tall shape, is shortened from its end, and changes to the pulse visual and dusk colours](demo/preview.webp)

Audiogram apps such as Headliner charge a monthly plan for unlimited clips without a watermark. This one is MIT licensed: use it in a product, change it, ship it.

- **Pick the moment.** The whole recording is drawn as a waveform. Drag the clip's edges or slide it along, and play it back with the picture following the sound. Clips stop at 2:20 by default, the longest video most X accounts can post.
- **Captions, word by word.** The word being said is marked as it is said, said words turn bright and the rest wait in grey. Long lines break into pages that fit the shape of the video.
- **Timing without a transcript service.** Paste a transcript and it is spread over the clip by how long each line takes to say; then tap the picture as each line starts and the captions snap to your taps. SRT and WebVTT files open and save too.
- **A look of your own.** Square, 4:5 or 16:9. Bars that follow the voice's pitches, a scrolling wave, or rings that pulse. Five colour themes, your picture, name, handle and a title.
- **An MP4 in seconds.** Where the browser has WebCodecs with H.264 and AAC, as Chrome and Edge do, the video is made faster than it plays, frame by frame, and written to an MP4 by a muxer in this package. Elsewhere it is recorded as it plays.
- **Private.** Nothing is uploaded: the audio is decoded, drawn and encoded in the page.
- **Accessible.** Every control is a labelled button, radio group or slider; the clip's edges move with the arrow keys, and the picture describes what is on it.
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
| `audio` | | An address or a `Blob` of anything the browser can decode: MP3, M4A, WAV, Ogg, or the sound of a video. |
| `captions` | `[]` | `{ start, end, text, speaker?, words? }` in seconds from the start of the recording. `words` (`{ text, start }`) is used when it's there. |
| `range` | the first 30 seconds | The clip to start with, `[start, end]` in seconds. |
| `title`, `speaker`, `handle`, `cover` | | What the video shows at the top. `cover` is an address or a `Blob`. |
| `layout` | `"square"` | `"square"`, `"portrait"` (4:5) or `"landscape"` (16:9). |
| `visual` | `"bars"` | `"bars"`, `"wave"` or `"pulse"`. |
| `theme` | `0` | An index into `THEMES`, or a theme of your own: `{ background, shade, text, muted, accent, onAccent }`. |
| `maxLength` | `140` | The longest clip, in seconds. |
| `font` | Geist, then the system font | The video's font, as a canvas font family. |
| `labels` | English | Every name and message, for other languages. |
| `overlay` | | `(ctx, frame) => void`, drawn last on every frame of the preview and the export. `frame` holds `time` and `duration` in seconds, the canvas's `width` and `height`, `unit` (one pixel of a 1080 px design at this size), `theme` and `font`. |
| `onChange` | | Called with the clip's look (`settings`) after the user changes it, at most once a frame. |

`audiogram()` returns `{ element, captions, range, settings, source, load(audio), setCaptions(cues), setRange(start, end), setOverlay(overlay), play(), pause(), export(), destroy() }`. `settings` is `{ title, speaker, handle, cover, layout, visual, theme }`, where `cover` is the picture the user opened (a `Blob`) or the address it was given, and `theme` is an index into `THEMES` or the theme itself, so a page can keep a look and start the next clip with it. `source` is the recording on show, as it was opened (a `Blob`) or given.

The parts work without the editor too. `Painter` draws any frame of a clip onto a canvas, `exportClip(scene)` makes the video, `mux(tracks)` writes an MP4 from encoded H.264 and AAC, and the captions helpers (`parseSubtitles`, `toSRT`, `toVTT`, `spread`, `paginate`, `markStart`, `clip`) take plain arrays.

## Keyboard

| Keys | |
| --- | --- |
| Space | Play or pause; while timing captions, mark the next one |
| Left, Right on a clip edge | Move it a tenth of a second; with Shift, a second |
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

- **The sound.** The recording is decoded at 48 kHz and mixed to one channel. The waveform is the lowest and highest sample of each slice; the bars are a Hann-windowed FFT of the 40 milliseconds around each frame, gathered into bands spaced the way ears hear pitch, and eased so they rise quickly and fall slowly.
- **The captions.** Without word timings, words share a line's time by how long each takes to say, with a beat after commas and full stops. Tapping a line's start moves it and the end of the line before, and stretches their words to fit.
- **The video.** Each frame is drawn to a canvas, turned into a `VideoFrame` and encoded as H.264 with a key frame every two seconds; the clip's sound is encoded as AAC. The MP4 writer puts the index before the media, so the video can start playing before it has all arrived, and interleaves sound and picture by time.
- **The fallback.** Without WebCodecs, the clip plays once into a canvas stream and a `MediaRecorder`, which makes WebM in most browsers and MP4 in Safari. X doesn't take WebM, so use Chrome, Edge or Safari for clips you mean to post there.

## What it doesn't do yet

It doesn't transcribe speech: captions come from what you type or paste, from an SRT or WebVTT file, or from your taps. It makes one speaker's card, not a card per voice. Issues and pull requests for either are welcome.

## Demo

```bash
npm install
npm run demo
```

Then open http://localhost:4330/demo/. It opens a made-up exchange read by two computer voices, with captions timed from the speech; open your own recording with the folder button, or drop it on the editor.

## Tests

```bash
npm test
```

Builds the package and tests the sound, the captions and the MP4 writer: waveform peaks and loudness, the FFT finding a tone in its own bin, the spectrum lighting the right band, meter easing, every common time format, SRT and WebVTT both ways with speakers, spreading lines, word timing, pages that keep their words' times, tapping a new start, clipping, and an MP4 read back box by box with every sample where its index says.

## License

[MIT](LICENSE). See [NOTICE](NOTICE) for the sample audio, the art and the fonts in the demo.
