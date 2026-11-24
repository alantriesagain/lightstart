/// <reference lib="dom" />
/**
 * @file The `content` store adapter type: a read-only store whose rows are an
 * app's built `content/<model>/*.md` and `*.json` files. For each model it
 * fetches `content/<model>.json` once (every row without the model's `$heavy`
 * fields), loads those rows into light's memory adapter and answers every read
 * through it; `get` fetches `content/<model>/<slug>.json` for the whole row and
 * caches it. A query's `locale` reads `content/<model>.<locale>.json` and
 * `content/<model>/<slug>.<locale>.json`, falling back to the default files
 * when a variant is not there. A read that fails is tried again on the next
 * call. A write rejects, naming the model, since the store is read-only.
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

const listKey = (model: string, locale: string): string => `${model}\u0000${locale}`;

/** One content store: a memory adapter per locale over each model's list file, and whole-row files fetched on demand. */
class ContentStorage implements StorageAdapter {
  [extra: string]: unknown;
  readonly type = "content";
  readonly models: Record<string, ModelSchema>;
  readonly name: string;
  private readonly base: string;
  private readonly fetchFile: typeof fetch;
  private readonly makeMemory: () => MemoryStorage;
  private readonly memories = new Map<string, Promise<MemoryStorage>>();
  private readonly fills = new Map<string, Promise<void>>();
  private readonly lists = new Map<string, Promise<void>>();
  private readonly loaded = new Map<string, string>();
  private readonly index = new Map<string, Map<string, Record<string, unknown>>>();
  private readonly rows = new Map<string, Promise<Row | null>>();

  constructor(base: string, fetchFile: typeof fetch, models: Record<string, ModelSchema>, name: string, makeMemory: () => MemoryStorage) {
    this.base = base.replace(/\/+$/, "");
    this.fetchFile = fetchFile;
    this.models = models;
    this.name = name;
    this.makeMemory = makeMemory;
  }

  private url(model: string, slug?: string, locale?: string): string {
    const suffix = locale === undefined || locale.length === 0 ? "" : `.${encodeURIComponent(locale)}`;
    const path = slug === undefined
      ? `/content/${encodeURIComponent(model)}${suffix}.json`
      : `/content/${encodeURIComponent(model)}/${encodeURIComponent(slug)}${suffix}.json`;
    return `${this.base}${path}`;
  }

  private memoryFor(locale: string): Promise<MemoryStorage> {
    const known = this.memories.get(locale);
    if (known !== undefined) return known;
    const storage = this.makeMemory();
    const job = Promise.resolve(storage.init()).then((): MemoryStorage => storage);
    this.memories.set(locale, job);
    return job;
  }

  private ensure(model: string, locale: string): Promise<void> {
    const key = listKey(model, locale);
    const known = this.lists.get(key);
    if (known !== undefined) return known;
    const job = this.load(model, locale).catch((error: unknown) => {
      this.lists.delete(key);
      throw error;
    });
    this.lists.set(key, job);
    return job;
  }

  private async load(model: string, locale: string): Promise<void> {
    const url = this.url(model, undefined, locale);
    let response = await this.fetchFile(url);
    let effective = locale;
    if (!response.ok && locale.length > 0 && response.status === 404) {
      effective = "";
      response = await this.fetchFile(this.url(model));
    }
    if (!response.ok) throw new Error(`The content store could not read "${url}" (${String(response.status)}) for model "${model}"`);
    const value: unknown = await response.json();
    const raw = Array.isArray(value) ? value : [];
    const rows = raw.filter(isRecord).map(withId);
    const table = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      table.set(String(row["id"]), row);
      if (typeof row["slug"] === "string" || typeof row["slug"] === "number") table.set(String(row["slug"]), row);
    }
    this.index.set(listKey(model, locale), table);
    this.loaded.set(listKey(model, locale), effective);
    const fillKey = listKey(model, effective);
    let fill = this.fills.get(fillKey);
    if (fill === undefined) {
      fill = this.memoryFor(effective).then(async (memory): Promise<void> => {
        const insertMany = memory.insertMany;
        if (rows.length > 0 && typeof insertMany === "function") await insertMany.call(memory, model, rows);
      }).catch((error: unknown) => {
        this.fills.delete(fillKey);
        throw error;
      });
      this.fills.set(fillKey, fill);
    }
    await fill;
  }

  private rowOf(model: string, slug: string, locale: string): Promise<Row | null> {
    const key = `${listKey(model, locale)}\u0000${slug}`;
    const known = this.rows.get(key);
    if (known !== undefined) return known;
    const job = this.readRow(model, slug, locale).catch((error: unknown) => {
      this.rows.delete(key);
      throw error;
    });
    this.rows.set(key, job);
    return job;
  }

  private async readRow(model: string, slug: string, locale: string): Promise<Row | null> {
    let response = await this.fetchFile(this.url(model, slug, locale));
    if (!response.ok && locale.length > 0 && response.status === 404) response = await this.fetchFile(this.url(model, slug));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`The content store could not read "${this.url(model, slug, locale)}" (${String(response.status)}) for model "${model}"`);
    const value: unknown = await response.json();
    return isRecord(value) ? withId(value) : null;
  }

  init(): Promise<unknown> {
    return Promise.resolve();
  }

  async get(model: string, id: string | number, opts?: Pick<QueryOptions, "locale">): Promise<Row | null> {
    const locale = opts?.locale ?? "";
    await this.ensure(model, locale);
    const entry = this.index.get(listKey(model, locale))?.get(String(id));
    if (entry === undefined) return null;
    const slug = typeof entry["slug"] === "string" || typeof entry["slug"] === "number" ? String(entry["slug"]) : String(id);
    const full = await this.rowOf(model, slug, locale);
    if (full === null) return { ...entry };
    const rowId = full.id ?? (typeof entry["id"] === "string" || typeof entry["id"] === "number" ? entry["id"] : undefined);
    return { ...entry, ...full, id: rowId };
  }

  async query(model: string, options: QueryOptions): Promise<QueryPage> {
    const locale = typeof options.locale === "string" ? options.locale : "";
    await this.ensure(model, locale);
    const effective = this.loaded.get(listKey(model, locale)) ?? locale;
    return (await this.memoryFor(effective)).query(model, options);
  }

  async count(model: string, where?: WhereClause, opts?: Pick<QueryOptions, "locale">): Promise<number> {
    const locale = opts?.locale ?? "";
    await this.ensure(model, locale);
    const effective = this.loaded.get(listKey(model, locale)) ?? locale;
    return (await this.memoryFor(effective)).count(model, where);
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
    for (const job of this.memories.values()) {
      const memory = await job;
      await memory.close();
    }
    this.memories.clear();
    this.fills.clear();
    this.lists.clear();
    this.loaded.clear();
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
    const name = main ? app.name : app.name + ":" + store;
    const makeMemory = (): MemoryStorage => createAdapter("memory", { name, models, isDefaultAdapter: main }) as MemoryStorage;
    const fetchFile = this.options.fetch ?? fetch;
    return Promise.resolve(new ContentStorage(base, fetchFile, models, name, makeMemory));
  }
}

/** The content store's adapter type, for a project bringing its own. */
export const contentAdapterType = (options: ContentAdapterOptions = {}): ContentAdapterType => new ContentAdapterType(options);
