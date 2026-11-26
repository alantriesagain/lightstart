/**
 * @file The seam an app uses to act on a confirmed code, mirroring the auth
 * core's `registerIdentity`: a project imports `registerWhatsappHook` and adds
 * its own function at startup, and the webhook calls every registered hook
 * after it has written the code's outcome. Every hook runs once per code; a
 * repeated delivery confirms nothing.
 */

import type { WhatsappConfirmed, WhatsappConfirmedHook } from "./types.ts";

const hooks = new Set<WhatsappConfirmedHook>();

/**
 * Add a hook for a confirmed code. The same function registered twice runs
 * once; registering it again after `clearWhatsappHooks` works.
 *
 * @param hook what to call when a connect or login code arrives
 */
export const registerWhatsappHook = (hook: WhatsappConfirmedHook): void => {
  hooks.add(hook);
};

/** Forget every registered hook; a test's seam. */
export const clearWhatsappHooks = (): void => {
  hooks.clear();
};

/**
 * Call every registered hook with `confirmed`, in registration order, waiting
 * for each. A hook that throws is skipped so one host hook cannot fail Meta's
 * delivery or the other hooks.
 *
 * @param confirmed the code, the account or device it names, and the webhook's `db` and `env`
 */
export const confirmedHooks = async (confirmed: WhatsappConfirmed): Promise<void> => {
  for (const hook of hooks) {
    try {
      await hook(confirmed);
    } catch {
      // A host hook's failure is its own; the delivery was already answered.
    }
  }
};
