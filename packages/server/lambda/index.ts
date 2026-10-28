/**
 * @file The AWS Lambda adapter, for API Gateway HTTP APIs and Lambda function URLs (the version 2.0
 * event): `export const handler = toLambda(app)`. The event's method, raw path and query, headers,
 * cookies, source address and body (base64 when the event says so) become the `Incoming`; the
 * reply becomes the result object, a whole body as text or, when it is bytes, base64, a streamed
 * body collected first, every `set-cookie` in `cookies`. Lambda freezes the process once the
 * handler returns, so the work handed to `waitUntil` is awaited before the result goes back. It
 * reaches nothing of the core but its public entry, which is all an adapter of another package
 * needs; it runs on Lambda's node runtime and uses node's `Buffer` for base64.
 */
import { Context, HttpError, Incoming, Reply, Writer, type App } from "../index.ts";

/** The version 2.0 event API Gateway and function URLs send. */
export interface LambdaEvent {
  rawPath: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  cookies?: string[];
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: {
    domainName?: string;
    http: { method: string; sourceIp?: string };
  };
}

/** What the handler answers API Gateway or the function URL with. */
export interface LambdaResult {
  statusCode: number;
  headers: Record<string, string>;
  cookies: string[];
  body: string;
  isBase64Encoded: boolean;
}

const tooLarge = (limit: number): HttpError => new HttpError(413, "the body is larger than " + String(limit) + " bytes");

export class LambdaIncoming extends Incoming {
  readonly event: LambdaEvent;
  readonly pending: Promise<void>[] = [];
  private readonly controller = new AbortController();
  private readonly names: string[] = [];
  private readonly values: string[] = [];

  constructor(event: LambdaEvent) {
    super();
    this.event = event;
    const headers = event.headers ?? {};
    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      this.names.push(name.toLowerCase());
      this.values.push(value);
    }
    const cookies = event.cookies ?? [];
    if (cookies.length > 0 && this.names.indexOf("cookie") < 0) {
      this.names.push("cookie");
      this.values.push(cookies.join("; "));
    }
  }

  method(): string {
    return this.event.requestContext.http.method.toUpperCase();
  }

  target(): string {
    const query = this.event.rawQueryString ?? "";
    return query === "" ? this.event.rawPath : this.event.rawPath + "?" + query;
  }

  header(name: string): string | null {
    let out: string | null = null;
    for (let i = 0; i < this.names.length; i++) if (this.names[i] === name) out = out === null ? this.values[i]! : out + ", " + this.values[i]!;
    return out;
  }

  headerPairs(): string[] {
    const out: string[] = [];
    for (let i = 0; i < this.names.length; i++) {
      out.push(this.names[i]!);
      out.push(this.values[i]!);
    }
    return out;
  }

  private body(): Buffer {
    const body = this.event.body ?? "";
    return Buffer.from(body, this.event.isBase64Encoded === true ? "base64" : "utf8");
  }

  async text(limit: number): Promise<string> {
    const body = this.body();
    if (body.length > limit) throw tooLarge(limit);
    return body.toString("utf8");
  }

  async bytes(limit: number): Promise<Uint8Array> {
    const body = this.body();
    if (body.length > limit) throw tooLarge(limit);
    return body;
  }

  remoteAddress(): string {
    return this.event.requestContext.http.sourceIp ?? "";
  }

  override host(): string {
    return this.header("host") ?? this.event.requestContext.domainName ?? "";
  }

  protocol(): string {
    return "https";
  }

  signal(): AbortSignal {
    return this.controller.signal;
  }

  waitUntil(work: Promise<void>): void {
    this.pending.push(work);
  }
}

class Collector extends Writer {
  readonly chunks: Buffer[] = [];

  async write(chunk: string | Uint8Array): Promise<void> {
    this.chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : Buffer.from(chunk));
  }
}

const textual = (type: string | null): boolean =>
  type === null || type.startsWith("text/") || type.indexOf("json") >= 0 || type.indexOf("xml") >= 0 || type.indexOf("javascript") >= 0 || type.startsWith("application/x-www-form-urlencoded");

const bodyOf = async (reply: Reply): Promise<Buffer | string> => {
  if (reply.text !== null) return reply.text;
  if (reply.bytes !== null) return Buffer.from(reply.bytes);
  if (reply.stream !== null) {
    const out = new Collector();
    await reply.stream(out);
    return Buffer.concat(out.chunks);
  }
  if (reply.response !== null) return Buffer.from(await reply.response.arrayBuffer());
  return "";
};

/** `reply` as Lambda's result object. */
export const toResult = async (reply: Reply, method: string): Promise<LambdaResult> => {
  const headers: Record<string, string> = {};
  const cookies: string[] = [];
  const names: string[] = [];
  const values: string[] = [];
  if (reply.response !== null) for (const [name, value] of reply.response.headers) {
    names.push(name);
    values.push(value);
  }
  for (let i = 0; i < reply.headers.names.length; i++) {
    names.push(reply.headers.names[i]!);
    values.push(reply.headers.values[i]!);
  }
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    if (name === "set-cookie") cookies.push(values[i]!);
    else headers[name] = headers[name] === undefined ? values[i]! : headers[name] + ", " + values[i]!;
  }
  const status = reply.response !== null ? reply.response.status : reply.status;
  const body = method === "HEAD" ? "" : await bodyOf(reply);
  if (typeof body === "string") return { statusCode: status, headers, cookies, body, isBase64Encoded: false };
  if (textual(headers["content-type"] ?? null)) return { statusCode: status, headers, cookies, body: body.toString("utf8"), isBase64Encoded: false };
  return { statusCode: status, headers, cookies, body: body.toString("base64"), isBase64Encoded: true };
};

/** A Lambda handler for `app`, answering once the work handed to `waitUntil` is done. */
export const toLambda = (app: App) => {
  app.build();
  return async (event: LambdaEvent): Promise<LambdaResult> => {
    const incoming = new LambdaIncoming(event);
    const c = new Context(incoming);
    const reply = await app.dispatch(c);
    const result = await toResult(reply, c.method);
    await Promise.all(incoming.pending);
    return result;
  };
};
