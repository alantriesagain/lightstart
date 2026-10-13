import assert from "node:assert/strict";
import test from "node:test";
import { appliesOn, runRuleOn } from "../test-utils.js";
import rule from "./unresolved-sync-target.js";

const controller = (name) => `import { defineController } from "@bootstrapp/light/controller";
export default defineController({ name: "${name}", props: {} });
`;

test("a name nothing registers fires, and any controller's name binds", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/history.js": controller("history"),
    "controllers/mood.js": controller("mood"),
    "views/home.js": `import T from "@bootstrapp/light/types";
export default { tag: "fx-home", props: {
  sessions: T.array({ defaultValue: [], sync: "histroy" }),
  moods: T.array({ defaultValue: [], sync: "mood" }),
} };
`,
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /sync: "histroy" never binds/);
});

const HOST = { host: { syncAdapters: ["local", "session"] } };

test("the host's adapters, resolved controllers, registered names and non-string targets are silent", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/history.js": controller("history"),
    "frontend.js": `registerAdapter("custom", makeAdapter());`,
    "views/home.js": `import T from "@bootstrapp/light/types";
export default { tag: "fx-home", props: {
  a: T.string({ sync: "local" }),
  b: T.string({ sync: "session" }),
  c: T.array({ sync: "history" }),
  d: T.string({ sync: "custom" }),
  e: T.object({ sync: $APP.history }),
} };
`,
    "tests/app.browser.test.js": `const p = { sync: "nowhere" };`,
  }, HOST);
  assert.equal(findings.length, 0);
});

test("a sync block entry naming nothing registered fires at its target", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/history.js": controller("history"),
    "controllers/journal.js": `import { defineController } from "@bootstrapp/light/controller";
export default defineController({ name: "journal", props: { a: "", b: "", c: "" }, sync: { a: "history", b: { to: "histroy", key: "x" }, c: "local" } });
`,
  }, HOST);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, "controllers/journal.js");
  assert.match(findings[0].message, /sync: "histroy" never binds/);
});

test("a document adapter the project creates, and a dependency's controller, bind", async () => {
  const findings = await runRuleOn(rule, {
    "lib/doc.js": `export const doc = createDocumentAdapter("notes-doc");`,
    "node_modules/@bootstrapp/devices/controllers/devices.js": `export default defineController({ name: "devices", props: { paired: [] } });`,
    "views/home.js": `export default { tag: "fx-home", props: { a: T.object({ sync: "notes-doc" }), b: T.array({ sync: "devices" }), c: T.string({ sync: "local" }) } };`,
  }, { host: { controllerFiles: () => ["node_modules/@bootstrapp/devices/controllers/devices.js"] } });
  assert.deepEqual(findings.map((f) => f.message.match(/sync: "([\w-]+)"/)[1]), ["local"]);
  assert.match(findings[0].message, /adapters: notes-doc/);
});

test("a package that hands its modules to importers is skipped: the app that loads it registers the names", () => {
  const files = { "views/home.js": `export default { tag: "fx-home", props: { a: T.string({ sync: "local" }) } };` };
  assert.equal(appliesOn(rule, files), null);
  assert.equal(appliesOn(rule, files, { pkgJson: { name: "lib", exports: { ".": "./index.js" } } }), "config-gated");
  assert.equal(appliesOn(rule, files, { pkgJson: { name: "lib", main: "./index.js" } }), "config-gated");
});
