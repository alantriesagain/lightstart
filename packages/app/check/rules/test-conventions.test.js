import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./test-conventions.js";

test("fires on a committed .only", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.test.js": 'import test from "node:test";\ntest.only("one", () => {});\n',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /\.only/);
});

test("stays silent on an ordinary test", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.test.js": 'import test from "node:test";\ntest("one", () => {});\n',
  });
  assert.deepEqual(findings, []);
});
