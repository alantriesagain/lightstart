/**
 * @file What a platform hands the core for one request: the seam an adapter fills. The node adapter
 * reads it off an `IncomingMessage`, the fetch adapter off a `Request`, the memory adapter off a
 * test's arguments, and a third-party runtime off whatever it receives. The body is read at most
 * once, as bytes or as text, and only when a handler asks for it; `limit` is the most bytes a body
 * may hold, past which the read throws a 413. `waitUntil` hands the platform work that may finish
 * after the reply: a Worker's `ctx.waitUntil`, the node server's count of pending work, or the
 * memory adapter's list it awaits before answering.
 */
export abstract class Incoming {
  /** The method, upper-cased. */
  abstract method(): string;

  /** The request target as it arrived: the path and the query, `/carts/7?full=1`. */
  abstract target(): string;

  /** The value of the header `name` (lower-cased), repeated values joined with ", ", or null. */
  abstract header(name: string): string | null;

  /** Every header as name, value, name, value, names lower-cased. */
  abstract headerPairs(): string[];

  /** The body as text (UTF-8), "" when there is none. */
  abstract text(limit: number): Promise<string>;

  /** The body as bytes, empty when there is none. */
  abstract bytes(limit: number): Promise<Uint8Array>;

  /** The address of the peer that connected, "" when the platform does not say. */
  abstract remoteAddress(): string;

  /** The host the request names: the `host` header unless the platform knows better (a Fetch URL's authority), "" when nothing says. */
  host(): string {
    return this.header("host") ?? "";
  }

  /** "http" or "https", as the connection itself was made (a proxy in front may say otherwise). */
  abstract protocol(): string;

  /** Aborted when the client goes away before the reply is done. */
  abstract signal(): AbortSignal;

  /** Stops the request's work early, as a timeout does; an adapter that cannot stop it leaves the default (the work runs on, its reply discarded). */
  abort(_reason: string): void {}

  /** The platform's bindings: a Worker's `env`, null where there are none. */
  env(): unknown {
    return null;
  }

  /** Hands over work that may finish after the reply; `work` never rejects (the context logs and swallows). */
  abstract waitUntil(work: Promise<void>): void;

  /** The original Fetch `Request` where the platform spoke Fetch, else null and the context builds one. */
  original(): Request | null {
    return null;
  }
}
