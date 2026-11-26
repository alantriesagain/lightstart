/**
 * @file The `/api/auth` endpoints: a six-digit code mailed to an address, a
 * JWT session, and the routes a signed-in person uses on their own account.
 * They answer definitions `@lightstart/api`'s `serverApp` registers beside an
 * app's own endpoints and CRUD routes.
 */

import { HttpError } from "@lightstart/server";
import { defineEndpoint, type Caller, type D1Like, type Endpoint } from "@lightstart/api/server";

import { identityNamed } from "./identities.ts";
import { signToken } from "./jwt.ts";
import type { Mailer } from "./mailer.ts";

/** The life of a sign-in code, in milliseconds: ten minutes. */
export const CODE_TTL_MS = 10 * 60 * 1000;

/** The quiet period after a code is sent before another may be, in milliseconds. */
export const RESEND_MS = 30 * 1000;

/** How many wrong tries a code takes before it is thrown away. */
export const MAX_TRIES = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Row = Record<string, unknown>;

/** What an app may do around a user's account: clean up when it goes, add fields to every answer. */
export interface AuthHooks {
  /** Runs before `/delete` removes the user, while its rows are still there. */
  onUserDeleted?(id: string, db: D1Like, env: Record<string, unknown>): unknown | Promise<unknown>;
  /** Extra fields merged under the user's own wherever a user is answered. */
  sessionFields?(id: string, db: D1Like, env: Record<string, unknown>): unknown | Promise<unknown>;
}

/** How `authEndpoints` is built. */
export interface AuthOptions {
  /** Sends the code; `resendMailer` or `consoleMailer`. */
  mailer: Mailer;
  /** The app's account hooks. */
  hooks?: AuthHooks;
  /** The fields `/profile` may change, `["name"]` by default. */
  profileFields?: string[];
  /** The clock, `Date.now` by default, so a test can move it. */
  now?: () => number;
}

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`;

/** The code as stored: an HMAC-SHA-256 keyed by the session secret over the address and the code, so the table alone cannot be reversed into codes. */
const codeHash = async (secret: string, email: string, code: string): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${email}\n${code}`));
  let out = "";
  for (const byte of new Uint8Array(digest)) out += byte.toString(16).padStart(2, "0");
  return out;
};

const sameHash = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= (left.charCodeAt(index) ^ right.charCodeAt(index));
  return difference === 0;
};

const secretOf = (env: Record<string, unknown>): string => {
  const secret = env["JWT_SECRET"];
  if (typeof secret !== "string" || secret === "") throw new HttpError(500, "JWT_SECRET is not set");
  return secret;
};

const emailOf = (body: Row): string => {
  const raw = body["email"];
  if (typeof raw !== "string") throw new HttpError(400, "invalid email");
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "invalid email");
  return email;
};

const codeRowOf = (db: D1Like, email: string): Promise<Row | null> =>
  db.prepare("SELECT * FROM auth_codes WHERE email = ?").bind(email).first();

const userRowOf = (db: D1Like, id: string): Promise<Row | null> =>
  db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();

const clearCode = async (db: D1Like, email: string): Promise<void> => {
  await db.prepare("DELETE FROM auth_codes WHERE email = ?").bind(email).run();
};

const userOf = (row: Row): Row => ({ ...row, admin: row["admin"] === true || row["admin"] === 1 });

const answerUser = async (
  row: Row,
  db: D1Like,
  env: Record<string, unknown>,
  hooks: AuthHooks | undefined,
): Promise<Row> => {
  const user = userOf(row);
  if (hooks?.sessionFields === undefined) return user;
  const extra = await hooks.sessionFields(String(user["id"]), db, env);
  return isRecord(extra) ? { ...extra, ...user } : user;
};

const tokenOf = async (user: Row, env: Record<string, unknown>): Promise<string> => {
  const payload: Row = { sub: String(user["id"]) };
  if (user["admin"] === true) payload["admin"] = true;
  return signToken(payload, secretOf(env));
};

const findOrCreateUser = async (db: D1Like, email: string): Promise<Row> => {
  const existing = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (existing !== null) return existing;
  const id = crypto.randomUUID();
  const name = email.split("@")[0] ?? email;
  await db.prepare("INSERT INTO users (id, email, name, admin) VALUES (?, ?, ?, ?)").bind(id, email, name, 0).run();
  const created = await userRowOf(db, id);
  if (created === null) throw new HttpError(500, "could not create the account");
  return created;
};

const requestCode = (options: AuthOptions) => async (request: {
  body: unknown;
  db: D1Like;
  env: Record<string, unknown>;
}): Promise<Row> => {
  if (!isRecord(request.body)) throw new HttpError(400, "invalid email");
  const email = emailOf(request.body);
  const now = (options.now ?? Date.now)();

  const previous = await codeRowOf(request.db, email);
  if (previous !== null) {
    const lastSent = Number(previous["expires"]) - CODE_TTL_MS;
    if (Number.isFinite(lastSent) && now - lastSent < RESEND_MS) throw new HttpError(429, "too many requests");
  }

  const random = crypto.getRandomValues(new Uint32Array(1))[0] as number;
  const value = String(100000 + (random % 900000));
  const hash = await codeHash(secretOf(request.env), email, value);
  await clearCode(request.db, email);
  await request.db
    .prepare("INSERT INTO auth_codes (id, email, code, expires, tries) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), email, hash, now + CODE_TTL_MS, 0)
    .run();

  await options.mailer.send({
    to: email,
    subject: "Your sign-in code",
    text: `Your sign-in code is ${value}. It expires in 10 minutes.`,
  });
  return { ok: true };
};

const verifyCode = (options: AuthOptions) => async (request: {
  body: unknown;
  db: D1Like;
  env: Record<string, unknown>;
}): Promise<Row> => {
  if (!isRecord(request.body)) throw new HttpError(400, "invalid code");
  const email = emailOf(request.body);
  const raw = request.body["code"];
  const code = typeof raw === "string" ? raw.trim() : String(raw ?? "");
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, "invalid code");

  const row = await codeRowOf(request.db, email);
  if (row === null) throw new HttpError(400, "no code requested");
  const now = (options.now ?? Date.now)();
  if (Number(row["expires"]) < now) {
    await clearCode(request.db, email);
    throw new HttpError(400, "code expired");
  }
  const counted = await request.db
    .prepare("UPDATE auth_codes SET tries = tries + 1 WHERE email = ? AND tries < ? RETURNING tries")
    .bind(email, MAX_TRIES)
    .first();
  if (counted === null) {
    await clearCode(request.db, email);
    throw new HttpError(429, "too many attempts");
  }

  const stored = String(row["code"]);
  if (!sameHash(stored, await codeHash(secretOf(request.env), email, code))) {
    if (Number(counted["tries"]) >= MAX_TRIES) {
      await clearCode(request.db, email);
      throw new HttpError(429, "too many attempts");
    }
    throw new HttpError(400, "incorrect code");
  }

  await clearCode(request.db, email);
  const user = await findOrCreateUser(request.db, email);
  return { token: await tokenOf(user, request.env), user: await answerUser(user, request.db, request.env, options.hooks) };
};

const sessionOf = async (
  user: Row,
  db: D1Like,
  env: Record<string, unknown>,
  hooks: AuthHooks | undefined,
): Promise<Row> => ({ token: await tokenOf(user, env), user: await answerUser(user, db, env, hooks) });

const identity = (options: AuthOptions) => async (request: {
  params: Record<string, string>;
  body: unknown;
  caller: Caller;
  db: D1Like;
  env: Record<string, unknown>;
}): Promise<unknown> => {
  const found = identityNamed(request.params["name"] ?? "");
  if (found === undefined) throw new HttpError(404, "no such identity");
  const answer = await found.redeem(request.body, request.db, request.env);

  if ("pending" in answer) {
    return new Response(JSON.stringify({ pending: true }), {
      status: 202,
      headers: { "content-type": "application/json" },
    });
  }
  if ("error" in answer) throw new HttpError(answer.status, answer.error);

  const caller = request.caller;
  if (caller !== null) {
    if (answer.userId !== null && answer.userId !== caller.id) {
      throw new HttpError(409, "linked to another account");
    }
    if (answer.userId === null) await answer.link(caller.id);
    const user = await userRowOf(request.db, caller.id);
    if (user === null) throw new HttpError(401, "authentication required");
    return sessionOf(user, request.db, request.env, options.hooks);
  }

  if (answer.userId === null) {
    const id = crypto.randomUUID();
    const name = answer.name ?? "";
    await request.db.prepare("INSERT INTO users (id, email, name, admin) VALUES (?, NULL, ?, ?)").bind(id, name, 0).run();
    await answer.link(id);
    const created = await userRowOf(request.db, id);
    if (created === null) throw new HttpError(500, "could not create the account");
    return sessionOf(created, request.db, request.env, options.hooks);
  }

  const user = await userRowOf(request.db, answer.userId);
  if (user === null) throw new HttpError(401, "authentication required");
  return sessionOf(user, request.db, request.env, options.hooks);
};

const me = (options: AuthOptions) => async (request: {
  caller: Caller;
  db: D1Like;
  env: Record<string, unknown>;
}): Promise<Row> => {
  const caller = request.caller;
  if (caller === null) throw new HttpError(401, "authentication required");
  const user = await userRowOf(request.db, caller.id);
  if (user === null) throw new HttpError(401, "authentication required");
  return { user: await answerUser(user, request.db, request.env, options.hooks) };
};

const profile = (options: AuthOptions) => async (request: {
  body: unknown;
  caller: Caller;
  db: D1Like;
  env: Record<string, unknown>;
}): Promise<Row> => {
  const caller = request.caller;
  if (caller === null) throw new HttpError(401, "authentication required");
  const current = await userRowOf(request.db, caller.id);
  if (current === null) throw new HttpError(401, "authentication required");
  const patch = isRecord(request.body) ? request.body : {};
  const fields = options.profileFields ?? ["name"];

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    sets.push(`${quoteIdent(field)} = ?`);
    values.push(patch[field]);
  }
  if (sets.length > 0) {
    await request.db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...values, caller.id).run();
  }
  const updated = await userRowOf(request.db, caller.id);
  if (updated === null) throw new HttpError(401, "authentication required");
  return { user: await answerUser(updated, request.db, request.env, options.hooks) };
};

const refresh = (options: AuthOptions) => async (request: {
  caller: Caller;
  db: D1Like;
  env: Record<string, unknown>;
}): Promise<Row> => {
  const caller = request.caller;
  if (caller === null) throw new HttpError(401, "authentication required");
  const user = await userRowOf(request.db, caller.id);
  if (user === null) throw new HttpError(401, "authentication required");
  return { token: await tokenOf(user, request.env), user: await answerUser(user, request.db, request.env, options.hooks) };
};

const remove = (options: AuthOptions) => async (request: {
  caller: Caller;
  db: D1Like;
  env: Record<string, unknown>;
}): Promise<Row> => {
  const caller = request.caller;
  if (caller === null) throw new HttpError(401, "authentication required");
  if (options.hooks?.onUserDeleted !== undefined) await options.hooks.onUserDeleted(caller.id, request.db, request.env);
  await request.db.prepare("DELETE FROM users WHERE id = ?").bind(caller.id).run();
  return { ok: true };
};

/**
 * The auth routes, as definitions to hand `serverApp`'s `endpoints`:
 * `POST /api/auth/otp`, `POST /api/auth/verify`, the public
 * `POST /identity/:name` an identity answers, and the signed-in `GET /me`,
 * `PATCH /profile`, `POST /refresh` and `POST /delete`.
 */
export const authEndpoints = (options: AuthOptions): Endpoint[] => [
  defineEndpoint({ path: "/api/auth/otp", method: "POST", access: "public", handler: requestCode(options) }),
  defineEndpoint({ path: "/api/auth/verify", method: "POST", access: "public", handler: verifyCode(options) }),
  defineEndpoint({ path: "/api/auth/identity/:name", method: "POST", access: "public", handler: identity(options) }),
  defineEndpoint({ path: "/api/auth/me", method: "GET", access: "auth", handler: me(options) }),
  defineEndpoint({ path: "/api/auth/profile", method: "PATCH", access: "auth", handler: profile(options) }),
  defineEndpoint({ path: "/api/auth/refresh", method: "POST", access: "auth", handler: refresh(options) }),
  defineEndpoint({ path: "/api/auth/delete", method: "POST", access: "auth", handler: remove(options) }),
];
