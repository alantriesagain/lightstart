import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./controller-lifecycle-returns-async.js";

const wrap = (body) => `import { defineController } from "@bootstrapp/light/controller";
export default defineController({
  name: "demo",
  props: {},
${body}
});
`;

test("a dropped async method call in connected() fires", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/demo.js": wrap(`  connected() { this.load(); },
  async load() {},`),
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /connected\(\) starts this\.load\(\)/);
});

test("a dropped .then() chain in disconnected() fires", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/demo.js": wrap(`  disconnected() { flush().then(() => {}); },`),
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /disconnected\(\) starts \.then\(\)/);
});

test("returned, awaited, sync, and nested-arrow calls are silent", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/demo.js": wrap(`  async connected() {
    this.sync();
    this.$own(() => this.load());
    await this.warm();
    return this.load();
  },
  disconnected() { return this.flush(); },
  sync() {},
  async load() {},
  async warm() {},
  async flush() {},`),
  });
  assert.equal(findings.length, 0);
});

test("a call handed to trackWork is tracked, a call handed to anything else is not", async () => {
  const tracked = await runRuleOn(rule, {
    "controllers/demo.js": wrap(`  async connected() {
    await this.warm();
    trackWork(this.load(), "demo:load");
  },
  async warm() {},
  async load() {},`),
  });
  assert.equal(tracked.length, 0);
  const dropped = await runRuleOn(rule, {
    "controllers/demo.js": wrap(`  connected() { console.log(this.load()); },
  async load() {},`),
  });
  assert.equal(dropped.length, 1);
});

test("an arrow-valued hook is scanned too", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/demo.js": wrap(`  connected: () => { helper.then(() => {}); },`),
  });
  assert.equal(findings.length, 1);
});

test("views and tests are ignored", async () => {
  const findings = await runRuleOn(rule, {
    "views/demo.js": `export default { tag: "fx-demo", connected() { this.load(); }, async load() {} };`,
    "controllers/demo.test.js": wrap(`  connected() { this.load(); },
  async load() {},`),
  });
  assert.equal(findings.length, 0);
});
