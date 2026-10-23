import assert from "node:assert/strict";
import test from "node:test";
import { MockTracker } from "./mock.js";

test("fn records calls in node's shape", () => {
  const mock = new MockTracker();
  const fn = mock.fn((/** @type {number} */ a, /** @type {number} */ b) => a + b);
  assert.equal(fn(1, 2), 3);
  assert.equal(fn(3, 4), 7);
  assert.equal(fn.mock.callCount(), 2);
  assert.deepEqual(fn.mock.calls[0].arguments, [1, 2]);
  assert.equal(fn.mock.calls[0].result, 3);
  assert.equal(fn.mock.calls[1].error, undefined);
});

test("fn with no implementation returns undefined and still records", () => {
  const mock = new MockTracker();
  const fn = mock.fn();
  assert.equal(fn("x"), undefined);
  assert.equal(fn.mock.callCount(), 1);
  assert.deepEqual(fn.mock.calls[0].arguments, ["x"]);
});

test("a throwing implementation records the error and rethrows", () => {
  const mock = new MockTracker();
  const fn = mock.fn(() => { throw new Error("boom"); });
  assert.throws(() => fn(), /boom/);
  const { error } = fn.mock.calls[0];
  assert.equal(error instanceof Error ? error.message : error, "boom");
});

test("mockImplementation and mockImplementationOnce", () => {
  const mock = new MockTracker();
  const fn = mock.fn(() => "base");
  assert.equal(fn(), "base");
  fn.mock.mockImplementation(() => "replaced");
  assert.equal(fn(), "replaced");
  fn.mock.mockImplementationOnce(() => "once", 2);
  assert.equal(fn(), "once");
  assert.equal(fn(), "replaced");
});

test("async implementations work through the same path", async () => {
  const mock = new MockTracker();
  const fn = mock.fn(async () => "resolved");
  assert.equal(await fn(), "resolved");
  assert.equal(fn.mock.callCount(), 1);
});

test("method replaces and restores", () => {
  const mock = new MockTracker();
  const target = { greet: () => "real", other: 1 };
  const spy = mock.method(target, "greet", () => "fake");
  assert.equal(target.greet(), "fake");
  assert.equal(spy.mock.callCount(), 1);
  spy.mock.restore();
  assert.equal(target.greet(), "real");
});

test("method with no implementation still calls through", () => {
  const mock = new MockTracker();
  const target = { double: (/** @type {number} */ n) => n * 2 };
  const spy = mock.method(target, "double");
  assert.equal(target.double(21), 42);
  assert.equal(spy.mock.callCount(), 1);
});

test("restoreAll puts every method back", () => {
  const mock = new MockTracker();
  const a = { fn: () => "a" };
  const b = { fn: () => "b" };
  mock.method(a, "fn", () => "x");
  mock.method(b, "fn", () => "y");
  assert.equal(a.fn(), "x");
  assert.equal(b.fn(), "y");
  mock.restoreAll();
  assert.equal(a.fn(), "a");
  assert.equal(b.fn(), "b");
});

test("getter and setter", () => {
  const mock = new MockTracker();
  const target = { _value: 1, get value() { return this._value; }, set value(v) { this._value = v; } };
  const getter = mock.getter(target, "value", () => 99);
  assert.equal(target.value, 99);
  assert.equal(getter.mock.callCount(), 1);
  mock.restoreAll();
  assert.equal(target.value, 1);

  const setter = mock.setter(target, "value", /** @this {{ _value: number }} */ function (/** @type {number} */ v) { this._value = v * 2; });
  target.value = 5;
  assert.equal(setter.mock.callCount(), 1);
  assert.equal(target._value, 10);
  mock.restoreAll();
  target.value = 3;
  assert.equal(target._value, 3);
});

test("resetCalls clears history without removing the mock", () => {
  const mock = new MockTracker();
  const fn = mock.fn(() => 1);
  fn();
  fn();
  assert.equal(fn.mock.callCount(), 2);
  fn.mock.resetCalls();
  assert.equal(fn.mock.callCount(), 0);
  assert.equal(fn(), 1);
});

test("the unsupported members throw a named error instead of no-opping", () => {
  const mock = new MockTracker();
  assert.throws(() => /** @type {(specifier: string) => void} */ (mock.module)("./x.js"), /mock\.module is not available in the browser test runner/);
  assert.throws(() => mock.timers.enable(), /mock\.timers is not available in the browser test runner/);
});
