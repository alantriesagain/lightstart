/// <reference lib="dom" />
/**
 * @file The page's side of a worker app: `WorkerStores` spawns one worker (or
 * takes a `MessagePort`), asks it to open every store, then sends every model
 * api through the worker with `configureModel({ request })` and relays
 * `modelChanged` and the model diagnostics back to the page. The run gets a
 * `RunStore` proxy over the same channel, so seeds and stopping reach the
 * worker's engine store. The worker runs the whole model layer
 * (`web/worker-entry.ts`); the page bundles no engine store. A project's page
 * declares its own requests, events, mirrored signals and handlers on the
 * exported `worker`, applied to each connection it opens.
 */

import { client, mirror, portOf, relay, serve } from "@lightstart/rpc";
import type { Handler, MirrorSignal, Mirrored, Port, Relayed, RpcClient, Served } from "@lightstart/rpc";
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

/** A mirrored signal the page declared, with the side that owns it. */
interface DeclaredMirror {
  name: string;
  signal: MirrorSignal<unknown>;
  owner: boolean;
}

/** What the page declared on `worker`, recorded until a connection applies it and applied again when it changes. */
interface Declarations {
  serve: Array<Record<string, Handler>>;
  relay: Array<Record<string, Emitter<unknown>>>;
  mirror: DeclaredMirror[];
}

/** A request waiting for the next connection to open its stores. */
interface Waiting {
  name: string;
  payload: unknown;
  resolve(value: unknown): void;
  reject(error: Error): void;
}

const waitingError = (name: string): Error => new Error(`worker: request "${name}" waited for stores that closed before they opened`);

/** One worker a page opened: its rpc client, the served and relayed declarations, and the worker it terminates. */
export class WorkerConnection {
  private readonly client: RpcClient;
  private readonly port: Port;
  private readonly worker: Worker | null;
  private readonly closePort: (() => void) | null;
  private relayed: Relayed | null = null;
  private served: Served | null = null;
  private mirrored: Mirrored[] = [];
  private failure = "";
  private opened = false;
  /** Told when this connection is disposed, so the page's waiting requests reject. */
  onClosed: (() => void) | null = null;

  private constructor(port: Port, client: RpcClient, worker: Worker | null, closePort: (() => void) | null) {
    this.client = client;
    this.port = port;
    this.worker = worker;
    this.closePort = closePort;
    port.addEventListener?.("error", (event) => {
      const error = event.error;
      const message = Reflect.get(event, "message");
      this.failure = error instanceof Error ? error.message : typeof message === "string" ? message : String(error);
    });
  }

  /** Open the channel over `source`; a request waits up to `REQUEST_TIMEOUT` (a large seed or a slow device). */
  static connect(source: Worker | MessagePort): WorkerConnection {
    if (typeof Worker !== "undefined" && source instanceof Worker) {
      const port = portOf(source);
      return new WorkerConnection(port, client(port, { timeoutMs: REQUEST_TIMEOUT }), source, null);
    }
    if (typeof MessagePort !== "undefined" && source instanceof MessagePort) {
      source.start();
      return new WorkerConnection(source, client(source, { timeoutMs: REQUEST_TIMEOUT }), null, () => source.close());
    }
    const port = portOf(source);
    return new WorkerConnection(port, client(port, { timeoutMs: REQUEST_TIMEOUT }), null, null);
  }

  /** The message of the worker's last uncaught error, empty when it raised none. */
  failedMessage(): string {
    return this.failure;
  }

  /** Whether the worker has answered its `open` request. */
  isOpened(): boolean {
    return this.opened;
  }

  /** Serve, relay and mirror what the page declared, disposing the previous tables. */
  apply(declarations: Declarations): void {
    this.served?.dispose();
    this.relayed?.dispose();
    for (const installed of this.mirrored) installed.dispose();
    this.mirrored = [];
    const handlers: Record<string, Handler> = {};
    for (const table of declarations.serve) Object.assign(handlers, table);
    const events: Record<string, Emitter<unknown>> = { ...WORKER_RELAYED };
    for (const table of declarations.relay) Object.assign(events, table);
    this.relayed = relay(this.port, events);
    this.served = serve(this.port, handlers);
    this.mirrored = declarations.mirror.map((entry) => mirror(this.port, entry.name, entry.signal, { owner: entry.owner }));
  }

  /** The worker answered `open`: later requests go straight through. */
  markOpened(): void {
    this.opened = true;
  }

  request(name: string, payload?: unknown, timeoutMs?: number): Promise<unknown> {
    return this.client.request(name, payload, timeoutMs === undefined ? {} : { timeoutMs });
  }

  /** Close the channel and terminate the worker (a bare port is closed). */
  dispose(): void {
    this.served?.dispose();
    this.served = null;
    this.relayed?.dispose();
    this.relayed = null;
    for (const installed of this.mirrored) installed.dispose();
    this.mirrored = [];
    this.client.close();
    if (this.worker !== null) this.worker.terminate();
    else this.closePort?.();
    const closed = this.onClosed;
    this.onClosed = null;
    closed?.();
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

/** The page's own side of the channel: its declarations, and the request waiting for the stores. */
class WorkerBridge {
  private declarations: Declarations = { serve: [], relay: [], mirror: [] };
  private connection: WorkerConnection | null = null;
  private waiting: Waiting[] = [];

  /** Answer when a connection has opened its stores; a request made before then waits for one. */
  request(name: string, payload?: unknown): Promise<unknown> {
    const current = this.connection;
    if (current !== null && current.isOpened()) return current.request(name, payload);
    return new Promise<unknown>((resolve, reject) => {
      this.waiting.push({ name, payload, resolve, reject });
    });
  }

  /** Relayed events served beside light's on each connection. */
  relay(emitters: Record<string, Emitter<unknown>>): void {
    for (const name of Object.keys(emitters)) {
      if (name in WORKER_RELAYED) throw new Error(`The page's relay names "${name}", which light's worker already relays`);
    }
    this.declarations.relay.push(emitters);
    this.reapply();
  }

  /** A mirrored signal, owned by the page or followed by it. */
  mirror(name: string, signal: MirrorSignal<unknown>, options: { owner: boolean }): void {
    this.declarations.mirror.push({ name, signal, owner: options.owner });
    this.reapply();
  }

  /** Request handlers the worker reaches, served beside light's on each connection. */
  serve(handlers: Record<string, Handler>): void {
    this.declarations.serve.push(handlers);
    this.reapply();
  }

  /** Serve what the page declared on a new connection, before it asks the worker to open. */
  attach(connection: WorkerConnection): void {
    this.connection = connection;
    connection.apply(this.declarations);
  }

  /** Send what waited for the stores, now that the worker answered `open`. */
  opened(connection: WorkerConnection): void {
    connection.markOpened();
    const waiting = this.waiting;
    this.waiting = [];
    for (const entry of waiting) connection.request(entry.name, entry.payload).then(entry.resolve, entry.reject);
  }

  /** The connection is gone: what waited for it rejects, and the next one starts from the recorded declarations. */
  detach(connection: WorkerConnection): void {
    if (this.connection !== connection) return;
    this.connection = null;
    const waiting = this.waiting;
    this.waiting = [];
    for (const entry of waiting) entry.reject(waitingError(entry.name));
  }

  private reapply(): void {
    if (this.connection !== null) this.connection.apply(this.declarations);
  }
}

/** The page's own side of a worker app: requests, events, mirrored signals and handlers, applied to each connection. */
export interface WorkerSide {
  request(name: string, payload?: unknown): Promise<unknown>;
  relay(emitters: Record<string, Emitter<unknown>>): void;
  mirror(name: string, signal: MirrorSignal<unknown>, options: { owner: boolean }): void;
  serve(handlers: Record<string, Handler>): void;
}

const workerBridge = new WorkerBridge();

/** What the page declares for the worker's channel; calls made before the stores open apply when they do. */
export const worker: WorkerSide = workerBridge;

/** The stores feature the generated entry passes when the app declares `worker: true`. */
export class WorkerStores implements WebStoresFeature {
  private readonly factory: () => Worker | MessagePort;

  /** Spawn the worker entry with `factory` when the run opens its stores. */
  constructor(factory: () => Worker | MessagePort) {
    this.factory = factory;
  }

  /** Spawn one worker, have it open every store, and point the model apis and the run at it. */
  async open(_manifest: AppManifest, _host: StoreHost, memoryOnly: boolean): Promise<RunStore> {
    const connection = WorkerConnection.connect(this.factory());
    connection.onClosed = () => workerBridge.detach(connection);
    workerBridge.attach(connection);
    try {
      await connection.request("open", { memoryOnly });
    } catch (error) {
      const message = connection.failedMessage();
      connection.dispose();
      throw message === "" ? error : new Error(message);
    }
    workerBridge.opened(connection);
    configureModel({
      request: (action, model, payload) => connection.request("model", { action, model, payload }),
    });
    return new WorkerStore(connection);
  }
}
