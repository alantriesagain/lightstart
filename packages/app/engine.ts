/**
 * @file Opening an app's stores over the engine store, for a host that opens
 * them locally: the page's local feature, the terminal host, the static host
 * and a test. The engine store runs every model semantic (queries,
 * relationships, validation, hooks, ids and `modelChanged`), and
 * `configureModel` hands every model api the store in this runtime. A worker
 * app's page imports none of this: its worker opens the stores instead.
 */

import { configureModel } from "@lightstart/light/model";
import { createStore, storeRequest } from "@lightstart/light/model/store";
import type { StorageAdapter, Store } from "@lightstart/light/model/types.ts";
import type { AppManifest } from "./manifest.ts";
import { plan, schemasOf } from "./stores.ts";
import type { StoreHost } from "./stores.ts";

/** Open every store the app declares over one engine store, and hand it to the model apis; `memoryOnly` opens them all in memory. */
export const openStores = async (manifest: AppManifest, host: StoreHost, memoryOnly = false): Promise<Store> => {
  const models = schemasOf(manifest);
  const databases: Record<string, StorageAdapter> = {};
  for (const p of plan(manifest, host, memoryOnly)) databases[p.store] = await p.type.open(manifest.app, p.store, p.at, models, p.store === "main");
  const store = createStore({
    models,
    databases,
    defaultAdapter: "main",
  });
  configureModel({ request: storeRequest(store) });
  return store;
};
