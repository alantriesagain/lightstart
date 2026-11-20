/// <reference lib="dom" />
/**
 * @file The web host's IndexedDB kind, kept apart from the host's DOM pieces so
 * the worker's entry can open it without loading a view base class.
 */

import { createAdapter, hasAdapter, registerStorageAdapter } from "@lightstart/light/model/adapter";
import IndexedDBAdapter from "@lightstart/light/model/indexeddb";
import type { ModelSchema, StorageAdapter } from "@lightstart/light/model/types.ts";
import type { App } from "../index.ts";
import { StoreKind } from "../stores.ts";

const openIndexedDB = async (name: string, models: Record<string, ModelSchema>, main: boolean): Promise<StorageAdapter> => {
  if (!hasAdapter("indexeddb")) registerStorageAdapter("indexeddb", IndexedDBAdapter);
  const db = createAdapter("indexeddb", { name, version: 1, models, isDefaultAdapter: main });
  await db.init();
  return db;
};

/** The page's IndexedDB: a database per store, the app's name for `main` unless the store names one (`at`). */
export class IndexedDBKind extends StoreKind {
  readonly name = "indexeddb";

  open(app: App, store: string, at: string, models: Record<string, ModelSchema>, main: boolean): Promise<StorageAdapter> {
    return openIndexedDB(at.length > 0 ? at : main ? app.name : app.name + ":" + store, models, main);
  }
}
