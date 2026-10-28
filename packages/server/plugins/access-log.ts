/**
 * @file One line per request, written when its reply is ready: the method, the path, the status, the
 * milliseconds it took and the client's address (`GET /carts/7 200 1.4ms 203.0.113.9`). The lines
 * go to stdout by default; a `LineSink` subclass sends them elsewhere, a test keeps them.
 */
import type { App } from "../app.ts";
import { Context } from "../context.ts";
import { Key } from "../key.ts";
import { Plugin } from "../plugin.ts";
import { Reply } from "../reply.ts";

export class LineSink {
  write(line: string): void {
    console.log(line);
  }
}

const STARTED = new Key<number>("access log start");

export class AccessLog extends Plugin {
  readonly sink: LineSink;
  /** The clock it measures with, milliseconds; a test fixes it. */
  readonly clock: () => number;

  constructor(sink: LineSink = new LineSink(), clock: () => number = () => performance.now()) {
    super("access-log", []);
    this.sink = sink;
    this.clock = clock;
  }

  setup(app: App): void {
    const clock = this.clock;
    const sink = this.sink;
    app.onRequest((c: Context): Reply | null => {
      c.set(STARTED, clock());
      return null;
    });
    app.onReply((c: Context, reply: Reply): void => {
      const started = c.get(STARTED) ?? clock();
      const status = reply.response !== null ? reply.response.status : reply.status;
      sink.write(c.method + " " + c.path + " " + String(status) + " " + (clock() - started).toFixed(1) + "ms " + c.ip);
    });
  }
}
