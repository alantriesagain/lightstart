/**
 * `lc-about-section` and `lc-showcase-section` hand `unsafeHtml` to the `<lc-markdown>` they
 * draw their body with, so raw HTML in the body renders only when the section is told to trust it.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@lightstart/light";
import markdownDef from "@lightstart/components/display/markdown.js";
import aboutSectionDef from "@lightstart/components/page/about-section.js";
import showcaseSectionDef from "@lightstart/components/page/showcase-section.js";

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

const body = "<details>\n<summary>S</summary>\n\nA *b*.\n\n</details>";

describe("page sections and trusted HTML", () => {
  /** @type {HTMLElement[]} */
  const mounted = [];

  /** @param {string} tag @param {boolean} [unsafeHtml] */
  const mount = async (tag, unsafeHtml = false) => {
    const el = /** @type {HTMLElement & { body: string, unsafeHtml: boolean, $requestUpdate: () => Promise<void> | void }} */ (document.createElement(tag));
    el.body = body;
    if (unsafeHtml) el.unsafeHtml = true;
    document.body.appendChild(el);
    mounted.push(el);
    await el.$requestUpdate();
    return el;
  };

  before(() => {
    define("lc-markdown", markdownDef);
    define("lc-about-section", aboutSectionDef);
    define("lc-showcase-section", showcaseSectionDef);
  });
  after(() => {
    for (const el of mounted) el.remove();
  });

  for (const tag of ["lc-about-section", "lc-showcase-section"])
    it(`${tag} renders the body's raw HTML only when unsafeHtml is set`, async () => {
      const plain = await mount(tag);
      await until(() => plain.querySelector("lc-markdown")?.textContent.includes("<details>"));
      assert.equal(plain.querySelector("details"), null);

      const trusted = await mount(tag, true);
      await until(() => trusted.querySelector("details"));
      assert.equal(trusted.querySelector("details summary")?.textContent, "S");
      assert.ok(trusted.querySelector("details p em"), "the markdown inside renders too");
    });
});
