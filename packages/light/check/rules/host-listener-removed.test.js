import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./host-listener-removed.js";

const component = (body) => `import { defineComponent } from "@bootstrapp/light";
export default defineComponent({
  tag: "fx-thing",
${body}
});
`;

test("fires on an anonymous listener added in connected() and never removed", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": component(`  connected() {
    this.addEventListener("pointerdown", (e) => this._begin(e));
  },`),
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /pointerdown/);
  assert.match(findings[0].message, /every remount adds another/);
});

test("reports each type that was left behind", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": component(`  connected() {
    this.addEventListener("pointerdown", (e) => this._down(e));
    this.addEventListener("pointermove", (e) => this._move(e));
    this.addEventListener("pointerup", (e) => this._up(e));
    this.addEventListener("pointercancel", (e) => this._up(e));
  },`),
  });
  assert.equal(findings.length, 4);
});

test("silent when the removal is registered through $own", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": component(`  connected() {
    const onDown = (e) => this._begin(e);
    this.addEventListener("pointerdown", onDown);
    this.$own(() => this.removeEventListener("pointerdown", onDown));
  },`),
  });
  assert.equal(findings.length, 0);
});

test("silent when the removal lives in another method", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": component(`  connected() {
    this.addEventListener("scroll", this._onScroll);
  },
  disconnected() {
    this.removeEventListener("scroll", this._onScroll);
  },`),
  });
  assert.equal(findings.length, 0);
});

test("a removal of a different type does not satisfy the add", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": component(`  connected() {
    this.addEventListener("pointerdown", this._down);
    this.$own(() => this.removeEventListener("pointerup", this._down));
  },`),
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /pointerdown/);
});

test("silent on a listener added in firstUpdated, which runs once per element", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": component(`  firstUpdated() {
    this.addEventListener("click", (e) => this._route(e));
  },`),
  });
  assert.equal(findings.length, 0, "removing that one on disconnect would never re-add it");
});

test("catches a document listener a component opens in connected()", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": component(`  connected() {
    document.addEventListener("keydown", (e) => this._key(e));
  },`),
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /document\.addEventListener/);
});

test("silent when the event name is a variable it cannot read", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": component(`  connected() {
    for (const name of this.events) this.addEventListener(name, this._any);
  },`),
  });
  assert.equal(findings.length, 0);
});

test("silent on a component with no connected() at all", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": component(`  updated() {
    this.addEventListener("click", this._click);
  },`),
  });
  assert.equal(findings.length, 0);
});

test("silent on a component that adds no listeners", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": component(`  connected() {
    this.$own(() => this._stop());
  },`),
  });
  assert.equal(findings.length, 0);
});

test("an example in a doc comment is not code", async () => {
  const findings = await runRuleOn(rule, {
    "views/thing.js": `import { defineComponent } from "@bootstrapp/light";
export default defineComponent({
  tag: "fx-thing",
  /**
   * connected() {
   *   this.addEventListener("pointerdown", (e) => this._begin(e));
   * }
   */
  connected() {
    this.$own(() => this._stop());
  },
});
`,
  });
  assert.equal(findings.length, 0);
});
