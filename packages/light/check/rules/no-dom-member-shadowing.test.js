import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./no-dom-member-shadowing.js";

const view = (body) => `import T from "@bootstrapp/light/types";
export default { tag: "fx-card", ${body} render() { return null; } };
`;

test("fires on a property named after a DOM method", async () => {
  const findings = await runRuleOn(rule, { "views/card.js": view("props: { click: T.function() },") });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /property "click" shadows the DOM's click\(\)/);
});

test("fires on a method named after a DOM method", async () => {
  const findings = await runRuleOn(rule, { "views/card.js": view("scroll() {},") });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /method "scroll" shadows the DOM's scroll\(\)/);
});

test("leaves accessors, near-misses and ordinary names alone", async () => {
  const findings = await runRuleOn(rule, {
    "views/card.js": view("props: { title: T.string(), role: T.string(), scrollable: T.boolean(), animation: T.string() }, removeItem() {},"),
  });
  assert.deepEqual(findings, []);
});

test("props given as View.define's second argument count, and a render-only component has no literal to crash on", async () => {
  const src = `import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
View.define("fx-a", { click: false, label: "" }, { close() {} });
View.define("fx-b", { focus: 0 }, (el) => html\`<b>\${el.focus}</b>\`);
`;
  const findings = await runRuleOn(rule, { "views/a.js": src });
  assert.deepEqual(findings.map((f) => f.message), [
    'property "click" shadows the DOM\'s click() on <fx-a>; rename it',
    'property "focus" shadows the DOM\'s focus() on <fx-b>; rename it',
  ]);
  assert.equal(findings[0].col, src.split("\n")[2].indexOf("{ click") + 1);
});
