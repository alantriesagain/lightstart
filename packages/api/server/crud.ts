/**
 * @file `crudApp` answers a `@lightstart/server` app of `/api/<model>` routes
 * over a D1-shaped database. A schema's `$permissions` decides who reads and
 * writes; an owner row is scoped to the caller's id, an anonymous reader of a
 * public model sees only the listed fields, and every identifier is checked
 * against the schema before it reaches SQL.
 *
 * Query string:
 * - `where` is a JSON object, as `buildWhereClause` reads it, e.g.
 *   `where={"done":false,"title":{"like":"note"}}`.
 * - `order` is a comma list (`-created,title` or `title DESC`) or a JSON
 *   array of strings or `{ "field": "title", "direction": "desc" }` objects.
 * - `fields` is a comma list (`id,title`) or a JSON array of names.
 * - `limit`, `offset` and `total=1` ride beside them; `total=1` adds the
 *   count of the whole match as `total`.
 */

import { App, Context, HttpError, fail, json, type Reply } from "@lightstart/server";
import { buildCountSQL, buildDeleteSQL, buildInsertSQL, buildSelectSQL, buildUpdateSQL, getArrayFields, getJsonFields, numericId } from "@lightstart/light/model/sql-builder";
import { decodeRow } from "@lightstart/light/model/sql";

import { check, readPermissions, type Caller } from "./permissions.ts";

import type { ModelSchema, OrderSpec } from "@lightstart/light/model/types.ts";
import type { D1Like } from "./d1.ts";

/** How `crudApp` is built. */
export interface CrudOptions {
  /** The models it answers for, by table name. */
  models: Record<string, ModelSchema>;
  /** The database, opened on first use. */
  db: () => D1Like | Promise<D1Like>;
  /** Who makes a request, from the request itself. */
  caller: (request: Request) => Caller | Promise<Caller>;
  /** The route prefix, "/api" by default. */
  prefix?: string;
  /** The most rows a non-admin list answers, 100 by default. */
  maxLimit?: number;
}

type JsonObject = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);

const parseJson = (raw: string, name: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid " + name + ": malformed JSON");
  }
};

const parseWhere = (raw: string | null): JsonObject => {
  if (raw === null || raw.trim() === "") return {};
  const value = parseJson(raw, "where");
  if (!isRecord(value)) throw new HttpError(400, "invalid where: expected a JSON object");
  return value;
};

const orderText = (text: string): OrderSpec[] => {
  const out: OrderSpec[] = [];
  for (const part of text.split(",")) {
    const trimmed = part.trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("-")) {
      const field = trimmed.slice(1).split(/\s+/)[0] ?? "";
      if (field !== "") out.push({ field, direction: "DESC" });
      continue;
    }
    const [field = "", direction = "ASC"] = trimmed.split(/\s+/);
    if (field === "") continue;
    out.push({ field, direction: direction.toUpperCase() === "DESC" ? "DESC" : "ASC" });
  }
  return out;
};

const parseOrderQuery = (raw: string | null): OrderSpec[] => {
  if (raw === null || raw.trim() === "") return [];
  const text = raw.trim();
  if (text.startsWith('"')) {
    const value = parseJson(text, "order");
    if (typeof value !== "string") throw new HttpError(400, "invalid order: expected a string");
    return orderText(value);
  }
  if (!text.startsWith("[")) return orderText(text);
  const value = parseJson(text, "order");
  if (!Array.isArray(value)) throw new HttpError(400, "invalid order: expected a JSON array");
  const out: OrderSpec[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      out.push(...orderText(entry));
      continue;
    }
    if (isRecord(entry) && typeof entry["field"] === "string") {
      const direction = typeof entry["direction"] === "string" && entry["direction"].toUpperCase() === "DESC" ? "DESC" : "ASC";
      out.push({ field: entry["field"], direction });
      continue;
    }
    throw new HttpError(400, "invalid order: expected strings or { field, direction } objects");
  }
  return out;
};

const parseFieldsQuery = (raw: string | null): string[] => {
  if (raw === null || raw.trim() === "") return [];
  const text = raw.trim();
  if (!text.startsWith("[")) return text.split(",").map((part) => part.trim()).filter((part) => part !== "");
  const value = parseJson(text, "fields");
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) throw new HttpError(400, "invalid fields: expected a JSON array of names");
  return value as string[];
};

const parseCount = (raw: string | null, name: string): number | undefined => {
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new HttpError(400, "invalid " + name);
  return value;
};

const fieldsOfSchema = (schema: ModelSchema): string[] => Object.keys(schema).filter((field) => !field.startsWith("$"));

const allColumns = (schema: ModelSchema): Set<string> => new Set(["id", "created", "updated", ...fieldsOfSchema(schema)]);

const bodyColumns = (schema: ModelSchema): Set<string> => new Set(["id", ...fieldsOfSchema(schema)]);

const ensureColumns = (names: string[], known: Set<string>): void => {
  for (const name of names) if (!known.has(name)) throw new HttpError(400, "unknown column: " + name);
};

const orderFields = (order: OrderSpec[]): string[] => order.map((part) => part.field);

const project = (row: JsonObject, fields: string[]): JsonObject =>
  Object.fromEntries(fields.filter((field) => Object.prototype.hasOwnProperty.call(row, field)).map((field): [string, unknown] => [field, row[field]]));

const denial = (who: Caller): Reply => (who === null ? fail("authentication required", 401) : fail("forbidden", 403));

const notFound = (): Reply => fail("not found", 404);

const bodyOf = async (c: Context): Promise<JsonObject> => {
  const value = await c.json();
  if (!isRecord(value)) throw new HttpError(400, "expected a JSON object");
  return value;
};

/** An app answering `/api/<model>` for the models given; unknown models are 404. */
export const crudApp = (options: CrudOptions): App => {
  const models = options.models;
  const maxLimit = options.maxLimit ?? 100;
  const prefix = (options.prefix ?? "/api").replace(/\/+$/, "");
  const database = options.db;
  const callerOf = options.caller;

  const callerOfRequest = async (c: Context): Promise<Caller> => callerOf(await c.request());

  const selectScoped = async (db: D1Like, model: string, schema: ModelSchema, id: string, scope: JsonObject | null): Promise<JsonObject | null> => {
    const where = scope === null ? { id } : { id, ...scope };
    const query = buildSelectSQL(model, { where, arrays: getArrayFields(schema) });
    const found = await db.prepare(query.sql).bind(...query.params).first();
    return found ?? null;
  };

  const app = new App();

  for (const [model, schema] of Object.entries(models)) {
    const base = (prefix === "" ? "" : prefix) + "/" + model;

    app.get(base, async (c: Context): Promise<Reply> => {
      const who = await callerOfRequest(c);
      const decision = check(readPermissions(schema), "read", who);
      if (!decision.allowed) return denial(who);
      const userWhere = parseWhere(c.query("where"));
      ensureColumns(Object.keys(userWhere), allColumns(schema));
      const order = parseOrderQuery(c.query("order"));
      ensureColumns(orderFields(order), allColumns(schema));
      const fields = parseFieldsQuery(c.query("fields"));
      ensureColumns(fields, allColumns(schema));
      const where = decision.scope === null ? userWhere : { ...userWhere, ...decision.scope };
      const wanted = decision.fields ?? (fields.length > 0 ? fields : null);
      const givenLimit = parseCount(c.query("limit"), "limit");
      const limit = givenLimit !== undefined && who !== null && who.admin === true ? givenLimit : givenLimit !== undefined && givenLimit > maxLimit ? maxLimit : givenLimit;
      const offset = parseCount(c.query("offset"), "offset");
      const db = await database();
      const query = buildSelectSQL(model, { where, order, limit, offset, fields: wanted, arrays: getArrayFields(schema) });
      const result = await db.prepare(query.sql).bind(...query.params).all();
      const rows = (result.results ?? []).map((row) => decodeRow(schema, row));
      const page: { rows: JsonObject[]; total?: number } = { rows: decision.fields === null ? rows : rows.map((row) => project(row, decision.fields ?? [])) };
      if (c.query("total") === "1" || c.query("total") === "true") {
        const countQuery = buildCountSQL(model, { where, arrays: getArrayFields(schema) });
        const found = await db.prepare(countQuery.sql).bind(...countQuery.params).first();
        page.total = Number(found?.["count"] ?? 0);
      }
      return json(page);
    });

    app.get(base + "/count", async (c: Context): Promise<Reply> => {
      const who = await callerOfRequest(c);
      const decision = check(readPermissions(schema), "read", who);
      if (!decision.allowed) return denial(who);
      const userWhere = parseWhere(c.query("where"));
      ensureColumns(Object.keys(userWhere), allColumns(schema));
      const where = decision.scope === null ? userWhere : { ...userWhere, ...decision.scope };
      const db = await database();
      const query = buildCountSQL(model, { where, arrays: getArrayFields(schema) });
      const found = await db.prepare(query.sql).bind(...query.params).first();
      return json({ count: Number(found?.["count"] ?? 0) });
    });

    app.get(base + "/:id", async (c: Context): Promise<Reply> => {
      const who = await callerOfRequest(c);
      const decision = check(readPermissions(schema), "read", who);
      if (!decision.allowed) return denial(who);
      const db = await database();
      const row = await selectScoped(db, model, schema, c.param("id") ?? "", decision.scope);
      if (row === null) return notFound();
      const decoded = decodeRow(schema, row);
      return json(decision.fields === null ? decoded : project(decoded, decision.fields));
    });

    app.post(base, async (c: Context): Promise<Reply> => {
      const who = await callerOfRequest(c);
      const decision = check(readPermissions(schema), "create", who);
      if (!decision.allowed) return denial(who);
      const body = await bodyOf(c);
      ensureColumns(Object.keys(body), bodyColumns(schema));
      const data: JsonObject = decision.stamp === null ? { ...body } : { ...body, ...decision.stamp };
      if (!numericId(schema) && (data["id"] === undefined || data["id"] === null)) data["id"] = crypto.randomUUID();
      const db = await database();
      const query = buildInsertSQL(model, data, getJsonFields(schema));
      const result = await db.prepare(query.sql + " RETURNING *").bind(...query.params).all();
      const created = result.results?.[0];
      if (created === undefined) throw new HttpError(500, "insert returned no row");
      return json(decodeRow(schema, created), 201);
    });

    app.patch(base + "/:id", async (c: Context): Promise<Reply> => {
      const who = await callerOfRequest(c);
      const decision = check(readPermissions(schema), "write", who);
      if (!decision.allowed) return denial(who);
      const body = await bodyOf(c);
      ensureColumns(Object.keys(body), bodyColumns(schema));
      const db = await database();
      const existing = await selectScoped(db, model, schema, c.param("id") ?? "", decision.scope);
      if (existing === null) return notFound();
      const key = (existing["id"] ?? c.param("id") ?? "") as string | number;
      const query = buildUpdateSQL(model, key, body, getJsonFields(schema));
      const result = await db.prepare(query.sql + " RETURNING *").bind(...query.params).all();
      const updated = result.results?.[0];
      return json(decodeRow(schema, updated ?? existing));
    });

    app.delete(base + "/:id", async (c: Context): Promise<Reply> => {
      const who = await callerOfRequest(c);
      const decision = check(readPermissions(schema), "delete", who);
      if (!decision.allowed) return denial(who);
      const db = await database();
      const existing = await selectScoped(db, model, schema, c.param("id") ?? "", decision.scope);
      if (existing === null) return notFound();
      const key = (existing["id"] ?? c.param("id") ?? "") as string | number;
      const query = buildDeleteSQL(model, key);
      await db.prepare(query.sql).bind(...query.params).run();
      return json({ deleted: true });
    });
  }

  return app;
};
