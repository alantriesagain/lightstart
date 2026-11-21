/// <reference lib="dom" />
/**
 * @file The worker's side of a worker app: `serveModels({ app, models, worker })`
 * plans and opens every declared store with the worker host's adapter types,
 * builds the engine store there, and serves the model apis plus the `Store`
 * calls the run needs (`count`, `addMany`, `close`) over `@lightstart/rpc`.
 * `modelChanged` and the model diagnostics are relayed to the page. The worker
 * imports the model modules itself, so a schema never crosses the channel; the
 * page bundles no engine store. A project's own `src/worker.ts` (or `.js`)
 * default-exports `defineWorker({ serve, relay, mirror, opened })`, whose
 * handlers, events and signals are served beside light's on the same port.
 */

import { client, mirror, portOf, relay, serve } from "@lightstart/rpc";
import type { Handler, MirrorSignal, Port } from "@lightstart/rpc";
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

/** What `opened` reaches: the app, the worker's engine store, and a request to a handler the page serves. */
export interface WorkerContext {
  app: App;
  store: Store;
  request(name: string, payload?: unknown): Promise<unknown>;
  /** Serve more requests from now on, beside light's (a name light uses is an error; a project name served before is replaced). */
  serve(handlers: Record<string, (payload: unknown) => unknown>): void;
}

/** A worker app's own part of the worker: requests, events, mirrored signals and the work its stores opening calls for. */
export interface WorkerDefinition {
  /** Request handlers served beside light's; a name light uses is an error. */
  serve?: Record<string, (payload: unknown) => unknown>;
  /** Events relayed beside light's; a name light relays is an error. */
  relay?: Record<string, Emitter<unknown>>;
  /** Signals mirrored to or from the page, each with the side that owns it. */
  mirror?: Record<string, { signal: MirrorSignal<unknown>; owner: boolean }>;
  /** Runs once the stores are open and before the page's `open` answers; an error here rejects `open`. */
  opened?: (context: WorkerContext) => Promise<void> | void;
}

/** Name a project's worker part: `defineWorker` answers its definition, typed. */
export const defineWorker = (definition: WorkerDefinition): WorkerDefinition => definition;

/** What the generated worker hands `serveModels`: the app, the model modules it imports, and the project's own worker part. */
export interface WorkerInput {
  app: App;
  models: WorkerModels;
  worker?: WorkerDefinition;
  /** Where to serve; the worker's own global scope when absent. */
  port?: Port;
}

/** The events the worker relays to the page: every write, and the diagnostics. */
const RELAYED = { modelChanged, ...WORKER_EVENTS } as Record<string, Emitter<unknown>>;

const LIGHT_REQUESTS = new Set(["open", "model", "store.count", "store.addMany", "store.close"]);

/** How long one request from the worker to a page handler may take before it rejects. */
const REQUEST_TIMEOUT = 30_000;

const refuseClash = (names: readonly string[], taken: readonly string[], what: string): void => {
  for (const name of names) {
    if (taken.includes(name)) throw new Error(`The worker's ${what} names "${name}", which light's worker already uses`);
  }
};

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

/** Serve the worker's stores and model layer, and the project's own worker part, on this worker's port. */
export const serveModels = (input: WorkerInput): { dispose(): void } => {
  const models = Object.entries(input.models).map(([name, model]) => ({ name, model: model as ModelApi<Row, ModelSchema> }));
  const worker = input.worker ?? {};
  const ownServe = worker.serve ?? {};
  const ownRelay = worker.relay ?? {};
  refuseClash(Object.keys(ownServe), [...LIGHT_REQUESTS], "serve table");
  const addHandlers = (handlers: Record<string, (payload: unknown) => unknown>): void => {
    refuseClash(Object.keys(handlers), [...LIGHT_REQUESTS], "serve table");
    Object.assign(table, handlers);
  };
  refuseClash(Object.keys(ownRelay), Object.keys(RELAYED), "relay table");
  const port = input.port ?? portOf(globalThis);
  const workerClient = client(port, { timeoutMs: REQUEST_TIMEOUT, idPrefix: "worker:" });

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
    if (worker.opened !== undefined) {
      try {
        await worker.opened({ app, store: made, request: (name, requestPayload) => workerClient.request(name, requestPayload), serve: addHandlers });
      } catch (error) {
        store = null;
        await made.close();
        throw error;
      }
    }
  };

  const lightServe: Record<string, Handler> = {
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
  };
  const table: Record<string, Handler> = { ...lightServe, ...ownServe };
  const served = serve(port, table);
  const relayed = relay(port, { ...RELAYED, ...ownRelay });
  const mirrored = Object.entries(worker.mirror ?? {}).map(([name, entry]) => mirror(port, name, entry.signal, { owner: entry.owner }));
  return {
    dispose(): void {
      for (const installed of mirrored) installed.dispose();
      relayed.dispose();
      served.dispose();
      workerClient.close();
    },
  };
};
