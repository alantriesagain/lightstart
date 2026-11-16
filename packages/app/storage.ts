/**
 * @file Opening an app's store from its manifest: an IndexedDB database under
 * the app's name on the web, or the in-memory adapter a test asks for. The
 * models' schemas are read from the manifest, and `configureModel` hands every
 * model api the store in this runtime.
 */

import { configureModel, modelBus } from "@lightstart/light/model";
import { hasAdapter, createAdapter, registerStorageAdapter } from "@lightstart/light/model/adapter";
import { createStore, storeRequest } from "@lightstart/light/model/store";
import IndexedDBAdapter from "@lightstart/light/model/indexeddb";
import type { ModelSchema, Store } from "@lightstart/light/model/types.ts";
import type { AppConfig, StorageConfig, StorageKind } from "./index.ts";
import { MemoryAdapter } from "./memory.ts";
import type { AppManifest } from "./manifest.ts";

const schemasOf = (manifest: AppManifest): Record<string, ModelSchema> => {
  const models: Record<string, ModelSchema> = {};
  for (const entry of manifest.models) {
    const schema = entry.model.schema;
    if (schema !== undefined) models[entry.name] = schema;
  }
  return models;
};

/** The store config a host asks for, with the app's defaults filled in. */
export const storageOf = (app: AppConfig, override?: StorageKind | StorageConfig): StorageConfig => {
  if (typeof override === "string") return { kind: override, name: app.name };
  if (override !== undefined) return { kind: override.kind, name: override.name ?? app.name };
  if (app.storage !== undefined) return { kind: app.storage.kind, name: app.storage.name ?? app.name };
  return { kind: "indexeddb", name: app.name };
};

/** Open the manifest's store; `override` is a test's `"memory"` or a host's own choice. */
export const openStore = async (manifest: AppManifest, override?: StorageKind | StorageConfig): Promise<Store> => {
  const storage = storageOf(manifest.app, override);
  const models = schemasOf(manifest);
  const name = storage.name ?? manifest.app.name;
  const hasIndexedDB = (globalThis as { indexedDB?: unknown }).indexedDB !== undefined;
  const kind = storage.kind === "indexeddb" && !hasIndexedDB ? "memory" : storage.kind;
  if (kind === "jsonl") throw new Error("The web host cannot open a JSONL store; use indexeddb or memory");

  if (kind === "indexeddb") {
    if (!hasAdapter("indexeddb")) registerStorageAdapter("indexeddb", IndexedDBAdapter);
  } else if (!hasAdapter("memory")) registerStorageAdapter("memory", new MemoryAdapter());

  if (kind === "memory") {
    const db = createAdapter("memory", { name, models, isDefaultAdapter: true });
    await db.init();
    const store = createStore({
      models,
      databases: { memory: db },
      defaultAdapter: "memory",
      emit: (event, data) => modelBus().emit(event, data),
    });
    configureModel({ request: storeRequest(store) });
    return store;
  }

  const db = createAdapter("indexeddb", { name, version: 1, models, isDefaultAdapter: true });
  await db.init();
  const store = createStore({
    models,
    databases: { indexeddb: db },
    defaultAdapter: "indexeddb",
    emit: (event, data) => modelBus().emit(event, data),
  });
  configureModel({ request: storeRequest(store) });
  return store;
};
