/**
 * @file D1 over Cloudflare's HTTP API: find or create a database, bind it to
 * the Pages project as `DB`, query it, read its tables' columns and index
 * names, and plan and run a migration with `@lightstart/api`'s
 * `planMigration`. `d1Settings` gathers the account's credentials (the
 * environment over the project's `.env`), the Pages project and the database
 * name from `src/cloudflare`, naming whatever is missing.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { planMigration } from "@lightstart/api/node/migrate.ts";

import type { CloudflareApi } from "./cloudflare-api.ts";
import { parseEnv, projectNameOf } from "./deploy.ts";

/** The credentials and wrangler environment a Cloudflare command runs with. */
export interface CloudflareCredentials {
  accountId: string;
  apiToken: string;
  /** The process environment with the credentials under wrangler's names. */
  env: Record<string, string>;
  /** The project's parsed `.env`. */
  file: Record<string, string>;
}

/** What a D1 command reads: the credentials, the Pages project and the database name. */
export interface D1Settings {
  accountId: string;
  apiToken: string;
  project: string;
  database: string;
}

/** A remote database's tables and columns, and the index names it has. */
export interface RemoteSchema {
  columns: Record<string, string[]>;
  indexes: string[];
}

/** What `migrateRemote` is asked for. */
export interface MigrateRemoteOptions {
  /** Plan only; run nothing. */
  dryRun?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const quoteIdentifier = (name: string): string => `"${name.replace(/"/g, '""')}"`;

/** `CF_ACCOUNT_ID` and `CF_API_TOKEN`, the environment over the project's `.env`, with a clear error when missing. */
export const credentialsOf = (
  project: string,
  environment: Record<string, string | undefined> = process.env,
): CloudflareCredentials => {
  const filePath = join(project, ".env");
  const file = existsSync(filePath) ? parseEnv(readFileSync(filePath, "utf8")) : {};
  const read = (key: string): string | undefined => environment[key] ?? file[key];
  const accountId = read("CF_ACCOUNT_ID");
  const apiToken = read("CF_API_TOKEN");
  const missing = [
    accountId === undefined || accountId === "" ? "CF_ACCOUNT_ID" : "",
    apiToken === undefined || apiToken === "" ? "CF_API_TOKEN" : "",
  ].filter((key) => key !== "");
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(" and ")}: set them in the environment or in the project's .env (and keep .env out of git)`);
  }
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  env["CLOUDFLARE_ACCOUNT_ID"] = accountId ?? "";
  env["CLOUDFLARE_API_TOKEN"] = apiToken ?? "";
  return { accountId: accountId ?? "", apiToken: apiToken ?? "", env, file };
};

const sourceOf = (project: string): string | null => {
  const ts = join(project, "src", "cloudflare.ts");
  const js = join(project, "src", "cloudflare.js");
  if (existsSync(ts) && existsSync(js)) throw new Error("The app has both src/cloudflare.ts and src/cloudflare.js; keep one of them");
  if (existsSync(ts)) return ts;
  if (existsSync(js)) return js;
  return null;
};

/** `src/cloudflare`'s default export, or an empty config when the app has none. */
export const cloudflareConfigOf = async (project: string): Promise<Record<string, unknown>> => {
  const source = sourceOf(project);
  if (source === null) return {};
  const loaded: unknown = (await import(`${pathToFileURL(source).href}?mtime=${String(Date.now())}`) as { default?: unknown }).default;
  if (!isRecord(loaded)) throw new Error(`${source} default-exports no config; use defineCloudflare({ project })`);
  return loaded;
};

/** Read the credentials, the Pages project and `src/cloudflare`'s `d1`, failing with what is missing. */
export const d1Settings = async (project: string): Promise<D1Settings> => {
  const config = await cloudflareConfigOf(project);
  const d1 = config["d1"];
  if (d1 !== undefined && (typeof d1 !== "string" || d1.trim() === "")) {
    throw new Error("src/cloudflare has a d1 that is not a database name");
  }
  if (typeof d1 !== "string") {
    throw new Error('No D1 database: name one in src/cloudflare (defineCloudflare({ d1: "<name>" }))');
  }
  const { accountId, apiToken } = credentialsOf(project);
  return { accountId, apiToken, project: await projectNameOf(project), database: d1 };
};

/** The uuid of the account's database named `name`, or null when it has none. */
export const databaseOf = async (api: CloudflareApi, name: string): Promise<string | null> => {
  const result = await api.get(`/d1/database?name=${encodeURIComponent(name)}`);
  if (!Array.isArray(result)) return null;
  for (const row of result) {
    if (isRecord(row) && row["name"] === name && typeof row["uuid"] === "string") return row["uuid"];
  }
  return null;
};

/** The database's uuid, creating it when the account has none by that name. */
export const ensureDatabase = async (api: CloudflareApi, name: string): Promise<string> => {
  const existing = await databaseOf(api, name);
  if (existing !== null) return existing;
  const created = await api.post("/d1/database", { name });
  if (!isRecord(created) || typeof created["uuid"] !== "string") {
    throw new Error(`Cloudflare did not return the database ${name}`);
  }
  return created["uuid"];
};

/** Bind the database as `DB` to the Pages project, production and preview alike. */
export const bindDatabase = async (api: CloudflareApi, project: string, uuid: string): Promise<void> => {
  await api.patch(`/pages/projects/${encodeURIComponent(project)}`, {
    deployment_configs: {
      production: { d1_databases: { DB: { id: uuid } } },
      preview: { d1_databases: { DB: { id: uuid } } },
    },
  });
};

/** Run one statement against the database over its HTTP API and answer the rows. */
export const remoteQuery = async (
  api: CloudflareApi,
  uuid: string,
  sql: string,
  params?: readonly unknown[],
): Promise<Record<string, unknown>[]> => {
  const body: Record<string, unknown> = { sql };
  if (params !== undefined) body["params"] = params;
  const result = await api.post(`/d1/database/${encodeURIComponent(uuid)}/query`, body);
  if (!Array.isArray(result)) return [];
  const first = result[0];
  if (!isRecord(first) || !Array.isArray(first["results"])) return [];
  return first["results"].filter(isRecord);
};

/** D1's own tables (`_cf_KV` in every new database) and SQLite's: D1 refuses `PRAGMA table_info` on them, and no model names them. */
const internalTable = (name: string): boolean => name.startsWith("_cf_") || name.startsWith("sqlite_");

/** Every table's columns, D1's and SQLite's own left out, and the database's index names, in the shape `planMigration` takes. */
export const remoteSchema = async (api: CloudflareApi, uuid: string): Promise<RemoteSchema> => {
  const tables = await remoteQuery(api, uuid, "SELECT name FROM sqlite_master WHERE type = 'table'");
  const columns: Record<string, string[]> = {};
  for (const row of tables) {
    const name = row["name"];
    if (typeof name !== "string" || internalTable(name)) continue;
    const info = await remoteQuery(api, uuid, `PRAGMA table_info(${quoteIdentifier(name)})`);
    columns[name] = info
      .map((column) => (typeof column["name"] === "string" ? column["name"] : ""))
      .filter((column) => column !== "");
  }
  const indexes = await remoteQuery(api, uuid, "SELECT name FROM sqlite_master WHERE type = 'index'");
  return {
    columns,
    indexes: indexes.map((row) => (typeof row["name"] === "string" ? row["name"] : "")).filter((name) => name !== ""),
  };
};

/** Plan the migration from the remote schema and run it statement by statement, answering the statements. */
export const migrateRemote = async (
  api: CloudflareApi,
  uuid: string,
  models: Record<string, ModelSchema>,
  options: MigrateRemoteOptions = {},
): Promise<string[]> => {
  const schema = await remoteSchema(api, uuid);
  const statements = planMigration(schema.columns, models, schema.indexes);
  if (options.dryRun !== true) {
    for (const sql of statements) await remoteQuery(api, uuid, sql);
  }
  return statements;
};
