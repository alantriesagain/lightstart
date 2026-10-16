/**
 * @bootstrapp/light/model: the model registry. `Model.<name>` is a plain
 * object of the eleven methods, built once per name, sending `MODEL:*`
 * commands through the request its host supplies: a store in the same page,
 * or a port to a worker that holds one. Rows are the plain objects the store
 * answered; liveness is `onChange`.
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
export { configureModel, modelBus } from "./config.js";

/** @import { ClientWriteOptions, ModelApi, ModelRegistry, ModelRequest, ModelSchema, QueryOptions, Row } from "./types.ts" */

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
 * @param {string} name
 * @param {ModelRequest} request
 * @param {(name: string) => ModelSchema | undefined} schemaOf
 * @returns {ModelApi}
 */
const modelApi = (name, request, schemaOf) => {
  /** @param {string} action @param {Record<string, unknown>} payload */
  const send = (action, payload) => request(action, name, payload);
  /** @param {QueryOptions} opts */
  const hooked = (opts) => applyQueryHooks({ model: name, schema: schemaOf(name), opts });
  /**
   * @param {string | number | (Row & { id: string | number })} idOrRow
   * @param {Record<string, unknown>} [patchOrOpts] the patch after an id, the write options after a row
   * @param {ClientWriteOptions} [opts]
   */
  const edit = (idOrRow, patchOrOpts, opts) =>
    isId(idOrRow)
      ? send(MODEL_EDIT, withOpts({ id: idOrRow, patch: patchOrOpts ?? {} }, opts))
      : send(MODEL_EDIT, withOpts({ id: idOrRow.id, patch: idOrRow }, /** @type {ClientWriteOptions | undefined} */ (patchOrOpts)));
  return /** @type {ModelApi} */ ({
    [MODEL_API]: true,
    name,
    get schema() {
      return schemaOf(name);
    },
    /** @param {string | number | QueryOptions} idOrOpts @param {QueryOptions} [opts] */
    get: (idOrOpts, opts = {}) =>
      isId(idOrOpts) ? send(MODEL_GET, { id: idOrOpts, opts: hooked(opts) }) : send(MODEL_GET, { opts: hooked(idOrOpts ?? {}) }),
    getAll: async (opts = {}) => /** @type {{ rows: Row[] }} */ (await send(MODEL_QUERY, { opts: hooked({ ...opts, total: false }) })).rows,
    query: (opts = {}) => send(MODEL_QUERY, { opts: hooked(opts) }),
    count: (opts = {}) => send(MODEL_COUNT, { opts: hooked(opts) }),
    exists: (where = {}) => send(MODEL_EXISTS, { where }),
    facets: (fields, opts = {}) => send(MODEL_FACETS, { fields, opts }),
    add: (row, opts) => send(MODEL_ADD, withOpts({ row }, opts)),
    addMany: (rows, opts) => send(MODEL_ADD_MANY, withOpts({ rows }, opts)),
    edit,
    remove: (id, opts) => send(MODEL_REMOVE, withOpts({ id }, opts)),
    removeAll: (where = {}) => send(MODEL_REMOVE_MANY, { where }),
  });
};

/**
 * Build the registry. `Model.<name>` answers the same api object on every
 * read; `Model.ext(id)` scopes names under an extension's namespace.
 * `schemaOf` answers a model's schema, which the query hooks and an api's
 * `schema` read.
 *
 * @param {ModelRequest} request
 * @param {{ schemaOf?: (name: string) => ModelSchema | undefined }} [options]
 * @returns {ModelRegistry}
 */
export function createModel(request, { schemaOf = () => undefined } = {}) {
  /** @type {Map<string, ModelApi>} */
  const apis = new Map();
  /** @param {string} name */
  const apiFor = (name) => {
    let api = apis.get(name);
    if (!api) apis.set(name, (api = modelApi(name, request, schemaOf)));
    return api;
  };

  /** @type {Map<string, ModelRegistry>} */
  const scoped = new Map();
  const statics = {
    request,
    /** @param {string} extensionId */
    ext(extensionId) {
      if (!extensionId) throw new Error("Model.ext(extensionId): extensionId is required");
      let registry = scoped.get(extensionId);
      if (!registry) {
        registry = /** @type {ModelRegistry} */ (new Proxy({ ...statics, extensionId }, {
          get: (target, prop) => (prop in target ? Reflect.get(target, prop) : typeof prop === "string" ? apiFor(`${extensionId}_${prop}`) : undefined),
        }));
        scoped.set(extensionId, registry);
      }
      return registry;
    },
  };

  return /** @type {ModelRegistry} */ (new Proxy(statics, {
    get: (target, prop) => (prop in target ? Reflect.get(target, prop) : typeof prop === "string" ? apiFor(prop) : undefined),
  }));
}
