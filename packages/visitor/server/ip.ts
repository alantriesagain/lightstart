/**
 * @file The address a request came from, with one precedence for every host.
 *
 * Behind a CDN the socket address is the CDN, so the forwarded headers decide,
 * but only where the caller says they can be believed. `CF-Connecting-IP` is
 * read only when the host is Cloudflare (`trusted`): Cloudflare overwrites it
 * at its edge, so a client cannot forge it there. Everywhere else the answer is
 * the `ip` the caller passes from `@lightstart/server`'s `c.ip`, which
 * `TrustProxy` corrects from the headers a trusted peer sent.
 *
 * Raw `X-Forwarded-For` is never believed here. A copy that reads the chain
 * itself is silent when it drifts: it still answers an address, just not always
 * the right one. The check rule `one-client-ip-precedence` keeps this the only
 * file that knows the precedence.
 */

import type { ClientIpOptions, IpRequest } from "./types.ts";

/**
 * The address behind a request.
 *
 * Cloudflare's `CF-Connecting-IP` wins when `trusted` names the host as
 * Cloudflare and the header is not empty. Otherwise the caller's `ip` (from
 * `c.ip`) is the answer; with neither, there is none. `X-Forwarded-For` is
 * never read.
 *
 * @param request a Fetch `Request`, or anything with case-insensitive headers
 * @param options whether Cloudflare is the host, and the address `c.ip` gave
 * @returns the client's address, or null when nothing says what it is
 */
export const clientIp = (request: IpRequest, options: ClientIpOptions = {}): string | null => {
  if (options.trusted) {
    const cf = request.headers.get("cf-connecting-ip");
    const address = cf?.trim();
    if (address) return address;
  }
  const address = options.ip?.trim();
  return address ? address : null;
};
