import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./perf-declared-fields.js";

const pkg = { pkgJson: { name: "fixture", bootstrapp: { check: { perf: { scope: ["src/"] } } } } };

test("finds an instance property first assigned in a method, once per property", async () => {
  const source = [
    "class View {",
    "  declared = null;",
    "  constructor() {",
    "    this.fromConstructor = 1;",
    "  }",
    "  connected() {",
    "    this.declared = 2;",
    "    this.fromConstructor = 3;",
    "    this.late = 4;",
    "    this.late ??= 5;",
    "  }",
    "}",
  ].join("\n");
  const findings = await runRuleOn(rule, { "src/view.js": source }, pkg);
  assert.deepEqual(findings.map((f) => f.line), [9]);
  assert.match(findings[0].message, /late is added to instances after construction/);
});

test("leaves TypeScript classes alone: they declare their fields already", async () => {
  assert.deepEqual(await runRuleOn(rule, { "src/view.ts": "class View {\n  m() {\n    this.late = 1;\n  }\n}\n" }, pkg), []);
});
