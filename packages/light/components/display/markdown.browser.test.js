/**
 * `<lc-markdown>` beyond rendering: every heading gets an id and the
 * component reports them, `anchors` draws a link per heading, and a fenced
 * block becomes a `<lc-code-block>`. The parser comes from the CDN, as in
 * the app.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import markdownDef from "@bootstrapp/light/components/display/markdown.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();
const until = async (check, ms = 4000) => {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > ms) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

describe("lc-markdown headings and fences", () => {
  /** @type {any} */
  let el;
  /** @type {any[]} */
  const reported = [];

  before(async () => {
    define("lc-markdown", markdownDef);
    el = document.createElement("lc-markdown");
    el.addEventListener("markdown-rendered", (e) => reported.push(e.detail.headings));
    el.content = "## Getting started\n\nText.\n\n### Getting started\n\n```javascript\nconst a = 1;\n```";
    document.body.appendChild(el);
    await until(() => el.querySelector("h2"));
  });

  after(() => el.remove());

  it("gives every heading an id, unique within the document", () => {
    assert.equal(el.querySelector("h2").id, "getting-started");
    assert.equal(el.querySelector("h3").id, "getting-started-2");
  });

  it("reports the headings it rendered", async () => {
    await until(() => reported.length > 0);
    assert.deepEqual(reported.at(-1), [
      { id: "getting-started", text: "Getting started", level: 2 },
      { id: "getting-started-2", text: "Getting started", level: 3 },
    ]);
  });

  it("turns a fence into a code block carrying the language and the code", () => {
    const block = el.querySelector("lc-code-block");
    assert.ok(block, "a code block is rendered");
    assert.equal(block.getAttribute("language"), "javascript");
    assert.equal(block.getAttribute("code"), "const a = 1;");
  });

  it("draws an anchor per heading only when asked", async () => {
    assert.equal(el.querySelector(".anchor"), null);
    el.anchors = true;
    await rendered(el);
    await until(() => el.querySelector(".anchor"));
    assert.equal(el.querySelector("h2 .anchor").getAttribute("href"), "#getting-started");
  });
});
