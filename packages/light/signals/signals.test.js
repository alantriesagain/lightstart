import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signal, computed, effect, batch, untracked, selector, getCurrentEffect, Signal } from "@bootstrapp/light/signals";

describe("light/signals", () => {
  describe("signal()", () => {
    it("should create a signal with initial value", () => {
      const count = signal(0);
      assert.equal(count.value, 0);
    });

    it("should return value via .value getter", () => {
      const name = signal("test");
      assert.equal(name.value, "test");
    });

    it("should update value via .value setter", () => {
      const count = signal(0);
      count.value = 5;
      assert.equal(count.value, 5);
    });

    it("should not trigger subscribers when value is unchanged", () => {
      const count = signal(0);
      let callCount = 0;
      effect(() => {
        count.value;
        callCount++;
      });
      assert.equal(callCount, 1);
      count.value = 0;
      assert.equal(callCount, 1);
    });

    it("should return initial value via peek() without tracking", () => {
      const count = signal(10);
      effect(() => {
        count.peek();
      });
      assert.equal(count.peek(), 10);
      count.value = 20;
      assert.equal(count.peek(), 20);
    });

    it("should support subscribe() method", () => {
      const count = signal(0);
      let receivedValue = null;
      const unsubscribe = count.subscribe((val) => {
        receivedValue = val;
      });
      assert.equal(receivedValue, 0);
      count.value = 5;
      assert.equal(receivedValue, 5);
      unsubscribe();
      count.value = 10;
      assert.equal(receivedValue, 5);
    });

    it("subscribe callback reads are not tracked into its effect", () => {
      const source = signal(0);
      const other = signal(10);
      let fired = 0;
      const off = source.subscribe(() => {
        fired++;
        other.value = other.value + 1;
      });
      assert.equal(fired, 1);
      assert.equal(other.value, 11);
      other.value = 99;
      assert.equal(fired, 1);
      source.value = 1;
      assert.equal(fired, 2);
      off();
    });

    it("should serialize to JSON correctly via toJSON()", () => {
      const obj = signal({ name: "test", count: 5 });
      assert.equal(JSON.stringify(obj), '{"name":"test","count":5}');
    });

    it("should convert to string via toString()", () => {
      const str = signal("hello");
      assert.equal(str.toString(), "hello");

      const num = signal(42);
      assert.equal(num.toString(), "42");
    });

    it("should return primitive via valueOf()", () => {
      const num = signal(42);
      assert.equal(num.valueOf(), 42);
    });

    it("should be instance of Signal class", () => {
      const s = signal(0);
      assert.equal(s instanceof Signal, true);
    });
  });

  describe("computed()", () => {
    it("should create a computed signal from function", () => {
      const count = signal(5);
      const double = computed(() => count.value * 2);
      assert.equal(double.value, 10);
    });

    it("should auto-track dependencies", () => {
      const a = signal(1);
      const b = signal(2);
      const sum = computed(() => a.value + b.value);
      assert.equal(sum.value, 3);
      a.value = 10;
      assert.equal(sum.value, 12);
    });

    it("should recompute when dependencies change", () => {
      const count = signal(1);
      let computeCount = 0;
      const double = computed(() => {
        computeCount++;
        return count.value * 2;
      });
      assert.equal(double.value, 2);
      assert.equal(computeCount, 1);
      count.value = 5;
      assert.equal(double.value, 10);
      assert.equal(computeCount, 2);
    });

    it("should cache value when dependencies unchanged", () => {
      const count = signal(1);
      let computeCount = 0;
      const double = computed(() => {
        computeCount++;
        return count.value * 2;
      });
      double.value;
      double.value;
      double.value;
      assert.equal(computeCount, 1);
    });

    it("should throw when trying to set computed value", () => {
      const count = signal(1);
      const double = computed(() => count.value * 2);
      assert.throws(() => {
        double.value = 10;
      }, /getter/);
    });

    it("should handle nested computed signals", () => {
      const a = signal(1);
      const b = computed(() => a.value * 2);
      const c = computed(() => b.value + 1);
      assert.equal(c.value, 3);
      a.value = 5;
      assert.equal(c.value, 11);
    });

    it("should handle diamond dependency patterns", () => {
      const a = signal(1);
      const b = computed(() => a.value * 2);
      const c = computed(() => a.value * 3);
      const d = computed(() => b.value + c.value);
      assert.equal(d.value, 5);
      a.value = 2;
      assert.equal(d.value, 10);
    });

    it("should be a Computed instance", () => {
      const c = computed(() => 1);
      assert.equal(c.constructor.name, "Computed");
    });
  });

  describe("selector()", () => {
    it("answers key === current value", () => {
      const sel = signal(3);
      const isSelected = selector(sel);
      assert.equal(isSelected(3), true);
      assert.equal(isSelected(4), false);
      sel.value = 4;
      assert.equal(isSelected(3), false);
      assert.equal(isSelected(4), true);
    });

    it("re-runs only the effects registered under the old and new keys", () => {
      const sel = signal(0);
      const isSelected = selector(sel);
      const runs = new Map();
      const effects = [];
      for (let id = 0; id < 100; id++)
        effects.push(
          effect(() => {
            isSelected(id);
            runs.set(id, (runs.get(id) ?? 0) + 1);
          }),
        );
      for (let id = 0; id < 100; id++) assert.equal(runs.get(id), 1);
      sel.value = 42;
      assert.equal(runs.get(0), 2);
      assert.equal(runs.get(42), 2);
      let others = 0;
      for (let id = 1; id < 100; id++) if (id !== 42 && runs.get(id) > 1) others++;
      assert.equal(others, 0);
      sel.value = 7;
      assert.equal(runs.get(42), 3);
      assert.equal(runs.get(7), 2);
      assert.equal(runs.get(0), 2);
      effects.forEach((e) => e.dispose());
    });

    it("works with string keys", () => {
      const route = signal("home");
      const isActive = selector(route);
      let homeRuns = 0;
      let aboutRuns = 0;
      effect(() => {
        isActive("home");
        homeRuns++;
      });
      effect(() => {
        isActive("about");
        aboutRuns++;
      });
      route.value = "about";
      assert.equal(homeRuns, 2);
      assert.equal(aboutRuns, 2);
      route.value = "contact";
      assert.equal(homeRuns, 2);
      assert.equal(aboutRuns, 3);
    });

    it("follows an effect that changes which key it asks about", () => {
      const sel = signal(1);
      const isSelected = selector(sel);
      const watched = signal(1);
      let runs = 0;
      effect(() => {
        isSelected(watched.value);
        runs++;
      });
      assert.equal(runs, 1);
      watched.value = 2;
      assert.equal(runs, 2);
      sel.value = 1;
      assert.equal(runs, 2);
      sel.value = 2;
      assert.equal(runs, 3);
    });

    it("returns a plain answer outside an effect without subscribing", () => {
      const sel = signal(5);
      const isSelected = selector(sel);
      assert.equal(isSelected(5), true);
      sel.value = 6;
      assert.equal(isSelected(6), true);
    });

    it("stops notifying a disposed effect", () => {
      const sel = signal(0);
      const isSelected = selector(sel);
      let runs = 0;
      const eff = effect(() => {
        isSelected(9);
        runs++;
      });
      eff.dispose();
      sel.value = 9;
      assert.equal(runs, 1);
    });
  });

  describe("effect()", () => {
    it("should run immediately on creation", () => {
      let ran = false;
      effect(() => {
        ran = true;
      });
      assert.equal(ran, true);
    });

    it("should auto-track signal dependencies", () => {
      const count = signal(0);
      let effectValue = null;
      effect(() => {
        effectValue = count.value;
      });
      assert.equal(effectValue, 0);
    });

    it("should re-run when tracked signals change", () => {
      const count = signal(0);
      let runCount = 0;
      effect(() => {
        count.value;
        runCount++;
      });
      assert.equal(runCount, 1);
      count.value = 1;
      assert.equal(runCount, 2);
      count.value = 2;
      assert.equal(runCount, 3);
    });

    it("should cleanup old subscriptions on re-run", () => {
      const a = signal(true);
      const b = signal(1);
      const c = signal(2);
      let effectResult = null;

      effect(() => {
        effectResult = a.value ? b.value : c.value;
      });

      assert.equal(effectResult, 1);
      a.value = false;
      assert.equal(effectResult, 2);
      b.value = 10;
      assert.equal(effectResult, 2);
    });

    it("should dispose via dispose() method", () => {
      const count = signal(0);
      let runCount = 0;
      const eff = effect(() => {
        count.value;
        runCount++;
      });
      assert.equal(runCount, 1);
      eff.dispose();
      count.value = 1;
      assert.equal(runCount, 1);
    });

    it("should not run after disposal", () => {
      const count = signal(0);
      let runCount = 0;
      const eff = effect(() => {
        count.value;
        runCount++;
      });
      eff.dispose();
      count.value = 5;
      count.value = 10;
      assert.equal(runCount, 1);
    });

    it("should handle multiple signal dependencies", () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);
      let sum = 0;
      effect(() => {
        sum = a.value + b.value + c.value;
      });
      assert.equal(sum, 6);
      a.value = 10;
      assert.equal(sum, 15);
    });

    it("should be an Effect instance", () => {
      const eff = effect(() => {});
      assert.equal(eff.constructor.name, "Effect");
    });
  });

  describe("batch()", () => {
    it("should defer effect execution until batch completes", () => {
      const count = signal(0);
      let runCount = 0;
      effect(() => {
        count.value;
        runCount++;
      });
      assert.equal(runCount, 1);

      batch(() => {
        count.value = 1;
        count.value = 2;
        count.value = 3;
      });

      assert.equal(runCount, 2);
    });

    it("should execute each effect only once per batch", () => {
      const a = signal(0);
      const b = signal(0);
      let runCount = 0;

      effect(() => {
        a.value;
        b.value;
        runCount++;
      });
      assert.equal(runCount, 1);

      batch(() => {
        a.value = 1;
        b.value = 1;
      });

      assert.equal(runCount, 2);
    });

    it("should support nested batches", () => {
      const count = signal(0);
      let runCount = 0;
      effect(() => {
        count.value;
        runCount++;
      });

      batch(() => {
        count.value = 1;
        batch(() => {
          count.value = 2;
          count.value = 3;
        });
        count.value = 4;
      });

      assert.equal(runCount, 2);
      assert.equal(count.value, 4);
    });

    it("should handle errors in batch without breaking state", () => {
      const count = signal(0);
      let runCount = 0;
      effect(() => {
        count.value;
        runCount++;
      });

      try {
        batch(() => {
          count.value = 1;
          throw new Error("test error");
        });
      } catch {}

      assert.equal(count.value, 1);
      count.value = 2;
      assert.equal(runCount, 3);
    });
  });

  describe("untracked()", () => {
    it("should read signal values without tracking", () => {
      const count = signal(0);
      let runCount = 0;
      effect(() => {
        untracked(() => count.value);
        runCount++;
      });
      assert.equal(runCount, 1);
      count.value = 1;
      assert.equal(runCount, 1);
    });

    it("should not create dependencies in effects", () => {
      const a = signal(1);
      const b = signal(2);
      let result = 0;
      let runCount = 0;

      effect(() => {
        result = a.value + untracked(() => b.value);
        runCount++;
      });

      assert.equal(result, 3);
      assert.equal(runCount, 1);

      b.value = 10;
      assert.equal(result, 3);
      assert.equal(runCount, 1);

      a.value = 5;
      assert.equal(result, 15);
      assert.equal(runCount, 2);
    });

    it("should restore tracking after untracked block", () => {
      const a = signal(1);
      const b = signal(2);
      let runCount = 0;

      effect(() => {
        a.value;
        untracked(() => b.value);
        a.value;
        runCount++;
      });

      assert.equal(runCount, 1);
      a.value = 5;
      assert.equal(runCount, 2);
    });
  });

  describe("edge cases", () => {
    it("should handle signals with undefined values", () => {
      const s = signal(undefined);
      assert.equal(s.value, undefined);
      s.value = "defined";
      assert.equal(s.value, "defined");
      s.value = undefined;
      assert.equal(s.value, undefined);
    });

    it("should handle signals with null values", () => {
      const s = signal(null);
      assert.equal(s.value, null);
      s.value = "not null";
      assert.equal(s.value, "not null");
      s.value = null;
      assert.equal(s.value, null);
    });

    it("should handle signals with object values", () => {
      const obj = signal({ name: "test" });
      assert.deepEqual(obj.value, { name: "test" });
      obj.value = { name: "updated" };
      assert.deepEqual(obj.value, { name: "updated" });
    });

    it("should handle signals with array values", () => {
      const arr = signal([1, 2, 3]);
      assert.deepEqual(arr.value, [1, 2, 3]);
      arr.value = [4, 5, 6];
      assert.deepEqual(arr.value, [4, 5, 6]);
    });

    it("should handle rapid successive updates", () => {
      const count = signal(0);
      let lastValue = 0;
      effect(() => {
        lastValue = count.value;
      });

      for (let i = 1; i <= 100; i++)
        count.value = i;

      assert.equal(lastValue, 100);
    });
  });

  describe("Signal.$sync", () => {
    it("exposes the keyed sync-source contract", () => {
      const count = signal(5);
      const shim = count.$sync;
      assert.equal(shim.adapter, "signal");
      assert.equal(shim.get("anyKey"), 5);
      shim.set("anyKey", 9);
      assert.equal(count.value, 9);
    });

    it("subscribe fires immediately and on change, and unsubscribes", () => {
      const count = signal(1);
      const seen = [];
      const off = count.$sync.subscribe("k", (v) => seen.push(v));
      assert.deepEqual(seen, [1]);
      count.value = 2;
      assert.deepEqual(seen, [1, 2]);
      off();
      count.value = 3;
      assert.deepEqual(seen, [1, 2]);
    });

    it("does not track reads through get()", () => {
      const count = signal(0);
      let runs = 0;
      effect(() => {
        count.$sync.get("k");
        runs++;
      });
      count.value = 1;
      assert.equal(runs, 1);
    });
  });
});

describe("glitch-free notification", () => {
  it("runs an effect once per write with consistent computed values in a diamond", () => {
    const a = signal(1);
    const b = computed(() => a.value + 1);
    const c = computed(() => a.value * 10);
    /** @type {string[]} */
    const seen = [];
    effect(() => {
      seen.push(`${b.value}/${c.value}`);
    });
    a.value = 2;
    assert.deepEqual(seen, ["2/10", "3/20"]);
    batch(() => {
      a.value = 3;
      a.value = 4;
    });
    assert.deepEqual(seen, ["2/10", "3/20", "5/40"]);
  });

  it("runs an effect scheduled by another effect after the first finishes", () => {
    const a = signal(0);
    const b = signal(0);
    /** @type {string[]} */
    const order = [];
    effect(() => {
      order.push(`b:${b.value}`);
    });
    effect(() => {
      const next = a.value;
      order.push(`a:${next}`);
      if (next > 0) b.value = next;
      order.push(`a-done:${next}`);
    });
    a.value = 1;
    assert.deepEqual(order, ["b:0", "a:0", "a-done:0", "a:1", "a-done:1", "b:1"]);
  });

  it("reaches every subscriber of a write once, while the effects it runs subscribe, dispose and resubscribe", () => {
    const a = signal(0);
    /** @type {string[]} */
    const runs = [];
    /** @type {{ dispose(): void } | null} */
    let late = null;
    const second = effect(() => {
      runs.push(`second:${a.value}`);
    });
    effect(() => {
      const value = a.value;
      runs.push(`first:${value}`);
      if (value === 1) {
        second.dispose();
        late = effect(() => {
          runs.push(`late:${a.value}`);
        });
      }
    });
    effect(() => {
      runs.push(`third:${a.value}`);
    });
    runs.length = 0;
    a.value = 1;
    assert.deepEqual(runs, ["second:1", "first:1", "late:1", "third:1"]);
    runs.length = 0;
    a.value = 2;
    assert.deepEqual(runs, ["first:2", "late:2", "third:2"]);
    late?.dispose();
  });
});
