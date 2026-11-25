/**
 * @file `serverApp` answers one `@lightstart/server` `App` for an app: its
 * endpoints first, then the `/api/<model>` CRUD routes of its server models.
 * An endpoint's method and path win over a CRUD route, and two endpoints with
 * the same method and path are refused before the app is built.
 */

import { App, fail, json, respond, text, type Context, type Reply } from "@lightstart/server";

import { crudApp } from "./crud.ts";
import { bodyOfRequest, parameterNames, type Endpoint } from "./endpoint.ts";

import type { Caller } from "./permissions.ts";
import type { D1Like } from "./d1.ts";
import type { ModelSchema } from "@lightstart/light/model/types.ts";

/** A database, or how to open it on first use. */
export type DatabaseSource = D1Like | (() => D1Like | Promise<D1Like>);

/** How `serverApp` is built. */
export interface ServerOptions {
  /** The server models, by table name. */
  models: Record<string, ModelSchema>;
  /** The app's own endpoints, registered before the CRUD routes. */
  endpoints: readonly Endpoint[];
  /** The database the endpoints and the CRUD routes share. */
  db: DatabaseSource;
  /** Who makes a request, from the request itself. */
  caller: (request: Request) => Caller | Promise<Caller>;
  /** The environment an endpoint reads. */
  env?: Record<string, unknown>;
  /** The CRUD prefix, `/api` by default. */
  prefix?: string;
  /** The most rows a non-admin list answers, 100 by default. */
  maxLimit?: number;
}

const resolveDatabase = async (source: DatabaseSource): Promise<D1Like> => (typeof source === "function" ? await source() : source);

const denial = (caller: Caller, access: Endpoint["access"]): Reply | null => {
  if (access === "public") return null;
  if (caller === null) return fail("authentication required", 401);
  if (access === "admin" && caller.admin !== true) return fail("forbidden", 403);
  return null;
};

const answerOf = (value: unknown): Reply => {
  if (value instanceof Response) return respond(value);
  if (typeof value === "string") return text(value);
  return json(value);
};

const queryOf = (request: Request): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [name, value] of new URL(request.url).searchParams) out[name] = value;
  return out;
};

/** One app for the endpoints and the models, with an endpoint winning over a CRUD route of the same method and path. */
export const serverApp = (options: ServerOptions): App => {
  const seen = new Map<string, Endpoint>();
  for (const endpoint of options.endpoints) {
    const key = endpoint.method + " " + endpoint.path;
    const first = seen.get(key);
    if (first !== undefined) throw new Error(`two endpoints answer ${key}: the first is ${first.path} and another is ${endpoint.path}`);
    seen.set(key, endpoint);
  }

  const app = new App();
  for (const endpoint of options.endpoints) {
    const names = parameterNames(endpoint.path);
    app.on(endpoint.method, endpoint.path, async (c: Context): Promise<Reply> => {
      const request = await c.request();
      const caller = await options.caller(request);
      const refused = denial(caller, endpoint.access);
      if (refused !== null) return refused;
      const params: Record<string, string> = {};
      for (const name of names) params[name] = c.param(name) ?? "";
      const value = await endpoint.handler({
        request,
        params,
        query: queryOf(request),
        body: await bodyOfRequest(request, endpoint.method),
        caller,
        db: await resolveDatabase(options.db),
        env: options.env ?? {},
      });
      return answerOf(value);
    });
  }

  const crud = crudApp({
    models: options.models,
    db: () => resolveDatabase(options.db),
    caller: options.caller,
    ...(options.prefix === undefined ? {} : { prefix: options.prefix }),
    ...(options.maxLimit === undefined ? {} : { maxLimit: options.maxLimit }),
  });

  app.all("/*", async (c: Context): Promise<Reply> => (await crud.handle(c)) ?? fail("not found", 404));

  return app;
};
