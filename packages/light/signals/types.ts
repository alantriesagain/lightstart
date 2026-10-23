export type { Dep, Reactive } from "./index.ts";

/** One declared state field: a default plus optional (de)serialization. */
export interface StateDef {
  default?: unknown;
  pack?: (value: unknown) => unknown;
  unpack?: (packed: unknown) => unknown;
}

export interface StoreSync {
  adapter: string;
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
  subscribe(key: string, callback: (value: unknown, oldValue: unknown) => void): () => void;
}

/**
 * A declared store as its runtime value: the declared keys read and written
 * through `get` and `set`, one signature per member. `createStore` answers
 * it. A store made with `accessors` (the default) also carries each declared
 * key as a reactive accessor; a caller that reads them declares the keys on
 * its own type (`Store & { count: number }`).
 */
export interface StoreCore {
  keys(): string[];
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
  update(key: string, fn: (current: unknown) => unknown): unknown;
  reset(key: string): unknown;
  resetAll(): void;
  subscribe(key: string, callback: (value: unknown, oldValue: unknown) => void): () => void;
  observe(callback: (key: string, value: unknown, oldValue: unknown) => void): () => void;
  snapshot(): Record<string, unknown>;
  restore(snap?: Record<string, unknown>): void;
  $sync: StoreSync;
}

/** A store typed by its declared keys `S`: what a view's or a controller's `$state` reads as. */
export interface Store<S = Record<string, unknown>> extends StoreCore {
  get<K extends keyof S & string>(key: K): S[K];
  get(key: string): unknown;
  set<K extends keyof S & string>(key: K, value: S[K]): unknown;
  set(key: string, value: unknown): unknown;
  update<K extends keyof S & string>(key: K, fn: (current: S[K]) => S[K]): unknown;
  update(key: string, fn: (current: unknown) => unknown): unknown;
  subscribe<K extends keyof S & string>(key: K, callback: (value: S[K], oldValue: S[K]) => void): () => void;
  subscribe(key: string, callback: (value: unknown, oldValue: unknown) => void): () => void;
}

export * from "./index.ts";
