/**
 * @bootstrapp/light/controller/document: Document Adapter
 * A sync adapter over one JSON document: the keys a `sync: "<name>"`
 * property binds to are the document's top-level keys. The document lives
 * in memory; while a backing (`{ read, write, flush? }`) is attached every
 * change is handed to it whole. `attach` loads the stored document and
 * announces each stored key, so bound stores take the persisted value;
 * `detach` flushes the backing and stops writing.
 */

import { withKeyedListeners } from "./keyed-listeners.js";

/** @import { DocumentAdapter, DocumentBacking } from "../types.ts" */

/** @param {unknown} value */
const isThenable = (value) => Boolean(value) && typeof (/** @type {{ then?: unknown }} */ (value)).then === "function";

/**
 * @param {string} name
 * @returns {DocumentAdapter}
 */
export const createDocumentAdapter = (name) => {
  /** @type {Record<string, unknown>} */
  let doc = {};
  /** @type {DocumentBacking | null} */
  let backing = null;

  const persist = () => {
    const result = backing?.write(doc);
    if (isThenable(result))
      /** @type {Promise<void>} */ (result).catch((error) => console.error(`[sync:${name}] write failed:`, error));
  };

  const adapter = withKeyedListeners({
    name,

    /** @param {string} key */
    get: (key) => doc[key],

    /** @param {string} key @param {unknown} value */
    set(key, value) {
      doc = { ...doc, [key]: value };
      persist();
      adapter.emit(key, value);
      return { key };
    },

    /** @param {string} key */
    remove(key) {
      const { [key]: _removed, ...rest } = doc;
      doc = rest;
      persist();
      adapter.emit(key, undefined);
      return { key };
    },

    /** @param {string} key */
    has: (key) => Object.hasOwn(doc, key),

    keys: () => Object.keys(doc),

    /** @returns {Array<[string, unknown]>} */
    entries: () => Object.entries(doc),

    /** @param {DocumentBacking} next */
    async attach(next) {
      const stored = (await next.read()) ?? {};
      backing = next;
      doc = { ...stored };
      for (const [key, value] of Object.entries(doc)) adapter.emit(key, value);
    },

    async detach() {
      const previous = backing;
      backing = null;
      doc = {};
      await previous?.flush?.();
    },
  });

  return adapter;
};
