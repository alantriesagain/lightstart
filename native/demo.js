/**
 * @file A small screen to try the terminal host by hand or under a pty: a counter button, a
 * scrolling list, an editor. Build with `npx scriptc build native/demo.js -o native/probes/out/demo
 * --strip` or run with `node native/demo.js`; `--log <file>` records keys, clicks, wheel turns,
 * submits and frames. Ctrl+C quits.
 */
import { appendFileSync } from "node:fs";
import { FLUSH_AFTER, Renderer, TBox, TElement, TNode, TRoot, Terminal, View, frames, html, mount, signal } from "./index.ts";

/** @param {string} name */
const argValue = (name) => {
  const at = process.argv.indexOf(name);
  return at >= 0 && at + 1 < process.argv.length ? process.argv[at + 1] : null;
};

const logPath = argValue("--log");
const started = Date.now();
/** @param {string} line */
const log = (line) => {
  if (logPath !== null) appendFileSync(logPath, String(Date.now() - started) + " " + line + "\n");
};

class Demo extends View {
  constructor() {
    super();
    this.count = signal(0);
    /** @type {number[]} */
    this.items = [];
    for (let i = 1; i <= 40; i++) this.items.push(i);
    this.box.flex = 1;
  }

  render() {
    return html`<div flex=1 border title="light native demo">
      <p>Clicks: <b>${() => this.count.value}</b>. Click the button, turn the wheel over the list, Tab moves the focus, Enter activates, Ctrl+C quits.</p>
      <button @click=${() => {
        this.count.value++;
        log("click " + String(this.count.peek()));
      }}>[ Click me ]</button>
      <div flex=1 scroll border title="list" @wheel=${(/** @type {import("./index.js").WheelEvent} */ e) => log("wheel " + String(e.delta))}>${this.items.map((i) => html`<p>line ${i}</p>`)}</div>
      <textarea placeholder="type here, Enter submits" @submit=${(/** @type {import("./index.js").SubmitEvent} */ e) => log("submit " + e.value)}></textarea>
    </div>`;
  }
}

/**
 * @param {TNode} node
 * @returns {TBox | null}
 */
const findScroll = (node) => {
  if (!(node instanceof TElement)) return null;
  if (node instanceof TBox && node.scroll) return node;
  for (let c = node.firstChild; c !== null; c = c.next) {
    const found = findScroll(c);
    if (found !== null) return found;
  }
  return null;
};

const term = new Terminal();
if (!term.isTTY) {
  console.error("demo: needs an interactive terminal");
  process.exit(2);
}
const root = new TRoot();
const renderer = new Renderer(term, root);
const demo = new Demo();
mount(demo, root);
renderer.onKey = (/** @type {import("./index.js").KeyEvent} */ e) => {
  if (e.ctrl && e.key === "char" && e.text === "c") {
    renderer.stop();
    log("quit");
    process.exit(0);
  }
  log("key " + e.describe());
  return false;
};
frames.onFlush(() => {
  const list = findScroll(root);
  log("frame " + String(renderer.frameCount) + " out=" + String(renderer.lastOutBytes) + " scrollTop=" + String(list === null ? -1 : list.scrollTop) + " focus=" + (renderer.focus === null ? "none" : renderer.focus.tag));
}, FLUSH_AFTER);
renderer.start();
log("started " + String(term.cols) + "x" + String(term.rows));
