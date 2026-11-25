# @lightstart/api

An app's server models. A model whose store uses the `api` adapter lives in a database behind `/api/<model>`; the page reads and writes it through light's model layer as it would any store, and the server checks each schema's `$permissions`.

The server targets a D1-shaped database (`prepare().bind().all()/first()/run()`, `batch`): Cloudflare's D1 binding in production, and `@lightstart/sqlite`'s `d1Of` over a local file in development, so both run the same code.

This is the data layer of an app backend. `defineEndpoint`, the generated server app, auth and the Cloudflare deploy come next.

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

A schema without `$permissions` is `auth` for every operation, and a missing key is `auth`. An `owner` list is scoped to the caller's rows, another caller's row answers 404, and `create` stamps `ownerField` with the caller's id. `public: ["id", "title"]` is what an anonymous reader of a `public` model sees. An admin caller passes everything, unscoped and uncapped.

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

## The page

The `api` adapter type is declared in `package.json` (`light.adapters`), so a store naming `adapter: "api"` gets it from the generation. `configureApi({ token, fetch, prefix })` from `@lightstart/api/page` sets the bearer-token provider (each request sends `Authorization: Bearer <token>` when it answers one), a fetch for tests, and a path prefix. A failed request throws an `Error` carrying the status and the server's message.

## Migrations

`light db:migrate` brings `.data/api.db` (or `--file`) to the server models: the models in `src/models/` whose `$store` names a store with `adapter: "api"`. It creates missing tables, adds missing columns, creates missing indexes, and prints each statement; `--dry-run` prints the plan only.

From `@lightstart/api/node/migrate.ts`:
- `planMigration(columns, models, indexes)` is pure, so a remote run reuses it;
- `migrateLocal(file, models)`, `existingTables(file, models)` and `existingIndexes(file)` work on a local file.

## Not yet

Server policies (hooks before and after a write), batch writes, endpoints, auth, and the remote migration and deploy.
