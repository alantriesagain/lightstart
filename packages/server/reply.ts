/**
 * @file What a handler answers: a status, a `HeaderList`, and at most one body, each kind in a field
 * of its own so an adapter reads the one that is set without narrowing a union. `text` and `bytes`
 * are whole bodies an adapter frames with a `content-length`; `stream` is written chunk by chunk
 * through a `Writer` (node's `res.write`, a `ReadableStream` on fetch runtimes); `response` is a
 * Fetch `Response` a fetch adapter passes on untouched and the node adapter copies out; `channel`
 * is the websocket an `upgrade` accepts (`socket.ts`). The
 * builders below are how a handler makes one: `return json({ ok: true })`.
 */
import { HeaderList } from "./headers.ts";
import type { Channel } from "./socket.ts";

/**
 * Where a streamed body goes. `write` resolves once the chunk may be followed by the next (node's
 * backpressure); after the client has gone `closed` is true and writes are dropped.
 */
export abstract class Writer {
  closed = false;

  abstract write(chunk: string | Uint8Array): Promise<void>;
}

/** A streamed body: called once with the writer, the body ends when its promise settles. */
export type StreamBody = (out: Writer) => Promise<void>;

export class Reply {
  status: number;
  readonly headers: HeaderList = new HeaderList();
  text: string | null = null;
  bytes: Uint8Array | null = null;
  stream: StreamBody | null = null;
  response: Response | null = null;
  /** The websocket the request becomes, where the adapter takes one (`upgrade(c, channel)`). */
  channel: Channel | null = null;
  /** The route declined the request after its pattern matched: the app answers null, as for a path nothing matches (`pass()`). */
  passed = false;

  constructor(status: number) {
    this.status = status;
  }

  /** Sets a header and answers the reply, so a builder's result can be extended in one expression. */
  header(name: string, value: string): Reply {
    this.headers.set(name, value);
    return this;
  }
}

/** A JSON body: `data` stringified, with `application/json`. `data` is a record or an array, never a class instance. */
export const json = (data: unknown, status = 200): Reply => {
  const reply = new Reply(status);
  reply.headers.append("content-type", "application/json; charset=utf-8");
  reply.text = JSON.stringify(data);
  return reply;
};

/** `{ "error": message }` with `status` and `cache-control: no-store`: a refusal. */
export const fail = (message: string, status: number): Reply => {
  const reply = json({ error: message }, status);
  reply.headers.append("cache-control", "no-store");
  return reply;
};

/** A plain text body. */
export const text = (body: string, status = 200): Reply => {
  const reply = new Reply(status);
  reply.headers.append("content-type", "text/plain; charset=utf-8");
  reply.text = body;
  return reply;
};

/** An HTML body. */
export const html = (body: string, status = 200): Reply => {
  const reply = new Reply(status);
  reply.headers.append("content-type", "text/html; charset=utf-8");
  reply.text = body;
  return reply;
};

/** A body of bytes with the content type given. */
export const bytes = (body: Uint8Array, type: string, status = 200): Reply => {
  const reply = new Reply(status);
  reply.headers.append("content-type", type);
  reply.bytes = body;
  return reply;
};

/** No body: a 204 by default, or a 304, a 201 with a `location`, a HEAD's answer. */
export const empty = (status = 204): Reply => new Reply(status);

/** A redirect to `location`, 302 unless told otherwise. */
export const redirect = (location: string, status = 302): Reply => {
  const reply = new Reply(status);
  reply.headers.append("location", location);
  return reply;
};

/** A streamed body of `type`: the adapter sends the headers, then whatever `body` writes, then ends. */
export const stream = (body: StreamBody, type: string, status = 200): Reply => {
  const reply = new Reply(status);
  reply.headers.append("content-type", type);
  reply.stream = body;
  return reply;
};

/** Server-sent events over a streamed body: `send` writes one event, `comment` a line the client ignores (a keep-alive). */
export class EventSink {
  readonly out: Writer;

  constructor(out: Writer) {
    this.out = out;
  }

  /** Whether the client has gone, after which nothing more is sent. */
  get closed(): boolean {
    return this.out.closed;
  }

  /** One event: its data (each line its own `data:`), and an event name and an id when given. */
  send(data: string, event = "", id = ""): Promise<void> {
    let frame = "";
    if (id !== "") frame += "id: " + id + "\n";
    if (event !== "") frame += "event: " + event + "\n";
    for (const line of data.split("\n")) frame += "data: " + line + "\n";
    return this.out.write(frame + "\n");
  }

  comment(text: string): Promise<void> {
    return this.out.write(": " + text + "\n\n");
  }
}

/**
 * An event stream: `sse(async (events) => { await events.send("hi") })`. Never cached, and marked
 * unbuffered for a proxy in front (nginx's `x-accel-buffering`), so each event reaches the client
 * when it is sent.
 */
export const sse = (body: (events: EventSink) => Promise<void>): Reply => {
  const reply = stream((out: Writer) => body(new EventSink(out)), "text/event-stream; charset=utf-8");
  reply.headers.append("cache-control", "no-cache");
  reply.headers.append("x-accel-buffering", "no");
  return reply;
};

/**
 * A route declining a request its pattern matched, because what it serves is
 * decided per request (a model that may not exist, a file that may not be
 * there): `app.handle` answers null, so a host tries what sits behind the app,
 * and `app.dispatch` answers the not-found reply.
 */
export const pass = (): Reply => {
  const reply = new Reply(404);
  reply.passed = true;
  return reply;
};

/** A Fetch `Response` as a reply: passed on as it is where the adapter speaks Fetch, copied out where it does not. */
export const respond = (response: Response): Reply => {
  const reply = new Reply(response.status);
  reply.response = response;
  return reply;
};
