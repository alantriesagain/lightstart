import { ATTR_INVERSE, DEFAULT_STYLE, FocusEvent, KeyEvent, MouseEvent, Renderer, TBox, TElement, TInput, TRoot, WheelEvent, childNodes, focusables, frames, hitTest, html, layout, nextFocusable, render, scrollBoxOf } from "./index.ts";
import { done, eq, eqn, ok } from "../assert.js";
import { TestTerminal } from "./test-terminal.ts";

/** @type {string[]} */
const log = [];
const root = new TRoot();
render(html`<box border>
  <text>title</text>
  <button @click=${(/** @type {MouseEvent} */ e) => log.push("click " + e.type + " " + String(e.button))} @focus=${() => log.push("focus button")} @blur=${() => log.push("blur button")}>Press</button>
  <box scroll height=3 @wheel=${(/** @type {WheelEvent} */ e) => log.push("wheel " + String(e.delta))}>${[1, 2, 3, 4, 5, 6].map((n) => html`<text>line ${n}</text>`)}</box>
  <textarea placeholder="type" @focus=${() => log.push("focus input")}></textarea>
  <text tabindex="0" @mousedown=${(/** @type {MouseEvent} */ e) => log.push("down " + String(e.x) + "," + String(e.y))} @mousemove=${(/** @type {MouseEvent} */ e) => log.push("move " + String(e.x) + "," + String(e.y))} @mouseup=${(/** @type {MouseEvent} */ e) => log.push("up " + String(e.x) + "," + String(e.y))}>focusable text</text>
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
log.length = 0;
renderer.decoder.pushText("\x1b[<32;4;2M\x1b[<0;4;2m");
eq("while held, a drag onto the title and its release still reach the text", log.join("|"), "move 3,1|up 3,1");
log.length = 0;
renderer.decoder.pushText("\x1b[<32;5;8M");
eq("once released, a move goes where it is", log.join("|"), "move 4,7");
renderer.setFocus(null);
ok("focus cleared", renderer.focus === null);
ok("terminal wrote frames", term.out.length > 0);
ok("blur event class", new FocusEvent("blur").type === "blur");
ok("key event still decoded", new KeyEvent("enter", "", false, false, false).describe() === "enter");
frames.flush();
renderer.stop();

const autoRoot = new TRoot();
render(html`<box><button>first</button><textarea autofocus></textarea></box>`, autoRoot);
const auto = new Renderer(new TestTerminal(), autoRoot);
auto.start();
auto.renderFrame();
ok("autofocus: the marked input takes the focus on the first frame", auto.focus instanceof TInput);
auto.setFocus(null);
auto.renderFrame();
ok("autofocus: only once", auto.focus === null);
auto.stop();

const takenRoot = new TRoot();
render(html`<box><button>first</button><textarea autofocus></textarea></box>`, takenRoot);
const taken = new Renderer(new TestTerminal(), takenRoot);
const first = focusables(takenRoot, [])[0];
taken.setFocus(first);
taken.start();
taken.renderFrame();
ok("autofocus: skipped when something already has the focus", taken.focus === first);
taken.stop();

const lateRoot = new TRoot();
const late = new Renderer(new TestTerminal(), lateRoot);
late.start();
late.renderFrame();
render(html`<box><textarea autofocus></textarea></box>`, lateRoot);
late.renderFrame();
ok("autofocus: an input that appears after the first frame still takes it", late.focus instanceof TInput);
late.stop();

const markedRoot = new TRoot();
render(html`<box><textarea></textarea></box>`, markedRoot);
const marked = new Renderer(new TestTerminal(), markedRoot);
marked.start();
marked.renderFrame();
marked.renderFrame();
focusables(markedRoot, [])[0].setProp("autofocus", true);
marked.renderFrame();
ok("autofocus: an input marked after the first frames takes it", marked.focus instanceof TInput);
marked.stop();
frames.flush();

done();
