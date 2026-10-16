/**
 * @bootstrapp/light/types: the property descriptor `T` builds, the shorthand
 * a `props` block may use in its place, and what validation answers.
 */

/** Result of validating a single value against a descriptor. */
export interface ValidationResult {
  valid: boolean;
  /** Coerced value (or original on failure). */
  value: unknown;
  /** Error code (`"required"`, `"invalid"`, ...) or `null`. */
  error: string | null;
  /** Optional error details. */
  details: unknown;
}

/** What the validators answer: `[errorCode, valueOrDetails]`, or nothing when valid. */
export type ValidationTuple = [string, unknown] | [null, unknown] | null | undefined;

/** A check that runs before the built-in validation; a truthy answer fails with it. */
export type CustomValidator = (
  value: unknown,
  prop: TypeDefinition,
  context?: object,
) => ValidationTuple;

/**
 * The fields of a descriptor. The view engine reads `$type` through
 * `hasChanged`; a model reads the rest. Different factories fill different
 * subsets; an extension registered with `T.registerTypes` adds its own
 * through the index signature of `TypeDefinition`.
 */
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
  /** Whether a model stores the field; off for a `reactive: false` field, a function and a relationship a row does not own. */
  persist: boolean;
  required?: boolean;
  index?: boolean;
  /** Declares the backing index unique, honored by the IndexedDB adapter when it creates the store's indexes. */
  unique?: boolean;
  immutable?: boolean;
  virtual?: string | undefined;
  enum?: readonly string[];
  format?: string | RegExp | ((value: unknown) => boolean);
  min?: number;
  max?: number;
  types?: TypeDefinition[];
  args?: TypeDefinition[];
  returns?: TypeDefinition | null;
  relationship?: "one" | "many" | "belongs" | "belongs_many";
  targetModel?: string | string[];
  targetForeignKey?: string;
  many?: boolean;
  belongs?: boolean;
  polymorphic?: boolean;
  mixed?: boolean;
  fieldType?: string;
  customValidator?: CustomValidator;
  sync?: unknown;
  /** Adapter key for a `sync:` property; defaults to the property name, which every view and controller declaring that name shares. */
  key?: string;
  /** Name of a sibling property (or `"a.b"`) whose value prefixes the adapter key as `${value}:${key}`; a null value skips the bind. */
  scope?: string;
  query?: object;
  timestamp?: boolean;
  update?: boolean;
  create?: boolean;
  accept?: string;
  maxSize?: number;
  maxWidth?: number | null;
  maxHeight?: number | null;
  quality?: number | null;
  maxItems?: number | null;
  validate(value: unknown, context?: object): ValidationResult;
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

/** A definition's `props` block as the author writes it: descriptors, or defaults standing in for them. */
export type PropertyDeclarations = Record<string, PropertyDeclaration>;

/**
 * Map a `props: { x: T.string(), count: 0 }` block into the TS shape
 * that ends up on `this` inside `render()` / lifecycle hooks (`this.x: string`,
 * `this.count: number`); see `PropertyValue`.
 */
export type PropsToThis<P> = {
  [K in keyof P]: PropertyValue<P[K]>;
};

/** Whether `V` is a union of more than one member (`boolean` counts). */
type IsUnion<V, U = V> = V extends unknown ? ([U] extends [V] ? false : true) : never;

/**
 * The value type a `props` entry declares: a descriptor's phantom type; for a
 * default, its widened type (`false` is `boolean`, `0` is `number`, `""` is
 * `string`), an empty array literal as `unknown[]`, `null` as `any`. A default
 * cast to a type keeps it whole: a `null` cast to `User | null` is
 * `User | null`, and a string cast to `"a" | "b"` stays that union. A
 * declaration not yet decided (the whole `PropertyDeclaration` union, as a
 * generic signature carries it) is `any`.
 */
export type PropertyValue<V> = [PropertyDeclaration] extends [V] ? any
  : [V] extends [TypeDefinition<infer T>] ? T
  : [V] extends [null | undefined] ? any
  : [V] extends [readonly never[]] ? unknown[]
  : true extends IsUnion<V> ? V
  : [V] extends [boolean] ? boolean
  : [V] extends [number] ? number
  : [V] extends [string] ? string
  : V;

export type TypeOptions = Partial<Omit<TypeDefinitionFields, "$type" | "validate">> & Record<string, unknown>;

/** An options object, or a bare default: `T.string("hi")` is `T.string({ defaultValue: "hi" })`, `T.array([])` a default too. */
export type TypeOptionsOrDefault = TypeOptions | readonly unknown[] | string | number | boolean | null | undefined;

export type Parser = (value: unknown, prop?: TypeDefinition) => unknown;

/** An extension for `T.registerTypes`: a custom name mapped to the factory of its descriptor's fields. */
export interface TypeExtension {
  types: Record<string, (options?: TypeOptions) => object>;
}

type Factory<T> = (options?: TypeOptionsOrDefault) => TypeDefinition<T>;
type RelationFactory<T> = (
  targetModel: string | string[],
  targetForeignKeyOrOptions?: string | TypeOptions,
  options?: TypeOptions,
) => TypeDefinition<T>;

export interface TypesAPI {
  any: Factory<unknown>;
  string: Factory<string>;
  number: Factory<number>;
  boolean: Factory<boolean>;
  date: Factory<string>;
  datetime: Factory<string>;
  array: Factory<unknown[]>;
  object: Factory<Record<string, unknown>>;
  union(options?: TypeOptions & { types?: TypeDefinition[] }): TypeDefinition<unknown>;
  function(options?: TypeOptions & { args?: TypeDefinition[]; returns?: TypeDefinition | null }): TypeDefinition<(...args: unknown[]) => unknown>;
  one: RelationFactory<string>;
  many: RelationFactory<string[]>;
  belongs: RelationFactory<string>;
  belongs_many: RelationFactory<string[]>;
  timestamp(options?: TypeOptions): TypeDefinition<number | string>;
  file(options?: TypeOptions): TypeDefinition<File | string>;
  files(options?: TypeOptions): TypeDefinition<(File | string)[]>;
  createType(type: string, options?: TypeOptions | unknown): TypeDefinition;
  parse(value: unknown, prop?: TypeDefinition): unknown;
  validateType(
    object: Record<string, unknown>,
    options: {
      schema: Record<string, TypeDefinition>;
      row?: Record<string, unknown>;
      undefinedProps?: boolean;
      validateVirtual?: boolean;
      operation?: string | null;
    },
  ): [Record<string, string> | null, Record<string, unknown> | null];
  registerTypes(extension: TypeExtension): void;
  [key: string]: unknown;
}

export * from "./index.js";
export { default } from "./index.js";
