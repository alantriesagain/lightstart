/// <reference lib="dom" />
/**
 * @file The page's side of a worker store: a `StorageAdapter` whose every call
 * is one request on the worker's port. The engine store keeps the model layer
 * (validation, ids, hooks and `modelChanged`), so a write made here announces
 * once, on the page, exactly as a local store would. The worker holds the same
 * adapter and answers each method; the operators it supports come back
 * once, in the open request's answer.
 */

import type { Relayed, RpcClient } from "@lightstart/rpc";
import type { Emitter } from "@lightstart/light/signals";
import { idbError, idbLog, idbWarn, modelError, modelWarn } from "@lightstart/light/model/events";
import type { FacetResult, QueryOptions, QueryPage, Row, StorageAdapter, WhereClause, WriteOptions } from "@lightstart/light/model/types.ts";
import type { PlannedStore } from "../stores.ts";
import type { WebWorkerConnection, WebWorkerFeature } from "./features.ts";

/** The operators the engine asks an adapter about (`supportsOperator`); the worker answers which it has. */
export const MODEL_OPERATORS: readonly string[] = ["like"];

/** The diagnostic events both sides relay, so a worker adapter's warnings reach the page's listeners. */
export const WORKER_EVENTS = { modelError, modelWarn, idbError, idbLog, idbWarn } as Record<string, Emitter<unknown>>;

/** The requests a `WorkerAdapter` sends: one channel per worker, shared by its stores. */
export interface WorkerChannel {
  request(name: string, payload: unknown): Promise<unknown>;
  post(name: string, payload: unknown): void;
  release(): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** One worker a page opened: its rpc client, the relayed diagnostics, and how many stores still use it. */
export class WorkerConnection implements WorkerChannel {
  private readonly client: RpcClient;
  private readonly relayed: Relayed;
  private readonly worker: Worker;
  private readonly onEmpty: () => void;
  private open = 0;
  private ended = false;
  private failure = "";

  private constructor(client: RpcClient, relayed: Relayed, worker: Worker, onEmpty: () => void) {
    this.client = client;
    this.relayed = relayed;
    this.worker = worker;
    this.onEmpty = onEmpty;
    worker.addEventListener("error", (event) => {
      const detail = event as ErrorEvent;
      this.failure = detail.message;
    });
  }

  /** Open the channel over `worker`, loading `@lightstart/rpc` only when a page has a worker store. */
  static async connect(worker: Worker, onEmpty: () => void): Promise<WorkerConnection> {
    const rpc = await import("@lightstart/rpc");
    const port = rpc.portOf(worker);
    return new WorkerConnection(rpc.client(port), rpc.relay(port, WORKER_EVENTS), worker, onEmpty);
  }

  /** The message of the worker's last uncaught error, empty when it raised none. */
  failedMessage(): string {
    return this.failure;
  }

  /** Make the connection hold one more store. */
  retain(): void {
    this.open += 1;
  }

  request(name: string, payload: unknown): Promise<unknown> {
    return this.client.request(name, payload);
  }

  post(name: string, payload: unknown): void {
    this.client.post(name, payload);
  }

  /** Drop one store; the last one closes the channel and terminates the worker. */
  release(): void {
    if (this.ended) return;
    this.open -= 1;
    if (this.open > 0) return;
    this.ended = true;
    this.relayed.dispose();
    this.client.close();
    this.worker.terminate();
    this.onEmpty();
  }
}

/** The worker feature the generated entry passes to `start` when a store declares `worker: true`. */
export class WorkerStores implements WebWorkerFeature {
  private readonly factory: () => Worker;

  /** Spawn the worker entry with `factory` when the first worker store opens. */
  constructor(factory: () => Worker) {
    this.factory = factory;
  }

  /** Open the channel over one worker spawned by the factory. */
  connect(onEmpty: () => void): Promise<WebWorkerConnection> {
    return WorkerConnection.connect(this.factory(), onEmpty);
  }

  /** Open `store` through `connection` and answer the page's adapter. */
  async open(connection: WebWorkerConnection, store: PlannedStore, memoryOnly: boolean): Promise<StorageAdapter> {
    const adapter = new WorkerAdapter(connection, store.store, store.adapterName, store.at, store.store === "main", memoryOnly, MODEL_OPERATORS);
    await adapter.init();
    return adapter;
  }
}

/** The page's adapter for a store opened in the worker. */
export class WorkerAdapter implements StorageAdapter {
  [extra: string]: unknown;
  type: string | undefined;
  private readonly channel: WorkerChannel;
  private readonly store: string;
  private readonly adapter: string;
  private readonly at: string;
  private readonly main: boolean;
  private readonly memoryOnly: boolean;
  private readonly operators: readonly string[];
  private supported: string[] = [];
  private closed = false;

  constructor(channel: WorkerChannel, store: string, adapter: string, at: string, main: boolean, memoryOnly: boolean, operators: readonly string[] = MODEL_OPERATORS) {
    this.channel = channel;
    this.store = store;
    this.adapter = adapter;
    this.at = at;
    this.main = main;
    this.memoryOnly = memoryOnly;
    this.operators = operators;
  }

  async init(): Promise<void> {
    const answer = await this.channel.request("store.open", {
      store: this.store,
      adapter: this.adapter,
      at: this.at,
      main: this.main,
      memoryOnly: this.memoryOnly,
      operators: this.operators,
    });
    if (isRecord(answer)) {
      if (typeof answer["type"] === "string") this.type = answer["type"];
      const supported = answer["operators"];
      if (Array.isArray(supported)) this.supported = supported.filter((item): item is string => typeof item === "string");
    }
  }

  get(model: string, id: string | number, opts?: Pick<QueryOptions, "locale">): Promise<Row | null> {
    return this.channel.request("store.get", { store: this.store, model, id, opts }) as Promise<Row | null>;
  }

  query(model: string, opts: QueryOptions): Promise<QueryPage> {
    return this.channel.request("store.query", { store: this.store, model, opts }) as Promise<QueryPage>;
  }

  insert(model: string, row: Row, opts?: WriteOptions): Promise<Row> {
    return this.channel.request("store.insert", { store: this.store, model, row, opts }) as Promise<Row>;
  }

  update(model: string, row: Row, opts?: WriteOptions): Promise<Row> {
    return this.channel.request("store.update", { store: this.store, model, row, opts }) as Promise<Row>;
  }

  delete(model: string, id: string | number, opts?: WriteOptions): Promise<unknown> {
    return this.channel.request("store.delete", { store: this.store, model, id, opts });
  }

  count(model: string, where?: WhereClause): Promise<number> {
    return this.channel.request("store.count", { store: this.store, model, where }) as Promise<number>;
  }

  insertMany(model: string, rows: Row[], opts?: WriteOptions): Promise<Row[]> {
    return this.channel.request("store.insertMany", { store: this.store, model, rows, opts }) as Promise<Row[]>;
  }

  exists(model: string, where?: WhereClause): Promise<boolean> {
    return this.channel.request("store.exists", { store: this.store, model, where }) as Promise<boolean>;
  }

  facets(model: string, fields?: string[], opts?: QueryOptions): Promise<FacetResult> {
    return this.channel.request("store.facets", { store: this.store, model, fields, opts }) as Promise<FacetResult>;
  }

  truncate(model: string): Promise<unknown> {
    return this.channel.request("store.truncate", { store: this.store, model });
  }

  invalidate(model: string): void {
    this.channel.post("store.invalidate", { store: this.store, model });
  }

  supportsOperator(operator: string): boolean {
    return this.supported.includes(operator);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.channel.request("store.close", { store: this.store });
    } finally {
      this.channel.release();
    }
  }
}
