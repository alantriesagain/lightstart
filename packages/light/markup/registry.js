/**
 * @lightstart/light/markup/registry: the custom element registry a process
 * without `globalThis.customElements` uses. `View.define` and
 * `View.register` install a class here, and `MarkupHost` builds an element
 * whose tag is registered as an instance of that class.
 */

/** @typedef {new () => object} Ctor */

/** @type {Map<string, Ctor>} */
const defined = new Map();
/** @type {Map<string, { promise: Promise<Ctor>, resolve: (ctor: Ctor) => void }>} */
const waiting = new Map();

/**
 * @param {string} tag
 * @param {Ctor} ctor
 */
export const define = (tag, ctor) => {
  defined.set(tag, ctor);
  const pending = waiting.get(tag);
  if (pending) {
    waiting.delete(tag);
    pending.resolve(ctor);
  }
};

/**
 * @param {string} tag
 * @returns {Ctor | undefined}
 */
export const get = (tag) => defined.get(tag);

/**
 * @param {string} tag
 * @returns {Promise<Ctor>}
 */
export const whenDefined = (tag) => {
  const ctor = defined.get(tag);
  if (ctor !== undefined) return Promise.resolve(ctor);
  let pending = waiting.get(tag);
  if (pending === undefined) {
    /** @type {(ctor: Ctor) => void} */
    let resolve = () => {};
    const promise = new Promise((/** @type {(ctor: Ctor) => void} */ r) => {
      resolve = r;
    });
    pending = { promise, resolve };
    waiting.set(tag, pending);
  }
  return pending.promise;
};
