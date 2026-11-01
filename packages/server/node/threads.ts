/**
 * @file Several cores for the node adapter: `serveThreads` spawns workers the app names, waits for
 * each to listen on one explicit port with kernel-balanced `reusePort`, and closes them together;
 * `serveWorker` is the worker side, serving an app on that port and answering the primary's
 * settings, fallback and close messages. The primary never listens. The app writes the spawn
 * because scriptc needs `new Worker(new URL("./worker.ts", import.meta.url))` in its own module,
 * a URL handed to a library refused with SC2020. Where the kernel has no balanced `reusePort`
 * (`ENOTSUP` or `EOPNOTSUPP`, as on macOS) one worker serves without it, and a warning says so.
 * Messages are plain records: a class instance loses its methods across threads.
 */
import { Worker, parentPort, workerData } from "node:worker_threads";
import { serve, type NodeServer } from "./index.ts";
import type { App } from "../app.ts";
import type { SocketOptions } from "./socket.ts";

/** What `serveThreads` starts: the explicit port, how many workers listen, and how to stop them. */
export interface ThreadsServer {
  readonly port: number;
  readonly threads: number;
  close(): Promise<void>;
}

/** The primary's settings: an explicit port, the workers to spawn, and the app's own `spawn`. */
export interface ThreadsOptions {
  port: number;
  host?: string;
  threads: number;
  spawn: (index: number) => Worker;
  grace?: number;
  signals?: boolean;
}

/** What a worker serves, read from its options, `workerData`, or the primary's `serve` message. */
export interface ServeWorkerOptions {
  port?: number;
  host?: string;
  sockets?: SocketOptions;
  grace?: number;
}

interface WorkerSettings {
  port: number;
  hostName: string | undefined;
  sockets: SocketOptions | null;
  grace: number;
}

interface SettingsRecord {
  port?: unknown;
  hostName?: unknown;
  host?: unknown;
  grace?: unknown;
  sockets?: unknown;
}

interface MessageRecord extends SettingsRecord {
  type?: unknown;
  code?: unknown;
  message?: unknown;
}

const codeOf = (error: unknown): string => {
  if (typeof error === "object" && error !== null) {
    const record = error as { code?: unknown };
    if (typeof record.code === "string") return record.code;
  }
  return "";
};

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const settingsOf = (record: SettingsRecord): WorkerSettings | null => {
  const port = typeof record.port === "number" ? record.port : 0;
  if (port <= 0) return null;
  const hostName = typeof record.hostName === "string" ? record.hostName : typeof record.host === "string" ? record.host : undefined;
  const grace = typeof record.grace === "number" ? record.grace : 10000;
  const sockets = typeof record.sockets === "object" && record.sockets !== null ? (record.sockets as SocketOptions) : null;
  return { port, hostName, sockets, grace };
};

class Threads implements ThreadsServer {
  readonly port: number;
  threads = 0;
  private readonly options: ThreadsOptions;
  private readonly grace: number;
  private readonly workers: Worker[] = [];
  private readonly alive: boolean[] = [];
  private remaining = 0;
  private wake: (() => void) | null = null;
  private ready = 0;
  private want: number;
  private fallback = false;
  private chosen = -1;
  private settled = false;
  private closing: Promise<void> | null = null;
  private resolveListen: (() => void) | null = null;
  private rejectListen: ((error: Error) => void) | null = null;

  constructor(options: ThreadsOptions) {
    this.options = options;
    this.port = options.port;
    this.grace = options.grace ?? 10000;
    this.want = options.threads;
  }

  start(): Promise<void> {
    const listening = new Promise<void>((resolve: () => void, reject: (error: Error) => void) => {
      this.resolveListen = resolve;
      this.rejectListen = reject;
    });
    for (let index = 0; index < this.options.threads; index++) this.spawnOne(index);
    return listening;
  }

  private spawnOne(index: number): void {
    const worker = this.options.spawn(index);
    this.workers.push(worker);
    this.alive.push(true);
    this.remaining++;
    worker.on("message", (message: unknown) => this.receive(index, message));
    worker.on("error", (error: Error) => this.error(index, error));
    worker.on("exit", (_code: number) => this.exited(index));
    const record: MessageRecord = { type: "serve", port: this.options.port, grace: this.grace };
    if (this.options.host !== undefined) record.hostName = this.options.host;
    worker.postMessage(record);
  }

  private receive(index: number, message: unknown): void {
    if (typeof message !== "object" || message === null) return;
    const record = message as MessageRecord;
    const type = typeof record.type === "string" ? record.type : "";
    if (this.fallback && index !== this.chosen) return;
    if (type === "listening") {
      this.ready++;
      if (this.ready >= this.want) this.succeed();
      return;
    }
    if (type === "listen-error") {
      const code = typeof record.code === "string" ? record.code : "";
      const detail = typeof record.message === "string" ? record.message : "listen failed";
      if (!this.fallback && (code === "ENOTSUP" || code === "EOPNOTSUPP")) {
        this.enterFallback(index);
        return;
      }
      this.fail(new Error("worker " + String(index) + " could not listen (" + code + "): " + detail));
    }
  }

  private enterFallback(index: number): void {
    this.fallback = true;
    this.chosen = index;
    this.want = 1;
    this.ready = 0;
    console.warn("[server] reusePort is not available here: serving on one thread without it");
    for (let i = 0; i < this.workers.length; i++) {
      if (i === index) continue;
      if (this.alive[i] === true) void this.workers[i]!.terminate();
    }
    const record: MessageRecord = { type: "fallback", port: this.options.port, grace: this.grace };
    if (this.options.host !== undefined) record.hostName = this.options.host;
    this.workers[index]!.postMessage(record);
  }

  private succeed(): void {
    if (this.settled) return;
    this.settled = true;
    this.threads = this.fallback ? 1 : this.want;
    if (this.resolveListen !== null) this.resolveListen();
  }

  private fail(error: Error): void {
    if (this.settled) return;
    this.settled = true;
    for (let i = 0; i < this.workers.length; i++) {
      if (this.alive[i] === true) void this.workers[i]!.terminate();
    }
    if (this.rejectListen !== null) this.rejectListen(error);
  }

  private error(index: number, error: Error): void {
    if (this.fallback && index !== this.chosen) return;
    if (this.settled) console.error("[server] worker " + String(index) + " failed: " + error.message);
    this.fail(error);
  }

  private exited(index: number): void {
    if (this.alive[index] !== true) return;
    this.alive[index] = false;
    this.remaining--;
    if (this.remaining === 0 && this.wake !== null) this.wake();
    if (!this.settled && !(this.fallback && index !== this.chosen)) {
      this.fail(new Error("worker " + String(index) + " exited before listening"));
    }
  }

  close(): Promise<void> {
    if (this.closing !== null) return this.closing;
    this.closing = this.stop();
    return this.closing;
  }

  private async stop(): Promise<void> {
    for (let i = 0; i < this.workers.length; i++) {
      if (this.alive[i] === true) this.workers[i]!.postMessage({ type: "close" });
    }
    const drained = this.remaining === 0
      ? Promise.resolve()
      : new Promise<void>((resolve: () => void) => {
          this.wake = resolve;
        });
    const timeout = new Promise<void>((resolve: () => void) => {
      const timer = setTimeout(() => resolve(), this.grace);
      timer.unref();
    });
    await Promise.race([drained, timeout]);
    for (let i = 0; i < this.workers.length; i++) {
      if (this.alive[i] === true) await this.workers[i]!.terminate();
    }
  }
}

/** Spawns `threads` workers on one explicit port through the app's `spawn`, and resolves once each listens. */
export const serveThreads = async (options: ThreadsOptions): Promise<ThreadsServer> => {
  if (!Number.isInteger(options.threads) || options.threads < 1) throw new Error("serveThreads needs a thread count of at least 1");
  if (!Number.isInteger(options.port) || options.port <= 0) throw new Error("serveThreads needs an explicit port");
  const threads = new Threads(options);
  await threads.start();
  if (options.signals === true) {
    const stop = (): void => {
      threads.close().then(() => process.exit(0));
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  }
  return threads;
};

/** Serves `app` in a worker on the primary's port with `reusePort`, until its `close` message. */
export const serveWorker = async (app: App, options: ServeWorkerOptions = {}): Promise<void> => {
  const port = parentPort;
  if (port === null) throw new Error("serveWorker runs in a worker thread");
  let server: NodeServer | null = null;
  let starting = false;
  let stopping = false;
  let resolveDone: (() => void) | null = null;
  const done = new Promise<void>((resolve: () => void) => {
    resolveDone = resolve;
  });

  const stop = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    const current = server;
    server = null;
    if (current !== null) await current.close();
    port.postMessage({ type: "closed" });
    port.close();
    if (resolveDone !== null) resolveDone();
  };

  const start = async (settings: WorkerSettings, reusePort: boolean): Promise<void> => {
    if (server !== null || starting || stopping) return;
    starting = true;
    try {
      server = await serve(app, {
        port: settings.port,
        host: settings.hostName,
        sockets: settings.sockets ?? undefined,
        grace: settings.grace,
        reusePort,
      });
      starting = false;
      port.postMessage({ type: "listening" });
    } catch (error) {
      starting = false;
      port.postMessage({ type: "listen-error", code: codeOf(error), message: messageOf(error) });
    }
  };

  port.on("message", (message: unknown) => {
    if (typeof message !== "object" || message === null) return;
    const record = message as MessageRecord;
    const type = typeof record.type === "string" ? record.type : "";
    if (type === "serve") {
      const settings = settingsOf(record);
      if (settings !== null) void start(settings, true);
    } else if (type === "fallback") {
      const settings = settingsOf(record);
      if (settings !== null) void start(settings, false);
    } else if (type === "close") {
      void stop();
    }
  });

  const data = typeof workerData === "object" && workerData !== null ? (workerData as SettingsRecord) : {};
  const combined: SettingsRecord = {
    port: options.port ?? data.port,
    hostName: options.host ?? data.hostName ?? data.host,
    grace: options.grace ?? data.grace,
    sockets: options.sockets ?? data.sockets,
  };
  const initial = settingsOf(combined);
  if (initial !== null) void start(initial, true);
  await done;
};
