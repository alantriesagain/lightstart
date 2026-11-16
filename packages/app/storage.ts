/**
 * @file Opening an app's store from its manifest: an IndexedDB database under
 * the app's name on the web, or the in-memory adapter a test asks for, plus
 * each named database the storage config declares. The models' schemas are
 * read from the manifest, and `configureModel` hands every model api the store
 * in this runtime.
 */

import { configureModel, modelBus } from "@lightstart/light/model";
import { hasAdapter, createAdapter, registerStorageAdapter } from "@lightstart/light/model/adapter";
import { createStore, storeRequest } from "@lightstart/light/model/store";
import type { ModelSchema, StorageAdapter, Store } from "@lightstart/light/model/types.ts";
import type { AppConfig, StorageConfig, StorageKind } from "./index.ts";
import { MemoryAdapter } from "./memory.ts";
import type { AppManifest } from "./manifest.ts";

export const schemasOf = (manifest: AppManifest): Record<string, ModelSchema> => {
  const models: Record<string, ModelSchema> = {};
  for (const entry of manifest.models) {
    const schema = entry.model.schema;
    if (schema !== undefined) models[entry.name] = schema;
  }
  return models;
};

/** The store config a host asks for, with the app's defaults filled in. */
export const storageOf = (app: Pick<AppConfig, "name" | "storage">, override?: StorageKind | StorageConfig): StorageConfig => {
  if (typeof override === "string") {
    return app.storage === undefined
      ? { kind: override, name: app.name }
      : { ...app.storage, kind: override, name: app.storage.name ?? app.name };
  }
  if (override !== undefined) {
    const stored = { ...override, name: override.name ?? app.name };
    return app.storage === undefined ? stored : { ...app.storage, ...override, name: stored.name };
  }
  if (app.storage !== undefined) return { ...app.storage, name: app.storage.name ?? app.name };
  return { kind: "indexeddb", name: app.name };
};

const openDatabase = async (kind: "memory" | "indexeddb", name: string, models: Record<string, ModelSchema>): Promise<StorageAdapter> => {
  if (kind === "memory" && !hasAdapter("memory")) registerStorageAdapter("memory", MemoryAdapter);
  if (kind === "indexeddb" && !hasAdapter("indexeddb")) throw new Error("An IndexedDB store needs the web host, which registers its adapter");
  const db = kind === "memory"
    ? createAdapter("memory", { name, models, isDefaultAdapter: true })
    : createAdapter("indexeddb", { name, version: 1, models, isDefaultAdapter: true });
  await db.init();
  return db;
};

/** Open the manifest's store; `override` is a test's `"memory"` or a host's own choice. */
export const openStore = async (manifest: AppManifest, override?: StorageKind | StorageConfig): Promise<Store> => {
  const storage = storageOf(manifest.app, override);
  const models = schemasOf(manifest);
  const name = storage.name ?? manifest.app.name;
  const hasIndexedDB = (globalThis as { indexedDB?: unknown }).indexedDB !== undefined;
  const kind = storage.kind === "indexeddb" && !hasIndexedDB ? "memory" : storage.kind;
  if (kind === "jsonl") throw new Error("The web host cannot open a JSONL store; use indexeddb or memory");

  const defaultAdapter = kind === "memory" ? "memory" : "indexeddb";
  const databases: Record<string, StorageAdapter> = {};
  databases[defaultAdapter] = await openDatabase(defaultAdapter, name, models);
  for (const [database, config] of Object.entries(storage.databases ?? {})) {
    if (database === defaultAdapter) continue;
    const databaseKind = kind === "memory" ? "memory" : config.kind === "memory" ? "memory" : "indexeddb";
    databases[database] = await openDatabase(databaseKind, `${name}:${database}`, models);
  }

  const store = createStore({
    models,
    databases,
    defaultAdapter,
    emit: (event, data) => modelBus().emit(event, data),
  });
  configureModel({ request: storeRequest(store) });
  return store;
};
