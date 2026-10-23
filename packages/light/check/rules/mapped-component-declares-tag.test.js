import assert from "node:assert/strict";
import test from "node:test";
import { appliesOn, runRuleOn } from "../test-utils.js";
import rule from "./mapped-component-declares-tag.js";

const pkgJson = {
  name: "fixture",
  bootstrapp: { prefix: "fx", components: { fx: { card: "layout/card.js" } } },
};

const component = (body) => `import { defineComponent } from "@bootstrapp/light";
export default defineComponent({
${body}
  style: true,
});
`;

test("fires on a mapped component that declares no tag", async () => {
  const findings = await runRuleOn(rule, { "layout/card.js": component("") }, { pkgJson });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /listed as <fx-card> but declares no tag:/);
  assert.match(findings[0].message, /skips this file/);
});

test("fires on a mapped component whose tag disagrees with the map", async () => {
  const findings = await runRuleOn(rule, { "layout/card.js": component('  tag: "fx-panel",') }, { pkgJson });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /declares tag: "fx-panel"/);
});

test("silent when the declared tag is the one it is listed under", async () => {
  const findings = await runRuleOn(rule, { "layout/card.js": component('  tag: "fx-card",') }, { pkgJson });
  assert.equal(findings.length, 0);
});

test("silent on a map entry with no file behind it", async () => {
  const findings = await runRuleOn(rule, { "other.js": "export default {};\n" }, { pkgJson });
  assert.equal(findings.length, 0, "a URL or a stale path is a different rule's problem");
});

test("a tag in a doc comment is not a declaration", async () => {
  const source = `/**
 * @tag fx-card
 * tag: "fx-card"
 */
import { defineComponent } from "@bootstrapp/light";
export default defineComponent({ style: true });
`;
  const findings = await runRuleOn(rule, { "layout/card.js": source }, { pkgJson });
  assert.equal(findings.length, 1);
});

test("does not apply to a package with no components map", async () => {
  const reason = appliesOn(rule, { "views/a.js": "export default {};\n" }, {
    pkgJson: { name: "plain", bootstrapp: {} },
  });
  assert.ok(reason, "the gate keeps it off packages that map nothing");
});

const folderPkg = {
  name: "fixture",
  bootstrapp: { prefix: "fx", components: { fx: "views/" } },
};

test("under the folder form, a tag that disagrees with its path resolves to nothing", async () => {
  const findings = await runRuleOn(rule, { "views/diff-viewer.js": component('  tag: "fx-diff",') }, { pkgJson: folderPkg });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /<fx-diff-viewer>/);
  assert.match(findings[0].message, /never upgrades/);
});

test("under the folder form, a nested path dashes into the tag", async () => {
  const findings = await runRuleOn(rule, {
    "views/panel/head.js": component('  tag: "fx-panel-head",'),
    "views/sub/deep.js": component('  tag: "fx-deep",'),
  }, { pkgJson: folderPkg });
  assert.deepEqual(findings.map((f) => f.file), ["views/sub/deep.js"]);
});

test("a helper under views/ declares no tag and is not a component", async () => {
  const findings = await runRuleOn(rule, {
    "views/panels.js": "export const renderPanels = (ctx) => ctx;\n",
    "views/with-resize.js": "export default { props: {} };\n",
  }, { pkgJson: folderPkg });
  assert.deepEqual(findings, []);
});

test("a second prefix over a subfolder gives the file another valid tag", async () => {
  const pkg = { name: "fixture", bootstrapp: { prefix: "fx", components: { fx: "views/", template: "views/templates/" } } };
  const findings = await runRuleOn(rule, {
    "views/templates/site.js": component('  tag: "template-site",'),
    "views/templates/stray.js": component('  tag: "fx-nope",'),
  }, { pkgJson: pkg });
  assert.deepEqual(findings.map((f) => f.file), ["views/templates/stray.js"]);
  assert.match(findings[0].message, /<fx-templates-stray> or <template-stray>/);
});
