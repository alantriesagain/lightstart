/**
 * @file The memory adapter: an app driven with no socket, for tests and for a host that already
 * holds a request's parts. `request(app, method, target, init)` makes the context, dispatches it,
 * waits for the work handed to `waitUntil` (so a test sees it done) and answers the reply;
 * `bodyOf(reply)` reads whichever body the reply carries as text, a stream written to its end.
 */
import { Context } from "../context.ts";
import { HttpError } from "../errors.ts";
import { HeaderList } from "../headers.ts";
import { Incoming } from "../incoming.ts";
import { Reply, Writer } from "../reply.ts";
import type { App } from "../app.ts";

/** A request's parts, every one optional. */
export interface MemoryInit {
  headers?: Record<string, string>;
  body?: string;
  address?: string;
  protocol?: string;
  env?: unknown;
}

export class MemoryIncoming extends Incoming {
  private readonly verb: string;
  private readonly url: string;
  readonly headers = new HeaderList();
  private readonly body: string;
  private readonly address: string;
  private readonly scheme: string;
  private readonly bindings: unknown;
  readonly pending: Promise<void>[] = [];
  readonly controller = new AbortController();

  constructor(method: string, target: string, init: MemoryInit) {
    super();
    this.verb = method.toUpperCase();
    this.url = target;
    const headers = init.headers ?? {};
    for (const [name, value] of Object.entries(headers)) this.headers.append(name, value);
    this.body = init.body ?? "";
    this.address = init.address ?? "127.0.0.1";
    this.scheme = init.protocol ?? "http";
    this.bindings = init.env ?? null;
    if (this.body !== "" && !this.headers.has("content-length")) this.headers.append("content-length", String(new TextEncoder().encode(this.body).length));
  }

  method(): string {
    return this.verb;
  }

  target(): string {
    return this.url;
  }

  header(name: string): string | null {
    return this.headers.get(name);
  }

  headerPairs(): string[] {
    return this.headers.flat();
  }

  async text(limit: number): Promise<string> {
    if (new TextEncoder().encode(this.body).length > limit) throw new HttpError(413, "the body is larger than " + String(limit) + " bytes");
    return this.body;
  }

  async bytes(limit: number): Promise<Uint8Array> {
    const body = new TextEncoder().encode(this.body);
    if (body.length > limit) throw new HttpError(413, "the body is larger than " + String(limit) + " bytes");
    return body;
  }

  remoteAddress(): string {
    return this.address;
  }

  protocol(): string {
    return this.scheme;
  }

  signal(): AbortSignal {
    return this.controller.signal;
  }

  override env(): unknown {
    return this.bindings;
  }

  waitUntil(work: Promise<void>): void {
    this.pending.push(work);
  }
}

/** Dispatches one request to `app` and answers its reply once the work it handed to `waitUntil` is done. */
export const request = async (app: App, method: string, target: string, init: MemoryInit = {}): Promise<Reply> => {
  const incoming = new MemoryIncoming(method, target, init);
  const reply = await app.dispatch(new Context(incoming));
  await Promise.all(incoming.pending);
  return reply;
};

class CollectingWriter extends Writer {
  readonly chunks: string[] = [];

  async write(chunk: string | Uint8Array): Promise<void> {
    this.chunks.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
  }
}

/** The reply's body as text, whichever kind it carries: a stream is run to its end. */
export const bodyOf = async (reply: Reply): Promise<string> => {
  if (reply.text !== null) return reply.text;
  if (reply.bytes !== null) return new TextDecoder().decode(reply.bytes);
  if (reply.stream !== null) {
    const out = new CollectingWriter();
    await reply.stream(out);
    return out.chunks.join("");
  }
  if (reply.response !== null) return reply.response.text();
  return "";
};
