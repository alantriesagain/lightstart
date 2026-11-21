import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./page-test-name.js";

test("fires on a plain test that opens a page", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.test.js": 'import { openPage } from "@lightstart/app/web/test";\nimport manifest from "../.light/app.js";\n',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /test\/app\.test\.js opens a page \(@lightstart\/app\/web\/test\)/);
  assert.match(findings[0].message, /\*\.browser\.test\.\*/);
});

test("stays silent on a browser test that opens a page", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.browser.test.ts": 'import { openPage } from "@lightstart/app/web/test";\nimport manifest from "../.light/app.ts";\n',
  });
  assert.deepEqual(findings, []);
});

test("stays silent on a node test over the opened app", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.test.ts": 'import { openApp } from "@lightstart/app/test";\nimport manifest from "../.light/app.ts";\n',
  });
  assert.deepEqual(findings, []);
});

test("stays silent on an e2e file that opens the built app", async () => {
  const findings = await runRuleOn(rule, {
    "test/smoke.e2e.ts": 'import { latestBuild, openBuilt } from "@lightstart/app/web/test";\n',
  });
  assert.deepEqual(findings, []);
});
