/// <reference lib="dom" />
/**
 * @file The page's side of a worker app: `WorkerStores` spawns one worker,
 * asks it to open every store, then sends every model api through the worker
 * with `configureModel({ request })` and relays `modelChanged` and the model
 * diagnostics back to the page. The run gets a `RunStore` proxy over the same
 * channel, so seeds and stopping reach the worker's engine store. The worker
 * runs the whole model layer (`web/worker-entry.ts`); the page bundles no
 * engine store.
 */

import { client, portOf, relay } from "@lightstart/rpc";
import type { Relayed, RpcClient } from "@lightstart/rpc";
import type { Emitter } from "@lightstart/light/signals";
import { idbError, idbLog, idbWarn, modelChanged, modelError, modelWarn } from "@lightstart/light/model/events";
import { configureModel } from "@lightstart/light/model";
import type { QueryOptions, Row, WriteOptions } from "@lightstart/light/model/types.ts";
import type { AppManifest } from "../manifest.ts";
import type { RunStore } from "../run.ts";
import type { StoreHost } from "../stores.ts";
import type { WebStoresFeature } from "./features.ts";

/** The diagnostic events both sides relay, so the worker's warnings reach the page's listeners. */
export const WORKER_EVENTS = { modelError, modelWarn, idbError, idbLog, idbWarn } as Record<string, Emitter<unknown>>;

/** The events the worker relays to the page: every write, and the diagnostics. */
const WORKER_RELAYED = { modelChanged, ...WORKER_EVENTS } as Record<string, Emitter<unknown>>;

/** How long a request to the worker may take before it rejects. */
const REQUEST_TIMEOUT = 30_000;

/** One worker a page opened: its rpc client and the relayed events. */
export class WorkerConnection {
  private readonly client: RpcClient;
  private readonly relayed: Relayed;
  private readonly worker: Worker;
  private failure = "";

  private constructor(client: RpcClient, relayed: Relayed, worker: Worker) {
    this.client = client;
    this.relayed = relayed;
    this.worker = worker;
    worker.addEventListener("error", (event) => {
      this.failure = (event as ErrorEvent).message;
    });
  }

  /** Open the channel over `worker`; a request waits up to `REQUEST_TIMEOUT` (a large seed or a slow device). */
  static connect(worker: Worker): WorkerConnection {
    const port = portOf(worker);
    return new WorkerConnection(client(port, { timeoutMs: REQUEST_TIMEOUT }), relay(port, WORKER_RELAYED), worker);
  }

  /** The message of the worker's last uncaught error, empty when it raised none. */
  failedMessage(): string {
    return this.failure;
  }

  request(name: string, payload: unknown, timeoutMs?: number): Promise<unknown> {
    return this.client.request(name, payload, timeoutMs === undefined ? {} : { timeoutMs });
  }

  /** Close the channel and terminate the worker. */
  dispose(): void {
    this.relayed.dispose();
    this.client.close();
    this.worker.terminate();
  }
}

/** The stores the run uses in a worker app: the worker's model layer behind this channel. */
class WorkerStore implements RunStore {
  private readonly connection: WorkerConnection;
  private closed = false;

  constructor(connection: WorkerConnection) {
    this.connection = connection;
  }

  count(model: string, options?: QueryOptions): Promise<number> {
    return this.connection.request("store.count", { model, opts: options }) as Promise<number>;
  }

  addMany(model: string, rows: Row[], options?: WriteOptions): Promise<Row[]> {
    return this.connection.request("store.addMany", { model, rows, opts: options }) as Promise<Row[]>;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.connection.request("store.close", {}, 60_000);
    } finally {
      this.connection.dispose();
    }
  }
}

/** The stores feature the generated entry passes when the app declares `worker: true`. */
export class WorkerStores implements WebStoresFeature {
  private readonly factory: () => Worker;

  /** Spawn the worker entry with `factory` when the run opens its stores. */
  constructor(factory: () => Worker) {
    this.factory = factory;
  }

  /** Spawn one worker, have it open every store, and point the model apis and the run at it. */
  async open(_manifest: AppManifest, _host: StoreHost, memoryOnly: boolean): Promise<RunStore> {
    const connection = WorkerConnection.connect(this.factory());
    try {
      await connection.request("open", { memoryOnly });
    } catch (error) {
      const message = connection.failedMessage();
      connection.dispose();
      throw message === "" ? error : new Error(message);
    }
    configureModel({
      request: (action, model, payload) => connection.request("model", { action, model, payload }),
    });
    return new WorkerStore(connection);
  }
}
