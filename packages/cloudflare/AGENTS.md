# Working on @lightstart/cloudflare

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `defineCloudflare`, `CloudflareConfig` |
| `node/deploy.ts` | `parseEnv`, `projectNameOf`, `buildDirOf`, `planDeploy`, `uploadDirOf`, `wranglerSteps`, `wranglerEntry`, `runDeploy` |
| `node/worker.ts` | `hasServer`, `workerSource`, `bundleWorker`, `stageDeploy` |
| `node/cloudflare-api.ts` | `cloudflareApi`: `get`, `post`, `patch` over an injectable fetch; `CloudflareApiError` carries Cloudflare's message and error codes |
| `node/d1.ts` | `credentialsOf`, `cloudflareConfigOf`, `d1Settings`, `databaseOf`, `ensureDatabase`, `bindDatabase`, `remoteQuery`, `remoteSchema`, `migrateRemote` |
| `node/r2.ts` | `r2Settings`, `bucketOf`, `ensureBucket`, `bindBucket` |
| `node/secrets.ts` | `secretsToPush`, `pushSecrets`, `secretRunner` |
| `cli/commands/cf/deploy.ts` | `light cf:deploy` |
| `cli/commands/cf/d1/setup.ts` | `light cf:d1:setup` |
| `cli/commands/cf/r2/setup.ts` | `light cf:r2:setup` |
| `cli/commands/cf/secrets.ts` | `light cf:secrets` |
| `test/deploy.test.ts` | The plan without the network |
| `test/worker.test.ts` | The server bundle and the staged deploy without the network |
| `test/d1.test.ts` | D1 over a fake fetch |
| `test/r2.test.ts` | R2 over a fake fetch |
| `test/secrets.test.ts` | Secrets over a temp `.env` and a fake wrangler |

## Rules the sources keep

- The project is `src/cloudflare`'s `project`, else the package's name without its scope; a project with both `src/cloudflare.ts` and `.js` is an error naming both.
- Credentials are `CF_ACCOUNT_ID` and `CF_API_TOKEN`, the environment over the project's `.env`; they reach wrangler as `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` and are never logged. A missing one is an error naming both keys and `.env`.
- The build is `.deployed/current` resolved, or `.deployed/builds/<id>`; a folder without `index.html` is no build.
- A deploy is a preview (`--branch preview`) unless `--production` (`--branch main`). The project is created with `--production-branch main`; "already exists" is not an error.
- A project declaring `@lightstart/api` has a server: `planDeploy` sets `server`, `runDeploy` stages `.deployed/staged/<id>` with `_worker.js` and `_routes.json` and uploads that. The build folder is copied, never changed. A project without it uploads the build exactly as before.
- The Worker's entry is `.light/worker.ts` from the generated `.light/server.ts`: `/api` and `/api/*` go through `createServer`, everything else to `env.ASSETS`. The esbuild bundle is one ESM file, and a `node:` import in it is an error.
- wrangler is this package's pinned dependency, run with node from its own entry; `planDeploy` and `wranglerSteps` touch nothing, so tests never reach the network.
- Every Cloudflare call goes through `cloudflareApi`'s injectable fetch and every wrangler run through an injectable runner, so no test reaches the API or wrangler. A secret value or the API token never reaches an argument, a log line or an error message.
- D1's database name is `src/cloudflare`'s `d1`; `light cf:d1:setup` creates it when missing and binds it as `DB` in production and preview. `light db:migrate --remote` plans with `@lightstart/api`'s `planMigration` over `remoteSchema`, and `--dry-run` sends none of the statements.
- R2's bucket name is `src/cloudflare`'s `r2`: lower-case letters, digits and dashes, 3-63 characters, starting and ending with a letter or digit. `light cf:r2:setup` creates it when missing and binds it as `STORAGE` in production and preview; Cloudflare's 10042 (R2 not enabled) is matched by code and becomes the enable-R2 message.
- `src/cloudflare`'s `secrets` names go from `.env` through `wrangler pages secret put`, the value on stdin; a missing name is listed, not fatal.
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module header and JSDoc on exports.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `defineCloudflare({ project })` in `src/cloudflare` | an app's deploy config |
| `light cf:deploy` and its options, `CF_ACCOUNT_ID`/`CF_API_TOKEN` | an app's deploy script |
| `planDeploy`, `wranglerSteps`, `runDeploy` | a release script or another command |
| `hasServer`, `bundleWorker`, `stageDeploy` | the server bundle and the staged deploy |
| `cloudflareApi`, `d1Settings`, `databaseOf`, `migrateRemote`, `remoteSchema` | `light db:migrate --remote` and the D1 command |
| `r2Settings`, `bucketOf`, `ensureBucket`, `bindBucket` | `light cf:r2:setup`, and `@lightstart/moderation`'s `STORAGE` binding |
| `secretsToPush`, `pushSecrets` | `light cf:secrets` |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/cloudflare
light test @lightstart/cloudflare
```
