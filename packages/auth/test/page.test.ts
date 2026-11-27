// node-only
/// <reference lib="dom" />
/**
 * @file The `auth` page over a fake `/api/auth` held in memory: sign-in,
 * reload, a 401 that signs out, profile and delete, a network failure, the
 * token `configureApi` hands the api store, and `safeNext`'s refusals.
 */

import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import type { App } from "@lightstart/app";
import { ApiAdapterType, configureApi } from "@lightstart/api/page";
import type { AuthUser } from "../server/types.ts";
import { auth, configureAuth, readToken, safeNext, writeToken } from "../page/index.ts";

const CODE = "123456";

let users = new Map<string, AuthUser>();
let tokens = new Map<string, string>();
let emailed = "";
let offline = false;

const storage = {
  map: new Map<string, string>(),
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  },
  removeItem(key: string): void {
    this.map.delete(key);
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const bodyOf = (init: RequestInit | undefined): Record<string, unknown> => {
  if (typeof init?.body !== "string" || init.body === "") return {};
  try {
    const value: unknown = JSON.parse(init.body);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
};

const bearerOf = (init: RequestInit | undefined): string | null => {
  const header = new Headers(init?.headers).get("authorization");
  return header !== null && header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
};

const text = (value: unknown): string => (value === null ? "null" : value === undefined ? "undefined" : String(value));

const respond = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const fakeFetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(href, "http://app.test").pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  if (offline) return Promise.reject(new Error("network down"));
  const body = bodyOf(init);
  const bearer = bearerOf(init);
  const session = (): { email: string; user: AuthUser } | null => {
    if (bearer === null) return null;
    const email = tokens.get(bearer);
    if (email === undefined) return null;
    const user = users.get(email);
    return user === undefined ? null : { email, user };
  };

  if (path === "/api/auth/otp" && method === "POST") {
    const email = body["email"];
    if (typeof email !== "string") return Promise.resolve(respond({ error: "An email is required" }, 400));
    emailed = email;
    return Promise.resolve(respond({ ok: true }));
  }

  if (path === "/api/auth/verify" && method === "POST") {
    const email = body["email"];
    if (typeof email !== "string" || body["code"] !== CODE) return Promise.resolve(respond({ error: "That code is not right" }, 400));
    let user = users.get(email);
    if (user === undefined) {
      user = { id: `u-${String(users.size + 1)}`, email, name: "", admin: false };
      users.set(email, user);
    }
    const token = `token-${email}`;
    tokens.set(token, email);
    return Promise.resolve(respond({ token, user }));
  }

  if (path.startsWith("/api/auth/identity/") && method === "POST") {
    const name = decodeURIComponent(path.slice("/api/auth/identity/".length));
    if (name === "unknown") return Promise.resolve(respond({ error: "no such identity" }, 404));
    if (name === "waiting") return Promise.resolve(respond({ pending: true }, 202));
    const key = `identity-${name}`;
    let user = users.get(key);
    if (user === undefined) {
      user = { id: key, email: null, name: "", admin: false };
      users.set(key, user);
    }
    const token = `token-${key}`;
    tokens.set(token, key);
    return Promise.resolve(respond({ token, user }));
  }

  if (path === "/api/auth/providers" && method === "GET") {
    return Promise.resolve(respond({ providers: ["github", "google"] }));
  }

  if (path === "/api/auth/oauth/redeem" && method === "POST") {
    if (body["code"] !== "good") return Promise.resolve(respond({ error: "invalid or expired code" }, 401));
    const email = "oauth@example.com";
    let user = users.get(email);
    if (user === undefined) {
      user = { id: "u-oauth", email, name: "OAuth Person", admin: false };
      users.set(email, user);
    }
    const token = `token-${email}`;
    tokens.set(token, email);
    return Promise.resolve(respond({ token, user }));
  }

  if (path === "/api/auth/me" && method === "GET") {
    const current = session();
    if (current === null) return Promise.resolve(respond({ error: "Unauthorized" }, 401));
    return Promise.resolve(respond({ user: current.user }));
  }

  if (path === "/api/auth/profile" && method === "PATCH") {
    const current = session();
    if (current === null) return Promise.resolve(respond({ error: "Unauthorized" }, 401));
    for (const [key, value] of Object.entries(body)) current.user[key] = value;
    users.set(current.email, current.user);
    return Promise.resolve(respond({ user: current.user }));
  }

  if (path === "/api/auth/delete" && method === "POST") {
    const current = session();
    if (current === null) return Promise.resolve(respond({ error: "Unauthorized" }, 401));
    users.delete(current.email);
    if (bearer !== null) tokens.delete(bearer);
    return Promise.resolve(respond({ ok: true }));
  }

  return Promise.resolve(respond({ error: "No route" }, 404));
}) as typeof fetch;

const reset = (): void => {
  users = new Map();
  tokens = new Map();
  emailed = "";
  offline = false;
  storage.map.clear();
};

const main = async (): Promise<void> => {
  reset();
  configureAuth({ fetch: fakeFetch, storage, prefix: "" });
  await auth.dispose();

  const requested = await auth.requestCode("ada@example.com");
  ok("requestCode answers ok", requested.ok === true);
  eq("requestCode mails the code to the address", emailed, "ada@example.com");

  const verified = await auth.verifyCode("ada@example.com", CODE);
  ok("verifyCode answers ok", verified.ok === true);
  if (verified.ok) eq("verifyCode sets the user", text(verified.user.email), "ada@example.com");
  eq("verifyCode stores the token", text(readToken()), "token-ada@example.com");
  eq("the controller holds the user", text(auth.user?.email), "ada@example.com");

  const updated = await auth.updateProfile({ name: "Ada Lovelace" });
  ok("updateProfile answers ok", updated.ok === true);
  if (updated.ok) eq("updateProfile answers the user", updated.user.name, "Ada Lovelace");
  eq("updateProfile sets the controller's user", text(auth.user?.name), "Ada Lovelace");

  await auth.dispose();
  await auth.$ready;
  eq("a stored token reloads the user", text(auth.user?.email), "ada@example.com");
  ok("loaded is set once start settles", auth.loaded === true);

  await auth.dispose();
  writeToken("not-a-session");
  await auth.$ready;
  eq("a 401 on /me clears the token", text(readToken()), "null");
  eq("a 401 on /me clears the user", text(auth.user), "null");
  ok("loaded is set after a failed reload", auth.loaded === true);

  await auth.verifyCode("ada@example.com", CODE);
  await auth.signOut();
  eq("signOut clears the token", text(readToken()), "null");
  eq("signOut clears the user", text(auth.user), "null");

  await auth.verifyCode("ada@example.com", CODE);
  const deleted = await auth.deleteAccount();
  ok("deleteAccount answers ok", deleted.ok === true);
  eq("deleteAccount clears the token", text(readToken()), "null");
  eq("deleteAccount clears the user", text(auth.user), "null");
  ok("deleteAccount removes the account", !users.has("ada@example.com"));

  offline = true;
  const failed = await auth.requestCode("ada@example.com");
  offline = false;
  ok("a network failure answers an error", failed.ok === false);
  if (!failed.ok) {
    eqn("a network failure has status 0", failed.status, 0);
    ok("a network failure carries a message", failed.error.length > 0);
  }

  const pending = await auth.signInWithIdentity("waiting", {});
  ok("signInWithIdentity answers pending", "pending" in pending && pending.pending === true);

  const identified = await auth.signInWithIdentity("fake", { id: "wa-1" });
  ok("signInWithIdentity answers ok", "user" in identified);
  if ("user" in identified) eq("signInWithIdentity sets the user", text(identified.user.id), "identity-fake");
  eq("signInWithIdentity stores the token", text(readToken()), "token-identity-fake");
  eq("the controller holds the identity's user", text(auth.user?.id), "identity-fake");

  const missingIdentity = await auth.signInWithIdentity("unknown", {});
  ok("an unknown identity answers an error", "status" in missingIdentity);
  if ("status" in missingIdentity) eqn("with its status", missingIdentity.status, 404);

  await auth.verifyCode("ada@example.com", CODE);
  const authHeaders: Array<string | null> = [];
  const apiFetch = ((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    authHeaders.push(new Headers(init?.headers).get("authorization"));
    return Promise.resolve(respond({ rows: [], total: 0 }));
  }) as typeof fetch;
  configureApi({ fetch: apiFetch, prefix: "" });
  const app = { name: "test" } as unknown as App;
  const store = await new ApiAdapterType().open(app, "api", "", {}, true);
  await store.query("thing", {});
  eq("the api store sends the stored token", authHeaders[0] ?? "", `Bearer ${readToken() ?? ""}`);

  for (const target of ["//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/x", "/x\u007f", "https://evil.example", " /x"])
    eq(`safeNext refuses ${JSON.stringify(target)}`, safeNext(target), "/");
  eq("safeNext keeps a path with a query and hash", safeNext("/x?y#z"), "/x?y#z");
  eq("safeNext keeps the root", safeNext("/"), "/");

  const providers = await auth.providers();
  ok("providers answers ok", providers.ok === true);
  if (providers.ok) eq("providers lists what the server knows", JSON.stringify(providers.providers), JSON.stringify(["github", "google"]));

  const globals = globalThis as unknown as {
    location?: { href: string; hash: string; pathname: string; search: string; replace: (url: string) => void };
    history?: { replaceState: (data: unknown, title: string, url: string) => void };
  };
  const previousLocation = globals.location;
  const previousHistory = globals.history;
  let replaced = "";
  const browser = {
    href: "",
    hash: "",
    pathname: "/app",
    search: "?a=1",
    replace(url: string): void {
      replaced = url;
    },
  };
  globals.location = browser;
  globals.history = {
    replaceState(_data: unknown, _title: string, url: string): void {
      const hashAt = url.indexOf("#");
      browser.hash = hashAt < 0 ? "" : url.slice(hashAt);
      const rest = hashAt < 0 ? url : url.slice(0, hashAt);
      const queryAt = rest.indexOf("?");
      browser.pathname = queryAt < 0 ? rest : rest.slice(0, queryAt);
      browser.search = queryAt < 0 ? "" : rest.slice(queryAt);
    },
  };

  auth.signInWithOAuth("google", "//evil.example");
  eq("signInWithOAuth sends the page to the start route", browser.href, "/api/auth/oauth/google/start?next=%2F");
  auth.signInWithOAuth("github", "/after?x=1");
  eq("signInWithOAuth keeps a safe next", browser.href, "/api/auth/oauth/github/start?next=%2Fafter%3Fx%3D1");

  browser.search = "?code=abc&state=xyz";
  replaced = "";
  ok("forwardOAuthCallback answers true with a code", auth.forwardOAuthCallback() === true);
  eq("and forwards to the provider-less callback", replaced, "/api/auth/oauth/callback?code=abc&state=xyz");

  browser.search = "?error=access_denied&state=xyz";
  replaced = "";
  ok("forwardOAuthCallback forwards an error", auth.forwardOAuthCallback() === true);
  eq("to the callback too", replaced, "/api/auth/oauth/callback?error=access_denied&state=xyz");

  browser.search = "?a=1";
  replaced = "";
  ok("forwardOAuthCallback answers false without code or error", auth.forwardOAuthCallback() === false);
  eq("and replaces nothing", replaced, "");

  browser.hash = "#auth_code=good";
  const completed = await auth.completeOAuth();
  ok("completeOAuth with a code signs in", completed.ok === true);
  if (completed.ok) eq("completeOAuth answers the user", text(completed.user.email), "oauth@example.com");
  eq("completeOAuth drops the fragment", browser.hash, "");
  eq("completeOAuth stores the token", text(readToken()), "token-oauth@example.com");
  eq("completeOAuth clears the error", text(auth.oauthError), "null");

  browser.hash = "#auth_error=denied";
  const refused = await auth.completeOAuth();
  ok("completeOAuth with an error answers it", "error" in refused);
  if ("error" in refused) {
    eq("with the provider's code", refused.error, "denied");
    eqn("and status 0", refused.status, 0);
  }
  eq("completeOAuth drops the error fragment", browser.hash, "");
  eq("and keeps it in oauthError", text(auth.oauthError), "denied");

  browser.hash = "";
  const nothing = await auth.completeOAuth();
  ok("completeOAuth with nothing answers none", nothing.ok === false && "none" in nothing && nothing.none === true);

  if (previousLocation === undefined) delete globals.location;
  else globals.location = previousLocation;
  if (previousHistory === undefined) delete globals.history;
  else globals.history = previousHistory;

  await auth.dispose();
  done();
};

await main();
