/// <reference lib="dom" />
/**
 * @file The `content` store adapter type: a read-only store whose rows are an
 * app's built `content/<model>/*.md` files. For each model it fetches
 * `content/<model>.json` once (every row without the model's `$heavy` fields),
 * loads those rows into light's memory adapter and answers every read through
 * it; `get` fetches `content/<model>/<slug>.json` for the whole row and caches
 * it. A read that fails is tried again on the next call. A write rejects,
 * naming the model, since the store is read-only.
 */

import { createAdapter, hasAdapter, registerStorageAdapter } from "@lightstart/light/model/adapter";
import type { ModelSchema, QueryOptions, QueryPage, Row, StorageAdapter, WhereClause } from "@lightstart/light/model/types.ts";
import { AdapterType } from "@lightstart/app/stores.ts";
import { MemoryAdapter } from "@lightstart/app/memory.ts";
import type { MemoryStorage } from "@lightstart/app/memory.ts";
import type { App } from "@lightstart/app";

/** What a content adapter may be opened with: a base other than the app's, and the fetch to read files with. */
export interface ContentAdapterOptions {
  /** The path the content files are served under; the running app's base when absent. */
  base?: string;
  /** How files are read; `fetch` when absent (a test passes one over a map). */
  fetch?: typeof fetch;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const withId = (row: Record<string, unknown>): Row => {
  const slug = typeof row["slug"] === "string" ? row["slug"] : undefined;
  const id = typeof row["id"] === "string" || typeof row["id"] === "number" ? row["id"] : slug;
  return id === undefined ? { ...row } : { id, ...row };
};

const writeError = (model: string): Error => new Error(`The content store is read-only: it cannot write model "${model}"`);

/** One content store: a memory adapter over each model's list file, and the whole-row files fetched on demand. */
class ContentStorage implements StorageAdapter {
  [extra: string]: unknown;
  readonly type = "content";
  readonly models: Record<string, ModelSchema>;
  readonly name: string;
  private readonly base: string;
  private readonly fetchFile: typeof fetch;
  private readonly memory: MemoryStorage;
  private readonly lists = new Map<string, Promise<void>>();
  private readonly index = new Map<string, Map<string, Record<string, unknown>>>();
  private readonly rows = new Map<string, Promise<Row | null>>();

  constructor(base: string, fetchFile: typeof fetch, memory: MemoryStorage, models: Record<string, ModelSchema>, name: string) {
    this.base = base.replace(/\/+$/, "");
    this.fetchFile = fetchFile;
    this.memory = memory;
    this.models = models;
    this.name = name;
  }

  private url(model: string, slug?: string): string {
    const path = slug === undefined ? `/content/${encodeURIComponent(model)}.json` : `/content/${encodeURIComponent(model)}/${encodeURIComponent(slug)}.json`;
    return `${this.base}${path}`;
  }

  private async read(url: string, model: string): Promise<unknown> {
    const response = await this.fetchFile(url);
    if (!response.ok) throw new Error(`The content store could not read "${url}" (${String(response.status)}) for model "${model}"`);
    return response.json();
  }

  private ensure(model: string): Promise<void> {
    const known = this.lists.get(model);
    if (known !== undefined) return known;
    const job = this.load(model).catch((error: unknown) => {
      this.lists.delete(model);
      throw error;
    });
    this.lists.set(model, job);
    return job;
  }

  private async load(model: string): Promise<void> {
    const value = await this.read(this.url(model), model);
    const raw = Array.isArray(value) ? value : [];
    const rows = raw.filter(isRecord).map(withId);
    const table = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      table.set(String(row["id"]), row);
      if (typeof row["slug"] === "string" || typeof row["slug"] === "number") table.set(String(row["slug"]), row);
    }
    this.index.set(model, table);
    const insertMany = this.memory.insertMany;
    if (rows.length > 0 && typeof insertMany === "function") await insertMany.call(this.memory, model, rows);
  }

  private rowOf(model: string, slug: string): Promise<Row | null> {
    const key = `${model}\u0000${slug}`;
    const known = this.rows.get(key);
    if (known !== undefined) return known;
    const job = this.readRow(model, slug).catch((error: unknown) => {
      this.rows.delete(key);
      throw error;
    });
    this.rows.set(key, job);
    return job;
  }

  private async readRow(model: string, slug: string): Promise<Row | null> {
    const response = await this.fetchFile(this.url(model, slug));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`The content store could not read "${this.url(model, slug)}" (${String(response.status)}) for model "${model}"`);
    const value: unknown = await response.json();
    return isRecord(value) ? withId(value) : null;
  }

  init(): Promise<unknown> {
    return Promise.resolve();
  }

  async get(model: string, id: string | number): Promise<Row | null> {
    await this.ensure(model);
    const entry = this.index.get(model)?.get(String(id));
    if (entry === undefined) return null;
    const slug = typeof entry["slug"] === "string" || typeof entry["slug"] === "number" ? String(entry["slug"]) : String(id);
    const full = await this.rowOf(model, slug);
    if (full === null) return { ...entry };
    const rowId = full.id ?? (typeof entry["id"] === "string" || typeof entry["id"] === "number" ? entry["id"] : undefined);
    return { ...entry, ...full, id: rowId };
  }

  async query(model: string, options: QueryOptions): Promise<QueryPage> {
    await this.ensure(model);
    return this.memory.query(model, options);
  }

  async count(model: string, where?: WhereClause): Promise<number> {
    await this.ensure(model);
    return this.memory.count(model, where);
  }

  insert(model: string): Promise<Row> {
    return Promise.reject(writeError(model));
  }

  insertMany(model: string): Promise<Row[]> {
    return Promise.reject(writeError(model));
  }

  update(model: string): Promise<Row> {
    return Promise.reject(writeError(model));
  }

  delete(model: string): Promise<boolean> {
    return Promise.reject(writeError(model));
  }

  async close(): Promise<void> {
    await this.memory.close();
    this.lists.clear();
    this.index.clear();
    this.rows.clear();
  }
}

/** The `content` adapter type: a read-only store over an app's built content files. */
export class ContentAdapterType extends AdapterType {
  readonly name = "content";
  private readonly options: ContentAdapterOptions;

  constructor(options: ContentAdapterOptions = {}) {
    super();
    this.options = options;
  }

  open(app: App, store: string, at: string, models: Record<string, ModelSchema>, main: boolean): Promise<StorageAdapter> {
    if (!hasAdapter("memory")) registerStorageAdapter("memory", MemoryAdapter);
    const base = this.options.base ?? (at.length > 0 ? at : app.base);
    const memory = createAdapter("memory", { name: main ? app.name : app.name + ":" + store, models, isDefaultAdapter: main }) as MemoryStorage;
    const fetchFile = this.options.fetch ?? fetch;
    return memory.init().then((): StorageAdapter => new ContentStorage(base, fetchFile, memory, models, main ? app.name : app.name + ":" + store));
  }
}

/** The content store's adapter type, for a project bringing its own. */
export const contentAdapterType = (options: ContentAdapterOptions = {}): ContentAdapterType => new ContentAdapterType(options);
