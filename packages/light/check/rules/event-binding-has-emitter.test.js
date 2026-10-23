import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./event-binding-has-emitter.js";

const LIST = `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-list",
  events: { "row-pick": T.object() },
  select(row) { this.$emit("row-pick", { row }); },
  render() { return html\`<div></div>\`; },
};
`;

test("fires on a binding for an event the target never emits nor declares", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": LIST,
    "views/page.js": `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-page",
  render() {
    return html\`<fx-list .rows=\${this.rows} @row-click=\${(e) => this.open(e)}></fx-list>\`;
  },
};
`,
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /row-click/);
  assert.match(findings[0].message, /fx-list/);
});

test("silent when the event is declared or emitted by the target", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": LIST,
    "views/page.js": `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-page",
  render() {
    return html\`<fx-list @row-pick=\${(e) => this.open(e)}></fx-list>\`;
  },
};
`,
  });
  assert.equal(findings.length, 0);
});

test("silent when a fragment the target lists under mixins declares the event", async () => {
  const findings = await runRuleOn(rule, {
    "views/sheet-ui.js": `import { defineMixin } from "@bootstrapp/light";
export const withSheet = () => defineMixin({
  events: { "sheet-closed": T.object({}) },
  sheet(body) { return body(); },
});
`,
    "views/spot-sheet.js": `import { html } from "@bootstrapp/light/html";
import { withSheet } from "./sheet-ui.js";
export default {
  tag: "fx-spot-sheet",
  mixins: [withSheet()],
  render() { return this.sheet(() => html\`<div></div>\`); },
};
`,
    "views/page.js": `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-page",
  render() {
    return html\`<fx-spot-sheet @sheet-closed=\${() => this.closed()}></fx-spot-sheet><fx-spot-sheet @sheet-gone=\${() => this.closed()}></fx-spot-sheet>\`;
  },
};
`,
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /sheet-gone/);
});

test("silent on native events, unresolvable tags, and elements with children", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": LIST,
    "views/page.js": `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-page",
  render() {
    return html\`
      <fx-list @change=\${(e) => this.onChange(e)}></fx-list>
      <lc-unknown-widget @row-click=\${(e) => this.open(e)}></lc-unknown-widget>
      <fx-list @row-click=\${(e) => this.open(e)}><span>child</span></fx-list>
      <fx-list @row-click=\${(e) => this.open(e)}>\${this.renderChildren()}</fx-list>
      <div @custom-thing=\${(e) => this.open(e)}></div>
    \`;
  },
};
`,
  });
  assert.equal(findings.length, 0);
});

test("silent when a checkable file dispatches the event with bubbles: true", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": LIST,
    "views/inner.js": `export default {
  tag: "fx-inner",
  fire() { this.dispatchEvent(new CustomEvent("deep-cancel", { bubbles: true })); },
  render() { return null; },
};
`,
    "views/page.js": `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-page",
  render() {
    return html\`<fx-list @deep-cancel=\${() => this.stop()}></fx-list>\`;
  },
};
`,
  });
  assert.equal(findings.length, 0);
});

test("silent on the events a host's plugins make every component emit, like dataLoaded", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": LIST,
    "views/page.js": `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-page",
  render() {
    return html\`<fx-list @dataLoaded=\${() => this.refresh()}></fx-list>\`;
  },
};
`,
  }, { host: { pluginEvents: ["dataLoaded"] } });
  assert.equal(findings.length, 0);
});

test("handles arrow functions with > inside the binding expression", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": LIST,
    "views/page.js": `import { html } from "@bootstrapp/light/html";
export default {
  tag: "fx-page",
  render() {
    return html\`<fx-list .filter=\${(a) => a.n > 2} @dead-event=\${() => this.go()}></fx-list>\`;
  },
};
`,
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /dead-event/);
});

test("a quoted value holding a tag does not hide the element the listener sits on", async () => {
  const findings = await runRuleOn(rule, {
    "views/list.js": 'export default { tag: "fx-list", render() { return null; } };',
    "views/page.js": 'import { html } from "@bootstrapp/light/html";\nexport default { tag: "fx-page", render() { return html`<fx-list title="a <i> b" @row-click=${this.pick}></fx-list>`; } };',
  });
  assert.deepEqual(findings.map((f) => f.message), ['@row-click on <fx-list>: the component neither declares nor dispatches "row-click"; this handler can never run']);
});
