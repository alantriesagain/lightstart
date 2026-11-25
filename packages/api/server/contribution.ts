/**
 * @file What a package adds to an app's server. A package declares it in its
 * `package.json` (`"light": { "server": "./server/contribute.ts" }`), whose
 * module default-exports `defineServerContribution({ models, endpoints,
 * caller })`; the generated `.light/server.ts` merges every declared one into
 * the app's server, and migrations create its tables. `models` is static so a
 * migration reads it without an environment; `endpoints` and `caller` are made
 * from the environment the server runs with.
 */

import type { ModelSchema } from "@lightstart/light/model/types.ts";
import type { DatabaseSource } from "./app.ts";
import type { Endpoint } from "./endpoint.ts";
import type { Caller } from "./permissions.ts";

/** A package's part of an app's server. */
export interface ServerContribution {
  /** Its server models, by table name; the app's own model of the same name wins. */
  models?: Record<string, ModelSchema>;
  /** Its endpoints, made from the server's environment; registered before the app's. */
  endpoints?: (env: Record<string, unknown>) => readonly Endpoint[];
  /** Who makes a request (a session's owner); the first contribution with one answers for the app. */
  caller?: (env: Record<string, unknown>, db: DatabaseSource) => (request: Request) => Caller | Promise<Caller>;
}

/** Declare a package's server contribution. */
export const defineServerContribution = (contribution: ServerContribution): ServerContribution => contribution;
