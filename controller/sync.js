/**
 * @bootstrapp/light/controller: sync
 * The adapter registry, the sync-type system, the binder registry and the
 * binding itself. Sync is store-level: a binding is a pair of subscriptions
 * between a store key and an adapter key; nothing patches instances. A target
 * some binder claims (a host's data source) is bound by that binder instead.
 */

import { cloneDefault } from "../types/index.js";
import { adapterFor } from "./adapters/store-adapter.js";

/** @import { Adapter, SyncObj, SyncInfo, SyncCheck, SyncHandler, Store, SyncBinder, SyncProp, Binding } from "./types.ts" */

/** @type {Map<SyncCheck, SyncHandler>} */
const syncTypes = new Map();

/** @type {SyncBinder[]} */
const binders = [];

/** @type {Record<string, Adapter>} */
const adapters = Object.create(null);
/** @type {Map<string, Set<() => void>>} */
const pendingBinds = new Map();

/** @param {unknown} target */
const isAdapter = (target) => {
  const t = /** @type {Record<string, unknown>} */ (target);
  return typeof t?.on === "function" && typeof t?.off === "function" &&
    typeof t?.get === "function" && typeof t?.set === "function";
};

/** @param {string} name */
export const getAdapter = (name) => adapters[name] ?? null;

/**
 * Register a named sync target. Anything not adapter-shaped (a controller
 * instance, a bare store) is wrapped, so its store becomes the backing.
 * Bindings queued against the name run the moment it registers.
 *
 * @param {string} name
 * @param {unknown} target
 */
export const registerAdapter = (name, target) => {
  adapters[name] = isAdapter(target)
    ? /** @type {Adapter} */ (target)
    : adapterFor(name, /** @type {any} */ (target));
  const queued = pendingBinds.get(name);
  pendingBinds.delete(name);
  if (queued) for (const bind of queued) bind();
};

/**
 * Forget a named sync target. Bindings already made keep the adapter they
 * bound; a later binding by the name waits for a new registration.
 * @param {string} name
 */
export const unregisterAdapter = (name) => {
  delete adapters[name];
};

/** Names bindings are still waiting on; after boot, these are typos. */
export const pendingAdapterNames = () => [...pendingBinds.keys()];

/** @type {Map<string, () => void>} */
const lazyAdapters = new Map();

/**
 * Register a deferred provider for a named sync target: the first binding
 * that asks for `name` invokes `create` (whose registerAdapter flushes the
 * queued binds). Lets auto-registered controllers stay uninstantiated until
 * something actually binds to them.
 *
 * @param {string} name
 * @param {() => void} create
 */
export const registerLazyAdapter = (name, create) => {
  if (adapters[name]) return;
  if (pendingBinds.has(name)) {
    create();
    return;
  }
  lazyAdapters.set(name, create);
};

/** @param {string} name */
const triggerLazyAdapter = (name) => {
  const create = lazyAdapters.get(name);
  if (!create) return;
  lazyAdapters.delete(name);
  create();
};

/**
 * Teach the binding a kind of target by its shape: `check(target)` answers
 * whether a target is one, `handler(target)` the name and the `$sync` object
 * to follow.
 * @param {SyncCheck} check
 * @param {SyncHandler} handler
 */
export function registerSyncType(check, handler) {
  syncTypes.set(check, handler);
}

/**
 * The name and `$sync` object a target binds through, or null when nothing
 * knows the target.
 * @param {unknown} adapter
 * @returns {SyncInfo | null}
 */
export function getSyncInfo(adapter) {
  if (typeof adapter === "string") return { adapter, syncObj: null };

  for (const [check, handler] of syncTypes)
    if (check(adapter))
      return handler(adapter);

  const $sync = /** @type {{ $sync?: { adapter: string } & SyncObj } | null} */ (adapter)?.$sync;
  if ($sync)
    return { adapter: $sync.adapter, syncObj: $sync };

  return null;
}

/**
 * The adapter key of a sync binding: `prop.key`, or the property name;
 * prefixed with the value of the `scope` property when one is named
 * (`"a.b"` reads one level into an object property). A scope whose value
 * is empty answers null, and the binding is skipped.
 * @param {string} base
 * @param {SyncProp} prop
 * @param {Record<string, unknown>} inst
 * @returns {string | null}
 */
export function getScopedKey(base, prop, inst) {
  const key = prop.key ?? base;
  const { scope } = prop;
  if (!scope) return key;
  const [obj, field] = scope.split(".");
  const value = field
    ? /** @type {Record<string, unknown> | undefined} */ (inst[obj])?.[field]
    : inst[obj];
  return value ? `${value}:${key}` : null;
}

/**
 * Bind one store key to its declared sync target. Two subscriptions and an
 * initial read. The named side owns: its value wins at bind, the store's
 * seeded default only fills a hole. Loops die on the store's `===` dedupe.
 * Returns an unbind. A named adapter that is not registered yet queues the
 * bind; the property behaves as a plain store prop until the name arrives.
 *
 * @param {object} args
 * @param {Store} args.store
 * @param {string} args.key
 * @param {SyncProp} args.prop
 * @param {Record<string, unknown> | null} [args.host] scope resolution only
 * @returns {() => void}
 */
export function bindStoreSync({ store, key, prop, host = null }) {
  const info = getSyncInfo(prop.sync);
  if (!info) return () => {};

  const scopeRoot = typeof prop.scope === "string" ? prop.scope.split(".")[0] : null;

  const attach = (/** @type {Adapter} */ adapter) => {
    const sKey = getScopedKey(key, prop, /** @type {Record<string, unknown>} */ (host ?? {}));
    if (sKey === null) return () => {};

    const inbound = (/** @type {unknown} */ v) => store.set(key, v);
    adapter.on(sKey, inbound);
    store.set(key, adapter.get(sKey) ?? seed());
    const offOut = store.subscribe(key, (v) => {
      if (v !== adapter.get(sKey)) adapter.set(sKey, v);
    });
    return () => {
      adapter.off(sKey, inbound);
      offOut();
    };
  };

  const seed = () => (bound ? cloneDefault(prop) : store.get(key));

  let bound = false;

  /**
   * Bind, and rebind whenever the scope names a different key.
   *
   * `scope` reads a sibling property, and a controller can be handed a new
   * one while it lives: the thread a cache belongs to, the workspace a
   * setting is scoped by. Reading the key once at construction would pin the
   * property to whatever the scope held then, or skip the bind entirely when
   * it held nothing.
   *
   * @param {Adapter} adapter
   */
  function follow(adapter) {
    let off = attach(adapter);
    bound = true;
    if (!scopeRoot) return off;
    let current = getScopedKey(key, prop, /** @type {Record<string, unknown>} */ (host ?? {}));
    const offScope = store.subscribe(scopeRoot, () => {
      const next = getScopedKey(key, prop, /** @type {Record<string, unknown>} */ (host ?? {}));
      if (next === current) return;
      current = next;
      off();
      off = attach(adapter);
    });
    return () => {
      offScope();
      off();
    };
  }

  if (info.syncObj) return follow(adapterFor(info.adapter, /** @type {any} */ (info.syncObj)));

  const name = info.adapter;
  const existing = getAdapter(name);
  if (existing) return follow(existing);

  /** @type {(() => void) | null} */
  let unbind = null;
  const late = () => {
    unbind = follow(/** @type {Adapter} */ (getAdapter(name)));
  };
  if (!pendingBinds.has(name)) pendingBinds.set(name, new Set());
  /** @type {Set<() => void>} */ (pendingBinds.get(name)).add(late);
  triggerLazyAdapter(name);
  return () => {
    pendingBinds.get(name)?.delete(late);
    unbind?.();
  };
}

/**
 * A target as declared, opened: a thunk is called, so a module evaluated
 * before its target exists declares `() => target` and the target is read when
 * the property binds.
 * @param {unknown} sync
 * @returns {unknown}
 */
export const resolveSync = (sync) => (typeof sync === "function" ? sync() : sync);

/**
 * Teach the binding a data source it cannot follow as an adapter, a store or a
 * signal (a host's model, a query service): `test(target)` claims a target,
 * `bind(...)` keeps the property current and answers its unbind and, when the
 * first value arrives later, a `loaded` promise. `options` lists the long-form
 * options it reads beyond `to`, `key` and `scope` (`query`, `dependsOn`); a
 * property declaring one of those needs a target a binder that reads it claims,
 * or a thunk. A binder that reads `query` keeps the host's `dataPending` true
 * while a load is in flight, when the host declares one. Registering the same
 * binder again changes nothing.
 * @param {SyncBinder} binder
 */
export const registerSyncBinder = (binder) => {
  if (!binders.includes(binder)) binders.push(binder);
};

/**
 * The binder that claims an opened target, or null.
 * @param {unknown} target
 * @returns {SyncBinder | null}
 */
export const binderFor = (target) => binders.find((binder) => binder.test(target)) ?? null;

/**
 * Whether a declared target may carry `option`: a thunk is opened only at
 * bind time, so it may; anything else needs a binder that claims it and reads
 * that option.
 * @param {unknown} sync
 * @param {string} option
 */
export const acceptsOption = (sync, option) =>
  typeof sync === "function" || Boolean(binderFor(sync)?.options?.includes(option));

/**
 * Bind one property to its declared target: the first binder that claims the
 * opened target binds it, anything else goes through `bindStoreSync`.
 * @param {{ store: Store, key: string, prop: SyncProp, host: Record<string, any> }} args
 * @returns {Binding}
 */
export const bindProperty = ({ store, key, prop, host }) => {
  const target = resolveSync(prop.sync);
  const binder = binderFor(target);
  if (binder) return binder.bind({ store, key, prop, host, target });
  return { unbind: bindStoreSync({ store, key, prop: target === prop.sync ? prop : { ...prop, sync: target }, host }) };
};
