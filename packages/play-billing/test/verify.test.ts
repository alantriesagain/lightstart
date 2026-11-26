// node-only
/**
 * @file Verifying a Play purchase against a fake Play Developer API: a good
 * subscription is granted until the end Play says and acknowledged; one Play
 * does not know, or whose expiry it cannot read, is refused; one made under
 * another account is not yours. Play's real-time notifications then move the
 * end, or take the period back.
 */

import { applySchema } from "@lightstart/light/model/sql-builder";
import { Database } from "@lightstart/sqlite/node";
import { d1Of } from "@lightstart/sqlite/d1";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

import { activeKeys, billingModels, holds, registerBilling } from "@lightstart/billing/server";

import { accountIdFor, grantOf, notificationResponse, purchaseResponse, refOf } from "../server/play.ts";
import type { PlayEnv, PlaySubscription } from "../types.ts";

const pemOf = (bytes: ArrayBuffer): string =>
  `-----BEGIN PRIVATE KEY-----\n${Buffer.from(bytes).toString("base64").match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END PRIVATE KEY-----\n`;

const SECRET = "a-test-secret-that-is-long-enough-for-hs256";

const main = async (): Promise<void> => {
  registerBilling({
    plans: { spot: { amount: 2900, currency: "BRL", periodDays: 30 } },
    providers: { play: {} },
  });

  const keys = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const account = {
    client_email: "play@example.iam.gserviceaccount.com",
    private_key: pemOf(await crypto.subtle.exportKey("pkcs8", keys.privateKey)),
    token_uri: "https://oauth2.googleapis.com/token",
  };
  const env: PlayEnv = {
    PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(account),
    PLAY_PACKAGE_NAME: "app.example",
    PLAY_RTDN_TOKEN: "rtdn-secret",
    JWT_SECRET: SECRET,
  };

  const db = Database.open(":memory:");
  applySchema(db, billingModels);
  const d1 = d1Of(db);

  const calls: Array<{ url: string; method: string }> = [];
  let subscription: PlaySubscription | null = null;

  const google: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: String(init.method ?? "GET") });
    if (url.endsWith("/token")) return new Response(JSON.stringify({ access_token: "ya29.test" }), { headers: { "content-type": "application/json" } });
    if (url.includes("/subscriptionsv2/tokens/")) {
      return subscription === null
        ? new Response("{}", { status: 404 })
        : new Response(JSON.stringify(subscription), { headers: { "content-type": "application/json" } });
    }
    if (url.endsWith(":acknowledge")) return new Response("{}");
    return new Response("{}", { status: 404 });
  };

  const anaAccount = await accountIdFor("ana", SECRET);
  const active = (): PlaySubscription => ({
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    lineItems: [{ productId: "spot", expiryTime: "2999-01-01T00:00:00Z" }],
    externalAccountIdentifiers: { obfuscatedExternalAccountId: anaAccount },
  });

  eq("a person's account id is stable", await accountIdFor("ana", SECRET), anaAccount);
  ok("and names nobody", !anaAccount.includes("ana"));
  ok("another person's differs", (await accountIdFor("bia", SECRET)) !== anaAccount);
  eqn("a purchase token becomes a 40-character reference", (await refOf("a-long-purchase-token")).length, 40);

  subscription = active();
  eq("a subscription reads back as a grant", JSON.stringify(grantOf(subscription)), JSON.stringify({
    productId: "spot",
    expiresAt: "2999-01-01 00:00:00",
    accountId: anaAccount,
    acknowledged: false,
    pending: false,
  }));
  eq("no line item grants nothing", JSON.stringify(grantOf({})), "null");
  eq("an expiry Play cannot read grants nothing", JSON.stringify(grantOf({ lineItems: [{ productId: "spot", expiryTime: "not-a-date" }] })), "null");

  const good = await purchaseResponse(d1, { user: { id: "ana" }, body: { purchaseToken: "tok-good" }, env, fetchImpl: google });
  eqn("a good purchase is granted", good.status, 200);
  eq("and the plan is held", JSON.stringify(await activeKeys(d1, "ana")), JSON.stringify(["spot"]));
  ok("and Play is told, since an unacknowledged purchase is refunded", calls.some((call) => call.url.endsWith(":acknowledge") && call.method === "POST"));
  calls.length = 0;
  subscription = { ...active(), acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" };
  await purchaseResponse(d1, { user: { id: "ana" }, body: { purchaseToken: "tok-good" }, env, fetchImpl: google });
  ok("an acknowledged purchase is not acknowledged again", !calls.some((call) => call.url.endsWith(":acknowledge")));

  calls.length = 0;
  subscription = null;
  const unknown = await purchaseResponse(d1, { user: { id: "ana" }, body: { purchaseToken: "tok-refused" }, env, fetchImpl: google });
  eqn("a purchase Play does not know is refused", unknown.status, 404);
  subscription = { lineItems: [{ productId: "spot", expiryTime: "not-a-date" }], externalAccountIdentifiers: { obfuscatedExternalAccountId: anaAccount } };
  const expired = await purchaseResponse(d1, { user: { id: "ana" }, body: { purchaseToken: "tok-expired" }, env, fetchImpl: google });
  eqn("a purchase whose expiry Play cannot read is refused", expired.status, 404);
  ok("neither granted anything more", (await holds(d1, "ana", "spot")) && (await activeKeys(d1, "ana")).length === 1);

  subscription = {
    ...active(),
    lineItems: [{ productId: "spot", expiryTime: "2000-01-01T00:00:00Z" }],
    externalAccountIdentifiers: { obfuscatedExternalAccountId: await accountIdFor("caio", SECRET) },
  };
  const past = await purchaseResponse(d1, { user: { id: "caio" }, body: { purchaseToken: "tok-past" }, env, fetchImpl: google });
  eqn("an expired subscription is read but grants no time", past.status, 200);
  eq("so the plan is not held", JSON.stringify(await activeKeys(d1, "caio")), JSON.stringify([]));

  subscription = active();
  eqn("somebody else's purchase is not yours", (await purchaseResponse(d1, { user: { id: "bia" }, body: { purchaseToken: "tok-bia" }, env, fetchImpl: google })).status, 403);
  eqn("signed out, no purchase", (await purchaseResponse(d1, { user: null, body: { purchaseToken: "tok-bia" }, env, fetchImpl: google })).status, 401);
  eqn("with no service account, Play is not set up", (await purchaseResponse(d1, { user: { id: "ana" }, body: { purchaseToken: "tok-bia" }, env: { JWT_SECRET: SECRET }, fetchImpl: google })).status, 503);

  subscription = { ...active(), subscriptionState: "SUBSCRIPTION_STATE_PENDING" };
  const pending = await purchaseResponse(d1, { user: { id: "ana" }, body: { purchaseToken: "tok-pending" }, env, fetchImpl: google });
  eq("a pending purchase waits", JSON.stringify(await pending.json()), JSON.stringify({ pending: true }));

  const push = (type: number, token: string): Record<string, unknown> => ({
    message: { data: Buffer.from(JSON.stringify({ subscriptionNotification: { notificationType: type, purchaseToken: token } })).toString("base64") },
  });
  eqn("a notification without Play's token is refused", (await notificationResponse(d1, { body: push(2, "tok-good"), token: "wrong", env, fetchImpl: google })).status, 403);
  subscription = { ...active(), lineItems: [{ productId: "spot", expiryTime: "2999-06-01T00:00:00Z" }] };
  await notificationResponse(d1, { body: push(2, "tok-good"), token: "rtdn-secret", env, fetchImpl: google });
  const row = await d1.prepare("SELECT expiresAt FROM entitlement WHERE id = ?").bind(`play:${await refOf("tok-good")}`).first();
  eq("a renewal moves the end", String(row?.["expiresAt"] ?? ""), "2999-06-01 00:00:00");
  eq("a notification for a token this app never granted is ignored", JSON.stringify(await (await notificationResponse(d1, { body: push(2, "never-seen"), token: "rtdn-secret", env, fetchImpl: google })).json()), JSON.stringify({ ignored: true }));
  await notificationResponse(d1, { body: push(12, "tok-good"), token: "rtdn-secret", env, fetchImpl: google });
  eq("a revocation takes the period back", JSON.stringify(await activeKeys(d1, "ana")), JSON.stringify([]));

  done();
};

await main();
