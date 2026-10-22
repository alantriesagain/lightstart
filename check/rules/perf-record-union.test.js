import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./perf-record-union.js";

const pkg = { pkgJson: { name: "fixture", bootstrapp: { check: { perf: { scope: ["src/"], native: ["src/"] } } } } };

test("finds a union of records told apart by a string tag, members inline or aliased in the file", async () => {
  const source = [
    "export type Element = { type: \"element\"; tag: string };",
    "export type State =",
    "  | { type: \"empty\" }",
    "  | { type: \"text\"; text: string }",
    "  | Element;",
  ].join("\n");
  const findings = await runRuleOn(rule, { "src/types.ts": source }, pkg);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
  assert.match(findings[0].message, /State is 3 object types told apart by `type`/);
});

test("leaves unions of plain literals, records without a shared tag, and JavaScript alone", async () => {
  const files = {
    "src/a.ts": 'export type Kind = "a" | "b";\nexport type Mixed = { a: number } | { b: string };\n',
    "src/b.js": "/** @typedef {{ type: \"a\" } | { type: \"b\" }} T */\n",
  };
  assert.deepEqual(await runRuleOn(rule, files, pkg), []);
});
