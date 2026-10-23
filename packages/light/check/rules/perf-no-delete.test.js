import assert from "node:assert/strict";
import test from "node:test";
import { appliesOn, runRuleOn } from "../test-utils.js";
import rule from "./perf-no-delete.js";

/** @param {Record<string, unknown>} [allow] */
const pkg = (allow = {}) => ({ pkgJson: { name: "fixture", bootstrapp: { check: { perf: { scope: ["src/"] }, allow } } } });

test("finds delete and Reflect.deleteProperty in scope, not Map.delete", async () => {
  const source = ["delete obj.a;", "delete obj[key];", "Reflect.deleteProperty(obj, key);", "map.delete(key);", "set.delete(key);"].join("\n");
  const findings = await runRuleOn(rule, { "src/a.js": source }, pkg());
  assert.deepEqual(findings.map((f) => f.line), [1, 2, 3]);
  assert.match(findings[0].message, /dictionary/);
});

test("reads only the files the perf block's scope names", async () => {
  assert.deepEqual(await runRuleOn(rule, { "other/a.js": "delete obj.a;\n" }, pkg()), []);
});

test("leaves out an allowed symbol", async () => {
  const source = "class View {\n  adopt() {\n    delete this.a;\n  }\n  other() {\n    delete this.b;\n  }\n}\n";
  const findings = await runRuleOn(rule, { "src/view.js": source }, pkg({ "light/perf-no-delete": { "src/view.js#View.adopt": "upgrade" } }));
  assert.deepEqual(findings.map((f) => f.line), [6]);
});

test("applies only to a project with a perf block", () => {
  assert.equal(appliesOn(rule, { "src/a.js": "" }, { pkgJson: { name: "fixture", bootstrapp: {} } }), "config-gated");
  assert.equal(appliesOn(rule, { "src/a.js": "" }, pkg()), null);
});
