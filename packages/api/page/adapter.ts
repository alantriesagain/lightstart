/// <reference lib="dom" />
/**
 * @file The `api` store adapter type: a page's models read and written over
 * HTTP at `<base>/api/<model>`, where the base is the running app's base
 * (`appUrl("")`, or the store's `at`) and the server answers the routes
 * `@lightstart/api/server` serves. A query's `where`, `order` and `fields`
 * travel as JSON in the query string, and its `total` asks the server for the
 * whole match's size. `configureApi` installs the bearer-token provider and
 * the fetch a test reads through.
 */

import { appUrl } from "@lightstart/app/base.ts";
import type { App } from "@lightstart/app";
import { AdapterType } from "@lightstart/app/stores.ts";
import type { ModelSchema, QueryOptions, QueryPage, Row, StorageAdapter, WhereClause, WriteOptions } from "@lightstart/light/model/types.ts";

/** What `configureApi` sets: a bearer-token provider, the fetch to use, and a path prefix before `/api`. */
export interface ApiOptions {
  /** Answers the bearer token to send, or null for none; may be async (auth plugs in here). */
  token?: () => string | null | Promise<string | null>;
  /** How requests are made; the global `fetch` when absent (a test passes a fake). */
  fetch?: typeof fetch;
  /** A path placed before `/api`, such as `"/v1"`; empty when absent. */
  prefix?: string;
}

let configured: ApiOptions = {};

/** Set the token provider, the fetch or the prefix the `api` store uses. */
export const configureApi = (options: ApiOptions): void => {
  configured = { ...configured, ...options };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const messageOf = (value: unknown): string => {
  if (!isRecord(value)) return "";
  if (typeof value["message"] === "string") return value["message"];
  if (typeof value["error"] === "string") return value["error"];
  return "";
};

/** One API store: fetch calls to `<base><prefix>/api/<model>`. */
class ApiStorage implements StorageAdapter {
  [extra: string]: unknown;
  readonly type = "api";
  readonly name: string;
  readonly models: Record<string, ModelSchema>;
  private readonly base: string;
  private readonly prefix: string;
  private readonly fetchImpl: typeof fetch;
  private readonly token: (() => string | null | Promise<string | null>) | undefined;

  constructor(base: string, prefix: string, fetchImpl: typeof fetch, token: (() => string | null | Promise<string | null>) | undefined, models: Record<string, ModelSchema>, name: string) {
    this.base = base.replace(/\/+$/, "");
    this.prefix = prefix;
    this.fetchImpl = fetchImpl;
    this.token = token;
    this.models = models;
    this.name = name;
  }

  private url(model: string, suffix?: string): string {
    const tail = suffix === undefined ? "" : `/${encodeURIComponent(suffix)}`;
    return `${this.base}${this.prefix}/api/${encodeURIComponent(model)}${tail}`;
  }

  private async headers(json: boolean): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (json) headers["content-type"] = "application/json";
    const token = this.token === undefined ? null : await this.token();
    if (token !== null && token !== "") headers["authorization"] = `Bearer ${token}`;
    return headers;
  }

  private async failure(response: Response, url: string): Promise<Error> {
    let detail = "";
    try {
      const text = await response.text();
      if (text !== "") {
        try {
          detail = messageOf(JSON.parse(text)) || text;
        } catch {
          detail = text;
        }
      }
    } catch {
      detail = "";
    }
    return new Error(`The api store request to "${url}" failed (${String(response.status)})${detail === "" ? "" : `: ${detail}`}`);
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    const response = await this.fetchImpl(url, init);
    if (!response.ok) throw await this.failure(response, url);
    return response;
  }

  private async valueOf(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private rowOf(value: unknown, fallback: Row): Row {
    if (!isRecord(value)) return fallback;
    return isRecord(value["row"]) ? value["row"] : value;
  }

  init(): Promise<unknown> {
    return Promise.resolve(true);
  }

  async get(model: string, id: string | number): Promise<Row | null> {
    const url = this.url(model, String(id));
    const response = await this.fetchImpl(url, { method: "GET", headers: await this.headers(false) });
    if (response.status === 404) return null;
    if (!response.ok) throw await this.failure(response, url);
    const value = await this.valueOf(response);
    return isRecord(value) ? (isRecord(value["row"]) ? value["row"] : value) : null;
  }

  async query(model: string, options: QueryOptions): Promise<QueryPage> {
    const params = new URLSearchParams();
    if (options.where !== undefined) params.set("where", JSON.stringify(options.where));
    if (options.order !== undefined) params.set("order", JSON.stringify(options.order));
    if (options.fields !== undefined && options.fields.length > 0) params.set("fields", JSON.stringify(options.fields));
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.offset !== undefined) params.set("offset", String(options.offset));
    if (options.total !== false) params.set("total", "1");
    const query = params.toString();
    const url = this.url(model) + (query === "" ? "" : `?${query}`);
    const value = await this.valueOf(await this.send(url, { method: "GET", headers: await this.headers(false) }));
    const record = isRecord(value) ? value : {};
    const rows = Array.isArray(record["rows"]) ? record["rows"].filter(isRecord) : [];
    const total = typeof record["total"] === "number" ? record["total"] : rows.length;
    return { rows, total };
  }

  async count(model: string, where?: WhereClause): Promise<number> {
    const params = new URLSearchParams();
    if (where !== undefined) params.set("where", JSON.stringify(where));
    const query = params.toString();
    const url = this.url(model, "count") + (query === "" ? "" : `?${query}`);
    const value = await this.valueOf(await this.send(url, { method: "GET", headers: await this.headers(false) }));
    return isRecord(value) && typeof value["count"] === "number" ? value["count"] : 0;
  }

  async insert(model: string, row: Row, _opts?: WriteOptions): Promise<Row> {
    const url = this.url(model);
    const response = await this.send(url, { method: "POST", headers: await this.headers(true), body: JSON.stringify(row) });
    return this.rowOf(await this.valueOf(response), row);
  }

  async update(model: string, row: Row, _opts?: WriteOptions): Promise<Row> {
    if (row.id === undefined) throw new Error(`The api store cannot update a "${model}" row with no id`);
    const url = this.url(model, String(row.id));
    const response = await this.send(url, { method: "PATCH", headers: await this.headers(true), body: JSON.stringify(row) });
    return this.rowOf(await this.valueOf(response), row);
  }

  async delete(model: string, id: string | number): Promise<unknown> {
    const url = this.url(model, String(id));
    const response = await this.fetchImpl(url, { method: "DELETE", headers: await this.headers(false) });
    if (response.status === 404) return false;
    if (!response.ok) throw await this.failure(response, url);
    const value = await this.valueOf(response);
    if (isRecord(value) && typeof value["deleted"] === "boolean") return value["deleted"];
    return value ?? true;
  }

  close(): Promise<unknown> {
    return Promise.resolve(true);
  }
}

/** The `api` adapter type: a store of an app's server models, read and written over HTTP. */
export class ApiAdapterType extends AdapterType {
  readonly name = "api";

  open(app: App, store: string, at: string, models: Record<string, ModelSchema>, main: boolean): Promise<StorageAdapter> {
    const base = at.length > 0 ? at : appUrl("");
    const raw = (configured.prefix ?? "").replace(/\/+$/, "");
    const prefix = raw === "" ? "" : raw.startsWith("/") ? raw : `/${raw}`;
    const fetchImpl = configured.fetch ?? fetch;
    const name = main ? app.name : app.name + ":" + store;
    return Promise.resolve(new ApiStorage(base, prefix, fetchImpl, configured.token, models, name));
  }
}
