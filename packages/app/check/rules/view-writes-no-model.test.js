import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./view-writes-no-model.js";

test("fires on a view writing a model it imports", async () => {
  const findings = await runRuleOn(rule, {
    "src/models/note.js": 'import { defineModel } from "@lightstart/light/model";\nexport default defineModel("note", {});\n',
    "src/views/note-list.js": 'import note from "../models/note.js";\nnote.add({ text: "x" });\n',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /note\.add/);
});

test("stays silent when a view goes through its controller", async () => {
  const findings = await runRuleOn(rule, {
    "src/models/note.js": 'import { defineModel } from "@lightstart/light/model";\nexport default defineModel("note", {});\n',
    "src/controllers/notes.js": 'import note from "../models/note.js";\nexport default { add: (text) => note.add({ text }) };\n',
    "src/views/note-list.js": 'import notes from "../controllers/notes.js";\nnotes.add("x");\n',
  });
  assert.deepEqual(findings, []);
});
