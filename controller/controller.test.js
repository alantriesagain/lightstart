import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { signal } from "../signals/index.ts";
import { createStore } from "../signals/store.ts";
import { mergeDefinitions, composeDefinition } from "../view/definition.js";
import T from "../types/index.js";
import { bindStoreSync, getSyncInfo, registerAdapter } from "./sync.ts";
import { defineController, defineMixin, nameControllers } from "./define.ts";
import { configureControllers } from "./config.ts";
import { syncPlugin } from "./view.ts";
import { memoryStorage, localStorage, sessionStorage } from "./adapters/storage.ts";

registerAdapter("local", localStorage);
registerAdapter("session", sessionStorage);
registerAdapter("memory", memoryStorage);

describe("@bootstrapp/light/controller: Signal as sync source", () => {
  describe("getSyncInfo(signal)", () => {
    it("classifies a Signal through the $sync duck-type", () => {
      const sig = signal(1);
      const info = getSyncInfo(sig);
      assert.equal(info.adapter, "signal");
      assert.equal(info.syncObj.get("k"), 1);
    });
  });

  describe("bindStoreSync with a Signal", () => {
    it("seeds from the signal, then syncs both directions", () => {
      const sig = signal("from-signal");
      const store = createStore({ label: { default: "store-default" } }, { accessors: false });
      const unbind = bindStoreSync({ store, key: "label", prop: { sync: sig } });
      assert.equal(store.get("label"), "from-signal");
      sig.value = "signal-wins";
      assert.equal(store.get("label"), "signal-wins");
      store.set("label", "store-writes-back");
      assert.equal(sig.value, "store-writes-back");
      unbind();
      sig.value = "after-unbind";
      assert.equal(store.get("label"), "store-writes-back");
    });

    it("the immediate subscribe fire before the seed is harmless", () => {
      const sig = signal(7);
      const store = createStore({ n: { default: 0 } }, { accessors: false });
      const seen = [];
      store.subscribe("n", (v) => seen.push(v));
      const unbind = bindStoreSync({ store, key: "n", prop: { sync: sig } });
      assert.equal(store.get("n"), 7);
      assert.deepEqual(seen, [7]);
      unbind();
    });

    it("two props on one store bind two different signals", () => {
      const a = signal("A");
      const b = signal("B");
      const store = createStore({ first: { default: "" }, second: { default: "" } }, { accessors: false });
      const offA = bindStoreSync({ store, key: "first", prop: { sync: a } });
      const offB = bindStoreSync({ store, key: "second", prop: { sync: b } });
      assert.equal(store.get("first"), "A");
      assert.equal(store.get("second"), "B");
      b.value = "B2";
      assert.equal(store.get("second"), "B2");
      assert.equal(store.get("first"), "A");
      offA();
      offB();
    });
  });
});

describe("@bootstrapp/light/controller/store.js", () => {
  describe("createStore()", () => {
    it("should seed declared fields from shorthand and StateDef defaults", () => {
      const store = createStore({ count: 0, name: { default: "test" } });
      assert.equal(store.get("count"), 0);
      assert.equal(store.get("name"), "test");
    });

    it("should clone factory and object defaults per store", () => {
      const store = createStore({ list: { default: () => [] }, box: { default: { n: 1 } } });
      const other = createStore({ list: { default: () => [] }, box: { default: { n: 1 } } });
      assert.equal(store.get("list") !== other.get("list"), true);
      assert.equal(store.get("box") !== other.get("box"), true);
    });

    it("should set values via set() and direct property access", () => {
      const store = createStore({ count: 0 });
      store.set("count", 10);
      assert.equal(store.count, 10);
      store.count = 20;
      assert.equal(store.get("count"), 20);
    });

    it("should throw on an undeclared key", () => {
      const store = createStore({ count: 0 });
      assert.throws(() => store.set("missing", 1), /Unknown state field/);
    });

    it("should throw when a field collides with a store method", () => {
      assert.throws(() => createStore({ subscribe: 1 }), /collides/);
    });

    it("should notify per-key subscribers and dedupe on identical values", () => {
      const store = createStore({ count: 0 });
      let calls = 0;
      let received = null;
      const unsubscribe = store.subscribe("count", (val) => {
        calls++;
        received = val;
      });
      store.set("count", 5);
      assert.equal(calls, 1);
      assert.equal(received, 5);
      store.set("count", 5);
      assert.equal(calls, 1);
      unsubscribe();
      store.set("count", 9);
      assert.equal(calls, 1);
    });

    it("should update via update(key, fn)", () => {
      const store = createStore({ count: 2 });
      store.update("count", (n) => n * 3);
      assert.equal(store.count, 6);
    });

    it("should reset a key and resetAll with notifications", () => {
      const store = createStore({ a: 1, b: { default: () => [1] } });
      store.a = 9;
      store.b = [];
      let notified = 0;
      store.subscribe("a", () => notified++);
      assert.equal(store.reset("a"), 1);
      assert.equal(notified, 1);
      store.resetAll();
      assert.deepEqual(store.get("b"), [1]);
    });

    it("should snapshot with pack and restore with unpack", () => {
      const store = createStore({
        tags: { default: () => new Set(), pack: (s) => [...s], unpack: (a) => new Set(a) },
        n: 1,
      });
      store.get("tags").add("x");
      const snap = store.snapshot();
      assert.deepEqual(snap.tags, ["x"]);
      const twin = createStore({
        tags: { default: () => new Set(), pack: (s) => [...s], unpack: (a) => new Set(a) },
        n: 1,
      });
      twin.restore(snap);
      assert.equal(twin.get("tags").has("x"), true);
      twin.restore();
      assert.equal(twin.get("tags").size, 0);
    });

    it("should expose a $sync bridge named after the store", () => {
      const store = createStore({ count: 0 }, { name: "demo" });
      assert.equal(store.$sync.adapter, "demo");
      let received = null;
      store.$sync.subscribe("count", (v) => (received = v));
      store.$sync.set("count", 7);
      assert.equal(store.$sync.get("count"), 7);
      assert.equal(received, 7);
    });
  });
});

describe("@bootstrapp/light/controller/definition.js: lifecycle chaining", () => {
  const deferred = () => {
    /** @type {(value?: unknown) => void} */
    let resolve = () => {};
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
  };

  it("keeps a pair of sync hooks sync and answers the incoming result", () => {
    const order = [];
    const merged = mergeDefinitions(
      { connected() { order.push("a"); return "a"; } },
      { connected() { order.push("b"); return "b"; } },
    );
    assert.equal(merged.connected.call({}), "b");
    assert.deepEqual(order, ["a", "b"]);
  });

  it("returns the async side's promise when the other hook is sync", async () => {
    let done = false;
    const merged = mergeDefinitions(
      { async connected() { await Promise.resolve(); done = true; } },
      { connected() {} },
    );
    const result = merged.connected.call({});
    assert.equal(typeof result.then, "function");
    assert.equal(done, false);
    await result;
    assert.equal(done, true);
  });

  it("settles only once both async hooks have settled", async () => {
    const a = deferred();
    const b = deferred();
    const merged = mergeDefinitions({ connected() { return a.promise; } }, { connected() { return b.promise; } });
    let settled = false;
    const result = merged.connected.call({}).then(() => { settled = true; });
    a.resolve();
    await tick();
    assert.equal(settled, false);
    b.resolve();
    await result;
    assert.equal(settled, true);
  });

  it("passes a hook through by identity when only one side declares it", () => {
    const only = function () { return "untouched"; };
    assert.equal(mergeDefinitions({ connected: only }, {}).connected, only);
    assert.equal(mergeDefinitions({}, { connected: only }).connected, only);
  });

  it("composeDefinition awaits a fragment's async connected alongside the host's own", async () => {
    const order = [];
    const def = composeDefinition({
      mixins: [{ async connected() { await Promise.resolve(); order.push("mixin"); } }],
      name: "x",
      connected() { order.push("own"); },
    });
    await /** @type {any} */ (def).connected.call({});
    assert.deepEqual(order, ["own", "mixin"]);
  });
});

describe("@bootstrapp/light/controller/define.ts", () => {
  const definition = () => ({
    name: "demo",
    props: {
      count: 0,
      items: T.array({ defaultValue: () => [] }),
    },
    bump() {
      this.count += 1;
      return this.count;
    },
    total() {
      return this.count + this.items.length;
    },
  });

  describe("defineController()", () => {
    it("should return the controller, carrying its definition", () => {
      const ctrl = defineController(definition());
      assert.equal(ctrl.definition.name, "demo");
      assert.equal(ctrl.count, 0);
    });

    it("should require a string name", () => {
      assert.throws(() => defineController({ props: {} }), /needs a string/);
    });

    it("should throw on a property/member collision and on a $-prefixed name at define time", () => {
      assert.throws(
        () => defineController({ name: "x", props: { bump: 1 }, bump() {} }),
        /both a property and a member/,
      );
      assert.throws(
        () => defineController({ name: "x", props: { $state: 1 } }),
        /\$ prefix/,
      );
      assert.throws(() => defineController({ name: "x", $own() {} }), /\$ prefix/);
    });

    it("throws when a member or property shadows the handle's own keys", () => {
      for (const key of ["definition", "has", "dispose", "create", "get"]) {
        assert.throws(
          () => defineController({ name: "x", [key]() {} }),
          /reserved by the controller's handle/,
          `member ${key}`,
        );
        assert.throws(
          () => defineController({ name: "x", props: { [key]: 1 } }),
          /reserved by the controller's handle/,
          `property ${key}`,
        );
      }
    });

    it("lets a controller declare a property called name", () => {
      const instance = defineController({ name: "profile", props: { name: "Alan" } });
      assert.equal(instance.name, "Alan");
      assert.equal(instance.$name, "profile");
    });

    it("frees the old reserved names: state, config, ready, own, subscribe, attach, connected as properties", () => {
      const instance = defineController({
        name: "freed",
        props: {
          state: "idle",
          config: null,
          ready: false,
          own: 0,
          subscribe: "weekly",
          attach: [],
          connected: false,
        },
        connected() {
          this.connected = true;
          this.state = "booted";
          this.ready = true;
        },
        subscribeTo(/** @type {string} */ plan) { this.subscribe = plan; },
      });
      assert.equal(instance.connected, true);
      assert.equal(instance.state, "booted");
      assert.equal(instance.ready, true);
      assert.equal(instance.config, null);
      assert.ok(instance.$ready instanceof Promise);
      assert.equal(instance.$state.get("state"), "booted");
      instance.subscribeTo("monthly");
      assert.equal(instance.subscribe, "monthly");
      assert.equal(typeof instance.$own, "function");
    });

    it("a member named subscribe or attach is the controller's own", () => {
      const instance = defineController({
        name: "own-subscribe",
        props: { count: 0 },
        subscribe(/** @type {string} */ key, /** @type {(v: unknown) => void} */ cb) { return this.$state.subscribe(key, cb); },
      });
      let seen = null;
      instance.subscribe("count", (v) => (seen = v));
      instance.count = 3;
      assert.equal(seen, 3);
    });

    it("should flatten properties as reactive accessors backed by the store", () => {
      const instance = defineController(definition());
      assert.equal(instance.count, 0);
      let received = null;
      instance.$state.subscribe("count", (v) => (received = v));
      instance.count = 5;
      assert.equal(received, 5);
      assert.equal(instance.$state.get("count"), 5);
    });

    it("should bind methods so `this` reads and writes reactive state", () => {
      const instance = defineController(definition());
      assert.equal(instance.bump(), 1);
      instance.items = ["a"];
      assert.equal(instance.total(), 2);
    });

    it("should call connected() once, when the controller is first reached", () => {
      let calls = 0;
      const instance = defineController({
        name: "boot",
        props: { booted: false },
        connected() {
          calls++;
          this.booted = true;
        },
      });
      assert.equal(calls, 0);
      assert.equal(instance.booted, true);
      assert.equal(instance.booted, true);
      assert.equal(calls, 1);
    });

    it("should expose a $sync usable as a View sync target", () => {
      const instance = defineController(definition());
      assert.equal(instance.$sync.adapter, "demo");
      let received = null;
      instance.$sync.subscribe("count", (v) => (received = v));
      instance.count = 3;
      assert.equal(received, 3);
    });

    it("should attach(host) and detach cleanly", () => {
      const instance = defineController(definition());
      let updates = 0;
      const detach = instance.$attach({ $requestUpdate: () => updates++ });
      instance.count = 1;
      instance.items = ["x"];
      assert.equal(updates, 2);
      detach();
      instance.count = 2;
      assert.equal(updates, 2);
    });
  });

  describe("the controller handle", () => {
    it("is the controller: built on the first reach, and has() answers without building", () => {
      const ctrl = defineController(definition());
      assert.equal(ctrl.definition.name, "demo");
      assert.equal(ctrl.has(), false);
      assert.equal("count" in ctrl, true, "a declared key is on the handle");
      assert.equal(ctrl.has(), false, "an `in` check is not a reach");
      assert.equal(ctrl.count, 0, "a read is the reach that builds it");
      assert.equal(ctrl.has(), true);
    });

    it("answers a reach from inside its own connected() with the instance being connected", () => {
      /** @type {any} */
      let ctrl = null;
      ctrl = defineController({
        name: "selfReach",
        props: { mode: "idle" },
        connected() {
          ctrl.mode = "booted";
        },
      });
      assert.equal(ctrl.mode, "booted");
      assert.equal(ctrl.has(), true);
    });

    it("keeps nothing built when connected() throws, so the next reach tries again", () => {
      let attempts = 0;
      const ctrl = defineController({
        name: "throwsOnce",
        props: { ok: false },
        connected() {
          attempts++;
          if (attempts === 1) throw new Error("not yet");
          this.ok = true;
        },
      });
      assert.throws(() => ctrl.ok, /not yet/);
      assert.equal(ctrl.has(), false);
      assert.equal(ctrl.ok, true);
      assert.equal(attempts, 2);
    });

    it("forwards reads, writes and calls to the instance", () => {
      const ctrl = defineController({ name: "demo2", props: { n: 7 }, double() { return this.n * 2; } });
      assert.equal(ctrl.n, 7);
      assert.equal(ctrl.double(), 14);
      ctrl.n = 9;
      assert.equal(ctrl.double(), 18, "the forwarded write lands on the instance");
      assert.equal("n" in ctrl, true);
      assert.equal("double" in ctrl, true);
    });

    it("carries the declared keys and the instance's $ members alone, and refuses a write to any other", () => {
      const ctrl = defineController({
        name: "demo3",
        props: { n: 1 },
        remember() {
          /** @type {any} */ (this).scratch = "kept on the instance";
        },
      });
      ctrl.remember();
      assert.equal(/** @type {any} */ (ctrl).scratch, undefined, "an undeclared field is not on the handle");
      assert.throws(() => {
        /** @type {any} */ (ctrl).other = 1;
      }, TypeError);
      let built = /** @type {Record<string, unknown> | null} */ (null);
      const probe = defineController({
        name: "demo4",
        props: { n: 1 },
        connected() {
          built = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (this));
        },
      });
      assert.equal(probe.n, 1);
      const dollars = Object.keys(/** @type {Record<string, unknown>} */ (built)).filter((key) => key.startsWith("$") && key !== "$dispose");
      for (const key of dollars) assert.equal(key in probe, true, `${key} reaches the handle`);
      assert.equal(probe.$state, /** @type {Record<string, unknown>} */ (built).$state);
      ctrl.dispose();
      probe.dispose();
    });

    it("never looks thenable, and answers its own keys without building", () => {
      const ctrl = defineController(definition());
      assert.equal(ctrl.then, undefined);
      assert.equal(typeof ctrl.constructor, "function");
      assert.equal(typeof ctrl.dispose, "function");
      assert.equal(ctrl.dispose(), undefined, "disposing a controller never built does nothing");
      assert.equal(ctrl.has(), false);
    });

    it("refuses the retired module API, naming what replaced it", () => {
      const ctrl = defineController(definition());
      assert.throws(() => ctrl.create, /\.create is gone; the controller is made on first reach/);
      assert.throws(() => ctrl.get, /\.get is gone; the handle is the controller/);
      assert.throws(() => ctrl.$dispose, /\.\$dispose is gone; call dispose\(\)/);
    });

    it("builds a fresh instance on the reach after dispose()", () => {
      const ctrl = defineController(definition());
      ctrl.bump();
      assert.equal(ctrl.count, 1);
      ctrl.dispose();
      assert.equal(ctrl.has(), false);
      assert.equal(ctrl.count, 0);
    });

    const retiring = (/** @type {string} */ name, /** @type {string[]} */ order) => {
      /** @type {() => void} */
      let release = () => {};
      const ctrl = defineController({
        name,
        props: {},
        connected() {
          order.push("connected");
        },
        disconnected: () =>
          new Promise((resolve) => {
            release = () => {
              order.push("disconnected");
              resolve(undefined);
            };
          }),
      });
      return { ctrl, release: () => release() };
    };

    it("keeps answering the retiring instance while an async disconnected drains", async () => {
      const { ctrl, release } = retiring("retiring", []);
      const first = ctrl.$state;
      const done = ctrl.dispose();
      assert.equal(ctrl.has(), true, "teardown code still has a controller to reach");
      assert.equal(ctrl.$state, first, "and it is the one being torn down, not a fresh one underneath it");
      release();
      await done;
      assert.equal(ctrl.has(), false);
      assert.notEqual(ctrl.$state, first, "once it has settled the next reach builds the next one");
    });

    it("answers $ready with the instance built after the teardown, not the one leaving", async () => {
      /** @type {string[]} */
      const order = [];
      const { ctrl, release } = retiring("handover", order);
      const first = ctrl.$state;
      order.length = 0;

      ctrl.dispose();
      const ready = ctrl.$ready;
      assert.equal(ctrl.$state, first, "an ordinary reach still lands on the retiring instance");
      assert.deepEqual(order, [], "and nothing new has connected");

      release();
      await ready;
      assert.deepEqual(order, ["disconnected", "connected"]);
      assert.notEqual(ctrl.$state, first);
      assert.equal(ctrl.has(), true);
    });

    it("connects the next instance even when the outgoing disconnected() rejects", async () => {
      let connected = false;
      const ctrl = defineController({
        name: "handover3",
        props: {},
        connected() {
          connected = true;
        },
        disconnected: () => Promise.reject(new Error("teardown blew up")),
      });
      void ctrl.$state;
      connected = false;
      const done = /** @type {Promise<void>} */ (ctrl.dispose());
      const ready = ctrl.$ready;
      await assert.rejects(() => done, /teardown blew up/);
      await ready;
      assert.equal(connected, true);
    });
  });
});

describe("@bootstrapp/light/controller/define.ts: mixins", () => {
  const store = () => defineMixin({
    props: { slug: "draft" },
    _timer: null,
    save() { return `saved:${this.slug}`; },
    shared() { return "mixin"; },
  });

  it("unions properties and members, the definition winning a collision", () => {
    const factory = defineController({
      name: "doc",
      mixins: [store()],
      props: { count: 1 },
      shared() { return "own"; },
      total() { return this.count + this.slug.length; },
    });
    const instance = factory;
    assert.equal(instance.slug, "draft");
    assert.equal(instance.count, 1);
    assert.equal(instance.total(), 6);
    assert.equal(instance.save(), "saved:draft");
    assert.equal(instance.shared(), "own");
    assert.equal("mixins" in factory.definition, false);
    assert.deepEqual(Object.keys(factory.definition.props).sort(), ["count", "slug"]);
    assert.equal(factory._timer, null, "a mixin's plain field is a member");
  });

  it("binds a mixin's method to the instance", () => {
    const factory = defineController({ name: "doc", mixins: [store()] });
    const { save } = factory;
    assert.equal(save(), "saved:draft");
  });

  it("folds a fragment's own mixins in first", () => {
    const order = [];
    const inner = defineMixin({ props: { a: 1 }, connected() { order.push("inner"); } });
    const outer = defineMixin({ mixins: [inner], props: { b: 2 }, connected() { order.push("outer"); } });
    const instance = defineController({ name: "doc", mixins: [outer], connected() { order.push("own"); } });
    assert.equal(instance.a + instance.b, 3);
    assert.deepEqual(order, ["inner", "outer", "own"]);
  });

  it("settles $ready with a mixin's async connected", async () => {
    let flag = false;
    const lazy = defineMixin({ async connected() { await new Promise((r) => setTimeout(r, 0)); flag = true; } });
    const instance = defineController({ name: "doc", mixins: [lazy], connected() {} });
    assert.equal(flag, false);
    await instance.$ready;
    assert.equal(flag, true);
  });

  it("rejects a $-prefixed member and a property/member collision coming from a mixin", () => {
    assert.throws(() => defineController({ name: "doc", mixins: [{ $own() {} }] }), /\$ prefix/);
    assert.throws(() => defineController({ name: "doc", mixins: [{ props: { save: 1 } }], save() {} }), /both a property and a member/);
  });

  it("keeps an accessor declared on a mixin live on the instance", () => {
    const withDoc = defineMixin({ props: { slug: "a" }, get label() { return `#${this.slug}`; } });
    const instance = defineController({ name: "doc", mixins: [withDoc] });
    assert.equal(instance.label, "#a");
    instance.slug = "b";
    assert.equal(instance.label, "#b");
  });

  it("treats an empty mixins list as the plain definition", () => {
    const factory = defineController({ name: "doc", mixins: [], props: { n: 0 }, bump() { return ++this.n; } });
    assert.equal(factory.bump(), 1);
  });
});

describe("@bootstrapp/light/controller/define.ts: per-instance members", () => {
  const withMembers = () => defineController({
    name: "members",
    props: {},
    log: [],
    seen: {},
    limits: null,
    max: 0,
    collect(value) {
      this.log.push(value);
      this.seen[value] = true;
    },
  });

  it("gives each instance its own array", () => {
    const ctrl = withMembers();
    ctrl.collect("a");
    const before = ctrl.log;
    ctrl.dispose();
    assert.deepEqual(ctrl.log, [], "a fresh instance must not inherit the previous one's entries");
    assert.notEqual(ctrl.log, before);
  });

  it("gives each instance its own plain object", () => {
    const ctrl = withMembers();
    ctrl.collect("a");
    const before = ctrl.seen;
    ctrl.dispose();
    assert.deepEqual(ctrl.seen, {});
    assert.notEqual(ctrl.seen, before);
  });

  it("gives each instance its own Map and Set", () => {
    const ctrl = defineController({ name: "collections", props: {}, byId: new Map(), open: new Set() });
    ctrl.byId.set("k", 1);
    ctrl.open.add("k");
    ctrl.dispose();
    assert.equal(ctrl.byId.size, 0);
    assert.equal(ctrl.open.size, 0);
  });

  it("leaves immutable members alone", () => {
    const instance = withMembers();
    assert.equal(instance.limits, null);
    assert.equal(instance.max, 0);
  });

  it("shares a member the author deliberately made shareable", () => {
    const shared = new (class Table {})();
    const ctrl = defineController({ name: "shared", props: {}, table: shared });
    assert.equal(ctrl.table, shared, "only array, plain-object, Map and Set literals are copied");
  });
});

describe("@bootstrapp/light/controller/define.ts: own()", () => {
  const record = () => {
    const log = [];
    const make = defineController({
      name: "owned",
      props: {},
      connected() {
        this.$own(() => log.push("a"));
        this.$own([() => log.push("b"), null, undefined, false, () => log.push("c")]);
      },
      disconnected() {
        log.push("disconnected");
      },
    });
    return { log, make };
  };

  it("returns its argument so it wraps inline", () => {
    const instance = defineController({ name: "ret", props: {} });
    const fn = () => {};
    assert.equal(instance.$own(fn), fn);
    const list = [fn, null];
    assert.equal(instance.$own(list), list);
  });

  it("dispose() runs disconnected first, then every owned teardown, once", () => {
    const log = [];
    const ctrl = defineController({
      name: "disposable",
      props: {},
      connected() { this.$own(() => log.push("teardown")); },
      disconnected() { log.push("disconnected"); },
    });
    void ctrl.$state;
    ctrl.dispose();
    ctrl.dispose();
    assert.deepEqual(log, ["disconnected", "teardown"], "a second dispose() finds nothing built");
  });

  it("runs disconnected first, then every owned teardown, on dispose()", () => {
    const { log, make } = record();
    void make.$state;
    make.dispose();
    assert.deepEqual(log, ["disconnected", "a", "b", "c"]);
  });

  it("keeps draining when one teardown throws", () => {
    const log = [];
    const make = defineController({
      name: "throwing",
      props: {},
      connected() {
        this.$own(() => log.push("first"));
        this.$own(() => { throw new Error("boom"); });
        this.$own(() => log.push("last"));
      },
    });
    void make.$state;
    const original = console.error;
    const errors = [];
    console.error = (...args) => errors.push(args);
    try {
      make.dispose();
    } finally {
      console.error = original;
    }
    assert.deepEqual(log, ["first", "last"]);
    assert.equal(errors.length, 1);
    assert.match(String(errors[0][0]), /teardown failed in "throwing"/);
  });

  it("rides sync unbinds on the same registry", () => {
    const sig = signal(1);
    const make = defineController({
      name: "synced",
      props: { value: 0 },
      sync: { value: sig },
    });
    assert.equal(make.value, 1);
    const retired = make.$state;
    make.dispose();
    sig.value = 2;
    assert.equal(retired.get("value"), 1, "a retired instance no longer follows its sync source");
    assert.equal(make.has(), false);
  });

  it("rejects $own as a member or property name", () => {
    assert.throws(() => defineController({ name: "bad", props: {}, $own() {} }), /\$ prefix/);
    assert.throws(() => defineController({ name: "bad2", props: { $own: 0 } }), /\$ prefix/);
  });
});

describe("@bootstrapp/light/controller/define.ts: ready", () => {
  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };

  it("resolves at once for a synchronous connected()", async () => {
    const instance = defineController({ name: "sync-ready", props: {}, connected() {} });
    assert.ok(instance.$ready instanceof Promise);
    await instance.$ready;
    const bare = defineController({ name: "no-hook", props: {} });
    await bare.$ready;
  });

  it("settles with an async connected(), after its work", async () => {
    const gate = deferred();
    const instance = defineController({
      name: "async-ready",
      props: { value: 0 },
      async connected() {
        await gate.promise;
        this.value = 1;
      },
    });
    let settled = false;
    instance.$ready.then(() => { settled = true; });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(settled, false);
    gate.resolve();
    await instance.$ready;
    assert.equal(instance.value, 1);
  });

  it("rejects when connected() throws asynchronously", async () => {
    const instance = defineController({
      name: "failing-ready",
      props: {},
      async connected() {
        throw new Error("boom");
      },
    });
    await assert.rejects(instance.$ready, /boom/);
  });

  it("counts async boot work with the host's track under controller:<name>", async () => {
    const labels = [];
    const ended = [];
    configureControllers({ track: (label) => { labels.push(label); return () => ended.push(label); } });
    try {
      await defineController({ name: "tracked", props: {}, async connected() {} }).$ready;
      await defineController({ name: "untracked", props: {}, connected() {} }).$ready;
    } finally {
      configureControllers({ track: () => undefined });
    }
    assert.deepEqual(labels, ["controller:tracked"]);
    assert.deepEqual(ended, ["controller:tracked"], "the work ends when $ready settles");
  });

  it("rejects $ready as a member or property name", () => {
    assert.throws(() => defineController({ name: "bad", props: {}, $ready() {} }), /\$ prefix/);
    assert.throws(() => defineController({ name: "bad2", props: { $ready: 0 } }), /\$ prefix/);
  });
});

describe("@bootstrapp/light/controller/adapters/storage.ts", () => {
  beforeEach(() => {
    memoryStorage.clear();
  });

  describe("memoryStorage", () => {
    it("should get/set values correctly", () => {
      memoryStorage.set("key", "value");
      assert.equal(memoryStorage.get("key"), "value");
    });

    it("should remove values", () => {
      memoryStorage.set("key", "value");
      memoryStorage.remove("key");
      assert.equal(memoryStorage.get("key"), undefined);
    });

    it("should check existence with has()", () => {
      assert.equal(memoryStorage.has("missing"), false);
      memoryStorage.set("exists", "value");
      assert.equal(memoryStorage.has("exists"), true);
    });

    it("should return all keys", () => {
      memoryStorage.set("a", 1);
      memoryStorage.set("b", 2);
      const keys = memoryStorage.keys();
      assert.ok(keys.includes("a"));
      assert.ok(keys.includes("b"));
    });

    it("should return all entries", () => {
      memoryStorage.set("a", 1);
      memoryStorage.set("b", 2);
      const entries = memoryStorage.entries();
      assert.deepEqual(entries.sort(), [["a", 1], ["b", 2]].sort());
    });

    it("should support on/off event listeners", () => {
      let receivedValue = null;
      const callback = (value) => {
        receivedValue = value;
      };
      const unsub = memoryStorage.on("testKey", callback);
      memoryStorage.set("testKey", "testValue");
      assert.equal(receivedValue, "testValue");
      unsub();
      memoryStorage.set("testKey", "newValue");
      assert.equal(receivedValue, "testValue");
    });

    it("should emit events on set/remove", () => {
      let lastValue = null;
      memoryStorage.on("emitTest", (v) => {
        lastValue = v;
      });
      memoryStorage.set("emitTest", "setValue");
      assert.equal(lastValue, "setValue");
      memoryStorage.remove("emitTest");
      assert.equal(lastValue, undefined);
    });

    it("should create signals synced with storage", () => {
      const sig = memoryStorage.signal("syncTest", "default");
      assert.equal(sig.value, "default");
      sig.value = "updated";
      assert.equal(memoryStorage.get("syncTest"), "updated");
    });

    it("should update signal when storage changes externally", () => {
      const sig = memoryStorage.signal("externalTest", "initial");
      memoryStorage.emit("externalTest", "external");
      assert.equal(sig.value, "external");
    });

    it("should update storage when signal changes", () => {
      const sig = memoryStorage.signal("signalToStorage", "start");
      sig.value = "changed";
      assert.equal(memoryStorage.get("signalToStorage"), "changed");
    });

    it("should clear all data with clear()", () => {
      memoryStorage.set("a", 1);
      memoryStorage.set("b", 2);
      memoryStorage.clear();
      assert.equal(memoryStorage.has("a"), false);
      assert.equal(memoryStorage.has("b"), false);
    });

    it("should return same signal for same key (singleton)", () => {
      const sig1 = memoryStorage.signal("singleton", "value");
      const sig2 = memoryStorage.signal("singleton", "different");
      assert.equal(sig1, sig2);
    });
  });

  describe("serialization", () => {
    it("should handle primitive values", () => {
      memoryStorage.set("str", "hello");
      memoryStorage.set("num", 42);
      memoryStorage.set("bool", true);
      assert.equal(memoryStorage.get("str"), "hello");
      assert.equal(memoryStorage.get("num"), 42);
      assert.equal(memoryStorage.get("bool"), true);
    });

    it("should handle objects", () => {
      const obj = { name: "test", nested: { value: 1 } };
      memoryStorage.set("obj", obj);
      assert.deepEqual(memoryStorage.get("obj"), obj);
    });

    it("should handle arrays", () => {
      const arr = [1, 2, { three: 3 }];
      memoryStorage.set("arr", arr);
      assert.deepEqual(memoryStorage.get("arr"), arr);
    });
  });

  describe("localStorage adapter interface", () => {
    it("should have name property", () => {
      assert.equal(localStorage.name, "local");
    });

    it("should have all required methods", () => {
      assert.equal(typeof localStorage.get, "function");
      assert.equal(typeof localStorage.set, "function");
      assert.equal(typeof localStorage.remove, "function");
      assert.equal(typeof localStorage.has, "function");
      assert.equal(typeof localStorage.keys, "function");
      assert.equal(typeof localStorage.entries, "function");
      assert.equal(typeof localStorage.on, "function");
      assert.equal(typeof localStorage.off, "function");
      assert.equal(typeof localStorage.signal, "function");
    });
  });

  describe("sessionStorage adapter interface", () => {
    it("should have name property", () => {
      assert.equal(sessionStorage.name, "session");
    });

    it("should have all required methods", () => {
      assert.equal(typeof sessionStorage.get, "function");
      assert.equal(typeof sessionStorage.set, "function");
      assert.equal(typeof sessionStorage.remove, "function");
      assert.equal(typeof sessionStorage.has, "function");
      assert.equal(typeof sessionStorage.keys, "function");
      assert.equal(typeof sessionStorage.entries, "function");
      assert.equal(typeof sessionStorage.on, "function");
      assert.equal(typeof sessionStorage.off, "function");
      assert.equal(typeof sessionStorage.signal, "function");
    });
  });

  describe("store.observe()", () => {
    it("reports key, value and what it replaced, for every key", () => {
      const store = createStore({ a: 1, b: "x" });
      const seen = [];
      store.observe((key, value, oldValue) => seen.push([key, value, oldValue]));
      store.set("a", 2);
      store.set("b", "y");
      assert.deepEqual(seen, [["a", 2, 1], ["b", "y", "x"]]);
    });

    it("stops after unsubscribe and skips deduped writes", () => {
      const store = createStore({ a: 1 });
      const seen = [];
      const off = store.observe((key, value) => seen.push(value));
      store.set("a", 1);
      store.set("a", 2);
      off();
      store.set("a", 3);
      assert.deepEqual(seen, [2]);
    });

    it("per-key subscribers also receive the old value", () => {
      const store = createStore({ a: 1 });
      let got = null;
      store.subscribe("a", (value, oldValue) => (got = [value, oldValue]));
      store.set("a", 5);
      assert.deepEqual(got, [5, 1]);
    });

    it("accessors: false leaves the store without per-key accessors", () => {
      const store = createStore({ a: 1 }, { accessors: false });
      assert.equal(store.a, undefined);
      assert.equal(store.get("a"), 1);
      store.set("a", 2);
      assert.equal(store.get("a"), 2);
    });
  });

  describe("controller sync", () => {

    it("a controller property with a named adapter binds two-way", () => {
      memoryStorage.remove("ctl-level");
      memoryStorage.set("ctl-level", "hard");
      const factory = defineController({
        name: "ctl-sync-a",
        props: { "ctl-level": "easy" },
        sync: { "ctl-level": "memory" },
      });
      const instance = factory;
      assert.equal(instance["ctl-level"], "hard", "the named side owns at bind");

      instance["ctl-level"] = "medium";
      assert.equal(memoryStorage.get("ctl-level"), "medium", "assignment writes through");

      memoryStorage.set("ctl-level", "easy");
      assert.equal(instance["ctl-level"], "easy", "external change lands on the property");
      memoryStorage.remove("ctl-level");
    });

    it("the store default fills a hole in the adapter without seeding it", () => {
      memoryStorage.remove("ctl-empty");
      const factory = defineController({
        name: "ctl-sync-b",
        props: { "ctl-empty": "fallback" },
        sync: { "ctl-empty": "memory" },
      });
      const instance = factory;
      assert.equal(instance["ctl-empty"], "fallback");
      assert.equal(memoryStorage.get("ctl-empty"), undefined, "binding alone writes nothing");
      instance["ctl-empty"] = "now";
      assert.equal(memoryStorage.get("ctl-empty"), "now");
      memoryStorage.remove("ctl-empty");
    });

    it("key: names the adapter key explicitly while the property keeps its own name", () => {
      memoryStorage.remove("app:level");
      memoryStorage.set("app:level", "hard");
      const factory = defineController({
        name: "ctl-sync-key",
        props: { level: "easy" },
        sync: { level: { to: "memory", key: "app:level" } },
      });
      const instance = factory;
      assert.equal(instance.level, "hard");
      instance.level = "medium";
      assert.equal(memoryStorage.get("app:level"), "medium");
      assert.equal(memoryStorage.get("level"), undefined, "the bare name is never touched");
      memoryStorage.remove("app:level");
    });

    it("scope: prefixes the key with a sibling property's value, and an empty scope skips the bind", () => {
      memoryStorage.remove("a:x");
      memoryStorage.set("a:x", "scoped");
      const factory = defineController({
        name: "ctl-sync-scope",
        props: {
          mode: "a",
          value: "none",
        },
        sync: { value: { to: "memory", key: "x", scope: "mode" } },
      });
      const instance = factory;
      assert.equal(instance.value, "scoped");
      memoryStorage.remove("a:x");

      const unscoped = defineController({
        name: "ctl-sync-scope-empty",
        props: {
          mode: "",
          value: "none",
        },
        sync: { value: { to: "memory", key: "x", scope: "mode" } },
      });
      unscoped.value = "local only";
      assert.equal(memoryStorage.get(":x"), undefined);
      assert.equal(memoryStorage.get("x"), undefined, "no bind while the scope value is empty");
    });

    it("a scope that changes rebinds the property to the new key", () => {
      for (const k of ["a:x", "b:x", "x"]) memoryStorage.remove(k);
      memoryStorage.set("a:x", "from a");
      memoryStorage.set("b:x", "from b");
      const instance = defineController({
        name: "ctl-sync-scope-moves",
        props: {
          mode: "a",
          value: "none",
        },
        sync: { value: { to: "memory", key: "x", scope: "mode" } },
      });
      assert.equal(instance.value, "from a");
      instance.mode = "b";
      assert.equal(instance.value, "from b", "the new scope's stored value wins");
      instance.value = "written under b";
      assert.equal(memoryStorage.get("b:x"), "written under b");
      assert.equal(memoryStorage.get("a:x"), "from a", "the key it left is untouched");
      for (const k of ["a:x", "b:x"]) memoryStorage.remove(k);
    });

    it("a scope moving to a key with nothing stored reads the declared default, not the last scope's value", () => {
      for (const k of ["a:x", "empty:x"] ) memoryStorage.remove(k);
      memoryStorage.set("a:x", "from a");
      const instance = defineController({
        name: "ctl-sync-scope-empty-target",
        props: {
          mode: "a",
          value: "none",
        },
        sync: { value: { to: "memory", key: "x", scope: "mode" } },
      });
      assert.equal(instance.value, "from a");
      instance.mode = "empty";
      assert.equal(instance.value, "none", "an unwritten key answers the default");
      memoryStorage.remove("a:x");
    });

    it("two controllers declaring the same bare name share one adapter key", () => {
      memoryStorage.remove("shared");
      const make = (name) => defineController({ name, props: { shared: "" },
      sync: { shared: "memory" } });
      const first = make;
      const second = make;
      first.shared = "from first";
      assert.equal(second.shared, "from first");
      memoryStorage.remove("shared");
    });

    it("a bind against an unregistered name queues and completes on registration", async () => {
      const { registerAdapter, pendingAdapterNames } = await import("./sync.ts");
      const factory = defineController({
        name: "ctl-sync-late",
        props: { late: "waiting" },
        sync: { late: "late-adapter" },
      });
      const instance = factory;
      assert.equal(instance.late, "waiting", "plain store prop until the name arrives");
      assert.equal(pendingAdapterNames().includes("late-adapter"), true);

      const owner = createStore({ late: "owned" });
      registerAdapter("late-adapter", owner);
      assert.equal(instance.late, "owned", "queued bind ran, owner won");
      instance.late = "back";
      assert.equal(owner.get("late"), "back", "two-way after the flush");
    });

    it("a queued bind unbound before its name registers never binds", async () => {
      const { registerAdapter, pendingAdapterNames } = await import("./sync.ts");
      const store = createStore({ early: { default: "mine" } }, { accessors: false });
      const unbind = bindStoreSync({ store, key: "early", prop: { sync: "early-adapter" } });
      unbind();
      assert.equal(pendingAdapterNames().includes("early-adapter"), true, "the name stays waited on");
      registerAdapter("early-adapter", createStore({ early: "theirs" }));
      assert.equal(store.get("early"), "mine", "the unbound key took nothing from the late adapter");
    });

    it("registering a sync type's check again replaces its handler", async () => {
      const { registerSyncType } = await import("./sync.ts");
      const tagged = { kind: "retyped" };
      const check = (/** @type {unknown} */ target) => target === tagged;
      registerSyncType(check, () => ({ adapter: "first", syncObj: null }));
      registerSyncType(check, () => ({ adapter: "second", syncObj: null }));
      assert.equal(getSyncInfo(tagged)?.adapter, "second");
    });

    it("a named controller is a sync target by its name, and mirrors follow it both ways", async () => {
      const { getAdapter, pendingAdapterNames } = await import("./sync.ts");
      const owner = defineController({ name: "ownerCtl", props: { level: "hard" } });
      nameControllers([owner]);
      assert.equal(owner.has(), false, "naming does not build it");

      const mirror = defineController({
        name: "mirror-ctl",
        props: { level: "easy" },
        sync: { level: "ownerCtl" },
      });
      assert.equal(mirror.level, "hard", "the bind builds the owner, and its value beats the mirror default");
      assert.equal(owner.has(), true);
      assert.equal(Boolean(getAdapter("ownerCtl")), true);
      assert.equal(pendingAdapterNames().includes("ownerCtl"), false);

      owner.level = "medium";
      assert.equal(mirror.level, "medium", "owner change reaches the mirror");
      mirror.level = "easy";
      assert.equal(owner.level, "easy", "mirror assignment reaches the owner");
    });

    it("a disposed controller's name binds a later view to the next instance", async () => {
      const { getAdapter } = await import("./sync.ts");
      const owner = defineController({ name: "rearmCtl", props: { level: "hard" } });
      nameControllers([owner]);
      owner.level = "medium";
      owner.dispose();
      assert.equal(owner.has(), false);

      const mirror = defineController({
        name: "rearm-mirror",
        props: { level: "easy" },
        sync: { level: "rearmCtl" },
      });
      assert.equal(mirror.level, "hard", "the bind reached a fresh owner, not the retired one");
      assert.equal(owner.has(), true);
      assert.ok(getAdapter("rearmCtl"));
      owner.level = "medium";
      assert.equal(mirror.level, "medium", "the mirror follows the instance the name now answers with");
    });

    it("refuses to name a controller after a sync adapter, and names a controller once", () => {
      assert.throws(
        () => nameControllers([defineController({ name: "session", props: {} })]),
        /has the name of the sync adapter "session"/,
      );
      const once = defineController({ name: "namedOnce", props: { n: 1 } });
      nameControllers([once]);
      void once.n;
      nameControllers([once]);
      assert.equal(once.n, 1, "naming a built controller again is not a collision with its own adapter");
    });

    it("dispose() tears the instance down: bindings dead, disconnected called", () => {
      memoryStorage.remove("ctl-re");
      let torndown = 0;
      const ctrl = defineController({
        name: "ctl-recreate",
        props: { "ctl-re": "a" },
        sync: { "ctl-re": "memory" },
        disconnected() { torndown += 1; },
      });
      const retired = ctrl.$state;
      ctrl.dispose();
      assert.equal(torndown, 1);
      memoryStorage.set("ctl-re", "changed");
      assert.equal(retired.get("ctl-re"), "a", "the retired instance no longer follows the adapter");
      assert.equal(ctrl["ctl-re"], "changed", "the next one does");
      memoryStorage.remove("ctl-re");
    });

    it("query: on a controller property throws at define time", () => {
      assert.throws(() =>
        defineController({
          name: "ctl-query",
          props: { rows: { $type: "array", sync: {}, query: { limit: 5 } } },
        }),
      );
    });
  });
});

import { resource, keyedResource } from "./resource.ts";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const fakeBus = () => {
  const listeners = new Map();
  return {
    on(key, cb) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(cb);
      return () => listeners.get(key)?.delete(cb);
    },
    async emit(key, payload) {
      return Promise.all([...(listeners.get(key) ?? [])].map((cb) => cb(payload)));
    },
  };
};

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("@bootstrapp/light/controller/resource.ts", () => {
  describe("ensure()", () => {
    it("fetches once and dedupes concurrent calls", async () => {
      let calls = 0;
      const r = resource(async () => {
        calls++;
        return ["a"];
      }, { ready: false, events: null });
      const [first, second] = await Promise.all([r.ensure(), r.ensure()]);
      assert.deepEqual(first, ["a"]);
      assert.deepEqual(second, ["a"]);
      assert.equal(calls, 1);
      await r.ensure();
      assert.equal(calls, 1);
    });

    it("transitions pending and clears error on success", async () => {
      const d = deferred();
      const r = resource(() => d.promise, { ready: false, events: null });
      const p = r.ensure();
      await tick();
      assert.equal(r.pending.value, true);
      assert.equal(r.value.value, undefined);
      d.resolve(42);
      await p;
      assert.equal(r.value.value, 42);
      assert.equal(r.pending.value, false);
      assert.equal(r.error.value, null);
    });

    it("rejects on first-load failure, surfaces error, and retries on the next ensure", async () => {
      let calls = 0;
      const r = resource(async () => {
        calls++;
        if (calls === 1) throw new Error("boom");
        return "recovered";
      }, { ready: false, events: null });
      let threw = null;
      try {
        await r.ensure();
      } catch (e) {
        threw = e;
      }
      assert.equal(threw?.message, "boom");
      assert.equal(r.error.value?.message, "boom");
      assert.equal(r.pending.value, false);
      const v = await r.ensure();
      assert.equal(v, "recovered");
      assert.equal(r.error.value, null);
      assert.equal(calls, 2);
    });

    it("waits for the injectable ready gate", async () => {
      const gate = deferred();
      let fetched = false;
      const r = resource(async () => {
        fetched = true;
        return 1;
      }, { ready: () => gate.promise, events: null });
      const p = r.ensure();
      await tick();
      assert.equal(fetched, false);
      gate.resolve();
      await p;
      assert.equal(fetched, true);
    });
  });

  describe("refresh(): stale-while-revalidate", () => {
    it("keeps the old value visible until the new answer resolves", async () => {
      const answers = [deferred(), deferred()];
      let call = 0;
      const r = resource(() => answers[call++].promise, { ready: false, events: null });
      const p1 = r.ensure();
      answers[0].resolve("old");
      await p1;
      const p2 = r.refresh();
      await tick();
      assert.equal(r.value.value, "old");
      assert.equal(r.pending.value, true);
      answers[1].resolve("new");
      await p2;
      assert.equal(r.value.value, "new");
      assert.equal(r.pending.value, false);
    });

    it("keeps the old value when a refresh fails", async () => {
      let call = 0;
      const r = resource(async () => {
        call++;
        if (call === 2) throw new Error("refresh-fail");
        return "good";
      }, { ready: false, events: null });
      await r.ensure();
      let threw = null;
      try {
        await r.refresh();
      } catch (e) {
        threw = e;
      }
      assert.equal(threw?.message, "refresh-fail");
      assert.equal(r.value.value, "good");
      assert.equal(r.error.value?.message, "refresh-fail");
    });

    it("piggybacks a refresh issued before the first load resolves", async () => {
      let calls = 0;
      const first = deferred();
      const r = resource(() => {
        calls++;
        return first.promise;
      }, { ready: false, events: null });
      const p1 = r.ensure();
      const p2 = r.refresh();
      first.resolve("initial");
      assert.equal(await p1, "initial");
      assert.equal(await p2, "initial");
      assert.equal(calls, 1);
    });

    it("drops a stale in-flight answer when a newer refresh resolves first", async () => {
      const answers = [deferred(), deferred(), deferred()];
      let call = 0;
      const r = resource(() => answers[call++].promise, { ready: false, events: null });
      const p0 = r.ensure();
      answers[0].resolve("base");
      await p0;
      const slowRefresh = r.refresh();
      const fastRefresh = r.refresh();
      answers[2].resolve("newer");
      await fastRefresh;
      assert.equal(r.value.value, "newer");
      answers[1].resolve("older");
      await slowRefresh.catch(() => {});
      await tick();
      assert.equal(r.value.value, "newer");
    });
  });

  describe("mutate()", () => {
    it("applies a synchronous local write that subscribers observe", async () => {
      const r = resource(async () => ["a"], { ready: false, events: null });
      await r.ensure();
      const seen = [];
      const off = r.subscribe((v) => seen.push(v));
      const next = r.mutate((current) => [...current, "b"]);
      assert.deepEqual(next, ["a", "b"]);
      assert.deepEqual(r.value.value, ["a", "b"]);
      assert.deepEqual(seen[seen.length - 1], ["a", "b"]);
      off();
    });
  });

  describe("invalidateOn", () => {
    it("refreshes on a matching event and the emit awaits the refetch", async () => {
      const bus = fakeBus();
      let call = 0;
      const r = resource(async () => ++call, {
        ready: false,
        events: bus,
        invalidateOn: "content:updated",
        filter: (p) => p?.collection === "likes",
      });
      await r.ensure();
      assert.equal(r.value.value, 1);
      await bus.emit("content:updated", { collection: "other" });
      assert.equal(r.value.value, 1);
      await bus.emit("content:updated", { collection: "likes" });
      assert.equal(r.value.value, 2);
    });

    it("is a no-op before the first fetch", async () => {
      const bus = fakeBus();
      let calls = 0;
      resource(async () => ++calls, { ready: false, events: bus, invalidateOn: "x" });
      await bus.emit("x", {});
      assert.equal(calls, 0);
    });

    it("detaches on dispose()", async () => {
      const bus = fakeBus();
      let calls = 0;
      const r = resource(async () => ++calls, { ready: false, events: bus, invalidateOn: "x" });
      await r.ensure();
      r.dispose();
      await bus.emit("x", {});
      assert.equal(calls, 1);
    });
  });

  describe("dependsOn", () => {
    it("refreshes when a dependency's value changes, but only after its own first resolve", async () => {
      const dep = resource(async () => "dep-v1", { ready: false, events: null });
      let calls = 0;
      const derived = resource(async () => {
        calls++;
        return `derived-of-${dep.peek()}`;
      }, { ready: false, events: null, dependsOn: [dep] });
      await dep.ensure();
      await tick();
      assert.equal(calls, 0);
      await derived.ensure();
      assert.equal(derived.value.value, "derived-of-dep-v1");
      dep.mutate(() => "dep-v2");
      await tick();
      assert.equal(calls, 2);
      assert.equal(derived.value.value, "derived-of-dep-v2");
    });

    it("a dependency that moves while the first load is in flight refreshes once that load lands", async () => {
      const dep = resource(async () => "dep-v1", { ready: false, events: null });
      await dep.ensure();
      const gate = Promise.withResolvers();
      let calls = 0;
      const derived = resource(async () => {
        calls++;
        const seen = dep.peek();
        if (calls === 1) await gate.promise;
        return `derived-of-${seen}`;
      }, { ready: false, events: null, dependsOn: [dep] });
      const first = derived.ensure();
      await tick();
      dep.mutate(() => "dep-v2");
      gate.resolve(undefined);
      await first;
      await tick();
      await tick();
      assert.equal(calls, 2);
      assert.equal(derived.value.value, "derived-of-dep-v2");
    });

    it("a dependency's own first value, arriving during the first load, is not a move", async () => {
      const gate = Promise.withResolvers();
      const dep = resource(async () => {
        await gate.promise;
        return "dep-v1";
      }, { ready: false, events: null });
      let calls = 0;
      const derived = resource(async () => {
        calls++;
        return `derived-of-${await dep.ensure()}`;
      }, { ready: false, events: null, dependsOn: [dep] });
      const done = derived.ensure();
      await tick();
      gate.resolve(undefined);
      assert.equal(await done, "derived-of-dep-v1");
      await tick();
      await tick();
      assert.equal(calls, 1);
    });
  });

  describe("eager", () => {
    it("kicks the first load without an ensure() call", async () => {
      let calls = 0;
      const r = resource(async () => ++calls, { ready: false, events: null, eager: true });
      await tick();
      assert.equal(calls, 1);
      assert.equal(r.value.value, 1);
    });
  });

  describe("keyedResource()", () => {
    it("memoizes one resource per key and isolates invalidation", async () => {
      const calls = { a: 0, b: 0 };
      const keyed = keyedResource(async (key) => {
        calls[key]++;
        return `${key}:${calls[key]}`;
      }, { ready: false, events: null });
      assert.equal(await keyed.get("a").ensure(), "a:1");
      assert.equal(await keyed.get("b").ensure(), "b:1");
      assert.equal(keyed.get("a"), keyed.get("a"));
      assert.equal(await keyed.get("a").ensure(), "a:1");
      keyed.invalidate("a");
      assert.equal(await keyed.get("a").ensure(), "a:2");
      assert.equal(await keyed.get("b").ensure(), "b:1");
      assert.deepEqual(keyed.keys().sort(), ["a", "b"]);
      keyed.invalidateAll();
      assert.deepEqual(keyed.keys(), []);
    });
  });
});

describe("@bootstrapp/light/controller: the view sync plugin", () => {
  it("keeps a synced property off attributes, and gives a query-backed one dataPending", () => {
    const plugin = /** @type {any} */ (syncPlugin);
    const props = plugin.props({ label: T.string(), mode: T.string({ sync: "local" }), rows: T.array({ sync: "x", query: {} }) });
    assert.equal(props.label.attribute, true);
    assert.equal(props.mode.attribute, false);
    assert.equal(props.dataPending.defaultValue, false);
    const plain = { label: T.string() };
    assert.equal(plugin.props(plain), plain);
  });
});

describe("@bootstrapp/light/controller/define.ts: the sync block", () => {
  it("binds a plain default to a named adapter, as the descriptor option does", () => {
    memoryStorage.set("blockMode", "stored");
    const ctrl = defineController({ name: "blockShort", props: { blockMode: "unset" }, sync: { blockMode: "memory" } });
    assert.equal(ctrl.blockMode, "stored");
    ctrl.blockMode = "written";
    assert.equal(memoryStorage.get("blockMode"), "written");
    ctrl.dispose();
    memoryStorage.remove("blockMode");
  });

  it("takes key and scope in the long form", () => {
    memoryStorage.set("w1:theme", "dark");
    const ctrl = defineController({
      name: "blockLong",
      props: { workspace: "w1", look: "light" },
      sync: { look: { to: "memory", key: "theme", scope: "workspace" } },
    });
    assert.equal(ctrl.look, "dark");
    ctrl.workspace = "w2";
    assert.equal(ctrl.look, "light", "a scope with nothing stored reads the declared default");
    ctrl.dispose();
    memoryStorage.remove("w1:theme");
  });

  it("binds to a signal and to another controller", () => {
    const sig = signal(4);
    const owner = defineController({ name: "blockOwner", props: { level: "hard" } });
    const ctrl = defineController({ name: "blockTargets", props: { n: 0, level: "easy" }, sync: { n: sig, level: owner } });
    assert.equal(ctrl.n, 4);
    assert.equal(ctrl.level, "hard");
    owner.level = "medium";
    assert.equal(ctrl.level, "medium");
    ctrl.dispose();
    owner.dispose();
  });

  it("carries a mixin's entries, and the definition's own entry wins", () => {
    const persisted = defineMixin({ props: { a: "", b: "" }, sync: { a: "memory", b: "memory" } });
    memoryStorage.set("a", "from a");
    memoryStorage.set("block-b", "from b");
    const ctrl = defineController({ name: "blockMixin", mixins: [persisted], sync: { b: { to: "memory", key: "block-b" } } });
    assert.equal(ctrl.a, "from a");
    assert.equal(ctrl.b, "from b");
    ctrl.dispose();
    memoryStorage.remove("a");
    memoryStorage.remove("block-b");
  });

  it("refuses an entry that names no property, a member, or an unknown option", () => {
    assert.throws(() => defineController({ name: "bad1", props: { a: 0 }, sync: { b: "memory" } }), /sync entry "b" names no declared property/);
    assert.throws(() => defineController({ name: "bad2", props: {}, go() {}, sync: { go: "memory" } }), /sync entry "go" names a member/);
    assert.throws(() => defineController({ name: "bad3", props: { a: 0 }, sync: { a: { to: "memory", keys: "x" } } }), /unknown option "keys"/);
    assert.throws(() => defineController({ name: "bad5", props: { a: [] }, sync: { a: { to: "memory", query: {} } } }), /declares query: for a target that takes none/);
    assert.throws(() => defineController({ name: "bad6", props: { a: [] }, sync: { a: { to: "memory", dependsOn: ["b"] } } }), /declares dependsOn: for a target that takes none/);
  });

  it("keeps sync off the instance", () => {
    const ctrl = defineController({ name: "blockOff", props: { a: 0 }, sync: { a: "memory" } });
    void ctrl.a;
    assert.equal("sync" in ctrl, false);
    ctrl.dispose();
    memoryStorage.remove("a");
  });
});

describe("@bootstrapp/light/controller/define.ts: what a definition refuses", () => {
  it("refuses adapter:, since every registered controller is a sync target", () => {
    assert.throws(() => defineController({ name: "oldAdapter", adapter: true, props: {} }), /adapter: is gone/);
  });

  it("refuses reactive: false in props, naming the member form", () => {
    assert.throws(
      () => defineController({ name: "oldField", props: { _timer: T.any({ reactive: false, defaultValue: null }) } }),
      /property "_timer" is reactive: false; a plain field is a member, _timer: \/\*\* @type \{T\} \*\/ \(value\)/,
    );
  });

  it("refuses a sync option inside a descriptor, naming the block", () => {
    for (const [option, descriptor] of [
      ["sync", T.string({ defaultValue: "", sync: "local" })],
      ["query", { $type: "array", query: { limit: 5 } }],
      ["dependsOn", { $type: "array", dependsOn: ["b"] }],
    ])
      assert.throws(
        () => defineController({ name: `old-${option}`, props: { a: descriptor } }),
        new RegExp(`property "a" declares ${option}: in its descriptor; bind it in the definition's sync block`),
      );
  });

  it("still takes a descriptor that carries no sync option", () => {
    const ctrl = defineController({ name: "plainDescriptor", props: { n: T.number({ defaultValue: 3 }) } });
    assert.equal(ctrl.n, 3);
    ctrl.dispose();
  });
});
