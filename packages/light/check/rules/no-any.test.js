import assert from "node:assert/strict";
import test from "node:test";
import { appliesOn, runRuleOn } from "../test-utils.js";
import rule from "./no-any.js";

/** @param {Record<string, unknown>} [check] */
const pkg = (check = { noAny: {} }) => ({ pkgJson: { name: "fixture", bootstrapp: { check } } });

test("finds any in TypeScript types, casts and generics", async () => {
  const findings = await runRuleOn(rule, { "src/a.ts": "let a: any = 1;\nconst b = a as any;\nconst c: Map<string, any> = new Map();\n" }, pkg());
  assert.deepEqual(findings.map((f) => f.line), [1, 2, 3]);
});

test("finds any in every JSDoc tag, @this and nested braces included, and the JSDoc *", async () => {
  const source = [
    "/** @type {any} */",
    "let a;",
    "class V {",
    "  /** @this {any} */",
    "  m() {}",
    "}",
    "/** @param {Record<string, { a: any }>} x */",
    "const f = (x) => x;",
    "/** @type {*} */",
    "let s;",
    "const cast = /** @type {any} */ (s);",
  ].join("\n");
  const findings = await runRuleOn(rule, { "src/a.js": source }, pkg());
  assert.deepEqual(findings.map((f) => f.line), [1, 4, 7, 9, 11]);
});

test("ignores the word any in strings, prose, names and T.any()", async () => {
  const source = ['const label = "any value";', "/** Accepts any value. */", "const any2 = T.any();", "const many = 1;"].join("\n");
  assert.deepEqual(await runRuleOn(rule, { "src/a.js": source }, pkg()), []);
});

test("finds @ts-ignore and @ts-nocheck where TypeScript reads them, not in strings or prose", async () => {
  const source = [
    "// @ts-nocheck",
    "const a = 1;",
    "// @ts-ignore",
    "const b = 2;",
    'const c = "@ts-ignore";',
    "/**",
    " * @ts-ignore",
    " */",
    "const d = 3;",
    "/** Documents `@ts-ignore` and `@ts-nocheck`. */",
    "const e = 4;",
    "/* @ts-nocheck */",
  ].join("\n");
  const findings = await runRuleOn(rule, { "src/a.ts": source }, pkg());
  assert.deepEqual(findings.map((f) => f.line), [1, 3, 7]);
});

test("skips tests unless noAny.tests is set, and declaration files always", async () => {
  const files = { "src/a.test.js": "/** @type {any} */\nlet a;\n", "src/types.d.ts": "export type A = any;\n" };
  assert.deepEqual(await runRuleOn(rule, files, pkg()), []);
  assert.equal((await runRuleOn(rule, files, pkg({ noAny: { tests: true } }))).length, 1);
});

test("leaves out what the allowlist names, by file or by symbol", async () => {
  const files = { "src/vendor.js": "/** @type {any} */\nlet a;\n", "src/b.ts": "class B {\n  m(x: any) {}\n  n(y: any) {}\n}\n" };
  const findings = await runRuleOn(rule, files, pkg({ noAny: {}, allow: { "light/no-any": { "src/vendor.js": "vendored", "src/b.ts#B.m": "a reason" } } }));
  assert.deepEqual(findings.map((f) => `${f.file}:${f.line}`), ["src/b.ts:3"]);
});

test("applies only to a project with a noAny block", async () => {
  assert.equal(appliesOn(rule, { "src/a.ts": "" }, pkg({})), "config-gated");
  assert.equal(appliesOn(rule, { "src/a.ts": "" }, pkg()), null);
});
