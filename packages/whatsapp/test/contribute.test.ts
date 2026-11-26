// node-only
/**
 * @file WhatsApp as a server contribution, end to end over a temp project that
 * declares `@lightstart/api`, `@lightstart/auth` and `@lightstart/whatsapp`: a
 * signed-in person connects an account with a code, a device signs in with a
 * login code and nonce, and a second redeem of the nonce is refused.
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { serverModels } from "@lightstart/api/node/models.ts";
import { writeServerEntry } from "@lightstart/api/node/server-entry.ts";
import { applySchema } from "@lightstart/light/model/sql-builder";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import type { App } from "@lightstart/server";
import { toFetch } from "@lightstart/server/fetch";
import { d1Of, type D1Binding } from "@lightstart/sqlite/d1";
import { Database } from "@lightstart/sqlite/node";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

import { signatureOf } from "../server/signature.ts";

interface Entry {
  models: Record<string, ModelSchema>;
  createServer: (options: { db: D1Binding; env: Record<string, unknown> }) => App;
}

interface Sender {
  bsuid?: string;
  waId?: string;
  username?: string;
}

type Row = Record<string, unknown>;

const PHONE_NUMBER_ID = "106540352242922";
const SECRETS: Record<string, unknown> = {
  JWT_SECRET: "a-test-secret-that-is-long-enough-for-hs256",
  WHATSAPP_APP_SECRET: "app-secret",
  WHATSAPP_VERIFY_TOKEN: "verify-token",
  WHATSAPP_NUMBER: "+15550783881",
  WHATSAPP_PHONE_NUMBER_ID: PHONE_NUMBER_ID,
};

/** A text delivery as Meta posts it, from the sender named. */
const textPayload = (text: string, sender: Sender): Row => {
  const profile: Row = { name: "Someone" };
  if (sender.username !== undefined) profile["username"] = sender.username;
  const contact: Row = { profile };
  if (sender.waId !== undefined) contact["wa_id"] = sender.waId;
  if (sender.bsuid !== undefined) contact["user_id"] = sender.bsuid;
  const message: Row = { id: `wamid.${crypto.randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } };
  if (sender.waId !== undefined) message["from"] = sender.waId;
  if (sender.bsuid !== undefined) message["from_user_id"] = sender.bsuid;
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "1", changes: [{ field: "messages", value: { metadata: { phone_number_id: PHONE_NUMBER_ID }, contacts: [contact], messages: [message] } }] }],
  };
};

const main = async (): Promise<void> => {
  const packageRoot = join(import.meta.dirname, "..");
  const project = mkdtempSync(join(import.meta.dirname, "tmp-whatsapp-"));
  const logged: string[] = [];
  const log = console.log;
  try {
    mkdirSync(join(project, "src", "models"), { recursive: true });
    mkdirSync(join(project, "src", "endpoints"), { recursive: true });
    mkdirSync(join(project, "node_modules", "@lightstart"), { recursive: true });
    symlinkSync(packageRoot, join(project, "node_modules", "@lightstart", "whatsapp"), "dir");
    writeFileSync(
      join(project, "package.json"),
      JSON.stringify({ name: "wa-e2e", type: "module", dependencies: { "@lightstart/api": "workspace:*", "@lightstart/auth": "workspace:*", "@lightstart/whatsapp": "workspace:*" } }),
    );
    writeFileSync(
      join(project, "src", "app.js"),
      'import { defineApp } from "@lightstart/app";\nexport default defineApp({ name: "wa-e2e", host: "web", stores: { server: { adapter: "api" } } });\n',
    );

    const models = await serverModels(project);
    eq("the server models hold the WhatsApp tables", String(["whatsapp_account", "whatsapp_code", "whatsapp_message"].every((name) => name in models)), "true");

    await writeServerEntry(project);
    const entry = (await import(`${pathToFileURL(join(project, ".light", "server.ts")).href}?mtime=${String(Date.now())}`)) as Entry;

    const db = Database.open(":memory:");
    applySchema(db, models);
    const binding = d1Of(db);
    const handle = toFetch(entry.createServer({ db: binding, env: SECRETS }));

    const call = (path: string, init: RequestInit = {}): Promise<Response> => handle(new Request(`http://app.test${path}`, init));
    const json = (method: string, path: string, body: unknown, token?: string): Promise<Response> =>
      call(path, {
        method,
        headers: { "content-type": "application/json", ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) },
        body: JSON.stringify(body),
      });
    const signedIn = (method: string, path: string, token: string): Promise<Response> => call(path, { method, headers: { authorization: `Bearer ${token}` } });
    const deliver = async (raw: string, header?: string): Promise<Response> =>
      call("/api/whatsapp-webhook", {
        method: "POST",
        headers: { "content-type": "application/json", ...(header === undefined ? {} : { "x-hub-signature-256": header }) },
        body: raw,
      });

    console.log = (line: unknown): void => {
      logged.push(String(line));
    };
    eqn("the otp route answers", (await json("POST", "/api/auth/otp", { email: "ana@example.test" })).status, 200);
    console.log = log;
    const otp = /(\d{6})/.exec(logged.join("\n"))?.[1] ?? "";
    ok("the code goes to the console mailer", otp.length === 6);
    const verified = await json("POST", "/api/auth/verify", { email: "ana@example.test", code: otp });
    eqn("the mailed code signs in", verified.status, 200);
    const token = String(((await verified.json()) as Row)["token"]);

    eqn(
      "the handshake answers the challenge",
      (await call(`/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=1158201444`)).status,
      200,
    );
    eqn("a wrong verify token is forbidden", (await call(`/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=guess&hub.challenge=1`)).status, 403);

    const issued = await signedIn("POST", "/api/whatsapp-code", token);
    eqn("a signed-in person gets a connect code", issued.status, 200);
    const connect = (await issued.json()) as Row;
    ok("the code is six digits", /^\d{6}$/.test(String(connect["code"])));
    eq("the number to send it to", String(connect["to"]), "+15550783881");
    eq("waiting until it is sent", String(((await (await signedIn("GET", "/api/whatsapp-status", token)).json()) as Row)["state"]), "waiting");

    const connectRaw = JSON.stringify(textPayload(`Meu código é ${String(connect["code"])}`, { bsuid: "BR.13491208655302741918", waId: "5521987654321", username: "bruno.rio" }));
    eqn("a delivery with no signature is refused", (await deliver(connectRaw)).status, 401);
    eqn("a delivery signed over other bytes is refused", (await deliver(connectRaw, await signatureOf(`${connectRaw} `, "app-secret"))).status, 401);
    const reshaped = connectRaw.replace(/:/g, ": ").replace(/,/g, ", ").replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
    eqn("a delivery signed over a re-serialized form of its body, not the bytes sent, is refused", (await deliver(reshaped, await signatureOf(connectRaw, "app-secret"))).status, 401);
    const connected = await deliver(connectRaw, await signatureOf(connectRaw, "app-secret"));
    eqn("the signed delivery is accepted", connected.status, 200);
    eq("and answers ok", String(((await connected.json()) as Row)["ok"]), "true");
    eq(
      "the account is connected",
      JSON.stringify(await (await signedIn("GET", "/api/whatsapp-status", token)).json()),
      JSON.stringify({ state: "connected", number: "5521987654321", username: "bruno.rio" }),
    );

    const login = await json("POST", "/api/whatsapp-login", {});
    eqn("a device gets a login code", login.status, 200);
    const asked = (await login.json()) as Row;
    const nonce = String(asked["nonce"]);
    ok("with a nonce the device keeps", nonce.length >= 32);
    eq("its cache is private", String(login.headers.get("cache-control")), "private, no-store");

    const pending = await json("POST", "/api/auth/identity/whatsapp", { nonce });
    eqn("the identity is still waiting before the message", pending.status, 202);
    eq("and says so", String(((await pending.json()) as Row)["pending"]), "true");

    const loginRaw = JSON.stringify(textPayload(`Sign me in: ${String(asked["code"])}`, { bsuid: "AR.88231907716254409312", username: "carla_m" }));
    eqn("the login code's delivery is accepted", (await deliver(loginRaw, await signatureOf(loginRaw, "app-secret"))).status, 200);

    const signed = await json("POST", "/api/auth/identity/whatsapp", { nonce });
    eqn("the identity signs the device in after the message", signed.status, 200);
    const session = (await signed.json()) as Row;
    ok("with a session token", typeof session["token"] === "string" && String(session["token"]) !== "");
    const user = session["user"] as Row;
    eq("the account has no email, made by the identity", String(user["email"]), "null");
    const signedToken = String(session["token"]);
    eq(
      "and the sender is connected to it",
      JSON.stringify(await (await signedIn("GET", "/api/whatsapp-status", signedToken)).json()),
      JSON.stringify({ state: "connected", number: "", username: "carla_m" }),
    );

    const again = await json("POST", "/api/auth/identity/whatsapp", { nonce });
    eqn("a second redeem of the nonce is refused", again.status, 410);
  } finally {
    console.log = log;
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
