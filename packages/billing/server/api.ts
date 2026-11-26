/**
 * @file The server side of `@lightstart/billing`: the calls a payment method,
 * an endpoint or an account hook makes to write a charge, confirm it, take it
 * back, or ask what a person holds. Every call reads and writes the D1-shaped
 * database directly, since the session a person carries never reaches the
 * server. `@lightstart/pix` and `@lightstart/play-billing` record their
 * charges through these calls.
 */

import { decodeRow } from "@lightstart/light/model/sql";
import { buildInsertSQL, buildSelectSQL, buildUpdateSQL, getJsonFields } from "@lightstart/light/model/sql-builder";

import { mintChargeId, mintReference } from "../index.ts";
import { CHARGE_STATUSES, type BillingConfig, type BillingContext, type BillingPlan, type BillingSession, type ChargeRow, type ChargeStatus, type EntitlementRow, type RecordChargeInput } from "../types.ts";
import { billingConfig } from "./config.ts";
import { heldUntil, msOf, nextPeriod, sqlDate } from "../lib/ledger.ts";
import { billingModels } from "./models.ts";

import type { D1Like } from "@lightstart/api/server";
import type { ModelSchema } from "@lightstart/light/model/types.ts";

type Row = Record<string, unknown>;

const CHARGE_SCHEMA = billingModels["charge"] as ModelSchema;
const ENTITLEMENT_SCHEMA = billingModels["entitlement"] as ModelSchema;
const CHARGE_JSON = getJsonFields(CHARGE_SCHEMA);
const ENTITLEMENT_JSON = getJsonFields(ENTITLEMENT_SCHEMA);

const DATA_MAX = 120;
const REF = /^[A-Za-z0-9_-]{1,40}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A refusal a call makes, with the HTTP status an endpoint answers. */
export class BillingError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "BillingError";
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

const objectOf = (value: unknown): Row => (isRecord(value) ? value : {});

const stringRecord = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(objectOf(value))) out[key] = String(entry ?? "");
  return out;
};

/** What a charge is for, or null when it names a kind or shape the project does not take. */
const contextOf = (sent: unknown, kinds: string[]): BillingContext | null => {
  const context = objectOf(sent);
  if (Object.keys(context).length === 0) return {};
  const kind = String(context["kind"] ?? "");
  const ref = String(context["ref"] ?? "");
  const slug = String(context["slug"] ?? "");
  if (!kinds.includes(kind)) return null;
  if (ref !== "" && !REF.test(ref)) return null;
  if (slug !== "" && (slug.length > 120 || !SLUG.test(slug))) return null;
  return { kind, ...(ref === "" ? {} : { ref }), ...(slug === "" ? {} : { slug }) };
};

/** Only the `data` fields a method declares, trimmed and bounded. */
const dataOf = (sent: unknown, fields: string[]): Record<string, string> => {
  const object = objectOf(sent);
  const kept: Record<string, string> = {};
  for (const key of fields) {
    const value = String(object[key] ?? "").trim().slice(0, DATA_MAX);
    if (value !== "") kept[key] = value;
  }
  return kept;
};

const chargeOf = (row: Row): ChargeRow => {
  const decoded = decodeRow(CHARGE_SCHEMA, row);
  return {
    id: String(decoded["id"] ?? ""),
    userId: String(decoded["userId"] ?? ""),
    plan: String(decoded["plan"] ?? ""),
    amount: Number(decoded["amount"] ?? 0),
    currency: String(decoded["currency"] ?? ""),
    provider: String(decoded["provider"] ?? ""),
    providerRef: String(decoded["providerRef"] ?? ""),
    status: String(decoded["status"] ?? "pending") as ChargeStatus,
    paidAt: String(decoded["paidAt"] ?? ""),
    context: objectOf(decoded["context"]) as BillingContext,
    data: stringRecord(decoded["data"]),
    ...(decoded["created"] === undefined ? {} : { created: String(decoded["created"]) }),
    ...(decoded["updated"] === undefined ? {} : { updated: String(decoded["updated"]) }),
  };
};

const entitlementOf = (row: Row): EntitlementRow => {
  const decoded = decodeRow(ENTITLEMENT_SCHEMA, row);
  return {
    id: String(decoded["id"] ?? ""),
    userId: String(decoded["userId"] ?? ""),
    key: String(decoded["key"] ?? ""),
    source: String(decoded["source"] ?? ""),
    ref: String(decoded["ref"] ?? ""),
    plan: String(decoded["plan"] ?? ""),
    startsAt: String(decoded["startsAt"] ?? ""),
    expiresAt: String(decoded["expiresAt"] ?? ""),
    status: String(decoded["status"] ?? "active") as EntitlementRow["status"],
    ...(decoded["created"] === undefined ? {} : { created: String(decoded["created"]) }),
    ...(decoded["updated"] === undefined ? {} : { updated: String(decoded["updated"]) }),
  };
};

const chargeById = async (db: D1Like, id: string): Promise<ChargeRow | null> => {
  const row = await db.prepare("SELECT * FROM charge WHERE id = ?").bind(id).first();
  return row === null ? null : chargeOf(row);
};

const rowsOf = async (db: D1Like, userId: string): Promise<EntitlementRow[]> => {
  if (userId === "") return [];
  const result = await db
    .prepare("SELECT * FROM entitlement WHERE userId = ? AND status = 'active' AND expiresAt > datetime('now')")
    .bind(userId)
    .all();
  return (result.results ?? []).map(entitlementOf);
};

const latestEnd = async (db: D1Like, userId: string, key: string): Promise<string> => {
  const row = await db
    .prepare("SELECT max(expiresAt) AS until FROM entitlement WHERE userId = ? AND key = ? AND status = 'active'")
    .bind(userId, key)
    .first();
  return row === null ? "" : String(row["until"] ?? "");
};

const insertEntitlement = async (db: D1Like, row: Row, ignore: boolean): Promise<void> => {
  const query = buildInsertSQL("entitlement", row, ENTITLEMENT_JSON);
  const sql = ignore ? query.sql.replace(/^INSERT INTO/, "INSERT OR IGNORE INTO") : query.sql;
  await db.prepare(sql).bind(...query.params).run();
};

/**
 * Grants `key` to a person for `days`, after the end of what they already
 * hold of it. The grant's id is `${source}:${ref}`, so granting the same
 * payment twice leaves one period.
 */
export const grantPeriod = async (
  db: D1Like,
  grant: { userId: string; key: string; source: string; ref: string; days: number; plan?: string },
): Promise<EntitlementRow> => {
  const id = `${grant.source}:${grant.ref}`;
  const period = nextPeriod(await latestEnd(db, grant.userId, grant.key), Date.now(), grant.days);
  await insertEntitlement(
    db,
    {
      id,
      userId: grant.userId,
      key: grant.key,
      source: grant.source,
      ref: grant.ref,
      plan: grant.plan ?? grant.key,
      startsAt: period.startsAt,
      expiresAt: period.expiresAt,
      status: "active",
    },
    true,
  );
  const row = await db.prepare("SELECT * FROM entitlement WHERE id = ?").bind(id).first();
  if (row === null) throw new BillingError(500, "the period could not be read back");
  return entitlementOf(row);
};

/**
 * Grants `key` until `expiresAt`, as a store's subscription runs: the store
 * says when it ends, and a renewal moves that end. The same subscription is
 * one row, and one taken back stays taken back.
 */
export const grantUntil = async (
  db: D1Like,
  grant: { userId: string; key: string; source: string; ref: string; expiresAt: string; plan?: string },
): Promise<string> => {
  const id = `${grant.source}:${grant.ref}`;
  await db
    .prepare(`INSERT INTO entitlement (id, userId, key, source, ref, plan, startsAt, expiresAt, status) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, 'active')
      ON CONFLICT(id) DO UPDATE SET expiresAt = excluded.expiresAt, updated = datetime('now') WHERE entitlement.status = 'active'`)
    .bind(id, grant.userId, grant.key, grant.source, grant.ref, grant.plan ?? grant.key, grant.expiresAt)
    .run();
  return id;
};

/** Takes back the period a payment bought, or a store's subscription. */
export const revokeRef = async (db: D1Like, grant: { source: string; ref: string }): Promise<void> => {
  await db.prepare("UPDATE entitlement SET status = 'revoked', updated = datetime('now') WHERE id = ?").bind(`${grant.source}:${grant.ref}`).run();
};

const grantForCharge = async (db: D1Like, charge: ChargeRow, config: BillingConfig): Promise<void> => {
  const plan = config.plans[charge.plan];
  if (plan === undefined) throw new BillingError(409, `no plan ${charge.plan} is sold`);
  await grantPeriod(db, { userId: charge.userId, key: charge.plan, source: "charge", ref: charge.id, days: plan.periodDays });
};

/**
 * Records a charge for a person, stamping its id, reference and amount from
 * the plan when the caller gives none. A newer pending charge for the same
 * plan calls the older pending one off. A charge recorded already `paid`
 * grants its period in the same call.
 */
export const recordCharge = async (db: D1Like, input: RecordChargeInput): Promise<ChargeRow> => {
  const config = billingConfig();
  const userId = String(input.userId ?? "").trim();
  const planId = String(input.plan ?? "");
  const plan = config.plans[planId];
  const method = config.providers[input.provider];
  if (userId === "") throw new BillingError(400, "whose charge is it?");
  if (plan === undefined) throw new BillingError(400, "unknown plan");
  if (method === undefined) throw new BillingError(400, "unknown payment method");
  const context = contextOf(input.context, config.contexts ?? []);
  if (context === null) throw new BillingError(400, "invalid context");
  const amount = Number(input.amount ?? plan.amount);
  if (!(amount > 0)) throw new BillingError(400, "invalid amount");
  const status = input.status ?? "pending";
  if (!CHARGE_STATUSES.includes(status)) throw new BillingError(400, "invalid status");

  if (status === "pending") {
    await db
      .prepare("UPDATE charge SET status = 'canceled', updated = datetime('now') WHERE userId = ? AND plan = ? AND status = 'pending'")
      .bind(userId, planId)
      .run();
  }

  const id = mintChargeId();
  const row: Row = {
    id,
    userId,
    plan: planId,
    amount,
    currency: String(input.currency ?? plan.currency),
    provider: input.provider,
    providerRef: mintReference(),
    status,
    paidAt: status === "paid" ? sqlDate(Date.now()) : "",
    context,
    data: dataOf(input.data, method.data ?? []),
  };
  const query = buildInsertSQL("charge", row, CHARGE_JSON);
  await db.prepare(query.sql).bind(...query.params).run();
  const charge = await chargeById(db, id);
  if (charge === null) throw new BillingError(500, "the charge could not be read back");
  if (status === "paid") await grantForCharge(db, charge, config);
  return charge;
};

/** Marks a pending charge paid and grants its plan for its period. Marking it paid again grants nothing more. */
export const confirmCharge = async (db: D1Like, id: string): Promise<ChargeRow> => {
  const config = billingConfig();
  const charge = await chargeById(db, id);
  if (charge === null) throw new BillingError(404, "not found");
  if (charge.status === "paid") return charge;
  if (charge.status !== "pending") throw new BillingError(409, `a ${charge.status} charge cannot be paid`);
  if (charge.userId === "") throw new BillingError(409, "the account that paid is gone");
  if (config.plans[charge.plan] === undefined) throw new BillingError(409, `no plan ${charge.plan} is sold`);
  await grantForCharge(db, charge, config);
  const paidAt = sqlDate(Date.now());
  const query = buildUpdateSQL("charge", id, { status: "paid", paidAt }, CHARGE_JSON);
  await db.prepare(query.sql).bind(...query.params).run();
  return (await chargeById(db, id)) ?? { ...charge, status: "paid", paidAt };
};

/** Calls off a pending charge. Nothing was granted. */
export const cancelCharge = async (db: D1Like, id: string): Promise<ChargeRow> => {
  const charge = await chargeById(db, id);
  if (charge === null) throw new BillingError(404, "not found");
  if (charge.status !== "pending") throw new BillingError(409, `a ${charge.status} charge cannot be canceled`);
  const query = buildUpdateSQL("charge", id, { status: "canceled" }, CHARGE_JSON);
  await db.prepare(query.sql).bind(...query.params).run();
  return (await chargeById(db, id)) ?? { ...charge, status: "canceled" };
};

/** Refunds a paid charge and takes back the period it granted. */
export const refundCharge = async (db: D1Like, id: string): Promise<ChargeRow> => {
  const charge = await chargeById(db, id);
  if (charge === null) throw new BillingError(404, "not found");
  if (charge.status !== "paid") throw new BillingError(409, `a ${charge.status} charge cannot be refunded`);
  const query = buildUpdateSQL("charge", id, { status: "refunded" }, CHARGE_JSON);
  await db.prepare(query.sql).bind(...query.params).run();
  await revokeRef(db, { source: "charge", ref: id });
  return (await chargeById(db, id)) ?? { ...charge, status: "refunded" };
};

/** Starts a plan's trial once for an account that never held it, for the plan's own `trialDays`. */
export const startTrial = async (db: D1Like, userId: string, planId: string, now = Date.now()): Promise<EntitlementRow> => {
  const config = billingConfig();
  const plan = config.plans[planId];
  const days = Math.round(Number(plan?.trialDays) || 0);
  if (userId === "") throw new BillingError(401, "sign in first");
  if (days === 0) throw new BillingError(400, "this plan has no trial");
  const seen = await db.prepare("SELECT 1 FROM entitlement WHERE userId = ? AND key = ?").bind(userId, planId).first();
  if (seen !== null) throw new BillingError(409, "this account has held the plan");
  const ref = `${planId}:${userId}`;
  const id = `trial:${ref}`;
  const period = nextPeriod(null, now, days);
  await insertEntitlement(
    db,
    { id, userId, key: planId, source: "trial", ref, plan: planId, status: "active", ...period },
    false,
  );
  const row = await db.prepare("SELECT * FROM entitlement WHERE id = ?").bind(id).first();
  if (row === null) throw new BillingError(500, "the trial could not be read back");
  return entitlementOf(row);
};

/** The keys a person holds right now, with what each plan implies. */
export const activeKeys = async (db: D1Like, userId: string, plans?: Record<string, BillingPlan>): Promise<string[]> => {
  const config = billingConfig();
  return userId === "" ? [] : Object.keys(heldUntil(await rowsOf(db, userId), Date.now(), plans ?? config.plans));
};

/** Whether a person holds `key` right now, or a plan that implies it. */
export const hasKey = async (db: D1Like, userId: string, key: string): Promise<boolean> => (await activeKeys(db, userId)).includes(key);

/** Whether a person holds `plan` at `now`, including through a plan that implies it. */
export const holds = async (db: D1Like, userId: string, plan: string, now = Date.now()): Promise<boolean> => {
  const config = billingConfig();
  const rows = await db.prepare("SELECT key, status, startsAt, expiresAt FROM entitlement WHERE userId = ? AND status = 'active'").bind(userId).all();
  const held = heldUntil((rows.results ?? []).map((row) => ({
    key: String(row["key"] ?? ""),
    status: String(row["status"] ?? "") as EntitlementRow["status"],
    startsAt: String(row["startsAt"] ?? ""),
    expiresAt: String(row["expiresAt"] ?? ""),
  })), now, config.plans);
  return Object.hasOwn(held, plan);
};

/** What a person's session carries: each key held and when it runs out, and every plan ever held. */
export const billingSession = async (db: D1Like, userId: string): Promise<BillingSession> => {
  const config = billingConfig();
  const all = await db.prepare("SELECT DISTINCT key FROM entitlement WHERE userId = ?").bind(userId).all();
  return {
    entitlements: heldUntil(await rowsOf(db, userId), Date.now(), config.plans),
    heldBefore: (all.results ?? []).map((row) => String(row["key"] ?? "")),
  };
};

/** What leaves with an account: every period it held. Its charges stay with nobody's name on them. */
export const forgetBilling = async (db: D1Like, userId: string): Promise<void> => {
  if (userId === "") return;
  await db.prepare("DELETE FROM entitlement WHERE userId = ?").bind(userId).run();
  await db.prepare("UPDATE charge SET userId = '', updated = datetime('now') WHERE userId = ?").bind(userId).run();
};

/** The charges an admin lists, newest first, optionally in one status. */
export const listCharges = async (db: D1Like, status?: string): Promise<ChargeRow[]> => {
  const select = buildSelectSQL("charge", {
    ...(status === undefined || status === "" ? {} : { where: { status } }),
    order: [{ field: "created", direction: "DESC" }],
  });
  const result = await db.prepare(select.sql).bind(...select.params).all();
  return (result.results ?? []).map(chargeOf);
};

/** Every period an admin's payments page reads, newest end first. */
export const listEntitlements = async (db: D1Like): Promise<EntitlementRow[]> => {
  const result = await db.prepare("SELECT * FROM entitlement ORDER BY expiresAt DESC").all();
  return (result.results ?? []).map(entitlementOf);
};

/** A stored date as milliseconds, for a page that follows one. */
export { msOf };
