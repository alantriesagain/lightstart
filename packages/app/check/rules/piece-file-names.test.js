import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./piece-file-names.js";

test("warns on a file that is not kebab-case", async () => {
  const findings = await runRuleOn(rule, {
    "src/views/HomePage.js": "export default {};\n",
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /HomePage\.js/);
});

test("stays silent on a kebab-case file", async () => {
  const findings = await runRuleOn(rule, {
    "src/views/home-page.js": "export default {};\n",
  });
  assert.deepEqual(findings, []);
});
