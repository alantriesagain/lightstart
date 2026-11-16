# Working in this repository

Each package has its own rules where it has an `AGENTS.md` (`packages/server/AGENTS.md`, `packages/components/AGENTS.md`); this file holds what applies to all of them.

## Using light

Start every new project with `light new <kind> <name>`, run from a light checkout. The generator links that checkout because the packages are not on npm yet; `--light <path>` names another checkout, and `--npm` writes published version ranges once they exist.

| Kind | What it gives |
|---|---|
| `web` | A web app on `@lightstart/app`: views, a model, a controller and routes, served by `light serve` |
| `tui` | A terminal app on `@lightstart/app`: a model, a controller and views, compiled by `scriptc` |
| `desktop` | A light page in the desktop shell, with a backend `scriptc` compiles |
| `package` | A light package: modules, tests, a README and the pack script |

The project's own `AGENTS.md` is the reference for its kind: where files go, what each script does, how to test and what the host expects. Read it before changing code.

A web or terminal project is an app on `@lightstart/app`: `src/app.ts` names its host, `src/models/`, `src/controllers/` and `src/views/` hold its pieces, and `src/routes.ts` maps paths to view tags on the web. Light writes the wiring into `.light/`, which is generated and never committed or edited. A view imports its controller, a controller imports its models, and one controller reaches another by name with `sync:`.

The everyday commands are `pnpm dev` (web, tui, desktop), `pnpm build`, `pnpm test` and `pnpm check`. A project's own scripts are the source of truth.

Conventions every kind shares:

- TypeScript with erasable syntax: no `enum`, `namespace`, parameter properties or decorators, so node runs the sources after stripping types and `scriptc` can compile them.
- No `any`. Narrow `unknown` with `typeof`, `instanceof` or `Array.isArray`.
- Run `light check` before committing.
- Test with `light test` in a web app, and with `node --test` (or the project's test script) elsewhere.
- Never hand-write an importmap. `light serve` builds it from `package.json`.
- Light's package READMEs are the reference for an API; every package under `packages/` has one.

To get `light` on PATH from a checkout, link its binary:

```bash
ln -s "$PWD/packages/cli/bin/light.js" ~/.local/bin/light
```

## Packages

A new module is its own scoped package, `@lightstart/<name>` in `packages/<name>/`, as `@lightstart/server`, `@lightstart/sqlite` and `@lightstart/cli` are. Never add a subpath to light for it (`@lightstart/light/<name>`): `@lightstart/light` holds the engine, and what is built on it ships beside it.

## Workflow

A big change reaches `main` through an issue and a pull request on GitHub, so each one is visible and linked to why it was made. A change is big when it adds a package or a module, changes or removes a public API, moves code across packages, needs another repository to follow, or spans more than a few files. A small change (a typo, a doc fix, a fix confined to a file or two with its test) is committed on `main` directly.

1. Open an issue first: what changes and why, and what is left for later.
2. Branch from the latest `origin/main` (`git fetch origin && git switch -c <area>/<name> origin/main`). Commits keep the `<area>: <summary>` form.
3. Open the pull request with `Closes #<issue>` on its first line, an explanation of the implementation, and the gates that were run with their results: pass and fail counts, and any failure that predates the change, named.
4. Before merging, rebase on the latest `main` (`git fetch origin && git rebase origin/main`), rerun the gates the rebase can affect, and push with `git push --force-with-lease`.
5. Merge with "Rebase and merge", the repository's default, and delete the branch. Then reset the local `main` to `origin/main`: a rebase merge rewrites the commits, so a local copy of them no longer matches.
