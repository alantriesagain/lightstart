import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./model-module-shape.js";

test("fires when the model is named after another file", async () => {
  const findings = await runRuleOn(rule, {
    "src/models/note.js": 'import { defineModel } from "@lightstart/light/model";\nconst note = defineModel("todo", {});\nexport default note;\n',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /"todo"/);
});

test("stays silent on a model bound to a name and exported", async () => {
  const findings = await runRuleOn(rule, {
    "src/models/note.ts": 'import { defineModel } from "@lightstart/light/model";\nconst note = defineModel("note", {});\nexport default note;\n',
  });
  assert.deepEqual(findings, []);
});
