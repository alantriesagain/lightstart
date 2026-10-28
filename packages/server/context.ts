/**
 * @file One request as a handler sees it. The method, the path and the raw query are split off the
 * target once, when the context is made; everything else is read when asked for: a header through
 * the adapter, the query parsed at the first `query()`, the body read once (as text, bytes or JSON)
 * and kept, the URL assembled from the protocol and the host, the Fetch `Request` built only for a
 * handler that wants one. The router writes the matched pattern and the path parameters; a
 * middleware hands values to the handler through `set` and `get` with a `Key`; a proxy plugin
 * replaces the protocol, the host and the address with what a trusted proxy forwarded.
 */
import { HttpError } from "./errors.ts";
import { Incoming } from "./incoming.ts";
import { Key, Slots } from "./key.ts";
import { Logger } from "./logger.ts";

/** The default most bytes a request body may hold: 1 MiB. */
export const DEFAULT_BODY_LIMIT = 1048576;

const decode = (part: string): string => {
  const plain = part.indexOf("+") < 0 ? part : part.replaceAll("+", " ");
  if (plain.indexOf("%") < 0) return plain;
  try {
    return decodeURIComponent(plain);
  } catch {
    return plain;
  }
};

export class Context {
  readonly incoming: Incoming;
  readonly method: string;
  readonly path: string;
  /** The query as it arrived, without the "?": "" when there is none. */
  readonly search: string;
  /** The route pattern that matched (`/carts/:id`), "" before routing or when none did. */
  route = "";
  /** Where a failure of work after the reply is logged: the app's logger once it handles the request. */
  logger: Logger = new Logger();
  /** The most bytes the body may hold; a plugin or a middleware may raise or lower it before the read. */
  limit = DEFAULT_BODY_LIMIT;
  paramNames: string[] = [];
  paramValues: string[] = [];
  private queryNames: string[] | null = null;
  private queryValues: string[] = [];
  private readonly slots = new Slots();
  private textRead: Promise<string> | null = null;
  private bytesRead: Promise<Uint8Array> | null = null;
  private forwardedProtocol = "";
  private forwardedHost = "";
  private forwardedAddress = "";

  constructor(incoming: Incoming) {
    this.incoming = incoming;
    this.method = incoming.method();
    const target = incoming.target();
    const q = target.indexOf("?");
    this.path = q < 0 ? target : target.slice(0, q);
    this.search = q < 0 ? "" : target.slice(q + 1);
  }

  /** The request header `name`, repeated values joined with ", ", or null. */
  header(name: string): string | null {
    return this.incoming.header(name.toLowerCase());
  }

  /** The path parameter `name` (`:id` in the pattern, `*` for the wildcard's rest), or null. */
  param(name: string): string | null {
    const at = this.paramNames.indexOf(name);
    return at < 0 ? null : this.paramValues[at]!;
  }

  /** The first value of the query parameter `name`, decoded, or null. */
  query(name: string): string | null {
    const names = this.parsedQuery();
    const at = names.indexOf(name);
    return at < 0 ? null : this.queryValues[at]!;
  }

  /** Every value of the query parameter `name`, in order. */
  queryAll(name: string): string[] {
    const names = this.parsedQuery();
    const out: string[] = [];
    for (let i = 0; i < names.length; i++) if (names[i] === name) out.push(this.queryValues[i]!);
    return out;
  }

  private parsedQuery(): string[] {
    if (this.queryNames !== null) return this.queryNames;
    const names: string[] = [];
    let start = 0;
    const search = this.search;
    while (start < search.length) {
      let end = search.indexOf("&", start);
      if (end < 0) end = search.length;
      if (end > start) {
        const eq = search.indexOf("=", start);
        if (eq < 0 || eq > end) {
          names.push(decode(search.slice(start, end)));
          this.queryValues.push("");
        } else {
          names.push(decode(search.slice(start, eq)));
          this.queryValues.push(decode(search.slice(eq + 1, end)));
        }
      }
      start = end + 1;
    }
    this.queryNames = names;
    return names;
  }

  /** "http" or "https": what the client asked for, a trusted proxy's word over the connection's. */
  get protocol(): string {
    return this.forwardedProtocol !== "" ? this.forwardedProtocol : this.incoming.protocol();
  }

  /** The host the client asked for: a trusted proxy's word, else the request's own, else "localhost". */
  get host(): string {
    if (this.forwardedHost !== "") return this.forwardedHost;
    const host = this.incoming.host();
    return host === "" ? "localhost" : host;
  }

  /** The client's address: a trusted proxy's word, else the peer that connected. */
  get ip(): string {
    return this.forwardedAddress !== "" ? this.forwardedAddress : this.incoming.remoteAddress();
  }

  /** The URL the client asked for, as text. */
  get url(): string {
    return this.protocol + "://" + this.host + this.incoming.target();
  }

  /** What a trusted proxy forwarded; an empty string leaves that part as the connection said. */
  forwarded(protocol: string, host: string, address: string): void {
    this.forwardedProtocol = protocol;
    this.forwardedHost = host;
    this.forwardedAddress = address;
  }

  /** The platform's bindings (a Worker's `env`), null where there are none. */
  get env(): unknown {
    return this.incoming.env();
  }

  /** Aborted when the client goes away before the reply is done. */
  get signal(): AbortSignal {
    return this.incoming.signal();
  }

  /** The body as text, read once; a later read answers the same text. */
  text(): Promise<string> {
    if (this.textRead === null)
      this.textRead = this.bytesRead === null ? this.incoming.text(this.limit) : this.bytesRead.then((body: Uint8Array) => new TextDecoder().decode(body));
    return this.textRead;
  }

  /** The body as bytes, read once. */
  bytes(): Promise<Uint8Array> {
    if (this.bytesRead === null)
      this.bytesRead = this.textRead === null ? this.incoming.bytes(this.limit) : this.textRead.then((body: string) => new TextEncoder().encode(body));
    return this.bytesRead;
  }

  /** The body parsed as JSON, `unknown` until narrowed; an empty or malformed body is a 400. */
  async json(): Promise<unknown> {
    const body = await this.text();
    if (body === "") throw new HttpError(400, "expected a JSON body");
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed;
    } catch {
      throw new HttpError(400, "malformed JSON body");
    }
  }

  /** The value a middleware set for `key`, undefined when none did. */
  get<T>(key: Key<T>): T | undefined {
    return this.slots.read(key.id) as T | undefined;
  }

  /** Sets the value of `key` for the rest of this request. */
  set<T>(key: Key<T>, value: T): void {
    this.slots.write(key.id, value);
  }

  /** Hands the platform work that may finish after the reply; a rejection is logged, never answered. */
  waitUntil(work: Promise<unknown>): void {
    const logger = this.logger;
    const what = this.method + " " + this.path + ": work after the reply";
    this.incoming.waitUntil(
      work.then(
        () => {},
        (error: unknown) => {
          logger.error(what, error);
        },
      ),
    );
  }

  /** The request as a Fetch `Request`: the platform's own where it spoke Fetch, else one built with the body read. */
  async request(): Promise<Request> {
    const original = this.incoming.original();
    if (original !== null) return original;
    const headers = new Headers();
    const pairs = this.incoming.headerPairs();
    for (let i = 0; i + 1 < pairs.length; i += 2) headers.append(pairs[i]!, pairs[i + 1]!);
    if (this.method === "GET" || this.method === "HEAD") return new Request(this.url, { method: this.method, headers, signal: this.signal });
    const body = new Uint8Array(await this.bytes());
    return new Request(this.url, { method: this.method, headers, body, signal: this.signal });
  }
}
