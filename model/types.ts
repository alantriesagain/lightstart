/**
 * @bootstrapp/light/model: type declarations. Public types are reachable via
 * `import("@bootstrapp/light/model").Foo`; a host that generates typings per
 * model narrows `ModelRegistry` by name.
 */

import type { TypeDefinition } from "../types/types.ts";

// ---------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------

/**
 * The keys of a schema that are not fields:
 * - `$hooks`: lifecycle callbacks
 * - `$adapter`: the adapter this model lives in
 * - `$extension`: the extension that owns the model; the store routes it to the database named `ext:<id>`
 * - `$heavy`: fields an adapter leaves out of a list read; a `get` by `where`
 *   reads such a row again by its id, whole
 * - `$shadow`: the adapter (today `"indexeddb"`) that also keeps a device-local
 *   store of this model, under the model's own name and indexes, for a
 *   decorator to read and write; the store itself never routes to it
 *
 * A host or a storage package augments this interface with the directives
 * its own adapter or hooks read.
 */
export interface ModelSchemaDirectives {
  $hooks?: ModelHooks;
  $adapter?: string;
  $shadow?: string;
  $extension?: string;
  $heavy?: string[];
}

/** Model field definitions plus the directives above. */
export type ModelSchema = Record<string, TypeDefinition> & ModelSchemaDirectives;

export interface ModelHooks {
  beforeAdd?: HookFn;
  afterAdd?: HookFn;
  beforeEdit?: HookFn;
  afterEdit?: HookFn;
  beforeRemove?: HookFn;
  afterRemove?: HookFn;
}

export type HookFn = (data: Row, ctx: HookContext) => unknown | Promise<unknown>;

/** What a hook sees: the model, the store to read and write through, and the operation. */
export interface HookContext {
  model: string;
  store: Store;
  operation: "add" | "edit" | "remove";
  id?: unknown;
  importing?: boolean;
}

/**
 * What a write carries past the pipeline to the adapter. `importing` marks a
 * seed, `direct` a caller that bypasses whatever a decorator would do with
 * the write (the admin, a dev path); `patch` is the normalised patch of an
 * edit, beside the merged row the adapter stores.
 */
export interface WriteOptions {
  importing?: boolean;
  direct?: boolean;
  patch?: Row;
}

/** The write options a client may send over the wire. */
export type ClientWriteOptions = Pick<WriteOptions, "direct">;

// ---------------------------------------------------------------------
// Rows and queries
// ---------------------------------------------------------------------

/** A stored record: any object with an `id`. Rows are plain objects on every runtime. */
export type Row = Record<string, unknown> & { id?: string | number };

export type QueryOperator =
  | ">" | ">=" | "<" | "<="
  | "!=" | "<>"
  | "in" | "not in"
  | "has" | "has all"
  | "like" | "ilike"
  | "is null" | "is not null"
  | "=";

export type WhereCondition = string | number | boolean | null | Partial<Record<QueryOperator, unknown>>;

export type WhereClause<R = Row> = { [K in keyof R & string]?: WhereCondition | unknown } & { [field: string]: WhereCondition | unknown };

export interface OrderSpec {
  field: string;
  direction: "ASC" | "DESC" | "asc" | "desc";
}

export interface QueryOptions<R = Row> {
  where?: WhereClause<R>;
  /** `"-field"` or `"field"` (a comma list allowed), `"field DESC"`, or `OrderSpec[]`. */
  order?: string | OrderSpec[];
  limit?: number;
  /** `false`: the caller discards `QueryPage.total`, so an adapter that pays a request for the count skips it and answers `rows.length`. `getAll` and `get` set it. */
  total?: boolean;
  offset?: number;
  groupBy?: string;
  includes?: string[];
  fields?: Array<keyof R & string> | string[];
  /** The locale an adapter that keeps translations reads the rows in. */
  locale?: string;
  [extra: string]: unknown;
}

/** What `query()` answers: the page and the size of the whole match. */
export interface QueryPage<R = Row> {
  rows: R[];
  total: number;
}

/** The in-memory pipeline's answer (`buildQueryResult`); adapters map it onto a `QueryPage`. */
export interface QueryResult {
  items: Row[];
  count: number;
  total: number;
  limit?: number;
  offset: number;
  groupBy: string | null;
}

export type FacetResult = Record<string, Record<string, number>>;

/** What a registered query hook sees: the model, its schema and the caller's options. */
export interface QueryHookContext {
  model: string;
  schema: ModelSchema | undefined;
  opts: QueryOptions;
}

/** A `registerQueryHook` callback: answer the options to use, or nothing to keep them. */
export type QueryHook = (ctx: QueryHookContext) => QueryOptions | void;

/** The upload provider `setFileStorage` installs; the store sends `T.file()` blobs through it. */
export interface FileStorage {
  upload(blob: Blob, opts: { field: string; model: string }): Promise<{ url: string }>;
}

// ---------------------------------------------------------------------
// Change events
// ---------------------------------------------------------------------

/**
 * The `model:changed` payload the store emits after every write. A `sync`
 * carries no row: the whole collection changed and every follower re-reads.
 * A `remove` carries the stored row when the model declares a remove hook,
 * `{ id }` otherwise: the store reads nothing it does not need.
 */
export interface ModelChanged<R = Row> {
  model: string;
  action: "add" | "edit" | "remove" | "sync";
  row?: R;
}

export type ChangeCallback<R = Row> = (event: ModelChanged<R>) => void;

// ---------------------------------------------------------------------
// The per-model api and the registry
// ---------------------------------------------------------------------

/** The eleven methods of `Model.<name>`; a host's generated typings bind `R`. */
export interface ModelApi<R extends Row = Row> {
  readonly name: string;
  /** The model's schema, as the registry's `schemaOf` answers it. */
  readonly schema: ModelSchema | undefined;
  get(id: string | number, opts?: QueryOptions<R>): Promise<R | null>;
  get(opts: QueryOptions<R>): Promise<R | null>;
  getAll(opts?: QueryOptions<R>): Promise<R[]>;
  query(opts?: QueryOptions<R>): Promise<QueryPage<R>>;
  count(opts?: QueryOptions<R>): Promise<number>;
  exists(where?: WhereClause<R>): Promise<boolean>;
  facets(fields?: string[], opts?: QueryOptions<R>): Promise<FacetResult>;
  add(row: Partial<R> & Record<string, unknown>, opts?: ClientWriteOptions): Promise<R>;
  addMany(rows: Array<Partial<R> & Record<string, unknown>>, opts?: ClientWriteOptions): Promise<R[]>;
  edit(id: string | number, patch: Partial<R> & Record<string, unknown>, opts?: ClientWriteOptions): Promise<R>;
  edit(row: Partial<R> & { id: string | number } & Record<string, unknown>, opts?: ClientWriteOptions): Promise<R>;
  remove(id: string | number, opts?: ClientWriteOptions): Promise<boolean>;
  removeAll(where?: WhereClause<R>): Promise<number>;
}

/** How a registry reaches the store: the store itself in the same page, or a port to a worker that holds one. */
export type ModelRequest = (action: string, model: string, payload?: Record<string, unknown>) => Promise<unknown>;

/**
 * A per-model api under every name. A host's generated typings narrow
 * declared names to `ModelApi<XRecord>`; an undeclared name answers the
 * untyped `ModelApi`.
 */
export interface ModelRegistry {
  request: ModelRequest;
  /** The same registry scoped to an extension's namespace: `Model.ext("delivery").scripts` is `Model.delivery_scripts`. */
  ext(extensionId: string): ModelRegistry;
  [modelName: string]: any;
}

// ---------------------------------------------------------------------
// Storage adapters and the store
// ---------------------------------------------------------------------

/**
 * What a storage adapter implements. It stores and answers rows; the store
 * runs hooks, defaults, validation, uploads and change events around it.
 * `query` answers a page and the size of the whole match, and honours
 * `where`, `order`, `limit`, `offset` and `fields` itself (a local adapter
 * borrows `buildQueryResult` from `@bootstrapp/light/model/adapter`).
 */
export interface StorageAdapter {
  type?: string;
  models?: Record<string, ModelSchema>;
  name?: string;
  version?: number | string;
  init(): Promise<unknown>;
  get(model: string, id: string | number, opts?: Pick<QueryOptions, "locale">): Promise<Row | null>;
  query(model: string, opts: QueryOptions): Promise<QueryPage>;
  insert(model: string, row: Row, opts?: WriteOptions): Promise<Row>;
  update(model: string, row: Row, opts?: WriteOptions): Promise<Row>;
  delete(model: string, id: string | number, opts?: WriteOptions): Promise<unknown>;
  count(model: string, where?: WhereClause): Promise<number>;
  close(): Promise<unknown>;
  insertMany?(model: string, rows: Row[], opts?: WriteOptions): Promise<Row[]>;
  /** Drop whatever the adapter caches for `model`, so the next read fetches again. */
  invalidate?(model: string): void;
  /** The id a new row gets when the caller sent none (a file adapter answers the slug). */
  nextId?(model: string, row: Row): string | number;
  exists?(model: string, where?: WhereClause): Promise<boolean>;
  facets?(model: string, fields?: string[], opts?: QueryOptions): Promise<FacetResult>;
  truncate?(model: string): Promise<unknown>;
  supportsOperator?(operator: string): boolean;
  /** A remote adapter with push feeds `model:changed` through this; the store never calls it. */
  subscribe?(model: string, cb: ChangeCallback): Promise<() => void> | (() => void);
  [extra: string]: unknown;
}

/** What a decorator factory receives beside the adapter it wraps. */
export interface AdapterDecoratorContext {
  model: string;
  schema: ModelSchema | undefined;
  store: Store;
  /** The model's `$shadow` adapter, or null when it declares none. */
  shadow: StorageAdapter | null;
  emit: (event: string, data: unknown) => unknown;
}

/**
 * A `registerAdapterDecorator` factory: answers the adapter the store uses for
 * one model whose schema declares the decorator's directive, over the routed
 * `base`. It delegates method by method; the base keeps its own state.
 */
export type AdapterDecorator = (base: StorageAdapter, ctx: AdapterDecoratorContext) => StorageAdapter;

/** A reader the relation loader needs: the store satisfies it. */
export interface RowReader {
  get(model: string, id: string | number): Promise<Row | null>;
  getAll(model: string, opts?: QueryOptions): Promise<Row[]>;
}

export interface StoreConfig {
  models: Record<string, ModelSchema>;
  databases?: Record<string, StorageAdapter>;
  defaultAdapter?: string;
  /** Receives `model:changed` after every write; omit for a store nothing follows. */
  emit?: ((event: string, data: unknown) => unknown) | null;
}

/** The store: every model's reads and writes over the adapter that holds it. */
export interface Store extends RowReader {
  models: Record<string, ModelSchema>;
  databases: Record<string, StorageAdapter>;
  defaultAdapter: string;
  /** The adapter every read and write of `model` goes through: the routed one, wrapped by the decorators its schema calls for. */
  adapterFor(model: string): StorageAdapter;
  /** The routed adapter alone, with no decorator. */
  baseAdapterFor(model: string): StorageAdapter;
  /** The model's `$shadow` adapter, or null. */
  shadowFor(model: string): StorageAdapter | null;
  addDatabase(name: string, adapter: StorageAdapter): void;
  addModels(models: Record<string, ModelSchema>): void;
  supportsOperator(model: string, operator: string): boolean;
  get(model: string, idOrWhere: string | number | WhereClause | null, opts?: QueryOptions): Promise<Row | null>;
  query(model: string, opts?: QueryOptions): Promise<QueryPage>;
  count(model: string, opts?: QueryOptions): Promise<number>;
  exists(model: string, where?: WhereClause): Promise<boolean>;
  facets(model: string, fields?: string[], opts?: QueryOptions): Promise<FacetResult>;
  add(model: string, data: Row, options?: WriteOptions): Promise<Row>;
  addMany(model: string, rows: Row[], options?: WriteOptions): Promise<Row[]>;
  edit(model: string, id: string | number, patch: Row, options?: WriteOptions): Promise<Row>;
  remove(model: string, id: string | number, options?: WriteOptions): Promise<boolean>;
  removeAll(model: string, where?: WhereClause): Promise<number>;
  truncate(model: string): Promise<void>;
  runAfterAdd(model: string, row: Row): Promise<void>;
  exportData(): Promise<Record<string, Row[]>>;
  importData(dump: Record<string, Row[]>): Promise<void>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------

export interface RelationshipDefinition extends TypeDefinition {
  relationship: "one" | "many" | "belongs" | "belongs_many";
  targetModel: string | string[];
  targetForeignKey?: string;
  many?: boolean;
  belongs?: boolean;
  polymorphic?: boolean;
  as?: string;
}

/** The bus the model emits its warnings, its logs and `model:changed` on; see `configureModel`. */
export interface ModelBus {
  on(key: string, cb: (data: unknown) => unknown): () => void;
  emit(key: string, data?: unknown): unknown;
}

/** `modelQuery()` options: a model query plus the resource knobs. */
export interface ModelQueryOptions extends Pick<QueryOptions, "where" | "order" | "fields" | "includes" | "limit" | "offset"> {
  name?: string;
  eager?: boolean;
  ready?: import("../controller/types.ts").ResourceOptions["ready"];
}

declare module "../controller/types.ts" {
  interface SyncTargets {
    model: ModelApi;
  }
}

export * from "./index.js";
