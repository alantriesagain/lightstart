import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { dependencyRuleSources, loadRules, loadRulesSync, ownRuleSources } from "./discover.js";

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

test("a project's light dependencies and the packages its light.check.from names bring their rules", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "light-discover-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const rule = 'export default { severity: "warn", description: "d", check() {} };\n';
  /** @param {string} name @param {string | null} ruleName */
  const dependency = (name, ruleName) => {
    const at = path.join(dir, "node_modules", name);
    mkdirSync(path.join(at, "check", "rules"), { recursive: true });
    writeFileSync(path.join(at, "package.json"), JSON.stringify({ name, type: "module" }));
    if (ruleName !== null) writeFileSync(path.join(at, "check", "rules", `${ruleName}.js`), rule);
  };
  dependency("@lightstart/fake", "one");
  dependency("@lightstart/plain", null);
  dependency("named-pkg", "two");
  dependency("unnamed-pkg", "three");
  const pkg = {
    name: "app",
    dependencies: { "@lightstart/fake": "1", "@lightstart/plain": "1", "unnamed-pkg": "1", "@lightstart/missing": "1" },
    light: { check: { from: ["named-pkg"] } },
  };
  writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg));
  const { rules, warnings } = await loadRules(dependencyRuleSources(dir, pkg));
  assert.deepEqual(warnings, []);
  assert.deepEqual(rules.map((r) => r.id).sort(), ["fake/one", "named-pkg/two"], "a light dependency's rules and a named package's, not another dependency's");
});
