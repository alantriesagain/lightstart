import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./declare-instance-surface.js";

const component = (body, head = "") => `${head}import { defineComponent } from "@bootstrapp/light";
import T from "@bootstrapp/light/types";
export default defineComponent({
  tag: "fx-list",
  props: { rows: T.array({ defaultValue: [] }), _io: T.object({ reactive: false, defaultValue: null }) },
${body}
});
`;

const names = (findings) => findings.map((f) => f.message.match(/this\.(\w+)/)[1]).sort();

test("a _-prefixed field first assigned in a hook is flagged once", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": component(`  connected() { this._timer = setTimeout(() => {}, 1); this._timer = null; },
  disconnected() { clearTimeout(this._timer); },`),
  });
  assert.deepEqual(names(findings), ["_timer"]);
  assert.match(findings[0].message, /reactive: false/);
});

test("declared properties, literal methods, engine fields and DOM members are not flagged", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": component(`  connected() { this._io = new IntersectionObserver(() => this._draw()); this.$ctor.observedAttributes; },
  _draw() { this.querySelector("canvas"); this.rows.length; this.$requestUpdate(); },
  render() { return null; },`),
  });
  assert.deepEqual(findings, []);
});

test("a field a view mixin declares counts as declared", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": component(`  connected() { this._raf = 1; this._orphan = 2; },`, 'import { withRaf } from "./mixins/with-raf.js";\n').replace('tag: "fx-list",', 'tag: "fx-list",\n  mixins: [withRaf],'),
    "views/mixins/with-raf.js": `import { defineMixin } from "@bootstrapp/light";
export const withRaf = defineMixin({ props: { _raf: { reactive: false, defaultValue: 0 } } });
`,
  });
  assert.deepEqual(names(findings), ["_orphan"]);
});

test("a field a mixin declares counts as declared through the package's own bare specifier", async () => {
  const pkgJson = {
    name: "@bootstrapp/light",
    bootstrapp: { components: { fx: { list: "views/list.js" } } },
  };
  const findings = await runRuleOn(
    rule,
    {
      "views/list.js": component(
        `  connected() { this._raf = 1; this._orphan = 2; },`,
        'import { withRaf } from "@bootstrapp/light/components/mixins/with-raf.js";\n',
      ).replace('tag: "fx-list",', 'tag: "fx-list",\n  mixins: [withRaf],'),
      "components/mixins/with-raf.js": `import { defineMixin } from "@bootstrapp/light";
export const withRaf = defineMixin({ props: { _raf: { reactive: false, defaultValue: 0 } } });
`,
    },
    { pkgJson },
  );
  assert.deepEqual(names(findings), ["_orphan"]);
});

test("a field the extended component declares counts as declared", async () => {
  const pkgJson = {
    name: "fixture",
    bootstrapp: { prefix: "fx", components: { fx: "views/" } },
  };
  const findings = await runRuleOn(
    rule,
    {
      "views/base.js": `import { defineComponent } from "@bootstrapp/light";
export default defineComponent({
  tag: "fx-base",
  props: { _slot: { reactive: false, defaultValue: null } },
  _close() {},
});
`,
      "views/child.js": `import { defineComponent } from "@bootstrapp/light";
export default defineComponent({
  tag: "fx-child",
  extends: "fx-base",
  connected() { this._close(); this._slot = 1; this._orphan = 2; },
});
`,
    },
    { pkgJson },
  );
  assert.deepEqual(names(findings), ["_orphan"]);
});

test("a field declared in View.define's props argument is declared", async () => {
  const src = `import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
View.define("fx-io", { _io: T.object({ reactive: false, defaultValue: null }) }, {
  connected() { this._io = new IntersectionObserver(() => {}); this._stray = 1; },
  render() { return html\`<i></i>\`; },
});
`;
  const findings = await runRuleOn(rule, { "views/io.js": src });
  assert.deepEqual(findings.map((f) => f.message.includes("_stray")), [true]);
});
