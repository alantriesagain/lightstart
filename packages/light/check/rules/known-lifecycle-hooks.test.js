import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./known-lifecycle-hooks.js";

const component = (body) => `export default {
  tag: "fx-thing",
  ${body}
  render() { return null; },
};
`;

test("fires on other frameworks' lifecycle names", async () => {
  const findings = await runRuleOn(rule, { "views/a.js": component("connectedCallback() {},\n  mounted() {},") });
  assert.equal(findings.length, 2);
  assert.match(findings[0].message, /use "connected"/);
});

test("fires on wrong-case variants", async () => {
  const findings = await runRuleOn(rule, { "views/a.js": component("willupdate() {},") });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /use "willUpdate"/);
});

test("silent on real hooks and arbitrary methods", async () => {
  const findings = await runRuleOn(rule, {
    "views/a.js": component("connected() {},\n  willUpdate() {},\n  loadThings() {},\n  handleClick() {},"),
  });
  assert.equal(findings.length, 0);
});

test("fires on a hook name inside View.define's definition argument", async () => {
  const src = `import View from "@bootstrapp/light";
View.define("fx-thing", { n: 0 }, { mounted() {}, render() { return null; } });
`;
  const findings = await runRuleOn(rule, { "views/a.js": src });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /use "connected"/);
});
