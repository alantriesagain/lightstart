/**
 * @file The `payments` controller: every charge and every period, read as the
 * admin, and the moves the admin makes on a charge (mark paid, cancel,
 * refund), through the billing endpoints so the server keeps its rules.
 */

import { appUrl } from "@lightstart/app/base.ts";
import { authFetch, authPrefix, readToken } from "@lightstart/auth/page";
import { defineController } from "@lightstart/light/controller";

import { msOf } from "../lib/ledger.ts";

import type { ChargeRow, ChargeStatus, EntitlementRow } from "../types.ts";

type Row = Record<string, unknown>;

interface Answer {
  ok: boolean;
  body: unknown;
  error: string;
}

interface MoveAnswer {
  ok: boolean;
  message: string;
}

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

const messageOf = (value: unknown): string => {
  if (!isRecord(value)) return "";
  const error = value["error"];
  if (typeof error === "string" && error !== "") return error;
  const message = value["message"];
  return typeof message === "string" ? message : "";
};

const urlOf = (path: string): string => `${appUrl("")}${authPrefix()}${path}`;

const send = async (method: string, path: string, body?: Row): Promise<Answer> => {
  const token = readToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token !== null && token !== "") headers["authorization"] = `Bearer ${token}`;
  try {
    const response = await authFetch()(urlOf(path), { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let value: unknown = null;
    try {
      value = await response.json();
    } catch {
      value = null;
    }
    if (!response.ok) return { ok: false, body: value, error: messageOf(value) || `The request failed (${String(response.status)})` };
    return { ok: true, body: value, error: "" };
  } catch (error) {
    return { ok: false, body: null, error: error instanceof Error ? error.message : String(error) };
  }
};

const stringRecord = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!isRecord(value)) return out;
  for (const [key, entry] of Object.entries(value)) out[key] = String(entry ?? "");
  return out;
};

const chargeOf = (row: Row): ChargeRow => ({
  id: String(row["id"] ?? ""),
  userId: String(row["userId"] ?? ""),
  plan: String(row["plan"] ?? ""),
  amount: Number(row["amount"] ?? 0),
  currency: String(row["currency"] ?? ""),
  provider: String(row["provider"] ?? ""),
  providerRef: String(row["providerRef"] ?? ""),
  status: String(row["status"] ?? "pending") as ChargeStatus,
  paidAt: String(row["paidAt"] ?? ""),
  context: isRecord(row["context"]) ? (row["context"] as ChargeRow["context"]) : {},
  data: stringRecord(row["data"]),
  created: String(row["created"] ?? ""),
  updated: String(row["updated"] ?? ""),
});

const entitlementOf = (row: Row): EntitlementRow => ({
  id: String(row["id"] ?? ""),
  userId: String(row["userId"] ?? ""),
  key: String(row["key"] ?? ""),
  source: String(row["source"] ?? ""),
  ref: String(row["ref"] ?? ""),
  plan: String(row["plan"] ?? ""),
  startsAt: String(row["startsAt"] ?? ""),
  expiresAt: String(row["expiresAt"] ?? ""),
  status: String(row["status"] ?? "active") as EntitlementRow["status"],
  created: String(row["created"] ?? ""),
  updated: String(row["updated"] ?? ""),
});

const DONE: Record<string, string> = {
  paid: "Marked paid, and the period is granted.",
  canceled: "Canceled.",
  refunded: "Refunded, and the period it granted is over.",
};

const payments = defineController({
  name: "payments",
  props: {
    charges: [] as ChargeRow[],
    entitlements: [] as EntitlementRow[],
    loading: false,
    message: "",
    busy: "",
  },

  connected() {
    return this.load();
  },

  async load(): Promise<void> {
    this.loading = true;
    try {
      const answer = await send("GET", "/api/billing/charges");
      if (!answer.ok) {
        this.charges = [];
        this.entitlements = [];
        this.message = `Payments did not load: ${answer.error}`;
        return;
      }
      const body = isRecord(answer.body) ? answer.body : {};
      const rows = Array.isArray(body["rows"]) ? body["rows"].filter(isRecord) : [];
      const periods = Array.isArray(body["entitlements"]) ? body["entitlements"].filter(isRecord) : [];
      this.charges = rows.map(chargeOf).sort((a, b) => (msOf(b.created ?? b.paidAt) || 0) - (msOf(a.created ?? a.paidAt) || 0));
      this.entitlements = periods.map(entitlementOf);
      this.message = "";
    } finally {
      this.loading = false;
    }
  },

  /** The charges in one status. */
  inStatus(status: string): ChargeRow[] {
    return this.charges.filter((charge) => charge.status === status);
  },

  /** One charge, or null. */
  charge(id: string): ChargeRow | null {
    return this.charges.find((entry) => entry.id === id) ?? null;
  },

  /** Who a charge belongs to: the account id the server recorded. */
  whoIs(userId: string): string {
    return userId === "" ? "Nobody" : userId;
  },

  /** Moves a charge through the billing endpoints: paid grants its period, refunded takes it back. */
  async move(id: string, status: "paid" | "canceled" | "refunded"): Promise<MoveAnswer> {
    this.busy = id;
    try {
      const answer = await send("PATCH", `/api/billing/charges/${encodeURIComponent(id)}`, { status });
      if (!answer.ok) {
        this.message = `That did not go through: ${answer.error}`;
        return { ok: false, message: this.message };
      }
      await this.load();
      this.message = DONE[status] ?? "Done.";
      return { ok: true, message: this.message };
    } finally {
      this.busy = "";
    }
  },
});

export default payments;
export { payments };
