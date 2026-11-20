/**
 * @file An app's stores: each declared store opened by its kind, all of them
 * over one engine store, which routes each model to the store its schema's
 * `$adapter` names (`main` when it names none). A kind is a `StoreKind`: the
 * core's `memory`, a host's (`indexeddb` on the web, `jsonl` on the terminal),
 * or one a project registers. A host runs the kinds it lists and its own
 * default; a store of a kind it cannot run, or a model naming a store the app
 * does not declare, is an error before anything opens. `configureModel` hands
 * every model api the store in this runtime.
 */

import { configureModel } from "@lightstart/light/model";
import { createAdapter, hasAdapter, registerStorageAdapter } from "@lightstart/light/model/adapter";
import { createStore, storeRequest } from "@lightstart/light/model/store";
import type { ModelSchema, StorageAdapter, Store } from "@lightstart/light/model/types.ts";
import type { App } from "./index.ts";
import type { AppManifest } from "./manifest.ts";
import { MemoryAdapter } from "./memory.ts";

/** An adapter a store may be of: its name, and how it opens one store. */
export abstract class StoreKind {
  abstract readonly name: string;

  /** Open store `store` of `app` at `at` ("" when the app named none) over `models`; `main` is the default store. An implementation answers a promise rather than being `async` (scriptc dispatches no async override). */
  abstract open(app: App, store: string, at: string, models: Record<string, ModelSchema>, main: boolean): Promise<StorageAdapter>;
}

const openMemory = async (app: App, store: string, models: Record<string, ModelSchema>, main: boolean): Promise<StorageAdapter> => {
  if (!hasAdapter("memory")) registerStorageAdapter("memory", MemoryAdapter);
  const db = createAdapter("memory", { name: main ? app.name : app.name + ":" + store, models, isDefaultAdapter: main });
  await db.init();
  return db;
};

/** The core's kind: rows held in memory, for tests and for what need not outlast the process. */
export class MemoryKind extends StoreKind {
  readonly name = "memory";

  open(app: App, store: string, _at: string, models: Record<string, ModelSchema>, main: boolean): Promise<StorageAdapter> {
    return openMemory(app, store, models, main);
  }
}

/** What runs a store: the kinds a host has and its default. */
export interface StoreHost {
  readonly name: string;
  readonly kinds: readonly StoreKind[];
  readonly defaultKind: string;
}

const projectKinds: StoreKind[] = [];

/** Make `kind` one every host can run, for a project's own adapter (registered before the app starts). */
export const registerStoreKind = (kind: StoreKind): void => {
  const at = projectKinds.findIndex((k) => k.name === kind.name);
  if (at >= 0) projectKinds[at] = kind;
  else projectKinds.push(kind);
};

/** Every model's schema, by the name its file gives it. */
export const schemasOf = (manifest: AppManifest): Record<string, ModelSchema> => {
  const models: Record<string, ModelSchema> = {};
  for (const entry of manifest.models) {
    const schema = entry.model.schema;
    if (schema !== undefined) models[entry.name] = schema;
  }
  return models;
};

/** The kind named `name` that `host` can run, `memory` always among them; null when it has none. */
export const kindNamed = (host: StoreHost, name: string): StoreKind | null => {
  for (const k of projectKinds) if (k.name === name) return k;
  for (const k of host.kinds) if (k.name === name) return k;
  return name === "memory" ? new MemoryKind() : null;
};

/** The kinds `host` can run, by name, for an error. */
export const kindsOf = (host: StoreHost): string => {
  const names = host.kinds.map((k) => k.name);
  for (const k of projectKinds) if (!names.includes(k.name)) names.push(k.name);
  if (!names.includes("memory")) names.push("memory");
  return names.join(", ");
};

/** One declared store's plan: the store, the kind it opens with (memory in a test), and the name of the kind it asked for. */
export interface PlannedStore {
  store: string;
  kind: StoreKind;
  kindName: string;
  at: string;
  worker: boolean;
}

/** The kind each store opens with: its own, or the host's default; `memoryOnly` makes every one memory (a test). */
export const plan = (manifest: AppManifest, host: StoreHost, memoryOnly: boolean): PlannedStore[] => {
  const app = manifest.app;
  const out: PlannedStore[] = [];
  for (const store of Object.keys(app.stores)) {
    const config = app.stores[store] ?? {};
    const given = config.kind;
    const wanted = typeof given === "function" ? given(app.args) : given ?? host.defaultKind;
    const kind = memoryOnly ? new MemoryKind() : kindNamed(host, wanted);
    if (kind === null) throw new Error(`The ${host.name} host cannot run the "${wanted}" store "${store}"; it runs ${kindsOf(host)}`);
    const at = config.at;
    out.push({ store, kind, kindName: wanted, at: typeof at === "function" ? at(app.args) : at ?? "", worker: config.worker === true });
  }
  const models = schemasOf(manifest);
  for (const name of Object.keys(models)) {
    const named = models[name]?.$adapter;
    if (typeof named === "string" && !out.some((p) => p.store === named))
      throw new Error(`The model "${name}" keeps its rows in the store "${named}", which the app does not declare (src/app.ts stores)`);
  }
  return out;
};

/** Open every store the app declares over one engine store, and hand it to the model apis; `memoryOnly` opens them all in memory. */
export const openStores = async (manifest: AppManifest, host: StoreHost, memoryOnly = false): Promise<Store> => {
  const models = schemasOf(manifest);
  const databases: Record<string, StorageAdapter> = {};
  for (const p of plan(manifest, host, memoryOnly)) databases[p.store] = await p.kind.open(manifest.app, p.store, p.at, models, p.store === "main");
  const store = createStore({
    models,
    databases,
    defaultAdapter: "main",
  });
  configureModel({ request: storeRequest(store) });
  return store;
};
