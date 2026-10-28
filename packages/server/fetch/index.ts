/**
 * @file The fetch adapter, for every runtime that hands a handler a Fetch `Request` and takes a
 * `Response` back: Cloudflare Workers and Pages (`export default { fetch: toFetch(app) }`), Bun
 * (`Bun.serve({ fetch: toFetch(app) })`), Deno (`Deno.serve((request) => handler(request))`, since
 * Deno's second argument is not an `env`), and any host built on them. The request is read where
 * it lies: headers by name, the body when asked for (counted against the limit as it streams in),
 * the original `Request` handed back to a handler that wants one. Work given to `waitUntil` goes to
 * the platform's (a Worker's `ctx.waitUntil`, which keeps it alive after the reply) and otherwise
 * runs on its own. A reply becomes a `Response`: a whole body as it is, a streamed one through a
 * `ReadableStream`, a `Response` the handler made passed on untouched.
 */
import { Context } from "../context.ts";
import { HttpError } from "../errors.ts";
import { Incoming } from "../incoming.ts";
import { Reply, Writer } from "../reply.ts";
import type { App } from "../app.ts";

/** The slice of a platform's per-request context the adapter uses: a Worker's `ExecutionContext`. */
export interface FetchPlatform {
  waitUntil(work: Promise<unknown>): void;
}

export interface FetchOptions {
  /** The client's address for a request, "" by default: on Workers, `(r) => r.headers.get("cf-connecting-ip") ?? ""`. */
  address?: (request: Request) => string;
}

const tooLarge = (limit: number): HttpError => new HttpError(413, "the body is larger than " + String(limit) + " bytes");

const readAll = async (request: Request, limit: number): Promise<Uint8Array> => {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > limit) throw tooLarge(limit);
  const body = request.body;
  if (body === null) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    if (size > limit) {
      await reader.cancel();
      throw tooLarge(limit);
    }
    chunks.push(next.value);
  }
  if (chunks.length === 1) return chunks[0]!;
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

export class FetchIncoming extends Incoming {
  readonly request: Request;
  private readonly bindings: unknown;
  private readonly platform: FetchPlatform | null;
  private readonly address: string;
  private readonly scheme: string;
  private readonly authority: string;
  private readonly path: string;

  constructor(request: Request, bindings: unknown, platform: FetchPlatform | null, address: string) {
    super();
    this.request = request;
    this.bindings = bindings;
    this.platform = platform;
    this.address = address;
    const url = request.url;
    const colon = url.indexOf(":");
    this.scheme = colon < 0 ? "http" : url.slice(0, colon);
    const start = url.indexOf("//");
    const slash = start < 0 ? -1 : url.indexOf("/", start + 2);
    const query = start < 0 ? -1 : url.indexOf("?", start + 2);
    const end = slash >= 0 ? slash : query >= 0 ? query : url.length;
    this.authority = start < 0 ? "" : url.slice(start + 2, end);
    if (slash >= 0) this.path = url.slice(slash);
    else this.path = query < 0 ? "/" : "/" + url.slice(query);
  }

  method(): string {
    return this.request.method;
  }

  target(): string {
    return this.path;
  }

  header(name: string): string | null {
    return this.request.headers.get(name);
  }

  headerPairs(): string[] {
    const out: string[] = [];
    for (const [name, value] of this.request.headers) {
      out.push(name);
      out.push(value);
    }
    return out;
  }

  async text(limit: number): Promise<string> {
    return new TextDecoder().decode(await readAll(this.request, limit));
  }

  bytes(limit: number): Promise<Uint8Array> {
    return readAll(this.request, limit);
  }

  remoteAddress(): string {
    return this.address;
  }

  override host(): string {
    return this.authority;
  }

  protocol(): string {
    return this.scheme;
  }

  signal(): AbortSignal {
    return this.request.signal;
  }

  override env(): unknown {
    return this.bindings;
  }

  waitUntil(work: Promise<void>): void {
    if (this.platform !== null) this.platform.waitUntil(work);
  }

  override original(): Request | null {
    return this.request;
  }
}

class StreamWriter extends Writer {
  private readonly controller: ReadableStreamDefaultController<Uint8Array>;
  private readonly encoder = new TextEncoder();

  constructor(controller: ReadableStreamDefaultController<Uint8Array>) {
    super();
    this.controller = controller;
  }

  async write(chunk: string | Uint8Array): Promise<void> {
    if (this.closed) return;
    this.controller.enqueue(typeof chunk === "string" ? this.encoder.encode(chunk) : chunk);
  }
}

const bodiless = (method: string, status: number): boolean => method === "HEAD" || status === 204 || status === 304 || (status >= 100 && status < 200);

/** `reply` as the `Response` to a request made with `method`. */
export const toResponse = (reply: Reply, method: string): Response => {
  if (reply.response !== null) return reply.response;
  const headers = new Headers();
  const names = reply.headers.names;
  const values = reply.headers.values;
  for (let i = 0; i < names.length; i++) headers.append(names[i]!, values[i]!);
  const init = { status: reply.status, headers };
  if (bodiless(method, reply.status)) return new Response(null, init);
  if (reply.text !== null) return new Response(reply.text, init);
  if (reply.bytes !== null) return new Response(reply.bytes, init);
  const body = reply.stream;
  if (body === null) return new Response(null, init);
  const writers: StreamWriter[] = [];
  const source = new ReadableStream<Uint8Array>({
    start(controller: ReadableStreamDefaultController<Uint8Array>): void {
      const writer = new StreamWriter(controller);
      writers.push(writer);
      body(writer).then(
        () => {
          if (!writer.closed) controller.close();
        },
        (error: unknown) => {
          if (!writer.closed) controller.error(error);
        },
      );
    },
    cancel(): void {
      for (const writer of writers) writer.closed = true;
    },
  });
  return new Response(source, init);
};

/** A Fetch handler for `app`: `(request, env?, ctx?) => Promise<Response>`, the shape a Worker exports. */
export const toFetch = (app: App, options: FetchOptions = {}) => {
  app.build();
  const address = options.address;
  return async (request: Request, env?: unknown, ctx?: FetchPlatform): Promise<Response> => {
    const incoming = new FetchIncoming(request, env ?? null, ctx ?? null, address === undefined ? "" : address(request));
    const c = new Context(incoming);
    return toResponse(await app.dispatch(c), c.method);
  };
};
