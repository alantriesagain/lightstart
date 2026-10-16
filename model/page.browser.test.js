import assert from "node:assert/strict";
import { describe, it } from "node:test";
import View from "@bootstrapp/light";
import T from "@bootstrapp/light/types";
import { html } from "@bootstrapp/light/html";
import { registerSyncBinder } from "@bootstrapp/light/controller";
import { syncPlugin } from "@bootstrapp/light/controller/view";
import { createModel, modelBus } from "@bootstrapp/light/model";
import { createStore, storeRequest } from "@bootstrapp/light/model/store";
import { createAdapter, registerStorageAdapter } from "@bootstrapp/light/model/adapter";
import IndexedDBAdapter from "@bootstrapp/light/model/indexeddb";
import { modelBinder } from "@bootstrapp/light/model/binder";

View.use(syncPlugin);
registerSyncBinder(modelBinder);
registerStorageAdapter("indexeddb", IndexedDBAdapter);

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("@bootstrapp/light/model: a page with no framework", () => {
  it("keeps rows in IndexedDB and binds a component to a live query", async () => {
    const models = { todo: { title: T.string({ required: true }), done: T.boolean({ index: true, defaultValue: false }) } };
    const name = `light-model-page-${Date.now()}`;
    const db = createAdapter("indexeddb", { name, version: 1, models, isDefaultAdapter: true });
    await db.init();
    const store = createStore({ models, databases: { indexeddb: db }, defaultAdapter: "indexeddb", emit: (event, data) => modelBus().emit(event, data) });
    const Model = createModel(storeRequest(store), { schemaOf: (model) => models[model] });
    const first = await Model.todo.add({ title: "write the test" });
    assert.equal(first.done, false, "the store applies the default");
    await assert.rejects(Model.todo.add({}), /Validation failed/);

    const tag = `light-model-page-${Date.now()}`;
    View.define(tag, {
      props: { todos: T.array({ defaultValue: [], sync: Model.todo, query: { where: { done: false }, order: "title" } }) },
      render() {
        return html`<ul>${this.todos.map((todo) => html`<li>${todo.title}</li>`)}</ul>`;
      },
    });
    const el = /** @type {any} */ (document.createElement(tag));
    document.body.appendChild(el);
    await el.$queries.todos.ensure();
    await el.$requestUpdate();
    assert.deepEqual([...el.querySelectorAll("li")].map((li) => li.textContent), ["write the test"]);

    await Model.todo.add({ title: "bind it" });
    await settled();
    await el.$queries.todos.ensure();
    await el.$requestUpdate();
    assert.deepEqual([...el.querySelectorAll("li")].map((li) => li.textContent), ["bind it", "write the test"], "a write reaches the bound query");

    await Model.todo.edit(first.id, { done: true });
    await settled();
    await el.$queries.todos.ensure();
    await el.$requestUpdate();
    assert.deepEqual([...el.querySelectorAll("li")].map((li) => li.textContent), ["bind it"], "the query's where follows the edit");
    assert.equal(await Model.todo.count({ where: { done: true } }), 1, "an indexed where answers from IndexedDB");

    el.remove();
    await store.close();
    indexedDB.deleteDatabase(name);
  });
});
