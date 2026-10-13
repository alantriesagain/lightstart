import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resource, keyedResource } from "./resource.js";

const deferred = () => {
  /** @type {(value?: unknown) => void} */
  let resolve = () => {};
  /** @type {(error?: unknown) => void} */
  let reject = () => {};
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const fakeBus = () => {
  const listeners = new Map();
  return {
    on(key, cb) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(cb);
      return () => listeners.get(key)?.delete(cb);
    },
    emit(key, payload) {
      return Promise.all([...(listeners.get(key) ?? [])].map((cb) => cb(payload)));
    },
  };
};

describe("@bootstrapp/light/controller/resource: resource() semantics", () => {
  describe("ensure()", () => {
    it("dedupes concurrent calls into one fetch", async () => {
      let calls = 0;
      const d = deferred();
      const res = resource(() => (calls++, d.promise), { ready: false });
      const p1 = res.ensure();
      const p2 = res.ensure();
      d.resolve("value");
      assert.equal(await p1, "value");
      assert.equal(await p2, "value");
      assert.equal(calls, 1);
      res.dispose();
    });

    it("retries after a failed first load", async () => {
      let calls = 0;
      const res = resource(() => {
        calls++;
        if (calls === 1) return Promise.reject(new Error("boom"));
        return Promise.resolve("recovered");
      }, { ready: false });
      let threw = false;
      try {
        await res.ensure();
      } catch {
        threw = true;
      }
      assert.equal(threw, true);
      assert.equal(res.error.peek()?.message, "boom");
      assert.equal(await res.ensure(), "recovered");
      assert.equal(res.error.peek(), null);
      res.dispose();
    });
  });

  describe("refresh(): stale-while-revalidate", () => {
    it("keeps the last good value until the new answer lands", async () => {
      let calls = 0;
      const gate = { current: null };
      const res = resource(() => {
        calls++;
        if (calls === 1) return Promise.resolve("first");
        gate.current = deferred();
        return gate.current.promise;
      }, { ready: false });
      await res.ensure();
      const refreshing = res.refresh();
      assert.equal(res.peek(), "first");
      assert.equal(res.pending.peek(), true);
      gate.current.resolve("second");
      await refreshing;
      assert.equal(res.peek(), "second");
      res.dispose();
    });
  });

  describe("mutate()", () => {
    it("applies a synchronous local write through a new reference", async () => {
      const res = resource(() => Promise.resolve(new Map([["a", 1]])), { ready: false });
      await res.ensure();
      const seen = [];
      const off = res.subscribe((v) => seen.push(v));
      res.mutate((current) => new Map(current).set("b", 2));
      assert.equal(res.peek().get("b"), 2);
      assert.equal(seen.length, 2);
      off();
      res.dispose();
    });
  });

  describe("invalidateOn + filter", () => {
    it("refreshes on a matching event and the emit awaits the refetch", async () => {
      let calls = 0;
      const bus = fakeBus();
      const res = resource(() => Promise.resolve(++calls), {
        ready: false,
        events: bus,
        invalidateOn: "content:updated",
        filter: (p) => p?.collection === "map",
      });
      await res.ensure();
      assert.equal(res.peek(), 1);
      await bus.emit("content:updated", { collection: "other" });
      assert.equal(res.peek(), 1);
      await bus.emit("content:updated", { collection: "map" });
      assert.equal(res.peek(), 2);
      res.dispose();
    });
  });

  describe("dependsOn", () => {
    it("re-fetches when a dependency's value changes", async () => {
      let depCalls = 0;
      let joinCalls = 0;
      const dep = resource(() => Promise.resolve(++depCalls), { ready: false });
      const join = resource(() => Promise.resolve(++joinCalls), { ready: false, dependsOn: [dep] });
      await dep.ensure();
      await join.ensure();
      assert.equal(join.peek(), 1);
      await dep.refresh();
      await tick(10);
      assert.equal(join.peek(), 2);
      join.dispose();
      dep.dispose();
    });
  });

  describe("keyedResource", () => {
    it("memoizes per key and invalidate(key) drops the entry", async () => {
      let calls = 0;
      const keyed = keyedResource((key) => Promise.resolve(`${key}:${++calls}`), { ready: false });
      assert.equal(await keyed.get("a").ensure(), "a:1");
      assert.equal(await keyed.get("a").ensure(), "a:1");
      assert.equal(await keyed.get("b").ensure(), "b:2");
      keyed.invalidate("a");
      assert.equal(await keyed.get("a").ensure(), "a:3");
      assert.deepEqual(keyed.keys().sort(), ["a", "b"]);
      keyed.dispose();
    });
  });
});
