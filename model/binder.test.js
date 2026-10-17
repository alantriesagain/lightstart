import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import T from "../types/index.js";
import { MODEL_CHANGED } from "./events.ts";
import { configureModel, modelApi, modelBus } from "./index.ts";
import { bindModelQuery, modelBinder, modelQuery } from "./binder.ts";
import { createStore } from "../signals/store.ts";
import { defineController, registerSyncBinder } from "../controller/index.ts";

registerSyncBinder(modelBinder);

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const fakeBackend = () => {
  const calls = [];
  const data = { session: [{ id: "a", n: 1 }, { id: "b", n: 3 }], account: [{ id: "x", name: "X" }] };
  /** @type {Promise<void> | null} */
  let gate = null;
  const request = async (action, model, payload) => {
    calls.push([action, model, payload]);
    if (gate) await gate;
    if (action === "MODEL:QUERY") {
      const { limit, offset = 0 } = payload.opts;
      const rows = data[model];
      return { rows: limit ? rows.slice(offset, offset + limit) : rows, total: rows.length };
    }
    if (action === "MODEL:GET") return data[model].find((r) => r.id === payload.id) ?? data[model][0] ?? null;
    return null;
  };
  return { calls, data, request, hold: (/** @type {Promise<void>} */ promise) => { gate = promise; } };
};

const change = (model, action, row) => modelBus().emit(MODEL_CHANGED, { model, action, row });

let models = {};
let Model;
const registry = (request) => {
  configureModel({ request });
  return { session: modelApi("session", () => models.session), account: modelApi("account", () => models.account) };
};

describe("modelQuery", () => {
  let backend;
  beforeEach(() => {
    backend = fakeBackend();
    models = { session: { n: T.number(), accountId: T.belongs("account") } };
    Model = registry(backend.request);
  });

  it("loads the page, exposes total, and refetches once per tick when the model changes", async () => {
    const res = modelQuery(Model.session, { order: "-n", limit: 1 });
    const seen = [];
    res.subscribe((v) => seen.push(v));
    const first = await res.ensure();
    assert.deepEqual(backend.calls.at(-1), ["MODEL:QUERY", "session", { opts: { order: "-n", limit: 1 } }]);
    assert.deepEqual(first, [{ id: "a", n: 1 }]);
    assert.equal(res.total, 2);
    backend.data.session.push({ id: "c", n: 2 });
    change("session", "add", { id: "c", n: 2 });
    change("session", "edit", { id: "c", n: 4 });
    await tick();
    assert.equal(backend.calls.filter(([a]) => a === "MODEL:QUERY").length, 2);
    assert.equal(res.total, 3);
    assert.notEqual(res.peek(), first);
    res.dispose();
    await change("session", "remove", { id: "a" });
    await tick();
    assert.equal(backend.calls.filter(([a]) => a === "MODEL:QUERY").length, 2);
  });

  it("a change on an included relation's model refetches too; a change while the query is in flight is not lost", async () => {
    let release;
    backend.hold(new Promise((resolve) => { release = resolve; }));
    const res = modelQuery(Model.session, { includes: ["accountId"] });
    const loading = res.ensure();
    await tick();
    assert.equal(backend.calls.length, 1, "the first query is in flight");
    await change("session", "add", { id: "z" });
    release();
    backend.hold(Promise.resolve());
    await loading;
    await tick();
    assert.equal(backend.calls.filter(([a]) => a === "MODEL:QUERY").length, 2);
    await change("account", "edit", { id: "x", name: "Y" });
    await tick();
    assert.equal(backend.calls.filter(([a]) => a === "MODEL:QUERY").length, 3);
    res.dispose();
  });

  it("eager: false waits for ensure()", async () => {
    const res = modelQuery(Model.session, { eager: false });
    await tick();
    assert.equal(backend.calls.length, 0);
    await res.ensure();
    assert.equal(backend.calls.length, 1);
    res.dispose();
  });
});

describe("bindModelQuery", () => {
  let backend;
  beforeEach(() => {
    backend = fakeBackend();
    models = { session: { n: T.number() }, account: { name: T.string() } };
    Model = registry(backend.request);
  });

  it("mirrors an array query into the store key, exposes the resource, settles loaded, and unbinds", async () => {
    const store = createStore({ rows: { default: [] }, dataPending: { default: false } }, { accessors: false });
    const host = {};
    const { unbind, loaded } = bindModelQuery({ store, key: "rows", prop: { $type: "array", query: { order: "n" } }, host, api: Model.session });
    assert.deepEqual(store.get("rows"), []);
    assert.equal(store.get("dataPending"), true);
    await loaded;
    assert.deepEqual(store.get("rows").map((r) => r.id), ["a", "b"]);
    assert.equal(host.$queries.rows.total, 2);
    assert.equal(store.get("dataPending"), false);
    backend.data.session.push({ id: "c", n: 9 });
    await change("session", "add", { id: "c", n: 9 });
    await tick();
    assert.equal(store.get("rows").length, 3);
    unbind();
    assert.equal(host.$queries.rows, undefined);
    await change("session", "add", { id: "d", n: 9 });
    await tick();
    assert.equal(store.get("rows").length, 3);
  });

  it("two bindings on one host share one $queries, whose identity survives an unbind of the other", async () => {
    const store = createStore({ rows: { default: [] }, accounts: { default: [] } }, { accessors: false });
    const host = {};
    const first = bindModelQuery({ store, key: "rows", prop: { $type: "array", query: {} }, host, api: Model.session });
    const queries = host.$queries;
    const second = bindModelQuery({ store, key: "accounts", prop: { $type: "array", query: {} }, host, api: Model.account });
    await Promise.all([first.loaded, second.loaded]);
    assert.equal(host.$queries, queries);
    assert.deepEqual(Object.keys(queries), ["rows", "accounts"]);
    first.unbind();
    assert.equal(host.$queries, queries);
    assert.deepEqual(Object.keys(queries), ["accounts"]);
    second.unbind();
    assert.deepEqual(Object.keys(queries), []);
  });

  it("an object property keeps one row live by id and rebuilds on dependsOn", async () => {
    const store = createStore({ current: { default: null }, currentId: { default: "a" } }, { accessors: false });
    const host = {};
    const { loaded } = bindModelQuery({
      store, key: "current", host, api: Model.session,
      prop: { $type: "object", dependsOn: ["currentId"], query: () => ({ id: store.get("currentId") }) },
    });
    await loaded;
    assert.equal(store.get("current").id, "a");
    store.set("currentId", "b");
    await host.$queries.current.ensure();
    assert.equal(store.get("current").id, "b");
    assert.deepEqual(backend.calls.at(-1), ["MODEL:GET", "session", { id: "b", opts: {} }]);
    await change("session", "edit", { id: "b", n: 5 });
    await tick();
    assert.equal(backend.calls.filter(([a]) => a === "MODEL:GET").length, 3);
  });

  it("a sync block entry binds a plain default to a model query", async () => {
    const instance = defineController({
      name: "library-block",
      props: { combos: [], owner: null },
      sync: { combos: { to: Model.session, query: { order: "n" } }, owner: { to: () => Model.account, query: { id: "x" } } },
    });
    await instance.$ready;
    assert.deepEqual(instance.combos.map((r) => r.id), ["a", "b"]);
    assert.equal(instance.owner.name, "X");
    assert.equal(instance.$queries.combos.total, 2);
    instance.dispose();
  });
});

afterEach(() => {
  Model = undefined;
  configureModel();
});
