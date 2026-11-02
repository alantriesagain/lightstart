/**
 * @file One request as a handler sees it. The method, the path and the raw query are split off the
 * target once, when the context is made; everything else is read when asked for: a header through
 * the adapter, the query parsed at the first `query()`, the body read once (as text, bytes or JSON)
 * and kept, the URL assembled from the protocol and the host, the Fetch `Request` built only for a
 * handler that wants one. The router writes the matched pattern and the path parameters; a
 * middleware hands values to the handler through `set` and `get` with a `Key`; a proxy plugin
 * replaces the protocol, the host and the address with what a trusted proxy forwarded. Cookies,
 * the bearer token, the same-origin check, the form body and the accepted type are parsed on their
 * first call and kept for the rest of the request.
 */
import { parseCookies } from "./cookies.ts";
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

const formDecode = (part: string): string => {
  const plain = part.indexOf("+") < 0 ? part : part.replaceAll("+", " ");
  if (plain.indexOf("%") < 0) return plain;
  try {
    return decodeURIComponent(plain);
  } catch {
    throw new HttpError(400, "malformed form body");
  }
};

const digit = (code: number): boolean => code >= 48 && code <= 57;

const validPort = (port: string): boolean => {
  if (port === "") return false;
  for (let i = 0; i < port.length; i++) if (!digit(port.charCodeAt(i))) return false;
  return true;
};

const authorityOf = (origin: string): string | null => {
  const split = origin.indexOf("://");
  if (split <= 0) return null;
  const scheme = origin.slice(0, split).toLowerCase();
  if (scheme !== "http" && scheme !== "https") return null;
  const rest = origin.slice(split + 3);
  if (rest === "") return null;
  if (rest.indexOf("/") >= 0 || rest.indexOf("?") >= 0 || rest.indexOf("#") >= 0 || rest.indexOf("@") >= 0) return null;
  let host = rest;
  let port = "";
  if (rest.startsWith("[")) {
    const end = rest.indexOf("]");
    if (end < 0) return null;
    host = rest.slice(0, end + 1);
    const after = rest.slice(end + 1);
    if (after !== "") {
      if (!after.startsWith(":")) return null;
      port = after.slice(1);
      if (port === "") return null;
    }
  } else {
    const colon = rest.lastIndexOf(":");
    if (colon >= 0) {
      host = rest.slice(0, colon);
      port = rest.slice(colon + 1);
      if (port === "") return null;
    }
    for (let i = 0; i < host.length; i++)
      if (host[i] === "%") return null;
  }
  if (host === "") return null;
  if (port !== "" && !validPort(port)) return null;
  const lower = host.toLowerCase();
  return port === "" ? lower : lower + ":" + port;
};

class AcceptRange {
  readonly type: string;
  readonly subtype: string;
  readonly q: number;
  readonly specific: number;

  constructor(type: string, subtype: string, q: number, specific: number) {
    this.type = type;
    this.subtype = subtype;
    this.q = q;
    this.specific = specific;
  }
}

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
  private cookiesRead: Map<string, string> | null = null;
  private bearerDone = false;
  private bearerToken: string | null = null;
  private sameOriginRead: boolean | null = null;
  private formRead: Promise<Map<string, string[]>> | null = null;
  private acceptRanges: AcceptRange[] | null = null;
  private slots: Slots | null = null;
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

  /** The value of the cookie `name`, or null: the `Cookie` header parsed on the first call. */
  cookie(name: string): string | null {
    const all = this.cookies();
    const value = all.get(name);
    return value === undefined ? null : value;
  }

  /** Every cookie of the request, the first occurrence of a name winning; parsed once. */
  cookies(): Map<string, string> {
    if (this.cookiesRead === null) this.cookiesRead = parseCookies(this.header("cookie"));
    return this.cookiesRead;
  }

  /** The token of an `Authorization: Bearer <token>` header, trimmed, or null. */
  bearer(): string | null {
    if (!this.bearerDone) {
      this.bearerDone = true;
      const header = this.header("authorization");
      if (header !== null) {
        let at = -1;
        for (let i = 0; i < header.length; i++) {
          const code = header.charCodeAt(i);
          if (code === 32 || code === 9) {
            at = i;
            break;
          }
        }
        if (at > 0 && header.slice(0, at).toLowerCase() === "bearer") {
          const token = header.slice(at + 1).trim();
          if (token !== "") this.bearerToken = token;
        }
      }
    }
    return this.bearerToken;
  }

  /** Whether the request is same-origin or came from no browser: `Sec-Fetch-Site`, then `Origin` against `host`. */
  sameOrigin(): boolean {
    if (this.sameOriginRead !== null) return this.sameOriginRead;
    this.sameOriginRead = this.isSameOrigin();
    return this.sameOriginRead;
  }

  private isSameOrigin(): boolean {
    const site = this.header("sec-fetch-site");
    if (site !== null) {
      const value = site.trim().toLowerCase();
      return value === "same-origin" || value === "none";
    }
    const origin = this.header("origin");
    if (origin === null) return true;
    const value = origin.trim();
    if (value.toLowerCase() === "null") return false;
    const authority = authorityOf(value);
    return authority !== null && authority === this.host.toLowerCase();
  }

  /** The urlencoded form body, every value of a repeated name in order; read once, within `limit`. */
  form(): Promise<Map<string, string[]>> {
    if (this.formRead === null) this.formRead = this.readForm();
    return this.formRead;
  }

  private async readForm(): Promise<Map<string, string[]>> {
    const header = this.header("content-type");
    if (header === null) throw new HttpError(415, "expected an application/x-www-form-urlencoded body");
    const semi = header.indexOf(";");
    const media = (semi < 0 ? header : header.slice(0, semi)).trim().toLowerCase();
    if (media !== "application/x-www-form-urlencoded") throw new HttpError(415, "expected an application/x-www-form-urlencoded body");
    const body = await this.text();
    const out = new Map<string, string[]>();
    let start = 0;
    while (start < body.length) {
      let end = body.indexOf("&", start);
      if (end < 0) end = body.length;
      if (end > start) {
        const eq = body.indexOf("=", start);
        let name: string;
        let value: string;
        if (eq < 0 || eq > end) {
          name = formDecode(body.slice(start, end));
          value = "";
        } else {
          name = formDecode(body.slice(start, eq));
          value = formDecode(body.slice(eq + 1, end));
        }
        const values = out.get(name);
        if (values === undefined) out.set(name, [value]);
        else values.push(value);
      }
      start = end + 1;
    }
    return out;
  }

  /** The best of `types` for the `Accept` header, or null; the first type when there is no header. */
  accepts(...types: string[]): string | null {
    if (types.length === 0) return null;
    if (this.header("accept") === null) return types[0]!;
    const ranges = this.parsedAccept();
    let best: string | null = null;
    let bestQ = 0;
    let bestSpecific = -1;
    for (const candidate of types) {
      const lower = candidate.trim().toLowerCase();
      const slash = lower.indexOf("/");
      if (slash <= 0 || slash === lower.length - 1) continue;
      const type = lower.slice(0, slash);
      const subtype = lower.slice(slash + 1);
      let matchQ = 0;
      let matchSpecific = -1;
      for (const range of ranges) {
        if ((range.type === "*" || range.type === type) && (range.subtype === "*" || range.subtype === subtype)) {
          if (range.q > matchQ || (range.q === matchQ && range.specific > matchSpecific)) {
            matchQ = range.q;
            matchSpecific = range.specific;
          }
        }
      }
      if (matchQ <= 0) continue;
      if (matchQ > bestQ || (matchQ === bestQ && matchSpecific > bestSpecific)) {
        best = candidate;
        bestQ = matchQ;
        bestSpecific = matchSpecific;
      }
    }
    return best;
  }

  private parsedAccept(): AcceptRange[] {
    if (this.acceptRanges !== null) return this.acceptRanges;
    const ranges: AcceptRange[] = [];
    const header = this.header("accept");
    if (header !== null) {
      for (const item of header.split(",")) {
        const parts = item.split(";");
        const media = parts[0]!.trim().toLowerCase();
        const slash = media.indexOf("/");
        if (slash <= 0 || slash === media.length - 1) continue;
        const type = media.slice(0, slash);
        const subtype = media.slice(slash + 1);
        if (type.indexOf("*") >= 0 && type !== "*") continue;
        if (subtype.indexOf("*") >= 0 && subtype !== "*") continue;
        if (type === "*" && subtype !== "*") continue;
        let q = 1;
        for (let i = 1; i < parts.length; i++) {
          const parameter = parts[i]!.trim();
          const eq = parameter.indexOf("=");
          if (eq < 0) continue;
          if (parameter.slice(0, eq).trim().toLowerCase() !== "q") continue;
          const n = Number(parameter.slice(eq + 1).trim());
          q = Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0;
        }
        let specific = 2;
        if (type === "*") specific = 0;
        else if (subtype === "*") specific = 1;
        ranges.push(new AcceptRange(type, subtype, q, specific));
      }
    }
    this.acceptRanges = ranges;
    return ranges;
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
    if (this.slots === null) return undefined;
    return this.slots.read(key.id) as T | undefined;
  }

  /** Sets the value of `key` for the rest of this request. */
  set<T>(key: Key<T>, value: T): void {
    if (this.slots === null) this.slots = new Slots();
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
