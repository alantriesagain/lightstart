import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runsOf } from "./prose.js";

describe("the native pages' inline marks", () => {
  it("leaves plain text as one run", () => {
    assert.deepEqual(runsOf("no marks here"), [{ kind: "text", text: "no marks here" }]);
  });

  it("reads code in backticks and links in brackets, in order", () => {
    assert.deepEqual(runsOf("`count` lives in [a register](/native/scriptc#machine-code), not `this`"), [
      { kind: "code", text: "count" },
      { kind: "text", text: " lives in " },
      { kind: "link", text: "a register", href: "/native/scriptc#machine-code" },
      { kind: "text", text: ", not " },
      { kind: "code", text: "this" },
    ]);
  });

  it("keeps brackets inside code as code", () => {
    assert.deepEqual(runsOf("`slots[i as number]`"), [{ kind: "code", text: "slots[i as number]" }]);
  });

  it("reads a defined term in double asterisks", () => {
    assert.deepEqual(runsOf("a **box** holds a tag"), [
      { kind: "text", text: "a " },
      { kind: "term", text: "box" },
      { kind: "text", text: " holds a tag" },
    ]);
  });
});
