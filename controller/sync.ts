/**
 * @bootstrapp/light/controller: sync
 * The adapter registry, the sync-type system, the binder registry and the
 * binding itself. Sync is store-level: a binding is a pair of subscriptions
 * between a store key and an adapter key; nothing patches instances. A target
 * some binder claims (a host's data source) is bound by that binder instead.
 * A binding whose `scope` names a sibling property rebinds whenever that
 * property names a different key, so a controller handed a new scope while it
 * lives (the thread a cache belongs to, the workspace a setting is scoped by)
 * follows it instead of keeping the key it was built with.
 */

import { cloneDefault } from "../types/index.js";
import { adapterFor } from "./adapters/store-adapter.ts";

import type { Adapter, SyncInfo, SyncCheck, SyncHandler, SyncStore, SyncBinder, SyncHost, SyncProp, Binding, StoreShaped, StoreSync } from "./types.ts";

const syncTypes: Array<{ check: SyncCheck, handler: SyncHandler }> = [];

const binders: SyncBinder[] = [];

const adapters: Record<string, Adapter> = Object.create(null);
const pendingBinds: Map<string, Array<() => void>> = new Map();

const isAdapter = (target: unknown): target is Adapter => {
  const t = target as Record<string, unknown> | null | undefined;
  return typeof t?.on === "function" && typeof t?.off === "function" &&
    typeof t?.get === "function" && typeof t?.set === "function";
};

/** The adapter registered as `name`, or null. */
export const getAdapter = (name: string): Adapter | null => adapters[name] ?? null;

/**
 * Register a named sync target. Anything not adapter-shaped (a controller
 * instance, a bare store) is wrapped, so its store becomes the backing.
 * Bindings queued against the name run the moment it registers.
 */
export const registerAdapter = (name: string, target: unknown) => {
  adapters[name] = isAdapter(target) ? target : adapterFor(name, target as StoreShaped);
  const queued = pendingBinds.get(name);
  pendingBinds.delete(name);
  if (queued) for (const bind of queued) bind();
};

/**
 * Forget a named sync target. Bindings already made keep the adapter they
 * bound; a later binding by the name waits for a new registration.
 */
export const unregisterAdapter = (name: string) => {
  delete adapters[name];
};

/** Names bindings are still waiting on; after boot, these are typos. */
export const pendingAdapterNames = () => [...pendingBinds.keys()];

const lazyAdapters: Record<string, () => void> = Object.create(null);

/**
 * Register a deferred provider for a named sync target: the first binding
 * that asks for `name` invokes `create` (whose registerAdapter flushes the
 * queued binds). Lets auto-registered controllers stay uninstantiated until
 * something actually binds to them.
 */
export const registerLazyAdapter = (name: string, create: () => void) => {
  if (adapters[name]) return;
  if (pendingBinds.has(name)) {
    create();
    return;
  }
  lazyAdapters[name] = create;
};

const triggerLazyAdapter = (name: string) => {
  const create = lazyAdapters[name];
  if (!create) return;
  delete lazyAdapters[name];
  create();
};

/**
 * Teach the binding a kind of target by its shape: `check(target)` answers
 * whether a target is one, `handler(target)` the name and the `$sync` object
 * to follow.
 */
export const registerSyncType = (check: SyncCheck, handler: SyncHandler) => {
  const known = syncTypes.find((entry) => entry.check === check);
  if (known) known.handler = handler;
  else syncTypes.push({ check, handler });
};

/**
 * The name and `$sync` object a target binds through, or null when nothing
 * knows the target.
 */
export const getSyncInfo = (adapter: unknown): SyncInfo | null => {
  if (typeof adapter === "string") return { adapter, syncObj: null };

  for (const { check, handler } of syncTypes)
    if (check(adapter))
      return handler(adapter);

  const $sync = (adapter as { $sync?: StoreSync } | null)?.$sync;
  if ($sync)
    return { adapter: $sync.adapter, syncObj: $sync };

  return null;
};

/**
 * The adapter key of a sync binding: `prop.key`, or the property name;
 * prefixed with the value of the `scope` property when one is named
 * (`"a.b"` reads one level into an object property). A scope whose value
 * is empty answers null, and the binding is skipped.
 */
export const getScopedKey = (base: string, prop: SyncProp, inst: SyncHost): string | null => {
  const key = prop.key ?? base;
  const { scope } = prop;
  if (!scope) return key;
  const [obj, field] = scope.split(".");
  const value = field
    ? (inst[obj] as Record<string, unknown> | undefined)?.[field]
    : inst[obj];
  return value ? `${value}:${key}` : null;
};

/**
 * Bind one store key to its declared sync target. Two subscriptions and an
 * initial read. The named side owns: its value wins at bind, the store's
 * seeded default only fills a hole. Loops die on the store's `===` dedupe.
 * Returns an unbind. A named adapter that is not registered yet queues the
 * bind; the property behaves as a plain store prop until the name arrives.
 * `host` is read for scope resolution only.
 */
export const bindStoreSync = ({ store, key, prop, host = null }: { store: SyncStore, key: string, prop: SyncProp, host?: SyncHost | null }): (() => void) => {
  const info = getSyncInfo(prop.sync);
  if (!info) return () => {};

  const scopeRoot = typeof prop.scope === "string" ? prop.scope.split(".")[0] : null;
  const scoped = host ?? {};

  let bound = false;

  const seed = () => (bound ? cloneDefault(prop) : store.get(key));

  const attach = (adapter: Adapter) => {
    const sKey = getScopedKey(key, prop, scoped);
    if (sKey === null) return () => {};

    const inbound = (v: unknown) => store.set(key, v);
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

  const follow = (adapter: Adapter) => {
    let off = attach(adapter);
    bound = true;
    if (!scopeRoot) return off;
    let current = getScopedKey(key, prop, scoped);
    const offScope = store.subscribe(scopeRoot, () => {
      const next = getScopedKey(key, prop, scoped);
      if (next === current) return;
      current = next;
      off();
      off = attach(adapter);
    });
    return () => {
      offScope();
      off();
    };
  };

  if (info.syncObj) return follow(adapterFor(info.adapter, info.syncObj));

  const name = info.adapter;
  const existing = getAdapter(name);
  if (existing) return follow(existing);

  let unbind: (() => void) | null = null;
  const late = () => {
    unbind = follow(getAdapter(name) as Adapter);
  };
  let queue = pendingBinds.get(name);
  if (!queue) {
    queue = [];
    pendingBinds.set(name, queue);
  }
  queue.push(late);
  triggerLazyAdapter(name);
  return () => {
    const waiting = pendingBinds.get(name);
    const at = waiting ? waiting.indexOf(late) : -1;
    if (waiting && at !== -1) waiting.splice(at, 1);
    unbind?.();
  };
};

/**
 * A target as declared, opened: a thunk is called, so a module evaluated
 * before its target exists declares `() => target` and the target is read when
 * the property binds.
 */
export const resolveSync = (sync: unknown): unknown => (typeof sync === "function" ? sync() : sync);

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
 */
export const registerSyncBinder = (binder: SyncBinder) => {
  if (!binders.includes(binder)) binders.push(binder);
};

/** The binder that claims an opened target, or null. */
export const binderFor = (target: unknown): SyncBinder | null => binders.find((binder) => binder.test(target)) ?? null;

/**
 * Whether a declared target may carry `option`: a thunk is opened only at
 * bind time, so it may; anything else needs a binder that claims it and reads
 * that option.
 */
export const acceptsOption = (sync: unknown, option: string): boolean =>
  typeof sync === "function" || Boolean(binderFor(sync)?.options?.includes(option));

/**
 * Bind one property to its declared target: the first binder that claims the
 * opened target binds it, anything else goes through `bindStoreSync`. `prop`
 * is the property's descriptor, its sync options folded in.
 */
export const bindProperty = ({ store, key, prop, host }: { store: SyncStore, key: string, prop: Record<string, unknown>, host: SyncHost }): Binding => {
  const target = resolveSync(prop.sync);
  const binder = binderFor(target);
  if (binder) return binder.bind({ store, key, prop: prop as SyncProp, host, target });
  const opened: Record<string, unknown> = target === prop.sync ? prop : { ...prop, sync: target };
  return { unbind: bindStoreSync({ store, key, prop: opened as SyncProp, host }) };
};
