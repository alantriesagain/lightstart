import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./no-location-in-views.js";

test("fires on location.pathname in a view", async () => {
  const findings = await runRuleOn(rule, {
    "src/views/app-nav.js": "const active = (path) => location.pathname === path;\nconst other = window.location.pathname;\n",
  });
  assert.equal(findings.length, 2);
  assert.match(findings[0].message, /currentRoute/);
  assert.equal(findings[0].line, 1);
  assert.equal(findings[1].line, 2);
});

test("stays silent on the app's route, a comment, another property and a file that is not a view", async () => {
  const findings = await runRuleOn(rule, {
    "src/views/app-nav.ts": 'import { currentRoute } from "@lightstart/app/web";\n// location.pathname is not the route\nconst path = currentRoute.value?.path;\nconst hash = location.hash;\nconst own = this.location.pathname;\n',
    "src/controllers/analytics.js": "const seen = location.pathname;\n",
    "src/views/app-nav.test.js": "const seen = location.pathname;\n",
  });
  assert.deepEqual(findings, []);
});
