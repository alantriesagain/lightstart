// node-only
/**
 * @file Identities over `serverApp` and an in-memory database: a waiting
 * identity answers 202, a new account has a NULL email and is linked, an
 * existing user signs in, a session links the identity, another account's
 * identity is 409, an unknown name is 404, and a duplicate registration throws.
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
  registerIdentity,
  signToken,
  type IdentityAnswer,
  type MailMessage,
  type Mailer,
} from "../server/index.ts";

type Row = Record<string, unknown>;

const SECRET = "0123456789abcdef0123456789abcdef";

const isRecord = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mailer: Mailer = {
  send(_message: MailMessage): void {},
};

const links = new Map<string, string>();
let linkedId: string | null = null;

const fake = {
  name: "fake",
  async redeem(body: unknown): Promise<IdentityAnswer> {
    const record = isRecord(body) ? body : {};
    if (record["pending"] === true) return { pending: true };
    const key = typeof record["id"] === "string" ? record["id"] : "";
    const existing = links.get(key) ?? null;
    const link = async (userId: string): Promise<void> => {
      links.set(key, userId);
      linkedId = userId;
    };
    const name = typeof record["name"] === "string" ? record["name"] : undefined;
    if (existing !== null) return { userId: existing, link };
    return name === undefined ? { userId: null, link } : { userId: null, name, link };
  },
};

const env: Record<string, unknown> = { JWT_SECRET: SECRET };
const db = Database.open(":memory:");
applySchema(db, authModels);
const binding = d1Of(db);

const handle = toFetch(
  serverApp({
    models: authModels,
    endpoints: authEndpoints({ mailer }),
    db: () => binding,
    caller: callerFromRequest(env),
    env,
  }),
);

const post = (path: string, body: unknown, token?: string): Promise<Response> => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers["authorization"] = `Bearer ${token}`;
  return handle(new Request(new URL(path, "http://app.test"), { method: "POST", headers, body: JSON.stringify(body) }));
};

const asJson = async (response: Response): Promise<Row> => (await response.json()) as Row;

const main = async (): Promise<void> => {
  registerIdentity(fake);

  let duplicate = "";
  try {
    registerIdentity({ ...fake });
  } catch (error) {
    duplicate = error instanceof Error ? error.message : String(error);
  }
  ok("registering a name twice from another object throws", duplicate.includes("fake"));

  const waiting = await post("/api/auth/identity/fake", { pending: true });
  eqn("a pending identity answers 202", waiting.status, 202);
  ok("with a pending body", (await asJson(waiting))["pending"] === true);

  const created = await post("/api/auth/identity/fake", { id: "new", name: "New Person" });
  eqn("a new account signs in", created.status, 200);
  const createdBody = await asJson(created);
  ok("it answers a token", String(createdBody["token"]) !== "");
  const newId = String((createdBody["user"] as Row)["id"]);
  eq("the link was called with the new id", String(linkedId), newId);
  const row = await binding.prepare("SELECT email FROM users WHERE id = ?").bind(newId).first();
  ok("the new account's email is NULL", row !== null && row["email"] === null);

  const again = await post("/api/auth/identity/fake", { id: "new" });
  eqn("an existing identity signs in", again.status, 200);
  eq("as the same user", String(((await asJson(again))["user"] as Row)["id"]), newId);

  const callerId = crypto.randomUUID();
  await binding.prepare("INSERT INTO users (id, email, name, admin) VALUES (?, ?, ?, ?)").bind(callerId, "caller@example.com", "Caller", 0).run();
  const callerToken = await signToken({ sub: callerId }, SECRET);
  const linked = await post("/api/auth/identity/fake", { id: "with-session" }, callerToken);
  eqn("with a session the identity links", linked.status, 200);
  eq("to the caller", String(((await asJson(linked))["user"] as Row)["id"]), callerId);
  eq("the link took the caller's id", links.get("with-session") ?? "", callerId);

  const other = await post("/api/auth/identity/fake", { id: "other" });
  const otherId = String(((await asJson(other))["user"] as Row)["id"]);
  ok("another account's identity was made", otherId !== callerId);
  const refused = await post("/api/auth/identity/fake", { id: "other" }, callerToken);
  eqn("another account's identity is 409", refused.status, 409);
  eq("with the reason", String((await asJson(refused))["error"]), "linked to another account");

  const unknown = await post("/api/auth/identity/nobody", {});
  eqn("an unknown identity is 404", unknown.status, 404);

  done();
};

await main();
