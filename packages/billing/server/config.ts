/**
 * @file The plans a project sells, as the running server holds them. The
 * package's contribution cannot import an app's `src/billing.js`, so the app
 * calls `registerBilling` from its own server side before the server is made:
 * a small `src/endpoints/billing.js` imports the plain data, registers it,
 * and default-exports an endpoint (the plans themselves are useful).
 */

import type { BillingConfig } from "../types.ts";

let current: BillingConfig | null = null;

/** Hands the server the project's plans, methods and contexts, once at startup. */
export const registerBilling = (config: BillingConfig): void => {
  current = config;
};

/** The registered plans, or a failure saying the app did not register any. */
export const billingConfig = (): BillingConfig => {
  if (current === null) throw new Error("billing has no plans: call registerBilling from the app's server");
  return current;
};

/** The registered plans, when there are any. */
export const registeredBilling = (): BillingConfig | null => current;
