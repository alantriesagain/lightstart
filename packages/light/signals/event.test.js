import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { event, Emitter } from "@lightstart/light/signals";

describe("light/signals event()", () => {
  it("delivers to every listener in the order they were added", () => {
    const e = event();
    /** @type {string[]} */
    const log = [];
    e.on(() => log.push("a"));
    e.on(() => log.push("b"));
    e.on(() => log.push("c"));
    e.emit();
    assert.deepEqual(log, ["a", "b", "c"]);
  });

  it("returns an unsubscribe that stops that listener", () => {
    const e = event();
    /** @type {number[]} */
    const seen = [];
    const off = e.on((v) => seen.push(v));
    e.emit(1);
    off();
    e.emit(2);
    assert.deepEqual(seen, [1]);
    assert.equal(e.size, 0);
  });

  it("once hears one value only", () => {
    const e = event();
    /** @type {number[]} */
    const seen = [];
    e.once((v) => seen.push(v));
    e.emit(1);
    e.emit(2);
    assert.deepEqual(seen, [1]);
    assert.equal(e.size, 0);
  });

  it("off(owner) drops only that owner's listeners", () => {
    const e = event();
    /** @type {string[]} */
    const log = [];
    e.on(() => log.push("a"), "one");
    e.on(() => log.push("b"), "two");
    e.on(() => log.push("c"), "one");
    e.off("one");
    e.emit();
    assert.deepEqual(log, ["b"]);
    assert.equal(e.size, 1);
  });

  it("size counts listeners, including duplicated on(fn) calls", () => {
    const e = event();
    const fn = () => {};
    assert.equal(e.size, 0);
    const offA = e.on(fn);
    const offB = e.on(fn);
    assert.equal(e.size, 2);
    offA();
    assert.equal(e.size, 1);
    offB();
    assert.equal(e.size, 0);
  });

  it("a listener added during delivery misses the current value but hears the next", () => {
    const e = event();
    /** @type {string[]} */
    const log = [];
    e.on((v) => {
      log.push(`a:${v}`);
      if (v === 1) e.on((next) => log.push(`late:${next}`));
    });
    e.emit(1);
    assert.deepEqual(log, ["a:1"]);
    e.emit(2);
    assert.deepEqual(log, ["a:1", "a:2", "late:2"]);
  });

  it("a listener removed during delivery before its turn is skipped", () => {
    const e = event();
    /** @type {string[]} */
    const log = [];
    e.on(() => {
      log.push("a");
      off();
    });
    const off = e.on(() => log.push("b"));
    e.emit();
    assert.deepEqual(log, ["a"]);
  });

  it("an emit from inside a listener is delivered after the pass", () => {
    const e = event();
    /** @type {string[]} */
    const log = [];
    e.on((v) => {
      log.push(`a:${v}`);
      if (v === 1) e.emit(2);
    });
    e.on((v) => log.push(`b:${v}`));
    e.emit(1);
    assert.deepEqual(log, ["a:1", "b:1", "a:2", "b:2"]);
  });

  it("an endless self-emit throws the loop error and the emitter still works", () => {
    const e = event();
    const off = e.on((v) => e.emit(v + 1));
    assert.throws(() => e.emit(0), /more than 100 times in one delivery/);
    off();
    /** @type {number[]} */
    const seen = [];
    e.on((v) => seen.push(v));
    e.emit(5);
    assert.deepEqual(seen, [5]);
  });

  it("a throwing listener does not stop the next one, and its error is rethrown after", () => {
    const e = event();
    /** @type {string[]} */
    const log = [];
    e.on(() => {
      log.push("a");
      throw new Error("boom");
    });
    e.on(() => log.push("b"));
    assert.throws(() => e.emit(), /boom/);
    assert.deepEqual(log, ["a", "b"]);
  });

  it("event() with no payload emits with no argument", () => {
    const e = event();
    let fired = 0;
    e.on(() => fired++);
    e.emit();
    assert.equal(fired, 1);
    assert.equal(e instanceof Emitter, true);
  });
});
