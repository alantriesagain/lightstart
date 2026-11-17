import assert from "node:assert/strict";
import test from "node:test";
import { appliesOn, runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./locale-imports-nothing.js";

const plain = 'export default {\n  nav: { map: "Map" },\n};\n';

test("fires on a locale file that imports another module", async () => {
  const findings = await runRuleOn(rule, { "locales/en.js": 'import shared from "../shared/words.js";\nexport default { ...shared, nav: { map: "Map" } };\n' });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /imports "\.\.\/shared\/words\.js"/);
  assert.match(findings[0].message, /light\.locales/);
});

test("fires on a dynamic import too, which reaches around the merge just the same", async () => {
  const findings = await runRuleOn(rule, { "locales/pt-BR.js": 'const more = await import("./extra.js");\nexport default { ...more.default };\n' });
  assert.equal(findings.length, 1);
});

test("stays silent on plain data", async () => {
  const findings = await runRuleOn(rule, { "locales/en.js": plain, "locales/pt-BR.js": plain });
  assert.deepEqual(findings, []);
});

test("leaves the locale tests alone, which import the files they check", async () => {
  const findings = await runRuleOn(rule, { "locales/en.js": plain, "locales/locales.test.js": 'import en from "./en.js";\nimport test from "node:test";\n' });
  assert.deepEqual(findings, []);
});

test("only the project's top-level locales/ is a locale file", async () => {
  const findings = await runRuleOn(rule, { "views/locales/helper.js": 'import x from "./y.js";\nexport default x;\n' });
  assert.deepEqual(findings, []);
});

test("applies only where a locale file exists", () => {
  assert.equal(appliesOn(rule, { "views/app.js": "export default {};" }), "config-gated");
  assert.equal(appliesOn(rule, { "locales/en.js": plain }), null);
});
