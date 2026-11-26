/**
 * @file The `billing` controller: what a person holds, the plans a project
 * sells, and the trial they may start. It follows the `auth` session, so a
 * view binds `user` without asking; when the session carries no entitlements
 * (an app that did not wire auth's `sessionFields`), `load()` reads them from
 * `/api/billing/entitlements`. No method throws: a failure is `message`.
 */

import { appUrl } from "@lightstart/app/base.ts";
import { auth, authFetch, authPrefix, readToken } from "@lightstart/auth/page";
import { defineController } from "@lightstart/light/controller";

import { msOf } from "../lib/ledger.ts";

import type { AuthUser } from "@lightstart/auth/server/types.ts";
import type { BillingConfig, BillingMethod, BillingPlan, BillingSession } from "../types.ts";

interface Answer {
  ok: boolean;
  body: unknown;
  error: string;
}

type Row = Record<string, unknown>;

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
  for (const [key, entry] of Object.entries(value)) if (typeof entry === "string") out[key] = entry;
  return out;
};

const validMs = (text: unknown): number => {
  const value = msOf(text);
  return Number.isFinite(value) ? value : 0;
};

const billing = defineController({
  name: "billing",
  props: {
    user: null as AuthUser | null,
    entitlements: {} as Record<string, string>,
    heldBefore: [] as string[],
    config: null as BillingConfig | null,
    loading: false,
    message: "",
  },
  sync: { user: auth },

  connected() {
    return this.load();
  },

  /** Hands the controller the project's plans, the same plain data its server registers. */
  configure(config: BillingConfig): void {
    this.config = config;
  },

  /** The plans the project sells, by id. */
  plans(): Record<string, BillingPlan> {
    return this.config?.plans ?? {};
  },

  /** The project's settings for one payment method. */
  method(id: string): BillingMethod | null {
    return this.config?.providers[id] ?? null;
  },

  async load(): Promise<void> {
    if (this.user === null) {
      this.entitlements = {};
      this.heldBefore = [];
      return;
    }
    this.loading = true;
    try {
      const answer = await send("GET", "/api/billing/entitlements");
      if (!answer.ok) {
        this.message = `Billing did not load: ${answer.error}`;
        return;
      }
      const body = isRecord(answer.body) ? answer.body : {};
      const session = body as unknown as Partial<BillingSession>;
      this.entitlements = stringRecord(session.entitlements);
      this.heldBefore = Array.isArray(session.heldBefore) ? session.heldBefore.map(String) : [];
      this.message = "";
    } finally {
      this.loading = false;
    }
  },

  _session(): AuthUser & { entitlements?: unknown; heldBefore?: unknown } {
    return (this.user ?? {}) as AuthUser & { entitlements?: unknown; heldBefore?: unknown };
  },

  /** When `key` runs out, in milliseconds, or 0 when it is not held. */
  expiresOf(key: string): number {
    const session = this._session();
    const fromSession = stringRecord(session.entitlements)[key] ?? "";
    const fromServer = this.entitlements[key] ?? "";
    return Math.max(validMs(fromSession), validMs(fromServer));
  },

  /** Whether this account holds `plan` now, directly or through a plan that implies it. */
  holds(key: string): boolean {
    return this.expiresOf(key) > Date.now();
  },

  /** Whether this account holds any plan now. */
  holdsAny(): boolean {
    const keys = new Set([...Object.keys(stringRecord(this._session().entitlements)), ...Object.keys(this.entitlements)]);
    return [...keys].some((key) => this.holds(key));
  },

  /** Whether this account may start `plan`'s trial: it has one, and the account never held the plan. */
  canTry(plan: string): boolean {
    if (this.user === null) return false;
    const session = this._session();
    const before = Array.isArray(session.heldBefore) ? session.heldBefore.map(String) : this.heldBefore;
    return Number(this.plans()[plan]?.trialDays) > 0 && !this.holds(plan) && !before.includes(plan);
  },

  /** Starts `plan`'s trial and reads the session and the ledger again. */
  async startTrial(plan: string): Promise<{ ok: boolean; message: string }> {
    this.message = "";
    try {
      const answer = await send("POST", "/api/billing/trial", { plan });
      if (!answer.ok) {
        this.message = answer.error;
        return { ok: false, message: this.message };
      }
      await this.load();
      await auth.reload();
      return { ok: true, message: "" };
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: this.message };
    }
  },
});

export default billing;
export { billing };
