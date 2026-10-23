import assert from "node:assert/strict";
import { describe, it, test } from "node:test";

test("diagnostic and name", (t) => {
  t.diagnostic("a note");
  assert.equal(t.name, "diagnostic and name");
});

test("skips itself at runtime", (t) => {
  t.skip("decided at runtime");
});

test("subtests", async (t) => {
  await t.test("a passing subtest", () => assert.ok(true));
  await t.test("another passing subtest", () => assert.ok(true));
});

test("a failing subtest fails the parent", async (t) => {
  await t.test("bad child", () => { throw new Error("child boom"); });
});

test("mock is restored", (t) => {
  const target = { value: () => "real" };
  t.mock.method(target, "value", () => "fake");
  assert.equal(target.value(), "fake");
});

describe("signal", () => {
  it("exposes an AbortSignal", (t) => {
    assert.equal(typeof t.signal.aborted, "boolean");
  });
});
