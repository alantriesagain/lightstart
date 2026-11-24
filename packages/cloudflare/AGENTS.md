# Working on @lightstart/cloudflare

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `defineCloudflare`, `CloudflareConfig` |
| `node/deploy.ts` | `parseEnv`, `projectNameOf`, `buildDirOf`, `planDeploy`, `wranglerSteps`, `wranglerEntry`, `runDeploy` |
| `cli/commands/cf/deploy.ts` | `light cf:deploy` |
| `test/deploy.test.ts` | The plan without the network |

## Rules the sources keep

- The project is `src/cloudflare`'s `project`, else the package's name without its scope; a project with both `src/cloudflare.ts` and `.js` is an error naming both.
- Credentials are `CF_ACCOUNT_ID` and `CF_API_TOKEN`, the environment over the project's `.env`; they reach wrangler as `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` and are never logged. A missing one is an error naming both keys and `.env`.
- The build is `.deployed/current` resolved, or `.deployed/builds/<id>`; a folder without `index.html` is no build.
- A deploy is a preview (`--branch preview`) unless `--production` (`--branch main`). The project is created with `--production-branch main`; "already exists" is not an error.
- wrangler is this package's pinned dependency, run with node from its own entry; `planDeploy` and `wranglerSteps` touch nothing, so tests never reach the network.
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module header and JSDoc on exports.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `defineCloudflare({ project })` in `src/cloudflare` | an app's deploy config |
| `light cf:deploy` and its options, `CF_ACCOUNT_ID`/`CF_API_TOKEN` | an app's deploy script |
| `planDeploy`, `wranglerSteps`, `runDeploy` | a release script or another command |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/cloudflare
light test @lightstart/cloudflare
```
