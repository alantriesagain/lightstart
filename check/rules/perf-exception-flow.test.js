import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./perf-exception-flow.js";

const pkg = { pkgJson: { name: "fixture", bootstrapp: { check: { perf: { scope: ["src/"] } } } } };

test("finds a throw caught in the same function, not one a caller catches", async () => {
  const source = [
    "function a() {",
    "  try {",
    "    if (bad) throw new Error(\"x\");",
    "  } catch {}",
    "}",
    "function b() {",
    "  try {",
    "    run(() => { throw new Error(\"y\"); });",
    "  } catch {}",
    "  throw new Error(\"z\");",
    "}",
  ].join("\n");
  const findings = await runRuleOn(rule, { "src/a.js": source }, pkg);
  assert.deepEqual(findings.map((f) => f.line), [3]);
});

test("finds JSON.parse inside a try with a catch, not one outside", async () => {
  const source = ["const read = (raw) => {", "  try {", "    return JSON.parse(raw);", "  } catch {", "    return raw;", "  }", "};", "const plain = (raw) => JSON.parse(raw);"].join("\n");
  const findings = await runRuleOn(rule, { "src/a.ts": source }, pkg);
  assert.deepEqual(findings.map((f) => f.line), [3]);
  assert.match(findings[0].message, /JSON.parse/);
});
