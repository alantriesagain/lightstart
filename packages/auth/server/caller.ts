/**
 * @file The `caller` an app's `serverApp` takes: a bearer token is verified
 * with `env.JWT_SECRET`, and its `sub` becomes the caller; a missing, bad or
 * expired token is nobody. Given the database, the caller must still have a
 * `users` row, and `admin` is read from it, so a deleted account or a revoked
 * admin takes effect at once rather than when the token expires.
 */

import type { Caller, D1Like } from "@lightstart/api/server";

import { verifyToken } from "./jwt.ts";

const bearerOf = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (header === null) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim() ?? "";
  return token === "" ? null : token;
};

/**
 * A caller function over `env`: it answers `{ id, admin }` from a valid
 * bearer token, or null. With `db`, a token whose user is gone is nobody and
 * `admin` comes from the row. `@lightstart/api`'s `serverApp` takes it as its
 * `caller`.
 */
export const callerFromRequest = (env: Record<string, unknown>, db?: () => D1Like | Promise<D1Like>) => {
  return async (request: Request): Promise<Caller> => {
    const secret = env["JWT_SECRET"];
    if (typeof secret !== "string") return null;
    const token = bearerOf(request);
    if (token === null) return null;
    const payload = await verifyToken(token, secret);
    if (payload === null) return null;
    const id = payload["sub"];
    if (typeof id !== "string" || id === "") return null;
    if (db === undefined) return { id, admin: payload["admin"] === true };
    const row = await (await db()).prepare("SELECT admin FROM users WHERE id = ?").bind(id).first();
    if (row === null) return null;
    const admin = row["admin"];
    return { id, admin: admin === true || admin === 1 };
  };
};
