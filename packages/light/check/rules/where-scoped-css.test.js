import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./where-scoped-css.js";

const COMPONENT = `export default {
  tag: "fx-card",
  style: true,
  render() { return null; },
};
`;

test("fires on unscoped top-level selectors", async () => {
  const findings = await runRuleOn(rule, {
    "views/card.js": COMPONENT,
    "views/card.css": "button { color: red; }\n.title { font-weight: bold; }",
  });
  assert.equal(findings.length, 2);
  assert.match(findings[0].message, /scope as :where\(\.fx-card, fx-card\)/);
});

test("silent on :where-scoped, tag-scoped, :root, and at-rule selectors", async () => {
  const css = `:where(.fx-card, fx-card) { display: block; }
:where(.fx-card, fx-card) button { color: var(--color-primary); }
fx-card .inner { padding: 0; }
:root { --x: 1; }
@media (max-width: 600px) {
  :where(.fx-card, fx-card) { display: none; }
}
@keyframes spin { to { transform: rotate(1turn); } }
`;
  const findings = await runRuleOn(rule, { "views/card.js": COMPONENT, "views/card.css": css });
  assert.equal(findings.length, 0);
});

test("silent on document-level view-transition pseudo-elements", async () => {
  const findings = await runRuleOn(rule, {
    "views/card.js": COMPONENT,
    "views/card.css": "::view-transition-old(root) { animation: none; }\n::view-transition-new(root) { animation: none; }",
  });
  assert.equal(findings.length, 0);
});

test("silent when the component has no css or no style: true", async () => {
  const findings = await runRuleOn(rule, {
    "views/plain.js": 'export default { tag: "fx-plain", render() { return null; } };',
    "views/loose.css": "button { color: red; }",
  });
  assert.equal(findings.length, 0);
});

test("tells a light-DOM component to scope the selector", async () => {
  const findings = await runRuleOn(rule, {
    "views/card.js": COMPONENT,
    "views/card.css": ".track { overflow: auto; }",
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /scope as :where\(\.fx-card, fx-card\)/);
});

const LIBRARY_VIEW = `export default {
  tag: "library-x",
  style: true,
  render() { return null; },
};
`;

test("a :where() scope naming another tag fires", async () => {
  const findings = await runRuleOn(rule, {
    "views/x.js": LIBRARY_VIEW,
    "views/x.css": ":where(.creators-x, creators-x) { display: block; }\n:where(.creators-x, creators-x) .row { gap: 0; }",
  });
  assert.equal(findings.length, 2);
  assert.match(findings[0].message, /not <library-x>/);
  assert.match(findings[0].message, /scope as :where\(\.library-x, library-x\)/);
});

test("a :where() scope naming the view's own tag stays silent", async () => {
  const findings = await runRuleOn(rule, {
    "views/x.js": LIBRARY_VIEW,
    "views/x.css": ":where(.library-x, library-x) { display: block; }\n:where(.library-x, library-x) .row { gap: 0; }",
  });
  assert.equal(findings.length, 0);
});

test("a longer tag that starts with the view's tag is not the view's tag", async () => {
  const findings = await runRuleOn(rule, {
    "views/x.js": LIBRARY_VIEW,
    "views/x.css": ":where(.library-x-panel, library-x-panel) { display: block; }",
  });
  assert.equal(findings.length, 1);
});

test("an ancestor block whose every nested rule names the view's tag stays silent", async () => {
  const findings = await runRuleOn(rule, {
    "views/card.js": COMPONENT,
    "views/card.css": ":where(.fx-join) {\n  > fx-card { flex: 1; }\n  &[orientation=\"vertical\"] > fx-card + fx-card::before { content: \"\"; }\n}",
  });
  assert.equal(findings.length, 0);
});

test("an ancestor block with a nested rule that skips the view's tag fires", async () => {
  const findings = await runRuleOn(rule, {
    "views/card.js": COMPONENT,
    "views/card.css": ":where(.fx-join) {\n  > fx-card { flex: 1; }\n  .other { color: red; }\n}",
  });
  assert.equal(findings.length, 1);
});

test("a css shared by two style: true definitions is scoped by either tag", async () => {
  const two = `import View from "@bootstrapp/light";
View.define("fx-a", {}, { style: true, render() { return null; } });
View.define("fx-b", {}, { style: true, render() { return null; } });
`;
  const css = ":where(.fx-a, fx-a) { color: red; }\n:where(.fx-b, fx-b) { color: blue; }\n.leak { color: green; }\n";
  const findings = await runRuleOn(rule, { "views/pair.js": two, "views/pair.css": css });
  assert.deepEqual(findings.map((f) => f.message.includes('"\.leak"')), [true]);
});
