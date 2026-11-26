// node-only
/**
 * @file Billing as a server contribution: a project declaring
 * `@lightstart/api`, `@lightstart/auth` and `@lightstart/billing` gets the
 * charge and entitlement tables, a trial once, a charge recorded and
 * confirmed into a period, plans that imply others, and a ledger each
 * account reads alone.
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

import { billingSession, confirmCharge, holds, recordCharge, refundCharge } from "../server/index.ts";

interface Entry {
  models: Record<string, ModelSchema>;
  createServer: (options: { db: D1Binding; env: Record<string, unknown> }) => App;
}

type Row = Record<string, unknown>;

const BILLING = {
  plans: {
    place: { amount: 4900, currency: "BRL", periodDays: 30, implies: ["spot", "guide"], trialDays: 7 },
    spot: { amount: 2900, currency: "BRL", periodDays: 30 },
  },
  providers: { pix: { data: ["payer"] } },
  contexts: ["claim", "renew"],
};

const main = async (): Promise<void> => {
  const project = mkdtempSync(join(import.meta.dirname, "tmp-contribute-"));
  const logged: string[] = [];
  const log = console.log;
  try {
    mkdirSync(join(project, "src", "models"), { recursive: true });
    mkdirSync(join(project, "src", "endpoints"), { recursive: true });
    mkdirSync(join(project, "node_modules", "@lightstart"), { recursive: true });
    symlinkSync(join(import.meta.dirname, ".."), join(project, "node_modules", "@lightstart", "billing"), "dir");
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "tiny", type: "module", dependencies: { "@lightstart/api": "workspace:*", "@lightstart/auth": "workspace:*", "@lightstart/billing": "workspace:*" } }));
    writeFileSync(join(project, "src", "app.js"), 'import { defineApp } from "@lightstart/app";\nexport default defineApp({ name: "tiny", host: "web", stores: { server: { adapter: "api" } } });\n');
    writeFileSync(join(project, "src", "billing.js"), `import { defineBilling } from "@lightstart/billing";\nexport default defineBilling(${JSON.stringify(BILLING)});\n`);
    writeFileSync(join(project, "src", "server.js"), 'import { registerBilling } from "@lightstart/billing/server";\nimport billing from "./billing.js";\nregisterBilling(billing);\n');

    const models = await serverModels(project);
    eq("the server models hold the contributed tables and the app's own", Object.keys(models).sort().join(","), "auth_codes,charge,entitlement,users");

    await writeServerEntry(project);
    const source = readFileSync(join(project, ".light", "server.ts"), "utf8");
    ok("the entry imports billing's contribution", source.includes('from "@lightstart/billing/server/contribute.ts"'));

    const entry = (await import(`${pathToFileURL(join(project, ".light", "server.ts")).href}?mtime=${String(Date.now())}`)) as Entry;
    const db = Database.open(":memory:");
    applySchema(db, models);
    console.log = (line: unknown): void => {
      logged.push(String(line));
      if (/^(ok|FAIL|PASS) /.test(String(line))) log(line);
    };
    const d1 = d1Of(db);
    const handle = toFetch(entry.createServer({ db: d1, env: { JWT_SECRET: "a-test-secret-that-is-long-enough-for-hs256" } }));

    const call = async (method: string, path: string, body?: unknown, token?: string): Promise<Response> =>
      handle(
        new Request(`http://app.test${path}`, {
          method,
          headers: { "content-type": "application/json", ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );

    const signIn = async (email: string): Promise<{ token: string; id: string }> => {
      logged.length = 0;
      const asked = await call("POST", "/api/auth/otp", { email });
      eqn(`${email}: the code is mailed`, asked.status, 200);
      const code = /(\d{6})/.exec(logged.join("\n"))?.[1] ?? "";
      const verified = await call("POST", "/api/auth/verify", { email, code });
      eqn(`${email}: the code signs in`, verified.status, 200);
      const body = (await verified.json()) as Row;
      const user = body["user"] as Row;
      return { token: String(body["token"]), id: String(user["id"]) };
    };

    const alice = await signIn("alice@example.com");
    const bob = await signIn("bob@example.com");
    const admin = await signIn("admin@example.com");
    await d1.prepare("UPDATE users SET admin = 1 WHERE id = ?").bind(admin.id).run();

    const trial = await call("POST", "/api/billing/trial", { plan: "place" }, alice.token);
    eqn("a signed-in person starts a plan's trial", trial.status, 201);
    eqn("a second trial is refused", (await call("POST", "/api/billing/trial", { plan: "place" }, alice.token)).status, 409);
    eqn("signed out, no trial", (await call("POST", "/api/billing/trial", { plan: "place" })).status, 401);
    eqn("a plan with no trial is refused", (await call("POST", "/api/billing/trial", { plan: "spot" }, bob.token)).status, 400);
    const aliceSession = (await (await call("GET", "/api/billing/entitlements", undefined, alice.token)).json()) as Row;
    eq("the session names the trial and what the plan implies", Object.keys(aliceSession["entitlements"] as Row).sort().join(","), "guide,place,spot");
    ok("the session names every plan held before", ((aliceSession["heldBefore"] as unknown[]) ?? []).map(String).join(",") === "place");

    const charge = await recordCharge(d1, {
      userId: bob.id,
      plan: "place",
      provider: "pix",
      data: { payer: "  Bip Bip Bar Ltda  ", other: "x" },
      context: { kind: "claim", ref: "sub123", slug: "bar-bip-bip" },
    });
    eqn("the server stamps the plan's amount", charge.amount, 4900);
    eq("the server stamps the plan's currency", charge.currency, "BRL");
    eq("the server stamps pending", charge.status, "pending");
    ok("the reference is the shape a payment method reads", /^[A-Z0-9]{20}$/.test(charge.providerRef));
    eq("only the method's data fields are kept, trimmed", JSON.stringify(charge.data), JSON.stringify({ payer: "Bip Bip Bar Ltda" }));
    ok("a pending charge grants nothing", (await holds(d1, bob.id, "place")) === false);

    const paid = await confirmCharge(d1, charge.id);
    eq("confirming marks it paid", paid.status, "paid");
    ok("and stamps when it was paid", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(paid.paidAt));
    ok("and grants the plan", await holds(d1, bob.id, "place"));
    ok("the plan it implies is held too", await holds(d1, bob.id, "spot"));
    eqn("confirming it again grants once", Number((await d1.prepare("SELECT count(*) AS n FROM entitlement WHERE userId = ? AND id = ?").bind(bob.id, `charge:${charge.id}`).first())?.["n"] ?? 0), 1);

    const bobSession = await billingSession(d1, bob.id);
    const until = Date.parse(`${String(bobSession.entitlements["place"]).replace(" ", "T")}Z`);
    ok("holds at the end of the period", await holds(d1, bob.id, "place", until - 1000));
    ok("holds nothing past the period", (await holds(d1, bob.id, "place", until + 1000)) === false);
    ok("holds past the period is false", (await holds(d1, bob.id, "place", Date.now() + 40 * 86_400_000)) === false);

    const mineBody = (await (await call("GET", "/api/entitlement", undefined, alice.token)).json()) as Row;
    const mine = (mineBody["rows"] as Row[]) ?? [];
    ok("one account reads only its own ledger", mine.length > 0 && mine.every((row) => String(row["userId"]) === alice.id));
    ok("the other account's period is not in it", mine.every((row) => String(row["userId"]) !== bob.id));

    eqn("a non-admin cannot list the charges", (await call("GET", "/api/billing/charges", undefined, alice.token)).status, 403);
    const listed = await call("GET", "/api/billing/charges", undefined, admin.token);
    eqn("the admin lists the charges", listed.status, 200);
    const listedBody = (await listed.json()) as Row;
    ok("the list carries the charge and its periods", Array.isArray(listedBody["rows"]) && ((listedBody["rows"] as Row[]).some((row) => row["id"] === charge.id)));
    ok("and the period the charge granted", ((listedBody["entitlements"] as Row[]) ?? []).some((row) => row["id"] === `charge:${charge.id}`));

    const forAlice = await recordCharge(d1, { userId: alice.id, plan: "spot", provider: "pix" });
    eqn("a non-admin cannot confirm", (await call("POST", `/api/billing/charges/${forAlice.id}/confirm`, undefined, alice.token)).status, 403);
    eqn("the admin confirms", (await call("POST", `/api/billing/charges/${forAlice.id}/confirm`, undefined, admin.token)).status, 200);
    ok("and the plan is held", await holds(d1, alice.id, "spot"));

    const refunded = await refundCharge(d1, charge.id);
    eq("a refund marks it refunded", refunded.status, "refunded");
    ok("and takes the period back", (await holds(d1, bob.id, "place")) === false);

    let refused = false;
    try {
      await recordCharge(d1, { userId: bob.id, plan: "place", provider: "card" });
    } catch {
      refused = true;
    }
    ok("a payment method the project does not take is refused", refused);

    eqn("an account that held the plan cannot start its trial", (await call("POST", "/api/billing/trial", { plan: "place" }, bob.token)).status, 409);
  } finally {
    console.log = log;
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
