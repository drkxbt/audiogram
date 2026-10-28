import { Mp4Builder } from "./mp4.js";
import { mixMusic } from "./mix.js";
import { Painter, SIZES, type Scene } from "./render.js";

export interface ExportOptions {
  fps?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  /** From 0 to 1 as frames are made. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /**
   * Called before each frame is painted with its time in the clip, so a moving picture such as a video can be put on
   * that frame first; `live` when the clip is played in real time to be recorded, and it should just play along.
   */
  prepare?: (time: number, live: boolean) => Promise<void> | void;
}

export interface ExportResult {
  blob: Blob;
  type: string;
  extension: "mp4" | "webm";
}

const VIDEO_CODECS = ["avc1.42E028", "avc1.4D4028", "avc1.640028"];

/** Whether this browser can make an MP4 without playing the clip in real time: H.264 and AAC through WebCodecs. */
export async function canExportMp4(width = 1080, height = 1080, sampleRate = 48000): Promise<{ video: string; audio: string } | null> {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") return null;
  let video: string | null = null;
  for (const codec of VIDEO_CODECS) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate: 4_000_000, framerate: 30, avc: { format: "avc" } });
      if (supported) {
        video = codec;
        break;
      }
    } catch {
      // A codec string this browser doesn't know; try the next.
    }
  }
  if (!video) return null;
  try {
    const { supported } = await AudioEncoder.isConfigSupported({ codec: "mp4a.40.2", sampleRate, numberOfChannels: 1, bitrate: 128_000 });
    return supported ? { video, audio: "mp4a.40.2" } : null;
  } catch {
    return null;
  }
}

/** Renders the clip and returns it as a video file: an MP4 where the browser can encode one, a WebM otherwise. */
export async function exportClip(scene: Scene, options: ExportOptions = {}): Promise<ExportResult> {
  const { width, height } = SIZES[scene.layout];
  const codecs = await canExportMp4(width, height, scene.audio.sampleRate);
  if (codecs) return encodeMp4(scene, codecs, width, height, options);
  return recordRealtime(scene, width, height, options);
}

const abortError = () => new DOMException("The export was stopped.", "AbortError");

// The clip is read, painted and encoded this many seconds at a time, so its length is bounded by the disk, not memory.
const SEGMENT = 20;
// The painter looks this far back for the wave, and a moment ahead for the bars.
const LOOK_BACK = 5;
const LOOK_AHEAD = 0.5;

type ClipReader = (from: number, to: number) => Promise<Float32Array>;

/** The clip's own sound, read by the scene's reader or from its samples, silence past the recording's ends. */
function readerOf(scene: Scene): ClipReader {
  const { samples, sampleRate, start, read } = scene.audio;
  if (read) return read;
  return async (from, to) => {
    const first = Math.round((start + from) * sampleRate);
    const out = new Float32Array(Math.max(0, Math.round((to - from) * sampleRate)));
    const lo = Math.max(0, first);
    const hi = Math.min(samples.length, first + out.length);
    if (hi > lo) out.set(samples.subarray(lo, hi), lo - first);
    return out;
  };
}

/** The clip's first and last few milliseconds softened so it doesn't click, for a stretch starting `offset` samples in. */
function softenEnds(voice: Float32Array, offset: number, total: number, sampleRate: number) {
  const fade = Math.min(total >> 1, Math.round(sampleRate * 0.012));
  for (let i = 0; i < voice.length; i++) {
    const at = offset + i;
    if (at < fade) voice[i] *= at / fade;
    const left = total - 1 - at;
    if (left < fade) voice[i] *= left / fade;
  }
}

/** One level for the whole mix, from its loudest moment, so music under a long clip never clips nor jumps in level. */
async function musicScale(scene: Scene, read: ClipReader, total: number, onStep: (fraction: number) => void, signal?: AbortSignal): Promise<number> {
  const music = scene.music;
  if (!music) return 1;
  const { sampleRate } = scene.audio;
  const step = SEGMENT * sampleRate;
  let peak = 0;
  for (let first = 0; first < total; first += step) {
    if (signal?.aborted) throw abortError();
    const last = Math.min(total, first + step);
    const voice = await read(first / sampleRate, last / sampleRate);
    softenEnds(voice, first, total, sampleRate);
    const mixed = mixMusic(voice, music.samples, sampleRate, { gain: music.gain, offset: first, length: total, scale: 1 });
    for (let i = 0; i < mixed.length; i++) peak = Math.max(peak, Math.abs(mixed[i]));
    onStep(last / total);
  }
  return peak > 0.98 ? 0.98 / peak : 1;
}

interface Segment {
  /** Its first sample in the clip. */
  first: number;
  /** What to hear: the voice, softened at the clip's ends, with any music under it. */
  sound: Float32Array<ArrayBuffer>;
  /** The scene with just enough of the voice around the segment for the painter. */
  scene: Scene;
}

/** Segment `index` of a clip `total` samples long. */
async function segmentAt(scene: Scene, read: ClipReader, index: number, total: number, scale: number): Promise<Segment> {
  const { sampleRate } = scene.audio;
  const first = index * SEGMENT * sampleRate;
  const last = Math.min(total, first + SEGMENT * sampleRate);
  const lead = LOOK_BACK * sampleRate;
  const window = await read((first - lead) / sampleRate, (last + LOOK_AHEAD * sampleRate) / sampleRate);
  const voice = window.slice(lead, lead + last - first);
  softenEnds(voice, first, total, sampleRate);
  const music = scene.music;
  const sound = music ? mixMusic(voice, music.samples, sampleRate, { gain: music.gain, offset: first, length: total, scale }) : voice;
  const begins = (first - lead) / sampleRate;
  const length = scene.audio.end - scene.audio.start;
  return { first, sound, scene: { ...scene, audio: { ...scene.audio, samples: window, start: -begins, end: length - begins } } };
}

async function encodeMp4(scene: Scene, codecs: { video: string; audio: string }, width: number, height: number, options: ExportOptions): Promise<ExportResult> {
  const fps = options.fps ?? 30;
  const painter = new Painter(scene);
  const frames = Math.max(1, Math.round(painter.duration * fps));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const sampleRate = scene.audio.sampleRate;
  const total = Math.round(painter.duration * sampleRate);
  const read = readerOf(scene);

  const builder = new Mp4Builder();
  let videoDescription: Uint8Array | null = null;
  let audioDescription: Uint8Array | null = null;
  let failure: unknown = null;
  const copy = (chunk: EncodedVideoChunk | EncodedAudioChunk) => {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    return data;
  };
  const description = (value: AllowSharedBufferSource | undefined) => {
    if (!value) return null;
    return (ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value)).slice();
  };

  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => {
      videoDescription ??= description(metadata?.decoderConfig?.description);
      builder.add(0, { data: copy(chunk), duration: Math.round(90000 / fps), key: chunk.type === "key" });
    },
    error: (error) => (failure = error),
  });
  videoEncoder.configure({ codec: codecs.video, width, height, bitrate: options.videoBitrate ?? 5_000_000, framerate: fps, avc: { format: "avc" } });

  const audioEncoder = new AudioEncoder({
    output: (chunk, metadata) => {
      audioDescription ??= description(metadata?.decoderConfig?.description);
      builder.add(1, { data: copy(chunk), duration: Math.round(((chunk.duration ?? 0) * sampleRate) / 1e6) || 1024, key: true });
    },
    error: (error) => (failure = error),
  });
  audioEncoder.configure({ codec: codecs.audio, sampleRate, numberOfChannels: 1, bitrate: options.audioBitrate ?? 128_000 });

  // Measuring the music's level is a quick pass over the sound alone; the frames are the rest of the work.
  const lead = scene.music ? 0.03 : 0;
  try {
    const scale = await musicScale(scene, read, total, (fraction) => options.onProgress?.(fraction * lead), options.signal);
    const perSegment = SEGMENT * fps;
    painter.reset();
    for (let index = 0; index * perSegment < frames; index++) {
      if (options.signal?.aborted) throw abortError();
      const segment = await segmentAt(scene, read, index, total, scale);
      painter.scene = segment.scene;
      // The segment's sound first: it is quick, and its frames are independent of the picture's.
      const block = 4096;
      for (let at = 0; at < segment.sound.length; at += block) {
        const data = segment.sound.subarray(at, Math.min(segment.sound.length, at + block));
        const timestamp = Math.round(((segment.first + at) / sampleRate) * 1e6);
        const audioData = new AudioData({ format: "f32-planar", sampleRate, numberOfFrames: data.length, numberOfChannels: 1, timestamp, data });
        audioEncoder.encode(audioData);
        audioData.close();
      }

      for (let i = index * perSegment; i < Math.min(frames, (index + 1) * perSegment); i++) {
        if (options.signal?.aborted) throw abortError();
        if (failure) throw failure;
        await options.prepare?.(i / fps, false);
        painter.paint(ctx, i / fps);
        const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
        // A key frame every two seconds, so a player can start anywhere without decoding from the top.
        videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();
        // Let the encoder catch up, and the page breathe, rather than queueing every frame at once.
        while (videoEncoder.encodeQueueSize > 6) await new Promise((resolve) => setTimeout(resolve, 0));
        if (i % 10 === 0) {
          options.onProgress?.(lead + (1 - lead) * (i / frames));
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    }
    await Promise.all([videoEncoder.flush(), audioEncoder.flush()]);
    if (failure) throw failure;
  } finally {
    if (videoEncoder.state !== "closed") videoEncoder.close();
    if (audioEncoder.state !== "closed") audioEncoder.close();
  }
  if (!videoDescription || !audioDescription) throw new Error("The encoder gave no codec description.");
  options.onProgress?.(1);
  const blob = builder.finish([
    { kind: "video", width, height, timescale: 90000, description: videoDescription },
    { kind: "audio", sampleRate, channels: 1, timescale: sampleRate, description: audioDescription, bitrate: options.audioBitrate ?? 128_000 },
  ]);
  return { blob, type: "video/mp4", extension: "mp4" };
}

/**
 * Where WebCodecs can't make an MP4: play the clip once, drawing as it goes, and record the canvas and the sound. Each
 * segment's sound is read while the one before it plays, and starts on the beat it ends.
 */
async function recordRealtime(scene: Scene, width: number, height: number, options: ExportOptions): Promise<ExportResult> {
  const fps = options.fps ?? 30;
  const painter = new Painter(scene);
  const duration = painter.duration;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const sampleRate = scene.audio.sampleRate;
  const total = Math.round(duration * sampleRate);
  const count = Math.max(1, Math.ceil(duration / SEGMENT));
  const read = readerOf(scene);
  const lead = scene.music ? 0.03 : 0;
  const scale = await musicScale(scene, read, total, (fraction) => options.onProgress?.(fraction * lead), options.signal);
  const audio = new AudioContext({ sampleRate });
  const destination = audio.createMediaStreamDestination();
  const stream = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...destination.stream.getAudioTracks()]);
  const type = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: options.videoBitrate ?? 5_000_000 });
  const parts: Blob[] = [];
  recorder.ondataavailable = (event) => parts.push(event.data);
  const stopped = new Promise((resolve) => (recorder.onstop = resolve));

  const ready = new Map<number, Scene>();
  const asked = new Set<number>();
  // Only the segments still to play are held; each lets go of its sound when it ends.
  const players = new Set<AudioBufferSourceNode>();
  let startedAt = 0;
  let over = false;
  let failure: unknown = null;
  const play = (index: number, segment: Segment) => {
    const buffer = audio.createBuffer(1, Math.max(1, segment.sound.length), sampleRate);
    buffer.copyToChannel(segment.sound, 0);
    const player = audio.createBufferSource();
    player.buffer = buffer;
    player.connect(destination);
    const when = startedAt + segment.first / sampleRate;
    // A segment read late joins where the clip has got to.
    if (when >= audio.currentTime) player.start(when);
    else player.start(0, audio.currentTime - when);
    players.add(player);
    player.onended = () => {
      players.delete(player);
      player.disconnect();
      ready.delete(index - 1);
      // The segment after next is read as this one ends, so the reading stays ahead even in a hidden tab, where
      // frames stop but the sound plays on.
      prepare(index + 2);
    };
  };
  const prepare = (index: number) => {
    if (index >= count || asked.has(index)) return;
    asked.add(index);
    segmentAt(scene, read, index, total, scale).then((segment) => {
      if (over) return;
      ready.set(index, segment.scene);
      play(index, segment);
    }, (error) => (failure ??= error));
  };

  const opening = await segmentAt(scene, read, 0, total, scale);
  asked.add(0);
  ready.set(0, opening.scene);
  painter.scene = opening.scene;
  painter.reset();
  painter.paint(ctx, 0);
  recorder.start(250);
  startedAt = audio.currentTime + 0.05;
  play(0, opening);
  prepare(1);
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (options.signal?.aborted) return reject(abortError());
      if (failure) return reject(failure);
      const time = Math.max(0, audio.currentTime - startedAt);
      const index = Math.min(count - 1, Math.floor(time / SEGMENT));
      const shown = ready.get(index);
      if (shown && painter.scene !== shown) painter.scene = shown;
      ready.delete(index - 1);
      // Back from a hidden tab, anything the ended segments didn't ask for is read now.
      prepare(index);
      prepare(index + 1);
      void options.prepare?.(time, true);
      painter.paint(ctx, Math.min(time, duration));
      options.onProgress?.(lead + (1 - lead) * Math.min(1, time / duration));
      if (time >= duration) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }).finally(() => {
    over = true;
    for (const player of players) player.stop();
    recorder.stop();
  });
  await stopped;
  await audio.close();
  const mime = type.split(";")[0] || "video/webm";
  return { blob: new Blob(parts, { type: mime }), type: mime, extension: mime === "video/mp4" ? "mp4" : "webm" };
}
