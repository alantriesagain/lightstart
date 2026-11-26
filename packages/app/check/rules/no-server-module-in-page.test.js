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

test("stays silent in the app's server code: endpoints, src/server.js and src/lib/server/", async () => {
  const findings = await runRuleOn(rule, {
    "src/app.js": 'import { defineApp } from "@lightstart/app";\nexport default defineApp({ host: "web" });\n',
    "src/endpoints/accept.js": 'import { HttpError } from "@lightstart/server";\nexport default HttpError;\n',
    "src/server.js": 'import { App } from "@lightstart/server";\nexport default App;\n',
    "src/lib/server/stats.js": 'import { d1Of } from "@lightstart/sqlite/d1";\nexport default d1Of;\n',
  });
  assert.deepEqual(findings, []);
});

test("still fires on a page module that only looks like server code", async () => {
  const findings = await runRuleOn(rule, {
    "src/app.js": 'import { defineApp } from "@lightstart/app";\nexport default defineApp({ host: "web" });\n',
    "src/lib/serverish.js": 'import { App } from "@lightstart/server";\nexport default App;\n',
    "src/views/server-status.js": 'import { App } from "@lightstart/server";\nexport default App;\n',
  });
  assert.equal(findings.length, 2);
});
