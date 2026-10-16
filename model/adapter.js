/**
 * @bootstrapp/light/model/adapter: the storage adapter SPI. Everything an
 * adapter or a host needs beside the store: the registry (an adapter under a
 * type name, a decorator under a schema directive, an instance made from a
 * registered adapter) and the query helpers a local adapter matches, pages
 * and projects with. The write pipeline (hooks, validation, defaults, uploads,
 * change events) lives in the store, not in adapters.
 */

export { createAdapter, getAvailableAdapters, hasAdapter, registerAdapterDecorator, registerStorageAdapter } from "./factory.js";
export { validateRow, ValidationError } from "./validate.js";
export { applyFields, buildQueryResult, compileMatcher, matchesWhere, parseOrder, validateQueryOptions } from "./query-builder.js";
export { foreignKeyFor, relationWhere, relationValueToId, relationTarget } from "./relationships.js";
