/**
 * `<lc-markdown>` rendering: the block and inline shapes its own parser produces, the HTML
 * escaping that keeps text text, and a first render that needs no asynchronous load.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@lightstart/light";
import markdownDef from "@lightstart/components/display/markdown.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};

describe("lc-markdown rendering", () => {
  /** @type {HTMLElement[]} */
  const mounted = [];

  /**
   * @param {string} content
   * @param {{ unsafeHtml?: boolean, remoteImages?: boolean, idPrefix?: string }} [options]
   * @returns {Promise<HTMLElement>}
   */
  const mount = async (content, options = {}) => {
    const el = /** @type {HTMLElement & { content: string, unsafeHtml: boolean, remoteImages: boolean, idPrefix: string, $requestUpdate: () => Promise<void> | void }} */ (document.createElement("lc-markdown"));
    el.content = content;
    if (options.unsafeHtml) el.unsafeHtml = true;
    if (options.remoteImages === false) el.remoteImages = false;
    if (options.idPrefix) el.idPrefix = options.idPrefix;
    document.body.appendChild(el);
    mounted.push(el);
    await el.$requestUpdate();
    return el;
  };

  before(() => define("lc-markdown", markdownDef));
  after(() => {
    for (const el of mounted) el.remove();
  });

  it("draws a tight list without paragraphs and a loose list with them", async () => {
    const tight = await mount("- one\n- two");
    assert.equal(tight.querySelector("li p"), null);
    assert.match(tight.querySelector("li")?.textContent || "", /one/);

    const loose = await mount("- one\n\n- two");
    assert.ok(loose.querySelector("li > p"), "a blank line between items makes paragraphs");
  });

  it("starts an ordered list at its first number", async () => {
    const el = await mount("3. a\n4. b");
    assert.equal(el.querySelector("ol")?.getAttribute("start"), "3");
  });

  it("draws a task list as disabled checkboxes, checked where the source says x", async () => {
    const el = await mount("- [ ] todo\n- [x] done");
    const boxes = el.querySelectorAll("li > input[type=checkbox][disabled]");
    assert.equal(boxes.length, 2);
    assert.equal(boxes[0].hasAttribute("checked"), false);
    assert.equal(boxes[1].hasAttribute("checked"), true);
  });

  it("draws a list nested inside a quote", async () => {
    const el = await mount("> - a\n>   - b");
    assert.ok(el.querySelector("blockquote ul ul li"), "the inner list is inside the quote");
  });

  it("draws a table with headers, cells and a right-aligned column", async () => {
    const el = await mount("| Name | Count |\n| --- | ---: |\n| a | 1 |");
    assert.equal(el.querySelectorAll("th").length, 2);
    assert.equal(el.querySelectorAll("td").length, 2);
    assert.equal(el.querySelector("td[align=right]")?.textContent, "1");
  });

  it("draws strikethrough as del", async () => {
    const el = await mount("~~gone~~");
    assert.equal(el.querySelector("del")?.textContent, "gone");
  });

  it("draws a hard break as br", async () => {
    const el = await mount("a  \nb");
    assert.ok(el.querySelector("br"));
  });

  it("keeps a character reference and escapes a bare ampersand", async () => {
    const el = await mount("AT&amp;T\n\na & b");
    const paragraphs = el.querySelectorAll("p");
    assert.equal(paragraphs[0].textContent, "AT&T");
    assert.equal(paragraphs[1].textContent, "a & b");
  });

  it("shows HTML inside inline code as text", async () => {
    const el = await mount("`<b>`");
    assert.equal(el.querySelector("code")?.textContent, "<b>");
    assert.equal(el.querySelector("b"), null);
  });

  it("lets trusted HTML wrap markdown when unsafeHtml is set", async () => {
    const el = await mount("<details>\n<summary>S</summary>\n\nA *b*.\n\n</details>", { unsafeHtml: true });
    const details = el.querySelector("details");
    assert.ok(details, "the raw details element renders");
    assert.equal(details?.querySelector("summary")?.textContent, "S");
    assert.ok(details?.querySelector("p em"), "the markdown paragraph renders inside it");
  });

  it("draws an absolute image as a link when remoteImages is off", async () => {
    const el = await mount("![a](https://x.test/p.png)\n\n![](//x.test/p.png)", { remoteImages: false });
    assert.equal(el.querySelector("img"), null);
    const links = [...el.querySelectorAll("a[href]")];
    assert.equal(links.length, 2);
    assert.equal(links[0].textContent, "a");
    assert.equal(links[0].getAttribute("href"), "https://x.test/p.png");
    assert.equal(links[1].textContent, "//x.test/p.png");
    assert.equal(links[1].getAttribute("href"), "//x.test/p.png");
  });

  it("draws a relative image as an image when remoteImages is off", async () => {
    const el = await mount("![a](/local.png)", { remoteImages: false });
    assert.equal(el.querySelector("img")?.getAttribute("src"), "/local.png");
    assert.equal(el.querySelector("a[href]"), null);
  });

  it("draws no image and no link for an unsafe image when remoteImages is off", async () => {
    const el = await mount("![a](javascript:x)", { remoteImages: false });
    assert.equal(el.querySelector("img"), null);
    assert.equal(el.querySelector("a[href]"), null);
    assert.equal(el.textContent, "a");
  });

  it("draws a remote image as an image by default", async () => {
    const el = await mount("![a](https://x.test/p.png)");
    assert.equal(el.querySelector("img")?.getAttribute("src"), "https://x.test/p.png");
  });

  it("puts idPrefix before every heading id", async () => {
    const el = /** @type {HTMLElement & { content: string, anchors: boolean, idPrefix: string, $requestUpdate: () => Promise<void> | void }} */ (document.createElement("lc-markdown"));
    el.content = "## Intro";
    el.anchors = true;
    el.idPrefix = "user-content-";
    /** @type {{ headings: { id: string }[] } | null} */
    let detail = null;
    el.addEventListener("markdown-rendered", (event) => {
      detail = /** @type {CustomEvent} */ (event).detail;
    });
    document.body.appendChild(el);
    mounted.push(el);
    await el.$requestUpdate();
    assert.equal(el.querySelector("h2")?.id, "user-content-intro");
    assert.equal(el.querySelector("h2 a.anchor")?.getAttribute("href"), "#user-content-intro");
    assert.equal(detail?.headings[0]?.id, "user-content-intro");
  });

  it("re-emits markdown-rendered when idPrefix changes", async () => {
    const el = /** @type {HTMLElement & { content: string, idPrefix: string, $requestUpdate: () => Promise<void> | void }} */ (document.createElement("lc-markdown"));
    el.content = "# Intro";
    let renders = 0;
    el.addEventListener("markdown-rendered", () => {
      renders += 1;
    });
    document.body.appendChild(el);
    mounted.push(el);
    await el.$requestUpdate();
    const first = renders;
    el.idPrefix = "x-";
    await el.$requestUpdate();
    assert.ok(renders > first, "a changed prefix announces the new headings");
    assert.equal(el.querySelector("h1")?.id, "x-intro");
  });

  it("draws a fence inside a list item as a code block", async () => {
    const el = await mount("- item\n  ```js\n  x\n  ```");
    const block = el.querySelector("li lc-code-block");
    assert.ok(block, "the code block is inside the item");
    assert.equal(block?.getAttribute("language"), "js");
  });

  it("drops an unsafe link in a table cell", async () => {
    const el = await mount("| x |\n| --- |\n| [x](javascript:alert(1)) |");
    assert.equal(el.querySelector("table a[href]"), null);
    assert.equal(el.querySelector("td")?.textContent, "x");
  });

  it("draws a footnote reference as a sup link and its note in a section", async () => {
    const el = await mount("Text[^a].\n\n[^a]: A note.");
    const sup = el.querySelector("p sup a[href='#fn-1']");
    assert.equal(sup?.getAttribute("id"), "fnref-1");
    assert.equal(sup?.textContent, "1");
    const item = el.querySelector("section.footnotes li[id='fn-1']");
    assert.match(item?.textContent || "", /A note/);
    assert.equal(item?.querySelector("a[href='#fnref-1']")?.getAttribute("aria-label"), "Back to reference 1");
  });

  it("puts idPrefix before every footnote id", async () => {
    const el = await mount("Text[^a].\n\n[^a]: A note.", { idPrefix: "doc-" });
    assert.ok(el.querySelector("sup a[href='#doc-fn-1'][id='doc-fnref-1']"));
    assert.ok(el.querySelector("section.footnotes li[id='doc-fn-1'] a[href='#doc-fnref-1']"));
  });

  it("draws a bare URL as a link", async () => {
    const el = await mount("See https://example.com/a.");
    const link = el.querySelector("p a[href='https://example.com/a']");
    assert.equal(link?.textContent, "https://example.com/a");
  });

  it("draws setext headings", async () => {
    const h1 = await mount("Title\n===");
    assert.equal(h1.querySelector("h1")?.textContent, "Title");
    const h2 = await mount("Subtitle\n---");
    assert.equal(h2.querySelector("h2")?.textContent, "Subtitle");
  });

  it("draws an indented code block as lc-code-block", async () => {
    const el = await mount("    const a = 1;");
    const block = el.querySelector("lc-code-block");
    assert.equal(block?.getAttribute("code"), "const a = 1;");
    assert.equal(block?.getAttribute("language"), "");
  });

  it("renders on the first connect, synchronously", async () => {
    const el = /** @type {HTMLElement & { content: string, $requestUpdate: () => Promise<void> | void }} */ (document.createElement("lc-markdown"));
    el.content = "# First";
    document.body.appendChild(el);
    mounted.push(el);
    await el.$requestUpdate();
    assert.ok(el.querySelector("h1"), "the heading is present without waiting for a load");
  });
});
