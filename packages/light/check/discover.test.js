import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadRules, loadRulesSync, ownRuleSources } from "./discover.js";

test("loadRulesSync loads light's own rules like loadRules", async () => {
  const sync = loadRulesSync(ownRuleSources());
  const awaited = await loadRules(ownRuleSources());
  assert.deepEqual(sync.warnings, []);
  assert.deepEqual(sync.rules.map((r) => r.id), awaited.rules.map((r) => r.id));
  assert.ok(sync.rules.some((r) => r.id === "light/no-dom-member-shadowing"));
});

test("a rule module with top-level await fails to load synchronously, named like any load failure", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "light-discover-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "awaits.js");
  writeFileSync(file, 'await Promise.resolve();\nexport default { severity: "warn", description: "d", check() {} };\n');
  writeFileSync(path.join(dir, "package.json"), '{ "type": "module" }');
  const { rules, warnings } = loadRulesSync([{ owner: "fx", file }, { owner: "other", file }]);
  assert.deepEqual(rules, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^rule fx\/awaits failed to load: /);
});
