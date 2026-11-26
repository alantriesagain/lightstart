/**
 * @file `POST /api/pix/charge`: the checkout asks the server for a charge, the
 * server reads the project's Pix account from `PIX_KEY`, `PIX_MERCHANT_NAME`
 * and `PIX_MERCHANT_CITY`, records the charge through billing's `recordCharge`
 * and answers it with its BR Code. Nothing of this package runs on a server of
 * its own: the charge waits in billing's table until an admin confirms it.
 */

import { defineEndpoint, type Endpoint } from "@lightstart/api/server";
import { BillingError, recordCharge } from "@lightstart/billing/server";

import { brcode } from "../lib/brcode.ts";

import type { BillingContext } from "@lightstart/billing";

type Row = Record<string, unknown>;

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

const textOf = (row: Row, key: string): string => {
  const value = row[key];
  return typeof value === "string" ? value : String(value ?? "");
};

const envText = (env: Record<string, unknown>, name: string): string => {
  const value = env[name];
  return typeof value === "string" ? value.trim() : "";
};

const refused = (error: unknown): Response => {
  if (error instanceof BillingError) return json({ error: error.message }, error.status);
  return json({ error: error instanceof Error ? error.message : String(error) }, 500);
};

/**
 * The one Pix endpoint: `POST /api/pix/charge` with `{ plan, context?, payer }`.
 * It needs a signed-in caller, a plan the project sells and a `pix` method it
 * takes; a project with no `PIX_KEY`, `PIX_MERCHANT_NAME` or
 * `PIX_MERCHANT_CITY` answers a 500 instead. The answer is
 * `{ charge, code }`, the pending charge and its BR Code.
 */
export const pixChargeEndpoint = defineEndpoint({
  path: "/api/pix/charge",
  method: "POST",
  access: "auth",
  handler: async ({ body, caller, db, env }) => {
    const key = envText(env, "PIX_KEY");
    const name = envText(env, "PIX_MERCHANT_NAME");
    const city = envText(env, "PIX_MERCHANT_CITY");
    if (key === "" || name === "" || city === "") {
      return json({ error: "Pix is not configured: PIX_KEY, PIX_MERCHANT_NAME and PIX_MERCHANT_CITY are required" }, 500);
    }
    const input = isRecord(body) ? body : {};
    const data = isRecord(input["data"]) ? input["data"] : {};
    const payer = textOf(input, "payer") || textOf(data, "payer");
    const context: BillingContext = isRecord(input["context"]) ? (input["context"] as BillingContext) : {};
    try {
      const charge = await recordCharge(db, {
        userId: caller === null ? "" : caller.id,
        plan: textOf(input, "plan"),
        provider: "pix",
        data: { payer },
        context,
      });
      return json({
        charge,
        code: brcode({ key, name, city, amount: charge.amount, txid: charge.providerRef }),
      });
    } catch (error) {
      return refused(error);
    }
  },
});

/** The Pix endpoints an app's server registers beside its own. */
export const pixEndpoints: Endpoint[] = [pixChargeEndpoint];
