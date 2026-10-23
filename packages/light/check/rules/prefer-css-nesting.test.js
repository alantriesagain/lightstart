import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./prefer-css-nesting.js";

const COMPONENT = `export default {
  tag: "fx-card",
  style: true,
  render() { return null; },
};
`;

test("fires once per file when the :where prefix is repeated", async () => {
  const css = `:where(.fx-card, fx-card) { display: block; }
:where(.fx-card, fx-card) .title { font-weight: bold; }
:where(.fx-card, fx-card) .body { padding: 1rem; }
`;
  const findings = await runRuleOn(rule, { "views/card.js": COMPONENT, "views/card.css": css });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /3 top-level/);
  assert.match(findings[0].message, /merge into ONE/);
});

test("silent on one nested block plus legit top-level extras", async () => {
  const css = `:where(.fx-card, fx-card) {
  display: block;
  .title { font-weight: bold; }
  &:hover { background: var(--color-hover); }
  &::part(root) { gap: 1rem; }
  @media (max-width: 600px) { display: none; }
}
@keyframes spin { to { transform: rotate(1turn); } }
:root { --fx-card-pad: 1rem; }
::view-transition-old(root) { animation: none; }
html.fx-card-open { overflow: hidden; }
`;
  const findings = await runRuleOn(rule, { "views/card.js": COMPONENT, "views/card.css": css });
  assert.equal(findings.length, 0);
});

test("silent on cross-component selectors that merely mention the tag", async () => {
  const css = `:where(.fx-card, fx-card) { display: block; }
:where(.fx-page, fx-page):has(fx-card) .stage { display: none; }
`;
  const findings = await runRuleOn(rule, { "views/card.js": COMPONENT, "views/card.css": css });
  assert.equal(findings.length, 0);
});

test("silent without a css file or style: true", async () => {
  const findings = await runRuleOn(rule, {
    "views/plain.js": 'export default { tag: "fx-plain", render() { return null; } };',
  });
  assert.equal(findings.length, 0);
});
