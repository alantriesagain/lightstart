/**
 * The `MODEL:*` commands a store answers: what a model api's request reaches,
 * whether the store sits in the same runtime or behind a worker's port.
 */

import {
  MODEL_ADD, MODEL_ADD_MANY, MODEL_COUNT, MODEL_EDIT, MODEL_EXISTS, MODEL_FACETS,
  MODEL_GET, MODEL_QUERY, MODEL_REMOVE, MODEL_REMOVE_MANY,
} from "./commands.js";

/** @import { ModelRequest, Store } from "./types.ts" */

/**
 * One handler per command, each over the store `getStore` answers when the
 * command arrives.
 * @param {() => Store} getStore
 * @returns {Record<string, (payload: any) => Promise<unknown>>}
 */
export const createModelHandlers = (getStore) => ({
  [MODEL_GET]: ({ model, id, opts = {} }) => getStore().get(model, id ?? opts.where ?? null, opts),
  [MODEL_QUERY]: ({ model, opts = {} }) => getStore().query(model, opts),
  [MODEL_COUNT]: ({ model, opts = {} }) => getStore().count(model, opts),
  [MODEL_EXISTS]: ({ model, where }) => getStore().exists(model, where),
  [MODEL_FACETS]: ({ model, fields, opts = {} }) => getStore().facets(model, fields, opts),
  [MODEL_ADD]: ({ model, row, opts }) => getStore().add(model, row, opts),
  [MODEL_ADD_MANY]: ({ model, rows, opts }) => getStore().addMany(model, rows, opts),
  [MODEL_EDIT]: ({ model, id, patch, opts }) => getStore().edit(model, id, patch, opts),
  [MODEL_REMOVE]: ({ model, id, opts }) => getStore().remove(model, id, opts),
  [MODEL_REMOVE_MANY]: ({ model, where }) => getStore().removeAll(model, where),
});

/**
 * The request over a store in the same runtime:
 * `configureModel({ request: storeRequest(store) })`.
 * @param {Store} store
 * @returns {ModelRequest}
 */
export const storeRequest = (store) => {
  const handlers = createModelHandlers(() => store);
  return (action, model, payload = {}) => handlers[action]({ model, ...payload });
};
