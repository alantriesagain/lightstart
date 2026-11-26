/// <reference lib="dom" />
/**
 * @file The `auth` controller: sign in by a code mailed to an address, keep
 * the session token, and read or change the signed-in person over
 * `/api/auth`. Every call answers `{ ok: true, ... } | { error, status }` and
 * never throws (a network failure is `{ error, status: 0 }`); a 401 on a call
 * that carried the token signs out. On start it reloads a stored token, and it
 * hands the same token to `@lightstart/api`'s `configureApi`.
 */

import { defineController } from "@lightstart/light/controller";
import { configureApi } from "@lightstart/api/page";
import type { AuthUser } from "../server/types.ts";
import { authFetch, authPrefix, readToken, writeToken } from "./session.ts";

/** Why a call failed: the server's message, and its status (0 for a network failure). */
export interface AuthError {
  ok?: false;
  error: string;
  status: number;
}

/** What every auth call answers: the success payload, or `AuthError`. */
export type AuthResult<T extends object = Record<string, unknown>> = ({ ok: true } & T) | AuthError;

/** What signing in with an identity answers: a device still waiting, a session, or why it failed. */
export type IdentityResult = { pending: true } | { ok: true; user: AuthUser } | AuthError;

type Outcome = ({ ok: true; body: unknown; token: string | null }) | AuthError;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const userOf = (value: unknown): AuthUser | null => {
  if (!isRecord(value)) return null;
  const user = value["user"];
  if (!isRecord(user)) return null;
  const id = user["id"];
  const name = user["name"];
  const admin = user["admin"];
  if (typeof id !== "string" || typeof name !== "string" || typeof admin !== "boolean") return null;
  return {
    ...user,
    id,
    name,
    admin,
    email: typeof user["email"] === "string" ? user["email"] : null,
  };
};

const messageOf = (body: unknown, status: number): string => {
  if (isRecord(body)) {
    const error = body["error"];
    if (typeof error === "string" && error !== "") return error;
    const message = body["message"];
    if (typeof message === "string" && message !== "") return message;
  }
  return `The auth request failed (${String(status)})`;
};

const urlOf = (path: string): string => `${authPrefix()}/api/auth${path}`;

const readBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const auth = defineController({
  name: "auth",
  props: {
    user: null as AuthUser | null,
    loaded: false,
  },

  async connected() {
    configureApi({ token: () => readToken() });
    const token = readToken();
    if (token !== null && token !== "") await this.reload();
    this.loaded = true;
  },

  async _send(method: string, path: string, options: { body?: Record<string, unknown>; auth?: boolean } = {}): Promise<Outcome> {
    const token = options.auth === true ? readToken() : null;
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (token !== null && token !== "") headers["authorization"] = `Bearer ${token}`;
    const init: RequestInit = { method, headers };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    try {
      const response = await authFetch()(urlOf(path), init);
      const body = await readBody(response);
      if (!response.ok) {
        if (response.status === 401 && token !== null && token !== "") this._signOut();
        return { ok: false, error: messageOf(body, response.status), status: response.status };
      }
      return { ok: true, body, token };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error), status: 0 };
    }
  },

  _signOut() {
    writeToken(null);
    this.user = null;
  },

  /** Mail a 6-digit code to `email`, valid for ten minutes. */
  async requestCode(email: string): Promise<AuthResult> {
    const result = await this._send("POST", "/otp", { body: { email } });
    if (!result.ok) return result;
    return { ok: true };
  },

  /** Trade the mailed code for a session: store the token and set `user`. */
  async verifyCode(email: string, code: string): Promise<AuthResult<{ user: AuthUser }>> {
    const result = await this._send("POST", "/verify", { body: { email, code } });
    if (!result.ok) return result;
    const record = isRecord(result.body) ? result.body : {};
    const token = typeof record["token"] === "string" ? record["token"] : null;
    const user = userOf(record);
    if (token === null || user === null) return { error: "The server answered no session", status: 502 };
    writeToken(token);
    this.user = user;
    return { ok: true, user };
  },

  /**
   * Trade an identity's redemption for a session: a waiting one answers
   * `{ pending: true }`, a signed-in one stores the token and sets `user`.
   * A session held now is linked to the identity.
   */
  async signInWithIdentity(name: string, body: Record<string, unknown> = {}): Promise<IdentityResult> {
    const result = await this._send("POST", `/identity/${encodeURIComponent(name)}`, { auth: true, body });
    if (!result.ok) return result;
    const record = isRecord(result.body) ? result.body : {};
    if (record["pending"] === true) return { pending: true };
    const token = typeof record["token"] === "string" ? record["token"] : null;
    const user = userOf(record);
    if (token === null || user === null) return { error: "The server answered no session", status: 502 };
    writeToken(token);
    this.user = user;
    return { ok: true, user };
  },

  /** Drop the token and the user; the next call carries no session. */
  signOut(): AuthResult {
    this._signOut();
    return { ok: true };
  },

  /** Change the signed-in person's profile fields and keep the answer. */
  async updateProfile(patch: Record<string, unknown>): Promise<AuthResult<{ user: AuthUser }>> {
    const result = await this._send("PATCH", "/profile", { auth: true, body: patch });
    if (!result.ok) return result;
    const user = userOf(result.body);
    if (user === null) return { error: "The server answered no user", status: 502 };
    this.user = user;
    return { ok: true, user };
  },

  /** Delete the account, then sign out. */
  async deleteAccount(): Promise<AuthResult> {
    const result = await this._send("POST", "/delete", { auth: true });
    if (!result.ok) return result;
    this._signOut();
    return { ok: true };
  },

  /** Read the signed-in person from `/me` when a token is held. */
  async reload(): Promise<AuthResult<{ user: AuthUser | null }>> {
    const token = readToken();
    if (token === null || token === "") return { ok: true, user: null };
    const result = await this._send("GET", "/me", { auth: true });
    if (!result.ok) return result;
    const user = userOf(result.body);
    if (user === null) return { error: "The server answered no user", status: 502 };
    this.user = user;
    return { ok: true, user };
  },
});

export default auth;
export { auth };
