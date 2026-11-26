/**
 * @file The submission kinds an app adds to the contributed moderation
 * endpoints. An app's `src/server.js` calls `registerSubmissionKinds({ claim,
 * report, ... })` once; the contribution's policy looks a kind up in what it
 * was built with first, then here, at each request, so the app keeps one
 * submit route. A kind that publishes nothing of its own still only reaches a
 * `$moderated` model's table.
 */

import type { SubmissionKind } from "../types.ts";

const registered: Record<string, SubmissionKind> = {};

/** Add kinds the contributed endpoints accept; a name already registered by another object throws. */
export const registerSubmissionKinds = (kinds: Record<string, SubmissionKind>): void => {
  for (const [name, kind] of Object.entries(kinds)) {
    const known = Object.hasOwn(registered, name) ? registered[name] : undefined;
    if (known !== undefined && known !== kind) throw new Error(`The submission kind "${name}" is registered twice`);
    registered[name] = kind;
  }
};

/** The registered kind named `name`, or null. */
export const registeredKind = (name: string): SubmissionKind | null => (Object.hasOwn(registered, name) ? (registered[name] ?? null) : null);

/** Forget every registered kind, for tests. */
export const resetSubmissionKinds = (): void => {
  for (const name of Object.keys(registered)) delete registered[name];
};
