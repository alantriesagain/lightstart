/// <reference lib="dom" />
/**
 * @file The worker's side of a worker store: `serveStores(app, models)` opens,
 * per request, the same kind of adapter the page would have opened and answers
 * one request per adapter method. The model layer is not here: the page's
 * engine store keeps it, so writes announce once, on the page. The worker
 * imports the model modules itself, so a schema never crosses the channel.
 */

import { relay, serve } from "@lightstart/rpc";
import { portOf } from "@lightstart/rpc";
import type { ModelSchema, Row, StorageAdapter, WriteOptions } from "@lightstart/light/model/types.ts";
import type { App } from "../index.ts";
import { kindNamed, kindsOf, MemoryKind } from "../stores.ts";
import type { StoreHost } from "../stores.ts";
import { IndexedDBKind } from "./indexeddb.ts";
import { WORKER_EVENTS } from "./worker.ts";

/** What the worker opens models from: each model's api, whose `schema` is all the adapter needs. */
export type StoreModels = Record<string, { readonly schema?: ModelSchema }>;

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

const stringsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

const schemasOf = (models: StoreModels): Record<string, ModelSchema> => {
  const out: Record<string, ModelSchema> = {};
  for (const name of Object.keys(models)) {
    const schema = models[name]?.schema;
    if (schema !== undefined) out[name] = schema;
  }
  return out;
};

/** The worker's store kinds: the web host's own, and every project kind registered in the worker. */
const workerHost: StoreHost = { name: "worker", kinds: [new IndexedDBKind(), new MemoryKind()], defaultKind: "indexeddb" };

/** Serve the page's stores on this worker's port: `store.open`, one `store.<method>` per adapter method, and `store.close`. */
export const serveStores = (app: App, models: StoreModels): { dispose(): void } => {
  const schemas = schemasOf(models);
  const adapters = new Map<string, StorageAdapter>();
  const adapterFor = (payload: Record<string, unknown>): StorageAdapter => {
    const store = textOf(payload, "store");
    const found = adapters.get(store);
    if (found === undefined) throw new Error(`the worker has no store "${store}"`);
    return found;
  };

  const open = async (value: unknown): Promise<{ type: string; operators: string[] }> => {
    const payload = recordOf(value);
    const store = textOf(payload, "store");
    const kindName = textOf(payload, "kind");
    const at = typeof payload["at"] === "string" ? payload["at"] : "";
    const main = payload["main"] === true;
    const memoryOnly = payload["memoryOnly"] === true;
    const operators = stringsOf(payload["operators"]);
    const kind = memoryOnly ? new MemoryKind() : kindNamed(workerHost, kindName);
    if (kind === null) throw new Error(`The worker cannot run the "${kindName}" store "${store}"; it runs ${kindsOf(workerHost)}`);
    const adapter = await kind.open(app, store, at, schemas, main);
    adapters.set(store, adapter);
    const supported = operators.filter((operator) => typeof adapter.supportsOperator === "function" && adapter.supportsOperator(operator));
    return { type: adapter.type ?? kind.name, operators: supported };
  };

  const port = portOf(globalThis);
  const served = serve(port, {
    "store.open": (payload) => open(payload),
    "store.get": (value) => {
      const payload = recordOf(value);
      const id = payload["id"];
      if (typeof id !== "string" && typeof id !== "number") throw new Error("the worker got a get without an id");
      const opts = isRecord(payload["opts"]) ? (payload["opts"] as { locale?: string }) : undefined;
      return adapterFor(payload).get(textOf(payload, "model"), id, opts);
    },
    "store.query": (value) => {
      const payload = recordOf(value);
      const opts = isRecord(payload["opts"]) ? payload["opts"] : {};
      return adapterFor(payload).query(textOf(payload, "model"), opts as never);
    },
    "store.insert": (value) => {
      const payload = recordOf(value);
      const row = isRecord(payload["row"]) ? (payload["row"] as Row) : {};
      return adapterFor(payload).insert(textOf(payload, "model"), row, isRecord(payload["opts"]) ? (payload["opts"] as WriteOptions) : undefined);
    },
    "store.update": (value) => {
      const payload = recordOf(value);
      const row = isRecord(payload["row"]) ? (payload["row"] as Row) : {};
      return adapterFor(payload).update(textOf(payload, "model"), row, isRecord(payload["opts"]) ? (payload["opts"] as WriteOptions) : undefined);
    },
    "store.delete": (value) => {
      const payload = recordOf(value);
      const id = payload["id"];
      if (typeof id !== "string" && typeof id !== "number") throw new Error("the worker got a delete without an id");
      return adapterFor(payload).delete(textOf(payload, "model"), id, isRecord(payload["opts"]) ? (payload["opts"] as WriteOptions) : undefined);
    },
    "store.count": (value) => {
      const payload = recordOf(value);
      return adapterFor(payload).count(textOf(payload, "model"), isRecord(payload["where"]) ? payload["where"] : undefined);
    },
    "store.insertMany": (value) => {
      const payload = recordOf(value);
      const rows = Array.isArray(payload["rows"]) ? payload["rows"].filter(isRecord) : [];
      const adapter = adapterFor(payload);
      const many = adapter.insertMany;
      if (typeof many === "function") return many.call(adapter, textOf(payload, "model"), rows as Row[], isRecord(payload["opts"]) ? (payload["opts"] as WriteOptions) : undefined);
      return Promise.all(rows.map((row) => adapter.insert(textOf(payload, "model"), row as Row)));
    },
    "store.exists": (value) => {
      const payload = recordOf(value);
      const adapter = adapterFor(payload);
      const where = isRecord(payload["where"]) ? payload["where"] : undefined;
      const exists = adapter.exists;
      if (typeof exists === "function") return exists.call(adapter, textOf(payload, "model"), where);
      return adapter.count(textOf(payload, "model"), where).then((count) => count > 0);
    },
    "store.facets": (value) => {
      const payload = recordOf(value);
      const adapter = adapterFor(payload);
      const facets = adapter.facets;
      if (typeof facets !== "function") return {};
      return facets.call(adapter, textOf(payload, "model"), stringsOf(payload["fields"]), isRecord(payload["opts"]) ? (payload["opts"] as never) : undefined);
    },
    "store.truncate": (value) => {
      const payload = recordOf(value);
      const adapter = adapterFor(payload);
      const truncate = adapter.truncate;
      return typeof truncate === "function" ? truncate.call(adapter, textOf(payload, "model")) : undefined;
    },
    "store.invalidate": (value) => {
      const payload = recordOf(value);
      const adapter = adapterFor(payload);
      adapter.invalidate?.(textOf(payload, "model"));
      return undefined;
    },
    "store.close": (value) => {
      const payload = recordOf(value);
      const adapter = adapterFor(payload);
      adapters.delete(textOf(payload, "store"));
      return adapter.close();
    },
  });
  const relayed = relay(port, WORKER_EVENTS);
  return {
    dispose(): void {
      relayed.dispose();
      served.dispose();
    },
  };
};
