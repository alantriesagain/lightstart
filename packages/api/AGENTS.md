# Working on @lightstart/api

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The package's types |
| `server/d1.ts` | `D1Like` and its statement and result shapes |
| `server/permissions.ts` | `readPermissions`, `permissionFor`, `check`, `publicFields`, `Caller`, `Permissions`, `PermissionLevel` |
| `server/crud.ts` | `crudApp`: the `/api/<model>` routes on a `@lightstart/server` `App` |
| `server/index.ts` | The server entry |
| `page/adapter.ts` | `ApiAdapterType`, the `api` store over fetch, and `configureApi` |
| `node/migrate.ts` | `planMigration` (pure), `existingTables`, `existingIndexes`, `migrateLocal` |
| `cli/commands/db/migrate.ts` | `light db:migrate` |
| `test/` | `server.test.ts` (permissions and routes over `d1Of`), `adapter.test.ts` (requests over a fake fetch), `migrate.test.ts`, `end-to-end.test.ts` (the adapter through `toFetch` into `crudApp`) |

## Rules the sources keep

- Server code only reaches the database through `D1Like` and awaits every call, so the D1 binding and `d1Of` run it alike. Never import the node driver into `server/`.
- The query string the adapter writes is the one `crudApp` reads; `end-to-end.test.ts` holds both to it. Change them together.
- A schema without `$permissions` is `auth` for every operation; an admin is never row-scoped or capped; an `owner` row outside the caller's scope answers 404, never 403, so its existence is not revealed.
- Names in `where`, `order`, `fields` and a body are checked against the schema's fields before any SQL; values are always bound.
- `planMigration` touches no database; reading a database's columns and indexes is separate, so a remote run can feed it.
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module header and JSDoc on exports. Tests are plain scripts on `@lightstart/test/assert.ts`.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `$permissions` on a schema | an app's server models |
| `crudApp` and its routes, `Caller` | the generated server app, auth, the Cloudflare deploy |
| `adapter: "api"`, `configureApi({ token, fetch, prefix })` | an app's page, and auth's token |
| `planMigration` | `light db:migrate` and a remote migration |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/api
light test @lightstart/api
```
