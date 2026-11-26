/**
 * @file The declarations `@lightstart/visitor`'s modules share: the request
 * shape its address reader accepts, how long two requests count as one visitor,
 * and what a bot check answers.
 */

/** A request as far as its address is concerned: anything with case-insensitive headers, such as a Fetch `Request`. */
export interface IpRequest {
  headers: { get(name: string): string | null };
}

/**
 * Where a request arrived, as the caller knows it. `trusted` says the host is
 * Cloudflare, whose edge overwrites `CF-Connecting-IP`; `ip` is
 * `@lightstart/server`'s `c.ip`, which `TrustProxy` has already corrected.
 */
export interface ClientIpOptions {
  trusted?: boolean;
  ip?: string | null;
}

/**
 * How long two requests count as one visitor.
 *
 * `daily` and `monthly` derive the id from the address and user agent within a
 * window, so nothing is written to or read from the visitor's device. `client`
 * is the only value that is, and the only one that carries a consent
 * obligation. `off` stores no visitor identity at all.
 */
export type VisitorWindow = "off" | "daily" | "monthly" | "persistent" | "client";

/** One moment to derive a visitor id for. `at` is the moment being recorded, never now. */
export interface Visit {
  window?: VisitorWindow;
  ip?: string | null;
  userAgent?: string;
  at: Date | number | string;
  /** An id the visitor's own device minted, read only under `window: "client"`. */
  clientId?: string | null;
}

/** Which signal said this was a crawler, or none. */
export interface BotVerdict {
  isBot: boolean;
  reason: "user_agent" | "path" | "both" | null;
}
