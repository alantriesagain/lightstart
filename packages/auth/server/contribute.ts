/**
 * @file What `@lightstart/auth` adds to an app's server, declared in its
 * `package.json` (`light.server`): the `users` and `auth_codes` tables, the
 * `/api/auth/*` endpoints with the mailer the environment names, and the
 * caller every request is checked as, read from its session.
 */

import { defineServerContribution } from "@lightstart/api/server";
import { callerFromRequest } from "./caller.ts";
import { mailerFrom } from "./mailer.ts";
import { authModels } from "./models.ts";
import { authEndpoints } from "./routes.ts";

export default defineServerContribution({
  models: authModels,
  endpoints: (env) => authEndpoints({ mailer: mailerFrom(env, (line) => console.log(line)) }),
  caller: (env, db) => callerFromRequest(env, typeof db === "function" ? db : () => db),
});
