/**
 * @file The per-locale model hooks: a slug unique within its locale, a
 * canonical id shared by a record's variants, and publishing fields synced
 * across them.
 */
import { assert, done, same, test } from "./check.ts";
import type { FacetResult, HookContext, QueryPage, QueryOptions, Row, Store, WhereClause } from "@lightstart/light/model";
import { createI18nHooks, i18nPublishingHooks, i18nSlugHooks } from "../model-hooks.ts";

type FakeRow = Row & {
  locale?: string;
  slug?: string;
  canonicalId?: string;
  status?: string;
  publishedAt?: string;
  scheduledAt?: string;
};

interface Fake {
  store: Store;
  rows: FakeRow[];
}

const conditionMatches = (value: unknown, cond: unknown): boolean => {
  if (cond === null || typeof cond !== "object" || Array.isArray(cond)) return value === cond;

  const clauses = cond as Record<string, unknown>;
  if ("like" in clauses) {
    if (typeof value !== "string") return false;
    const like = String(clauses.like);
    return value === like || value.startsWith(like + "-");
  }
  if ("=" in clauses) return value === clauses["="];
  return false;
};

const matchesWhere = (row: FakeRow, where: WhereClause | undefined): boolean => {
  if (!where) return true;
  for (const key of Object.keys(where)) {
    if (!conditionMatches(row[key], where[key])) return false;
  }
  return true;
};

/** A store that holds only what the hooks read and write. */
const makeStore = (initial: FakeRow[]): Fake => {
  const rows = initial;

  const getAll = async (_model: string, opts?: QueryOptions): Promise<Row[]> => {
    const found = rows.filter((row) => matchesWhere(row, opts?.where));
    return opts?.limit === undefined ? found : found.slice(0, opts.limit);
  };

  const get = async (_model: string, idOrWhere: string | number | WhereClause | null): Promise<Row | null> => {
    if (idOrWhere === null) return null;
    if (typeof idOrWhere === "object") {
      return rows.find((row) => matchesWhere(row, idOrWhere)) ?? null;
    }
    return rows.find((row) => String(row.id) === String(idOrWhere)) ?? null;
  };

  const edit = async (_model: string, id: string | number, patch: Row): Promise<Row> => {
    const row = rows.find((item) => String(item.id) === String(id));
    if (!row) throw new Error(`no row ${String(id)}`);
    return Object.assign(row, patch);
  };

  const store: Store = {
    models: {},
    databases: {},
    defaultAdapter: "memory",
    adapterFor: () => {
      throw new Error("unused");
    },
    baseAdapterFor: () => {
      throw new Error("unused");
    },
    shadowFor: () => null,
    addDatabase: () => {},
    addModels: () => {},
    supportsOperator: (_model: string, _operator: string): boolean => true,
    query: async (): Promise<QueryPage> => ({ rows: [], total: 0 }),
    count: async (): Promise<number> => 0,
    exists: async (): Promise<boolean> => false,
    facets: async (): Promise<FacetResult> => ({}),
    add: async (_model: string, data: Row): Promise<Row> => data,
    addMany: async (_model: string, added: Row[]): Promise<Row[]> => added,
    getAll,
    get,
    edit,
    remove: async (): Promise<boolean> => false,
    removeAll: async (): Promise<number> => 0,
    truncate: async (): Promise<void> => {},
    runAfterAdd: async (): Promise<void> => {},
    exportData: async (): Promise<Record<string, Row[]>> => ({}),
    importData: async (): Promise<void> => {},
    close: async (): Promise<void> => {},
  };

  return { store, rows };
};

const context = (fake: Fake, operation: "add" | "edit" | "remove"): HookContext => ({
  model: "posts",
  store: fake.store,
  operation,
});

const call = async (
  hook: ((data: Row, ctx: HookContext) => unknown | Promise<unknown>) | undefined,
  data: FakeRow,
  ctx: HookContext,
): Promise<FakeRow> => {
  if (!hook) throw new Error("hook missing");
  const out = await hook(data, ctx);
  return out === undefined ? data : (out as FakeRow);
};

await test("a slug is unique within its locale", async () => {
  const fake = makeStore([]);
  const hooks = i18nSlugHooks();
  const ctx = context(fake, "add");

  const english = await call(hooks.beforeAdd, { locale: "en", name: "Hello World" }, ctx);
  fake.rows.push(english);
  assert.equal(english.slug, "hello-world", "first slug");

  const second = await call(hooks.beforeAdd, { locale: "en", name: "Hello World" }, ctx);
  fake.rows.push(second);
  assert.equal(second.slug, "hello-world-1", "second slug in the same locale");

  const french = await call(hooks.beforeAdd, { locale: "fr", name: "Hello World" }, ctx);
  assert.equal(french.slug, "hello-world", "the same slug is free in another locale");
});

await test("variants share a canonical id", async () => {
  const fake = makeStore([]);
  const hooks = i18nSlugHooks();
  const ctx = context(fake, "add");

  const english = await call(hooks.beforeAdd, { locale: "en", name: "Hello World" }, ctx);
  const french = await call(hooks.beforeAdd, { locale: "fr", name: "Hello World" }, ctx);

  assert.equal(english.canonicalId, english.slug, "the slug is the canonical id");
  same(french.canonicalId, english.canonicalId, "both locales point at one canonical id");
});

await test("publishing fields sync across variants", async () => {
  const fake = makeStore([
    { id: "1", locale: "en", canonicalId: "hello-world", status: "draft" },
    { id: "2", locale: "fr", canonicalId: "hello-world", status: "draft" },
    { id: "3", locale: "de", canonicalId: "other", status: "draft" },
  ]);
  const hooks = i18nPublishingHooks();
  const ctx = context(fake, "edit");

  const result: FakeRow = {
    id: "1",
    locale: "en",
    canonicalId: "hello-world",
    status: "published",
    publishedAt: "2026-01-01",
  };
  await call(hooks.afterEdit, result, ctx);

  assert.equal(fake.rows[1].status, "published", "sibling status follows");
  assert.equal(fake.rows[1].publishedAt, "2026-01-01", "sibling publishedAt follows");
  assert.equal(fake.rows[2].status, "draft", "another canonical id is untouched");
});

await test("the combined hooks carry both behaviours", async () => {
  const fake = makeStore([]);
  const hooks = createI18nHooks();
  const ctx = context(fake, "add");

  const row = await call(hooks.beforeAdd, { locale: "en", name: "Hello World" }, ctx);

  assert.equal(row.slug, "hello-world", "slug generated");
  assert.equal(row.canonicalId, "hello-world", "canonical id generated");
});

done();
