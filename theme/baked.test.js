import assert from "node:assert/strict";
import test from "node:test";
import { STATE_FOCUS } from "../tdom/classes.ts";
import { BakedClasses } from "./baked.ts";

const styler = new BakedClasses([
  ["flex-1", [["flex", 1, 0]]],
  ["text-muted focus:font-bold", [["fg", "#7f857e", 0], ["bold", true, STATE_FOCUS]]],
]);

/** @param {string} classes */
const seen = (classes) => styler.propsFor(classes).map((p) => `${p.name}=${String(p.value)}@${String(p.state)}`);

test("a baked string answers its props with their states, the same list each time", () => {
  assert.deepEqual(seen("text-muted focus:font-bold"), ["fg=#7f857e@0", `bold=true@${String(STATE_FOCUS)}`]);
  assert.equal(styler.propsFor("flex-1"), styler.propsFor("flex-1"));
  assert.equal(styler.ignored.size, 0);
});

test("a string the table lacks, even one whose tokens it holds apart, styles nothing and lists its tokens", () => {
  assert.deepEqual(seen("flex-1 border"), []);
  assert.deepEqual([...styler.ignored].sort(), ["border", "flex-1"]);
});

test("the empty string ignores nothing", () => {
  const fresh = new BakedClasses([]);
  assert.deepEqual(fresh.propsFor(""), []);
  assert.equal(fresh.ignored.size, 0);
});
