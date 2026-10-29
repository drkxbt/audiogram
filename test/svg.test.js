import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSvg, svgSize, viewBoxOf } from "../dist/svg.js";

const SVG = "http://www.w3.org/2000/svg";

// Just enough of a DOM element for the cleaning, so it runs here without a browser.
class Node {
  constructor(name, attributes = {}, children = [], namespace = SVG) {
    this.localName = name;
    this.namespaceURI = namespace;
    this.values = new Map(Object.entries(attributes));
    this.list = [];
    this.parent = null;
    this.textContent = null;
    for (const child of children) {
      if (typeof child === "string") this.textContent = child;
      else {
        child.parent = this;
        this.list.push(child);
      }
    }
  }
  get attributes() {
    return [...this.values].map(([name, value]) => ({ name, value }));
  }
  get children() {
    return [...this.list];
  }
  getAttribute(name) {
    return this.values.get(name) ?? null;
  }
  setAttribute(name, value) {
    this.values.set(name, value);
  }
  removeAttribute(name) {
    this.values.delete(name);
  }
  remove() {
    this.parent.list = this.parent.list.filter((node) => node !== this);
  }
}
const el = (name, attributes, ...children) => new Node(name, attributes, children);
const names = (node) => node.children.map((child) => child.localName);

test("an SVG that isn't one is refused and left alone", () => {
  assert.equal(cleanSvg(new Node("html", {}, [], "http://www.w3.org/1999/xhtml")), false);
  assert.equal(cleanSvg(new Node("svg", {}, [], null)), false, "an svg outside the SVG namespace");
  assert.equal(cleanSvg(new Node("parsererror", {}, [], "http://www.w3.org/1999/xhtml")), false);
});

test("scripts, foreignObject and elements outside SVG are taken out, at any depth", () => {
  const group = el("g", {}, el("script", {}, "alert(1)"), el("path", { d: "M0 0h1" }), el("foreignObject", {}, new Node("div", {}, [], "http://www.w3.org/1999/xhtml")));
  const root = el("svg", { viewBox: "0 0 10 10" }, el("script", { href: "x.js" }), group, new Node("namedview", {}, [], "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"), el("handler", {}, "x"));
  assert.equal(cleanSvg(root), true);
  assert.deepEqual(names(root), ["g"]);
  assert.deepEqual(names(group), ["path"]);
});

test("event handlers go, in any case", () => {
  const circle = el("circle", { r: "4", onclick: "x()", ONLOAD: "y()", onmouseover: "z()" });
  const root = el("svg", { viewBox: "0 0 10 10", onload: "alert(1)" }, circle);
  cleanSvg(root);
  assert.equal(root.getAttribute("onload"), null);
  assert.deepEqual(circle.attributes.map((attribute) => attribute.name), ["r"]);
});

test("links stay inside the file: to its own parts or pictures written into it", () => {
  const own = el("use", { href: "#star" });
  const old = el("use", { "xlink:href": "#star" });
  const away = el("use", { href: "other.svg#star" });
  const page = el("a", { href: "javascript:alert(1)" });
  const remote = el("image", { "xlink:href": "https://example.com/a.png" });
  const written = el("image", { href: "data:image/png;base64,iVBORw0KGgo=" });
  const nested = el("image", { href: "data:image/svg+xml;base64,PHN2Zz4=" });
  const root = el("svg", { viewBox: "0 0 10 10" }, own, old, away, page, remote, written, nested);
  cleanSvg(root);
  assert.equal(own.getAttribute("href"), "#star");
  assert.equal(old.getAttribute("xlink:href"), "#star");
  assert.equal(away.getAttribute("href"), null);
  assert.equal(page.getAttribute("href"), null);
  assert.equal(remote.getAttribute("xlink:href"), null);
  assert.equal(written.getAttribute("href"), "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(nested.getAttribute("href"), null, "an SVG inside could not be cleaned the same way");
});

test("url() keeps references inside the file and drops the rest, in attributes, styles and style sheets", () => {
  const shape = el("rect", { fill: "url(#fade)", stroke: "url('https://example.com/x.svg#p')", style: "fill: url(#fade); filter: url( http://a.b/f.svg#blur ); opacity: .5" });
  const sheet = el("style", {}, "@import url(https://evil.example/a.css); .a { background: url(\"https://evil.example/b.png\") } .b { fill: url(#fade) }");
  const root = el("svg", { viewBox: "0 0 10 10" }, sheet, shape);
  cleanSvg(root);
  assert.equal(shape.getAttribute("fill"), "url(#fade)");
  assert.equal(shape.getAttribute("stroke"), "none");
  assert.equal(shape.getAttribute("style"), "fill: url(#fade); filter: none; opacity: .5");
  assert.doesNotMatch(sheet.textContent, /@import|evil/);
  assert.match(sheet.textContent, /url\(#fade\)/);
});

test("animations that would set a link or a handler go; others stay", () => {
  const root = el("svg", { viewBox: "0 0 10 10" }, el("set", { attributeName: "href", to: "javascript:alert(1)" }), el("animate", { attributeName: "xlink:href", values: "a;b" }), el("set", { attributeName: "onclick", to: "x()" }), el("animate", { attributeName: "opacity", values: "0;1" }));
  cleanSvg(root);
  assert.deepEqual(root.children.map((child) => child.getAttribute("attributeName")), ["opacity"]);
});

test("a cleaned SVG gets a size in pixels, and a viewBox when it had none", () => {
  const sized = el("svg", { viewBox: "0 0 24 12" });
  cleanSvg(sized);
  assert.equal(sized.getAttribute("width"), "1024");
  assert.equal(sized.getAttribute("height"), "512");
  assert.equal(sized.getAttribute("viewBox"), "0 0 24 12", "its own viewBox is kept");
  const boxless = el("svg", { width: "2in", height: "1in" });
  cleanSvg(boxless);
  assert.equal(boxless.getAttribute("width"), "192");
  assert.equal(boxless.getAttribute("height"), "96");
  assert.equal(boxless.getAttribute("viewBox"), "0 0 192 96", "the drawing scales with the picture rather than being cut off");
});

test("a size comes from the width and height when both are lengths", () => {
  assert.deepEqual(svgSize("640", "480", "0 0 10 10"), { width: 640, height: 480 });
  assert.deepEqual(svgSize("64px", "32px", null), { width: 64, height: 32 });
  assert.deepEqual(svgSize("12pt", "6pt", null), { width: 16, height: 8 });
  assert.deepEqual(svgSize("10mm", "1cm", null), { width: 38, height: 38 });
});

test("a size missing a length, or given as a share, takes the viewBox's shape", () => {
  assert.deepEqual(svgSize("200", null, "0 0 400 100"), { width: 200, height: 50 });
  assert.deepEqual(svgSize(null, "300", "0 0 400 100"), { width: 1200, height: 300 });
  assert.deepEqual(svgSize("100%", "100%", "0 0 50 100"), { width: 512, height: 1024 });
  assert.deepEqual(svgSize("auto", "", "-10 -10 20 20"), { width: 1024, height: 1024 });
});

test("a viewBox alone sets the longer side to 1024 px, up or down, its shape kept", () => {
  assert.deepEqual(svgSize(null, null, "0 0 24 24"), { width: 1024, height: 1024 });
  assert.deepEqual(svgSize(null, null, "0,0,3000,1000"), { width: 1024, height: 341 });
  assert.deepEqual(svgSize(null, null, "0 0 9 16"), { width: 576, height: 1024 });
});

test("with no size at all, or a broken one, it takes the size a browser would", () => {
  assert.deepEqual(svgSize(null, null, null), { width: 300, height: 150 });
  assert.deepEqual(svgSize("0", "-5", "0 0 0 10"), { width: 300, height: 150 });
  assert.deepEqual(svgSize("400", null, null), { width: 400, height: 150 });
  assert.deepEqual(svgSize("wide", "tall", "nonsense"), { width: 300, height: 150 });
});

test("a huge size is brought down to 8192 px on its longer side, its shape kept", () => {
  assert.deepEqual(svgSize("100000", "50000", null), { width: 8192, height: 4096 });
});

test("a viewBox is four numbers with a width and height above zero", () => {
  assert.deepEqual(viewBoxOf(" 0 0 24 12 "), { width: 24, height: 12 });
  assert.equal(viewBoxOf("0 0 24"), null);
  assert.equal(viewBoxOf("0 0 -1 4"), null);
  assert.equal(viewBoxOf(null), null);
});
