// node-only
/**
 * @file Play billing as a server contribution: a project declaring
 * `@lightstart/api`, `@lightstart/auth`, `@lightstart/billing` and
 * `@lightstart/play-billing` signs a person in, hands them a Play account id,
 * verifies a purchase against a fake Play Developer API, records the period
 * through billing, and follows Play's notifications.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { applySchema } from "@lightstart/light/model/sql-builder";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import type { App } from "@lightstart/server";
import { toFetch } from "@lightstart/server/fetch";
import { Database } from "@lightstart/sqlite/node";
import { d1Of, type D1Binding } from "@lightstart/sqlite/d1";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { serverModels } from "@lightstart/api/node/models.ts";
import { writeServerEntry } from "@lightstart/api/node/server-entry.ts";

import { accountIdFor, refOf } from "../server/play.ts";
import type { PlaySubscription } from "../types.ts";

interface Entry {
  models: Record<string, ModelSchema>;
  createServer: (options: { db: D1Binding; env: Record<string, unknown> }) => App;
}

type Row = Record<string, unknown>;

const SECRET = "a-test-secret-that-is-long-enough-for-hs256";

const pemOf = (bytes: ArrayBuffer): string =>
  `-----BEGIN PRIVATE KEY-----\n${Buffer.from(bytes).toString("base64").match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END PRIVATE KEY-----\n`;

const BILLING = {
  plans: { spot: { amount: 2900, currency: "BRL", periodDays: 30 } },
  providers: { play: {} },
  contexts: ["claim"],
};

const main = async (): Promise<void> => {
  const project = mkdtempSync(join(import.meta.dirname, "tmp-contribute-"));
  const logged: string[] = [];
  const log = console.log;
  try {
    mkdirSync(join(project, "src", "models"), { recursive: true });
    mkdirSync(join(project, "node_modules", "@lightstart"), { recursive: true });
    symlinkSync(join(import.meta.dirname, ".."), join(project, "node_modules", "@lightstart", "play-billing"), "dir");
    writeFileSync(
      join(project, "package.json"),
      JSON.stringify({
        name: "tiny-play",
        type: "module",
        dependencies: {
          "@lightstart/api": "workspace:*",
          "@lightstart/auth": "workspace:*",
          "@lightstart/billing": "workspace:*",
          "@lightstart/play-billing": "workspace:*",
        },
      }),
    );
    writeFileSync(join(project, "src", "app.js"), 'import { defineApp } from "@lightstart/app";\nexport default defineApp({ name: "tiny", host: "web", stores: { server: { adapter: "api" } } });\n');
    writeFileSync(join(project, "src", "billing.js"), `import { defineBilling } from "@lightstart/billing";\nexport default defineBilling(${JSON.stringify(BILLING)});\n`);
    writeFileSync(join(project, "src", "server.js"), 'import { registerBilling } from "@lightstart/billing/server";\nimport billing from "./billing.js";\nregisterBilling(billing);\n');

    const models = await serverModels(project);
    eq("the server models hold auth's and billing's tables", Object.keys(models).sort().join(","), "auth_codes,charge,entitlement,users");

    await writeServerEntry(project);
    const source = readFileSync(join(project, ".light", "server.ts"), "utf8");
    ok("the entry imports Play's contribution", source.includes('from "@lightstart/play-billing/server/contribute.ts"'));

    const keys = (await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const account = {
      client_email: "play@example.iam.gserviceaccount.com",
      private_key: pemOf(await crypto.subtle.exportKey("pkcs8", keys.privateKey)),
    };

    const calls: string[] = [];
    let subscription: PlaySubscription | null = null;
    const google: typeof fetch = async (input, init = {}) => {
      const url = String(input);
      calls.push(`${String(init.method ?? "GET")} ${url}`);
      if (url.endsWith("/token")) return new Response(JSON.stringify({ access_token: "ya29.test" }), { headers: { "content-type": "application/json" } });
      if (url.includes("/subscriptionsv2/tokens/")) return new Response(JSON.stringify(subscription ?? {}), { headers: { "content-type": "application/json" } });
      if (url.endsWith(":acknowledge")) return new Response("{}");
      return new Response("{}", { status: 404 });
    };

    const entry = (await import(`${pathToFileURL(join(project, ".light", "server.ts")).href}?mtime=${String(Date.now())}`)) as Entry;
    const db = Database.open(":memory:");
    applySchema(db, models);
    console.log = (line: unknown): void => {
      logged.push(String(line));
      if (/^(ok|FAIL|PASS) /.test(String(line))) log(line);
    };
    const d1 = d1Of(db);
    const handle = toFetch(
      entry.createServer({
        db: d1,
        env: {
          JWT_SECRET: SECRET,
          PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(account),
          PLAY_PACKAGE_NAME: "app.example",
          PLAY_RTDN_TOKEN: "rtdn-secret",
          PLAY_FETCH: google,
        },
      }),
    );

    const call = async (method: string, path: string, body?: unknown, token?: string): Promise<Response> =>
      handle(
        new Request(`http://app.test${path}`, {
          method,
          headers: { "content-type": "application/json", ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );

    logged.length = 0;
    eqn("a code is mailed", (await call("POST", "/api/auth/otp", { email: "ana@example.com" })).status, 200);
    const code = /(\d{6})/.exec(logged.join("\n"))?.[1] ?? "";
    const verified = await call("POST", "/api/auth/verify", { email: "ana@example.com", code });
    eqn("the code signs in", verified.status, 200);
    const session = (await verified.json()) as Row;
    const user = session["user"] as Row;
    const token = String(session["token"]);
    const userId = String(user["id"]);

    const accountAnswer = await call("GET", "/api/play-account", undefined, token);
    eqn("the account id is handed to the signed-in person", accountAnswer.status, 200);
    eq("and it is the HMAC of their id", String(((await accountAnswer.json()) as Row)["accountId"]), await accountIdFor(userId, SECRET));
    eqn("signed out, no account id", (await call("GET", "/api/play-account")).status, 401);

    const accountId = await accountIdFor(userId, SECRET);
    subscription = {
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
      lineItems: [{ productId: "spot", expiryTime: "2999-01-01T00:00:00Z" }],
      externalAccountIdentifiers: { obfuscatedExternalAccountId: accountId },
    };
    const bought = await call("POST", "/api/play-purchase", { purchaseToken: "tok-ana" }, token);
    eqn("the purchase is granted", bought.status, 200);
    const granted = (await bought.json()) as Row;
    eq("the answer names the period it granted", String(granted["expiresAt"]), "2999-01-01 00:00:00");
    ok("Play was asked to acknowledge it", calls.some((entryCall) => entryCall.endsWith(":acknowledge")));

    const ledger = (await (await call("GET", "/api/billing/entitlements", undefined, token)).json()) as Row;
    ok("billing holds the plan through the period Play granted", Object.hasOwn((ledger["entitlements"] as Row) ?? {}, "spot"));

    const stored = await d1.prepare("SELECT source, ref FROM entitlement WHERE id = ?").bind(`play:${await refOf("tok-ana")}`).first();
    eq("the period is kept under Play's source and the token's digest", `${String(stored?.["source"])}:${String(stored?.["ref"])}`, `play:${await refOf("tok-ana")}`);

    subscription = { ...(subscription ?? {}), lineItems: [{ productId: "spot", expiryTime: "2999-04-01T00:00:00Z" }] };
    const push = (type: number): Row => ({
      message: { data: Buffer.from(JSON.stringify({ subscriptionNotification: { notificationType: type, purchaseToken: "tok-ana" } })).toString("base64") },
    });
    eqn("a notification with the wrong token is refused", (await call("POST", "/api/play-rtdn?token=wrong", push(2))).status, 403);
    eqn("a renewal is answered", (await call("POST", "/api/play-rtdn?token=rtdn-secret", push(2))).status, 200);
    const renewed = await d1.prepare("SELECT expiresAt FROM entitlement WHERE id = ?").bind(`play:${await refOf("tok-ana")}`).first();
    eq("and it moved the end", String(renewed?.["expiresAt"]), "2999-04-01 00:00:00");
    eqn("a revocation is answered", (await call("POST", "/api/play-rtdn?token=rtdn-secret", push(12))).status, 200);
    const after = (await (await call("GET", "/api/billing/entitlements", undefined, token)).json()) as Row;
    ok("and took the period back", !Object.hasOwn((after["entitlements"] as Row) ?? {}, "spot"));
  } finally {
    console.log = log;
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
