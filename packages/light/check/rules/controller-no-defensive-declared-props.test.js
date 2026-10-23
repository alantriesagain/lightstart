import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./controller-no-defensive-declared-props.js";

const wrap = (props, body) => `import { defineController } from "@bootstrapp/light/controller";
import T from "@bootstrapp/light/types";
export default defineController({
  name: "demo",
  props: {
${props}
  },
${body}
});
`;

test("?. and ?? on non-null-default props fire, including factory and cast defaults", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/demo.js": wrap(
      `    reminderTimes: T.array({ defaultValue: ["07:00"] }),
    _offs: T.array({ defaultValue: () => [] }),
    rows: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),`,
      `  a() { return [...(this.reminderTimes ?? [])]; },
  b() { for (const off of this._offs ?? []) off(); },
  c() { return this.rows?.length; },`,
    ),
  });
  assert.equal(findings.length, 3);
  assert.match(findings[0].message, /this\.reminderTimes \?\?/);
  assert.match(findings[2].message, /this\.rows\?\./);
});

test("?.() on an own method or a builtin fires", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/demo.js": wrap(
      `    count: T.number({ defaultValue: 0 }),`,
      `  refresh() {},
  a() { this.refresh?.(); this.$own?.(() => {}); },`,
    ),
  });
  assert.equal(findings.length, 2);
  assert.match(findings[0].message, /this\.refresh\?\.\(/);
});

test("null-default handles, prefix collisions, and ??= are silent", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/demo.js": wrap(
      `    rows: T.array({ defaultValue: [] }),
    _res: null,
    label: T.string(),`,
      `  a() { this._res?.dispose(); return this.rowsExtra?.length ?? this.label?.length; },
  b() { this.rows ??= []; },`,
    ),
  });
  assert.equal(findings.length, 0);
});

test("views are not scanned by this rule", async () => {
  const findings = await runRuleOn(rule, {
    "views/demo.js": `export default { tag: "fx-demo", props: { rows: [] }, a() { return this.rows?.length; } };`,
  });
  assert.equal(findings.length, 0);
});

test("each controller of a file is read against its own props", async () => {
  const findings = await runRuleOn(rule, {
    "lib/stores.js": `import { defineController } from "@bootstrapp/light/controller";
export const a = defineController({ name: "a", props: { rows: [] } });
export const b = defineController({ name: "b", props: { rows: null }, go() { return this.rows?.length; } });
`,
  });
  assert.equal(findings.length, 0);
});
