import { mux, type Sample } from "./mp4.js";
import { mixMusic } from "./mix.js";
import { Painter, SIZES, type Scene } from "./render.js";

export interface ExportOptions {
  fps?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  /** From 0 to 1 as frames are made. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
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

/** The clip's own stretch of the recording, softened over a few milliseconds at each end so it doesn't click, with any music under it. */
function clipSamples(scene: Scene): Float32Array<ArrayBuffer> {
  const { samples, sampleRate, start, end } = scene.audio;
  const out = samples.slice(Math.max(0, Math.round(start * sampleRate)), Math.min(samples.length, Math.round(end * sampleRate)));
  const fade = Math.min(out.length >> 1, Math.round(sampleRate * 0.012));
  for (let i = 0; i < fade; i++) {
    out[i] *= i / fade;
    out[out.length - 1 - i] *= i / fade;
  }
  return scene.music ? mixMusic(out, scene.music.samples, sampleRate, { gain: scene.music.gain }) : out;
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

  const videoSamples: Sample[] = [];
  const audioSamples: Sample[] = [];
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
      videoSamples.push({ data: copy(chunk), duration: Math.round(90000 / fps), key: chunk.type === "key" });
    },
    error: (error) => (failure = error),
  });
  videoEncoder.configure({ codec: codecs.video, width, height, bitrate: options.videoBitrate ?? 5_000_000, framerate: fps, avc: { format: "avc" } });

  const audioEncoder = new AudioEncoder({
    output: (chunk, metadata) => {
      audioDescription ??= description(metadata?.decoderConfig?.description);
      audioSamples.push({ data: copy(chunk), duration: Math.round(((chunk.duration ?? 0) * sampleRate) / 1e6) || 1024, key: true });
    },
    error: (error) => (failure = error),
  });
  audioEncoder.configure({ codec: codecs.audio, sampleRate, numberOfChannels: 1, bitrate: options.audioBitrate ?? 128_000 });

  try {
    // Sound first: it is quick, and its frames are independent of the picture's.
    const samples = clipSamples(scene);
    const block = 4096;
    for (let at = 0; at < samples.length; at += block) {
      const data = samples.subarray(at, Math.min(samples.length, at + block));
      const audioData = new AudioData({ format: "f32-planar", sampleRate, numberOfFrames: data.length, numberOfChannels: 1, timestamp: Math.round((at / sampleRate) * 1e6), data });
      audioEncoder.encode(audioData);
      audioData.close();
    }

    painter.reset();
    for (let i = 0; i < frames; i++) {
      if (options.signal?.aborted) throw abortError();
      if (failure) throw failure;
      painter.paint(ctx, i / fps);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      // A key frame every two seconds, so a player can start anywhere without decoding from the top.
      videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      // Let the encoder catch up, and the page breathe, rather than queueing every frame at once.
      while (videoEncoder.encodeQueueSize > 6) await new Promise((resolve) => setTimeout(resolve, 0));
      if (i % 10 === 0) {
        options.onProgress?.(i / frames);
        await new Promise((resolve) => setTimeout(resolve, 0));
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
  const file = mux([
    { kind: "video", width, height, timescale: 90000, description: videoDescription, samples: videoSamples },
    { kind: "audio", sampleRate, channels: 1, timescale: sampleRate, description: audioDescription, bitrate: options.audioBitrate ?? 128_000, samples: audioSamples },
  ]);
  return { blob: new Blob([file as BlobPart], { type: "video/mp4" }), type: "video/mp4", extension: "mp4" };
}

/** Where WebCodecs can't make an MP4: play the clip once, drawing as it goes, and record the canvas and the sound. */
async function recordRealtime(scene: Scene, width: number, height: number, options: ExportOptions): Promise<ExportResult> {
  const fps = options.fps ?? 30;
  const painter = new Painter(scene);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const audio = new AudioContext({ sampleRate: scene.audio.sampleRate });
  const samples = clipSamples(scene);
  const buffer = audio.createBuffer(1, samples.length, scene.audio.sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const destination = audio.createMediaStreamDestination();
  source.connect(destination);
  const stream = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...destination.stream.getAudioTracks()]);
  const type = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: options.videoBitrate ?? 5_000_000 });
  const parts: Blob[] = [];
  recorder.ondataavailable = (event) => parts.push(event.data);
  const stopped = new Promise((resolve) => (recorder.onstop = resolve));

  painter.reset();
  painter.paint(ctx, 0);
  recorder.start(250);
  const startedAt = audio.currentTime;
  source.start();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (options.signal?.aborted) return reject(abortError());
      const time = audio.currentTime - startedAt;
      painter.paint(ctx, Math.min(time, painter.duration));
      options.onProgress?.(Math.min(1, time / painter.duration));
      if (time >= painter.duration) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }).finally(() => {
    source.stop();
    recorder.stop();
  });
  await stopped;
  await audio.close();
  const mime = type.split(";")[0] || "video/webm";
  return { blob: new Blob(parts, { type: mime }), type: mime, extension: mime === "video/mp4" ? "mp4" : "webm" };
}
