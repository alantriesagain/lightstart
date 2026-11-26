/**
 * @file `@lightstart/billing`: paid features for any app. A project declares
 * the plans it sells and the methods it takes with `defineBilling`, keeps that
 * plain data in `src/billing.js`, and hands the same data to the server with
 * `registerBilling` from `@lightstart/billing/server`. The app asks whether an
 * account holds a plan, never how it paid, so a payment method is a package of
 * its own.
 */

import type { BillingConfig } from "./types.ts";

export { CHARGE_STATUSES, ENTITLEMENT_STATUSES } from "./types.ts";
export type {
  BillingConfig,
  BillingContext,
  BillingMethod,
  BillingPlan,
  BillingSession,
  ChargeRow,
  ChargeStatus,
  EntitlementRow,
  EntitlementStatus,
  RecordChargeInput,
} from "./types.ts";

/** Declares what a project sells and how it is paid: its plans, its methods and what a charge may be for. */
export const defineBilling = (config: BillingConfig): BillingConfig => config;

const minted = (alphabet: string, length: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) => alphabet[byte % alphabet.length]).join("");

/** A new charge's id: twenty lowercase letters and digits, opaque. */
export const mintChargeId = (): string => minted("abcdefghijklmnopqrstuvwxyz0123456789", 20);

/** A charge's reference for a payment method: twenty uppercase letters and digits, the shape a Pix txid takes. */
export const mintReference = (): string => minted("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 20);
