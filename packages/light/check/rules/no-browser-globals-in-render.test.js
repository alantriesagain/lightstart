import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./no-browser-globals-in-render.js";

test("fires on a browser global read in render", async () => {
  const findings = await runRuleOn(rule, {
    "views/a.js": `export default {
  tag: "fx-a",
  render() { return document.body; },
};
`,
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /document/);
  assert.match(findings[0].message, /connected\(\)/);
});

test("fires in an html template expression", async () => {
  const findings = await runRuleOn(rule, {
    "views/a.js": `export default {
  tag: "fx-a",
  render() { return html\`<p>\${window.innerWidth}</p>\`; },
};
`,
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /window\.innerWidth/);
  assert.match(findings[0].message, /@lightstart\/light\/env/);
});

test("fires in a prop default value", async () => {
  const findings = await runRuleOn(rule, {
    "views/a.js": `export default {
  tag: "fx-a",
  props: { width: T.number({ defaultValue: window.innerWidth }) },
  render() { return null; },
};
`,
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /env/);
});

test("fires at module top level where import runs", async () => {
  const findings = await runRuleOn(rule, {
    "views/a.js": `const stored = localStorage.getItem("theme");
export default {
  tag: "fx-a",
  render() { return null; },
};
`,
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /localStorage/);
  assert.match(findings[0].message, /storage adapter/);
});

test("fires in a View subclass's render", async () => {
  const findings = await runRuleOn(rule, {
    "views/a.js": `import View from "@lightstart/light";
class Thing extends View {
  render() { return history.length; }
}
`,
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /navigation\.path/);
});

test("fires on a layout measurement on anything", async () => {
  const findings = await runRuleOn(rule, {
    "views/a.js": `export default {
  tag: "fx-a",
  render() { return this.offsetWidth; },
};
`,
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /offsetWidth/);
});

test("silent in an event handler", async () => {
  const findings = await runRuleOn(rule, {
    "views/a.js": `export default {
  tag: "fx-a",
  click() { window.alert("x"); },
  render() {
    return html\`<button @click=\${() => window.alert("x")} onClick=\${() => document.title} .onClick=\${this.click}></button>\`;
  },
};
`,
  });
  assert.equal(findings.length, 0);
});

test("silent in connected and other lifecycle hooks", async () => {
  const findings = await runRuleOn(rule, {
    "views/a.js": `export default {
  tag: "fx-a",
  connected() { this.width = window.innerWidth; },
  firstUpdated() { this.title = document.title; },
  render() { return null; },
};
`,
  });
  assert.equal(findings.length, 0);
});

test("silent under a typeof window guard", async () => {
  const findings = await runRuleOn(rule, {
    "views/a.js": `export default {
  tag: "fx-a",
  render() {
    if (typeof window !== "undefined") return window.innerWidth;
    return typeof window === "undefined" ? 0 : window.innerHeight;
  },
};
`,
  });
  assert.equal(findings.length, 0);
});

test("silent in a file that is not a view", async () => {
  const findings = await runRuleOn(rule, {
    "views/a.js": `export default { tag: "fx-a", render() { return null; } };
`,
    "lib/util.js": `export const width = window.innerWidth;
export const el = document.body;
`,
  });
  assert.equal(findings.length, 0);
});
