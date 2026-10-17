import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { modelBus } from "./config.ts";
import T from "../types/index.js";
import { createStore } from "./store.ts";
import { registerAdapterDecorator } from "./factory.ts";
import { setFileStorage } from "./file-storage.ts";
import { buildQueryResult } from "./query-builder.ts";

const events = modelBus();

const memoryAdapter = (extra = {}) => {
  /** @type {Map<string, Map<string, any>>} */
  const tables = new Map();
  const table = (/** @type {string} */ m) => {
    if (!tables.has(m)) tables.set(m, new Map());
    return /** @type {Map<string, any>} */ (tables.get(m));
  };
  const calls = [];
  return {
    calls,
    tables,
    async init() {},
    async get(model, id) { calls.push(["get", model, id]); return table(model).get(String(id)) ?? null; },
    async query(model, opts) {
      calls.push(["query", model, opts]);
      const r = buildQueryResult([...table(model).values()], opts);
      return { rows: r.items, total: r.total };
    },
    async insert(model, row) {
      calls.push(["insert", model, row]);
      if (table(model).has(String(row.id))) throw new Error(`duplicate ${row.id}`);
      table(model).set(String(row.id), row);
      return row;
    },
    async update(model, row) { calls.push(["update", model, row]); table(model).set(String(row.id), row); return row; },
    async delete(model, id) { calls.push(["delete", model, id]); table(model).delete(String(id)); },
    async count(model, where) { return (await this.query(model, { where })).total; },
    async close() { calls.push(["close"]); },
    ...extra,
  };
};

const models = () => ({
  account: { name: T.string({ required: true }), kind: T.string({ defaultValue: "checking" }), tags: T.array({ defaultValue: [] }), transactions: T.many("transaction", "accountId") },
  transaction: { accountId: T.belongs("account"), amount: T.number({ required: true }), slug: T.string({ immutable: true }) },
  note: { $adapter: "file", title: T.string() },
  unit_item: { $extension: "unit", n: T.number() },
  heavy: { $heavy: ["body"], title: T.string(), body: T.string() },
  counter: { id: T.number(), n: T.number() },
});

const setup = ({ hooks = {}, extra = {} } = {}) => {
  const main = memoryAdapter(extra);
  const file = memoryAdapter();
  const ext = memoryAdapter();
  const emitted = [];
  const schemas = models();
  if (hooks.account) schemas.account.$hooks = hooks.account;
  if (hooks.transaction) schemas.transaction.$hooks = hooks.transaction;
  const store = createStore({
    models: schemas,
    databases: { indexeddb: main, file, "ext:unit": ext },
    defaultAdapter: "indexeddb",
    emit: (event, data) => emitted.push([event, data]),
  });
  return { store, main, file, ext, emitted, schemas };
};

afterEach(() => setFileStorage(null));

describe("store: routing", () => {
  it("maps a model to its $adapter, its $extension database, or the default", async () => {
    const { store, main, file, ext } = setup();
    assert.equal(store.adapterFor("account"), main);
    assert.equal(store.adapterFor("note"), file);
    assert.equal(store.adapterFor("unit_item"), ext);
    assert.throws(() => store.adapterFor("ghost"), /not mapped/);
  });

  it("addModels and addDatabase re-route; supportsOperator asks the adapter", () => {
    const { store } = setup();
    const pb = memoryAdapter({ supportsOperator: (op) => op === "like" });
    store.addDatabase("pocketbase", pb);
    store.addModels({ remote: { $adapter: "pocketbase", x: T.string() } });
    assert.equal(store.adapterFor("remote"), pb);
    assert.equal(store.supportsOperator("remote", "like"), true);
    assert.equal(store.supportsOperator("account", "like"), false);
  });
});

describe("store: add", () => {
  it("runs beforeAdd with the store, assigns an id, strips relations, fills defaults, validates, inserts, emits, runs afterAdd", async () => {
    const seen = [];
    const { store, main, emitted } = setup({
      hooks: {
        account: {
          beforeAdd: (data, ctx) => { seen.push(["before", ctx.operation, ctx.store === store, ctx.importing]); return { ...data, name: data.name.trim() }; },
          afterAdd: (row, ctx) => { seen.push(["after", row.id, ctx.model]); },
        },
      },
    });
    const row = await store.add("account", { name: " Checking ", transactions: [{ id: "t1" }] });
    assert.equal(row.name, "Checking");
    assert.equal(typeof row.id, "string");
    assert.equal(row.id.length, 15);
    assert.equal(row.kind, "checking");
    assert.deepEqual(row.tags, []);
    assert.equal("transactions" in row, false);
    assert.deepEqual(main.calls.at(-1), ["insert", "account", row]);
    assert.deepEqual(emitted, [["model:changed", { model: "account", action: "add", row }]]);
    assert.deepEqual(seen, [["before", "add", true, false], ["after", row.id, "account"]]);
  });

  it("a loaded belongs goes back to its id, a numeric-id model leaves the id to the adapter, nextId wins when present", async () => {
    const { store, main } = setup();
    const tx = await store.add("transaction", { accountId: { id: "a1", name: "A" }, amount: 3 });
    assert.equal(tx.accountId, "a1");
    const counter = await store.add("counter", { n: 1 });
    assert.equal(counter.id, undefined);
    main.nextId = (model, row) => `${model}:${row.amount}`;
    const named = await store.add("transaction", { accountId: "a1", amount: 9 });
    assert.equal(named.id, "transaction:9");
  });

  it("rejects with a ValidationError carrying the field errors, and inserts nothing", async () => {
    const { store, main, emitted } = setup();
    await assert.rejects(store.add("account", {}), (error) => {
      assert.equal(error.name, "ValidationError");
      assert.deepEqual(error.errors, { name: "name is required" });
      return true;
    });
    assert.equal(main.calls.some(([op]) => op === "insert"), false);
    assert.deepEqual(emitted, []);
  });

  it("default objects are cloned per row", async () => {
    const { store } = setup();
    const a = await store.add("account", { name: "a" });
    const b = await store.add("account", { name: "b" });
    assert.notEqual(a.tags, b.tags);
  });

  it("uploads T.file values through the registered storage before the insert", async () => {
    const uploads = [];
    setFileStorage({ upload: async (blob, opts) => { uploads.push({ size: blob.size, ...opts }); return { url: `/u/${opts.field}` }; } });
    const { store, schemas } = setup();
    schemas.account.avatar = T.file();
    const row = await store.add("account", { name: "a", avatar: new Blob(["xy"]) });
    assert.equal(row.avatar, "/u/avatar");
    assert.deepEqual(uploads, [{ size: 2, field: "avatar", model: "account" }]);
  });
});

describe("store: addMany, edit, remove, removeAll", () => {
  it("addMany prepares every row first, uses insertMany when the adapter has one, emits and runs afterAdd per row", async () => {
    const after = [];
    const { store, main, emitted } = setup({
      hooks: { account: { afterAdd: (row) => { after.push(row.id); } } },
      extra: { insertMany: async (model, rows) => { main.calls.push(["insertMany", model, rows.length]); for (const row of rows) main.tables.get(model)?.set(String(row.id), row); return rows; } },
    });
    main.tables.set("account", new Map());
    const rows = await store.addMany("account", [{ name: "a" }, { name: "b" }]);
    assert.equal(rows.length, 2);
    assert.deepEqual(main.calls.filter(([op]) => op === "insertMany"), [["insertMany", "account", 2]]);
    assert.equal(emitted.length, 2);
    assert.deepEqual(after, rows.map((r) => r.id));
  });

  it("addMany fails on the first bad row with its index and writes nothing", async () => {
    const { store, main } = setup();
    await assert.rejects(store.addMany("account", [{ name: "a" }, {}]), (error) => error.index === 1 && error.name === "ValidationError");
    assert.equal(main.calls.some(([op]) => op === "insert"), false);
  });

  it("edit strips immutable fields, hands beforeEdit the patch with its id, merges over the stored row, validates, updates, emits, runs afterEdit", async () => {
    const seen = [];
    const { store, main, emitted } = setup({
      hooks: { transaction: { beforeEdit: (data, ctx) => { seen.push([{ ...data }, ctx.id]); }, afterEdit: (row) => { seen.push(["after", row.amount]); } } },
    });
    const tx = await store.add("transaction", { accountId: "a1", amount: 1, slug: "first" });
    emitted.length = 0;
    const edited = await store.edit("transaction", tx.id, { amount: 2, slug: "changed", accountId: { id: "a2" } });
    assert.deepEqual(edited, { id: tx.id, accountId: "a2", amount: 2, slug: "first" });
    assert.deepEqual(seen, [[{ amount: 2, accountId: "a2", id: tx.id }, tx.id], ["after", 2]]);
    assert.deepEqual(main.calls.at(-1), ["update", "transaction", edited]);
    assert.deepEqual(emitted, [["model:changed", { model: "transaction", action: "edit", row: edited }]]);
    await assert.rejects(store.edit("transaction", "ghost", { amount: 1 }), /not found/);
    await assert.rejects(store.edit("transaction", tx.id, { amount: {} }), (error) => error.name === "ValidationError");
  });

  it("remove asks beforeRemove, deletes, emits the stored row, runs afterRemove; a false beforeRemove aborts", async () => {
    let allow = false;
    const seen = [];
    const { store, main, emitted } = setup({
      hooks: { account: { beforeRemove: (row) => { seen.push(["before", row?.name]); return allow; }, afterRemove: (row, ctx) => { seen.push(["after", row?.name, ctx.id]); } } },
    });
    const row = await store.add("account", { name: "a" });
    emitted.length = 0;
    assert.equal(await store.remove("account", row.id), false);
    assert.equal(main.calls.some(([op]) => op === "delete"), false);
    assert.deepEqual(emitted, []);
    allow = true;
    main.calls.length = 0;
    assert.equal(await store.remove("account", row.id), true);
    assert.deepEqual(main.calls.map(([op]) => op), ["get", "delete"], "a remove hook is handed the row, so it is read first");
    assert.deepEqual(emitted, [["model:changed", { model: "account", action: "remove", row }]]);
    assert.deepEqual(seen, [["before", "a"], ["before", "a"], ["after", "a", row.id]]);
    emitted.length = 0;
    await store.remove("account", "ghost");
    assert.deepEqual(emitted, [["model:changed", { model: "account", action: "remove", row: { id: "ghost" } }]]);
  });

  it("remove without a remove hook deletes without reading and emits { id }", async () => {
    const { store, main, emitted } = setup();
    const row = await store.add("account", { name: "a" });
    main.calls.length = 0;
    emitted.length = 0;
    assert.equal(await store.remove("account", row.id), true);
    assert.deepEqual(main.calls.map(([op]) => op), ["delete"]);
    assert.deepEqual(emitted, [["model:changed", { model: "account", action: "remove", row: { id: row.id } }]]);
  });

  it("removeAll resolves the ids a where matches and removes each through remove", async () => {
    const { store, main, emitted } = setup();
    await store.add("account", { name: "a", kind: "cash" });
    await store.add("account", { name: "b", kind: "cash" });
    await store.add("account", { name: "c" });
    emitted.length = 0;
    main.calls.length = 0;
    assert.equal(await store.removeAll("account", { kind: "cash" }), 2);
    assert.deepEqual(main.calls.map(([op]) => op), ["query", "delete", "delete"], "one read of the ids, then a delete each, nothing else");
    assert.equal(emitted.length, 2);
    assert.equal(await store.count("account"), 1);
  });
});

describe("store: reads", () => {
  it("getAll and get-by-where tell the adapter they discard the total; query does not", async () => {
    const { store, main } = setup();
    await store.add("account", { name: "A" });
    main.calls.length = 0;
    await store.getAll("account", { limit: 1 });
    await store.get("account", { name: "A" });
    await store.query("account", { limit: 1 });
    assert.deepEqual(main.calls.filter(([op]) => op === "query").map(([, , opts]) => opts.total), [false, false, undefined]);
  });

  it("get by id, by where (limit 1), with $heavy re-reading a light row, with fields and includes", async () => {
    const { store, main } = setup({
      extra: {
        async query(model, opts) {
          main.calls.push(["query", model, opts]);
          const r = buildQueryResult([...(main.tables.get(model)?.values() ?? [])], opts);
          const rows = model === "heavy" ? r.items.map(({ body: _body, ...light }) => light) : r.items;
          return { rows, total: r.total };
        },
      },
    });
    const account = await store.add("account", { name: "A" });
    await store.add("transaction", { accountId: account.id, amount: 5 });
    assert.equal((await store.get("account", account.id)).name, "A");
    assert.equal((await store.get("account", { name: "A" })).id, account.id);
    assert.equal(await store.get("account", { name: "zzz" }), null);
    assert.equal(await store.get("account", null), null);
    await store.add("heavy", { title: "t", body: "long" });
    main.calls.length = 0;
    const full = await store.get("heavy", { title: "t" });
    assert.deepEqual(main.calls.map(([op]) => op), ["query", "get"]);
    assert.equal(full.body, "long");
    main.calls.length = 0;
    await store.get("account", { name: "A" });
    assert.deepEqual(main.calls.map(([op]) => op), ["query"]);
    const withRelation = await store.get("account", account.id, { includes: ["transactions"], fields: ["name"] });
    assert.deepEqual(Object.keys(withRelation).sort(), ["id", "name", "transactions"]);
    assert.equal(withRelation.transactions[0].amount, 5);
  });

  it("query answers rows and total; getAll unwraps; includes load through the store", async () => {
    const { store } = setup();
    const account = await store.add("account", { name: "A" });
    for (const amount of [1, 2, 3]) await store.add("transaction", { accountId: account.id, amount });
    const page = await store.query("transaction", { order: "-amount", limit: 2 });
    assert.deepEqual(page.rows.map((r) => r.amount), [3, 2]);
    assert.equal(page.total, 3);
    const [tx] = await store.getAll("transaction", { where: { amount: 1 }, includes: ["accountId"] });
    assert.equal(tx.accountId.name, "A");
    await assert.rejects(store.query("transaction", { limit: -1 }), /limit/);
  });

  it("count, exists (borrowing count) and facets (empty without adapter support)", async () => {
    const { store } = setup({ extra: { facets: async (model, fields) => ({ [fields[0]]: { yes: 1 } }) } });
    await store.add("account", { name: "A", kind: "cash" });
    assert.equal(await store.count("account", { where: { kind: "cash" } }), 1);
    assert.equal(await store.exists("account", { kind: "cash" }), true);
    assert.equal(await store.exists("account", { kind: "gold" }), false);
    assert.deepEqual(await store.facets("account", ["kind"]), { kind: { yes: 1 } });
    assert.deepEqual(await store.facets("note", ["title"]), {});
  });
});

describe("store: import, export, close", () => {
  it("importData marks the hook context, skips unknown models; exportData answers every model", async () => {
    const seen = [];
    const { store, main } = setup({ hooks: { account: { beforeAdd: (data, ctx) => { seen.push(ctx.importing); } } } });
    await store.importData({ account: [{ name: "a" }], ghost: [{ x: 1 }] });
    assert.deepEqual(seen, [true]);
    const dump = await store.exportData();
    assert.deepEqual(Object.keys(dump).sort(), ["account", "counter", "heavy", "note", "transaction", "unit_item"]);
    assert.equal(dump.account.length, 1);
    await store.close();
    assert.deepEqual(main.calls.at(-1), ["close"]);
  });

  it("a store without emit stays silent", async () => {
    const store = createStore({ models: { thing: { n: T.number() } }, databases: { indexeddb: memoryAdapter() } });
    const row = await store.add("thing", { n: 1 });
    assert.equal(row.n, 1);
  });
});

describe("store: decorators and the shadow", () => {
  const seen = [];
  const contexts = [];
  registerAdapterDecorator("$wrapped", (base, ctx) => {
    contexts.push(ctx);
    return {
      init: () => base.init(),
      get: (model, id) => base.get(model, id),
      query: (model, opts) => { seen.push(["query", model]); return base.query(model, opts); },
      count: (model, where) => base.count(model, where),
      close: () => base.close(),
      insert: (model, row, opts) => { seen.push(["insert", opts]); return base.insert(model, row, opts); },
      update: (model, row, opts) => { seen.push(["update", opts]); return base.update(model, row, opts); },
      delete: (model, id, opts) => { seen.push(["delete", opts]); return base.delete(model, id, opts); },
    };
  });
  const draft = { $adapter: "file", $shadow: "indexeddb", $wrapped: true, title: T.string() };

  beforeEach(() => { seen.length = 0; contexts.length = 0; });

  it("wraps only the models declaring the directive, once each, with the base, the shadow and the store in hand", () => {
    const { store, main, file } = setup();
    store.addModels({ draft });
    const wrapped = store.adapterFor("draft");
    assert.notEqual(wrapped, file);
    assert.equal(store.adapterFor("draft"), wrapped, "memoized per model");
    assert.equal(store.baseAdapterFor("draft"), file);
    assert.equal(store.shadowFor("draft"), main);
    assert.equal(store.adapterFor("account"), main, "an undecorated model answers its raw adapter");
    assert.equal(store.shadowFor("account"), null);
    assert.equal(contexts.length, 1);
    assert.deepEqual([contexts[0].model, contexts[0].schema, contexts[0].store, contexts[0].shadow], ["draft", draft, store, main]);
    store.addModels({ other: { n: T.number() } });
    assert.notEqual(store.adapterFor("draft"), wrapped, "re-routing rebuilds the wrap");
  });

  it("write options reach insert, insertMany, update (with the normalised patch) and delete", async () => {
    const { store } = setup();
    store.addModels({ draft });
    const row = await store.add("draft", { title: "t" }, { direct: true });
    await store.addMany("draft", [{ title: "u" }], { importing: true });
    await store.edit("draft", /** @type {string} */ (row.id), { title: "v", id: "ignored" });
    await store.remove("draft", /** @type {string} */ (row.id), { direct: true });
    assert.deepEqual(seen, [
      ["insert", { direct: true }],
      ["insert", { importing: true }],
      ["update", { patch: { title: "v" } }],
      ["delete", { direct: true }],
    ]);
  });

  it("exportData reads every model through its base adapter, never the decorator", async () => {
    const { store } = setup();
    store.addModels({ draft });
    await store.add("draft", { title: "t" });
    seen.length = 0;
    const dump = await store.exportData();
    assert.equal(dump.draft.length, 1);
    assert.deepEqual(seen, []);
  });
});

describe("store: relation loader reads through the store", () => {
  let ctx;
  beforeEach(() => { ctx = setup(); });

  it("belongs_many and polymorphic belongs resolve with one query per target", async () => {
    const { store, schemas, main } = ctx;
    schemas.post = { title: T.string(), tags: T.belongs_many("tag") };
    schemas.tag = { name: T.string() };
    schemas.comment = { target: T.belongs(["post", "tag"]) };
    store.addModels({});
    const t1 = await store.add("tag", { name: "one" });
    const t2 = await store.add("tag", { name: "two" });
    const post = await store.add("post", { title: "p", tags: [t1.id, t2.id] });
    await store.add("comment", { target: post.id, targetType: "post" });
    await store.add("comment", { target: t1.id, targetType: "tag" });
    const [loaded] = await store.getAll("post", { includes: ["tags"] });
    assert.deepEqual(loaded.tags.map((t) => t.name).sort(), ["one", "two"]);
    main.calls.length = 0;
    const comments = await store.getAll("comment", { includes: ["target"] });
    assert.deepEqual(comments.map((c) => c.target?.title ?? c.target?.name), ["p", "one"]);
    assert.equal(main.calls.filter(([op]) => op === "query").length, 3);
  });
});
