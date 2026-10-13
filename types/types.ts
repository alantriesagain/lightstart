/**
 * @bootstrapp/light/types: the property descriptor `T` builds, and the
 * shorthand a `props` block may use in its place.
 */

/** The fields the view engine reads from a descriptor. A host adds its own (`sync`, `required`, ...) through the index signature. */
export interface TypeDefinitionFields {
  /** The declared type, and what marks an object as a descriptor rather than an object default. */
  $type: string;
  /** Whether the property reads its attribute (and reflects to it). Off for arrays, objects and functions. */
  attribute: boolean;
  /** `false` marks a plain per-instance field: no store signal, no attribute. Default reactive. */
  reactive?: boolean;
  defaultValue?: unknown;
  /** Descriptors of an object's keys; their defaults fill missing keys when an attribute is parsed. */
  props?: Record<string, PropertyDeclaration>;
  /** An array's items: one descriptor for every item, or descriptors of an object item's keys (parsed from an attribute). */
  itemType?: TypeDefinition | Record<string, PropertyDeclaration>;
  getter?: () => unknown;
  setter?: (value: unknown) => void;
  hasChanged?: (newValue: unknown, oldValue: unknown) => boolean;
}

/**
 * The phantom `T` never exists at runtime: it carries the type a property
 * declared with this descriptor holds, so `defineComponent` can type `this`
 * from a `props: { x: T.string() }` block.
 */
export type TypeDefinition<T = unknown> = TypeDefinitionFields & Record<string, unknown> & {
  readonly __tsType?: T;
};

/**
 * A default standing in for a descriptor: `count: 0` is `T.number(0)`,
 * `label: "x"` is `T.string("x")`, `open: false` is `T.boolean(false)`,
 * `items: []` is `T.array({ defaultValue: [] })`, an object is
 * `T.object({ defaultValue })`, `null` is `T.any({ defaultValue: null })`.
 * Any object counts, so a default cast to an interface type is one too.
 */
export type PropertyShorthand = string | number | boolean | null | undefined | object;

/** What a `props` entry may be: a descriptor, or a default the engine reads one off. */
export type PropertyDeclaration = TypeDefinition | PropertyShorthand;

export type TypeOptions = Partial<Omit<TypeDefinitionFields, "$type">> & Record<string, unknown>;

/** An options object, or a bare default: `T.string("hi")` is `T.string({ defaultValue: "hi" })`, `T.array([])` a default too. */
export type TypeOptionsOrDefault = TypeOptions | readonly unknown[] | string | number | boolean | null | undefined;

export type Parser = (value: unknown, prop?: TypeDefinition) => unknown;

type Factory<T> = (options?: TypeOptionsOrDefault) => TypeDefinition<T>;

export interface TypesAPI {
  any: Factory<unknown>;
  string: Factory<string>;
  number: Factory<number>;
  boolean: Factory<boolean>;
  array: Factory<unknown[]>;
  object: Factory<Record<string, unknown>>;
  function: Factory<(...args: unknown[]) => unknown>;
  createType(type: string, options?: TypeOptions | unknown): TypeDefinition;
  parse(value: unknown, prop?: TypeDefinition): unknown;
}

export * from "./index.js";
export { default } from "./index.js";
