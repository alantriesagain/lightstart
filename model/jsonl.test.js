import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import T from "../types/index.js";
import JsonlAdapter from "./jsonl.js";
import { createAdapter, registerStorageAdapter } from "./adapter.js";
import { createStore, storeRequest } from "./store.js";
import { configureModel, defineModel, modelBus, onChange } from "./index.js";

registerStorageAdapter("jsonl", JsonlAdapter);

const memoryIO = () => {
  /** @type {Map<string, string>} */
  const files = new Map();
  return {
    files,
    /** @param {string} path */
    read: (path) => files.get(path) ?? null,
    /** @param {string} path @param {string} text */
    append: (path, text) => files.set(path, (files.get(path) ?? "") + text),
    /** @param {string} path @param {string} text */
    write: (path, text) => files.set(path, text),
  };
};

/** @param {ReturnType<typeof memoryIO>} io */
const open = async (io) => {
  const db = createAdapter("jsonl", { name: "tasks", dir: "data", io });
  await db.init();
  return db;
};

/** @param {string} text */
const lines = (text) => text.split("\n").filter(Boolean).map((line) => JSON.parse(line));

afterEach(() => configureModel());

describe("the JSONL adapter", () => {
  it("appends a line per write and answers the same rows after a reload", async () => {
    const io = memoryIO();
    const db = await open(io);
    await db.insert("task", { id: "a", title: "one" });
    await db.insert("task", { id: "b", title: "two" });
    await db.update("task", { id: "a", title: "one, edited" });
    assert.deepEqual(lines(io.files.get("data/task.jsonl") ?? ""), [
      { id: "a", title: "one" },
      { id: "b", title: "two" },
      { id: "a", title: "one, edited" },
    ]);
    const again = await open(io);
    assert.deepEqual((await again.query("task", { order: "id" })).rows, [{ id: "a", title: "one, edited" }, { id: "b", title: "two" }]);
    assert.deepEqual(await again.get("task", "a"), { id: "a", title: "one, edited" });
  });

  it("writes a removal as a line, so a reload leaves the row out", async () => {
    const io = memoryIO();
    const db = await open(io);
    await db.insert("task", { id: "a", title: "one" });
    assert.equal(await db.delete("task", "a"), true);
    assert.equal(await db.delete("task", "a"), false);
    assert.deepEqual(lines(io.files.get("data/task.jsonl") ?? "").at(-1), { id: "a", $removed: true });
    const again = await open(io);
    assert.equal(await again.get("task", "a"), null);
    assert.equal(await again.count("task"), 0);
  });

  it("skips a line an interrupted append cut short and rewrites the file whole", async () => {
    const io = memoryIO();
    io.files.set("data/task.jsonl", '{"id":"a","title":"one"}\n{"id":"b","tit');
    const db = await open(io);
    assert.deepEqual((await db.query("task", {})).rows, [{ id: "a", title: "one" }]);
    assert.equal(io.files.get("data/task.jsonl"), '{"id":"a","title":"one"}\n');
    await db.insert("task", { id: "c", title: "three" });
    assert.deepEqual(lines(io.files.get("data/task.jsonl") ?? "").map((row) => row.id), ["a", "c"]);
  });

  it("rewrites a file with its rows alone once the lines it no longer needs outnumber them", async () => {
    const io = memoryIO();
    const db = await open(io);
    await db.insert("task", { id: "a", n: 0 });
    for (let n = 1; n <= 32; n++) await db.update("task", { id: "a", n });
    assert.equal(lines(io.files.get("data/task.jsonl") ?? "").length, 33);
    await db.update("task", { id: "a", n: 33 });
    assert.deepEqual(lines(io.files.get("data/task.jsonl") ?? ""), [{ id: "a", n: 33 }]);
  });

  it("filters, orders and counts in memory and answers copies", async () => {
    const io = memoryIO();
    const db = await open(io);
    await db.insertMany("task", [{ id: "a", done: true, at: 2 }, { id: "b", done: false, at: 1 }, { id: "c", done: false, at: 3 }]);
    assert.deepEqual((await db.query("task", { where: { done: false }, order: "-at" })).rows.map((row) => row.id), ["c", "b"]);
    assert.equal((await db.query("task", { limit: 1 })).total, 3);
    assert.equal(await db.count("task", { done: false }), 2);
    assert.equal(await db.exists("task", { done: true }), true);
    const row = await db.get("task", "a");
    if (row) row.done = false;
    assert.equal(await db.count("task", { done: true }), 1);
  });

  it("refuses a row without an id, or one whose id is stored, and truncates to an empty file", async () => {
    const io = memoryIO();
    const db = await open(io);
    await db.insert("task", { id: "a" });
    await assert.rejects(db.insert("task", { id: "a" }), /a row with id "a" exists/);
    await assert.rejects(db.insert("task", { title: "x" }), /needs an id/);
    await db.truncate?.("task");
    assert.equal(io.files.get("data/task.jsonl"), "");
    assert.equal(await db.count("task"), 0);
  });

  it("holds a defined model's rows behind the store, and a reload reads them back", async () => {
    const io = memoryIO();
    const tasks = defineModel("tasks", { title: T.string({ required: true }), done: T.boolean({ defaultValue: false }) });
    const start = async () => {
      const db = await open(io);
      const store = createStore({ models: { tasks: tasks.schema }, databases: { jsonl: db }, defaultAdapter: "jsonl", emit: (event, data) => modelBus().emit(event, data) });
      configureModel({ request: storeRequest(store) });
    };
    await start();
    const heard = [];
    const stop = onChange("tasks", undefined, (event) => heard.push(event.action));
    const first = await tasks.add({ title: "write the adapter" });
    await tasks.add({ title: "test it" });
    await tasks.edit(String(first.id), { done: true });
    await assert.rejects(tasks.add({ done: true }), /Validation failed/);
    stop();
    assert.deepEqual(heard, ["add", "add", "edit"]);
    await start();
    assert.deepEqual((await tasks.getAll({ order: "title" })).map((row) => [row.title, row.done]), [["test it", false], ["write the adapter", true]]);
  });
});
