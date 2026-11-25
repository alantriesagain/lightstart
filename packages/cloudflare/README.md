# @lightstart/cloudflare

Deploys a light app to [Cloudflare Pages](https://pages.cloudflare.com). `light build` writes the whole static site (`.deployed/current`: the pages, `404.html`, `_headers`, `robots.txt`, the sitemap); `light cf:deploy` uploads it.

```bash
pnpm add @lightstart/cloudflare
light build
light cf:deploy              # a preview deploy
light cf:deploy --production # the production branch, the site's domains
```

## The project

The Pages project is the package's name (its npm scope left out). An app that deploys elsewhere names it in `src/cloudflare.js` (or `.ts`), along with its D1 database and the secrets to push:

```js
import { defineCloudflare } from "@lightstart/cloudflare";

export default defineCloudflare({
  project: "my-site",
  d1: "my-site-db",
  secrets: ["JWT_SECRET", "RESEND_API_KEY", "AUTH_FROM_EMAIL"],
});
```

The first deploy creates the project when the account does not have it, with `main` as its production branch. A custom domain is attached in Cloudflare's dashboard once; every production deploy then serves it.

## Credentials

`CF_ACCOUNT_ID` and `CF_API_TOKEN` (a token allowed to edit Cloudflare Pages), from the environment or the project's `.env`; the environment wins. Keep `.env` out of git. The command hands them to wrangler as `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` and never prints them.

## `light cf:deploy`

| Option | What |
|---|---|
| `--production` | Deploy to the `main` branch; a preview branch (`preview`) otherwise |
| `--build <id>` | Upload `.deployed/builds/<id>` instead of `.deployed/current` |
| `--dry-run` | Print the project, the build and the wrangler steps, and upload nothing |

It refuses with no build (run `light build`) or no credentials, naming what is missing. It runs the wrangler this package pins (`wrangler pages project create`, then `wrangler pages deploy`), never one `npx` resolves. `--dry-run` also says whether the app's server is bundled.

## The app's server

An app that declares `@lightstart/api` has a server in `.light/server.ts`. `light cf:deploy` bundles it with esbuild into a Pages Worker:

- `<project>/.light/worker.ts` answers `/api` and `/api/*` through `toFetch(createServer({ db: () => env.DB, env }))`, built once per isolate, and hands every other request to `env.ASSETS`. Who makes a request comes from the packages the server merges: with `@lightstart/auth` declared, its session; without one, nobody.
- The bundle is one ESM file with no `node:` import: a Node built-in reaching the server is an error naming it.
- The build is copied to `.deployed/staged/<build id>/`, with the bundle written as `_worker.js` and `_routes.json` as `{ "version": 1, "include": ["/api/*"], "exclude": [] }`. That staged folder is what wrangler uploads, so the build folder itself is never changed.
- An app without `@lightstart/api` deploys exactly as before, uploading the build itself.

## D1

`defineCloudflare({ d1: "<database name>" })` names the database. `light cf:d1:setup` creates it when the account does not have it, and binds it to the Pages project as `DB` (production and preview) through Cloudflare's API. It prints the database name and uuid, never a credential.

`light db:migrate --remote` reads the remote tables' columns and index names over D1's HTTP API and runs `@lightstart/api`'s `planMigration`; `--dry-run` prints the plan and runs nothing. It needs `@lightstart/cloudflare` in the project, and the database set up first.

## Secrets

`defineCloudflare({ secrets: [...] })` names them. `light cf:secrets` puts each from the project's `.env` onto the Pages project with `wrangler pages secret put`, the value on stdin, never printed or passed on the command line, and lists any name `.env` lacks. `--dry-run` lists the names and puts nothing.

## Node API

`node/deploy.ts`: `planDeploy(project, { build, production, environment })` reads what a deploy needs and answers a `DeployPlan` (`server` says whether `@lightstart/api` is declared); `wranglerSteps(plan)` the wrangler arguments; `uploadDirOf(plan)` the folder uploaded (the build, or its staged copy); `runDeploy(plan, cwd, log)` stages the server and runs them; `parseEnv`, `projectNameOf`, `buildDirOf`, `wranglerEntry`.

`node/worker.ts`: `hasServer(project)`; `workerSource(project)` writes `.light/worker.ts`; `bundleWorker(project, outFile)` bundles it; `stageDeploy(buildDir, project)` copies the build and adds the Worker.

`node/cloudflare-api.ts`: `cloudflareApi({ accountId, apiToken, fetch? })`, whose `get`, `post` and `patch` answer a response's `result` or throw Cloudflare's error messages.

`node/d1.ts`: `credentialsOf`, `cloudflareConfigOf`, `d1Settings`, `databaseOf`, `ensureDatabase`, `bindDatabase`, `remoteQuery`, `remoteSchema`, `migrateRemote`.

`node/secrets.ts`: `secretsToPush(project)`, `pushSecrets(plan, runner)`, `secretRunner(env)`.

## Not yet

A D1 store adapter (`adapter: "d1"`).
