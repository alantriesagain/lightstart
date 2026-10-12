export type { Dep, Reactive } from "./index.js";

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
  subscribe(key: string, callback: (value: unknown) => void): () => void;
}

/**
 * The canonical declared store. Every declared key is also a reactive
 * accessor on the store itself (`store.foo = x` notifies): the index
 * signature captures that flattened access.
 */
export interface Store<S = Record<string, unknown>> {
  keys(): string[];
  get<K extends keyof S & string>(key: K): S[K];
  get(key: string): unknown;
  set<K extends keyof S & string>(key: K, value: S[K]): unknown;
  set(key: string, value: unknown): unknown;
  update<K extends keyof S & string>(key: K, fn: (current: S[K]) => S[K]): unknown;
  update(key: string, fn: (current: unknown) => unknown): unknown;
  reset(key: string): unknown;
  resetAll(): void;
  subscribe<K extends keyof S & string>(key: K, callback: (value: S[K], oldValue?: S[K]) => void): () => void;
  subscribe(key: string, callback: (value: unknown, oldValue?: unknown) => void): () => void;
  observe(callback: (key: string, value: unknown, oldValue: unknown) => void): () => void;
  snapshot(): Record<string, unknown>;
  restore(snap?: Record<string, unknown>): void;
  $sync: StoreSync;
  [key: string]: unknown;
}

export * from "./index.js";
