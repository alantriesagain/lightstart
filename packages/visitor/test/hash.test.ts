// node-only
/**
 * @file The salted digest and the visitor identity: one person on two paths in
 * a day is one visitor, the window moves the id, and a client id is hashed
 * rather than stored.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { hashHex, hashIp, periodFor, visitorId } from "../server/hash.ts";

const SALT = "a-salt";

const differs = (name: string, a: string | null, b: string | null): void => ok(name, a !== b);

const main = async (): Promise<void> => {
  const digest = await hashHex("anything");
  ok("hashHex: 16 bytes of hex", /^[0-9a-f]{32}$/.test(digest));
  eq("hashHex: the same input twice is the same digest", digest, await hashHex("anything"));
  ok("hashHex: a byte count other than the default", /^[0-9a-f]{64}$/.test(await hashHex("anything", 32)));

  differs("hashIp: two installs disagree about the same person", await hashIp("salt-a", "1.2.3.4"), await hashIp("salt-b", "1.2.3.4"));
  eq("hashIp: one install agrees with itself", await hashIp(SALT, "1.2.3.4"), await hashIp(SALT, "1.2.3.4"));
  eq("hashIp: a missing address hashes to a value", await hashIp(SALT, null), await hashIp(SALT, "unknown"));
  eq("hashIp: an empty address is the same as a missing one", await hashIp(SALT, ""), await hashIp(SALT, undefined));
  eq(
    "hashIp: the documented digest",
    await hashIp("s", "203.0.113.7"),
    [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("s:203.0.113.7")))].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join(""),
  );

  const at = Date.UTC(2026, 2, 14, 23, 59, 59);
  eq("periodFor: daily is the UTC day", periodFor("daily", at), "2026-03-14");
  eq("periodFor: monthly is the UTC month", periodFor("monthly", at), "2026-03");
  eq("periodFor: persistent has no term", periodFor("persistent", at), "");
  eq("periodFor: client falls back to the daily term", periodFor("client", at), "2026-03-14");

  const visit = { window: "daily" as const, ip: "1.2.3.4", userAgent: "Firefox", at: Date.UTC(2026, 0, 5, 9) };
  eq("visitorId: one person on two paths in one day is one visitor", String(await visitorId(SALT, visit)), String(await visitorId(SALT, { ...visit, at: Date.UTC(2026, 0, 5, 21) })));

  const day = { ip: "1.2.3.4", userAgent: "Firefox", at: Date.UTC(2026, 0, 5) };
  const next = { ...day, at: Date.UTC(2026, 0, 6) };
  differs("visitorId: tomorrow is another visitor under daily", await visitorId(SALT, { ...day, window: "daily" }), await visitorId(SALT, { ...next, window: "daily" }));
  eq("visitorId: but the same under persistent", String(await visitorId(SALT, { ...day, window: "persistent" })), String(await visitorId(SALT, { ...next, window: "persistent" })));

  differs("visitorId: another address is another visitor", await visitorId(SALT, visit), await visitorId(SALT, { ...visit, ip: "4.3.2.1" }));
  differs("visitorId: another user agent is another visitor", await visitorId(SALT, visit), await visitorId(SALT, { ...visit, userAgent: "Chrome" }));
  eq("visitorId: off stores nothing", String(await visitorId(SALT, { window: "off", ip: "1.2.3.4", at: 0 })), "null");

  const first = await visitorId(SALT, { window: "client", ip: "1.2.3.4", at: 0, clientId: "uuid-1" });
  const second = await visitorId(SALT, { window: "client", ip: "9.9.9.9", at: 864e5 * 40, clientId: "uuid-1" });
  eq("visitorId: client follows the device across a changing address", String(first), String(second));
  ok("visitorId: client still stores a digest", /^[0-9a-f]{32}$/.test(String(first)));
  differs("visitorId: client stores a digest, never the id the device sent", first, "uuid-1");
  eq(
    "visitorId: client without an id falls back to daily",
    String(await visitorId(SALT, { window: "client", ip: "1.2.3.4", userAgent: "Firefox", at: 0 })),
    String(await visitorId(SALT, { window: "daily", ip: "1.2.3.4", userAgent: "Firefox", at: 0 })),
  );

  const ids = await Promise.all([
    visitorId(SALT, { ...visit, window: "daily" }),
    visitorId(SALT, { ...visit, window: "monthly" }),
    visitorId(SALT, { ...visit, window: "persistent" }),
  ]);
  ok("visitorId: two windows never collide", new Set(ids).size === 3);

  const line = await hashHex(`${SALT}:line:1767225600|1.2.3.4|/pv?p=/`);
  differs("visitorId: a line id shares no digest with a visitor id", line, await visitorId(SALT, { window: "persistent", ip: "1.2.3.4", at: 0 }));

  done();
};

await main();
