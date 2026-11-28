# Working on @lightstart/api

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The package's types |
| `server/d1.ts` | `D1Like` and its statement and result shapes |
| `server/permissions.ts` | `readPermissions`, `permissionFor`, `check`, `publicFields`, `Caller`, `Permissions`, `PermissionLevel` |
| `server/crud.ts` | `crudApp`: the `/api/<model>` routes on a `@lightstart/server` `App` |
| `server/endpoint.ts` | `defineEndpoint`, `Endpoint` and its request, access and method shapes |
| `server/app.ts` | `serverApp`: the endpoints first, then `crudApp` |
| `server/contribution.ts` | `defineServerContribution`, `ServerContribution` |
| `node/contributions.ts` | `contributionEntries`, `contributedModels`: the dependencies declaring `light.server` |
| `server/index.ts` | The server entry |
| `page/adapter.ts` | `ApiAdapterType`, the `api` store over fetch, and `configureApi` |
| `node/migrate.ts` | `planMigration` (pure), `existingTables`, `existingIndexes`, `migrateLocal` |
| `node/models.ts` | `serverModelEntries` and `serverModels`: the `adapter: "api"` models discovery |
| `node/server-entry.ts` | `writeServerEntry`: `.light/server.ts` and `endpointFiles` |
| `cli/commands/db/migrate.ts` | `light db:migrate` |
| `cli/extend/serve.ts` | `light serve`: write the entry, migrate, answer `/api/*` |
| `test/` | `server.test.ts` (permissions and routes over `d1Of`), `adapter.test.ts` (requests over a fake fetch), `migrate.test.ts`, `end-to-end.test.ts` (the adapter through `toFetch` into `crudApp`), `endpoint.test.ts` (endpoints through `serverApp`), `server-entry.test.ts` (the generated `.light/server.ts`) |

## Rules the sources keep

- Server code only reaches the database through `D1Like` and awaits every call, so the D1 binding and `d1Of` run it alike. Never import the node driver into `server/`.
- The query string the adapter writes is the one `crudApp` reads; `end-to-end.test.ts` holds both to it. Change them together.
- A schema without `$permissions` is `auth` for every operation; an admin is never row-scoped or capped; an `owner` row outside the caller's scope answers 404, never 403, so its existence is not revealed.
- Names in `where`, `order`, `fields` and a body are checked against the schema's fields before any SQL; values are always bound.
- `planMigration` touches no database; reading a database's columns and indexes is separate, so a deploy package's own migration can feed it.
- An endpoint route is registered before the CRUD fallback, so it wins over a CRUD route of the same method and path; two endpoints of one method and path are refused before the app is built. Access is checked before the body is read.
- `.light/server.ts` imports the server models and `src/endpoints` files sorted, skips tests and `.d.ts`, writes only when its content changes, and is always TypeScript. `light serve` builds it once at startup, so a model or endpoint change needs a restart.
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module header and JSDoc on exports. Tests are plain scripts on `@lightstart/test/assert.ts`.

- A server contribution's `models` stay static (no environment), since migrations read them; `serverModels` merges them before the app's own, the app's winning a name. The generated `createServer` takes the first contributed `caller`, then the one passed, then nobody.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `$permissions` on a schema | an app's server models |
| `crudApp` and its routes, `Caller` | the generated server app, auth, a deploy package |
| `defineEndpoint`, `serverApp` | an app's endpoints and `.light/server.ts` |
| `.light/server.ts` and its `createServer` | `light serve` and the deploy |
| `adapter: "api"`, `configureApi({ token, fetch, prefix })` | an app's page, and auth's token |
| `light.server` in a package's `package.json`, `defineServerContribution` | a package adding tables, endpoints or the caller (`@lightstart/auth`) |
| `planMigration` | `light db:migrate`, and a deploy package's own migration |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/api
light test @lightstart/api
```
