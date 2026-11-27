// node-only
/**
 * @file OAuth sign-in over `serverApp` and an in-memory database: the
 * providers list, the authorize redirect and its state cookie, the callback's
 * refusals, linking a provider account to a user, and the single-use hand-off
 * the page redeems. `fetch` is stubbed per case, so nothing leaves the test.
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
  type MailMessage,
  type Mailer,
} from "../server/index.ts";

type Row = Record<string, unknown>;

const SECRET = "0123456789abcdef0123456789abcdef";
const realFetch = globalThis.fetch;
let clock = Date.UTC(2026, 0, 1);

const mailer: Mailer = {
  send(_message: MailMessage): void {},
};

const baseEnv = (): Record<string, unknown> => ({
  JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  GITHUB_CLIENT_ID: "github-id",
  GITHUB_CLIENT_SECRET: "github-secret",
});

const setup = (env: Record<string, unknown>): { handle: (request: Request) => Promise<Response>; binding: ReturnType<typeof d1Of> } => {
  const db = Database.open(":memory:");
  applySchema(db, authModels);
  const binding = d1Of(db);
  const handle = toFetch(
    serverApp({
      models: authModels,
      endpoints: authEndpoints({ mailer, now: () => clock }),
      db: () => binding,
      caller: callerFromRequest(env),
      env,
    }),
  );
  return { handle, binding };
};

const get = (handle: (request: Request) => Promise<Response>, path: string, cookie?: string): Promise<Response> => {
  const headers: Record<string, string> = {};
  if (cookie !== undefined) headers["cookie"] = `lightstart_oauth=${cookie}`;
  return handle(new Request(new URL(path, "http://app.test"), { headers }));
};

const post = (handle: (request: Request) => Promise<Response>, path: string, body: unknown): Promise<Response> =>
  handle(
    new Request(new URL(path, "http://app.test"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const asJson = async (response: Response): Promise<Row> => (await response.json()) as Row;

const decodeBase64Url = (text: string): string => {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const encodeBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const cookieOf = (response: Response): string => {
  const raw = response.headers.get("set-cookie") ?? "";
  const first = raw.split(";")[0] ?? "";
  const eq = first.indexOf("=");
  return eq < 0 ? "" : first.slice(eq + 1);
};

const stateOf = (cookie: string): Row => {
  const payload = cookie.split(".")[0] ?? "";
  const value: unknown = JSON.parse(decodeBase64Url(payload));
  return typeof value === "object" && value !== null ? (value as Row) : {};
};

const startOf = async (handle: (request: Request) => Promise<Response>, provider: string, next?: string): Promise<{ response: Response; cookie: string; state: Row }> => {
  const query = next === undefined ? "" : `?next=${encodeURIComponent(next)}`;
  const response = await get(handle, `/api/auth/oauth/${provider}/start${query}`);
  const cookie = cookieOf(response);
  return { response, cookie, state: stateOf(cookie) };
};

const callbackOf = (
  handle: (request: Request) => Promise<Response>,
  provider: string,
  cookie: string | null,
  params: Record<string, string>,
): Promise<Response> => {
  const query = new URLSearchParams(params).toString();
  const headers: Record<string, string> = {};
  if (cookie !== null) headers["cookie"] = `lightstart_oauth=${cookie}`;
  return handle(new Request(new URL(`/api/auth/oauth/${provider}/callback?${query}`, "http://app.test"), { headers }));
};

const callbackAt = (
  handle: (request: Request) => Promise<Response>,
  path: string,
  cookie: string | null,
  params: Record<string, string>,
): Promise<Response> => {
  const query = new URLSearchParams(params).toString();
  const headers: Record<string, string> = {};
  if (cookie !== null) headers["cookie"] = `lightstart_oauth=${cookie}`;
  return handle(new Request(new URL(`${path}?${query}`, "http://app.test"), { headers }));
};

const splitLocation = (response: Response): { path: string; fragment: URLSearchParams } => {
  const location = response.headers.get("location") ?? "";
  const hash = location.indexOf("#");
  const path = hash < 0 ? location : location.slice(0, hash);
  const fragment = new URLSearchParams(hash < 0 ? "" : location.slice(hash + 1));
  return { path, fragment };
};

const withFetch = async (stub: typeof fetch, run: () => Promise<void>): Promise<void> => {
  globalThis.fetch = stub;
  try {
    await run();
  } finally {
    globalThis.fetch = realFetch;
  }
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const googleStub = (
  onToken?: (body: URLSearchParams) => void,
  account: Row = { sub: "google-1", email: "Alice@Example.com", email_verified: true, name: "Alice" },
): typeof fetch => {
  return ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "https://oauth2.googleapis.com/token") {
      if (onToken !== undefined && typeof init?.body === "string") onToken(new URLSearchParams(init.body));
      return Promise.resolve(jsonResponse({ access_token: "google-token" }));
    }
    if (url === "https://openidconnect.googleapis.com/v1/userinfo") return Promise.resolve(jsonResponse(account));
    return Promise.resolve(jsonResponse({ error: "unexpected" }, 500));
  }) as typeof fetch;
};

const githubStub = (emails: unknown): typeof fetch => {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "https://github.com/login/oauth/access_token") return Promise.resolve(jsonResponse({ access_token: "github-token" }));
    if (url === "https://api.github.com/user") return Promise.resolve(jsonResponse({ id: 42, login: "octo", name: "Octo Cat" }));
    if (url === "https://api.github.com/user/emails") return Promise.resolve(jsonResponse(emails));
    return Promise.resolve(jsonResponse({ error: "unexpected" }, 500));
  }) as typeof fetch;
};

const handoffHash = async (code: string): Promise<string> => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`oauth-handoff:${SECRET}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(code)));
  let out = "";
  for (const byte of digest) out += byte.toString(16).padStart(2, "0");
  return out;
};

const main = async (): Promise<void> => {
  {
    const { handle } = setup({ JWT_SECRET: SECRET });
    const response = await get(handle, "/api/auth/providers");
    eqn("/providers answers 200", response.status, 200);
    eq("with none enabled", JSON.stringify(await response.json()), JSON.stringify({ providers: [] }));
  }
  {
    const { handle } = setup({ JWT_SECRET: SECRET, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" });
    const body = await asJson(await get(handle, "/api/auth/providers"));
    eq("one enabled provider", JSON.stringify(body["providers"]), JSON.stringify(["google"]));
  }
  {
    const { handle } = setup(baseEnv());
    const body = await asJson(await get(handle, "/api/auth/providers"));
    eq("both enabled are sorted", JSON.stringify(body["providers"]), JSON.stringify(["github", "google"]));
  }

  {
    const { handle } = setup(baseEnv());
    eqn("a disabled provider's start is 404", (await get(handle, "/api/auth/oauth/nope/start")).status, 404);
  }
  {
    const { handle } = setup({ JWT_SECRET: SECRET, GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" });
    eqn("start refuses a provider whose env is not set", (await get(handle, "/api/auth/oauth/google/start")).status, 404);
  }

  {
    const { handle } = setup(baseEnv());
    clock = Date.UTC(2026, 0, 1);
    const { response, state } = await startOf(handle, "google", "/after?x=1#frag");
    eqn("start answers 302", response.status, 302);
    const location = new URL(response.headers.get("location") ?? "");
    eq("it goes to Google's authorize endpoint", location.origin + location.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    eq("with the client id", location.searchParams.get("client_id") ?? "", "google-id");
    eq("the callback as the redirect", location.searchParams.get("redirect_uri") ?? "", "http://app.test/api/auth/oauth/google/callback");
    eq("the requested scope", location.searchParams.get("scope") ?? "", "openid email profile");
    eq("response_type code", location.searchParams.get("response_type") ?? "", "code");
    eq("PKCE S256", location.searchParams.get("code_challenge_method") ?? "", "S256");
    ok("a challenge is present", (location.searchParams.get("code_challenge") ?? "") !== "");
    eq("Google's account chooser", location.searchParams.get("prompt") ?? "", "select_account");
    eq("the state is the cookie's nonce", location.searchParams.get("state") ?? "", String(state["n"]));
    eq("the cookie names Google", String(state["p"]), "google");
    eq("it keeps the next path, without its fragment", String(state["next"]), "/after?x=1");
    eqn("the state expires in ten minutes", Number(state["exp"]), clock + 10 * 60 * 1000);

    const cookie = response.headers.get("set-cookie") ?? "";
    ok("the cookie is HttpOnly", cookie.includes("; HttpOnly"));
    ok("the cookie is Secure", cookie.includes("; Secure"));
    ok("the cookie is SameSite=Lax", cookie.includes("; SameSite=Lax"));
    ok("the cookie covers the oauth routes", cookie.includes("; Path=/api/auth/oauth"));
    ok("the cookie lasts ten minutes", cookie.includes("; Max-Age=600"));

    const challenge = location.searchParams.get("code_challenge") ?? "";
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(state["v"]))));
    eq("the challenge is S256 of the verifier", encodeBase64Url(digest), challenge);

    for (const [raw, expected] of [["//evil.com", "/"], ["/a\r\nb", "/"], ["/ok?x=1", "/ok?x=1"]] as const) {
      const started = await startOf(handle, "google", raw);
      eq(`next ${JSON.stringify(raw)} is sanitized`, String(started.state["next"]), expected);
    }
  }

  {
    const { handle } = setup({ ...baseEnv(), AUTH_ORIGIN: "https://app.example/base/" });
    const { response } = await startOf(handle, "google");
    const location = new URL(response.headers.get("location") ?? "");
    eq("AUTH_ORIGIN sets the redirect, trailing slash stripped", location.searchParams.get("redirect_uri") ?? "", "https://app.example/base/api/auth/oauth/google/callback");
  }

  {
    const { handle } = setup(baseEnv());
    clock = Date.UTC(2026, 0, 1);
    const { cookie, state } = await startOf(handle, "google");
    const stateValue = String(state["n"]);

    const noCookie = await callbackOf(handle, "google", null, { code: "c", state: stateValue });
    eqn("a callback with no cookie is a 302", noCookie.status, 302);
    eq("and says the state was refused", splitLocation(noCookie).fragment.get("auth_error") ?? "", "state");
    eq("landing on /", splitLocation(noCookie).path, "/");
    ok("and clears the cookie", (noCookie.headers.get("set-cookie") ?? "").includes("Max-Age=0"));

    const tampered = `${cookie.slice(0, -1)}${cookie.endsWith("A") ? "B" : "A"}`;
    eq("a tampered signature is refused", splitLocation(await callbackOf(handle, "google", tampered, { code: "c", state: stateValue })).fragment.get("auth_error") ?? "", "state");

    clock += 10 * 60 * 1000 + 1;
    eq("an expired state is refused", splitLocation(await callbackOf(handle, "google", cookie, { code: "c", state: stateValue })).fragment.get("auth_error") ?? "", "state");
    clock = Date.UTC(2026, 0, 1);

    eq("a state mismatch is refused", splitLocation(await callbackOf(handle, "google", cookie, { code: "c", state: "wrong" })).fragment.get("auth_error") ?? "", "state");
    eq("another provider's cookie is refused", splitLocation(await callbackOf(handle, "github", cookie, { code: "c", state: stateValue })).fragment.get("auth_error") ?? "", "state");
    eq("a provider error is denied", splitLocation(await callbackOf(handle, "google", cookie, { error: "access_denied", state: stateValue })).fragment.get("auth_error") ?? "", "denied");

    await withFetch(() => Promise.resolve(jsonResponse({ error: "bad" }, 400)), async () => {
      eq("a failed token exchange is a provider error", splitLocation(await callbackOf(handle, "google", cookie, { code: "c", state: stateValue })).fragment.get("auth_error") ?? "", "provider");
    });
  }

  {
    const { handle } = setup(baseEnv());
    clock = Date.UTC(2026, 0, 1);
    const { cookie, state } = await startOf(handle, "github");
    await withFetch(githubStub([{ email: "octo@example.com", primary: true, verified: false }]), async () => {
      eq(
        "GitHub with no verified primary email is an email error",
        splitLocation(await callbackOf(handle, "github", cookie, { code: "c", state: String(state["n"]) })).fragment.get("auth_error") ?? "",
        "email",
      );
    });
  }

  {
    const { handle, binding } = setup(baseEnv());
    clock = Date.UTC(2026, 0, 1);
    let verifier = "";
    let challenge = "";
    const first = await startOf(handle, "google");
    challenge = new URL(first.response.headers.get("location") ?? "").searchParams.get("code_challenge") ?? "";

    let handoff = "";
    await withFetch(googleStub((body) => (verifier = body.get("code_verifier") ?? "")), async () => {
      const response = await callbackOf(handle, "google", first.cookie, { code: "auth-code", state: String(first.state["n"]) });
      eqn("the callback answers 302", response.status, 302);
      eq("no-store on the callback", response.headers.get("cache-control") ?? "", "no-store");
      eq("no-referrer on the callback", response.headers.get("referrer-policy") ?? "", "no-referrer");
      ok("and clears the cookie", (response.headers.get("set-cookie") ?? "").includes("Max-Age=0"));
      const { fragment } = splitLocation(response);
      handoff = fragment.get("auth_code") ?? "";
      ok("it hands off a code", handoff !== "");

      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
      eq("the token endpoint got the verifier that hashes to the challenge", encodeBase64Url(digest), challenge);
    });

    const redeemed = await post(handle, "/api/auth/oauth/redeem", { code: handoff });
    eqn("redeem answers 200", redeemed.status, 200);
    const session = await asJson(redeemed);
    const user = session["user"] as Row;
    ok("with a token", String(session["token"]) !== "");
    eq("and the provider's email", String(user["email"]), "alice@example.com");
    eq("and the provider's name", String(user["name"]), "Alice");

    const users = await binding.prepare("SELECT * FROM users").all();
    eqn("a new user was created", users.results?.length ?? 0, 1);
    const link = await binding.prepare("SELECT * FROM oauth_accounts").first();
    ok("the provider account is linked", link !== null);
    eq("to the same provider", String(link?.["provider"]), "google");
    eq("and provider id", String(link?.["provider_id"]), "google-1");
    eq("and user", String(link?.["user_id"]), String(user["id"]));

    eqn("a second redeem is 401", (await post(handle, "/api/auth/oauth/redeem", { code: handoff })).status, 401);

    const second = await startOf(handle, "google");
    let secondHandoff = "";
    await withFetch(googleStub(), async () => {
      const response = await callbackOf(handle, "google", second.cookie, { code: "auth-code-2", state: String(second.state["n"]) });
      secondHandoff = splitLocation(response).fragment.get("auth_code") ?? "";
    });
    const again = await post(handle, "/api/auth/oauth/redeem", { code: secondHandoff });
    eqn("a second sign-in answers 200", again.status, 200);
    eq("as the same user", String(((await asJson(again))["user"] as Row)["id"]), String(user["id"]));
    eqn("without a second user", (await binding.prepare("SELECT * FROM users").all()).results?.length ?? 0, 1);
    eqn("or a second link", (await binding.prepare("SELECT * FROM oauth_accounts").all()).results?.length ?? 0, 1);

    await binding
      .prepare("INSERT INTO auth_handoffs (id, code, user_id, expires) VALUES (?, ?, ?, ?)")
      .bind("expired", await handoffHash("expired"), String(user["id"]), clock - 1)
      .run();
    eqn("an expired hand-off is 401", (await post(handle, "/api/auth/oauth/redeem", { code: "expired" })).status, 401);

    await binding
      .prepare("INSERT INTO auth_handoffs (id, code, user_id, expires) VALUES (?, ?, ?, ?)")
      .bind("extra", await handoffHash("extra"), String(user["id"]), clock + 60_000)
      .run();

    const deleted = await handle(
      new Request(new URL("/api/auth/delete", "http://app.test"), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${String(session["token"])}` },
        body: JSON.stringify({}),
      }),
    );
    eqn("deleting the account answers 200", deleted.status, 200);
    eqn("its provider links are gone", (await binding.prepare("SELECT * FROM oauth_accounts").all()).results?.length ?? 0, 0);
    eqn("and its hand-offs are gone", (await binding.prepare("SELECT * FROM auth_handoffs").all()).results?.length ?? 0, 0);
  }

  {
    const { handle, binding } = setup(baseEnv());
    clock = Date.UTC(2026, 0, 1);
    await binding.prepare("INSERT INTO users (id, email, name, admin) VALUES (?, ?, ?, ?)").bind("u-bob", "bob@example.com", "Bob", 0).run();
    const { cookie, state } = await startOf(handle, "google");
    let handoff = "";
    await withFetch(googleStub(undefined, { sub: "google-2", email: "Bob@Example.com", email_verified: true, name: "Bobby" }), async () => {
      const response = await callbackOf(handle, "google", cookie, { code: "c", state: String(state["n"]) });
      handoff = splitLocation(response).fragment.get("auth_code") ?? "";
    });
    const redeemed = await asJson(await post(handle, "/api/auth/oauth/redeem", { code: handoff }));
    eq("an existing email signs in as that user", String((redeemed["user"] as Row)["id"]), "u-bob");
    eqn("without a duplicate user", (await binding.prepare("SELECT * FROM users").all()).results?.length ?? 0, 1);
    eqn("and one link", (await binding.prepare("SELECT * FROM oauth_accounts").all()).results?.length ?? 0, 1);
  }

  {
    const { handle } = setup(baseEnv());
    ok("a hand-off with no code is 401", (await post(handle, "/api/auth/oauth/redeem", {})).status === 401);
  }

  {
    const { handle } = setup({ ...baseEnv(), AUTH_OAUTH_REDIRECT_PATH: "/auth/callback" });
    clock = Date.UTC(2026, 0, 1);
    const { response, cookie, state } = await startOf(handle, "google");
    const location = new URL(response.headers.get("location") ?? "");
    eq(
      "AUTH_OAUTH_REDIRECT_PATH sets the authorize redirect",
      location.searchParams.get("redirect_uri") ?? "",
      "http://app.test/auth/callback",
    );
    let exchange = "";
    await withFetch(googleStub((body) => (exchange = body.get("redirect_uri") ?? "")), async () => {
      await callbackOf(handle, "google", cookie, { code: "c", state: String(state["n"]) });
    });
    eq("and the token exchange's redirect matches", exchange, "http://app.test/auth/callback");
  }

  {
    const { handle, binding } = setup(baseEnv());
    clock = Date.UTC(2026, 0, 1);
    const { cookie, state } = await startOf(handle, "google");
    let handoff = "";
    await withFetch(googleStub(), async () => {
      const response = await callbackAt(handle, "/api/auth/oauth/callback", cookie, { code: "c", state: String(state["n"]) });
      eqn("the provider-less callback answers 302", response.status, 302);
      ok("it clears the cookie", (response.headers.get("set-cookie") ?? "").includes("Max-Age=0"));
      handoff = splitLocation(response).fragment.get("auth_code") ?? "";
    });
    ok("it reads the provider from the cookie and hands off a code", handoff !== "");
    const redeemed = await post(handle, "/api/auth/oauth/redeem", { code: handoff });
    eqn("which redeems", redeemed.status, 200);
    eqn("and creates a user", (await binding.prepare("SELECT * FROM users").all()).results?.length ?? 0, 1);
  }

  {
    const { handle } = setup(baseEnv());
    const response = await callbackAt(handle, "/api/auth/oauth/callback", null, { code: "c", state: "x" });
    eqn("a provider-less callback with no cookie is 302", response.status, 302);
    eq("and refuses the state", splitLocation(response).fragment.get("auth_error") ?? "", "state");
    eq("landing on /", splitLocation(response).path, "/");
    ok("and clears the cookie", (response.headers.get("set-cookie") ?? "").includes("Max-Age=0"));
  }

  {
    const { handle } = setup(baseEnv());
    const { response } = await startOf(handle, "google");
    const cookie = response.headers.get("set-cookie") ?? "";
    ok(
      "the state cookie's Path covers the provider-less callback",
      cookie.includes("; Path=/api/auth/oauth") && "/api/auth/oauth/callback".startsWith("/api/auth/oauth"),
    );
  }

  for (const bad of ["//evil.com", "https://x"]) {
    const { handle } = setup({ ...baseEnv(), AUTH_OAUTH_REDIRECT_PATH: bad });
    const response = await get(handle, "/api/auth/oauth/google/start");
    eqn(`AUTH_OAUTH_REDIRECT_PATH ${JSON.stringify(bad)} is refused`, response.status, 500);
    ok(
      `the refusal names the variable for ${JSON.stringify(bad)}`,
      (await response.text()).includes("AUTH_OAUTH_REDIRECT_PATH"),
    );
  }

  done();
};

await main();
