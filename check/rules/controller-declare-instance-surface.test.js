import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./controller-declare-instance-surface.js";

const wrap = (body) => `import { defineController } from "@bootstrapp/light/controller";
import T from "@bootstrapp/light/types";
export default defineController({
  name: "blocks",
  props: { count: T.number({ defaultValue: 0 }) },
${body}
});
`;

test("an undeclared field that is member-accessed is flagged", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/blocks.js": wrap(`  ensure() { return this._rows.ensure(); },`),
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /this\._rows/);
  assert.match(findings[0].message, /not declared/);
});

test("an undeclared field invoked as a call is flagged", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/blocks.js": wrap(`  stop() { this._off?.(); },`),
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /this\._off/);
});

test("an assignment to an undeclared field is flagged, once per field", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/blocks.js": wrap(`  connected() { this._mute = true; this._queued ??= false; },
  schedule() { if (this._mute) return; this._mute = false; },`),
  });
  assert.deepEqual(findings.map((f) => f.message.match(/this\.(\w+)/)[1]).sort(), ["_mute", "_queued"]);
});

test("a definition member is a declared plain field", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/blocks.js": wrap(`  _tick: /** @type {ReturnType<typeof setInterval> | null} */ (null),
  limits: { max: 3 },
  start() { this._tick = setInterval(() => {}, 10); return this.limits.max; },`),
  });
  assert.equal(findings.length, 0);
});

test("a member a method assigns is declared", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/blocks.js": `import { defineController } from "@bootstrapp/light/controller";
import T from "@bootstrapp/light/types";
export default defineController({
  name: "blocks",
  props: { count: 0 },
  _rows: /** @type {import("@bootstrapp/light/controller").Resource<any>} */ (/** @type {unknown} */ (null)),
  connected() { this._rows = makeRows(); this.$own(this._rows.dispose); },
  ensure() { return this._rows.ensure(); },
});
`,
  });
  assert.equal(findings.length, 0);
});

test("assigning or member-accessing a declared property is not flagged", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/blocks.js": wrap(`  bump() { this.count += 1; return this.count.toFixed(0); },`),
  });
  assert.equal(findings.length, 0);
});

test("reading an undeclared field whole, never assigned, is not flagged", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/blocks.js": wrap(`  use() { if (this._flag) return 1; return 2; },`),
  });
  assert.equal(findings.length, 0);
});

test("the $-prefixed framework members are not flagged", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/blocks.js": wrap(`  connected() {
    this.$state.subscribe("count", () => {});
    this.$state.get("count");
    this.$attach({ $requestUpdate() {} });
    this.$own(() => {});
    this.$ready.then(() => {});
  },`),
  });
  assert.equal(findings.length, 0);
});

test("the old reserved names are ordinary fields: undeclared, they are flagged", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/blocks.js": wrap(`  connected() { this.state.get("count"); this.config.flag; },`),
  });
  assert.deepEqual(findings.map((f) => f.message.match(/this\.(\w+)/)[1]).sort(), ["config", "state"]);
});

test("a method member and a shorthand member are not bare fields", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/blocks.js": wrap(`  helper,
  refresh: async () => {},
  total() { return 1; },`),
  });
  assert.equal(findings.length, 0);
});

test("a definition that is not a defineController call is ignored", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/lib/helper.js": "export const f = (o) => o._x.y;\n",
    "views/thing.js": "export default { tag: \"fx-thing\", go() { this._z = 1; return this._z.w(); } };\n",
    "controllers/plain.js": "export default { name: \"plain\", _x: null };\n",
  });
  assert.equal(findings.length, 0);
});

test("a defineController call anywhere is a controller, each checked against its own definition", async () => {
  const findings = await runRuleOn(rule, {
    "lib/stores.js": `import { defineController } from "@bootstrapp/light/controller";
export const first = defineController({ name: "first", go() { this._x = 1; } });
const second = defineController({ name: "second", _y: null, go() { this._y = 2; } });
export { second };
`,
  });
  assert.deepEqual(findings.map((f) => f.message.match(/this\.(\w+)/)[1]), ["_x"]);
});

test("a field declared by a mixins fragment, or by a fragment's own mixin, counts as declared", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/doc.js": `import { defineController } from "@bootstrapp/light/controller";
import { storeMixin } from "./doc/store.js";
export default defineController({
  name: "doc",
  mixins: [storeMixin],
  flush() { clearTimeout(this._timer); this._undo = null; return this.save(); },
  drop() { this._orphan = 1; },
});
`,
    "controllers/doc/store.js": `import { defineMixin } from "@bootstrapp/light/controller";
import T from "@bootstrapp/light/types";
import { makeUndo } from "./undo.js";
export const storeMixin = defineMixin({
  mixins: [makeUndo({ depth: 5 })],
  _timer: null,
  save() {},
});
`,
    "controllers/doc/undo.js": `export const makeUndo = (opts) => ({ _undo: null });
`,
  });
  assert.deepEqual(findings.map((f) => f.message.match(/this\.(\w+)/)[1]), ["_orphan"]);
});

test("a fragment spread into the definition declares what it carries", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/ide.js": `import { defineController } from "@bootstrapp/light/controller";
import { ui } from "./lib/ui.js";
export default defineController({
  name: "ide",
  ...ui,
  open() { return this.showConfirm({ title: "Sure?" }); },
  stray() { return this.notThere(); },
});
`,
    "controllers/lib/ui.js": `export const ui = {
  showConfirm(options) { return Promise.resolve(true); },
};
`,
  });
  assert.deepEqual(findings.map((f) => f.message.match(/this\.(\w+)/)[1]), ["notThere"]);
});
