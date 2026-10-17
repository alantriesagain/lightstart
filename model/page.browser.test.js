import assert from "node:assert/strict";
import { describe, it } from "node:test";
import View from "@bootstrapp/light";
import T from "@bootstrapp/light/types";
import { html } from "@bootstrapp/light/html";
import { registerSyncBinder } from "@bootstrapp/light/controller";
import { syncPlugin } from "@bootstrapp/light/controller/view";
import { configureModel, defineModel, modelBus } from "@bootstrapp/light/model";
import { createStore, storeRequest } from "@bootstrapp/light/model/store";
import { createAdapter, registerStorageAdapter } from "@bootstrapp/light/model/adapter";
import IndexedDBAdapter from "@bootstrapp/light/model/indexeddb";
import { modelBinder } from "@bootstrapp/light/model/binder";

View.use(syncPlugin);
registerSyncBinder(modelBinder);
registerStorageAdapter("indexeddb", IndexedDBAdapter);

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @param {any} el @param {string[]} expected */
const listed = async (el, expected) => {
  const items = () => [...el.querySelectorAll("li")].map((li) => li.textContent);
  for (let tries = 0; tries < 100 && JSON.stringify(items()) !== JSON.stringify(expected); tries++) {
    await settled();
    await el.$queries.todos.ensure();
    await el.$requestUpdate();
  }
  return items();
};

describe("@bootstrapp/light/model: a page with no framework", () => {
  it("keeps rows in IndexedDB and binds a component to a live query", async () => {
    const todo = defineModel("todo", { title: T.string({ required: true }), done: T.boolean({ index: true, defaultValue: false }) });
    const models = { todo: todo.schema };
    const name = `light-model-page-${Date.now()}`;
    const db = createAdapter("indexeddb", { name, version: 1, models, isDefaultAdapter: true });
    await db.init();
    const store = createStore({ models, databases: { indexeddb: db }, defaultAdapter: "indexeddb", emit: (event, data) => modelBus().emit(event, data) });
    configureModel({ request: storeRequest(store) });
    const first = await todo.add({ title: "write the test" });
    assert.equal(first.done, false, "the store applies the default");
    await assert.rejects(todo.add({}), /Validation failed/);

    const tag = `light-model-page-${Date.now()}`;
    View.define(tag, {
      props: { todos: T.array({ defaultValue: [], sync: todo, query: { where: { done: false }, order: "title" } }) },
      render() {
        return html`<ul>${this.todos.map((todo) => html`<li>${todo.title}</li>`)}</ul>`;
      },
    });
    const el = /** @type {any} */ (document.createElement(tag));
    document.body.appendChild(el);
    await el.$queries.todos.ensure();
    await el.$requestUpdate();
    assert.deepEqual([...el.querySelectorAll("li")].map((li) => li.textContent), ["write the test"]);

    await todo.add({ title: "bind it" });
    assert.deepEqual(await listed(el, ["bind it", "write the test"]), ["bind it", "write the test"], "a write reaches the bound query");

    await todo.edit(first.id, { done: true });
    assert.deepEqual(await listed(el, ["bind it"]), ["bind it"], "the query's where follows the edit");
    assert.equal(await todo.count({ where: { done: true } }), 1, "an indexed where answers from IndexedDB");

    el.remove();
    await store.close();
    indexedDB.deleteDatabase(name);
  });
});
