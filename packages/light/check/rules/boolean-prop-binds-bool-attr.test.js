import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./boolean-prop-binds-bool-attr.js";

const modal = (props) => `import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
export default {
  tag: "fx-modal",
  props: {
${props}
  },
  render() { return html\`<div></div>\`; },
};
`;

const binder = (body) => `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-thing",
  render() { return html\`${body}\`; },
};
`;

test("fires on a .prop binding to a T.boolean property", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    isOpen: T.boolean({ defaultValue: false }),"),
    "views/thing.js": binder("<fx-modal .isOpen=${this.x}></fx-modal>"),
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /\?is-open=/);
});

test("points at the binding, not the top of the file", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    isOpen: T.boolean(),"),
    "views/thing.js": binder("<fx-modal .isOpen=${this.x}></fx-modal>"),
  });
  assert.ok(findings[0].line > 1);
});

test("a single-word boolean prop is flagged with its plain attribute name", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    open: T.boolean({ defaultValue: false }),"),
    "views/thing.js": binder("<fx-modal .open=${this.x}></fx-modal>"),
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /\?open=/);
});

test("silent on the ?kebab-attribute form", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    isOpen: T.boolean({ defaultValue: false }),"),
    "views/thing.js": binder("<fx-modal ?is-open=${this.x}></fx-modal>"),
  });
  assert.equal(findings.length, 0);
});

test("silent on a .prop binding to an object property", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    data: T.object({ defaultValue: null }),"),
    "views/thing.js": binder("<fx-modal .data=${this.x}></fx-modal>"),
  });
  assert.equal(findings.length, 0);
});

test("silent when the boolean property declares attribute: false", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    hidden: T.boolean({ attribute: false }),"),
    "views/thing.js": binder("<fx-modal .hidden=${this.x}></fx-modal>"),
  });
  assert.equal(findings.length, 0);
});

test("silent when the boolean property defaults to true", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    visible: T.boolean({ defaultValue: true }),"),
    "views/thing.js": binder("<fx-modal .visible=${this.x}></fx-modal>"),
  });
  assert.equal(findings.length, 0);
});

test("silent when the boolean property defaults to true positionally", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    visible: T.boolean(true),"),
    "views/thing.js": binder("<fx-modal .visible=${this.x}></fx-modal>"),
  });
  assert.equal(findings.length, 0);
});

test("fires when the boolean property defaults to false positionally", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    isOpen: T.boolean(false),"),
    "views/thing.js": binder("<fx-modal .isOpen=${this.x}></fx-modal>"),
  });
  assert.equal(findings.length, 1);
});

test("silent when the boolean property is sync-bound", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal('    dark: T.boolean({ sync: "theme" }),'),
    "views/thing.js": binder("<fx-modal .dark=${this.x}></fx-modal>"),
  });
  assert.equal(findings.length, 0);
});

test("silent on a tag the index cannot resolve", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": binder("<other-widget .isOpen=${this.x}></other-widget>"),
  });
  assert.equal(findings.length, 0);
});

test("silent on a native element", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": binder("<input .disabled=${this.x} />"),
  });
  assert.equal(findings.length, 0);
});

test("silent when the target does not declare the property", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    isOpen: T.boolean(),"),
    "views/thing.js": binder("<fx-modal .isBusy=${this.x}></fx-modal>"),
  });
  assert.equal(findings.length, 0);
});

test("resolves bindings inside nested templates", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    isOpen: T.boolean(),"),
    "views/thing.js": binder('${this.x ? html`<fx-modal .isOpen=${true}></fx-modal>` : ""}'),
  });
  assert.equal(findings.length, 1);
});

test("an expression with an arrow before the binding does not break tag resolution", async () => {
  const findings = await runRuleOn(rule, {
    "views/modal.js": modal("    isOpen: T.boolean(),"),
    "views/thing.js": binder("<fx-modal @close=${() => this.hide()} .isOpen=${this.x}></fx-modal>"),
  });
  assert.equal(findings.length, 1);
});

test("a quoted value holding a tag does not hide the element the binding sits on", async () => {
  const findings = await runRuleOn(rule, {
    "views/target.js": 'export default { tag: "fx-target", props: { open: false } };',
    "views/page.js": 'import { html } from "@bootstrapp/light/html";\nexport default { tag: "fx-page", render() { return html`<fx-target title="a <i> b" .open=${this.o}></fx-target>`; } };',
  });
  assert.deepEqual(findings.map((f) => f.message), [".open on <fx-target>: open is a T.boolean property; bind it as ?open=${...}"]);
});
