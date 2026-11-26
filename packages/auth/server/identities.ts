/**
 * @file Identities an app adds as another way in: a package registers one when
 * its server contribution is imported, and `POST /api/auth/identity/:name`
 * calls it. An identity redeems a body into a waiting device, a refusal, or
 * the account it names.
 */

import type { D1Like } from "@lightstart/api/server";

/** What an identity's `redeem` answers: still waiting, no, or the account it names. */
export type IdentityAnswer =
  | { pending: true }
  | { error: string; status: number }
  | {
      userId: string | null;
      name?: string;
      link(userId: string): void | Promise<void>;
    };

/** A way in: a name and the redemption a request calls. */
export interface Identity {
  name: string;
  redeem(body: unknown, db: D1Like, env: Record<string, unknown>): IdentityAnswer | Promise<IdentityAnswer>;
}

const identities = new Map<string, Identity>();

/** Add an identity under its name; registering the same name with another object throws. */
export const registerIdentity = (identity: Identity): void => {
  const existing = identities.get(identity.name);
  if (existing !== undefined && existing !== identity) {
    throw new Error(`the identity "${identity.name}" is already registered`);
  }
  identities.set(identity.name, identity);
};

/** The identity registered under `name`, or undefined when there is none. */
export const identityNamed = (name: string): Identity | undefined => identities.get(name);

/** Forget every registered identity; a test's seam. */
export const resetIdentities = (): void => {
  identities.clear();
};
