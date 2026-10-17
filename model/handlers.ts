/**
 * The `MODEL:*` commands a store answers: what a model api's request reaches,
 * whether the store sits in the same runtime or behind a worker's port.
 */

import {
  MODEL_ADD, MODEL_ADD_MANY, MODEL_COUNT, MODEL_EDIT, MODEL_EXISTS, MODEL_FACETS,
  MODEL_GET, MODEL_QUERY, MODEL_REMOVE, MODEL_REMOVE_MANY,
} from "./commands.ts";

import type { ModelHandler, ModelRequest, QueryOptions, Row, Store, WriteOptions } from "./types.ts";

const queryOf = (opts: unknown): QueryOptions => (opts === undefined ? {} : (opts as QueryOptions));

const writeOf = (opts: unknown): WriteOptions | undefined => opts as WriteOptions | undefined;

/**
 * One handler per command, each over the store `getStore` answers when the
 * command arrives.
 */
export const createModelHandlers = (getStore: () => Store): Record<string, ModelHandler> => ({
  [MODEL_GET]: async ({ model, id, opts }): Promise<unknown> => {
    const query = queryOf(opts);
    return await getStore().get(model, id ?? query.where ?? null, query);
  },
  [MODEL_QUERY]: async ({ model, opts }): Promise<unknown> => await getStore().query(model, queryOf(opts)),
  [MODEL_COUNT]: async ({ model, opts }): Promise<unknown> => await getStore().count(model, queryOf(opts)),
  [MODEL_EXISTS]: async ({ model, where }): Promise<unknown> => await getStore().exists(model, where),
  [MODEL_FACETS]: async ({ model, fields, opts }): Promise<unknown> => await getStore().facets(model, fields, queryOf(opts)),
  [MODEL_ADD]: async ({ model, row, opts }): Promise<unknown> => await getStore().add(model, row as Row, writeOf(opts)),
  [MODEL_ADD_MANY]: async ({ model, rows, opts }): Promise<unknown> => await getStore().addMany(model, rows as Row[], writeOf(opts)),
  [MODEL_EDIT]: async ({ model, id, patch, opts }): Promise<unknown> => await getStore().edit(model, id as string | number, patch as Row, writeOf(opts)),
  [MODEL_REMOVE]: async ({ model, id, opts }): Promise<unknown> => await getStore().remove(model, id as string | number, writeOf(opts)),
  [MODEL_REMOVE_MANY]: async ({ model, where }): Promise<unknown> => await getStore().removeAll(model, where),
});

/**
 * The request over a store in the same runtime:
 * `configureModel({ request: storeRequest(store) })`.
 */
export const storeRequest = (store: Store): ModelRequest => {
  const handlers = createModelHandlers(() => store);
  return (action, model, payload = {}) => handlers[action]({ model, ...payload });
};
