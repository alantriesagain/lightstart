import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./test-touches-browser.js";

test("warns on document in a plain test", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.test.js": "const el = document.body;\n",
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /document/);
});

test("warns on window.innerWidth in a plain test", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.test.js": "const width = window.innerWidth;\n",
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /window/);
});

test("warns on document.querySelector in a plain test", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.test.js": 'const el = document.querySelector("#app");\n',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /document/);
});

test("stays silent on the word window in a string", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.test.js": 'const text = "the window less the reserve";\n',
  });
  assert.deepEqual(findings, []);
});

test("stays silent on a property named windowSize", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.test.js": "const big = { windowSize: 1, width: big.windowSize };\n",
  });
  assert.deepEqual(findings, []);
});

test("stays silent on a key named window", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.test.js": "const options = { window: 1 };\n",
  });
  assert.deepEqual(findings, []);
});

test("stays silent on a local variable named window", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.test.js": "function measure(window) { return window.width; }\nexport { measure };\n",
  });
  assert.deepEqual(findings, []);
});

test("stays silent in a browser test", async () => {
  const findings = await runRuleOn(rule, {
    "test/app.browser.test.js": "const el = document.body;\n",
  });
  assert.deepEqual(findings, []);
});
