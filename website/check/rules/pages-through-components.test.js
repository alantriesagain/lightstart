import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@bootstrapp/check/test-utils.js";
import rule from "./pages-through-components.js";

const site = JSON.stringify({ name: "lc", dependencies: { "@lightstart/light": "workspace:*" } });

const view = (markup) => `import { html } from "@lightstart/light/html";
import { defineComponent } from "@lightstart/light";
export default defineComponent({ tag: "docs-page", render() { return html\`${markup}\`; } });`;

test("a page composed from lc components passes", async () => {
  const findings = await runRuleOn(rule, {
    "package.json": site,
    "views/page.js": view(`<lc-code-block code="x"></lc-code-block><lc-table .rows=\${[]}></lc-table>`),
  });
  assert.deepEqual(findings, []);
});

test("a raw block is reported against the view with the lc tag to render", async () => {
  const findings = await runRuleOn(rule, {
    "package.json": site,
    "views/page.js": view(`<table><tr><td>1</td></tr></table>`),
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, "views/page.js");
  assert.match(findings[0].message, /<lc-table>/);
});
