import { audiogram, formatTime } from "../dist/index.js";

const tour = new URLSearchParams(location.search).get("tour");
if (tour) document.documentElement.dataset.tour = tour;

const sample = await (await fetch("sample/space.json")).json();
const result = document.querySelector("[data-result]");
const info = document.querySelector("[data-result-info]");
const download = document.querySelector("[data-download]");
// The result's video or picture is made once there is a result, so the page never holds an empty player.
const video = Object.assign(document.createElement("video"), { controls: true, playsInline: true });
const picture = Object.assign(document.createElement("img"), { alt: "The clip's frame at the playhead" });
let lastUrl = "";

const editor = audiogram(document.querySelector("[data-editor]"), {
  audio: "sample/space.wav",
  captions: sample.cues,
  range: [5.9, 21.4],
  title: "Shipping in public",
  speaker: "Sample host",
  handle: "@sample",
  cover: "images/cover.webp",
  layout: tour === "phone" ? "portrait" : "square",
  onExport({ blob, extension }) {
    URL.revokeObjectURL(lastUrl);
    lastUrl = URL.createObjectURL(blob);
    const shown = extension === "png" ? picture : video;
    (shown === video ? picture : video).remove();
    shown.src = lastUrl;
    if (!shown.isConnected) document.querySelector(".result-body").prepend(shown);
    const [start, end] = editor.range;
    info.textContent = extension === "png" ? `PNG · ${(blob.size / 1024).toFixed(0)} KB` : `${extension.toUpperCase()} · ${formatTime(end - start)} · ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
    download.href = lastUrl;
    download.download = `clip.${extension}`;
    result.hidden = false;
    if (!tour) result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
});

// The sample as it opens: its own captions over its own stretch.
const startOver = () => {
  editor.setCaptions(sample.cues);
  editor.setRange(5.9, 21.4);
};

if (tour) import("./tour.js").then(({ run }) => run(tour, editor, startOver));
