/**
 * Query hooks: how a package shapes every `getAll` before it leaves the
 * tab. A hook receives `{ model, schema, opts }` and answers the options
 * to use (or nothing to keep them); the hooks registered when a query
 * starts run once each, in registration order. `@bootstrapp/i18n` scopes
 * `$i18n` models to the active locale this way.
 */

import type { QueryHook, QueryHookContext, QueryOptions } from "./types.ts";

const hooks: QueryHook[] = [];

/** Register a hook; the answer unregisters it. */
export const registerQueryHook = (fn: QueryHook): (() => void) => {
  if (!hooks.includes(fn)) hooks.push(fn);
  return () => {
    const at = hooks.indexOf(fn);
    if (at >= 0) hooks.splice(at, 1);
  };
};

export const applyQueryHooks = (ctx: QueryHookContext): QueryOptions => {
  let opts = ctx.opts;
  for (const fn of [...hooks]) opts = fn({ ...ctx, opts }) ?? opts;
  return opts;
};

export const clearQueryHooks = (): void => { hooks.splice(0); };
