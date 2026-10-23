import assert from "node:assert/strict";
import { describe, it, test } from "node:test";

test("flat and passing", () => {
  assert.ok(true);
});

test("flat and failing", () => {
  assert.equal("actual", "expected");
});

test("skipped by option", { skip: true }, () => {
  throw new Error("must never run");
});

test.skip("skipped by modifier", () => {
  throw new Error("must never run");
});

test("todo by option", { todo: true }, () => {});

test.todo("todo by modifier");

test("no body");

describe("a suite", () => {
  it("passes inside", () => assert.ok(true));
  it("fails inside", () => { throw new Error("inner boom"); });
  it.skip("skipped inside", () => {});
});

describe.skip("a skipped suite", () => {
  it("never runs", () => { throw new Error("must never run"); });
});

test("rejects", async () => {
  await Promise.reject(new Error("rejected"));
});
