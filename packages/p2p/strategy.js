/**
 * @file Where a host finds its signalers and relay. `configureP2P`'s
 * `signalers` wins; else the relay alone, from a live `/_relay/info` (the dev
 * server, or a desktop shell proxying one); else nothing, and `pair()` says so
 * rather than reaching for public infrastructure on the app's behalf.
 * Announcing a room to third-party trackers and brokers is a decision a
 * project makes through `configureP2P`, never a default. The guest never
 * resolves: the pairing payload carries the list and the relay URL.
 */

import { appUrl } from "@lightstart/app";
import { hasSubtle } from "./crypto.js";

/** @import { P2PConfig, RelayInfo } from "./types.ts" */

/** @type {P2PConfig} */
let settings = {};

/**
 * Set where this app's host finds its signalers and relay. Replaces the
 * previous settings and drops the cached relay probe.
 * @param {P2PConfig} [next]
 * @returns {P2PConfig}
 */
export const configureP2P = (next = {}) => {
  settings = { ...next };
  relayInfoPromise = null;
  return settings;
};

/** The settings `configureP2P` last took. */
export const p2pConfig = () => ({ ...settings });

/** @type {Promise<RelayInfo | null> | null} */
let relayInfoPromise = null;

/** The dev server's relay description, read through the app's base, or null. */
export const getRelayInfo = () => {
  relayInfoPromise ??= fetch(appUrl("/_relay/info"))
    .then((res) => (res.ok ? /** @type {Promise<RelayInfo>} */ (res.json()) : null))
    .catch(() => null);
  return relayInfoPromise;
};

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * The page is served from this machine: the desktop that hosts, never a phone
 * that joins. RFC 6761 reserves `.localhost` and every subdomain of it for
 * loopback, so a dev profile override (`studio.localhost:3500`) is this
 * machine too and must not be taken for a LAN visitor.
 * @param {string} [hostname]
 * @returns {boolean}
 */
export const isLoopback = (hostname = location.hostname) =>
  LOOPBACK_HOSTS.includes(hostname) || hostname.endsWith(".localhost");

/** `?pair=off` boots the standalone local app, `?pair=guest` forces the guest path (tests, a second desktop). */
export const pairParam = () => new URLSearchParams(location.search).get("pair");

/**
 * @returns {Promise<{ signalers: string[], relayUrl: string | null, origin: string }>}
 */
export const resolveSignalers = async () => {
  const config = settings;
  const info = await getRelayInfo();
  const relayUrl = config.relayUrl ?? (info?.relay ? (info.origins.tunnel ?? info.origins.lan ?? location.origin) : null);
  const origin = relayUrl && !config.relayUrl ? relayUrl : (info?.origins?.tunnel ?? info?.origins?.lan ?? location.origin);
  const wanted = config.signalers ?? (relayUrl ? ["relay"] : []);
  const signalers = wanted.filter((id) => (id === "relay" ? Boolean(relayUrl) : hasSubtle()));
  return { signalers, relayUrl, origin };
};
