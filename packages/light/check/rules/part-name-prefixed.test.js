import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./part-name-prefixed.js";

const component = (body) => `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-card",
  render() { return html\`${body}\`; },
};
`;

test("fires on a part named without the tag", async () => {
  const findings = await runRuleOn(rule, { "views/card.js": component('<div part="body"><slot></slot></div>') });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /part="fx-card-body"/);
  assert.match(findings[0].message, /\[part~=fx-card-body\]/);
});

test("silent on prefixed parts, single and multi-token", async () => {
  const findings = await runRuleOn(rule, { "views/card.js": component('<div part="fx-card-header fx-card-header-row"><slot part="fx-card-body"></slot></div>') });
  assert.equal(findings.length, 0);
});

test("fires once per attribute, naming the first stray token", async () => {
  const findings = await runRuleOn(rule, { "views/card.js": component('<div part="fx-card-header row"></div>') });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /part="row"/);
});

test("an interpolated part attribute is left to the author", async () => {
  const findings = await runRuleOn(rule, { "views/card.js": component('<div part="fx-card-day ${this.today ? "fx-card-day-today" : ""}"></div>') });
  assert.equal(findings.length, 0);
});

test("a component that renders nothing of its own has nothing to check", async () => {
  const source = `export default {
  tag: "fx-button",
  extends: "fx-link",
};
`;
  const findings = await runRuleOn(rule, { "views/button.js": source });
  assert.equal(findings.length, 0);
});

test("two definitions in one file: each other's parts are fine, an unprefixed one is reported once", async () => {
  const src = `import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
View.define("fx-a", {}, (el) => html\`<div part="fx-a-body"><span part="fx-b-chip"></span></div>\`);
View.define("fx-b", {}, (el) => html\`<div part="fx-b-body"><i part="chip"></i></div>\`);
`;
  const findings = await runRuleOn(rule, { "views/pair.js": src });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /part="chip"/);
});

test("a single-quoted or unquoted static part is read too", async () => {
  const findings = await runRuleOn(rule, { "views/card.js": component("<div part='body'><i part=fx-card-dot></i></div>") });
  assert.deepEqual(findings.map((f) => f.message.startsWith('part="body"')), [true]);
});
