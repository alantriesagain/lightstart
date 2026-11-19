import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./controller-has-test.js";

test("warns when no test names the controller", async () => {
  const findings = await runRuleOn(rule, {
    "src/controllers/notes.js": "export default { add() {} };\n",
    "test/app.test.js": "const x = 1;\n",
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /notes/);
});

test("stays silent when a test names it", async () => {
  const findings = await runRuleOn(rule, {
    "src/controllers/notes.js": "export default { add() {} };\n",
    "test/app.test.js": 'import notes from "../src/controllers/notes.js";\nnotes.add();\n',
  });
  assert.deepEqual(findings, []);
});

test("stays silent when a test opens the generated app", async () => {
  const findings = await runRuleOn(rule, {
    "src/controllers/notes.js": "export default { add() {} };\n",
    "test/app.test.js": 'import manifest from "../.light/app.js";\n',
  });
  assert.deepEqual(findings, []);
});
