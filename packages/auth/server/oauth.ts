/**
 * @file Sign-in with Google and GitHub over OAuth 2.0: the authorize redirect,
 * the callback that links a provider account to a `users` row, and the
 * single-use hand-off the page redeems for a session. A provider is enabled
 * only while its client id and secret are set. Everything uses Web Crypto and
 * `fetch`, so it runs on a Worker as well as node.
 */

import { HttpError, parseCookies } from "@lightstart/server";
import { defineEndpoint, type D1Like, type Endpoint, type EndpointRequest } from "@lightstart/api/server";

import { safeNext } from "../page/next.ts";

type Row = Record<string, unknown>;

/** The signed-in account a provider answers, before it is linked to a `users` row. */
export interface OAuthAccount {
  provider: string;
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
}

/** The client and endpoints of one provider. */
interface Provider {
  name: string;
  /** The environment names holding the client id and secret. */
  idVar: string;
  secretVar: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Extra authorize parameters, such as Google's account chooser. */
  extraAuthorize?: Record<string, string>;
  /** Read the account from the token exchange and its profile endpoints. */
  account(env: Record<string, unknown>, accessToken: string): Promise<OAuthAccount>;
}

/** What `oauthEndpoints` needs from the auth routes around it. */
export interface OAuthOptions {
  /** The clock, `Date.now` by default, so a test can move it. */
  now?: () => number;
  /** The session for a user id, or null when that user is gone. */
  session(userId: string, db: D1Like, env: Record<string, unknown>): Promise<{ token: string; user: Row } | null>;
  /** Create an account with a verified email and the provider's name. */
  createUser(db: D1Like, email: string, name: string): Promise<Row>;
}

const COOKIE = "lightstart_oauth";
const COOKIE_PATH = "/api/auth/oauth";
const STATE_TTL_MS = 10 * 60 * 1000;
const HANDOFF_TTL_MS = 60 * 1000;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const LOOKUP: Record<string, number> = {};
for (let index = 0; index < ALPHABET.length; index++) LOOKUP[ALPHABET[index] as string] = index;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const encodeBase64Url = (bytes: Uint8Array): string => {
  let out = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] as number;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    out += ALPHABET[(value >> 18) & 63] as string;
    out += ALPHABET[(value >> 12) & 63] as string;
    if (second !== undefined) out += ALPHABET[(value >> 6) & 63] as string;
    if (third !== undefined) out += ALPHABET[value & 63] as string;
  }
  return out;
};

const decodeBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of text.replace(/=+$/, "")) {
    const value = LOOKUP[char];
    if (value === undefined) throw new Error("invalid base64url");
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
};

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

const randomToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
};

const secretOf = (env: Record<string, unknown>): string => {
  const secret = env["JWT_SECRET"];
  if (typeof secret !== "string" || encoder.encode(secret).length < 32) {
    throw new HttpError(500, "JWT_SECRET must be a string of at least 32 bytes");
  }
  return secret;
};

const hmac = async (secret: string, data: string): Promise<Uint8Array<ArrayBuffer>> => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
};

const hmacBase64 = async (secret: string, data: string): Promise<string> => encodeBase64Url(await hmac(secret, data));

const hmacHex = async (secret: string, data: string): Promise<string> => {
  let out = "";
  for (const byte of await hmac(secret, data)) out += byte.toString(16).padStart(2, "0");
  return out;
};

const same = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

const checkedJson = async (response: Response): Promise<unknown> => {
  if (!response.ok) throw new Error(`the provider answered ${String(response.status)}`);
  return response.json() as Promise<unknown>;
};

const accessTokenOf = async (response: Response): Promise<string> => {
  const body = await checkedJson(response);
  if (!isRecord(body)) throw new Error("the provider answered no token");
  const token = body["access_token"];
  if (typeof token !== "string" || token === "") throw new Error("the provider answered no token");
  return token;
};

const bearer = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` });

const google: Provider = {
  name: "google",
  idVar: "GOOGLE_CLIENT_ID",
  secretVar: "GOOGLE_CLIENT_SECRET",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scope: "openid email profile",
  extraAuthorize: { prompt: "select_account" },
  async account(_env: Record<string, unknown>, accessToken: string): Promise<OAuthAccount> {
    const body = await checkedJson(await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: bearer(accessToken) }));
    if (!isRecord(body)) throw new Error("the provider answered no account");
    const sub = body["sub"];
    if (typeof sub !== "string" || sub === "") throw new Error("the provider answered no account");
    const email = typeof body["email"] === "string" ? body["email"] : null;
    const name = typeof body["name"] === "string" ? body["name"] : "";
    return { provider: "google", id: sub, email, emailVerified: body["email_verified"] === true, name };
  },
};

const GITHUB_HEADERS: Record<string, string> = {
  accept: "application/vnd.github+json",
  "user-agent": "lightstart-auth",
};

const github: Provider = {
  name: "github",
  idVar: "GITHUB_CLIENT_ID",
  secretVar: "GITHUB_CLIENT_SECRET",
  authorizeUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  scope: "read:user user:email",
  async account(_env: Record<string, unknown>, accessToken: string): Promise<OAuthAccount> {
    const headers = { ...bearer(accessToken), ...GITHUB_HEADERS };
    const user = await checkedJson(await fetch("https://api.github.com/user", { headers }));
    if (!isRecord(user)) throw new Error("the provider answered no account");
    const id = user["id"];
    if (typeof id !== "number") throw new Error("the provider answered no account");
    const login = typeof user["login"] === "string" ? user["login"] : "";
    const name = typeof user["name"] === "string" && user["name"] !== "" ? user["name"] : login;

    const emails = await checkedJson(await fetch("https://api.github.com/user/emails", { headers }));
    if (!Array.isArray(emails)) throw new Error("the provider answered no emails");
    let email: string | null = null;
    for (const entry of emails) {
      if (!isRecord(entry) || entry["primary"] !== true || entry["verified"] !== true) continue;
      if (typeof entry["email"] === "string") {
        email = entry["email"];
        break;
      }
    }
    return { provider: "github", id: String(id), email, emailVerified: email !== null, name };
  },
};

const PROVIDERS: Record<string, Provider> = { google, github };

const enabled = (provider: Provider, env: Record<string, unknown>): boolean => {
  const id = env[provider.idVar];
  const secret = env[provider.secretVar];
  return typeof id === "string" && id !== "" && typeof secret === "string" && secret !== "";
};

const providerOf = (name: string, env: Record<string, unknown>): Provider | null => {
  const provider = Object.hasOwn(PROVIDERS, name) ? PROVIDERS[name] : undefined;
  if (provider === undefined || !enabled(provider, env)) return null;
  return provider;
};

const originOf = (request: Request, env: Record<string, unknown>): string => {
  const configured = env["AUTH_ORIGIN"];
  if (typeof configured === "string") return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
};

const redirectPathOf = (env: Record<string, unknown>): string | null => {
  const raw = env["AUTH_OAUTH_REDIRECT_PATH"];
  if (raw === undefined || raw === null) return null;
  const valid =
    typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\") &&
    ![...raw].some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127;
    });
  if (!valid) {
    throw new HttpError(500, "AUTH_OAUTH_REDIRECT_PATH must be a path starting with / without //, \\ or control characters");
  }
  return raw;
};

const redirectUriOf = (request: Request, env: Record<string, unknown>, provider: string): string => {
  const path = redirectPathOf(env);
  return path === null ? `${originOf(request, env)}/api/auth/oauth/${provider}/callback` : `${originOf(request, env)}${path}`;
};

const nextOf = (raw: string | undefined): string => {
  const safe = safeNext(raw);
  const cut = safe.indexOf("#");
  if (cut < 0) return safe;
  const path = safe.slice(0, cut);
  return path === "" ? "/" : path;
};

interface State {
  p: string;
  n: string;
  v: string;
  next: string;
  exp: number;
}

const signState = async (state: State, secret: string): Promise<string> => {
  const payload = encodeBase64Url(encoder.encode(JSON.stringify(state)));
  return `${payload}.${await hmacBase64(`oauth-state:${secret}`, payload)}`;
};

const readState = async (cookie: string, secret: string): Promise<State | null> => {
  try {
    const parts = cookie.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts as [string, string];
    if (!same(await hmacBase64(`oauth-state:${secret}`, payload), signature)) return null;
    const value: unknown = JSON.parse(decoder.decode(decodeBase64Url(payload)));
    if (!isRecord(value)) return null;
    const p = value["p"];
    const n = value["n"];
    const v = value["v"];
    const next = value["next"];
    const exp = value["exp"];
    if (typeof p !== "string" || typeof n !== "string" || typeof v !== "string" || typeof next !== "string" || typeof exp !== "number") return null;
    return { p, n, v, next, exp };
  } catch {
    return null;
  }
};

const cookieValue = (value: string): string => `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=${COOKIE_PATH}; Max-Age=600`;

const clearingCookie = (): string => `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=${COOKIE_PATH}; Max-Age=0`;

const nowOf = (options: OAuthOptions): number => (options.now ?? Date.now)();

const finish = (next: string, fragment: string): Response =>
  new Response(null, {
    status: 302,
    headers: {
      location: `${next}#${fragment}`,
      "set-cookie": clearingCookie(),
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });

/**
 * The same start on `AUTH_ORIGIN`'s host when the request came in on another
 * (`www.` beside the apex): the state cookie is set where the provider brings
 * the person back, or the callback finds none. Null when it is already there.
 */
const onConfiguredHost = (request: Request, env: Record<string, unknown>): Response | null => {
  const configured = env["AUTH_ORIGIN"];
  if (typeof configured !== "string" || configured === "") return null;
  const target = new URL(configured).origin;
  const url = new URL(request.url);
  if (url.origin === target) return null;
  return new Response(null, { status: 302, headers: { location: `${target}${url.pathname}${url.search}`, "cache-control": "no-store" } });
};

const start = (options: OAuthOptions) => async (request: EndpointRequest): Promise<Response> => {
  const provider = providerOf(request.params["provider"] ?? "", request.env);
  if (provider === null) throw new HttpError(404, "no such provider");
  const moved = onConfiguredHost(request.request, request.env);
  if (moved !== null) return moved;
  const secret = secretOf(request.env);
  const now = nowOf(options);
  const nonce = randomToken();
  const verifier = randomToken();
  const next = nextOf(request.query["next"]);
  const redirectUri = redirectUriOf(request.request, request.env, provider.name);
  const challenge = encodeBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));

  const url = new URL(provider.authorizeUrl);
  url.searchParams.set("client_id", String(request.env[provider.idVar]));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scope);
  url.searchParams.set("state", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  for (const [name, value] of Object.entries(provider.extraAuthorize ?? {})) url.searchParams.set(name, value);

  const state = await signState({ p: provider.name, n: nonce, v: verifier, next, exp: now + STATE_TTL_MS }, secret);
  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), "set-cookie": cookieValue(state), "cache-control": "no-store" },
  });
};

const callbackFor = (options: OAuthOptions, providerName: string) => async (request: EndpointRequest): Promise<Response> => {
  const provider = providerOf(providerName, request.env);
  if (provider === null) throw new HttpError(404, "no such provider");
  const secret = secretOf(request.env);
  const now = nowOf(options);
  const rawCookie = parseCookies(request.request.headers.get("cookie")).get(COOKIE);
  const state = rawCookie === undefined ? null : await readState(rawCookie, secret);
  const next = state?.next ?? "/";
  const refuse = (code: string): Response => finish(next, `auth_error=${code}`);

  if (state === null || state.exp < now) return refuse("state");
  if (state.p !== provider.name) return refuse("state");
  if (!same(state.n, request.query["state"] ?? "")) return refuse("state");
  if (typeof request.query["error"] === "string") return refuse("denied");

  const code = request.query["code"];
  if (typeof code !== "string" || code === "") return refuse("provider");

  let account: OAuthAccount;
  try {
    const redir = redirectUriOf(request.request, request.env, provider.name);
    const token = await accessTokenOf(
      await fetch(provider.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          code,
          client_id: String(request.env[provider.idVar]),
          client_secret: String(request.env[provider.secretVar]),
          redirect_uri: redir,
          grant_type: "authorization_code",
          code_verifier: state.v,
        }).toString(),
      }),
    );
    account = await provider.account(request.env, token);
  } catch {
    return refuse("provider");
  }

  if (!account.emailVerified || account.email === null || account.email.trim() === "") return refuse("email");
  const email = account.email.trim().toLowerCase();

  let user: Row | null = null;
  const linked = await request.db
    .prepare("SELECT * FROM oauth_accounts WHERE provider = ? AND provider_id = ?")
    .bind(provider.name, account.id)
    .first();
  if (linked !== null) {
    user = await request.db.prepare("SELECT * FROM users WHERE id = ?").bind(String(linked["user_id"])).first();
    if (user === null) {
      await request.db.prepare("DELETE FROM oauth_accounts WHERE id = ?").bind(String(linked["id"])).run();
    }
  }
  if (user === null) {
    user = await request.db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (user === null) user = await options.createUser(request.db, email, account.name);
    await request.db
      .prepare("INSERT INTO oauth_accounts (id, provider, provider_id, user_id) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), provider.name, account.id, String(user["id"]))
      .run();
  }

  const handoff = randomToken();
  await request.db.prepare("DELETE FROM auth_handoffs WHERE expires < ?").bind(now).run();
  await request.db
    .prepare("INSERT INTO auth_handoffs (id, code, user_id, expires) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), await hmacHex(`oauth-handoff:${secret}`, handoff), String(user["id"]), now + HANDOFF_TTL_MS)
    .run();
  return finish(next, `auth_code=${encodeURIComponent(handoff)}`);
};

const providerlessCallback = (options: OAuthOptions) => async (request: EndpointRequest): Promise<Response> => {
  const secret = secretOf(request.env);
  const now = nowOf(options);
  const rawCookie = parseCookies(request.request.headers.get("cookie")).get(COOKIE);
  const state = rawCookie === undefined ? null : await readState(rawCookie, secret);
  if (state === null || state.exp < now) return finish("/", "auth_error=state");
  return callbackFor(options, state.p)(request);
};

const redeem = (options: OAuthOptions) => async (request: EndpointRequest): Promise<unknown> => {
  const secret = secretOf(request.env);
  if (!isRecord(request.body)) throw new HttpError(401, "invalid or expired code");
  const code = request.body["code"];
  if (typeof code !== "string" || code === "") throw new HttpError(401, "invalid or expired code");

  const now = nowOf(options);
  const row = await request.db
    .prepare("DELETE FROM auth_handoffs WHERE code = ? RETURNING user_id, expires")
    .bind(await hmacHex(`oauth-handoff:${secret}`, code))
    .first();
  if (row === null) throw new HttpError(401, "invalid or expired code");
  if (Number(row["expires"]) < now) throw new HttpError(401, "invalid or expired code");

  const answer = await options.session(String(row["user_id"]), request.db, request.env);
  if (answer === null) throw new HttpError(401, "invalid or expired code");
  return answer;
};

/**
 * The OAuth routes, beside the code routes: the providers list, the start and
 * callback legs of a provider's sign-in, and the single-use redeem the page
 * trades a hand-off for a session with. Every one is public.
 */
export const oauthEndpoints = (options: OAuthOptions): Endpoint[] => [
  defineEndpoint({
    path: "/api/auth/providers",
    method: "GET",
    access: "public",
    handler: (request) => ({
      providers: Object.values(PROVIDERS)
        .filter((provider) => enabled(provider, request.env))
        .map((provider) => provider.name)
        .sort(),
    }),
  }),
  defineEndpoint({ path: "/api/auth/oauth/:provider/start", method: "GET", access: "public", handler: start(options) }),
  defineEndpoint({
    path: "/api/auth/oauth/:provider/callback",
    method: "GET",
    access: "public",
    handler: (request) => callbackFor(options, request.params["provider"] ?? "")(request),
  }),
  defineEndpoint({ path: "/api/auth/oauth/callback", method: "GET", access: "public", handler: providerlessCallback(options) }),
  defineEndpoint({ path: "/api/auth/oauth/redeem", method: "POST", access: "public", handler: redeem(options) }),
];
