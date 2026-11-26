/**
 * @file The shapes `@lightstart/billing` shares between its server and its
 * page: the plans a project sells, the charges that pay for them, the
 * entitlement ledger, and the methods whose parts read them.
 */

/** Where a charge is: waiting to be paid, paid (which granted its plan), called off, or paid back. */
export const CHARGE_STATUSES = ["pending", "paid", "canceled", "refunded"] as const;

/** A grant is on until its period runs out, or revoked when its charge was paid back or an admin took it away. */
export const ENTITLEMENT_STATUSES = ["active", "revoked"] as const;

/** Where a charge is. */
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

/** Whether a grant is on. */
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

/** A plan a project sells: its price in the currency's smallest unit, how long a payment lasts, and the other plans it includes. */
export interface BillingPlan {
  /** The price in the currency's smallest unit, such as cents. */
  amount: number;
  /** The ISO currency the price is in. */
  currency: string;
  /** How many days one paid period lasts. */
  periodDays: number;
  /** The plans this one includes while it is held. */
  implies?: string[];
  /** Days an account may hold the plan once for free, before it ever paid. */
  trialDays?: number;
}

/** A payment method a project takes: the fields of a charge's `data` it may carry, and whatever else the method reads. */
export interface BillingMethod {
  /** The `data` fields a charge through this method may keep. */
  data?: string[];
  [setting: string]: unknown;
}

/** What a charge is for: a kind the project declares, with an optional reference and slug. */
export interface BillingContext {
  kind?: string;
  ref?: string;
  slug?: string;
}

/** What a project sells and how it is paid: the plans by id, the methods by id, and what a charge may be for. */
export interface BillingConfig {
  plans: Record<string, BillingPlan>;
  providers: Record<string, BillingMethod>;
  contexts?: string[];
}

/** A `charge` row. */
export interface ChargeRow {
  id: string;
  userId: string;
  plan: string;
  amount: number;
  currency: string;
  provider: string;
  providerRef: string;
  status: ChargeStatus;
  paidAt: string;
  context: BillingContext;
  data: Record<string, string>;
  created?: string;
  updated?: string;
}

/** An `entitlement` row: one paid period of one plan. */
export interface EntitlementRow {
  id: string;
  userId: string;
  key: string;
  source: string;
  ref: string;
  plan: string;
  startsAt: string;
  expiresAt: string;
  status: EntitlementStatus;
  created?: string;
  updated?: string;
}

/** What a session carries: each key a person holds and when it runs out, and every plan they ever held. */
export interface BillingSession {
  entitlements: Record<string, string>;
  heldBefore: string[];
}

/** What `recordCharge` is handed: enough to write one charge, its amount and currency defaulting to the plan's. */
export interface RecordChargeInput {
  userId: string;
  plan: string;
  provider: string;
  amount?: number;
  currency?: string;
  data?: Record<string, unknown>;
  context?: BillingContext | Record<string, unknown>;
  status?: ChargeStatus;
}
