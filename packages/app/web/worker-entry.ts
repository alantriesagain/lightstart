/// <reference lib="dom" />
/**
 * @file The worker's side of a worker app: `serveModels({ app, models })` plans
 * and opens every declared store with the worker host's adapter types, builds
 * the engine store there, and serves the model apis plus the `Store` calls the
 * run needs (`count`, `addMany`, `close`) over `@lightstart/rpc`. `modelChanged`
 * and the model diagnostics are relayed to the page. The worker imports the
 * model modules itself, so a schema never crosses the channel; the page bundles
 * no engine store.
 */

import { portOf, relay, serve } from "@lightstart/rpc";
import { createModelHandlers, createStore, storeRequest } from "@lightstart/light/model/store";
import { configureModel } from "@lightstart/light/model";
import { modelChanged } from "@lightstart/light/model/events";
import type { Emitter } from "@lightstart/light/signals";
import type { ModelApi, ModelSchema, QueryOptions, Row, StorageAdapter, Store, WriteOptions } from "@lightstart/light/model/types.ts";
import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { MemoryAdapterType, plan, schemasOf } from "../stores.ts";
import type { StoreHost } from "../stores.ts";
import { IndexedDBAdapterType } from "./indexeddb.ts";
import { WORKER_EVENTS } from "./worker.ts";

/** What the worker opens models from: each model's api, whose `schema` is all the store needs. */
export type WorkerModels = Record<string, { readonly schema?: ModelSchema }>;

/** What the generated worker hands `serveModels`: the app and the model modules it imports. */
export interface WorkerInput {
  app: App;
  models: WorkerModels;
}

/** The events the worker relays to the page: every write, and the diagnostics. */
const RELAYED = { modelChanged, ...WORKER_EVENTS } as Record<string, Emitter<unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const recordOf = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error("the worker got a request with no payload");
  return value;
};

const textOf = (payload: Record<string, unknown>, key: string): string => {
  const value = payload[key];
  if (typeof value !== "string") throw new Error(`the worker got a request without "${key}"`);
  return value;
};

/** The worker's store adapter types: the web host's own, and every project adapter type registered in the worker. */
const workerHost: StoreHost = { name: "worker", adapters: [new IndexedDBAdapterType(), new MemoryAdapterType()], defaultAdapter: "indexeddb" };

/** Serve the worker's stores and model layer on this worker's port. */
export const serveModels = (input: WorkerInput): { dispose(): void } => {
  const models = Object.entries(input.models).map(([name, model]) => ({ name, model: model as ModelApi<Row, ModelSchema> }));
  let store: Store | null = null;
  const openStore = (): Store => {
    if (store === null) throw new Error("the worker's stores are not open");
    return store;
  };
  const handlers = createModelHandlers(openStore);

  const open = async (value: unknown): Promise<void> => {
    const payload = recordOf(value);
    const memoryOnly = payload["memoryOnly"] === true;
    const app = input.app;
    const manifest: AppManifest = { app, models, controllers: [], routes: null, views: [] };
    const schemas = schemasOf(manifest);
    const databases: Record<string, StorageAdapter> = {};
    for (const planned of plan(manifest, workerHost, memoryOnly)) {
      databases[planned.store] = await planned.type.open(app, planned.store, planned.at, schemas, planned.store === "main");
    }
    const made = createStore({ models: schemas, databases, defaultAdapter: "main" });
    configureModel({ request: storeRequest(made) });
    store = made;
  };

  const port = portOf(globalThis);
  const served = serve(port, {
    open: (value) => open(value),
    model: (value) => {
      const payload = recordOf(value);
      const action = textOf(payload, "action");
      const model = textOf(payload, "model");
      const data = isRecord(payload["payload"]) ? payload["payload"] : {};
      const handler = handlers[action];
      if (handler === undefined) throw new Error(`the worker has no model action "${action}"`);
      return handler({ model, ...data });
    },
    "store.count": (value) => {
      const payload = recordOf(value);
      const opts = isRecord(payload["opts"]) ? (payload["opts"] as QueryOptions) : undefined;
      return openStore().count(textOf(payload, "model"), opts);
    },
    "store.addMany": (value) => {
      const payload = recordOf(value);
      const rows = Array.isArray(payload["rows"]) ? payload["rows"].filter(isRecord) : [];
      const opts = isRecord(payload["opts"]) ? (payload["opts"] as WriteOptions) : undefined;
      return openStore().addMany(textOf(payload, "model"), rows as Row[], opts);
    },
    "store.close": () => {
      const closing = store;
      store = null;
      return closing === null ? undefined : closing.close();
    },
  });
  const relayed = relay(port, RELAYED);
  return {
    dispose(): void {
      relayed.dispose();
      served.dispose();
    },
  };
};
