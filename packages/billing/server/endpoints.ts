/**
 * @file The endpoints `@lightstart/billing` adds to an app's server: a
 * person's trial and entitlements, and the admin's charges list and moves.
 * A payment method's own package records a charge through `recordCharge`
 * from `./api.ts` rather than through a route here.
 */

import { defineEndpoint, type Endpoint } from "@lightstart/api/server";

import { billingSession, cancelCharge, confirmCharge, listCharges, listEntitlements, refundCharge, startTrial, BillingError } from "./api.ts";

type Row = Record<string, unknown>;

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

const refused = (error: unknown): Response => {
  if (error instanceof BillingError) return json({ error: error.message }, error.status);
  return json({ error: error instanceof Error ? error.message : String(error) }, 500);
};

const billingEndpoints = (): Endpoint[] => [
  defineEndpoint({
    path: "/api/billing/trial",
    method: "POST",
    access: "auth",
    handler: async ({ body, caller, db }) => {
      const plan = isRecord(body) ? String(body["plan"] ?? "") : "";
      try {
        const row = await startTrial(db, caller === null ? "" : caller.id, plan);
        return json(row, 201);
      } catch (error) {
        return refused(error);
      }
    },
  }),

  defineEndpoint({
    path: "/api/billing/entitlements",
    method: "GET",
    access: "auth",
    handler: async ({ query, caller, db }) => {
      const asked = query["userId"] ?? "";
      const userId = caller !== null && caller.admin === true && asked !== "" ? asked : (caller?.id ?? "");
      return billingSession(db, userId);
    },
  }),

  defineEndpoint({
    path: "/api/billing/charges",
    method: "GET",
    access: "admin",
    handler: async ({ query, db }) => {
      const status = query["status"] ?? "";
      const [rows, entitlements] = await Promise.all([listCharges(db, status), listEntitlements(db)]);
      return { rows, entitlements };
    },
  }),

  defineEndpoint({
    path: "/api/billing/charges/:id/confirm",
    method: "POST",
    access: "admin",
    handler: async ({ params, db }) => {
      try {
        return await confirmCharge(db, params["id"] ?? "");
      } catch (error) {
        return refused(error);
      }
    },
  }),

  defineEndpoint({
    path: "/api/billing/charges/:id",
    method: "PATCH",
    access: "admin",
    handler: async ({ params, body, db }) => {
      const status = isRecord(body) ? String(body["status"] ?? "") : "";
      const id = params["id"] ?? "";
      try {
        if (status === "paid") return await confirmCharge(db, id);
        if (status === "canceled") return await cancelCharge(db, id);
        if (status === "refunded") return await refundCharge(db, id);
        return json({ error: "a charge moves to paid, canceled or refunded" }, 400);
      } catch (error) {
        return refused(error);
      }
    },
  }),
];

export { billingEndpoints };
