// node-only
/**
 * @file The auth server half over `serverApp` and an in-memory database: the
 * JWT it signs, the code it mails, the session it answers, the account routes
 * a person uses, and the auth tables staying out of the CRUD routes.
 */

import { applySchema } from "@lightstart/light/model/sql-builder";
import { Database } from "@lightstart/sqlite/node";
import { d1Of } from "@lightstart/sqlite/d1";
import { toFetch } from "@lightstart/server/fetch";
import { serverApp } from "@lightstart/api/server";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

import {
  authEndpoints,
  authModels,
  callerFromRequest,
  CODE_TTL_MS,
  RESEND_MS,
  signToken,
  verifyToken,
  type MailMessage,
  type Mailer,
} from "../server/index.ts";

type Row = Record<string, unknown>;

const SECRET = "0123456789abcdef0123456789abcdef";

let clock = Date.UTC(2026, 0, 1);
const sends: MailMessage[] = [];
const mailer: Mailer = {
  send(message: MailMessage): void {
    sends.push(message);
  },
};

let deletedId: string | null = null;
const hooks = {
  onUserDeleted(id: string): void {
    deletedId = id;
  },
};

const env: Record<string, unknown> = { JWT_SECRET: SECRET };
const db = Database.open(":memory:");
applySchema(db, authModels);
const binding = d1Of(db);

const handle = toFetch(
  serverApp({
    models: authModels,
    endpoints: authEndpoints({ mailer, hooks, now: () => clock }),
    db: () => binding,
    caller: callerFromRequest(env),
    env,
  }),
);

const send = (path: string, init?: RequestInit): Promise<Response> =>
  handle(new Request(new URL(path, "http://app.test"), init));

const asJson = async (response: Response): Promise<Row> => (await response.json()) as Row;

const post = (path: string, body: unknown, token?: string): Promise<Response> => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers["authorization"] = `Bearer ${token}`;
  return send(path, { method: "POST", headers, body: JSON.stringify(body) });
};

const patch = (path: string, body: unknown, token: string): Promise<Response> =>
  send(path, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

const lastCode = (): string => {
  const message = sends[sends.length - 1];
  const match = message === undefined ? null : /(\d{6})/.exec(message.text);
  if (match?.[1] === undefined) throw new Error("no code was mailed");
  return match[1];
};

const bearer = (token: string): RequestInit => ({ headers: { authorization: `Bearer ${token}` } });

const signIn = async (email: string): Promise<{ token: string; user: Row }> => {
  clock += RESEND_MS + 1;
  const asked = await post("/api/auth/otp", { email });
  eqn(`a code is mailed to ${email}`, asked.status, 200);
  const verified = await post("/api/auth/verify", { email, code: lastCode() });
  eqn(`the mailed code signs ${email} in`, verified.status, 200);
  const body = await asJson(verified);
  return { token: String(body["token"]), user: body["user"] as Row };
};

const base64url = (text: string): string => btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const main = async (): Promise<void> => {
  const token = await signToken({ sub: "u1", admin: true }, SECRET);
  const claims = await verifyToken(token, SECRET);
  ok("a signed token verifies", claims !== null);
  eq("its subject comes back", String(claims?.["sub"]), "u1");
  ok("and its admin flag", claims?.["admin"] === true);

  const parts = token.split(".");
  const tamperedBody = `${parts[0]}.${(parts[1] as string).slice(0, -1)}${(parts[1] as string).endsWith("A") ? "B" : "A"}.${parts[2]}`;
  ok("a tampered token is refused", (await verifyToken(tamperedBody, SECRET)) === null);
  const expired = await signToken({ sub: "u2" }, SECRET, -10);
  ok("an expired token is refused", (await verifyToken(expired, SECRET)) === null);
  const wrongAlg = [base64url(JSON.stringify({ alg: "none", typ: "JWT" })), parts[1], parts[2]].join(".");
  ok("a token naming another algorithm is refused", (await verifyToken(wrongAlg, SECRET)) === null);
  const noExpiry = await (async (): Promise<string> => {
    const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = base64url(JSON.stringify({ sub: "forever" }));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`)));
    let binary = "";
    for (const byte of signature) binary += String.fromCharCode(byte);
    return `${header}.${body}.${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  })();
  ok("a well-signed token with no expiry is refused", (await verifyToken(noExpiry, SECRET)) === null);
  let shortSecret = "";
  try {
    await signToken({ sub: "u3" }, "too short");
  } catch (error) {
    shortSecret = error instanceof Error ? error.message : String(error);
  }
  ok("signing with a short secret throws", shortSecret !== "");

  const email = "Alice@Example.com";
  const asked = await post("/api/auth/otp", { email });
  eqn("a code request answers 200", asked.status, 200);
  eq("the address is lowered and trimmed", String(sends[sends.length - 1]?.["to"]), "alice@example.com");
  const code = lastCode();

  const stored = await binding.prepare("SELECT code FROM auth_codes WHERE email = ?").bind("alice@example.com").first();
  ok("the stored code is not the plain code", stored !== null && String(stored["code"]) !== code);
  const plainHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  ok("nor its bare SHA-256, which the table alone would reverse", stored !== null && String(stored["code"]) !== plainHash);

  const verified = await post("/api/auth/verify", { email: "alice@example.com", code });
  eqn("the mailed code verifies", verified.status, 200);
  const first = await asJson(verified);
  const firstToken = String(first["token"]);
  const firstUser = first["user"] as Row;
  ok("verify answers a token", firstToken !== "");
  eq("and the user's email", String(firstUser["email"]), "alice@example.com");

  const me = await send("/api/auth/me", bearer(firstToken));
  eqn("/me answers a bearer", me.status, 200);
  eq("with the same user", String(((await asJson(me))["user"] as Row)["id"]), String(firstUser["id"]));

  const anonymous = await send("/api/auth/me");
  eqn("/me without a token is 401", anonymous.status, 401);

  const second = await signIn("alice@example.com");
  eq("a second sign-in is the same user", String(second.user["id"]), String(firstUser["id"]));

  await signIn("bob@example.com");
  clock += RESEND_MS + 1;
  await post("/api/auth/otp", { email: "bob@example.com" });
  for (let attempt = 1; attempt <= 4; attempt++) {
    const wrong = await post("/api/auth/verify", { email: "bob@example.com", code: "000000" });
    eqn(`wrong try ${attempt} is 400`, wrong.status, 400);
  }
  const fifth = await post("/api/auth/verify", { email: "bob@example.com", code: "000000" });
  eqn("the fifth wrong try is 429", fifth.status, 429);
  const afterLockout = await post("/api/auth/verify", { email: "bob@example.com", code: lastCode() });
  eqn("the code is gone after lockout", afterLockout.status, 400);

  clock += RESEND_MS + 1;
  await post("/api/auth/otp", { email: "carol@example.com" });
  const carolCode = lastCode();
  clock += CODE_TTL_MS + 1;
  const expiredCode = await post("/api/auth/verify", { email: "carol@example.com", code: carolCode });
  eqn("an expired code is 400", expiredCode.status, 400);

  clock += RESEND_MS + 1;
  const firstAsk = await post("/api/auth/otp", { email: "dave@example.com" });
  eqn("a first request answers 200", firstAsk.status, 200);
  const tooSoon = await post("/api/auth/otp", { email: "dave@example.com" });
  eqn("a request within 30 seconds is 429", tooSoon.status, 429);
  clock += RESEND_MS + 1;
  const later = await post("/api/auth/otp", { email: "dave@example.com" });
  eqn("a request after 30 seconds answers 200", later.status, 200);

  const badEmail = await post("/api/auth/otp", { email: "not-an-address" });
  eqn("a bad email is 400", badEmail.status, 400);

  const dana = await signIn("dana@example.com");
  const changed = await patch("/api/auth/profile", { name: "Dana", admin: true, email: "else@example.com" }, dana.token);
  eqn("/profile answers 200", changed.status, 200);
  const danaUser = (await asJson(changed))["user"] as Row;
  eq("it changes the allowed field", String(danaUser["name"]), "Dana");
  ok("and ignores admin", danaUser["admin"] === false);
  eq("and ignores email", String(danaUser["email"]), "dana@example.com");

  const refreshed = await post("/api/auth/refresh", {}, dana.token);
  eqn("/refresh answers 200", refreshed.status, 200);
  const fresh = await asJson(refreshed);
  ok("with a token", String(fresh["token"]) !== "");
  eq("and the same user", String((fresh["user"] as Row)["id"]), String(dana.user["id"]));

  const erin = await signIn("erin@example.com");
  const removed = await post("/api/auth/delete", {}, erin.token);
  eqn("/delete answers 200", removed.status, 200);
  ok("it answers ok", (await asJson(removed))["ok"] === true);
  eq("the delete hook ran first with the id", String(deletedId), String(erin.user["id"]));
  const gone = await send("/api/auth/me", bearer(erin.token));
  eqn("the deleted user's token is 401", gone.status, 401);
  const header = (token: string): Request => new Request("http://app.test/x", { headers: { authorization: `Bearer ${token}` } });
  const checked = callerFromRequest(env, () => binding);
  ok("with the database, a deleted user's token is nobody", (await checked(header(erin.token))) === null);
  ok("without it, the token alone still names them", (await callerFromRequest(env)(header(erin.token))) !== null);
  await binding.prepare("UPDATE users SET admin = 1 WHERE id = ?").bind(String(dana.user["id"])).run();
  ok("with the database, admin comes from the row, not the token", (await checked(header(dana.token)))?.admin === true);
  await binding.prepare("UPDATE users SET admin = 0 WHERE id = ?").bind(String(dana.user["id"])).run();
  ok("so a revoked admin is no admin at once", (await checked(header(dana.token)))?.admin === false);

  const crudAnonymous = await send("/api/users");
  eqn("crudApp refuses an anonymous /api/users", crudAnonymous.status, 401);
  const crudSignedIn = await send("/api/users", bearer(firstToken));
  eqn("and a plain signed-in caller", crudSignedIn.status, 403);
  const codeCrud = await send("/api/auth_codes", bearer(firstToken));
  eqn("and /api/auth_codes", codeCrud.status, 403);

  clock += RESEND_MS + 1;
  const burst = "burst@example.com";
  eqn("a code for the burst", (await post("/api/auth/otp", { email: burst })).status, 200);
  const burstCode = lastCode();
  const guesses: Promise<Response>[] = [];
  for (let i = 0; i < 20; i++) guesses.push(post("/api/auth/verify", { email: burst, code: String((Number(burstCode) + 1 + i) % 900000 + 100000) }));
  const answers = await Promise.all(guesses);
  eqn("twenty parallel wrong guesses: none signs in", answers.filter((answer) => answer.status === 200).length, 0);
  eqn("and the right code after them is refused, the limit held", (await post("/api/auth/verify", { email: burst, code: burstCode })).status === 200 ? 1 : 0, 0);

  done();
};

await main();
