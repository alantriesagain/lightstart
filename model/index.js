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
} from "./commands.js";
import { applyQueryHooks } from "./query-hooks.js";

export { registerQueryHook } from "./query-hooks.js";
export { setFileStorage, getFileStorage } from "./file-storage.js";
export { onChange } from "./changes.js";
export { ValidationError } from "./validate.js";
import { modelRequest } from "./config.js";

export { configureModel, modelBus, modelRequest } from "./config.js";

/** @import { ClientWriteOptions, ModelApi, ModelSchema, QueryOptions, Row, RowOf } from "./types.ts" */

/** Brands a per-model api so a `sync:` binder can tell it from any other object. */
export const MODEL_API = Symbol.for("bootstrapp.model.api");

/** @param {unknown} value @returns {value is ModelApi} */
export const isModelApi = (value) =>
  Boolean(value) && /** @type {Record<symbol, unknown>} */ (value)[MODEL_API] === true;

/** @param {unknown} value @returns {value is string | number} */
const isId = (value) => typeof value === "string" || typeof value === "number";

/** @param {Record<string, unknown>} payload @param {ClientWriteOptions | undefined} opts */
const withOpts = (payload, opts) => (opts ? { ...payload, opts } : payload);

/**
 * The api of the model `name`, for a host that resolves schemas by name:
 * `schemaOf` answers the schema when it is read (by `api.schema` and the
 * query hooks), so a schema registered later is still found.
 * @param {string} name
 * @param {() => ModelSchema | undefined} schemaOf
 * @returns {ModelApi}
 */
export const modelApi = (name, schemaOf) => {
  /** @param {string} action @param {Record<string, unknown>} payload */
  const send = (action, payload) => modelRequest()(action, name, payload);
  /** @param {QueryOptions} opts */
  const hooked = (opts) => applyQueryHooks({ model: name, schema: schemaOf(), opts });
  return /** @type {ModelApi} */ ({
    [MODEL_API]: true,
    name,
    get schema() {
      return schemaOf();
    },
    /** @param {string | number | QueryOptions} idOrOpts @param {QueryOptions} [opts] */
    get(idOrOpts, opts) {
      return isId(idOrOpts) ? send(MODEL_GET, { id: idOrOpts, opts: hooked(opts ?? {}) }) : send(MODEL_GET, { opts: hooked(idOrOpts ?? {}) });
    },
    async getAll(opts) {
      return /** @type {{ rows: Row[] }} */ (await send(MODEL_QUERY, { opts: hooked({ ...(opts ?? {}), total: false }) })).rows;
    },
    query(opts) {
      return send(MODEL_QUERY, { opts: hooked(opts ?? {}) });
    },
    count(opts) {
      return send(MODEL_COUNT, { opts: hooked(opts ?? {}) });
    },
    exists(where) {
      return send(MODEL_EXISTS, { where: where ?? {} });
    },
    facets(fields, opts) {
      return send(MODEL_FACETS, { fields, opts: opts ?? {} });
    },
    add: (row, opts) => send(MODEL_ADD, withOpts({ row }, opts)),
    addMany: (rows, opts) => send(MODEL_ADD_MANY, withOpts({ rows }, opts)),
    /**
     * @param {string | number | (Row & { id: string | number })} idOrRow
     * @param {Record<string, unknown>} [patchOrOpts] the patch after an id, the write options after a row
     * @param {ClientWriteOptions} [opts]
     */
    edit(idOrRow, patchOrOpts, opts) {
      return isId(idOrRow)
        ? send(MODEL_EDIT, withOpts({ id: idOrRow, patch: patchOrOpts ?? {} }, opts))
        : send(MODEL_EDIT, withOpts({ id: idOrRow.id, patch: idOrRow }, /** @type {ClientWriteOptions | undefined} */ (patchOrOpts)));
    },
    remove: (id, opts) => send(MODEL_REMOVE, withOpts({ id }, opts)),
    removeAll: (where = {}) => send(MODEL_REMOVE_MANY, { where }),
  });
};

/**
 * A model to import where it is used: its api, typed by its schema, over the
 * request `configureModel` set.
 *
 *     export default defineModel("todos", { title: T.string({ required: true }) });
 *
 * @template {ModelSchema} S
 * @param {string} name
 * @param {S} schema
 * @returns {ModelApi<RowOf<S>, ModelSchema>}
 */
export const defineModel = (name, schema) => /** @type {ModelApi<RowOf<S>, ModelSchema>} */ (modelApi(name, () => schema));
