import assert from "node:assert/strict";
import test from "node:test";
import { validateRuleShape } from "./define.js";

const ok = { severity: "warn", description: "d", check() {} };

test("validateRuleShape accepts the contract and names every deviation", () => {
  assert.equal(validateRuleShape(ok), null);
  assert.equal(validateRuleShape({ ...ok, why: "because", appliesTo: { styling: "css", dep: "view", when: () => true } }), null);
  assert.match(validateRuleShape(null), /not an object/);
  assert.match(validateRuleShape({ ...ok, severity: "info" }), /invalid severity/);
  assert.match(validateRuleShape({ ...ok, description: "" }), /missing description/);
  assert.match(validateRuleShape({ ...ok, check: 1 }), /missing check/);
  assert.match(validateRuleShape({ ...ok, why: "" }), /why must be/);
  assert.match(validateRuleShape({ ...ok, appliesto: {} }), /unknown key "appliesto"/);
  assert.match(validateRuleShape({ ...ok, appliesTo: { deps: "view" } }), /unknown appliesTo key "deps"/);
  assert.match(validateRuleShape({ ...ok, appliesTo: { styling: "sass" } }), /appliesTo.styling/);
  assert.match(validateRuleShape({ ...ok, appliesTo: { dep: "" } }), /appliesTo.dep/);
  assert.match(validateRuleShape({ ...ok, appliesTo: { when: true } }), /appliesTo.when/);
  assert.match(validateRuleShape({ ...ok, appliesTo: null }), /appliesTo must be/);
});
