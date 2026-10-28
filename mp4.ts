/* An MP4 writer for one H.264 video track and one AAC audio track, enough for a clip that X, phones and every
   browser will play. The index (moov) comes before the media (mdat), so playback can start before the whole file
   arrives. Free of the DOM, so it can be tested on its own. */

export interface Sample {
  data: Uint8Array;
  /** In the track's timescale. */
  duration: number;
  /** A sync sample: a key frame for video; every audio sample is one. */
  key: boolean;
}

export interface VideoTrack {
  kind: "video";
  width: number;
  height: number;
  timescale: number;
  /** The encoder's avcC record, as WebCodecs hands it over in `decoderConfig.description`. */
  description: Uint8Array;
  samples: Sample[];
}

export interface AudioTrack {
  kind: "audio";
  sampleRate: number;
  channels: number;
  timescale: number;
  /** The AAC AudioSpecificConfig, as WebCodecs hands it over in `decoderConfig.description`. */
  description: Uint8Array;
  /** For the esds box; players use them only as hints. */
  bitrate?: number;
  samples: Sample[];
}

export type Track = VideoTrack | AudioTrack;

/** A track as the index needs it before its samples: what it is and how to decode it. */
export type TrackHead = Omit<VideoTrack, "samples"> | Omit<AudioTrack, "samples">;

/** What the index keeps of a sample: its size, how long it lasts, and whether a player can start at it. */
interface SampleInfo {
  size: number;
  duration: number;
  key: boolean;
}

type Indexed = TrackHead & { samples: SampleInfo[] };

const MOVIE_TIMESCALE = 1000;
const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];

class Writer {
  private buffer = new Uint8Array(1 << 16);
  private view = new DataView(this.buffer.buffer);
  length = 0;

  private ensure(extra: number) {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
    this.view = new DataView(next.buffer);
  }

  u8(value: number) {
    this.ensure(1);
    this.view.setUint8(this.length, value);
    this.length += 1;
  }

  u16(value: number) {
    this.ensure(2);
    this.view.setUint16(this.length, value);
    this.length += 2;
  }

  u24(value: number) {
    this.u8((value >>> 16) & 0xff);
    this.u16(value & 0xffff);
  }

  u32(value: number) {
    this.ensure(4);
    this.view.setUint32(this.length, value >>> 0);
    this.length += 4;
  }

  u64(value: number) {
    this.u32(Math.floor(value / 2 ** 32));
    this.u32(value % 2 ** 32);
  }

  bytes(data: Uint8Array) {
    this.ensure(data.length);
    this.buffer.set(data, this.length);
    this.length += data.length;
  }

  text(value: string) {
    for (let i = 0; i < value.length; i++) this.u8(value.charCodeAt(i) & 0xff);
  }

  zeros(count: number) {
    for (let i = 0; i < count; i++) this.u8(0);
  }

  box(type: string, body: () => void) {
    const at = this.length;
    this.u32(0);
    this.text(type);
    body();
    this.view.setUint32(at, this.length - at);
  }

  full(type: string, version: number, flags: number, body: () => void) {
    this.box(type, () => {
      this.u8(version);
      this.u24(flags);
      body();
    });
  }

  result(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}

const trackDuration = (track: Indexed) => track.samples.reduce((sum, sample) => sum + sample.duration, 0);
const movieDuration = (track: Indexed) => Math.round((trackDuration(track) / track.timescale) * MOVIE_TIMESCALE);

/** Durations as (count, delta) runs, the way the stts box stores them. */
function runs(samples: SampleInfo[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const sample of samples) {
    const last = out[out.length - 1];
    if (last && last[1] === sample.duration) last[0]++;
    else out.push([1, sample.duration]);
  }
  return out;
}

/** An MPEG-4 descriptor: a tag, its length, then its body. Descriptors nest, so each body is written into its own
 *  buffer first to learn its length. */
function descriptor(w: Writer, tag: number, body: (inner: Writer) => void) {
  const inner = new Writer();
  body(inner);
  const data = inner.result();
  w.u8(tag);
  // The length in the four-byte form every reader accepts.
  w.u8(0x80 | ((data.length >> 21) & 0x7f));
  w.u8(0x80 | ((data.length >> 14) & 0x7f));
  w.u8(0x80 | ((data.length >> 7) & 0x7f));
  w.u8(data.length & 0x7f);
  w.bytes(data);
}

function sampleEntry(w: Writer, track: TrackHead) {
  if (track.kind === "video") {
    w.box("avc1", () => {
      w.zeros(6);
      w.u16(1);
      w.zeros(16);
      w.u16(track.width);
      w.u16(track.height);
      w.u32(0x00480000);
      w.u32(0x00480000);
      w.u32(0);
      w.u16(1);
      w.zeros(32);
      w.u16(0x0018);
      w.u16(0xffff);
      w.box("avcC", () => w.bytes(track.description));
    });
    return;
  }
  w.box("mp4a", () => {
    w.zeros(6);
    w.u16(1);
    w.zeros(8);
    w.u16(track.channels);
    w.u16(16);
    w.u16(0);
    w.u16(0);
    w.u32((track.sampleRate & 0xffff) * 0x10000);
    w.full("esds", 0, 0, () => {
      descriptor(w, 0x03, (es) => {
        es.u16(1);
        es.u8(0);
        descriptor(es, 0x04, (config) => {
          config.u8(0x40);
          config.u8(0x15);
          config.u24(0);
          config.u32(track.bitrate ?? 128_000);
          config.u32(track.bitrate ?? 128_000);
          descriptor(config, 0x05, (info) => info.bytes(track.description));
        });
        descriptor(es, 0x06, (sl) => sl.u8(0x02));
      });
    });
  });
}

function trak(w: Writer, track: Indexed, id: number, offsets: number[], wide: boolean) {
  const video = track.kind === "video";
  w.box("trak", () => {
    w.full("tkhd", 0, 3, () => {
      w.u32(0);
      w.u32(0);
      w.u32(id);
      w.u32(0);
      w.u32(movieDuration(track));
      w.zeros(8);
      w.u16(0);
      w.u16(0);
      w.u16(video ? 0 : 0x0100);
      w.u16(0);
      for (const value of MATRIX) w.u32(value);
      w.u32(video ? track.width * 0x10000 : 0);
      w.u32(video ? track.height * 0x10000 : 0);
    });
    w.box("mdia", () => {
      // Past four bytes of its timescale (13 hours at 90 kHz), the duration takes eight, as version 1 allows.
      const long = trackDuration(track) > 0xffffffff;
      w.full("mdhd", long ? 1 : 0, 0, () => {
        if (long) {
          w.u64(0);
          w.u64(0);
          w.u32(track.timescale);
          w.u64(trackDuration(track));
        } else {
          w.u32(0);
          w.u32(0);
          w.u32(track.timescale);
          w.u32(trackDuration(track));
        }
        w.u16(0x55c4);
        w.u16(0);
      });
      w.full("hdlr", 0, 0, () => {
        w.u32(0);
        w.text(video ? "vide" : "soun");
        w.zeros(12);
        w.text(video ? "VideoHandler" : "SoundHandler");
        w.u8(0);
      });
      w.box("minf", () => {
        if (video) w.full("vmhd", 0, 1, () => w.zeros(8));
        else w.full("smhd", 0, 0, () => w.zeros(4));
        w.box("dinf", () => w.full("dref", 0, 0, () => {
          w.u32(1);
          w.full("url ", 0, 1, () => {});
        }));
        w.box("stbl", () => {
          w.full("stsd", 0, 0, () => {
            w.u32(1);
            sampleEntry(w, track);
          });
          const stts = runs(track.samples);
          w.full("stts", 0, 0, () => {
            w.u32(stts.length);
            for (const [count, delta] of stts) {
              w.u32(count);
              w.u32(delta);
            }
          });
          if (video) {
            const keys = track.samples.flatMap((sample, index) => (sample.key ? [index + 1] : []));
            w.full("stss", 0, 0, () => {
              w.u32(keys.length);
              for (const key of keys) w.u32(key);
            });
          }
          // One sample to a chunk: the simplest layout every reader handles.
          w.full("stsc", 0, 0, () => {
            w.u32(1);
            w.u32(1);
            w.u32(1);
            w.u32(1);
          });
          w.full("stsz", 0, 0, () => {
            w.u32(0);
            w.u32(track.samples.length);
            for (const sample of track.samples) w.u32(sample.size);
          });
          w.full(wide ? "co64" : "stco", 0, 0, () => {
            w.u32(offsets.length);
            for (const offset of offsets) (wide ? w.u64(offset) : w.u32(offset));
          });
        });
      });
    });
  });
}

/** The order samples go into the file: by time across tracks, so a player reading from the start finds sound and
 *  picture together. */
function interleave(tracks: Track[]): Array<{ track: number; sample: number }> {
  const order: Array<{ track: number; sample: number; time: number }> = [];
  tracks.forEach((track, t) => {
    let time = 0;
    track.samples.forEach((sample, s) => {
      order.push({ track: t, sample: s, time: time / track.timescale });
      time += sample.duration;
    });
  });
  return order.sort((a, b) => a.time - b.time || a.track - b.track);
}

/**
 * Everything before the media: the file type, the index, and the media box's own header, for samples laid out one
 * after another in `order`.
 */
function header(tracks: Indexed[], order: ReadonlyArray<{ track: number; sample: number }>): Uint8Array {
  const mediaSize = order.reduce((sum, item) => sum + tracks[item.track].samples[item.sample].size, 0);
  const ftyp = new Writer();
  ftyp.box("ftyp", () => {
    ftyp.text("isom");
    ftyp.u32(0x200);
    for (const brand of ["isom", "iso2", "avc1", "mp41"]) ftyp.text(brand);
  });

  const moov = (offsets: number[][], wide: boolean) => {
    const w = new Writer();
    w.box("moov", () => {
      w.full("mvhd", 0, 0, () => {
        w.u32(0);
        w.u32(0);
        w.u32(MOVIE_TIMESCALE);
        w.u32(Math.max(...tracks.map(movieDuration)));
        w.u32(0x00010000);
        w.u16(0x0100);
        w.zeros(10);
        for (const value of MATRIX) w.u32(value);
        w.zeros(24);
        w.u32(tracks.length + 1);
      });
      tracks.forEach((track, index) => trak(w, track, index + 1, offsets[index], wide));
    });
    return w.result();
  };

  // The index holds the offsets of the media that follows it, but its own size doesn't depend on their values, so
  // it is written once to measure, then again with the offsets filled in.
  const blank = tracks.map((track) => track.samples.map(() => 0));
  const wide = ftyp.length + moov(blank, true).length + 16 + mediaSize > 0xffffffff;
  const headerSize = ftyp.length + moov(blank, wide).length + (wide ? 16 : 8);
  const offsets = tracks.map((track) => track.samples.map(() => 0));
  let at = headerSize;
  for (const item of order) {
    offsets[item.track][item.sample] = at;
    at += tracks[item.track].samples[item.sample].size;
  }

  const file = new Writer();
  file.bytes(ftyp.result());
  file.bytes(moov(offsets, wide));
  if (wide) {
    file.u32(1);
    file.text("mdat");
    file.u64(mediaSize + 16);
  } else {
    file.u32(mediaSize + 8);
    file.text("mdat");
  }
  return file.result();
}

const indexed = (track: Track): Indexed => ({ ...track, samples: track.samples.map((sample) => ({ size: sample.data.length, duration: sample.duration, key: sample.key })) });

/** The bytes of an MP4 file holding `tracks`. */
export function mux(tracks: Track[]): Uint8Array {
  const order = interleave(tracks);
  const head = header(tracks.map(indexed), order);
  const file = new Writer();
  file.bytes(head);
  for (const item of order) file.bytes(tracks[item.track].samples[item.sample].data);
  return file.result();
}

/**
 * An MP4 put together as its samples are encoded, for a clip of any length: each sample's bytes go into Blobs of about
 * `batch` bytes as they come, which the browser can keep out of memory, and only their sizes are held until the end.
 * The samples sit in the file in the order they were added.
 */
export class Mp4Builder {
  private samples: SampleInfo[][] = [];
  private order: Array<{ track: number; sample: number }> = [];
  private pending: Uint8Array[] = [];
  private pendingSize = 0;
  private batches: Blob[] = [];

  constructor(private batch = 8 << 20) {}

  add(track: number, sample: Sample): void {
    const list = (this.samples[track] ??= []);
    this.order.push({ track, sample: list.length });
    list.push({ size: sample.data.length, duration: sample.duration, key: sample.key });
    this.pending.push(sample.data);
    this.pendingSize += sample.data.length;
    if (this.pendingSize >= this.batch) this.seal();
  }

  private seal() {
    if (!this.pending.length) return;
    this.batches.push(new Blob(this.pending as BlobPart[]));
    this.pending = [];
    this.pendingSize = 0;
  }

  /** The file: `tracks` described in the order their samples were numbered when added, then all of the media. */
  finish(tracks: TrackHead[], type = "video/mp4"): Blob {
    this.seal();
    const head = header(tracks.map((track, index) => ({ ...track, samples: this.samples[index] ?? [] })), this.order);
    return new Blob([head as BlobPart, ...this.batches], { type });
  }
}
