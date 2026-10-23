/**
 * @bootstrapp/light/model: a model's api. `defineModel(name, schema)` is a
 * plain object of the eleven methods, imported where it is used, sending
 * `MODEL:*` commands through the request `configureModel` set: a store in
 * the same runtime, or a port to a worker that holds one. Rows are the plain
 * objects the store answered; liveness is `onChange`.
 */

import {
  MODEL_ADD, MODEL_ADD_MANY, MODEL_COUNT, MODEL_EDIT, MODEL_EXISTS, MODEL_FACETS,
  MODEL_GET, MODEL_QUERY, MODEL_REMOVE, MODEL_REMOVE_MANY,
} from "./commands.ts";
import { applyQueryHooks } from "./query-hooks.ts";

export { registerQueryHook } from "./query-hooks.ts";
export { setFileStorage, getFileStorage } from "./file-storage.ts";
export { onChange } from "./changes.ts";
export { ValidationError } from "./validate.ts";
import { modelRequest } from "./config.ts";

export { configureModel, modelBus, modelRequest } from "./config.ts";

import type { ClientWriteOptions, FacetResult, ModelApi, ModelPayload, ModelSchema, QueryOptions, QueryPage, Row, RowOf } from "./types.ts";

/** Brands a per-model api so a `sync:` binder can tell it from any other object. */
export const MODEL_API = Symbol.for("bootstrapp.model.api");

export const isModelApi = (value: unknown): value is ModelApi =>
  (typeof value === "object" || typeof value === "function") && value !== null && Reflect.get(value as { [MODEL_API]?: unknown }, MODEL_API) === true;

const isId = (value: unknown): value is string | number => typeof value === "string" || typeof value === "number";

const withOpts = (payload: ModelPayload, opts: ClientWriteOptions | undefined): ModelPayload => (opts ? { ...payload, opts } : payload);

/**
 * The api of the model `name`, for a host that resolves schemas by name:
 * `schemaOf` answers the schema when it is read (by `api.schema` and the
 * query hooks), so a schema registered later is still found.
 */
export const modelApi = (name: string, schemaOf: () => ModelSchema | undefined): ModelApi => {
  const send = (action: string, payload: ModelPayload): Promise<unknown> => modelRequest()(action, name, payload);
  const hooked = (opts: QueryOptions): QueryOptions => applyQueryHooks({ model: name, schema: schemaOf(), opts });
  const api: ModelApi = {
    [MODEL_API]: true,
    name,
    get schema() {
      return schemaOf();
    },
    get(idOrOpts, opts) {
      return (isId(idOrOpts) ? send(MODEL_GET, { id: idOrOpts, opts: hooked(opts ?? {}) }) : send(MODEL_GET, { opts: hooked(idOrOpts ?? {}) })) as Promise<Row | null>;
    },
    async getAll(opts) {
      const copy: Record<string, unknown> = opts ? Object.fromEntries(Object.entries(opts)) : {};
      const query: QueryOptions = copy;
      query.total = false;
      return ((await send(MODEL_QUERY, { opts: hooked(query) })) as QueryPage).rows;
    },
    query(opts) {
      return send(MODEL_QUERY, { opts: hooked(opts ?? {}) }) as Promise<QueryPage>;
    },
    count(opts) {
      return send(MODEL_COUNT, { opts: hooked(opts ?? {}) }) as Promise<number>;
    },
    exists(where) {
      return send(MODEL_EXISTS, { where: where ?? {} }) as Promise<boolean>;
    },
    facets(fields, opts) {
      const query: QueryOptions = opts ?? {};
      return send(MODEL_FACETS, { fields, opts: query }) as Promise<FacetResult>;
    },
    add: (row, opts) => send(MODEL_ADD, withOpts({ row }, opts)) as Promise<Row>,
    addMany: (rows, opts) => send(MODEL_ADD_MANY, withOpts({ rows }, opts)) as Promise<Row[]>,
    edit(idOrRow: string | number | (Row & { id: string | number }), patchOrOpts: Record<string, unknown> | ClientWriteOptions | undefined, opts: ClientWriteOptions | undefined) {
      const byId = (id: string | number): Promise<Row> => send(MODEL_EDIT, withOpts({ id, patch: (patchOrOpts ?? {}) as Row }, opts)) as Promise<Row>;
      if (typeof idOrRow === "string") return byId(idOrRow);
      if (typeof idOrRow === "number") return byId(idOrRow);
      const row: Row = idOrRow;
      return send(MODEL_EDIT, withOpts({ id: row.id, patch: row }, patchOrOpts as ClientWriteOptions | undefined)) as Promise<Row>;
    },
    remove: (id, opts) => send(MODEL_REMOVE, withOpts({ id }, opts)) as Promise<boolean>,
    removeAll: (where = {}) => send(MODEL_REMOVE_MANY, { where }) as Promise<number>,
  };
  return api;
};

/**
 * A model to import where it is used: its api, typed by its schema, over the
 * request `configureModel` set.
 *
 *     export default defineModel("todos", { title: T.string({ required: true }) });
 */
export function defineModel<S extends ModelSchema>(name: string, schema: S): ModelApi<RowOf<S>, ModelSchema>;
export function defineModel(name: string, schema: ModelSchema): unknown {
  return modelApi(name, () => schema);
}
