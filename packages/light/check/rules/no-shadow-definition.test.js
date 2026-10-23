import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./no-shadow-definition.js";

const component = (extra = "") => `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-thing",${extra}
  render() { return html\`<div><slot></slot></div>\`; },
};
`;

test("fires on shadow: true", async () => {
  const findings = await runRuleOn(rule, { "views/thing.js": component("\n  shadow: true,") });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /`shadow:` on <fx-thing>/);
  assert.match(findings[0].message, /delete the key/);
});

test("fires on the object form too", async () => {
  const findings = await runRuleOn(rule, { "views/thing.js": component('\n  shadow: { mode: "open" },') });
  assert.equal(findings.length, 1);
});

test("fires on a css block and points at the sibling stylesheet", async () => {
  const findings = await runRuleOn(rule, { "views/thing.js": component("\n  css: `:host { display: block; }`,") });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /sibling \.css file/);
});

test("silent on a definition without either key", async () => {
  const findings = await runRuleOn(rule, { "views/thing.js": component("\n  style: true,") });
  assert.equal(findings.length, 0);
});

test("a property named shadow is not the definition key", async () => {
  const source = `import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
export default {
  tag: "fx-card",
  props: { shadow: T.string({ defaultValue: "none" }) },
  render() { return html\`<div></div>\`; },
};
`;
  const findings = await runRuleOn(rule, { "views/card.js": source });
  assert.equal(findings.length, 0);
});

test("a theme file is not a view", async () => {
  const source = `export default {
  shadow: { none: "none", sm: "0 1px 2px rgba(0,0,0,0.04)" },
};
`;
  const findings = await runRuleOn(rule, { "theme.js": source });
  assert.equal(findings.length, 0);
});
