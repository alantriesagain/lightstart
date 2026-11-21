/**
 * @file An app's stores: each declared store opened by its adapter type, all of
 * them over one engine store, which routes each model to the store its schema's
 * `$store` names (`main` when it names none). An adapter type is an
 * `AdapterType`: the core's `memory`, a host's (`indexeddb` on the web, `jsonl`
 * on the terminal), or one a project registers. A host runs the adapter types it
 * lists and its own default; a store of an adapter type it cannot run, or a
 * model naming a store the app does not declare, is an error before anything
 * opens. Opening them is `openStores` in engine.ts, which only a host that
 * opens stores locally imports.
 */

import { createAdapter, hasAdapter, registerStorageAdapter } from "@lightstart/light/model/adapter";
import type { ModelSchema, StorageAdapter } from "@lightstart/light/model/types.ts";
import type { App } from "./index.ts";
import type { AppManifest } from "./manifest.ts";
import { MemoryAdapter } from "./memory.ts";

/** An adapter type a store may be of: its name, and how it opens one store. */
export abstract class AdapterType {
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

/** The core's adapter type: rows held in memory, for tests and for what need not outlast the process. */
export class MemoryAdapterType extends AdapterType {
  readonly name = "memory";

  open(app: App, store: string, _at: string, models: Record<string, ModelSchema>, main: boolean): Promise<StorageAdapter> {
    return openMemory(app, store, models, main);
  }
}

/** What runs a store: the adapter types a host has and its default. */
export interface StoreHost {
  readonly name: string;
  readonly adapters: readonly AdapterType[];
  readonly defaultAdapter: string;
}

const projectAdapterTypes: AdapterType[] = [];

/** Make `adapter` one every host can run, for a project's own adapter type (registered before the app starts). */
export const registerAdapterType = (adapter: AdapterType): void => {
  const at = projectAdapterTypes.findIndex((a) => a.name === adapter.name);
  if (at >= 0) projectAdapterTypes[at] = adapter;
  else projectAdapterTypes.push(adapter);
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

/** The adapter type named `name` that `host` can run, `memory` always among them; null when it has none. */
export const adapterTypeNamed = (host: StoreHost, name: string): AdapterType | null => {
  for (const a of projectAdapterTypes) if (a.name === name) return a;
  for (const a of host.adapters) if (a.name === name) return a;
  return name === "memory" ? new MemoryAdapterType() : null;
};

/** The adapter types `host` can run, by name, for an error. */
export const adapterTypesOf = (host: StoreHost): string => {
  const names = host.adapters.map((a) => a.name);
  for (const a of projectAdapterTypes) if (!names.includes(a.name)) names.push(a.name);
  if (!names.includes("memory")) names.push("memory");
  return names.join(", ");
};

/** One declared store's plan: the store, the adapter type it opens with (memory in a test), and the name of the adapter it asked for. */
export interface PlannedStore {
  store: string;
  type: AdapterType;
  adapterName: string;
  at: string;
}

/** The adapter type each store opens with: its own, or the host's default; `memoryOnly` makes every one memory (a test). */
export const plan = (manifest: AppManifest, host: StoreHost, memoryOnly: boolean): PlannedStore[] => {
  const app = manifest.app;
  const out: PlannedStore[] = [];
  for (const store of Object.keys(app.stores)) {
    const config = app.stores[store] ?? {};
    const given = config.adapter;
    const wanted = typeof given === "function" ? given(app.args) : given ?? host.defaultAdapter;
    const type = memoryOnly ? new MemoryAdapterType() : adapterTypeNamed(host, wanted);
    if (type === null) throw new Error(`The ${host.name} host cannot run the "${wanted}" store "${store}"; it runs ${adapterTypesOf(host)}`);
    const at = config.at;
    out.push({ store, type, adapterName: wanted, at: typeof at === "function" ? at(app.args) : at ?? "" });
  }
  const models = schemasOf(manifest);
  for (const name of Object.keys(models)) {
    const named = models[name]?.$store;
    if (typeof named === "string" && !out.some((p) => p.store === named))
      throw new Error(`The model "${name}" keeps its rows in the store "${named}", which the app does not declare (src/app.ts stores)`);
  }
  return out;
};
