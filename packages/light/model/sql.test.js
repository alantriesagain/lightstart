import assert from "node:assert/strict";
import { describe, it } from "node:test";
import T from "../types/index.js";
import SqlAdapter from "./sql.ts";
import { applyMigrations, applySchema, tableColumns } from "./sql-builder.ts";
import { createAdapter, registerStorageAdapter } from "./adapter.ts";
import { createStore } from "./store.ts";
import { Database } from "@lightstart/sqlite/node";

registerStorageAdapter("sql", SqlAdapter);

const noteSchema = {
  title: T.string({ required: true, unique: true }),
  tags: T.array({ defaultValue: [] }),
  published: T.boolean({ defaultValue: false }),
  score: T.number(),
  $indexes: [{ fields: ["published", "score"] }],
};

const open = async (models) => {
  const db = Database.open(":memory:");
  const adapter = createAdapter("sql", { name: "test", db, models });
  await adapter.init();
  const store = createStore({ models, databases: { sql: adapter }, defaultAdapter: "sql" });
  return { db, store };
};

describe("the SQL adapter over node:sqlite", () => {
  it("creates the table from the schema and round-trips JSON and booleans", async () => {
    const { store } = await open({ note: noteSchema });
    const row = await store.add("note", { title: "one", tags: ["a", "b"], published: true, score: 2 });
    assert.equal(typeof row.id, "string");
    assert.deepEqual(row.tags, ["a", "b"]);
    assert.equal(row.published, true);
    assert.equal(row.score, 2);
    assert.deepEqual(await store.get("note", row.id), row);
    await store.close();
  });

  it("queries where, order, limit and has", async () => {
    const { store } = await open({ note: noteSchema });
    await store.add("note", { title: "one", tags: ["a"], score: 1 });
    await store.add("note", { title: "two", tags: ["a", "b"], score: 3 });
    await store.add("note", { title: "three", tags: ["b"], score: 2 });
    const has = await store.query("note", { where: { tags: { has: "a" } }, order: "-score" });
    assert.deepEqual(has.rows.map((row) => row.title), ["two", "one"]);
    assert.equal(has.total, 2);
    const page = await store.query("note", { order: "title", limit: 2, offset: 1 });
    assert.deepEqual(page.rows.map((row) => row.title), ["three", "two"]);
    assert.equal(page.total, 3);
    assert.equal(await store.count("note", { published: false }), 3);
    await store.close();
  });

  it("edits and removes through the store pipeline", async () => {
    const { store } = await open({ note: noteSchema });
    const row = await store.add("note", { title: "one" });
    const edited = await store.edit("note", row.id, { title: "one, edited", tags: ["c"] });
    assert.equal(edited.title, "one, edited");
    assert.deepEqual(edited.tags, ["c"]);
    assert.equal(await store.remove("note", row.id), true);
    assert.equal(await store.get("note", row.id), null);
    await store.close();
  });

  it("enforces the unique index the schema declares", async () => {
    const { store } = await open({ note: noteSchema });
    await store.add("note", { title: "one" });
    await assert.rejects(() => store.add("note", { title: "one" }), /UNIQUE/);
    await store.close();
  });

  it("leaves SQLite to assign a numeric id", async () => {
    const questionSchema = { id: T.number(), name: T.string() };
    const { store } = await open({ question: questionSchema });
    const first = await store.add("question", { name: "one" });
    const second = await store.add("question", { name: "two" });
    assert.equal(typeof first.id, "number");
    assert.equal(second.id, first.id + 1);
    await store.close();
  });

  it("adds a column without dropping the rows already there", async () => {
    const db = Database.open(":memory:");
    applySchema(db, { note: { title: T.string() } });
    db.exec("INSERT INTO note (id, title) VALUES ('a', 'one')");
    applySchema(db, { note: { title: T.string(), pinned: T.boolean({ defaultValue: false }) } });
    assert.deepEqual(tableColumns(db, "note"), ["id", "title", "created", "updated", "pinned"]);
    assert.equal(JSON.stringify(db.prepare("SELECT id, pinned FROM note").all()), '[{"id":"a","pinned":0}]');
    db.close();
  });

  it("runs explicit migrations once and records them", async () => {
    const db = Database.open(":memory:");
    applySchema(db, { note: { title: T.string() } });
    const migrations = [
      { name: "0001-extra", sql: "ALTER TABLE note ADD COLUMN extra TEXT" },
      { name: "0002-backfill", sql: ["UPDATE note SET extra = 'x'"] },
    ];
    applyMigrations(db, migrations);
    applyMigrations(db, migrations);
    assert.deepEqual(db.prepare("SELECT name FROM _migrations ORDER BY name").all().map((row) => row.name), ["0001-extra", "0002-backfill"]);
    assert.deepEqual(tableColumns(db, "note").includes("extra"), true);
    db.close();
  });
});
