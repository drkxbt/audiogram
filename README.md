# audiogram

Turn the recording of a Space, a podcast or a voice note into a video clip for X, TikTok, Reels, Shorts or LinkedIn, in the browser. Drag over the minute worth sharing, and it becomes a video with your picture and name, bars that move with the voice, and captions that light up word by word. Tap along to time the captions, pick a shape and colours, and export an MP4. Plain TypeScript, no dependencies; the audio never leaves the computer and there is no watermark.

Make a clip on [drk.vc](https://drk.vc/repo?id=audiogram#preview), nothing to install.

![A MacBook and an iPhone running the clip maker in Safari: on the MacBook, a sample Space plays with green bars moving to the voice and the caption lighting up word by word, then the visual changes to a wave, the colours to mint and the shape to tall, and the captions are timed by tapping the picture; on the iPhone, the clip plays in the tall shape, is shortened from its end, and changes to the pulse visual and dusk colours](demo/preview.webp)

Audiogram apps such as Headliner charge a monthly plan for unlimited clips without a watermark. This one is MIT licensed: use it in a product, change it, ship it.

- **Recordings of any length.** An MP3 or a WAV is read a stretch at a time instead of decoded whole, so a three-hour Space opens in a moment and its waveform fills in as it is read. Zoom in to pick seconds out of hours; an overview of the whole recording shows where you are.
- **Pick the moment.** The whole recording is drawn as a waveform. Drag the clip's edges, slide it along, or drag across the rest of the waveform for a new stretch. The playhead has a strip of its own above it: drag it and the picture follows. Clips stop at 2:20 by default, the most X lets a free account post, and a length Reels, Shorts, TikTok and LinkedIn all take.
- **Captions, word by word.** The word being said is marked as it is said, said words turn bright and the rest wait in grey. Long lines break into pages that fit the shape of the video.
- **Timing without a transcript service.** Paste a transcript and it is spread over the clip by how long each line takes to say; then tap the picture as each line starts and the captions snap to your taps. SRT and WebVTT files open, and the clip's captions save as SRT.
- **Named tools.** Design, Text, Photos, Music and Captions each have a labelled tab, down the left, or in a row under the timeline on a phone. One panel is open at a time, so no panel needs scrolling. Open audio and Download are at the top.
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
| `range` | the first 30 seconds | The clip to start with, `[start, end]` in seconds. |
| `title`, `speaker`, `handle`, `cover` | | What the video shows at the top. `cover` is an address or a `Blob`. |
| `background` | | A picture behind the whole clip, an address or a `Blob`. It is dimmed under the theme's colours so the words stay readable. |
| `logo` | | A brand mark, an address or a `Blob`, drawn small in the top left corner with its shape kept. Set it from code; the editor has no key for it. |
| `links` | `[]` | Up to three links, such as `"drk.vc"`, written small along the bottom of the clip. The editor has a box for each. |
| `layout` | `"square"` | `"square"`, `"portrait"` (4:5), `"story"` (9:16) or `"landscape"` (16:9). |
| `visual` | `"bars"` | `"bars"`, `"wave"` or `"pulse"`. |
| `theme` | `0` | An index into `THEMES`, or a theme of your own: `{ background, shade, text, muted, accent, onAccent }`. |
| `maxLength` | `140` | The longest clip, in seconds. |
| `font` | Geist, then the system font | The video's font, as a canvas font family. |
| `labels` | English | Every name and message, for other languages. |
| `music` | | Music under the voice, an address or a `Blob` of any audio the browser can decode. It loops, comes in over a second and leaves over a second and a half, and the mix is kept from clipping. The visual follows the voice alone. |
| `musicVolume` | `0.25` | The music's level, 0 to 1. |
| `parts` | | Stretches of the recording, `[start, end]` in seconds, played one after another as the clip; each join fades over 0.15 s. Empty means the clip is the selected stretch. |
| `onParts` | | Called with the parts after they change in the editor: added, removed or reordered. |
| `overlay` | | `(ctx, frame) => void`, drawn last on every frame of the preview and the export. `frame` holds `time` and `duration` in seconds, the canvas's `width` and `height`, `unit` (one pixel of a 1080 px design at this size), `theme` and `font`. |
| `onChange` | | Called with the clip's look (`settings`) after the user changes it, at most once a frame. |

`audiogram()` returns `{ element, captions, range, duration, parts, settings, source, slots, load(audio), readAudio(start, end, sampleRate), setParts(parts), setCaptions(cues), setRange(start, end), setOverlay(overlay), play(), pause(), export(), destroy() }`. `settings` is `{ title, speaker, handle, cover, background, logo, music, musicVolume, links, layout, visual, theme }`, where `cover`, `background` and `logo` are the pictures the user opened (a `Blob`) or the addresses they were given, and `theme` is an index into `THEMES` or the theme itself, so a page can keep a look and start the next clip with it. `source` is the recording on show, as it was opened (a `Blob`) or given. `readAudio(start, end, sampleRate)` reads one channel of the open recording at any rate, from the file as needed, so a page can work on an hour of audio without holding it all. `slots` holds three empty elements for a page's own controls: `header` after Open audio, `actions` before Download, and `captions` at the top of the Captions panel.

The parts work without the editor too. `openSource(file)` opens a recording for reading a stretch at a time, with its outline filling in as it goes, and `indexMp3(bytes)` finds every frame of an MP3. `Painter` draws any frame of a clip onto a canvas, `exportClip(scene)` makes the video, `mux(tracks)` writes an MP4 from encoded H.264 and AAC, and the captions helpers (`parseSubtitles`, `toSRT`, `toVTT`, `spread`, `paginate`, `markStart`, `clip`) take plain arrays.

## Keyboard

| Keys | |
| --- | --- |
| Space | Play or pause; while timing captions, mark the next one |
| Left, Right on a clip edge or the playhead | Move it a tenth of a second; with Shift, a second |
| Ctrl or Cmd with the wheel over the waveform | Zoom in and out about the pointer |
| Shift with the wheel, or a sideways swipe | Move along the recording |
| Arrows in the tools | Move between Design, Text, Photos, Music and Captions |
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

- **Long recordings.** An MP3's frame headers are read first, so any moment maps to the bytes that hold it; a stretch is decoded by handing the browser just those frames, with a few before them for the decoder to settle, one stretch at a time so a phone doesn't run out of memory. A WAV is read the same way with a header made for each stretch. The clip's own sound is read at 48 kHz when its edges settle.
- **The sound.** The clip's sound is mixed to one channel. The waveform is the lowest and highest sample of each slice; the bars are a Hann-windowed FFT of the 40 milliseconds around each frame, gathered into bands spaced the way ears hear pitch, and eased so they rise quickly and fall slowly.
- **The captions.** Without word timings, words share a line's time by how long each takes to say, with a beat after commas and full stops. Tapping a line's start moves it and the end of the line before, and stretches their words to fit.
- **The video.** Each frame is drawn to a canvas, turned into a `VideoFrame` and encoded as H.264 with a key frame every two seconds; the clip's sound is encoded as AAC. The MP4 writer puts the index before the media, so the video can start playing before it has all arrived, and interleaves sound and picture by time.
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
