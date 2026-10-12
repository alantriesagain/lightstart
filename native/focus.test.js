import { ATTR_INVERSE, DEFAULT_STYLE, FocusEvent, KeyEvent, MouseEvent, Renderer, TBox, TElement, TInput, TRoot, Terminal, WheelEvent, childNodes, focusables, frames, hitTest, html, layout, nextFocusable, render, scrollBoxOf } from "./index.js";
import { done, eq, eqn, ok } from "./assert.js";

class TestTerminal extends Terminal {
  constructor() {
    super();
    this.cols = 30;
    this.rows = 10;
    this.out = "";
  }

  get isTTY() {
    return true;
  }

  readSize() {}

  /** @param {string} s */
  write(s) {
    this.out += s;
  }

  enter() {}

  leave() {}
}

/** @type {string[]} */
const log = [];
const root = new TRoot();
render(html`<box border>
  <text>title</text>
  <button @click=${(/** @type {MouseEvent} */ e) => log.push("click " + e.type + " " + String(e.button))} @focus=${() => log.push("focus button")} @blur=${() => log.push("blur button")}>Press</button>
  <box scroll height=3 @wheel=${(/** @type {WheelEvent} */ e) => log.push("wheel " + String(e.delta))}>${[1, 2, 3, 4, 5, 6].map((n) => html`<text>line ${n}</text>`)}</box>
  <textarea placeholder="type" @focus=${() => log.push("focus input")}></textarea>
  <text tabindex="0" @mousedown=${(/** @type {MouseEvent} */ e) => log.push("down " + String(e.x) + "," + String(e.y))}>focusable text</text>
  <text hidden tabindex="0">hidden</text>
  <button disabled>off</button>
</box>`, root);
layout(root, 30, 10, DEFAULT_STYLE);
const outer = /** @type {TBox} */ (childNodes(root)[1]);
/** @type {TElement[]} */
const kids = [];
for (const c of childNodes(outer)) if (c instanceof TElement) kids.push(c);
const button = kids[1];
/** @type {TBox | null} */
let scroller = null;
if (kids[2] instanceof TBox) scroller = kids[2];
if (scroller === null) throw new Error("no scroller");
/** @type {TInput | null} */
let input = null;
if (kids[3] instanceof TInput) input = kids[3];
if (input === null) throw new Error("no input");
const focusText = kids[4];

eq("hit test: title text", hitTest(root, 3, 1) === kids[0] ? "text" : "?", "text");
eq("hit test: button", hitTest(root, 2, 2) === button ? "button" : "?", "button");
eq("hit test: border lands on the box", hitTest(root, 0, 0) === outer ? "outer" : "?", "outer");
eq("hit test: line inside the scroll box", (() => {
  const hit = hitTest(root, 2, 3);
  return hit !== null && hit.parent === scroller ? "line" : "?";
})(), "line");
eq("hit test: outside", hitTest(root, 50, 50) === null ? "null" : "?", "null");

const order = focusables(root, []).map((el) => el.tag);
eq("focus order skips hidden and disabled", order.join(","), "button,textarea,text");
eq("next from nothing", nextFocusable(root, null, 1) === button ? "button" : "?", "button");
eq("previous from nothing wraps to the end", nextFocusable(root, null, -1) === focusText ? "text" : "?", "text");
eq("next wraps around", nextFocusable(root, focusText, 1) === button ? "button" : "?", "button");
eq("scroll box of a line", scrollBoxOf(/** @type {TElement} */ (hitTest(root, 2, 3))) === scroller ? "scroller" : "?", "scroller");
eq("scroll box of the title", scrollBoxOf(kids[0]) === null ? "null" : "?", "null");

const term = new TestTerminal();
const renderer = new Renderer(term, root);
renderer.start();
renderer.renderFrame();
renderer.decoder.pushText("\x1b[<0;3;3M\x1b[<0;3;3m");
eq("press and release click the button and focus it", log.join("|"), "focus button|click click 0");
ok("button is focused", renderer.focus === button);
renderer.renderFrame();
ok("focused button paints inverse", (renderer.back.attrs[2 * 30 + 2] & ATTR_INVERSE) !== 0);
log.length = 0;
renderer.decoder.pushText("\x1b[<0;3;3M\x1b[<0;3;2m");
eq("release elsewhere is no click", log.join("|"), "");
renderer.decoder.pushText("\x1b[<65;3;4M");
eq("wheel reaches the handler", log.join("|"), "wheel 1");
eqn("wheel scrolls the box", scroller.scrollTop, 3);
renderer.decoder.pushText("\x1b[<64;3;4M");
eqn("wheel up scrolls back", scroller.scrollTop, 0);
log.length = 0;
renderer.decoder.pushText("\t");
eq("tab moves the focus to the input", log.join("|"), "blur button|focus input");
ok("input focused", renderer.focus === input);
renderer.decoder.pushText("hi");
eq("keys go to the focused editor", input.value(), "hi");
renderer.decoder.pushText("\t");
ok("tab again reaches the focusable text", renderer.focus === focusText);
renderer.decoder.pushText("\x1b[Z");
ok("shift+tab goes back", renderer.focus === input);
renderer.decoder.pushText("\x1b[Z");
ok("shift+tab back to the button", renderer.focus === button);
log.length = 0;
renderer.decoder.pushText("\r");
eq("enter clicks the focused button", log.join("|"), "click click 0");
log.length = 0;
renderer.decoder.pushText(" ");
eq("space clicks the focused button", log.join("|"), "click click 0");
log.length = 0;
renderer.decoder.pushText("\x1b[<0;5;8M");
eq("mousedown focuses the focusable text and reaches its handler", log.join("|"), "blur button|down 4,7");
ok("the text is focused", renderer.focus === focusText);
renderer.setFocus(null);
ok("focus cleared", renderer.focus === null);
ok("terminal wrote frames", term.out.length > 0);
ok("blur event class", new FocusEvent("blur").type === "blur");
ok("key event still decoded", new KeyEvent("enter", "", false, false, false).describe() === "enter");
frames.flush();
renderer.stop();

done();
