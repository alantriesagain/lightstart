import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./no-defensive-declared-props.js";

const component = (body) =>
  ["export default {", '  tag: "fx-list",', ...body, "};"].join("\n");

test("fires on ?. reads of a prop with a non-null defaultValue", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": component([
      "  props: {",
      "    rows: T.array({ defaultValue: [] }),",
      '    label: T.string({ defaultValue: "" }),',
      "  },",
      "  render() {",
      "    return html`${this.label?.toUpperCase()} ${this.rows?.map((r) => r.id)}`;",
      "  },",
    ]),
  });
  assert.equal(findings.length, 2);
  assert.match(findings[0].message, /defaultValue/);
});

test("fires on a ?? fallback for a prop with a non-null defaultValue, not on ??=", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": component([
      "  props: {",
      "    rows: T.array({ defaultValue: [] }),",
      '    label: T.string("x"),',
      "  },",
      "  render() {",
      "    this.rows ??= [];",
      "    return html`${(this.rows ?? []).length} ${this.label ?? \"\"}`;",
      "  },",
    ]),
  });
  assert.equal(findings.length, 2);
  assert.match(findings[0].message, /this\.rows \?\?/);
});

test("fires on this.$emit?.(, $emit is a View base method", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": component([
      "  props: {},",
      "  toggle() {",
      '    this.$emit?.("change", { value: 1 });',
      "  },",
    ]),
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /base method/);
});

test("silent on plain reads and on legitimately-nullable props", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": component([
      "  props: {",
      "    rows: T.array({ defaultValue: [] }),",
      "    bundle: T.object({ defaultValue: null }),",
      "    item: T.object(),",
      "    selectRow: T.function(),",
      "  },",
      "  render() {",
      "    this.selectRow?.(this.item?.name);",
      "    return html`${this.bundle?.content} ${this.rows.map((r) => r.id)}`;",
      "  },",
    ]),
  });
  assert.equal(findings.length, 0);
});

test("silent on lookup results and on a similarly-prefixed prop name", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": component([
      "  props: {",
      "    row: T.object({ defaultValue: {} }),",
      "  },",
      "  render() {",
      "    const hit = this._cache.get(this.row.id)?.value;",
      "    return html`${this.rows?.length} ${hit}`;",
      "  },",
    ]),
  });
  assert.equal(findings.length, 0);
});

test("silent outside component files", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/list.js": "export const f = (c) => c.rows?.map((r) => r.id);",
  });
  assert.equal(findings.length, 0);
});

test("two definitions in one file are read once: a shared prop reports each match once, and $emit?. once", async () => {
  const src = `import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
View.define("fx-a", { items: [] }, { render() { return html\`\${this.items?.length}\`; } });
View.define("fx-b", { items: [] }, { ping() { this.$emit?.("x"); return this.items ?? []; } });
`;
  const findings = await runRuleOn(rule, { "views/pair.js": src });
  assert.deepEqual(findings.map((f) => f.line), [3, 4, 4]);
});
