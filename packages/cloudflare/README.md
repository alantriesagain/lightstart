# @lightstart/cloudflare

Deploys a light app to [Cloudflare Pages](https://pages.cloudflare.com). `light build` writes the whole static site (`.deployed/current`: the pages, `404.html`, `_headers`, `robots.txt`, the sitemap); `light cf:deploy` uploads it.

```bash
pnpm add @lightstart/cloudflare
light build
light cf:deploy              # a preview deploy
light cf:deploy --production # the production branch, the site's domains
```

## The project

The Pages project is the package's name (its npm scope left out). An app that deploys elsewhere names it in `src/cloudflare.js` (or `.ts`):

```js
import { defineCloudflare } from "@lightstart/cloudflare";

export default defineCloudflare({ project: "my-site" });
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

It refuses with no build (run `light build`) or no credentials, naming what is missing. It runs the wrangler this package pins (`wrangler pages project create`, then `wrangler pages deploy`), never one `npx` resolves.

## Node API

`node/deploy.ts`: `planDeploy(project, { build, production, environment })` reads what a deploy needs and answers a `DeployPlan`; `wranglerSteps(plan)` the wrangler arguments; `runDeploy(plan, cwd, log)` runs them; `parseEnv`, `projectNameOf`, `buildDirOf`, `wranglerEntry`.

## Not yet

A backend: Pages Functions from a `@lightstart/server` app, a D1 store adapter and its migrations.
