/* The stretch of a recording the waveform shows, as [start, end] in seconds, and how it zooms and moves. Free of the
   DOM, so it can be tested on its own. */

export type View = [number, number];

function place(start: number, width: number, duration: number): View {
  const from = Math.max(0, Math.min(duration - width, start));
  return [from, from + width];
}

/** The view a recording opens with: all of it when it is short, otherwise `span` seconds around the selection. */
export function initialView(duration: number, [start, end]: [number, number], longest = 600, span = 300): View {
  if (duration <= longest) return [0, duration];
  const width = Math.min(duration, Math.max(span, (end - start) * 1.4));
  return place((start + end) / 2 - width / 2, width, duration);
}

/** The view zoomed by `factor` (below 1 is closer) about `anchor` seconds, inside the recording and `least` seconds wide at the closest. */
export function zoomView([from, to]: View, duration: number, factor: number, anchor = (from + to) / 2, least = 10): View {
  const width = Math.min(duration, Math.max(Math.min(least, duration), (to - from) * factor));
  return place(anchor - (anchor - from) * (width / (to - from)), width, duration);
}

/** The view moved along by `delta` seconds, stopping at either end. */
export function panView([from, to]: View, duration: number, delta: number): View {
  return place(from + delta, to - from, duration);
}

/** The view moved the least it can to show `[start, end]` with a margin, and widened when the stretch doesn't fit. */
export function showSpan(view: View, duration: number, [start, end]: [number, number], margin = 0.1): View {
  const [from, to] = view;
  const width = to - from;
  const room = width * margin;
  if (end - start > width - room * 2) {
    const wider = Math.min(duration, (end - start) * 1.4);
    return place((start + end) / 2 - wider / 2, wider, duration);
  }
  if (start >= from + room && end <= to - room) return view;
  return place(end > to - room ? end + room - width : start - room, width, duration);
}

/**
 * The lowest and highest point under each of `bars` bars across the view, as min, max pairs, from an outline of
 * `rate` pairs a second. Where the outline hasn't been read yet the bars are flat.
 */
export function outlineBars(outline: Float32Array, rate: number, [from, to]: View, bars: number): Float32Array {
  const out = new Float32Array(bars * 2);
  const pairs = outline.length / 2;
  const step = (to - from) / bars;
  for (let bar = 0; bar < bars; bar++) {
    const first = Math.floor((from + bar * step) * rate);
    const last = Math.max(first + 1, Math.floor((from + (bar + 1) * step) * rate));
    let low = 0;
    let high = 0;
    for (let i = Math.max(0, first); i < Math.min(pairs, last); i++) {
      if (outline[i * 2] < low) low = outline[i * 2];
      if (outline[i * 2 + 1] > high) high = outline[i * 2 + 1];
    }
    out[bar * 2] = low;
    out[bar * 2 + 1] = high;
  }
  return out;
}
