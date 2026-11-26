// node-only
/**
 * @file `sendPush` over a fake FCM and an in-memory database: the Android and
 * iOS message shapes, a message written per locale, a dead token deleted, the
 * OAuth token cached until it nearly ends, and the `[push:dev]` line when no
 * service account is configured.
 */

import { Database } from "@lightstart/sqlite/node";
import { d1Of } from "@lightstart/sqlite/d1";
import { applySchema } from "@lightstart/light/model/sql-builder";
import type { D1Like } from "@lightstart/api/server";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

import { clearTokenCache, sendPush, serviceAccountOf } from "../server/send.ts";
import { pushModels } from "../server/models.ts";
import type { PushMessage } from "../types.ts";

const MESSAGE: PushMessage = { id: "alert:asked:r1", title: "Bia wants to join", body: "Sunset at Arpoador", url: "/live/l1" };

const pemOf = (bytes: ArrayBuffer): string => {
  const base64 = Buffer.from(bytes).toString("base64");
  return `-----BEGIN PRIVATE KEY-----\n${(base64.match(/.{1,64}/g) ?? []).join("\n")}\n-----END PRIVATE KEY-----\n`;
};

const fresh = (): D1Like => {
  const db = Database.open(":memory:");
  applySchema(db, pushModels);
  return d1Of(db);
};

const device = (db: D1Like, id: string, userId: string, platform: string, token: string, locale = "en"): Promise<unknown> =>
  db.prepare("INSERT INTO push_device (id, userId, platform, token, locale, updatedAt) VALUES (?, ?, ?, ?, ?, '')").bind(id, userId, platform, token, locale).run();

interface Sent {
  url: string;
  auth: string;
  message: Record<string, unknown>;
}

const fcmOf = (sent: Sent[], counters: { tokens: number; tokenBodies: string[] }) => async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (url.endsWith("/token")) {
    counters.tokens++;
    counters.tokenBodies.push(String(init?.body ?? ""));
    return Response.json({ access_token: "ya29.push", expires_in: 3600 });
  }
  const { message } = JSON.parse(String(init?.body)) as { message: Record<string, unknown> };
  const headers = (init?.headers ?? {}) as Record<string, string>;
  sent.push({ url, auth: headers.authorization ?? "", message });
  if (message.token === "gone") return Response.json({ error: { code: 404, status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }, { status: 404 });
  if (message.token === "junk") return Response.json({ error: { code: 400, message: "The registration token is not a valid FCM registration token", details: [{ errorCode: "INVALID_ARGUMENT" }] } }, { status: 400 });
  if (message.token === "busy") return Response.json({ error: { code: 503, status: "UNAVAILABLE" } }, { status: 503 });
  return Response.json({ name: "projects/test/messages/1" });
};

const logged = async (fn: () => Promise<void>): Promise<{ log: string[]; warn: string[]; error: string[] }> => {
  const log: string[] = [];
  const warn: string[] = [];
  const error: string[] = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...args: unknown[]): void => {
    log.push(args.map(String).join(" "));
  };
  console.warn = (...args: unknown[]): void => {
    warn.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]): void => {
    error.push(args.map(String).join(" "));
  };
  try {
    await fn();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
  return { log, warn, error };
};

const main = async (): Promise<void> => {
  const keys = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const account = {
    project_id: "meetup-test",
    client_email: "push@meetup-test.iam.gserviceaccount.com",
    private_key: pemOf(await crypto.subtle.exportKey("pkcs8", keys.privateKey)),
  };
  const env = { FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(account) };

  ok("serviceAccountOf reads a key", serviceAccountOf(JSON.stringify(account))?.client_email === account.client_email);
  ok("serviceAccountOf refuses a path", serviceAccountOf("/keys/push.json") === null);
  ok("serviceAccountOf refuses nothing", serviceAccountOf(undefined) === null);

  {
    clearTokenCache();
    const db = fresh();
    const sent: Sent[] = [];
    const counters = { tokens: 0, tokenBodies: [] as string[] };
    const fcm = fcmOf(sent, counters);
    let clock = 1_000_000;
    const options = { fetchImpl: fcm as typeof fetch, now: () => clock };
    await device(db, "phone-android-0001", "u_ana", "android", "tok-a");
    await device(db, "phone-iphone-00001", "u_ana", "ios", "tok-i");
    await device(db, "phone-other-000001", "u_bia", "android", "tok-b");

    const first = await sendPush(env, db, { userId: "u_ana" }, MESSAGE, options);
    eq("the account's two devices are counted", JSON.stringify(first), JSON.stringify({ devices: 2, sent: 2, pruned: 0, failed: 0, dev: "" }));
    ok("every message goes to FCM v1 with the bearer", sent.every((entry) => entry.url === "https://fcm.googleapis.com/v1/projects/meetup-test/messages:send" && entry.auth === "Bearer ya29.push"));
    const android = sent.find((entry) => entry.message.token === "tok-a")?.message;
    eq("Android gets a data-only message", JSON.stringify(android), JSON.stringify({ token: "tok-a", data: MESSAGE, android: { priority: "HIGH" } }));
    const ios = sent.find((entry) => entry.message.token === "tok-i")?.message;
    eq(
      "iOS gets an APNs alert with id and url",
      JSON.stringify(ios),
      JSON.stringify({ token: "tok-i", apns: { payload: { aps: { alert: { title: MESSAGE.title, body: MESSAGE.body }, sound: "default" }, id: MESSAGE.id, url: MESSAGE.url } } }),
    );

    const assertion = new URLSearchParams(counters.tokenBodies[0]).get("assertion") ?? "";
    const claims = JSON.parse(Buffer.from((assertion.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as Record<string, unknown>;
    const header = JSON.parse(Buffer.from((assertion.split(".")[0] ?? "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as Record<string, unknown>;
    eq("the JWT is RS256", String(header.alg), "RS256");
    eq("the JWT names the service account", String(claims.iss), account.client_email);
    eq("the JWT asks for the messaging scope", String(claims.scope), "https://www.googleapis.com/auth/firebase.messaging");

    await sendPush(env, db, { deviceId: "phone-other-000001" }, MESSAGE, options);
    eq("FCM_PROJECT_ID names another Firebase project", sent[sent.length - 1]?.url, "https://fcm.googleapis.com/v1/projects/meetup-test/messages:send");
    await sendPush({ ...env, FCM_PROJECT_ID: "meetup-firebase" }, db, { deviceId: "phone-other-000001" }, MESSAGE, options);
    eq("the override reaches the endpoint", sent[sent.length - 1]?.url, "https://fcm.googleapis.com/v1/projects/meetup-firebase/messages:send");

    await sendPush(env, db, { userId: "u_ana" }, MESSAGE, options);
    eqn("two more sends reuse the cached token", counters.tokens, 1);
    clock += 3600 * 1000;
    await sendPush(env, db, { userId: "u_ana" }, MESSAGE, options);
    eqn("a token past its life is minted again", counters.tokens, 2);
  }

  {
    clearTokenCache();
    const db = fresh();
    const sent: Sent[] = [];
    const counters = { tokens: 0, tokenBodies: [] as string[] };
    const fcm = fcmOf(sent, counters);
    await device(db, "phone-english-0001", "u_ana", "android", "tok-en", "en-US");
    await device(db, "phone-portugues-01", "u_ana", "ios", "tok-pt", "pt-BR");
    const inLocale = (locale: string): PushMessage => ({ ...MESSAGE, title: locale.startsWith("pt") ? "Bia quer participar" : MESSAGE.title });
    const outcome = await sendPush(env, db, { userId: "u_ana" }, inLocale, { fetchImpl: fcm as typeof fetch });
    eqn("both devices get their own language", outcome.sent, 2);
    eq("the English device reads English", JSON.stringify(sent.find((entry) => entry.message.token === "tok-en")?.message.data), JSON.stringify(MESSAGE));
    const iosPayload = sent.find((entry) => entry.message.token === "tok-pt")?.message.apns as { payload: { aps: { alert: unknown } } };
    eq("the Portuguese device reads Portuguese", JSON.stringify(iosPayload.payload.aps.alert), JSON.stringify({ title: "Bia quer participar", body: MESSAGE.body }));

    const seen = await logged(async () => {
      const dev = await sendPush({}, db, { userId: "u_ana" }, inLocale);
      eq(
        "without a service account the dev line is per locale",
        dev.dev,
        '[push:dev] user=u_ana devices=2 locale=en-US id=alert:asked:r1 title="Bia wants to join" body="Sunset at Arpoador" url=/live/l1\n[push:dev] user=u_ana devices=2 locale=pt-BR id=alert:asked:r1 title="Bia quer participar" body="Sunset at Arpoador" url=/live/l1',
      );
    });
    eqn("the dev line is logged once", seen.log.filter((line) => line.startsWith("[push:dev]")).length, 1);
    eqn("the real send minted a token, the dev run did not", counters.tokens, 1);
  }

  {
    clearTokenCache();
    const db = fresh();
    const sent: Sent[] = [];
    const counters = { tokens: 0, tokenBodies: [] as string[] };
    const fcm = fcmOf(sent, counters);
    await device(db, "phone-gone-0000001", "u_ana", "android", "gone");
    await device(db, "phone-junk-0000001", "u_ana", "ios", "junk");
    await device(db, "phone-busy-0000001", "u_ana", "android", "busy");
    const result = await logged(async () => {
      const outcome = await sendPush(env, db, { userId: "u_ana" }, MESSAGE, { fetchImpl: fcm as typeof fetch });
      eq("dead tokens are pruned and a refusal is counted", JSON.stringify(outcome), JSON.stringify({ devices: 3, sent: 0, pruned: 2, failed: 1, dev: "" }));
    });
    eqn("the refusals warned once", result.warn.length, 1);
    const rows = await db.prepare("SELECT id FROM push_device").all();
    eq("only the refused device remains", JSON.stringify((rows.results ?? []).map((row) => row["id"])), JSON.stringify(["phone-busy-0000001"]));
  }

  {
    clearTokenCache();
    const db = fresh();
    const sent: Sent[] = [];
    const counters = { tokens: 0, tokenBodies: [] as string[] };
    const fcm = fcmOf(sent, counters);
    await device(db, "phone-android-0001", "u_ana", "android", "tok-a");
    await device(db, "phone-signed-out-1", "", "android", "tok-x");
    const seen = await logged(async () => {
      const outcome = await sendPush({}, db, { userId: "u_ana" }, MESSAGE, { fetchImpl: fcm as typeof fetch });
      eqn("the dev run counts the account's device", outcome.devices, 1);
      eq("the dev line names the target and what it says", outcome.dev, '[push:dev] user=u_ana devices=1 id=alert:asked:r1 title="Bia wants to join" body="Sunset at Arpoador" url=/live/l1');
      eqn("an empty target reaches nobody", (await sendPush(env, db, { userId: "" }, MESSAGE, { fetchImpl: fcm as typeof fetch })).devices, 0);
    });
    eqn("the dev line is logged", seen.log.filter((line) => line.startsWith("[push:dev]")).length, 1);
    eqn("an empty target sends nothing", sent.length, 0);
  }

  done();
};

await main();
