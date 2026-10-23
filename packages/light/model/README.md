# @bootstrapp/light/model

The data layer: a schema per model, a store that runs every write the same way over any storage adapter, a model's api that its module declares and every user imports, and one change event that keeps every live query current. It needs no host: a page or a native program builds a store and binds components and controllers to its queries. A host that keeps the store elsewhere (Bootstrapp runs it in a db-worker) configures a request that crosses to it and forwards the change event back.

## Entries

Each entry loads only its own code; nothing is a barrel.

| Entry | Holds |
|---|---|
| `@bootstrapp/light/model` | `defineModel`, `modelApi`, `isModelApi`, `onChange`, `ValidationError`, `registerQueryHook`, `setFileStorage`, `configureModel`, `modelRequest`, `modelBus` |
| `@bootstrapp/light/model/store` | `createStore`, `storeRequest`, `createModelHandlers` |
| `@bootstrapp/light/model/adapter` | the storage SPI: `registerStorageAdapter`, `createAdapter`, `registerAdapterDecorator`, `validateRow`, the query helpers |
| `@bootstrapp/light/model/indexeddb` | the IndexedDB adapter |
| `@bootstrapp/light/model/jsonl` | the JSON Lines adapter: a file per model, through the IO its host hands it |
| `@bootstrapp/light/model/binder` | `modelQuery`, `bindModelQuery`, `modelBinder` |
| `@bootstrapp/light/model/slug` | `slugify`, `slugHooks` |
| `@bootstrapp/light/model/events` | the event names the model emits |

`@bootstrapp/light/model` is what a page that talks to a store elsewhere loads: it reaches no store, no adapter and no binding.

## A page with no host

```javascript
import T from "@bootstrapp/light/types";
import { configureModel, defineModel, modelBus } from "@bootstrapp/light/model";
import { createStore, storeRequest } from "@bootstrapp/light/model/store";
import { createAdapter, registerStorageAdapter } from "@bootstrapp/light/model/adapter";
import IndexedDBAdapter from "@bootstrapp/light/model/indexeddb";

// models/todos.js
export const todos = defineModel("todos", { title: T.string({ required: true }), done: T.boolean({ index: true, defaultValue: false }) });

// the page's entry
registerStorageAdapter("indexeddb", IndexedDBAdapter);
const models = { todos: todos.schema };
const db = createAdapter("indexeddb", { name: "todos", version: 1, models, isDefaultAdapter: true });
await db.init();
const store = createStore({ models, databases: { indexeddb: db }, defaultAdapter: "indexeddb", emit: (event, data) => modelBus().emit(event, data) });
configureModel({ request: storeRequest(store) });
```

Importing the IndexedDB adapter registers nothing; the page names it. `emit` is how the store's writes reach `onChange` and every live query; a store built without it writes silently. The store holds schemas by model name, the same names the models were defined with.

## API

Every model operation goes through the model's api, a plain object of eleven methods. `defineModel(name, schema)` builds it, and a module that uses the model imports it. Rows are plain objects, typed by the schema: `RowOf<S>` makes a field declared `required: true` or given a default (`T.boolean({ defaultValue: false })`, `T.number(0)`) present on every row, since the store fills defaults on every add, leaves the other fields optional, adds `null` to a field whose default is `null`, and types `id` as the declared `id` descriptor's value (`id: T.number()`) or else the string the store assigns. `type Todo = ModelRow<typeof todos>` names the row a model answers. The type describes rows written under the current schema: `edit` does not check `required` again, and a field made required later is not filled into the rows written before it.

```javascript
const row  = await users.get(id, { includes });
const row  = await users.get({ where: { email } });
const rows = await users.getAll({ where, order, limit, offset, fields, includes });
const page = await users.query({ where, limit: 20, offset });   // { rows, total }
const n    = await users.count({ where });
const yes  = await users.exists({ email });
const f    = await places.facets(["city"], { where });
const row  = await users.add(data);        // resolves the stored row, rejects on failure
const rows = await users.addMany(list);
const row  = await users.edit(id, patch);  // or edit({ id, ...patch })
await users.remove(id);
await users.removeAll(where);
```

A write rejects on failure. A schema rejection is a `ValidationError` whose `errors` maps each failing field to its message. `users.schema` is the model's schema.

Every method sends through the request `configureModel({ request })` set, read when the call is made: `request(action, model, payload)` with `action` one of the `MODEL:*` commands. `storeRequest(store)` answers it from a store in the same runtime; across a worker, `createModelHandlers(getStore)` is the same map on the worker's side. Until a request is configured, a call rejects. A host that resolves schemas by name builds an api with `modelApi(name, schemaOf)`, where `schemaOf()` answers the schema when it is read; Bootstrapp's `$APP.Model` is that under every name.

`registerQueryHook(({ model, schema, opts }) => opts)` shapes every read before it is sent, in registration order; a hook answers the options to use, or nothing to keep them.

### Query options

| Option | Type | Description |
|--------|------|-------------|
| `where` | object | Filter: `{ status: "active", age: { ">": 21 } }` |
| `order` | string/array | `"-createdAt"` or `"createdAt"` (comma list allowed), `"createdAt DESC"`, or `[{ field, direction }]` |
| `limit` | number | Max rows |
| `total` | boolean | `false` says the caller discards the total, so an adapter that pays a request for it skips the count; `getAll` and `get` set it, `query` keeps the total |
| `offset` | number | Skip rows |
| `fields` | string[] | Select columns (always includes `id`) |
| `includes` | string[] | Eager-load relationships one level deep: `["author", "posts"]` |
| `groupBy` | string | Deduplicate by field |

### Where operators

`=` (default), `>`, `>=`, `<`, `<=`, `!=`, `<>`, `in`, `not in`, `has`, `has all`, `like`, `ilike`, `is null`, `is not null`. `has` is array-contains; `in`/`not in` against an array field mean intersects/disjoint. The `id` field compares as a string on every operator, so numeric and string ids match across adapters.

## Live queries

The store emits `model:changed` (`{ model, action: "add" | "edit" | "remove", row }`) after every write, through its `emit`. A fourth action, `sync`, carries no row and means the whole collection changed. `onChange(model, where, cb)` runs `cb` for every matching change (a removal and a sync always match) and answers the unsubscribe. A `remove` carries the stored row when the model declares a remove hook, `{ id }` otherwise: the store reads nothing it does not need.

`onChange` listens on the model's bus. With no host the model keeps its own; `configureModel({ events })` hands it the host's (anything with `on(key, cb)` answering the unsubscribe and `emit(key, data)`), which is where a host forwards changes made elsewhere. `modelBus()` is the bus in use. `configureModel({ makeId })` is where a new row's id comes from: light's default draws from `Math.random`, which every runtime it compiles to has, and a host that wants ids from the platform's crypto source passes one.

Everything above `onChange` is one implementation, `modelQuery(api, opts)` in `/model/binder`: a `query()` inside a light `resource()` that refetches, coalesced per tick, when its model or an included relation's model changes. `limit`, `offset` and `total` are live-safe. `modelBinder` teaches light's sync binding the model; a page registers it with `registerSyncBinder(modelBinder)`, and then a property binds to a model's api:

```javascript
// a controller property, bound in the sync block
props: { rows: [], one: null },
sync: { rows: { to: sessions, query: { where, order, fields } }, one: { to: sessions, query: (self) => ({ id: self.currentId }) } },
// a component property
rows: T.array({ defaultValue: [], sync: sessions, query: { where, order, fields } }),
// imperative
const rows = modelQuery(sessions, { where, order, limit });
```

An array property runs `modelQuery()`; any other keeps one row (`query.id`, or a `where`). `query` may be a function of the host; `dependsOn: ["month"]` rebuilds the query when those properties change. The resource behind a property is `this.$queries.<key>` (`pending`, `error`, `total`, `refresh()`), a controller's `$ready` waits for the first load of every model-bound property, and a component with a `query`-backed property gets `dataPending`.

## Hooks

Define lifecycle hooks in schema's `$hooks`. Each receives the store, so a hook reads and writes through the same pipeline as everyone else:

```javascript
{
  $hooks: {
    beforeAdd: (data, { model, store }) => data,
    afterAdd: (row, { model, store }) => {},
    beforeEdit: (patch, { model, store, id }) => patch,
    afterEdit: (row, { model, store, id }) => {},
    beforeRemove: (row, { model, store, id }) => true,
    afterRemove: (row, { model, store, id }) => {},
  }
}
```

`slugHooks("title", "slug")` from `/model/slug` generates unique slugs. `ctx.importing` is true during an import.

## The write pipeline

The store runs every write the same way for every adapter, in this order: `beforeAdd`/`beforeEdit`, the id (the adapter's `nextId` when it has one, else a 15-character id from the configured source, else the adapter's own key for a `T.number()` id), relation stripping (a `many`/`one` value is dropped, a loaded `belongs` row goes back to its id), schema defaults (add only), `validateRow`, file uploads through the registered `setFileStorage` provider, the adapter's `insert`/`update`/`delete`, the `model:changed` event, then `afterAdd`/`afterEdit`/`afterRemove`. `edit` strips `immutable: true` fields from the patch and merges it over the stored row.

## Relationships

| Type | Schema | Loading |
|------|--------|---------|
| `T.belongs("users")` | FK in current table | `get` by ID |
| `T.belongs_many("tags")` | Array of IDs | one query with `id in` |
| `T.many("posts")` | FK in related table | Query by FK |
| `T.one("profile")` | FK in related table | Query by FK, limit 1 |
| `T.belongs(["events","places"])` | Polymorphic | Reads `{field}Type`, one query per target type |

The foreign key of a `many`/`one` is `targetForeignKey`, else `${modelName}Id` (`T.many("post")` on `user` reads `post.userId`). `includes` loads one level through the store, so every adapter answers the same shape.

## Adapters

An adapter stores rows; the store runs the pipeline. Register one under a type name:

```javascript
import { registerStorageAdapter } from "@bootstrapp/light/model/adapter";

registerStorageAdapter("custom", {
  async init() {},
  async get(model, id) {},                       // Row | null
  async query(model, { where, order, limit, offset, fields }) {},  // { rows, total }
  async insert(model, row) {},                   // the stored row
  async update(model, row) {},                   // the stored row (the full merged row comes in)
  async delete(model, id) {},
  async count(model, where) {},
  async close() {},
});
```

`createAdapter(type, config)` makes an instance with `config` as its own fields. Optional methods: `insertMany(model, rows)`, `nextId(model, row)`, `exists(model, where)`, `facets(model, fields, opts)`, `truncate(model)`, `supportsOperator(op)`, `invalidate(model)` (drop what the adapter caches for a model, so the next read fetches again), `subscribe(model, cb)` (a remote adapter with push feeds `model:changed` through it). A local adapter matches and pages with `buildQueryResult`; a remote one translates `where` itself.

Every write hands the adapter a third argument, the write options: `insert(model, row, opts)`, `insertMany(model, rows, opts)`, `update(model, merged, opts)`, `delete(model, id, opts)`. `opts.importing` marks an import, `opts.direct` a caller that asked to bypass whatever a decorator would do (`users.add(row, { direct: true })`, `edit(id, patch, { direct: true })`, `remove(id, { direct: true })`), and on `update`, `opts.patch` is the normalised patch beside the merged row. A plain adapter ignores them.

The IndexedDB adapter keeps one object store per model, an index per `index: true` or `unique: true` field (a `multiEntry` index for an array field, so `{ has: value }` is a lookup), booleans as 0/1 and dates as epoch milliseconds so the indexes can hold them. `query` reads one index when the `where` names an indexed field (`planIndex`) and matches the rest in memory; opening a database whose stores are missing reopens it one version up and creates them.

The JSON Lines adapter keeps a file per model, `<dir>/<model>.jsonl`, written as a log: every insert and update appends the row as one line, a later line for an id replaces an earlier one, and a removal appends `{"id":…,"$removed":true}`. A model's file is read into memory the first time the model is reached, so reads, filters and counts answer from memory through `buildQueryResult`, and a line an interrupted append cut short is skipped (the file is then rewritten whole). Once the lines a file no longer needs outnumber its rows (past 32), the file is rewritten with its rows alone. It reaches its files only through the `io` its host hands it, so it runs wherever the host can read, append and replace a file; one process owns a directory. An insert refuses a row without an id or with an id already stored.

```javascript
import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createAdapter, registerStorageAdapter } from "@bootstrapp/light/model/adapter";
import JsonlAdapter from "@bootstrapp/light/model/jsonl";

registerStorageAdapter("jsonl", JsonlAdapter);
const io = {
  read: (path) => (existsSync(path) ? readFileSync(path, "utf8") : null),
  append: (path, text) => appendFileSync(path, text),
  write: (path, text) => { writeFileSync(`${path}.tmp`, text); renameSync(`${path}.tmp`, path); },
};
const db = createAdapter("jsonl", { name: "tasks", dir: "data", io });
await db.init();
```

`examples/tasks/` is a terminal app over it.

### Decorators and the shadow

A package may wrap the adapter of every model whose schema declares a directive of its own:

```javascript
import { registerAdapterDecorator } from "@bootstrapp/light/model/adapter";

registerAdapterDecorator("$moderated", (base, { model, schema, store, shadow, emit }) => ({
  init: () => base.init(),
  get: (model, id, opts) => base.get(model, id, opts),
  insert: async (model, row, opts) => (opts?.direct ? base.insert(model, row, opts) : ...),
  ...
}));
```

The store calls the factory once per such model with the routed adapter and answers the wrapper from `adapterFor(model)` from then on (`baseAdapterFor(model)` is the routed adapter alone; `exportData` reads through it). A decorator delegates method by method and defines an optional method only when the base has it: adapters keep their state as own properties on `this`, so a prototype chain over the base would split it. `store.addModels` adds the names the store does not hold yet (a registered name keeps its schema), and it and `addDatabase` rebuild the wrappers.

`$shadow: "indexeddb"` on a schema gives the model a second, device-local store under its own name and indexes in that adapter, beside the models that live there. The store never routes to a shadow: `shadowFor(model)` hands it to a decorator, which decides what lives there (pending rows an author alone sees, a draft, an offline copy).

### Routing

The store routes each model to its `$adapter` (or the database named `ext:<id>` for a model with `$extension: id`), falling back to the default. `$heavy` lists the fields an adapter leaves out of a list read; a `get` by `where` reads such a row again by its id, whole.
