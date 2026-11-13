/**
 * `<lc-markdown>` treats its content as untrusted: raw HTML shows as text and
 * a link or image keeps only an http, https, mailto or relative target. Raw
 * HTML renders when a caller sets `unsafeHtml`, and only then.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@lightstart/light";
import markdownDef from "@lightstart/components/display/markdown.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const until = async (check, ms = 4000) => {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > ms) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

/**
 * @typedef {HTMLElement & { content: string, unsafeHtml: boolean }} MarkdownElement
 */

describe("lc-markdown trusted content", () => {
  /** @type {MarkdownElement[]} */
  const mounted = [];

  /**
   * @param {string} content
   * @param {{ unsafeHtml?: boolean }} [options]
   * @returns {MarkdownElement}
   */
  const mount = (content, options = {}) => {
    const el = /** @type {MarkdownElement} */ (document.createElement("lc-markdown"));
    el.content = content;
    if (options.unsafeHtml) el.unsafeHtml = true;
    document.body.appendChild(el);
    mounted.push(el);
    return el;
  };

  before(() => define("lc-markdown", markdownDef));
  after(() => {
    for (const el of mounted) el.remove();
  });

  it("renders a block of raw HTML as text by default", async () => {
    const el = mount('<img src=x onerror="window.__pwned=1">');
    await until(() => el.textContent.includes("<img"));
    assert.equal(el.querySelector("img"), null);
    assert.match(/** @type {string} */ (el.textContent), /<img src=x onerror="window\.__pwned=1">/);
  });

  it("renders inline raw HTML as text by default", async () => {
    const el = mount('a <b onclick="x">b</b> c');
    await until(() => el.textContent.includes("<b"));
    assert.equal(el.querySelector("b"), null);
    assert.match(/** @type {string} */ (el.textContent), /<b onclick="x">b<\/b>/);
  });

  it("renders raw HTML when the caller sets unsafeHtml", async () => {
    const el = mount("<details><summary>S</summary>D</details>", { unsafeHtml: true });
    await until(() => el.querySelector("details"));
    assert.equal(el.querySelector("details summary")?.textContent, "S");
  });

  const badLinks = [
    "[x](java&#x09;script:alert(1))",
    "[x](javascript&colon;alert(1))",
    "[x](java&Tab;script:alert(1))",
    "[x](JaVaScRiPt:alert(1))",
    "[x]( javascript:alert(1))",
    "[x](vbscript:x)",
    "[x](data:text/html,<script>alert(1)</script>)",
    "<javascript:alert(1)>",
    "[x][r]\n\n[r]: javascript:alert(1)",
  ];

  for (const unsafeHtml of [false, true])
    for (const content of badLinks)
      it(`drops the target of ${JSON.stringify(content)} with unsafeHtml=${unsafeHtml}`, async () => {
        const el = mount(content, { unsafeHtml });
        await until(() => el.textContent.trim().length > 0);
        assert.equal(el.querySelectorAll("a[href]").length, 0);
        for (const link of el.querySelectorAll("a"))
          assert.doesNotMatch(link.getAttribute("href") || "", /javascript:/i);
      });

  it("keeps http, https, mailto and relative targets", async () => {
    const el = mount(
      [
        "[one](https://example.com)",
        "[two](/docs)",
        "[three](#intro)",
        "[four](mailto:a@b.c)",
        "[five](page.html?a=b:c)",
      ].join("\n\n"),
    );
    await until(() => el.querySelectorAll("a[href]").length === 5);
    assert.deepEqual(
      [...el.querySelectorAll("a[href]")].map((link) => link.getAttribute("href")),
      ["https://example.com", "/docs", "#intro", "mailto:a@b.c", "page.html?a=b:c"],
    );
  });

  it("drops an unsafe image source and keeps a safe one", async () => {
    const el = mount("![alt](javascript:alert(1))\n\n![pic](https://example.com/x.png)");
    await until(() => el.querySelector("img"));
    const images = el.querySelectorAll("img");
    assert.equal(images.length, 1);
    assert.equal(images[0].getAttribute("src"), "https://example.com/x.png");
    assert.match(/** @type {string} */ (el.textContent), /alt/);
  });

  it("escapes a wiki link's name and display", async () => {
    const el = mount('[[a"b|<i>x</i>]]');
    await until(() => el.querySelector(".wiki-link"));
    const link = el.querySelector(".wiki-link");
    assert.ok(link instanceof HTMLElement);
    assert.equal(link.dataset.name, 'a"b');
    assert.equal(link.textContent, "<i>x</i>");
    assert.equal(el.querySelector("i"), null);
  });

  it("does not read unsafeHtml from an attribute", async () => {
    const el = mount('<img src=x onerror="window.__pwned=1">');
    el.setAttribute("unsafe-html", "");
    el.setAttribute("unsafehtml", "");
    await until(() => el.textContent.includes("<img"));
    assert.equal(el.querySelector("img"), null);
  });
});
