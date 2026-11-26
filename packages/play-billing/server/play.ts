/**
 * @file Google Play subscriptions on the server: what a purchase token says,
 * and the period it grants in `@lightstart/billing`'s ledger.
 *
 * A purchase is handed over by the app right after Play takes it. It is read
 * back from Play, never believed from the request: the product, when it ends,
 * and the account id the app gave Play, which must be the caller's. It is
 * acknowledged, since Play refunds one that is not within three days. A
 * notification from Play (renewed, canceled, on hold, revoked) is read back
 * the same way and moves the end of the period, or takes it back.
 */

import { grantUntil, revokeRef } from "@lightstart/billing/server";
import type { D1Like } from "@lightstart/api/server";

import type { PlayEnv, PlayGrant, PlaySubscription } from "../types.ts";
import { googleAccessToken, serviceAccountOf } from "./google.ts";

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const REVOKED = 12;

type Row = Record<string, unknown>;

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * The account id a person's purchases carry to Play: an HMAC of their id, so
 * Play never learns who they are and a purchase can be tied back to them.
 */
export const accountIdFor = async (userId: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`play:${userId}`)));
};

/**
 * The reference a grant is kept under: a digest of the purchase token, which
 * is too long to be an id and is not needed again once it is read.
 */
export const refOf = async (purchaseToken: string): Promise<string> =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(purchaseToken))).slice(0, 40);

const sqlDate = (iso: string): string => new Date(iso).toISOString().slice(0, 19).replace("T", " ");

/**
 * What a subscription grants: the product, until when, and the account id it
 * was bought under. Null when Play's answer carries no readable line item.
 */
export const grantOf = (sub: PlaySubscription | null): PlayGrant | null => {
  const item = sub?.lineItems?.[0];
  if (!item?.productId || !item.expiryTime || !Number.isFinite(Date.parse(item.expiryTime))) return null;
  return {
    productId: String(item.productId),
    expiresAt: sqlDate(item.expiryTime),
    accountId: String(sub?.externalAccountIdentifiers?.obfuscatedExternalAccountId || ""),
    acknowledged: sub?.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    pending: sub?.subscriptionState === "SUBSCRIPTION_STATE_PENDING",
  };
};

interface Play {
  read(purchaseToken: string): Promise<PlaySubscription | null>;
  acknowledge(productId: string, purchaseToken: string): Promise<void>;
}

const playOf = async (env: PlayEnv, fetchImpl: typeof fetch): Promise<Play | null> => {
  const account = serviceAccountOf(env.PLAY_SERVICE_ACCOUNT_JSON);
  const packageName = String(env.PLAY_PACKAGE_NAME || "");
  if (!account || !packageName) return null;
  const token = await googleAccessToken(account, SCOPE, { fetchImpl });
  const headers = { authorization: `Bearer ${token}` };
  return {
    async read(purchaseToken: string): Promise<PlaySubscription | null> {
      const res = await fetchImpl(`${API}/${packageName}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, { headers });
      return res.ok ? ((await res.json()) as PlaySubscription) : null;
    },
    async acknowledge(productId: string, purchaseToken: string): Promise<void> {
      await fetchImpl(
        `${API}/${packageName}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
        { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: "{}" },
      );
    },
  };
};

/** The fetch an environment sends Google's way: `PLAY_FETCH` when a test injects one, the page's otherwise. */
export const fetchOf = (env: PlayEnv): typeof fetch => (typeof env.PLAY_FETCH === "function" ? env.PLAY_FETCH : fetch);

/**
 * `POST /api/play-purchase`: a purchase the app just made, granted once Play
 * confirms it belongs to the caller.
 */
export const purchaseResponse = async (
  db: D1Like,
  { user, body, env, fetchImpl = fetchOf(env) }: { user: { id?: string } | null; body: Row; env: PlayEnv; fetchImpl?: typeof fetch },
): Promise<Response> => {
  const userId = String(user?.id || "");
  if (!userId) return json({ error: "sign in" }, 401);
  const purchaseToken = String(body["purchaseToken"] || "");
  if (!purchaseToken || purchaseToken.length > 1000) return json({ error: "which purchase?" }, 400);
  const play = await playOf(env, fetchImpl);
  if (!play) return json({ error: "Play is not set up here" }, 503);
  const grant = grantOf(await play.read(purchaseToken));
  if (!grant) return json({ error: "Play does not know this purchase" }, 404);
  if (grant.accountId !== (await accountIdFor(userId, String(env.JWT_SECRET || "")))) return json({ error: "not your purchase" }, 403);
  if (grant.pending) return json({ pending: true });
  const id = await grantUntil(db, { userId, key: grant.productId, source: "play", ref: await refOf(purchaseToken), expiresAt: grant.expiresAt });
  if (!grant.acknowledged) await play.acknowledge(grant.productId, purchaseToken);
  return json({ id, key: grant.productId, expiresAt: grant.expiresAt });
};

/**
 * `GET /api/play-account`: the account id the signed-in person's purchases
 * carry to Play, which the purchase is later checked against.
 */
export const accountResponse = async (userId: string, env: PlayEnv): Promise<Response> => {
  if (!userId) return json({ error: "sign in" }, 401);
  return json({ accountId: await accountIdFor(userId, String(env.JWT_SECRET || "")) });
};

/**
 * `POST /api/play-rtdn`: a notification from Play, pushed by Pub/Sub with the
 * token the push subscription was set up with. A subscription this app never
 * granted is left for the app to hand over.
 */
export const notificationResponse = async (
  db: D1Like,
  { body, token, env, fetchImpl = fetchOf(env) }: { body: Row; token: string; env: PlayEnv; fetchImpl?: typeof fetch },
): Promise<Response> => {
  if (!env.PLAY_RTDN_TOKEN || token !== env.PLAY_RTDN_TOKEN) return json({ error: "not from Play" }, 403);
  let note: { subscriptionNotification?: { notificationType?: number; purchaseToken?: string } } = {};
  try {
    const message = isRecord(body["message"]) ? body["message"] : {};
    const data = typeof message["data"] === "string" ? message["data"] : "";
    const parsed: unknown = JSON.parse(atob(data));
    note = isRecord(parsed) ? parsed : {};
  } catch {
    return json({ ignored: true });
  }
  const purchaseToken = String(note.subscriptionNotification?.purchaseToken || "");
  if (!purchaseToken) return json({ ignored: true });
  const ref = await refOf(purchaseToken);
  const row = await db.prepare("SELECT userId, key FROM entitlement WHERE id = ?").bind(`play:${ref}`).first();
  if (row === null) return json({ ignored: true });
  if (note.subscriptionNotification?.notificationType === REVOKED) {
    await revokeRef(db, { source: "play", ref });
    return json({ revoked: true });
  }
  const play = await playOf(env, fetchImpl);
  if (!play) return json({ error: "Play is not set up here" }, 503);
  const grant = grantOf(await play.read(purchaseToken));
  if (!grant) return json({ ignored: true });
  await grantUntil(db, { userId: String(row["userId"]), key: String(row["key"]), source: "play", ref, expiresAt: grant.expiresAt });
  return json({ expiresAt: grant.expiresAt });
};
