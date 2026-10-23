import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./component-uses-define.js";

test("a bare object literal component is flagged at its export", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": `import T from "@bootstrapp/light/types";\nexport default {\n  tag: "x-thing",\n  props: { count: T.number() },\n};\n`,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
  assert.match(findings[0].message, /defineComponent/);
});

test("a wrapped component passes", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": `import { defineComponent } from "@bootstrapp/light";\nexport default defineComponent({\n  tag: "x-thing",\n});\n`,
  });
  assert.equal(findings.length, 0);
});

test("a default-exported literal without a tag is not a component", async () => {
  const findings = await runRuleOn(rule, {
    "models/schema.js": `export default {\n  note: { title: "string" },\n};\n`,
    "routes.js": `export default {\n  "/": { component: "x-home" },\n};\n`,
  });
  assert.equal(findings.length, 0);
});

test("a tag inside a helper elsewhere in the file does not make the module a component", async () => {
  const findings = await runRuleOn(rule, {
    "frontend.js": `const install = (View) => View.define("app-container", {\n  tag: "app-container",\n});\nexport default {\n  connected() { install(this.constructor); },\n};\n`,
  });
  assert.equal(findings.length, 0);
});

test("a literal declared under a name and then default-exported is flagged at the declaration", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": `import T from "@bootstrapp/light/types";\nconst Thing = {\n  tag: "x-thing",\n};\nexport default Thing;\n`,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
});
