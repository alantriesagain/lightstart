import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./one-declaration-per-type.js";

const DIVERGENT = `export interface Creds {
  host?: string;
  key?: string;
}

export interface Creds {
  host?: string;
  domain?: string;
}
`;

test("fires on the second declaration, which is the one that merges", async () => {
  const findings = await runRuleOn(rule, { "types.ts": DIVERGENT });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 6);
  assert.match(findings[0].message, /Creds is already declared/);
});

test("a third declaration is reported too, so one pass names them all", async () => {
  const findings = await runRuleOn(rule, { "types.ts": `${DIVERGENT}\nexport interface Creds { port?: number }\n` });
  assert.equal(findings.length, 2);
});

test("fires on a duplicated type alias as well as an interface", async () => {
  const findings = await runRuleOn(rule, { "types.ts": "export type Id = string;\nexport type Id = number;\n" });
  assert.equal(findings.length, 1);
});

test("silent when each name is declared once", async () => {
  const findings = await runRuleOn(rule, {
    "types.ts": "export interface Creds { host?: string }\nexport interface Target extends Creds { domain?: string }\n",
  });
  assert.equal(findings.length, 0);
});

test("silent on a declare-module augmentation, where merging is the point", async () => {
  const findings = await runRuleOn(rule, {
    "types.ts": 'declare module "bootstrapp/base" {\n  interface Manifest {\n    vps?: Creds;\n  }\n}\n\nexport interface Creds { host?: string }\n',
  });
  assert.equal(findings.length, 0);
});

test("silent on a .js file, which has no interfaces to merge", async () => {
  const findings = await runRuleOn(rule, { "types.js": DIVERGENT });
  assert.equal(findings.length, 0);
});
