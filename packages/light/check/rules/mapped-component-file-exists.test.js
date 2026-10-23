import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./mapped-component-file-exists.js";

const on = (/** @type {object} */ components, /** @type {Record<string, string>} */ files) =>
  runRuleOn(rule, { "package.json": JSON.stringify({ name: "p", bootstrapp: { components } }), ...files });

test("an explicit entry naming a file nothing wrote is an error", async () => {
  const findings = await on({ ui: { card: "views/card.js", ghost: "views/ghost.js" } }, { "views/card.js": "" });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /components\.ui\.ghost points at "views\/ghost\.js"/);
  assert.match(findings[0].message, /<ui-ghost> 404s/);
});

test("the .ts sibling counts, since the dev server resolves .js to it", async () => {
  assert.deepEqual(await on({ ui: { card: "views/card.js" } }, { "views/card.ts": "" }), []);
});

test("a leading ./ is the same path", async () => {
  assert.deepEqual(await on({ ui: { card: "./views/card.js" } }, { "views/card.js": "" }), []);
});

test("the directory form needs a directory with files in it", async () => {
  assert.deepEqual(await on({ ui: "views/" }, { "views/card.js": "" }), []);
  const gone = await on({ cs: "extensions/drillcode/views/" }, { "views/card.js": "" });
  assert.equal(gone.length, 1);
  assert.match(gone[0].message, /a directory with no files/);
});

test("the package root as a directory is always there", async () => {
  assert.deepEqual(await on({ maps: "./" }, { "index.js": "" }), []);
});

test("the finding lands on the entry's own line in package.json", async () => {
  const [finding] = await runRuleOn(rule, {
    "package.json": '{\n  "name": "p",\n  "bootstrapp": {\n    "components": {\n      "ui": { "ghost": "views/ghost.js" }\n    }\n  }\n}\n',
  });
  assert.equal(finding.file, "package.json");
  assert.equal(finding.line, 5);
});
