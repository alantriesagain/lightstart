/**
 * @file The node adapter, for node and for a binary scriptc compiled (whose `node:http` is its own
 * native server): `serve(app, options)` listens and answers every request with `app.dispatch`.
 * Work handed to `waitUntil` runs after the reply and is counted, so `close()` stops accepting,
 * lets the open connections finish (dropping them once `grace` runs out) and waits for that work;
 * with `signals`, a SIGTERM or SIGINT closes the server that way and exits. A handler that throws
 * past the app's error handler, or a reply that cannot be written, ends that response with a bare
 * 500 or drops the connection once the headers are out. With `sockets`, an upgrade request goes to
 * the app too, and a route's `upgrade(c, channel)` becomes a websocket (`socket.ts`); `close()`
 * closes the open ones 1001 first.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Context } from "../context.ts";
import { Reply } from "../reply.ts";
import { NodeIncoming, WorkTracker } from "./incoming.ts";
import { Sockets, acceptUpgrades, type SocketOptions } from "./socket.ts";
import { writeReply } from "./write.ts";
import type { App } from "../app.ts";

export { MessageIncoming, NodeIncoming, WorkTracker } from "./incoming.ts";
export { NodeSocket, Sockets, UpgradeIncoming, acceptUpgrades, type SocketOptions } from "./socket.ts";
export { NodeCrypto } from "./crypto.ts";
export { NodeWriter, writeReply } from "./write.ts";
export { serveThreads, serveWorker, type ServeWorkerOptions, type ThreadsOptions, type ThreadsServer } from "./threads.ts";

export interface ServeOptions {
  /** The port, 3000 by default; 0 lets the system pick one (read it back as `server.port`). */
  port?: number;
  /** The address to bind, every interface by default. */
  host?: string;
  /** A Unix socket path to listen on instead of a port (Linux and macOS). */
  path?: string;
  /** Let listeners share one explicit port through the kernel's balanced `SO_REUSEPORT` (Linux). */
  reusePort?: boolean;
  /** Close and exit on SIGTERM and SIGINT. */
  signals?: boolean;
  /** Milliseconds `close()` waits for open connections and pending work, 10 seconds by default. */
  grace?: number;
  /** Take websockets: upgrade requests go to the app, with these limits (`{}` for the defaults). */
  sockets?: SocketOptions;
}

const failed = (app: App, res: ServerResponse, error: unknown): void => {
  app.logger.error("the reply could not be written", error);
  if (res.headersSent) {
    res.destroy();
    return;
  }
  const head: string[] = ["content-type", "text/plain; charset=utf-8", "content-length", "14"];
  res.writeHead(500, head);
  res.end("internal error");
};

export class NodeServer extends WorkTracker {
  readonly app: App;
  readonly server: Server;
  /** The port it listens on, 0 on a Unix socket. */
  port = 0;
  /** The websockets it accepted, null unless it takes them. */
  sockets: Sockets | null = null;
  private readonly grace: number;
  private pending = 0;
  private drained: (() => void) | null = null;
  private closing: Promise<void> | null = null;

  constructor(app: App, grace: number) {
    super();
    this.app = app;
    this.grace = grace;
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      this.answer(req, res);
    });
  }

  private answer(req: IncomingMessage, res: ServerResponse): void {
    const c = new Context(new NodeIncoming(req, res, this));
    this.app.dispatch(c).then(
      (reply: Reply) => writeReply(res, reply, c.method).catch((error: unknown) => failed(this.app, res, error)),
      (error: unknown) => failed(this.app, res, error),
    );
  }

  track(work: Promise<void>): void {
    this.pending++;
    work.then(() => {
      this.pending--;
      if (this.pending === 0 && this.drained !== null) this.drained();
    });
  }

  /** Stops accepting, waits for open connections and pending work (at most `grace` ms), and resolves once closed. */
  close(): Promise<void> {
    if (this.closing !== null) return this.closing;
    if (this.sockets !== null) this.sockets.close();
    const server = this.server;
    const grace = this.grace;
    const closed = new Promise<void>((resolve: () => void) => {
      server.close(() => resolve());
      server.closeIdleConnections();
    });
    const work = this.pending === 0
      ? Promise.resolve()
      : new Promise<void>((resolve: () => void) => {
          this.drained = resolve;
        });
    const timeout = new Promise<void>((resolve: () => void) => {
      const timer = setTimeout(() => {
        server.closeAllConnections();
        resolve();
      }, grace);
      timer.unref();
    });
    const closing = Promise.race([Promise.all([closed, work]).then(() => {}), timeout]);
    this.closing = closing;
    return closing;
  }
}

const listening = (node: NodeServer, options: ServeOptions): Promise<void> =>
  new Promise((resolve: () => void, reject: (error: Error) => void) => {
    const server = node.server;
    let listened = false;
    server.once("error", (error: Error) => {
      if (!listened) reject(error);
    });
    const ready = (): void => {
      listened = true;
      if (options.path === undefined) {
        /* @ts-expect-error */
        node.port = server.address().port;
      }
      resolve();
    };
    if (options.path !== undefined) server.listen(options.path, ready);
    else if (options.reusePort === true) {
      if (options.host !== undefined) server.listen({ port: options.port !== undefined ? options.port : 3000, host: options.host, reusePort: true }, ready);
      else server.listen({ port: options.port !== undefined ? options.port : 3000, reusePort: true }, ready);
    } else if (options.host !== undefined) server.listen(options.port ?? 3000, options.host, ready);
    else server.listen(options.port ?? 3000, ready);
  });

/** Listens with `app` and answers once listening. */
export const serve = async (app: App, options: ServeOptions = {}): Promise<NodeServer> => {
  if (options.reusePort === true) {
    if (options.path !== undefined) throw new Error("reusePort cannot be used with path");
    if (options.port === undefined || options.port === 0) throw new Error("reusePort needs an explicit port other than 0");
  }
  app.build();
  const node = new NodeServer(app, options.grace ?? 10000);
  if (options.sockets !== undefined) node.sockets = acceptUpgrades(node.server, app, new Sockets(options.sockets, node));
  await listening(node, options);
  if (options.signals === true) {
    const stop = (): void => {
      node.close().then(() => process.exit(0));
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  }
  return node;
};
