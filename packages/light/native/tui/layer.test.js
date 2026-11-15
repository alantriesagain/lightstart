import { DEFAULT_STYLE, MouseEvent, Renderer, TBox, TElement, TRoot, childNodes, frames, html, parseColor, render } from "./index.ts";
import { done, eq, eqn, ok } from "../assert.ts";
import { TestTerminal } from "./test-terminal.ts";

const LAYER_BG = parseColor("#224466");
const RED = parseColor("#aa0000");
const BLUE = parseColor("#0000aa");
const SHADOW = parseColor("#440044");

/** @param {import("./node.ts").TElement} el */
const firstBox = (el) => {
  for (const c of childNodes(el)) if (c instanceof TBox) return c;
  throw new Error("no box");
};

/** @param {TRoot} root @param {number} w @param {number} h */
const screenOf = (root, w, h) => {
  const term = new TestTerminal();
  term.cols = w;
  term.rows = h;
  const renderer = new Renderer(term, root);
  renderer.start();
  renderer.renderFrame();
  const s = renderer.back;
  renderer.stop();
  return s;
};

/** @param {Screen} s @param {number} x @param {number} y */
const at = (s, x, y) => s.styleAt(y * s.w + x);
/** @param {Screen} s @param {number} x @param {number} y */
const glyph = (s, x, y) => s.rowText(y, x, x + 1);

{
  const root = new TRoot();
  render(html`<box>
    <text>under</text>
    <box layer layerX=3 layerY=2 width=5 height=2 bg="#224466"><text>lay</text></box>
    <text>after</text>
  </box>`, root);
  const outer = firstBox(root);
  const kids = [];
  for (const c of childNodes(outer)) if (c instanceof TElement) kids.push(c);
  const layer = kids[1];
  const after = kids[2];
  const s = screenOf(root, 12, 6);
  eq("layerX written in a template is mapped back", String(layer.layerX), "3");
  eq("layerY written in a template is mapped back", String(layer.layerY), "2");
  ok("describe shows the mapped layer props", layer.describe().includes("layerX=3") && layer.describe().includes("layerY=2"));
  eqn("layer is laid out at layerX", layer.x, 3);
  eqn("layer is laid out at layerY", layer.y, 2);
  eqn("layer width comes from the prop", layer.w, 5);
  eqn("layer height comes from the prop", layer.h, 2);
  eqn("a sibling after a layer starts where it would without it", after.y, 1);
  eq("the content before the layer is untouched", glyph(s, 0, 0), "u");
  eq("the layer paints its own glyph over the content", glyph(s, 3, 2), "l");
  eq("the layer paints its own bg over the content", String(at(s, 3, 2).bg), String(LAYER_BG));
}

{
  const root = new TRoot();
  render(html`<box><box layer layerX=100 layerY=100 width=5 height=3 bg="#224466"></box></box>`, root);
  const layer = firstBox(firstBox(root));
  const s = screenOf(root, 12, 6);
  eqn("a layer clamps left at the right edge", layer.x, 7);
  eqn("a layer clamps up at the bottom edge", layer.y, 3);
  eqn("clamping keeps the width", layer.w, 5);
  eqn("clamping keeps the height", layer.h, 3);
  eq("the clamped layer paints at its new position", String(at(s, 7, 3).bg), String(LAYER_BG));
}

{
  const root = new TRoot();
  render(html`<box><box layer layerX=4 layerY=2 width=20 height=10 bg="#224466"></box></box>`, root);
  const layer = firstBox(firstBox(root));
  screenOf(root, 12, 6);
  eqn("an oversized layer clamps to the screen width", layer.w, 12);
  eqn("an oversized layer clamps to the screen height", layer.h, 6);
  eqn("an oversized layer clamps to x zero", layer.x, 0);
  eqn("an oversized layer clamps to y zero", layer.y, 0);
}

{
  const log = [];
  const root = new TRoot();
  render(html`<box>
    <text @mousedown=${() => log.push("tree")}>visible</text>
    <box layer backdrop hidden width=10 height=2 bg="#aa0000" @mousedown=${() => log.push("hidden layer")}></box>
  </box>`, root);
  const renderer = new Renderer(new TestTerminal(), root);
  renderer.start();
  renderer.renderFrame();
  eq("a hidden layer is not painted over the tree", renderer.back.rowText(0, 0, 7), "visible");
  eq("a hidden layer leaves the tree bg", String(at(renderer.back, 0, 0).bg), String(DEFAULT_STYLE.bg));
  renderer.dispatchMouse(new MouseEvent("mousedown", 0, 0, 0, false, false, false));
  renderer.dispatchMouse(new MouseEvent("mouseup", 0, 0, 0, false, false, false));
  eq("a hidden layer is not hit", log.join("|"), "tree");
  renderer.stop();
}

{
  const log = [];
  const root = new TRoot();
  render(html`<box>
    <box layer layerX=2 layerY=1 width=10 height=3>
      <button @mousedown=${() => log.push("button down")} @click=${() => log.push("button click")}>OK</button>
    </box>
  </box>`, root);
  const renderer = new Renderer(new TestTerminal(), root);
  renderer.start();
  renderer.renderFrame();
  renderer.dispatchMouse(new MouseEvent("mousedown", 2, 1, 0, false, false, false));
  renderer.dispatchMouse(new MouseEvent("mouseup", 2, 1, 0, false, false, false));
  eq("a press inside a layer reaches the child button", log.join("|"), "button down|button click");
  renderer.stop();
}

{
  const log = [];
  const root = new TRoot();
  render(html`<box>
    <text @mousedown=${() => log.push("tree")}>tree</text>
    <box layer backdrop layerX=4 layerY=2 width=4 height=2 @mousedown=${() => log.push("layer")}></box>
  </box>`, root);
  const renderer = new Renderer(new TestTerminal(), root);
  renderer.start();
  renderer.renderFrame();
  renderer.dispatchMouse(new MouseEvent("mousedown", 0, 0, 0, false, false, false));
  eq("a backdrop layer catches a press outside it", log.join("|"), "layer");
  renderer.stop();
}

{
  const log = [];
  const root = new TRoot();
  render(html`<box>
    <text @mousedown=${() => log.push("tree")}>tree</text>
    <box layer layerX=4 layerY=2 width=4 height=2 @mousedown=${() => log.push("layer")}></box>
  </box>`, root);
  const renderer = new Renderer(new TestTerminal(), root);
  renderer.start();
  renderer.renderFrame();
  renderer.dispatchMouse(new MouseEvent("mousedown", 0, 0, 0, false, false, false));
  eq("without a backdrop a press outside a layer reaches the tree", log.join("|"), "tree");
  renderer.stop();
}

{
  const lines = ["ABCDEFGHIJ", "ABCDEFGHIJ", "ABCDEFGHIJ", "ABCDEFGHIJ", "ABCDEFGHIJ"];
  const root = new TRoot();
  render(html`<box>${lines.map((line) => html`<text>${line}</text>`)}<box layer layerX=2 layerY=1 width=4 height=3 bg="#224466" shadow="#440044"></box></box>`, root);
  const s = screenOf(root, 12, 8);
  eq("the shadow column keeps its glyph", glyph(s, 6, 2), "G");
  eq("the shadow column takes the shadow bg", String(at(s, 6, 2).bg), String(SHADOW));
  eq("the shadow row keeps its glyph", glyph(s, 3, 4), "D");
  eq("the shadow row takes the shadow bg", String(at(s, 4, 4).bg), String(SHADOW));
  eq("the corner past the layer is not shadowed", String(at(s, 6, 4).bg), String(DEFAULT_STYLE.bg));
  eq("the layer itself paints over the content", String(at(s, 2, 1).bg), String(LAYER_BG));
}

{
  const root = new TRoot();
  render(html`<box>
    <box layer layerX=1 layerY=1 width=6 height=3 bg="#aa0000"><text>first</text></box>
    <box layer layerX=4 layerY=2 width=6 height=3 bg="#0000aa"><text>second</text></box>
  </box>`, root);
  const s = screenOf(root, 14, 8);
  eq("the earlier layer shows outside the overlap", String(at(s, 1, 1).bg), String(RED));
  eq("the later layer shows outside the overlap", String(at(s, 9, 2).bg), String(BLUE));
  eq("the later overlapping layer wins the bg", String(at(s, 4, 2).bg), String(BLUE));
  eq("the later overlapping layer wins the glyph", glyph(s, 4, 2), "s");
}

frames.flush();
{
  const root = new TRoot();
  render(html`<box bg="#aa0000" width=20 height=8><box layer layerX=2 layerY=1 width=8 height=4 border borderStyle="cell" borderColor="#0000aa" bg="#224466"></box></box>`, root);
  const s = screenOf(root, 20, 8);
  eq("a layer's cell border top row glyph", glyph(s, 3, 1), "▁");
  eqn("a layer painted on its own keeps its ancestors' bg around its cell border", at(s, 3, 1).bg, RED);
  eqn("its inside keeps its own bg", at(s, 4, 2).bg, LAYER_BG);
}

done();
