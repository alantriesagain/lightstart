// node-only
/**
 * @file The per-IP limit on `POST /api/auth/otp`: an address that asks for
 * many codes is refused, a forged header without Cloudflare's `cf` is ignored,
 * a different address is unaffected, the limit can be turned off, old rows are
 * cleared and the per-address quiet period still holds.
 */

import { applySchema } from "@lightstart/light/model/sql-builder";
import { Database } from "@lightstart/sqlite/node";
import { d1Of } from "@lightstart/sqlite/d1";
import { toFetch } from "@lightstart/server/fetch";
import { serverApp } from "@lightstart/api/server";
import { done, eqn, ok } from "@lightstart/test/assert.ts";

import {
  authEndpoints,
  authModels,
  callerFromRequest,
  RESEND_MS,
  type AuthOptions,
  type MailMessage,
  type Mailer,
} from "../server/index.ts";

const SECRET = "0123456789abcdef0123456789abcdef";

let clock = Date.UTC(2026, 0, 1);

const mailer: Mailer = {
  send(_message: MailMessage): void {},
};

const env: Record<string, unknown> = { JWT_SECRET: SECRET, RATE_SALT: "a-rate-salt" };

type Handle = (request: Request) => Promise<Response>;

const makeApp = (overrides: Partial<AuthOptions> = {}): { handle: Handle; binding: ReturnType<typeof d1Of> } => {
  const database = Database.open(":memory:");
  applySchema(database, authModels);
  const binding = d1Of(database);
  const handle = toFetch(
    serverApp({
      models: authModels,
      endpoints: authEndpoints({ mailer, now: () => clock, ...overrides }),
      db: () => binding,
      caller: callerFromRequest(env),
      env,
    }),
  );
  return { handle, binding };
};

const otp = (handle: Handle, email: string, ip: string | null, trusted: boolean): Promise<Response> => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ip !== null) headers["cf-connecting-ip"] = ip;
  const request = new Request("http://app.test/api/auth/otp", {
    method: "POST",
    headers,
    body: JSON.stringify({ email }),
  });
  if (trusted) Object.defineProperty(request, "cf", { value: {} });
  return handle(request);
};

const main = async (): Promise<void> => {
  const limited = makeApp();
  for (let index = 0; index < 10; index++) {
    eqn(`code request ${index + 1} from 1.2.3.4 answers 200`, (await otp(limited.handle, `user${index}@example.com`, "1.2.3.4", true)).status, 200);
  }
  eqn("the eleventh from the same address is 429", (await otp(limited.handle, "user10@example.com", "1.2.3.4", true)).status, 429);
  eqn("another address still answers 200", (await otp(limited.handle, "other@example.com", "5.6.7.8", true)).status, 200);

  const forged = makeApp();
  for (let index = 0; index < 11; index++) {
    eqn(`a forged header without cf passes ${index + 1}`, (await otp(forged.handle, `forged${index}@example.com`, "1.2.3.4", false)).status, 200);
  }

  const off = makeApp({ codesPerIp: false });
  for (let index = 0; index < 11; index++) {
    eqn(`with codesPerIp false request ${index + 1} passes`, (await otp(off.handle, `off${index}@example.com`, "1.2.3.4", true)).status, 200);
  }

  const cleared = makeApp();
  await cleared.binding
    .prepare("INSERT INTO auth_code_requests (id, ipHash, created) VALUES (?, ?, datetime('now', '-2 hours'))")
    .bind(crypto.randomUUID(), "an-old-digest")
    .run();
  const oldBefore = await cleared.binding.prepare("SELECT count(*) AS n FROM auth_code_requests WHERE created < datetime('now', '-1 hour')").first();
  ok("an old row was there before the request", Number(oldBefore?.["n"] ?? 0) === 1);
  eqn("a request answers 200", (await otp(cleared.handle, "clear@example.com", "1.2.3.4", true)).status, 200);
  const oldAfter = await cleared.binding.prepare("SELECT count(*) AS n FROM auth_code_requests WHERE created < datetime('now', '-1 hour')").first();
  eqn("and the row older than the window is gone", Number(oldAfter?.["n"] ?? 0), 0);

  const quiet = makeApp();
  eqn("a first code request answers 200", (await otp(quiet.handle, "quiet@example.com", "1.2.3.4", true)).status, 200);
  eqn("the same address within 30 seconds is still 429", (await otp(quiet.handle, "quiet@example.com", "1.2.3.4", true)).status, 429);
  clock += RESEND_MS + 1;
  eqn("and after 30 seconds answers 200", (await otp(quiet.handle, "quiet@example.com", "1.2.3.4", true)).status, 200);

  done();
};

await main();
