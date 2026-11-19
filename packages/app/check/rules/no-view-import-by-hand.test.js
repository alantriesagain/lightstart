import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./no-view-import-by-hand.js";

test("fires on a side-effect import of a view", async () => {
  const findings = await runRuleOn(rule, {
    "src/views/app-root.js": 'import "./home-page.js";\nexport default {};\n',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /home-page\.js/);
});

test("fires when every imported binding is unused", async () => {
  const findings = await runRuleOn(rule, {
    "src/controllers/home.js": 'import { Home } from "../views/home-page.js";\nexport default {};\n',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /home-page\.js/);
});

test("stays silent on a used named import", async () => {
  const findings = await runRuleOn(rule, {
    "src/runtime/runtime.js": 'import { Shell } from "../views/shell.js";\nexport const app = new Shell();\n',
  });
  assert.deepEqual(findings, []);
});

test("stays silent on a used default import", async () => {
  const findings = await runRuleOn(rule, {
    "src/runtime/runtime.js": 'import Shell from "../views/shell.js";\nexport const app = new Shell();\n',
  });
  assert.deepEqual(findings, []);
});

test("stays silent on an import type", async () => {
  const findings = await runRuleOn(rule, {
    "src/controllers/home.js": 'import type { Home } from "../views/home-page.js";\nexport default {};\n',
  });
  assert.deepEqual(findings, []);
});
