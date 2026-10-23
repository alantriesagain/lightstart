import assert from "node:assert/strict";
import test from "node:test";
import { runRules, runRulesSync } from "./engine.js";
import { contextFromFiles } from "./test-utils.js";

/** @param {string} id @param {import("./types.ts").CheckRule} rule */
const entry = (id, rule) => ({ id, owner: id.split("/")[0], file: `${id}.js`, rule });

const fires = entry("fake/always-fires", {
  severity: "warn",
  description: "always fires once",
  check(ctx) {
    ctx.report({ file: "package.json", line: 1, col: 1, message: "hello from fake rule" });
  },
});
const errorRule = entry("fake/error-rule", {
  severity: "error",
  description: "error-severity rule",
  check(ctx) {
    ctx.report({ file: "package.json", offset: 3, message: "boom" });
  },
});
const tailwindOnly = entry("fake/tailwind-only", {
  severity: "warn",
  description: "tailwind-only rule",
  appliesTo: { styling: "tailwind" },
  check(ctx) {
    ctx.report({ file: "package.json", line: 1, col: 1, message: "tailwind fired" });
  },
});
const needsDep = entry("fake/needs-dep", {
  severity: "warn",
  description: "needs the ui package",
  appliesTo: { dep: "ui" },
  check(ctx) {
    ctx.report({ file: "package.json", line: 1, col: 1, message: "ui fired" });
  },
});
const throwingGate = entry("fake/throwing-gate", {
  severity: "warn",
  description: "gate throws",
  appliesTo: { when: () => { throw new Error("gate exploded"); } },
  check(ctx) {
    ctx.report({ file: "package.json", line: 1, col: 1, message: "should not run" });
  },
});
const crashing = entry("fake/crashing", {
  severity: "warn",
  description: "crashes",
  check() {
    throw new Error("kaboom");
  },
});
const rules = [fires, errorRule, tailwindOnly, needsDep, throwingGate, crashing];

test("runRules gates, reports, resolves offsets and survives a crashing rule", async () => {
  const context = contextFromFiles({ "views/a.js": "" }, { pkgJson: { name: "my-proj" } });
  const result = await runRules({ context, rules });
  assert.deepEqual(result.rules.map((r) => [r.id, r.status, r.reason ?? null]), [
    ["fake/always-fires", "active", null],
    ["fake/error-rule", "active", null],
    ["fake/tailwind-only", "n/a", "tailwind-only"],
    ["fake/needs-dep", "n/a", "needs @bootstrapp/ui"],
    ["fake/throwing-gate", "n/a", "when() threw"],
    ["fake/crashing", "active", null],
  ]);
  assert.ok(result.configWarnings.some((w) => w.includes("fake/throwing-gate") && w.includes("gate exploded")));
  assert.ok(result.configWarnings.some((w) => w.includes("fake/crashing crashed: kaboom")));
  assert.deepEqual(result.findings.map((f) => [f.ruleId, f.severity, f.line, f.col]), [["fake/always-fires", "warn", 1, 1], ["fake/error-rule", "error", 1, 4]]);
  assert.deepEqual([result.stats.errors, result.stats.warnings, result.stats.rules, result.stats.files], [1, 1, 3, 2]);
});

test("a dependency or the styling engine opens a gated rule", async () => {
  const context = contextFromFiles({}, { pkgJson: { name: "my-proj", dependencies: { "@bootstrapp/ui": "^1" } }, host: { styling: "tailwind" } });
  const result = await runRules({ context, rules: [tailwindOnly, needsDep] });
  assert.deepEqual(result.findings.map((f) => f.message), ["tailwind fired", "ui fired"]);
});

test("severity overrides apply; an unknown id or level warns", async () => {
  const context = contextFromFiles({}, { pkgJson: { name: "my-proj", bootstrapp: { check: { rules: { "fake/always-fires": "off", "fake/error-rule": "warn", "fake/tyop": "off", "fake/crashing": "loud" } } } } });
  const result = await runRules({ context, rules });
  assert.equal(result.rules.find((r) => r.id === "fake/always-fires").status, "off");
  assert.ok(!result.findings.some((f) => f.ruleId === "fake/always-fires"));
  assert.equal(result.findings.find((f) => f.ruleId === "fake/error-rule").severity, "warn");
  assert.equal(result.stats.errors, 0);
  assert.ok(result.configWarnings.some((w) => w.includes('"fake/tyop"') && w.includes("typo")));
  assert.ok(result.configWarnings.some((w) => w.includes('invalid level "loud"')));
});

test("an override for a rule of an owner this run did not load is not a typo", async () => {
  const context = contextFromFiles({}, { pkgJson: { name: "my-proj", bootstrapp: { check: { rules: { "view/no-raw-localstorage": "off" } } } } });
  const result = await runRules({ context, rules: [fires] });
  assert.deepEqual(result.configWarnings, []);
});

test("a rule filter runs only that rule, even when overridden off, and names an unknown id", async () => {
  const context = contextFromFiles({}, { pkgJson: { name: "my-proj", bootstrapp: { check: { rules: { "fake/always-fires": "off" } } } } });
  const result = await runRules({ context, rules, ruleFilter: "fake/always-fires" });
  assert.deepEqual(result.findings.map((f) => f.ruleId), ["fake/always-fires"]);
  assert.deepEqual(result.rules.filter((r) => r.status === "active").map((r) => r.id), ["fake/always-fires"]);
  assert.equal(result.rules.find((r) => r.id === "fake/error-rule").reason, "filtered");
  const unknown = await runRules({ context, rules, ruleFilter: "fake/nope" });
  assert.ok(unknown.configWarnings.includes('unknown rule id "fake/nope"'));
});

test("runRulesSync answers what runRules answers for synchronous rules", async () => {
  const context = contextFromFiles({ "views/a.js": "" }, { pkgJson: { name: "my-proj" } });
  const sync = runRulesSync({ context, rules });
  const awaited = await runRules({ context, rules });
  assert.deepEqual({ ...sync, stats: { ...sync.stats, durationMs: 0 } }, { ...awaited, stats: { ...awaited.stats, durationMs: 0 } });
});

test("runRulesSync skips a rule whose check is asynchronous, findings and all", () => {
  const late = entry("fake/late", {
    severity: "warn",
    description: "reports after an await",
    async check(ctx) {
      ctx.report({ file: "package.json", line: 1, col: 1, message: "before" });
      await Promise.resolve();
      ctx.report({ file: "package.json", line: 1, col: 1, message: "after" });
    },
  });
  const result = runRulesSync({ context: contextFromFiles({}), rules: [late, fires] });
  assert.deepEqual(result.findings.map((f) => f.ruleId), ["fake/always-fires"]);
  assert.ok(result.configWarnings.includes("rule fake/late is asynchronous and was skipped (synchronous run)"));
});
