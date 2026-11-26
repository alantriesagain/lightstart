/**
 * @file Salted, truncated SHA-256, and the visitor identity built from it.
 *
 * `hashIp` is the digest a per-install store keys a pseudonym on. The salt is
 * what stops it being a lookup table: an unsalted SHA-256 of an IPv4 address
 * has 2^32 preimages, and the rows it keys may be public-read. It is also what
 * makes the same person on two installs two unrelated ids.
 *
 * `visitorId` counts people instead of hits. Its window term comes from the
 * moment being recorded rather than from now, so replaying an archived log
 * reproduces the ids it produced the first time.
 *
 * Web Crypto only, so one copy runs in node, a Worker and a browser tab.
 */

import type { Visit, VisitorWindow } from "./types.ts";

/** The windows `visitorId` derives over, widest correlation last. */
export const VISITOR_WINDOWS: readonly VisitorWindow[] = ["off", "daily", "monthly", "persistent", "client"];

/**
 * SHA-256 of `input`, truncated to `bytes` and rendered hex.
 *
 * 16 bytes is the house length: 128 bits is past any birthday collision a log
 * can reach, and half the column of a full digest.
 *
 * @param input the text to digest
 * @param bytes how many leading digest bytes to keep
 * @returns the lowercase hex digest
 */
export const hashHex = async (input: string, bytes = 16): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].slice(0, bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * A per-install pseudonym for one address. The salt is what stops the digest
 * being a lookup table, and what makes the same person on two installs two
 * unrelated ids.
 *
 * @param salt the install's own salt, never empty in production
 * @param ip the address, or null when the request had none
 * @returns the digest a row carries in place of the address
 */
export const hashIp = (salt: string, ip: string | null | undefined): Promise<string> => hashHex(`${salt}:${ip || "unknown"}`);

/**
 * The window term for a moment. `persistent` has none, which is what makes it
 * persistent; `client` falls back to the daily term when the visitor sent no id
 * of their own.
 *
 * @param window how long two requests count as one visitor
 * @param at the moment being recorded
 * @returns the date, month, or empty term the digest includes
 */
export const periodFor = (window: VisitorWindow, at: Date | number | string): string => {
  if (window === "persistent") return "";
  const iso = new Date(at).toISOString();
  return window === "monthly" ? iso.slice(0, 7) : iso.slice(0, 10);
};

/**
 * The id two requests share when they count as one visitor, or null when the
 * install asked for no visitor identity at all.
 *
 * A `clientId` the visitor's own device minted is hashed like everything else:
 * the column then holds no value a reader could have taken from a browser, and
 * every id in it is the same width.
 *
 * @param salt the install's own salt
 * @param visit the moment, address, user agent and optional device id
 * @returns the shared id, or null for `window: "off"`
 */
export const visitorId = async (salt: string, { window = "daily", ip, userAgent = "", at, clientId }: Visit): Promise<string | null> => {
  if (window === "off") return null;
  if (window === "client" && clientId) return hashHex(`${salt}:visitor:client:${clientId}`);
  return hashHex(`${salt}:visitor:${periodFor(window, at)}:${ip || "unknown"}:${userAgent}`);
};
