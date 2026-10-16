/**
 * Query hooks: how a package shapes every `getAll` before it leaves the
 * tab. A hook receives `{ model, schema, opts, $APP }` and answers the
 * options to use (or nothing to keep them); hooks run in registration
 * order. `@bootstrapp/i18n` scopes `$i18n` models to the active locale
 * this way.
 */

/** @import { QueryHook, QueryHookContext, QueryOptions } from "./types.ts" */

/** @type {Set<QueryHook>} */
const hooks = new Set();

/**
 * @param {QueryHook} fn
 * @returns {() => void} unregister
 */
export const registerQueryHook = (fn) => {
  hooks.add(fn);
  return () => { hooks.delete(fn); };
};

/**
 * @param {QueryHookContext} ctx
 * @returns {QueryOptions}
 */
export const applyQueryHooks = (ctx) => {
  let opts = ctx.opts;
  for (const fn of hooks) opts = fn({ ...ctx, opts }) ?? opts;
  return opts;
};

export const clearQueryHooks = () => { hooks.clear(); };
