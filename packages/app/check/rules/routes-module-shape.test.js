import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./routes-module-shape.js";

test("fires on a key that is not a path", async () => {
  const findings = await runRuleOn(rule, {
    "src/routes.js": 'const routes = { home: { view: "app-home" } };\nexport default routes;\n',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /"home"/);
});

test("stays silent on a default-exported table of paths", async () => {
  const findings = await runRuleOn(rule, {
    "src/routes.ts": 'const routes = { "/": { view: "app-home" }, "/about": { view: "app-about" } };\nexport default routes;\n',
  });
  assert.deepEqual(findings, []);
});

test("stays silent on a route with layout, props and nested routes", async () => {
  const findings = await runRuleOn(rule, {
    "src/routes.ts":
      'export default { "/settings": { layout: "app-shell", props: { tab: "main" }, routes: { "/profile": { view: "app-profile", layout: null } } } };\n',
  });
  assert.deepEqual(findings, []);
});
