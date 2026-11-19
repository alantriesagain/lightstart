import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./no-duplicate-route-path.js";

test("fires when two keys name the same path after a trailing slash", async () => {
  const findings = await runRuleOn(rule, {
    "src/routes.js": 'export default { "/about": {}, "/about/": {} };\n',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /"\/about\/"/);
});

test("stays silent on distinct paths", async () => {
  const findings = await runRuleOn(rule, {
    "src/routes.js": 'export default { "/": {}, "/about": {}, "/about/team": {} };\n',
  });
  assert.deepEqual(findings, []);
});
