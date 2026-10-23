import assert from "node:assert/strict";
import { describe, it } from "node:test";
import T from "../types/index.js";
import { signal } from "../signals/index.ts";
import { configureModel, defineModel, modelBus } from "../model/index.ts";
import { createStore, storeRequest } from "../model/store.ts";
import { buildQueryResult, createAdapter, registerStorageAdapter } from "../model/adapter.ts";
import { liveRows } from "../model/binder.ts";
import { Controller } from "./class.ts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

/** @type {Map<string, Record<string, unknown>>} */
const rows = new Map();
registerStorageAdapter("memory", {
  async init() {},
  /** @param {string} _model @param {string | number} id */
  async get(_model, id) {
    return rows.get(String(id)) ?? null;
  },
  /** @param {string} _model @param {Record<string, unknown>} opts */
  async query(_model, opts) {
    const result = buildQueryResult([...rows.values()], opts);
    return { rows: result.items, total: result.total };
  },
  /** @param {string} _model @param {Record<string, unknown>} row */
  async insert(_model, row) {
    rows.set(String(row.id), row);
    return row;
  },
  /** @param {string} _model @param {Record<string, unknown>} row */
  async update(_model, row) {
    rows.set(String(row.id), row);
    return row;
  },
  /** @param {string} _model @param {string | number} id */
  async delete(_model, id) {
    return rows.delete(String(id));
  },
  async count() {
    return rows.size;
  },
  async close() {},
});

const notes = defineModel("notes", { title: T.string({ required: true }), done: T.boolean({ defaultValue: false }), at: T.number({ defaultValue: 0 }) });
const db = createAdapter("memory", { name: "class-test" });
await db.init();
const store = createStore({ models: { notes: notes.schema }, databases: { memory: db }, defaultAdapter: "memory", emit: (event, data) => modelBus().emit(event, data) });
configureModel({ request: storeRequest(store) });

class Board extends Controller {
  filter = signal("all");
  hooks = /** @type {string[]} */ ([]);
  rows = liveRows(this, notes, () => (this.filter.value === "all" ? { order: "at" } : { where: { done: this.filter.value === "done" }, order: "at" }));

  constructor() {
    super("board");
  }

  connected() {
    this.hooks.push("connected");
    return this.warm();
  }

  async warm() {
    await tick();
    this.hooks.push("ready");
  }

  disconnected() {
    this.hooks.push("disconnected");
    return null;
  }

  titles() {
    return this.rows.value.map((row) => String(row.title)).join(",");
  }
}

describe("@bootstrapp/light/controller/class: a controller as a class", () => {
  it("start() runs connected() and $ready settles with it and the first load", async () => {
    const board = new Board();
    assert.deepEqual(board.hooks, []);
    const ready = board.start();
    assert.deepEqual(board.hooks, ["connected"]);
    assert.equal(ready, board.$ready);
    await ready;
    assert.deepEqual(board.hooks, ["connected", "ready"]);
    assert.equal(board.rows.pending, false);
    assert.deepEqual(board.rows.value, []);
    await board.dispose();
  });

  it("the rows follow the model's writes and the query is built again when a signal build reads changes", async () => {
    const board = new Board();
    await board.start();
    await notes.add({ title: "a", at: 1 });
    await notes.add({ title: "b", at: 2 });
    await settle();
    assert.equal(board.titles(), "a,b");
    assert.equal(board.rows.total, 2);
    const first = board.rows.value[0];
    await notes.edit(String(first.id), { done: true });
    board.filter.value = "done";
    await settle();
    assert.equal(board.titles(), "a");
    board.filter.value = "open";
    await settle();
    assert.equal(board.titles(), "b");
    assert.deepEqual(board.rows.peek(), board.rows.value);
    await board.dispose();
    await notes.removeAll();
    await settle();
  });

  it("dispose() runs disconnected() then the teardowns, and the rows stop following", async () => {
    const board = new Board();
    await board.start();
    let torn = 0;
    const teardown = () => {
      torn++;
    };
    assert.equal(board.$own(teardown), teardown);
    await notes.add({ title: "kept", at: 1 });
    await settle();
    assert.equal(board.titles(), "kept");
    await board.dispose();
    assert.equal(board.hooks.at(-1), "disconnected");
    assert.equal(torn, 1);
    await notes.add({ title: "unseen", at: 2 });
    await settle();
    assert.equal(board.titles(), "kept");
    await notes.removeAll();
    await settle();
  });
});
