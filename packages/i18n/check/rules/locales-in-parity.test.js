import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./locales-in-parity.js";

test("fires on a locale missing and carrying keys", async () => {
  const findings = await runRuleOn(rule, {
    "src/app.js": 'export default { locale: "en" };\n',
    "src/locales/en.js": 'export default { nav: { map: "Map" }, title: "Tasks" };\n',
    "src/locales/pt.js": 'export default { nav: {}, title: "Tarefas", extra: "x" };\n',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /missing "nav\.map"/);
  assert.match(findings[0].message, /extra "extra"/);
});

test("stays silent when the keys match", async () => {
  const findings = await runRuleOn(rule, {
    "src/locales/en.js": 'export default { nav: { map: "Map" } };\n',
    "src/locales/pt.ts": 'export default { nav: { map: "Mapa" } };\n',
  });
  assert.deepEqual(findings, []);
});
