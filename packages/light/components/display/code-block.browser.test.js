/**
 * `<lc-code-block>`: the snippet renders as plain lines until a host
 * configures a tokenizer, a configured one colours the runs, a long block
 * folds until asked, and the copy control writes the whole snippet. The
 * clipboard is stubbed: a test page has no permission to write the real one.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import buttonDef from "@bootstrapp/light/components/display/button.js";
import codeBlockDef from "@bootstrapp/light/components/display/code-block.js";
import { configureHighlight } from "@bootstrapp/light/components/utils/highlight.js";
import clipboardDef from "@bootstrapp/light/components/utility/clipboard.js";

const keywords = (code) => code.split("\n").map((line) => line.split(/(const)/).filter(Boolean).map((text) => ({ text, type: text === "const" ? "keyword" : null })));

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("lc-code-block", () => {
  /** @type {any} */
  let el;
  /** @type {string[]} */
  const written = [];
  const realClipboard = navigator.clipboard;

  before(async () => {
    define("lc-button", buttonDef);
    define("lc-clipboard", clipboardDef);
    define("lc-code-block", codeBlockDef);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text) => { written.push(text); } } });
    el = document.createElement("lc-code-block");
    el.code = '<lc-button primary size="lg">Save</lc-button>';
    document.body.appendChild(el);
    await rendered(el);
  });

  after(() => {
    el.remove();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: realClipboard });
  });

  it("shows the snippet as plain lines that read back to the same text", () => {
    const code = el.querySelector(".code-block-code");
    assert.equal(code.textContent, el.code);
    assert.equal(el.querySelector("[class^=tok-]"), null, "nothing is coloured until a tokenizer is configured");
  });

  it("colours the runs a configured tokenizer answers", async () => {
    configureHighlight({ lines: keywords });
    el.code = 'const a = "x";';
    await rendered(el);
    assert.ok(el.querySelector(".tok-keyword"), "a keyword is coloured");
    assert.equal(el.querySelector(".code-block-code").textContent, el.code);
    configureHighlight({ lines: null });
  });

  it("folds a long snippet until asked, then shows every line", async () => {
    el.code = Array.from({ length: 6 }, (_, i) => `line ${i + 1}`).join("\n");
    el.foldAt = 2;
    await rendered(el);
    assert.equal(el.querySelectorAll(".code-block-line").length, 2);
    const fold = el.querySelector(".code-block-fold");
    assert.ok(fold, "a fold control is offered");
    assert.match(fold.textContent, /6/);
    fold.click();
    await rendered(el);
    await settle();
    assert.equal(el.querySelectorAll(".code-block-line").length, 6);
    assert.equal(el.querySelector(".code-block-fold"), null);
  });

  it("numbers and marks lines when asked", async () => {
    el.lineNumbers = true;
    el.highlight = "2-3";
    await rendered(el);
    const gutters = [...el.querySelectorAll(".code-block-gutter")].map((g) => g.textContent);
    assert.deepEqual(gutters.slice(0, 3), ["1", "2", "3"]);
    assert.equal(el.querySelectorAll(".code-block-line[data-marked]").length, 2);
  });

  it("copies the whole snippet, and the control says so for a moment", async () => {
    const clipboard = el.querySelector("lc-clipboard");
    assert.ok(clipboard, "a copy control is offered");
    clipboard.timeout = 30;
    clipboard.querySelector("lc-button").click();
    await settle();
    assert.deepEqual(written, [el.code]);
    assert.equal(clipboard.copied, true);
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(clipboard.copied, false);
  });

  it("can leave the copy control out", async () => {
    el.copy = false;
    el.title = "";
    await rendered(el);
    assert.equal(el.querySelector(".code-block-header"), null);
  });
});
