import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./controller-known-lifecycle-hooks.js";

const wrap = (body) => `import { defineController } from "@bootstrapp/light/controller";
export default defineController({ name: "rates", props: {},
${body}
});
`;

test("a dead teardown and a view-only hook fire", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/rates.js": wrap(`  teardown() {},
  firstUpdated() {},`),
  });
  assert.equal(findings.length, 2);
  assert.match(findings[0].message, /"teardown" is not a controller hook/);
  assert.match(findings[0].message, /own\(/);
  assert.match(findings[1].message, /"firstUpdated" is a view hook/);
});

test("real hooks and public-API names are silent", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/rates.js": wrap(`  connected() {},
  disconnected() {},
  dispose() {},
  destroy() {},`),
  });
  assert.equal(findings.length, 0);
});

test("views keep their own rule", async () => {
  const findings = await runRuleOn(rule, {
    "views/rates.js": `export default { tag: "fx-rates", teardown() {}, firstUpdated() {} };`,
  });
  assert.equal(findings.length, 0);
});

test("a hook the host's plugins give views is a view hook on a controller", async () => {
  const findings = await runRuleOn(rule, { "controllers/rates.js": wrap("  dataLoaded() {},") }, { host: { pluginHooks: ["dataLoaded"] } });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /"dataLoaded" is a view hook/);
});
