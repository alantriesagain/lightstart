/**
 * @file `light serve` extended by the API: write the app's `.light/server.ts`,
 * migrate `.data/api.db`, and answer `/api/*` from the app's server models and
 * endpoints over `d1Of`. In development the caller comes from the
 * `x-light-user` header (an id, with `x-light-admin: 1` for an admin) until
 * auth lands. The entry is written once, when the server starts; change a
 * server model or an endpoint and restart `light serve`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/dev";
import { App } from "@lightstart/server";
import { d1Of } from "@lightstart/sqlite/d1";
import { Database } from "@lightstart/sqlite/node";

import { serverModels } from "../../node/models.ts";
import { migrateLocal } from "../../node/migrate.ts";
import { writeServerEntry } from "../../node/server-entry.ts";
import type { Caller } from "../../server/permissions.ts";

const SECTIONS = ["dependencies", "devDependencies", "peerDependencies"];

/** Whether the project's `package.json` names `@lightstart/api` in a dependency list. */
const projectHasApi = (projectDir: string): boolean => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
  } catch {
    return false;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const pkg = parsed as Record<string, unknown>;
  for (const section of SECTIONS) {
    const deps = pkg[section];
    if (deps === null || typeof deps !== "object" || Array.isArray(deps)) continue;
    if (Object.prototype.hasOwnProperty.call(deps, "@lightstart/api")) return true;
  }
  return false;
};

const DEV_SECRET = "light-serve-development-secret-not-for-deploys";

/** The project's `.env` as the server's environment in development: `KEY=VALUE` lines, quotes stripped, comments skipped. */
const localEnv = (project: string): Record<string, unknown> => {
  const file = join(project, ".env");
  const env: Record<string, unknown> = {};
  if (!existsSync(file)) return env;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at <= 0) continue;
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[line.slice(0, at).replace(/^export\s+/, "").trim()] = value;
  }
  return env;
};

/** A development-only caller: an `x-light-user` id, with `x-light-admin: 1` making it an admin. */
const devCaller = (request: Request): Caller => {
  const id = request.headers.get("x-light-user");
  if (id === null || id === "") return null;
  return { id, admin: request.headers.get("x-light-admin") === "1" };
};

export default defineExtension("serve", {
  async setup(ctx, _args, api) {
    if (!projectHasApi(ctx.projectDir)) return;
    const file = join(ctx.projectDir, ".data", "api.db");
    try {
      await writeServerEntry(ctx.projectDir);
      const models = await serverModels(ctx.projectDir);
      migrateLocal(file, models);
      const entry = await import(pathToFileURL(join(ctx.projectDir, ".light", "server.ts")).href);
      const createServer = (entry as { createServer?: unknown }).createServer;
      if (typeof createServer !== "function") throw new Error(".light/server.ts exports no createServer");
      const env = localEnv(ctx.projectDir);
      if (env["JWT_SECRET"] === undefined) {
        env["JWT_SECRET"] = DEV_SECRET;
        ctx.log.log("No JWT_SECRET in .env: sessions are signed with a development secret, never one to deploy with");
      }
      const server = (createServer as (options: { db: unknown; env: Record<string, unknown>; caller: (request: Request) => Caller }) => App)({ db: d1Of(Database.open(file)), env, caller: devCaller });
      const mount = new App()
        .all("/api", async (c) => server.dispatch(c))
        .all("/api/*", async (c) => server.dispatch(c));
      api.handle(mount);
    } catch (error) {
      ctx.log.error(`The API server did not start: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
