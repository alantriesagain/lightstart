/**
 * @file The memory adapter: an app driven with no socket, for tests and for a host that already
 * holds a request's parts. `request(app, method, target, init)` makes the context, dispatches it,
 * waits for the work handed to `waitUntil` (so a test sees it done) and answers the reply;
 * `bodyOf(reply)` reads whichever body the reply carries as text, a stream written to its end;
 * `connect(app, target)` makes an upgrade request and, when a route accepts it, holds the client
 * end of the websocket: what it sends reaches the channel at once, what the channel sends is kept.
 */
import { Context } from "../context.ts";
import { HttpError } from "../errors.ts";
import { HeaderList } from "../headers.ts";
import { Incoming } from "../incoming.ts";
import { Reply, Writer } from "../reply.ts";
import { Channel, Socket } from "../socket.ts";
import type { App } from "../app.ts";

/** A request's parts, every one optional. */
export interface MemoryInit {
  headers?: Record<string, string>;
  body?: string;
  address?: string;
  protocol?: string;
  env?: unknown;
}

const tooLarge = (limit: number): HttpError => new HttpError(413, "the body is larger than " + String(limit) + " bytes");

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

  text(limit: number): Promise<string> {
    if (new TextEncoder().encode(this.body).length > limit) return Promise.reject(tooLarge(limit));
    return Promise.resolve(this.body);
  }

  bytes(limit: number): Promise<Uint8Array> {
    const body = new TextEncoder().encode(this.body);
    if (body.length > limit) return Promise.reject(tooLarge(limit));
    return Promise.resolve(body);
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

  write(chunk: string | Uint8Array): Promise<void> {
    this.chunks.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
    return Promise.resolve();
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

/** The server end of a memory websocket: what it sends lands in its client's lists. */
class MemorySocket extends Socket {
  readonly client: MemoryClient;
  readonly channel: Channel;

  constructor(client: MemoryClient, channel: Channel) {
    super();
    this.client = client;
    this.channel = channel;
  }

  send(data: string | Uint8Array): void {
    if (this.closed) return;
    if (typeof data === "string") this.client.received.push(data);
    else this.client.receivedBytes.push(data);
  }

  close(code = 1000, reason = ""): void {
    if (this.closed) return;
    this.closed = true;
    this.client.code = code;
    this.client.reason = reason;
    this.channel.close(this, code, reason);
  }
}

/** The client end of a websocket `connect` made: `reply` is the upgrade's answer, 101 when a route accepted it. */
export class MemoryClient {
  readonly reply: Reply;
  readonly received: string[] = [];
  readonly receivedBytes: Uint8Array[] = [];
  /** The close code once closed by either end, 0 while open. */
  code = 0;
  reason = "";
  private socket: MemorySocket | null = null;

  constructor(reply: Reply) {
    this.reply = reply;
    const channel = reply.channel;
    if (channel === null) return;
    const socket = new MemorySocket(this, channel);
    this.socket = socket;
    channel.open(socket);
  }

  /** Whether the upgrade was accepted and neither end has closed. */
  get open(): boolean {
    return this.socket !== null && !this.socket.closed;
  }

  /** A text message for a string, a binary one for bytes, delivered to the channel before this returns. */
  send(data: string | Uint8Array): void {
    const socket = this.socket;
    if (socket === null || socket.closed) return;
    if (typeof data === "string") socket.channel.message(socket, data);
    else socket.channel.binary(socket, data);
  }

  close(code = 1000, reason = ""): void {
    const socket = this.socket;
    if (socket !== null) socket.close(code, reason);
  }
}

/** Makes the upgrade request `target` to `app`: the client end of the websocket, `open` when a route accepted it. */
export const connect = async (app: App, target: string, init: MemoryInit = {}): Promise<MemoryClient> => {
  const incoming = new MemoryIncoming("GET", target, init);
  incoming.headers.default("upgrade", "websocket");
  incoming.headers.default("connection", "Upgrade");
  incoming.headers.default("sec-websocket-version", "13");
  incoming.headers.default("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==");
  return new MemoryClient(await app.dispatch(new Context(incoming)));
};
