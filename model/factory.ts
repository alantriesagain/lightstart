/**
 * The adapter registry. A storage package registers its adapter object
 * under a type name at load time; the boot instantiates one per type the
 * schemas ask for. A package may also register a decorator for a schema
 * directive: the store wraps the routed adapter of every model declaring
 * that directive.
 */

import { modelBus } from "./config.ts";
import { ADAPTER_REGISTERED, DATABASE_CREATED, MODEL_WARN } from "./events.ts";
import { schemaEntry } from "./fields.ts";

import type { AdapterDecorator, ModelSchema, StorageAdapter } from "./types.ts";

const ADAPTER_REGISTRY: Map<string, StorageAdapter> = new Map();
const DECORATOR_REGISTRY: Map<string, { decorate: AdapterDecorator }> = new Map();
const REQUIRED_METHODS: string[] = ["init", "get", "query", "insert", "update", "delete", "count", "close"];

/**
 * Register a storage adapter under a `type` name. The eight required methods
 * are checked here; the optional ones (`insertMany`, `exists`, `facets`,
 * `truncate`, `subscribe`, `supportsOperator`) are feature-detected by the
 * store.
 */
export const registerStorageAdapter = (type: string, definition: StorageAdapter): void => {
  const missing = REQUIRED_METHODS.filter((method) => typeof definition[method] !== "function");
  if (missing.length) throw new Error(`Adapter "${type}" is missing required methods: ${missing.join(", ")}`);
  if (ADAPTER_REGISTRY.has(type)) modelBus().emit(MODEL_WARN, { type: "adapter_overwrite", adapterType: type });
  ADAPTER_REGISTRY.set(type, definition);
  modelBus().emit(ADAPTER_REGISTERED, { type });
};

/**
 * Instantiate a registered adapter with `config` as its own fields
 * (`name`, `version`, `models`, `emit`, `getAuthToken`, the adapter's keys).
 */
export const createAdapter = (type: string, config: Record<string, unknown> & { name?: string, version?: number | string }): StorageAdapter => {
  const definition = ADAPTER_REGISTRY.get(type);
  if (!definition)
    throw new Error(`Unknown adapter type "${type}". Available types: ${getAvailableAdapters().join(", ")}. Use registerStorageAdapter() to register adapters.`);
  const instance = Object.create(definition) as StorageAdapter;
  for (const [key, value] of Object.entries(config)) instance[key] = value;
  modelBus().emit(DATABASE_CREATED, { type, name: config.name, version: config.version });
  return instance;
};

export const getAvailableAdapters = (): string[] => Array.from(ADAPTER_REGISTRY.keys());

export const hasAdapter = (type: string): boolean => ADAPTER_REGISTRY.has(type);

/**
 * Register a decorator for the models whose schema declares `directive`
 * (`$moderated`, ...): the store wraps their routed adapter with
 * `factory(base, context)` once per model, so every read and write of such
 * a model passes through it.
 */
export const registerAdapterDecorator = (directive: string, factory: AdapterDecorator): void => {
  if (DECORATOR_REGISTRY.has(directive)) modelBus().emit(MODEL_WARN, { type: "decorator_overwrite", directive });
  DECORATOR_REGISTRY.set(directive, { decorate: factory });
};

/** The decorators a schema's directives call for, in registration order. */
export const decoratorsFor = (schema: ModelSchema | undefined): AdapterDecorator[] => {
  const out: AdapterDecorator[] = [];
  if (!schema) return out;
  for (const [directive, { decorate }] of DECORATOR_REGISTRY) if (schemaEntry(schema, directive)) out.push(decorate);
  return out;
};
