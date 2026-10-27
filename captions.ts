/* Captions as data: reading and writing SRT and WebVTT, spreading plain lines over a stretch of audio, timing each
   word, and breaking long lines into pages that fit on screen. Times are in seconds. Free of the DOM, so it can be
   tested on its own. */

export interface Word {
  text: string;
  start: number;
  end: number;
}

export interface Cue {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  /** Each word's own timing, when it is known; otherwise words share the cue's time by length. */
  words?: Word[];
}

/** "01:02:03,450", "02:03.450", "123.45" or "123" as seconds; NaN for anything else. */
export function parseTime(text: string): number {
  const match = /^\s*(?:(\d+):)?(?:(\d+):)?(\d+(?:[.,]\d+)?)\s*$/.exec(text);
  if (!match) return NaN;
  const [, a, b, c] = match;
  const seconds = Number(c.replace(",", "."));
  const hours = b !== undefined ? Number(a) : 0;
  const minutes = b !== undefined ? Number(b) : a !== undefined ? Number(a) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

const pad = (value: number, size = 2) => String(value).padStart(size, "0");

/** Seconds as "00:01:02,500" for SRT, "00:01:02.500" for WebVTT, or "1:02.5" for people. */
export function formatTime(seconds: number, kind: "srt" | "vtt" | "short" = "short"): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  if (kind === "short") return `${hours ? `${hours}:${pad(minutes)}` : minutes}:${pad(secs)}.${Math.floor(rest / 100)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${kind === "srt" ? "," : "."}${pad(rest, 3)}`;
}

/** Cues from SRT or WebVTT text. A WebVTT voice tag, <v Host>, becomes the speaker; other tags are dropped. */
export function parseSubtitles(text: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = text.replace(/\r\n?/g, "\n").replace(/^﻿/, "").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    const timing = lines.findIndex((line) => line.includes("-->"));
    if (timing < 0) continue;
    const [from, to] = lines[timing].split("-->").map((part) => part.trim().split(/\s+/)[0]);
    const start = parseTime(from);
    const end = parseTime(to);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    let speaker: string | undefined;
    const body = lines
      .slice(timing + 1)
      .join(" ")
      .replace(/<v(?:\.[^\s>]*)?\s+([^>]+)>/g, (_, name: string) => {
        speaker = name.trim();
        return "";
      })
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (body) cues.push({ start, end: Math.max(start, end), text: body, ...(speaker ? { speaker } : {}) });
  }
  return cues.sort((a, b) => a.start - b.start);
}

export function toSRT(cues: readonly Cue[]): string {
  return cues.map((cue, index) => `${index + 1}\n${formatTime(cue.start, "srt")} --> ${formatTime(cue.end, "srt")}\n${cue.text}\n`).join("\n");
}

export function toVTT(cues: readonly Cue[]): string {
  const body = cues.map((cue) => `${formatTime(cue.start, "vtt")} --> ${formatTime(cue.end, "vtt")}\n${cue.speaker ? `<v ${cue.speaker}>` : ""}${cue.text}\n`);
  return `WEBVTT\n\n${body.join("\n")}`;
}

/** How long a word takes to say, roughly: its letters, plus a beat after a comma or a full stop. */
function weight(word: string): number {
  return Math.max(2, word.replace(/[^\p{L}\p{N}]/gu, "").length) + (/[.!?]$/.test(word) ? 4 : /[,;:]$/.test(word) ? 2 : 0);
}

/** Lines of plain text spread over [start, end) in proportion to how long each takes to say, with a short pause
 *  between them. A starting point for captions that tap-timing then puts right. */
export function spread(lines: readonly string[], start: number, end: number, pause = 0.25): Cue[] {
  const texts = lines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!texts.length || end <= start) return [];
  const weights = texts.map((text) => text.split(" ").reduce((sum, word) => sum + weight(word), 0));
  const total = weights.reduce((sum, value) => sum + value, 0);
  const speaking = Math.max(0, end - start - pause * (texts.length - 1));
  let at = start;
  return texts.map((text, index) => {
    const length = (speaking * weights[index]) / total;
    const cue = { start: at, end: at + length, text };
    at += length + pause;
    return cue;
  });
}

/** Every word of a cue with its own time: as recorded when the cue carries word timings, otherwise shared out by
 *  how long each word takes to say. */
export function timeWords(cue: Cue): Word[] {
  const texts = cue.text.split(/\s+/).filter(Boolean);
  if (cue.words?.length) {
    return cue.words.map((word, index) => ({
      text: word.text,
      start: word.start,
      end: Math.max(word.start, cue.words![index + 1]?.start ?? cue.end),
    }));
  }
  const weights = texts.map(weight);
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  let at = cue.start;
  return texts.map((text, index) => {
    const length = ((cue.end - cue.start) * weights[index]) / total;
    const word = { text, start: at, end: at + length };
    at += length;
    return word;
  });
}

/** Breaks cues longer than `maxChars` into pages that fit on screen, each page keeping its words' times. */
export function paginate(cues: readonly Cue[], maxChars = 42): Cue[] {
  const out: Cue[] = [];
  for (const cue of cues) {
    if (cue.text.length <= maxChars) {
      out.push({ ...cue, words: timeWords(cue) });
      continue;
    }
    const words = timeWords(cue);
    let page: Word[] = [];
    const flush = (last: boolean) => {
      if (!page.length) return;
      out.push({ start: page[0].start, end: last ? cue.end : page[page.length - 1].end, text: page.map((word) => word.text).join(" "), speaker: cue.speaker, words: page });
      page = [];
    };
    for (const word of words) {
      const length = page.reduce((sum, item) => sum + item.text.length + 1, 0) + word.text.length;
      // Break before a word that would overflow, or after one that ends a sentence once the page is half full.
      if (page.length && length > maxChars) flush(false);
      page.push(word);
      if (/[.!?]$/.test(word.text) && length > maxChars / 2) flush(false);
    }
    flush(true);
  }
  return out.map(({ speaker, ...cue }) => (speaker ? { ...cue, speaker } : cue));
}

/** The cue on screen at `time`, by binary search over cues in time order; -1 between cues. */
export function cueAt(cues: readonly Cue[], time: number): number {
  let low = 0;
  let high = cues.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (time < cues[mid].start) high = mid - 1;
    else if (time >= cues[mid].end) low = mid + 1;
    else return mid;
  }
  return -1;
}

/**
 * Marks the moment cue `index` starts, as when someone taps along while listening. The cue before it ends there,
 * and the words of both are stretched to fit their new times.
 */
export function markStart(cues: readonly Cue[], index: number, time: number): Cue[] {
  return cues.map((cue, i) => {
    if (i === index) {
      const length = Math.max(0.3, cue.end - cue.start);
      const end = Math.max(time + 0.3, cues[i + 1] && cues[i + 1].start > time ? Math.min(cue.end, cues[i + 1].start) : time + length);
      return retime(cue, time, end);
    }
    if (i === index - 1 && cue.end > time) return retime(cue, cue.start, Math.max(cue.start + 0.1, time));
    return cue;
  });
}

function retime(cue: Cue, start: number, end: number): Cue {
  if (!cue.words?.length) return { ...cue, start, end };
  const scale = (end - start) / Math.max(1e-6, cue.end - cue.start);
  return { ...cue, start, end, words: cue.words.map((word) => ({ ...word, start: start + (word.start - cue.start) * scale, end: start + (word.end - cue.start) * scale })) };
}

/** The cues inside [from, to), cut to fit and moved so `from` is time zero: the captions for a clip. */
export function clip(cues: readonly Cue[], from: number, to: number): Cue[] {
  const out: Cue[] = [];
  for (const cue of cues) {
    if (cue.end <= from || cue.start >= to) continue;
    const words = timeWords(cue)
      .filter((word) => word.end > from && word.start < to)
      .map((word) => ({ text: word.text, start: Math.max(0, word.start - from), end: Math.min(to, word.end) - from }));
    out.push({
      ...cue,
      start: Math.max(0, cue.start - from),
      end: Math.min(to, cue.end) - from,
      text: words.length && (cue.start < from || cue.end > to) ? words.map((word) => word.text).join(" ") : cue.text,
      words,
    });
  }
  return out;
}
