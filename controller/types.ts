/**
 * @bootstrapp/light/controller: type declarations.
 */

import type { TypeDefinition, PropertyDeclaration } from "../types/types.ts";
import type { Signal } from "../signals/index.js";
import type { StoreSync, Store } from "../signals/types.ts";
import type { DefinitionFragment } from "../view/primitives.ts";
import type { PropertyDeclarations, PropsToThis } from "../view/types.ts";

export type { StateDef, StoreSync, Store } from "../signals/types.ts";
export type { DefinitionFragment, UnionToIntersection, MixinProps, MixinEvents, MixinMembers } from "../view/primitives.ts";
export type { PropsToThis } from "../view/types.ts";

/**
 * A controller definition: a component definition minus `render`. Same
 * vocabulary as views (`props` as shorthand defaults or descriptors,
 * `connected`/`disconnected`) plus a `sync` block and object-literal members.
 */
export type ControllerDefinition = {
  name: string;
  props?: PropertyDeclarations;
  /** What each property binds to; see `SyncBlock`. */
  sync?: Record<string, SyncTarget | SyncEntry>;
  /** Definition fragments folded in before the definition's own keys; see `defineMixin`. */
  mixins?: readonly DefinitionFragment[];
  connected?: () => void | Promise<void>;
  disconnected?: () => void | Promise<void>;
} & Record<string, unknown> & ThisType<Record<string, any>>;

/**
 * The members every instance carries. All of them start with `$`, so every
 * other name is free for a declared property or member; the definition's
 * `connected`/`disconnected` hooks stay in the definition and never sit on the
 * instance.
 */
export interface ControllerInstance {
  $name: string;
  /** The store behind the declared properties; `subscribe("key", cb)` hands the callback that property's own type. */
  $state: Store<this>;
  $sync: StoreSync;
  /** The live resource a sync binder keeps behind a property (a model query): `pending`, `error`, `total`, `refresh()`. */
  $queries: Record<string, Resource<any> & { total?: number }>;
  /** Re-render `host` on every store change; returns the detach function. */
  $attach(host: { $requestUpdate(): unknown }): () => void;
  /** Hold a teardown (or an array of them) until the instance is retired; returns its argument so it wraps inline. */
  $own<T extends (() => void) | Array<(() => void) | null | undefined | false>>(teardown: T): T;
  /** Settles with `connected()` and the first load of every bound property, counted with the host's `track` as `controller:<name>`; rejects if the hook threw. */
  $ready: Promise<void>;
  /** Run `disconnected()`, then every owned teardown; an async hook is awaited first and its promise returned. The handle's `dispose()` calls it. */
  $dispose(): void | Promise<void>;
  /** An undeclared field reads as `unknown`. */
  [key: string]: unknown;
}

/** The definition keys `defineController` keeps to itself; everything else lands on the instance. */
export type ControllerDefinitionKey = "name" | "props" | "sync" | "mixins" | "connected" | "disconnected";

/**
 * Targets a host teaches the binding (through `registerSyncBinder`), added by
 * declaration merging: `declare module "@bootstrapp/light/controller" { interface SyncTargets { model: ModelApi } }`.
 */
export interface SyncTargets {}

/**
 * What a property binds to: an adapter or controller name (`"local"`,
 * `"ledger"`), anything carrying a `$sync` (a store, a signal, a controller),
 * a target a host taught the binding, or a thunk answering one when the
 * property binds.
 */
export type SyncTarget = string | { readonly $sync: unknown } | SyncTargets[keyof SyncTargets] | (() => unknown);

/** The long form of a sync entry, for a target that needs more than its name. */
export interface SyncEntry {
  to: SyncTarget;
  /** The adapter key; the property name by default, which every binding of that name shares. */
  key?: string;
  /** A sibling property whose value prefixes the key as `${value}:${key}`; an empty value skips the bind. */
  scope?: string;
  /** The query a binder runs, or a function of the host rebuilt when a `dependsOn` property changes. */
  query?: object | ((self: any) => object);
  /** Properties whose change rebuilds the query. */
  dependsOn?: string[];
}

/** A definition's `sync` block: one entry per bound property, keyed by the property's name. */
export type SyncBlock<P> = { [K in keyof P]?: SyncTarget | SyncEntry };

/**
 * A controller, as `defineController` answers it: the instance's props and
 * members, reached through a handle that builds the instance on first reach.
 * `definition`, `has()` and `dispose()` answer from the handle; `$ready` waits
 * for a teardown in progress and then for the instance built after it.
 */
export type ControllerHandle<P = Record<string, PropertyDeclaration>, D = Record<string, unknown>> =
  PropsToThis<P> & Omit<D, ControllerDefinitionKey> & Omit<ControllerSurface, "$dispose"> & {
    readonly definition: ControllerDefinition & { props: P };
    /** Whether an instance is built (or retiring), without building one. */
    has(): boolean;
    /** Retire the instance: `disconnected()`, then its owned teardowns. It stays reachable until an async `disconnected()` settles; the next reach builds a fresh one. */
    dispose(): void | Promise<void>;
  };

/** `ControllerInstance` without its index signature, so `Omit` keeps the named members. */
type ControllerSurface = {
  [K in keyof ControllerInstance as string extends K ? never : K]: ControllerInstance[K];
};

/** A property's descriptor as the binding reads it: the sync options folded in from the block. */
export type SyncProp = TypeDefinition & {
  sync?: unknown;
  key?: string;
  scope?: string;
  query?: unknown;
  dependsOn?: string[];
  pack?: (value: unknown) => unknown;
  unpack?: (packed: unknown) => unknown;
};

/** What binding one property answers: the unbind, and the first value's arrival when it comes later. */
export interface Binding {
  unbind: () => void;
  loaded?: Promise<void>;
}

/** A data source the binding cannot follow as an adapter, a store or a signal; see `registerSyncBinder`. */
export interface SyncBinder {
  /** Whether this binder binds an opened target. */
  test(target: unknown): boolean;
  /** Keep `host`'s property `key` current from `target`. */
  bind(args: { store: Store; key: string; prop: SyncProp; host: Record<string, any>; target: unknown }): Binding;
  /** The long-form options it reads beyond `to`, `key` and `scope`. */
  options?: readonly string[];
}

/** The bus a resource's `invalidateOn` listens on. */
export interface EventBus {
  on(key: string, cb: (payload: unknown) => unknown): () => void;
}

/** What controllers read from their host; see `configureControllers`. */
export interface ControllerConfig {
  /** Called when async work starts; answers what ends it. */
  track: (label: string) => (() => void) | void;
  /** What a resource waits for before its first fetch. */
  ready: () => Promise<unknown> | undefined;
  /** The bus `invalidateOn` listens on. */
  events: EventBus | null;
}

export type ListenerFn = (
  value: unknown,
  opts?: { skipBroadcast?: boolean } & Record<string, unknown>,
) => void;

export interface AdapterCore {
  name: string;
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
  remove(key: string): unknown;
  has(key: string): boolean;
  keys(): string[];
  entries(): Array<[string, unknown]>;
}

export interface Adapter extends AdapterCore {
  on(key: string, callback: ListenerFn): () => void;
  off(key: string, callback: ListenerFn): void;
  emit(key: string, value: unknown, opts?: Record<string, unknown>): void;
  hasListeners(key: string): boolean;
  signal(key: string, defaultValue?: unknown): Signal<unknown>;
  _listeners: Map<string, Set<ListenerFn>>;
  _signals: Map<string, Signal<unknown>>;
}

/** What a document adapter persists to: one JSON object, read once on attach, written whole on every change. */
export interface DocumentBacking {
  read(): Promise<Record<string, unknown> | null | undefined>;
  write(doc: Record<string, unknown>): Promise<void> | void;
  flush?(): Promise<void>;
}

export interface DocumentAdapter extends Adapter {
  attach(backing: DocumentBacking): Promise<void>;
  detach(): Promise<void>;
}

export interface SyncObj {
  adapter?: string;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  subscribe(key: string, callback: (value: unknown) => void): () => void;
}

export interface SyncInfo {
  adapter: string;
  syncObj: SyncObj | null;
}

export type SyncCheck = (adapter: unknown) => boolean;
export type SyncHandler = (adapter: unknown) => SyncInfo;

export interface ResourceOptions {
  name?: string;
  eager?: boolean;
  /** What the first fetch waits for; `false` waits for nothing, absent waits for the host's `ready`. */
  ready?: false | (() => Promise<unknown> | undefined);
  /** The bus `invalidateOn` listens on; absent takes the host's. */
  events?: EventBus | null;
  invalidateOn?: string | string[];
  /** Whether an `invalidateOn` event refreshes the resource; the event key tells the events apart. */
  filter?: (payload: any, eventKey: string) => boolean;
  /**
   * Resources whose change refetches this one. A change that lands while the
   * first load is in flight refetches once that load lands; a dependency's own
   * first value does not count as a change.
   */
  dependsOn?: Resource<any>[];
}

export interface Resource<T> {
  name: string;
  value: Signal<T | undefined>;
  pending: Signal<boolean>;
  error: Signal<unknown>;
  ensure(): Promise<T>;
  refresh(): Promise<T>;
  invalidate(): void;
  mutate(updater: (current: T | undefined) => T): T;
  peek(): T | undefined;
  subscribe(cb: (value: T | undefined) => void): () => void;
  dispose(): void;
}

/** One lazily-created `Resource<T>` per key. `invalidate(key)` drops the entry. */
export interface KeyedResource<T> {
  get(key: string): Resource<T>;
  invalidate(key: string): void;
  invalidateAll(): void;
  keys(): string[];
  dispose(): void;
}

export * from "./index.js";
