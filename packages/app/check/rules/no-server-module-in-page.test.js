import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./no-server-module-in-page.js";

test("fires on a node built-in imported under src in a web app", async () => {
  const findings = await runRuleOn(rule, {
    "src/app.js": 'import { defineApp } from "@lightstart/app";\nexport default defineApp({ host: "web" });\n',
    "src/data/read.js": 'import { readFile } from "node:fs";\nexport default readFile;\n',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /node:fs/);
});

test("stays silent in a terminal app", async () => {
  const findings = await runRuleOn(rule, {
    "src/app.ts": 'import { defineApp } from "@lightstart/app";\nexport default defineApp({ host: "tui" });\n',
    "src/data/read.ts": 'import { readFileSync } from "node:fs";\nexport default readFileSync;\n',
  });
  assert.deepEqual(findings, []);
});
