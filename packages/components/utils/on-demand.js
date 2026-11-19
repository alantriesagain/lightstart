/**
 * @file Defining component tags when they are first needed. A page registers a
 * definer once, and a component that can draw tags it did not write statically
 * asks for them before it renders; off the browser there is nothing to define,
 * so the answer is nothing to wait for.
 */

/** @type {((tag: string) => Promise<unknown>) | null} */
let definer = null;

/**
 * @param {(tag: string) => Promise<unknown>} define
 */
export const configureOnDemand = (define) => {
  definer = define;
};

/** @type {Map<string, Promise<unknown>>} */
const pending = new Map();

/**
 * Define every tag that is not defined yet, if a definer is configured and the
 * environment has custom elements. Answers null when there is nothing to wait
 * for, so a caller can render straight away.
 *
 * @param {string[]} tags
 * @returns {Promise<void> | null}
 */
export const defineOnDemand = (tags) => {
  const define = definer;
  const registry = /** @type {CustomElementRegistry | undefined} */ (globalThis.customElements);
  if (define === null || registry === undefined) return null;

  const missing = tags.filter((tag) => registry.get(tag) === undefined);
  if (missing.length === 0) return null;

  return Promise.all(missing.map((tag) => {
    const known = pending.get(tag);
    if (known !== undefined) return known;
    const waiting = define(tag);
    pending.set(tag, waiting);
    return waiting;
  })).then(() => {});
};
