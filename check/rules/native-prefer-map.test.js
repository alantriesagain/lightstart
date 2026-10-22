import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./native-prefer-map.js";

const pkg = { pkgJson: { name: "fixture", bootstrapp: { check: { perf: { scope: ["src/"], native: ["src/"] } } } } };

test("finds computed-key writes, in tests and deletes on a Record dictionary in native code", async () => {
  const source = [
    "const counts: Record<string, number> = {};",
    "const table: { [key: string]: string } = {};",
    "export const add = (word: string) => {",
    "  counts[word] = (counts[word] ?? 0) + 1;",
    "  if (word in table) delete table[word];",
    '  counts["fixed"] = 1;',
    "};",
  ].join("\n");
  const findings = await runRuleOn(rule, { "src/count.ts": source }, pkg);
  assert.deepEqual(findings.map((f) => f.line), [4, 5, 5]);
  assert.match(findings[0].message, /measure both/);
});

test("leaves records handed to other code: parameters, returned, passed on or stored, but not read through Object.*", async () => {
  const source = [
    "export const entry = (record: Record<string, number>, key: string) => (key in record ? record[key] : 0);",
    "export const errorsOf = (fields: string[]) => {",
    "  const errors: Record<string, string> = {};",
    "  for (const field of fields) errors[field] = \"required\";",
    "  return errors as Readonly<Record<string, string>>;",
    "};",
    "const shared: Record<string, number> = {};",
    "register(shared);",
    "export const add = (k: string) => { shared[k] = 1; };",
    "export const local = (keys: string[]) => {",
    "  const seen: Record<string, boolean> = {};",
    "  for (const k of keys) seen[k] = true;",
    "  return Object.keys(seen).length;",
    "};",
  ].join("\n");
  const findings = await runRuleOn(rule, { "src/a.ts": source }, pkg);
  assert.deepEqual(findings.map((f) => f.line), [12]);
});

test("leaves Maps, records with known keys, and code outside the native list alone", async () => {
  const files = {
    "src/a.ts": "const counts = new Map<string, number>();\nexport const add = (w: string) => counts.set(w, 1);\nconst point: { x: number } = { x: 1 };\n",
    "other/b.ts": "const counts: Record<string, number> = {};\nexport const add = (w: string) => { counts[w] = 1; };\n",
  };
  assert.deepEqual(await runRuleOn(rule, files, pkg), []);
});
