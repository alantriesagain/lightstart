import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./perf-hot-allocation.js";

const pkg = { pkgJson: { name: "fixture", bootstrapp: { check: { perf: { scope: ["src/"], hot: ["src/parts.ts#Part.commit"] } } } } };

test("finds closures, copies, Promises and key arrays inside a hot function, nested functions included", async () => {
  const source = [
    "class Part {",
    "  commit(values: unknown[]) {",
    "    const copy = values.slice();",
    "    const all = Array.from(values);",
    "    const keys = Object.keys(this);",
    "    const more = [...values];",
    "    const done = new Promise((resolve) => resolve(1));",
    "    return values.map((v) => v);",
    "  }",
    "  other(values: unknown[]) {",
    "    return values.slice();",
    "  }",
    "}",
  ].join("\n");
  const findings = await runRuleOn(rule, { "src/parts.ts": source }, pkg);
  const lines = findings.map((f) => f.line);
  assert.deepEqual([...new Set(lines)], [3, 4, 5, 6, 7, 8]);
  assert.ok(!lines.includes(11), "a method the perf block does not list is not reported");
  assert.match(findings.find((f) => f.line === 7)?.message ?? "", /a Promise/);
});

test("leaves the arrow function that is the hot function itself, and reports helpers made inside it", async () => {
  const hot = { pkgJson: { name: "fixture", bootstrapp: { check: { perf: { scope: ["src/"], hot: ["src/layout.ts#measure"] } } } } };
  const source = "export const measure = (node: number) => {\n  const twice = (n: number) => n * 2;\n  return twice(node);\n};\n";
  const findings = await runRuleOn(rule, { "src/layout.ts": source }, hot);
  assert.deepEqual(findings.map((f) => f.line), [2]);
});

test("reports nothing without hot entries", async () => {
  const none = { pkgJson: { name: "fixture", bootstrapp: { check: { perf: { scope: ["src/"] } } } } };
  assert.deepEqual(await runRuleOn(rule, { "src/parts.ts": "class Part {\n  commit(v: unknown[]) {\n    return v.slice();\n  }\n}\n" }, none), []);
});
