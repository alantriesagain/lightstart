/**
 * @file @lightstart/light/types
 * `T`: property descriptors for components, controllers and models. The
 * shorthand that reads a descriptor off a plain default, the coercion of an
 * attribute string into the declared type, persistence and validation for a
 * stored row, dates, unions, relationships, timestamps and files.
 */

import { isDescriptor, parse } from "./parse.js";
import { attachValidate, validateType } from "./validate.js";
import { createTimestamp } from "./timestamp.js";
import { createFileType, createFilesType } from "./file.js";

export { isDescriptor, parse, parsers } from "./parse.js";
export { validateType } from "./validate.js";

/** @import { PropertyDeclaration, TypeDefinition, TypeExtension, TypeOptions, TypesAPI } from "./types.js" */

const NON_ATTRIBUTE_TYPES = new Set(["array", "object", "function"]);
const BELONG_RELATIONSHIPS = new Set(["belongs", "belongs_many"]);
const MANY_RELATIONSHIPS = new Set(["many", "belongs_many"]);

/**
 * A property descriptor. `options` is an options object or a bare default
 * (`T.string("hi")` is `T.string({ defaultValue: "hi" })`; an array is a
 * default too). Arrays, objects and functions do not read attributes. A
 * descriptor is persisted unless it is a plain `reactive: false` field, and
 * carries `validate`.
 * @param {string} type
 * @param {TypeOptions | unknown} [options]
 * @returns {TypeDefinition<never>}
 */
export const createType = (type, options) => {
  const typeDef = /** @type {TypeDefinition} */ ({
    $type: type,
    persist: true,
    attribute: !NON_ATTRIBUTE_TYPES.has(type),
    ...(typeof options === "object" && !Array.isArray(options) && options !== null ? options : { defaultValue: options }),
  });
  if (typeDef.reactive === false) {
    if (typeDef.getter || typeDef.setter || typeDef.hasChanged || typeDef.sync || typeDef.query)
      throw new Error(`T.${type}: reactive:false is a plain instance field; it cannot combine with getter/setter/hasChanged/sync/query.`);
    typeDef.attribute = false;
    typeDef.persist = false;
  }
  if ((typeDef.key !== undefined || typeDef.scope !== undefined) && !typeDef.sync)
    throw new Error(`T.${type}: key/scope only apply to a sync: property.`);
  return attachValidate(typeDef);
};

/**
 * The descriptor a `props` entry declares: a descriptor as it is, with
 * its nested `props` and `itemType` normalised the same way; any other
 * value as a default whose type is read off the value (a number, a string, a
 * boolean, an array, a function, an object, or `null` as `any`).
 * @param {PropertyDeclaration} value
 * @returns {TypeDefinition}
 */
export const normalizeProperty = (value) => {
  if (isDescriptor(value)) {
    if ("properties" in value) throw new Error(`T.${value.$type}: "properties" is "props" now; declare the nested shape under "props"`);
    const nested = value.props ? { props: normalizeProperties(value.props) } : null;
    const items = value.itemType
      ? { itemType: isDescriptor(value.itemType) ? normalizeProperty(value.itemType) : normalizeProperties(value.itemType) }
      : null;
    return nested || items ? { ...value, ...nested, ...items } : value;
  }
  if (value === null || value === undefined) return createType("any", { defaultValue: value });
  if (Array.isArray(value)) return createType("array", { defaultValue: value });
  switch (typeof value) {
    case "number":
    case "string":
    case "boolean":
      return createType(typeof value, value);
    case "function":
      return createFunction({ defaultValue: value });
    default:
      return createType("object", { defaultValue: value });
  }
};

/**
 * A whole `props` block as descriptors.
 * @param {Record<string, PropertyDeclaration>} block
 * @returns {Record<string, TypeDefinition>}
 */
export const normalizeProperties = (block) =>
  Object.fromEntries(Object.entries(block).map(([key, value]) => [key, normalizeProperty(value)]));

/**
 * Whether a descriptor is a reactive store field (the default) or a plain
 * per-instance field (`reactive: false`).
 * @param {{ reactive?: boolean } | undefined} prop
 */
export const isReactive = (prop) => prop?.reactive !== false;

/**
 * A field's starting value from its descriptor, fresh per instance: a factory
 * default is called, an object or array is deep-cloned, a primitive passes.
 * @param {{ defaultValue?: unknown } | undefined} prop
 * @returns {unknown}
 */
export const cloneDefault = (prop) => {
  const dv = prop?.defaultValue;
  return typeof dv === "function" ? /** @type {() => unknown} */ (dv)() : dv && typeof dv === "object" ? structuredClone(dv) : dv;
};

/**
 * A relationship factory for one of `"one" | "many" | "belongs" | "belongs_many"`.
 *
 * @param {"one" | "many" | "belongs" | "belongs_many"} relationship
 * @returns {(targetModel: string | string[], targetForeignKeyOrOptions?: string | TypeOptions, options?: TypeOptions) => TypeDefinition<never>}
 */
const createRelationType = (relationship) => (targetModel, targetForeignKeyOrOptions, options) => {
  /** @type {string | undefined} */
  let targetForeignKey;
  /** @type {TypeOptions | undefined} */
  let extraOptions = options;
  if (typeof targetForeignKeyOrOptions === "string") targetForeignKey = targetForeignKeyOrOptions;
  else extraOptions = targetForeignKeyOrOptions;

  const belongs = BELONG_RELATIONSHIPS.has(relationship);

  return attachValidate({
    $type: belongs
      ? relationship === "belongs_many"
        ? "array"
        : "string"
      : relationship === "one"
        ? "string"
        : "array",
    persist: belongs,
    attribute: false,
    many: MANY_RELATIONSHIPS.has(relationship),
    belongs,
    relationship,
    defaultValue: relationship === "belongs_many" ? [] : null,
    polymorphic: targetModel === "*" || Array.isArray(targetModel),
    targetModel,
    targetForeignKey,
    index: belongs,
    ...extraOptions,
  });
};

/**
 * @param {TypeOptions & { types?: TypeDefinition[] }} [options]
 * @returns {TypeDefinition<never>}
 */
const createUnion = (options = {}) =>
  attachValidate({ $type: "union", persist: true, attribute: false, ...options, types: options.types ?? [] });

/**
 * @param {TypeOptions & { args?: TypeDefinition[], returns?: TypeDefinition | null }} [options]
 * @returns {TypeDefinition<never>}
 */
const createFunction = (options = {}) =>
  attachValidate({ $type: "function", persist: false, attribute: false, ...options, args: options.args ?? [], returns: options.returns ?? null });

/**
 * An extension factory whose output carries `validate`, as `createType`'s does.
 *
 * @param {(options?: TypeOptions) => object} factory
 * @returns {(options?: TypeOptions) => TypeDefinition<never>}
 */
const wrapExtensionFactory = (factory) => (options) => attachValidate(factory(options));

/**
 * Add an extension's factories to `T`: after
 * `T.registerTypes({ types: { foo: createFoo } })`, `T.foo()` builds a
 * descriptor that carries `validate`. Its typing comes from augmenting
 * `TypesAPI` in the module that registers it.
 *
 * @param {TypeExtension} extension
 */
const registerTypes = (extension) => {
  const { types } = extension;
  if (!types) return;
  for (const name of Object.keys(types))
    /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (T))[name] = wrapExtensionFactory(types[name]);
};

/** @param {string} type */
const primitive = (type) => (/** @type {unknown} */ options) => createType(type, options);

/** @type {TypesAPI} */
const T = {
  any: primitive("any"),
  string: primitive("string"),
  number: primitive("number"),
  boolean: primitive("boolean"),
  date: primitive("date"),
  datetime: primitive("datetime"),
  array: primitive("array"),
  object: primitive("object"),
  union: createUnion,
  function: createFunction,
  one: createRelationType("one"),
  many: createRelationType("many"),
  belongs: createRelationType("belongs"),
  belongs_many: createRelationType("belongs_many"),
  timestamp: wrapExtensionFactory(createTimestamp),
  file: wrapExtensionFactory(createFileType),
  files: wrapExtensionFactory(createFilesType),
  createType,
  parse,
  validateType,
  registerTypes,
};

export default T;
