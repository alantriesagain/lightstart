/**
 * @bootstrapp/light/controller/document: Document Adapter
 * A sync adapter over one JSON document: the keys a `sync: "<name>"`
 * property binds to are the document's top-level keys. The document lives
 * in memory; while a backing (`{ read, write, flush? }`) is attached every
 * change is handed to it whole. `attach` loads the stored document and
 * announces each stored key, so bound stores take the persisted value;
 * `detach` flushes the backing and stops writing.
 */

import { withKeyedListeners } from "./keyed-listeners.ts";

import type { DocumentAdapter, DocumentBacking } from "../types.ts";

const isThenable = (value: unknown): value is Promise<unknown> =>
  Boolean(value) && typeof (value as { then?: unknown }).then === "function";

/** A document adapter named `name`, holding an empty document until a backing is attached. */
export const createDocumentAdapter = (name: string): DocumentAdapter => {
  let doc: Record<string, unknown> = {};
  let backing: DocumentBacking | null = null;

  const persist = () => {
    const result = backing?.write(doc);
    if (isThenable(result))
      result.catch((error: unknown) => console.error(`[sync:${name}] write failed:`, error));
  };

  const adapter = withKeyedListeners({
    name,

    get: (key: string) => doc[key],

    set(key: string, value: unknown) {
      doc = { ...doc, [key]: value };
      persist();
      adapter.emit(key, value);
      return { key };
    },

    remove(key: string) {
      const { [key]: _removed, ...rest } = doc;
      doc = rest;
      persist();
      adapter.emit(key, undefined);
      return { key };
    },

    has: (key: string) => Object.hasOwn(doc, key),

    keys: () => Object.keys(doc),

    entries: (): Array<[string, unknown]> => Object.entries(doc),

    async attach(next: DocumentBacking) {
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
