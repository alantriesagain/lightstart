// node-only
/**
 * @file `POST /api/pix/charge` over an in-memory database: it records a
 * pending charge through billing, answers the BR Code built from the server's
 * Pix account, and refuses a signed-out caller, an unknown plan and a server
 * with no Pix account.
 */

import { serverApp } from "@lightstart/api/server";
import { registerBilling } from "@lightstart/billing/server";
import { applySchema } from "@lightstart/light/model/sql-builder";
import { toFetch } from "@lightstart/server/fetch";
import { Database } from "@lightstart/sqlite/node";
import { d1Of, type D1Binding } from "@lightstart/sqlite/d1";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

import { billingModels } from "@lightstart/billing/server";
import { brcode } from "../lib/brcode.ts";
import { pixEndpoints } from "../server/charge.ts";

type Row = Record<string, unknown>;

const ENV = { PIX_KEY: "pix@meetup.rio", PIX_MERCHANT_NAME: "MEETUP RIO", PIX_MERCHANT_CITY: "RIO DE JANEIRO" };

const handlerWith = (binding: D1Binding, env: Record<string, unknown>): ((request: Request) => Promise<Response>) =>
  toFetch(
    serverApp({
      models: billingModels,
      endpoints: pixEndpoints,
      db: () => binding,
      caller: (request) => {
        const header = request.headers.get("authorization");
        return header !== null && header.startsWith("Bearer ") ? { id: header.slice("Bearer ".length) } : null;
      },
      env,
    }),
  );

const main = async (): Promise<void> => {
  registerBilling({
    plans: { place: { amount: 4900, currency: "BRL", periodDays: 30 } },
    providers: { pix: { data: ["payer"] } },
    contexts: ["claim"],
  });
  const db = Database.open(":memory:");
  applySchema(db, billingModels);
  const binding = d1Of(db);
  const handle = handlerWith(binding, ENV);
  const send = (body?: unknown, signedIn = true, at = handle): Promise<Response> =>
    at(
      new Request("http://app.test/api/pix/charge", {
        method: "POST",
        headers: { "content-type": "application/json", ...(signedIn ? { authorization: "Bearer u_ana" } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );

  eqn("a signed-out caller is refused before anything runs", (await send({ plan: "place", payer: "Ana" }, false)).status, 401);

  const answer = await send({ plan: "place", context: { kind: "claim", slug: "bar-bip-bip" }, payer: "  Bip Bip Bar Ltda  " });
  eqn("a signed-in payer gets a charge", answer.status, 200);
  const body = (await answer.json()) as Row;
  const charge = body["charge"] as Row;
  eq("the charge belongs to the caller", String(charge["userId"]), "u_ana");
  eq("the plan is the one asked for", String(charge["plan"]), "place");
  eq("the method is Pix", String(charge["provider"]), "pix");
  eqn("the server stamps the plan's amount", Number(charge["amount"]), 4900);
  eq("the server stamps the plan's currency", String(charge["currency"]), "BRL");
  eq("the charge waits for the money", String(charge["status"]), "pending");
  eq("only the payer field is kept, trimmed", JSON.stringify(charge["data"]), JSON.stringify({ payer: "Bip Bip Bar Ltda" }));
  eq("the context survives", JSON.stringify(charge["context"]), JSON.stringify({ kind: "claim", slug: "bar-bip-bip" }));
  const expected = brcode({
    key: ENV.PIX_KEY,
    name: ENV.PIX_MERCHANT_NAME,
    city: ENV.PIX_MERCHANT_CITY,
    amount: Number(charge["amount"]),
    txid: String(charge["providerRef"]),
  });
  eq("the answer carries the charge's BR Code", String(body["code"]), expected);
  ok("the reference is the shape a Pix txid takes", /^[A-Z0-9]{20}$/.test(String(charge["providerRef"])));

  const nested = (await (await send({ plan: "place", data: { payer: "Ana" } })).json()) as Row;
  eq("a payer under data is kept too", String((nested["charge"] as Row)["data"] && ((nested["charge"] as Row)["data"] as Row)["payer"]), "Ana");

  eqn("a plan the project does not sell is refused", (await send({ plan: "gold", payer: "Ana" })).status, 400);
  eqn("a server with no Pix account answers a failure", (await send({ plan: "place", payer: "Ana" }, true, handlerWith(binding, {}))).status, 500);

  done();
};

await main();
