import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./prefer-kebab-attribute.js";

const TARGET = `import T from "@bootstrapp/light/types";
export default {
  tag: "fx-toggle",
  props: { useSystemPreference: T.boolean(), size: T.string() },
  render() { return null; },
};
`;

const userOf = (markup) => `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-page",
  render() { return html\`${markup}\`; },
};
`;

test("fires on the legacy collapsed-lowercase form of a multi-word prop", async () => {
  const findings = await runRuleOn(rule, {
    "views/toggle.js": TARGET,
    "views/page.js": userOf("<fx-toggle usesystempreference></fx-toggle>"),
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /prefer the kebab form "use-system-preference"/);
});

test("silent on the kebab form, single-word props, property bindings, and data-/aria-/client: attrs", async () => {
  const findings = await runRuleOn(rule, {
    "views/toggle.js": TARGET,
    "views/page.js": userOf('<fx-toggle use-system-preference size="sm" .useSystemPreference=${true} data-test-id="x" aria-label="y" client:load></fx-toggle>'),
  });
  assert.equal(findings.length, 0);
});

test("silent on unknown tags and attributes with no matching prop", async () => {
  const findings = await runRuleOn(rule, {
    "views/toggle.js": TARGET,
    "views/page.js": userOf("<fx-toggle somerandomattr></fx-toggle><not-a-component usesystempreference></not-a-component>"),
  });
  assert.equal(findings.length, 0);
});

test("a using file with two definitions reports each binding once", async () => {
  const src = `import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
View.define("fx-a", {}, (el) => html\`<fx-target usesystem></fx-target>\`);
View.define("fx-b", {}, (el) => html\`<i></i>\`);
`;
  const findings = await runRuleOn(rule, { "views/pair.js": src, "views/target.js": 'export default { tag: "fx-target", props: { useSystem: false } };' });
  assert.equal(findings.length, 1);
});

test("a name inside an expression is not an attribute", async () => {
  const findings = await runRuleOn(rule, {
    "views/target.js": 'export default { tag: "fx-target", props: { useSystem: false } };',
    "views/page.js": 'import { html } from "@bootstrapp/light/html";\nexport default { tag: "fx-page", render() { return html`<fx-target title=${this.a ? usesystem : "b"} alt="usesystem x"></fx-target>`; } };',
  });
  assert.deepEqual(findings, []);
});
