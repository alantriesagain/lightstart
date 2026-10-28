/**
 * @file A node `IncomingMessage` as the core's `Incoming`. Headers are read off the parsed record
 * by name; the body is read only when a handler asks, refused with a 413 as soon as its declared
 * length or the bytes received pass the limit (the rest is drained, not kept, so the 413 still
 * reaches the client); the abort signal is made at the first ask and fires when the response
 * closes before it finished, at once when that happened before the ask. The `data` listener types its chunk `Buffer` in TypeScript syntax,
 * the form scriptc lowers.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError } from "../errors.ts";
import { Incoming } from "../incoming.ts";

/** Where the work a request hands to `waitUntil` is counted: the server it arrived on. */
export abstract class WorkTracker {
  abstract track(work: Promise<void>): void;
}

const tooLarge = (limit: number): HttpError => new HttpError(413, "the body is larger than " + String(limit) + " bytes");

const readBody = (req: IncomingMessage, limit: number): Promise<Buffer> =>
  new Promise((resolve: (body: Buffer) => void, reject: (reason: Error) => void) => {
    const declared = req.headers["content-length"];
    if (declared !== undefined && Number(declared) > limit) {
      req.resume();
      reject(tooLarge(limit));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let refused = false;
    req.on("data", (chunk: Buffer) => {
      if (refused) return;
      size += chunk.length;
      if (size > limit) {
        refused = true;
        chunks.length = 0;
        reject(tooLarge(limit));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!refused) resolve(chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks));
    });
    req.on("error", (error: Error) => {
      if (!refused) reject(error);
    });
  });

export class NodeIncoming extends Incoming {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  private readonly tracker: WorkTracker;
  private controller: AbortController | null = null;
  private gone = false;

  constructor(req: IncomingMessage, res: ServerResponse, tracker: WorkTracker) {
    super();
    this.req = req;
    this.res = res;
    this.tracker = tracker;
    res.once("close", () => {
      if (res.writableFinished) return;
      this.gone = true;
      if (this.controller !== null) this.controller.abort();
    });
  }

  method(): string {
    return this.req.method ?? "GET";
  }

  target(): string {
    return this.req.url ?? "/";
  }

  header(name: string): string | null {
    const value = this.req.headers[name];
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.join(", ");
    return null;
  }

  headerPairs(): string[] {
    const raw = this.req.rawHeaders;
    const out: string[] = [];
    for (let i = 0; i + 1 < raw.length; i += 2) {
      out.push(raw[i]!.toLowerCase());
      out.push(raw[i + 1]!);
    }
    return out;
  }

  text(limit: number): Promise<string> {
    return readBody(this.req, limit).then((body: Buffer) => body.toString("utf8"));
  }

  bytes(limit: number): Promise<Uint8Array> {
    return readBody(this.req, limit);
  }

  remoteAddress(): string {
    return this.req.socket.remoteAddress ?? "";
  }

  protocol(): string {
    return "http";
  }

  signal(): AbortSignal {
    if (this.controller !== null) return this.controller.signal;
    const controller = new AbortController();
    this.controller = controller;
    if (this.gone) controller.abort();
    return controller.signal;
  }

  waitUntil(work: Promise<void>): void {
    this.tracker.track(work);
  }
}
