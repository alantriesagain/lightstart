import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import T from "../types/index.js";
import { createStore } from "./store.ts";
import IndexedDBAdapter from "./indexeddb.ts";

if (typeof indexedDB === "undefined")
  throw new Error("indexedDB is not defined; browser-only suite, run with --browser");

const models = {
  session: {
    dayKey: T.string({ index: true }),
    done: T.boolean({ index: true, defaultValue: false }),
    startedAt: T.datetime(),
    tags: T.array({ index: true, defaultValue: [] }),
    note: T.string({ defaultValue: "" }),
  },
};

const open = (name, extra = {}) => {
  const adapter = Object.assign(Object.create(IndexedDBAdapter), { name, version: 1, models, isDefaultAdapter: true, ...extra });
  return adapter;
};

describe("IndexedDB adapter", () => {
  const name = `idb-test-${Date.now()}`;
  let adapter;
  let store;

  before(async () => {
    await new Promise((resolve) => { const req = indexedDB.deleteDatabase(name); req.onsuccess = req.onerror = () => resolve(undefined); });
    adapter = open(name);
    await adapter.init();
    store = createStore({ models, databases: { indexeddb: adapter }, defaultAdapter: "indexeddb" });
  });

  after(async () => {
    await adapter.close();
    await new Promise((resolve) => { const req = indexedDB.deleteDatabase(name); req.onsuccess = req.onerror = () => resolve(undefined); });
  });

  it("round-trips booleans and dates through their stored encodings", async () => {
    const started = new Date("2026-01-02T03:04:05Z");
    const row = await store.add("session", { dayKey: "2026-01-02", done: true, startedAt: started, tags: ["a", "b"] });
    assert.equal(row.done, true);
    assert.equal(row.startedAt instanceof Date, true);
    const raw = await new Promise((resolve) => {
      const request = adapter.db.transaction("session").objectStore("session").get(row.id);
      request.onsuccess = () => resolve(request.result);
    });
    assert.equal(raw.done, 1);
    assert.equal(raw.startedAt, started.getTime());
    const back = await store.get("session", row.id);
    assert.equal(back.done, true);
    assert.equal(back.startedAt.getTime(), started.getTime());
    assert.equal(back.note, "");
  });

  it("query reads a key range from an index and matches the rest in memory", async () => {
    await store.addMany("session", [
      { dayKey: "2026-01-03", done: false, tags: ["a"] },
      { dayKey: "2026-01-04", done: true, tags: ["c"] },
      { dayKey: "2026-01-05", done: false, tags: [] },
    ]);
    const page = await store.query("session", { where: { dayKey: { ">=": "2026-01-03", "<=": "2026-01-04" }, done: false }, order: "-dayKey", limit: 5 });
    assert.deepEqual(page.rows.map((r) => r.dayKey), ["2026-01-03"]);
    assert.equal(page.total, 1);
    const tagged = await store.getAll("session", { where: { tags: { has: "a" } } });
    assert.equal(tagged.length, 2);
    assert.equal(await store.count("session", { where: { done: true } }), 2);
    assert.equal(await store.count("session"), 4);
    assert.equal(await store.exists("session", { dayKey: "2026-01-05" }), true);
  });

  it("update replaces the row, delete removes it, insertMany writes one transaction", async () => {
    const [row] = await store.getAll("session", { where: { dayKey: "2026-01-05" } });
    const edited = await store.edit("session", row.id, { note: "edited", done: true });
    assert.equal(edited.note, "edited");
    assert.equal((await store.get("session", row.id)).done, true);
    await store.remove("session", row.id);
    assert.equal(await store.get("session", row.id), null);
    const rows = await adapter.insertMany("session", [{ id: "bulk-1", dayKey: "x" }, { id: "bulk-2", dayKey: "y" }]);
    assert.deepEqual(rows.map((r) => r.id), ["bulk-1", "bulk-2"]);
    assert.equal(await adapter.count("session", { dayKey: "x" }), 1);
  });

  it("reopening with a new model adds its store one version up", async () => {
    await adapter.close();
    const grown = open(name, { models: { ...models, note: { body: T.string() } } });
    const db = await grown.init();
    assert.equal(db.objectStoreNames.contains("note"), true);
    assert.equal(db.version, 2);
    await grown.close();
    adapter = open(name, { version: "auto" });
    await adapter.init();
  });

  it("a model whose $shadow names this adapter gets a store and its indexes here, beside the models that live here", async () => {
    await adapter.close();
    const shadowed = open(name, { version: "auto", models: { ...models, draft: { $adapter: "file", $shadow: "indexeddb", title: T.string({ index: true }) } } });
    const db = await shadowed.init();
    assert.equal(db.objectStoreNames.contains("draft"), true);
    assert.equal(db.transaction("draft").objectStore("draft").indexNames.contains("title"), true);
    await shadowed.insert("draft", { id: "d1", title: "a", pending: { id: "s1" } });
    await shadowed.insert("draft", { id: "d2", title: "b" });
    const { rows, total } = await shadowed.query("draft", { where: { title: "a" } });
    assert.deepEqual([rows, total], [[{ id: "d1", title: "a", pending: { id: "s1" } }], 1], "a row keeps keys the schema does not name");
    await shadowed.close();
    adapter = open(name, { version: "auto" });
    await adapter.init();
  });
});
