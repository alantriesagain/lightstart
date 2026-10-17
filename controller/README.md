# @bootstrapp/light/controller

A controller is a named piece of app state and the methods that change it. It is state shared at runtime by every component that uses it; code shared at definition time is a mixin. There is one per name, made the first time anything reaches it: components and other controllers read it, bind to it by name, or call it. `connected()` runs once when it is made, and `dispose()` resets it, so the next reach makes a fresh one. A controller is never scoped: one per document or per conversation is a keyed collection inside one controller, or a `keyedResource`.

## Entries

Each piece is its own entry, and an entry loads only its own code. Nothing else in light imports any of them (`controller/imports.test.js` holds both).

| Entry | Holds |
|---|---|
| `@bootstrapp/light/controller` | `defineController`, `defineMixin`, `nameControllers`, `registerAdapter`, `registerSyncType`, `registerSyncBinder`, `getAdapter`, `pendingAdapterNames`, `configureControllers` |
| `@bootstrapp/light/controller/resource` | `resource`, `keyedResource` |
| `@bootstrapp/light/controller/storage` | `localStorage`, `sessionStorage`, `memoryStorage`, `createStorageAdapter` |
| `@bootstrapp/light/controller/document` | `createDocumentAdapter` |
| `@bootstrapp/light/controller/url` | `hash` |
| `@bootstrapp/light/controller/view` | `syncPlugin` |

## Defining

```js
import { defineController } from "@bootstrapp/light/controller";

/** @import { Summary } from "./types.ts" */

export const ledger = defineController({
  name: "ledger",
  props: {
    month: /** @type {string} */ (currentMonth()),
    summary: /** @type {Summary | null} */ (null),
    pending: true,
  },
  sync: { month: "local" },
  _timer: /** @type {ReturnType<typeof setTimeout> | null} */ (null),
  async connected() {
    await this.refresh();
  },
  async refresh() {},
});
```

`defineController(def)` returns the controller: a handle that builds the instance on the first read, write or call of a key it carries, then forwards to it. It carries every declared prop and member (the definition's and its mixins') and the instance's `$` members; it is frozen, so a key the definition does not declare is not on it and writing one throws, which is why a field a method assigns must be declared (`controller-declare-instance-surface`). The handle keeps three keys of its own: `definition` (the composed definition), `has()` (whether an instance is built, without building one) and `dispose()`. An `in` check answers without building, and a declared key is on the handle before the first reach.

**`props` is the reactive state.** Each entry is a default in light's shorthand: `count: 0` is a number, `label: ""` a string, `items: []` an array, `summary: null` anything. A JSDoc cast says what the literal cannot: `/** @type {Summary | null} */ (null)`, `/** @type {"day" | "week"} */ ("day")`. The props live in a `createStore` (per-key `subscribe`, `===` dedupe, `snapshot()` and `restore()`), reached as `$state`. A `T` descriptor works for a prop too, as long as it carries no sync option.

**The `sync` block binds props.** `sync: { prop: target }` names what a prop follows: an adapter or controller name (`"local"`, `"ledger"`), a store, a signal, a controller, a target a sync binder claims, or a thunk answering one. The long form `{ to, key?, scope?, query?, dependsOn? }` says more. `key` is the adapter key (the prop name by default, so every binding declaring that name shares the value); `scope: "<prop>"` (or `"a.b"`) prefixes it with that prop's value as `${value}:${key}`, follows the prop when it changes, and skips the bind while it is empty. `query` and `dependsOn` are for a target a binder reads them for, or a thunk. A binding is two-way, made when the instance is built, and the named side's value wins. An entry that names no prop, names a member or carries an unknown option throws at define time; `SyncBlock` types the block against the props, so a misnamed entry is a type error.

**A plain field is a member.** What the controller holds and no component re-renders on (a resource, a timer id, a `Map` cache) is a definition key beside the methods: `_timer: /** @type {ReturnType<typeof setTimeout> | null} */ (null)`, `_cache: /** @type {Map<string, Row>} */ (new Map())`. An array, plain object, `Map` or `Set` is copied per instance, so the instance built after `dispose()` starts empty; anything else is assigned as is. A member that has to be built per instance (a `WeakMap`, a value read from the page) is declared with a cast and assigned in `connected()`. A field typed non-null that starts `null` casts through `unknown`: `/** @type {Host} */ (/** @type {unknown} */ (null))`.

`defineController` refuses `adapter:`, a `reactive: false` prop and a sync option inside a descriptor, each with the form that replaced it, and a name declared as both a prop and a member.

**`connected()` may be async.** `$ready` settles with it and with the first load of every bound prop (at once when there is nothing to wait for), and is counted with the host's `track` as `controller:<name>`; a throw rejects it. A reach of the controller from inside its own `connected()` finds the instance being connected, and a `connected()` that throws synchronously leaves nothing built, so the next reach tries again.

**Framework members are `$`-prefixed.** Every instance carries `$name`, `$state`, `$sync`, `$queries`, `$own`, `$attach`, `$ready` and `$dispose`. A definition may not declare a `$`-prefixed name, nor `definition`, `has`, `dispose`, `get` or `create` (the handle's keys, and two names the handle refuses); the `connected()`/`disconnected()` hooks stay in the definition and never sit on the instance.

**Teardowns go through `this.$own(teardown)`.** Pass any unsubscribe function, a `dispose`, a `clearInterval` closure, or an array of them; `$own` returns its argument, so it wraps a call inline. `dispose()` runs `disconnected()` and then drains the owned teardowns; an async hook keeps its subscriptions until it settles, and `dispose()` returns its promise. The retiring instance stays reachable until that promise settles, so code that reaches the controller during its own teardown finds the one it is leaving. `$ready` read meanwhile waits for the teardown and then for the instance built after it.

## Mixins

A controller composed from fragments lists them under `mixins: [...]`; each fragment is a `defineMixin({ props, sync, connected, ...members })`, or a function returning one when it takes options. Fragments fold in first, in order, then the definition's own keys: props, sync entries and members union, the definition wins a collision, lifecycle hooks chain mixin-first. `ctrl.definition` is the composed definition, so a variant (a test's, with a fake member) is `defineController({ name, mixins: [ctrl.definition], fetchImpl: () => fake })`.

## Names

`nameControllers([...])` makes each controller a sync target by its name: `sync: "<name>"` binds to it and builds it on the first binding, and after `dispose()` a later binding reaches the next instance. A name an adapter holds is refused, since `sync: "<name>"` could then mean either.

Adapters are named by the page: `registerAdapter("local", localStorage)`. Importing an adapter registers nothing and starts nothing, so a page names the ones it uses. A binding to a name nobody registered waits for it; `pendingAdapterNames()` lists the names still waited on, which after boot are typos.

## Adapters

- **Storage** (`/controller/storage`): `localStorage` and `sessionStorage` over the browser's stores (resolved on use, so they import anywhere), `memoryStorage`, and `createStorageAdapter(storage, name)` for another. Strings are stored raw, everything else as JSON.
- **Document** (`/controller/document`): `createDocumentAdapter(name)` keeps props in one JSON document. `await adapter.attach({ read, write, flush })` takes a backing once the document's home is known: `read()` resolves the stored object, `write(doc)` receives the whole document on every change, `flush()` (optional) settles pending writes. Attaching announces every stored key, so bound stores take the persisted value; `detach()` flushes and stops writing.
- **Hash** (`/controller/url`): `hash` reads and writes `#key=value`. It listens to `popstate` from its first subscriber.

## Binders

`registerSyncBinder({ test, bind, options })` teaches the binding a data source it cannot follow as an adapter, a store or a signal (a model, a query service). `test(target)` claims an opened target; `bind({ store, key, prop, host, target })` keeps the prop current and answers `{ unbind, loaded? }`, where `loaded` settles with the first value and is part of `$ready`; `options` lists the long-form options it reads (`query`, `dependsOn`). A binder that reads `query` keeps the host's `dataPending` true while a load is in flight. `registerSyncType(check, handler)` is the lighter seam for a target that is a store under another shape. A host that adds a binder types its targets by merging into `SyncTargets`:

```ts
declare module "@bootstrapp/light/controller" {
  interface SyncTargets { model: ModelApi }
}
```

## Components

`View.use(syncPlugin)` (from `/controller/view`) binds a component prop declared `T.*({ sync })` the same way a controller's is, when the element connects; the unbind rides the element's teardowns. A synced prop is never set from or reflected to an attribute, and a component with a `query`-backed prop gets `dataPending`.

## `resource()`

`resource(fetcher, { name, eager?, ready?, events?, invalidateOn?, filter?, dependsOn? })` (from `/controller/resource`) is the async primitive for a value something fetches. It returns `{ value, pending, error }` signals plus:

- `ensure()`: fetch once if never loaded.
- `refresh()`: stale-while-revalidate refetch.
- `invalidate()`: mark stale.
- `mutate(updater)`: local write; must return a new reference.
- `own(teardown)`: a teardown `dispose()` runs, for what was subscribed on the resource's behalf.
- `peek()`, `subscribe(cb)`, `dispose()`.

`invalidateOn` takes one event or a list on the host's bus (or `events`), heard from the first fetch on; `filter(payload, eventKey)` decides per event. `dependsOn` lists resources whose change refetches this one; a change that lands while the first load is in flight refetches once it lands. `ready` is what the first fetch waits for (the host's `ready` by default, `false` for nothing). `keyedResource(fetcherForKey)` memoizes one resource per key; `invalidate(key)` drops the entry.

## The host

`configureControllers({ track, ready, events })` hands the controllers what their host knows: `track(label)` is called when async work starts (a controller connecting, a resource fetching) and answers what ends it; `ready()` answers what a resource waits for before its first fetch; `events` is the bus `invalidateOn` listens on. A page with no host keeps the defaults: nothing tracked, no gate, no bus.

## Checking

`light check` reads every `defineController(...)` call in a project, wherever it stands and several per file, and holds it to the conventions above: an instance field is declared as a prop or a member (`light/controller-declare-instance-surface`), the hooks are `connected` and `disconnected` (`light/controller-known-lifecycle-hooks`), `connected()` and `disconnected()` return or await the work they start or hand it to `trackWork` (`light/controller-lifecycle-returns-async`), a prop with a non-null default is read without `?.` (`light/controller-no-defensive-declared-props`), a binding or a `$state.subscribe` aimed at a controller names a prop it declares (`light/controller-state-key-declared`), and a `sync: "<name>"` names an adapter or a controller that registers it (`light/unresolved-sync-target`). That last rule checks an app: a package with `exports` or `main` binds names the app that loads it registers. A host of the checker adds the adapter names it registers itself (`syncAdapters`) and the files of its dependencies' controllers (`controllerFiles`), so a name either one holds resolves.
