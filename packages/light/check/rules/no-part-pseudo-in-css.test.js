import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./no-part-pseudo-in-css.js";

const scoped = (body) => `:where(.fx-card, fx-card) {\n  display: block;\n${body}\n}\n`;

test("fires on ::part()", async () => {
  const findings = await runRuleOn(rule, { "views/card.css": scoped("  &::part(body) { padding: 1rem; }") });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /\[part~=tag-name\]/);
});

test("fires on ::slotted()", async () => {
  const findings = await runRuleOn(rule, { "views/card.css": scoped('  ::slotted([slot="figure"]) { width: 2rem; }') });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /slot > \[slot=name\]/);
});

test("fires on :host, in both of its forms", async () => {
  const findings = await runRuleOn(rule, { "views/card.css": ":host { display: block; }\n:host([open]) .x { color: red; }\n" });
  assert.equal(findings.length, 2);
  assert.match(findings[0].message, /:where\(\.tag, tag\)/);
});

test("silent on the light-DOM forms", async () => {
  const findings = await runRuleOn(rule, {
    "views/card.css": scoped("  & [part~=fx-card-body] { padding: 1rem; }\n  & slot > [slot=figure] { width: 2rem; }\n  &[open] { color: red; }"),
  });
  assert.equal(findings.length, 0);
});

test("a comment mentioning the selector is not a rule", async () => {
  const findings = await runRuleOn(rule, { "views/card.css": scoped("  /* the old ::part(body) rule lived here */\n  & [part~=fx-card-body] { padding: 0; }") });
  assert.equal(findings.length, 0);
});

test("looks at every stylesheet, not only a component's sibling", async () => {
  const findings = await runRuleOn(rule, { "views/templates/shell.css": "lc-app-shell::part(header) { height: 3rem; }\n" });
  assert.equal(findings.length, 1);
});
