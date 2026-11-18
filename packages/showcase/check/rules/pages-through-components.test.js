import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./pages-through-components.js";

const showcase = JSON.stringify({ name: "@lightstart/showcase", light: { prefix: "showcase", components: { showcase: "views/" } } });

/**
 * @param {string} tag
 * @param {string} markup
 */
const view = (tag, markup) => `import { html } from "@lightstart/light/html";
import { defineComponent } from "@lightstart/light";
export default defineComponent({ tag: "${tag}", render() { return html\`${markup}\`; } });`;

test("a page composed from lc components passes", async () => {
  const findings = await runRuleOn(rule, {
    "package.json": showcase,
    "views/component-doc.js": view("showcase-component-doc", `<lc-code-block code="x"></lc-code-block><lc-table .rows=\${[]}></lc-table><lc-kbd>K</lc-kbd>`),
  });
  assert.deepEqual(findings, []);
});

test("a raw block lc already has a component for is reported with that tag", async () => {
  const findings = await runRuleOn(rule, {
    "package.json": showcase,
    "views/catalogue.js": view("showcase-catalogue", `<pre><code>x</code></pre><table><tr><td>1</td></tr></table><kbd>K</kbd><details><summary>More</summary></details><dialog></dialog>`),
  });
  assert.deepEqual(findings.map((f) => f.message.match(/<lc-[a-z-]+>/)?.[0]), ["<lc-code-block>", "<lc-table>", "<lc-kbd>", "<lc-accordion>", "<lc-modal>"]);
  assert.ok(findings.every((f) => f.file === "views/catalogue.js"));
});

test("only the documentation pages are held to it, not the tools beside them", async () => {
  const findings = await runRuleOn(rule, {
    "package.json": showcase,
    "views/component-doc.js": view("showcase-component-doc", `<table></table>`),
    "views/theme-editor.js": view("showcase-theme-editor", `<details></details>`),
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, "views/component-doc.js");
});
