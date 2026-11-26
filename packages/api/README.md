# @lightstart/api

An app's server models. A model whose store uses the `api` adapter lives in a database behind `/api/<model>`; the page reads and writes it through light's model layer as it would any store, and the server checks each schema's `$permissions`.

The server targets a D1-shaped database (`prepare().bind().all()/first()/run()`, `batch`): Cloudflare's D1 binding in production, and `@lightstart/sqlite`'s `d1Of` over a local file in development, so both run the same code.

This is the data layer of an app backend, with endpoints beside the model CRUD. Auth and the Cloudflare deploy come next.

## A server model

```js
// src/app.js
export default defineApp({ name: "meetup", host: "web", stores: { server: { adapter: "api" } } });

// src/models/rsvp.js
export default defineModel("rsvp", {
  meetup: T.string({ required: true }),
  user: T.string(),
  $store: "server",
  $permissions: { read: "owner", create: "owner", write: "owner", delete: "owner", ownerField: "user" },
});
```

## Permissions

`$permissions` holds a level for each of `read`, `create`, `write` and `delete`:

| Level | Who |
|---|---|
| `public` | anyone, signed in or not |
| `auth` | any signed-in caller |
| `owner` | a signed-in caller, only on rows whose `ownerField` is theirs |
| `none` | nobody but an admin |

A schema without `$permissions` is `auth` for every operation, and a missing key is `auth`. An `owner` list is scoped to the caller's rows, another caller's row answers 404, and `create` stamps `ownerField` with the caller's id. An anonymous reader of a `public` model sees every field, or only those `public: ["id", "title"]` names. An admin caller passes everything, unscoped and uncapped.

## The routes

`crudApp({ models, db, caller, prefix = "/api", maxLimit = 100 })` from `@lightstart/api/server` answers a `@lightstart/server` `App`:

| Request | Answers |
|---|---|
| `GET /api/<model>?where&order&fields&limit&offset&total=1` | `{ rows, total? }` |
| `GET /api/<model>/count?where` | `{ count }` |
| `GET /api/<model>/<id>` | the row |
| `POST /api/<model>` | the created row, 201 |
| `PATCH /api/<model>/<id>` | the updated row |
| `DELETE /api/<model>/<id>` | `{ deleted: true }` |

`where` is URL-encoded JSON. `order` is a comma list (`-created,title`), a JSON string, or a JSON array of names or `{ field, direction }`. `fields` is a comma list or a JSON array.

A name that isn't a column is a 400 naming it. A denied call is 401 without a caller and 403 with one. An unknown model, or a row outside the caller's scope, is 404. `limit` is capped at `maxLimit` except for an admin. `caller(request)` resolves who is asking; auth plugs in there.

## Endpoints

An app's own routes live in `src/endpoints/<name>.js` (or `.ts`), each default-exporting `defineEndpoint`:

```js
// src/endpoints/accept.js
import { defineEndpoint } from "@lightstart/api/server";

export default defineEndpoint({
  path: "/api/meetups/:id/accept",
  method: "POST",
  access: "auth",
  handler: async ({ params, caller, db }) => {
    const id = params.id;
    await db.prepare("INSERT INTO rsvp (meetup, user) VALUES (?, ?)").bind(id, caller.id).run();
    return { accepted: true };
  },
});
```

`method` is `GET` by default and `access` is `auth`. A `public` endpoint answers anyone, an `auth` one answers 401 without a caller, and an `admin` one answers 401 without a caller and 403 for a caller who is not an admin.

The handler is handed `{ request, params, query, body, rawBody, caller, db, env }`: the Fetch `Request`, the path's parameters by name (`/api/meetups/:id/accept` gives `params.id`), the query as a plain `Record<string, string>`, the JSON body of a non-GET request with a JSON content type (else `null`), that body exactly as it arrived as text (`rawBody`, what a webhook's signature is checked against; never re-serialize `body` for that), the resolved caller, the `D1Like` database, and the server's environment. It answers a `Response` (passed through, keeping its status), a string (as `text/plain`), or any other value (as JSON). A thrown `HttpError` keeps its status.

## The app's server

`serverApp({ models, endpoints, db, caller, env = {}, prefix = "/api", maxLimit = 100 })` from `@lightstart/api/server` answers one `@lightstart/server` `App`: every endpoint first, then `crudApp` for the models. An endpoint's method and path win over a CRUD route; two endpoints with the same method and path are refused, naming the pair.

`@lightstart/api` writes the app's `.light/server.ts` for `light serve` and the deploy. It imports each dependency's server contribution, each server model and each `src/endpoints/*.{ts,js}` default export. It exports `models`, `endpoints` and `createServer({ db, env, caller? })`, which builds `serverApp` from the contributions and the app's own pieces.

The entry is always TypeScript, and is written only when its content changes. With the package declared, `light serve`:
- writes the entry;
- migrates `.data/api.db` to the server models, contributed tables included;
- reads the project's `.env` as the server's environment, signing with a development-only `JWT_SECRET` when it has none and saying so;
- answers `/api/*` from `createServer` over `d1Of`.

Without a contributed caller, the caller comes from the development-only headers `x-light-user: <id>` and `x-light-admin: 1`. The entry is built when the server starts, so restart `light serve` after changing a server model or an endpoint.

## A package's part of the server

A package adds to every app's server that declares it by naming a module in its `package.json`, `"light": { "server": "./server/contribute.ts" }`. That module default-exports `defineServerContribution({ models, endpoints, caller })`:

- `models` are server models by table name. They're static, so `light db:migrate` (local and `--remote`) creates their tables, and the app's own model of the same name wins.
- `endpoints(env, models)` answers endpoints made from the server's environment and every server model the app's server holds (the app's and the contributed), registered before the app's. A package that acts on models an app marks (moderation's `$moderated`) reads them here.
- `caller(env, db)`, the first one any contribution brings, answers who makes each request, for every endpoint and `$permissions` check.

Contributions merge in package-name order. `@lightstart/auth` is one: its `users` and `auth_codes` tables, `/api/auth/*`, and the session as the caller, with nothing for the app to wire.

## The page

The `api` adapter type is declared in `package.json` (`light.adapters`), so a store naming `adapter: "api"` gets it from the generation. `configureApi({ token, fetch, prefix })` from `@lightstart/api/page` sets the bearer-token provider (each request sends `Authorization: Bearer <token>` when it answers one), a fetch for tests, and a path prefix. A failed request throws an `Error` carrying the status and the server's message.

## Migrations

`light db:migrate` brings `.data/api.db` (or `--file`) to the server models: the models in `src/models/` whose `$store` names a store with `adapter: "api"`. It creates missing tables, adds missing columns, creates missing indexes, and prints each statement; `--dry-run` prints the plan only.

From `@lightstart/api/node/migrate.ts`:
- `planMigration(columns, models, indexes)` is pure, so a remote run reuses it;
- `migrateLocal(file, models)`, `existingTables(file, models)` and `existingIndexes(file)` work on a local file.

## Not yet

Server policies (hooks before and after a write), batch writes, auth, and the remote migration and deploy.
