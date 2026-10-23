import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./perf-config.js";

/** @param {Record<string, unknown>} perf @param {Record<string, unknown>} [allow] */
const pkg = (perf, allow = {}) => ({ pkgJson: { name: "fixture", bootstrapp: { check: { perf: { scope: ["src/"], ...perf }, allow } } } });

const FILES = { "src/view.js": "class View {\n  adopt() {\n    delete this.a;\n  }\n  idle() {}\n}\n" };

test("passes hot entries and allowlist entries that name real code and still cover a finding", async () => {
  const findings = await runRuleOn(rule, FILES, pkg({ hot: ["src/view.js#View.adopt"] }, { "light/perf-no-delete": { "src/view.js#View.adopt": "upgrade" } }));
  assert.deepEqual(findings, []);
});

test("reports a hot entry or allowlist key that names no file or no symbol", async () => {
  const findings = await runRuleOn(rule, FILES, pkg({ hot: ["src/view.js#View.missing", "src/gone.js#f", "src/view.js"] }, { "light/perf-no-delete": { "src/view.js#Nope.adopt": "x" } }));
  assert.equal(findings.length, 4);
  assert.match(findings.map((f) => f.message).join("\n"), /declares no View.missing[\s\S]*not a file[\s\S]*needs a symbol[\s\S]*declares no Nope.adopt/);
});

test("reports an allowlist entry without a reason, and one that no longer covers anything", async () => {
  const findings = await runRuleOn(rule, FILES, pkg({}, { "light/perf-no-delete": { "src/view.js#View.adopt": "", "src/view.js#View.idle": "fixed long ago" } }));
  assert.deepEqual(findings.map((f) => f.message), ["light/perf-no-delete allows src/view.js#View.adopt without a reason", "light/perf-no-delete allows src/view.js#View.idle, but the rule reports nothing there any more: remove the entry"]);
});
