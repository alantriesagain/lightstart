import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Listeners } from "./listeners.ts";

/**
 * Run the same script against a Set and a Listeners and answer what each
 * visited.
 * @param {(list: { add(cb: Function): unknown, delete(cb: Function): boolean, clear(): void, forEach(run: (cb: Function) => void): void, readonly size: number }, cbs: Record<string, Function>, log: string[]) => void} script
 */
const both = (script) => {
  const run = (/** @type {any} */ list) => {
    /** @type {string[]} */
    const log = [];
    /** @type {Record<string, Function>} */
    const cbs = {};
    for (const name of ["a", "b", "c", "d"]) cbs[name] = () => log.push(name);
    script(list, cbs, log);
    return log;
  };
  return { set: run(new Set()), listeners: run(new Listeners()) };
};

describe("@bootstrapp/light/signals/listeners", () => {
  it("holds a callback once, in insertion order", () => {
    const { set, listeners } = both((list, { a, b }, log) => {
      list.add(a);
      list.add(b);
      list.add(a);
      list.forEach((cb) => cb());
      log.push(String(list.size));
    });
    assert.deepEqual(listeners, set);
    assert.deepEqual(set, ["a", "b", "2"]);
  });

  it("reaches a callback added during a run, skips one removed before its turn, and keeps one removed after it", () => {
    const { set, listeners } = both((list, { a, b, c, d }) => {
      const removeC = () => list.delete(c);
      list.add(a);
      list.add(removeC);
      list.add(b);
      list.add(c);
      list.forEach((cb) => {
        cb();
        if (cb === b) list.add(d);
        if (cb === a) list.delete(a);
      });
      list.forEach((cb) => cb());
    });
    assert.deepEqual(listeners, set);
  });

  it("re-reaches a callback removed and added again during a run, and stops at a clear", () => {
    const { set, listeners } = both((list, { a, b, c }, log) => {
      list.add(a);
      list.add(b);
      list.add(c);
      list.forEach((cb) => {
        cb();
        if (cb === a) {
          list.delete(a);
          list.add(a);
        }
        if (cb === b) list.clear();
      });
      log.push(String(list.size));
      list.add(c);
      list.forEach((cb) => cb());
    });
    assert.deepEqual(listeners, set);
  });

  it("answers delete like a Set", () => {
    const list = new Listeners();
    const cb = () => {};
    assert.equal(list.delete(cb), false);
    list.add(cb);
    assert.equal(list.has(cb), true);
    assert.equal(list.delete(cb), true);
    assert.equal(list.has(cb), false);
    assert.equal(list.size, 0);
  });
});
