# Working in this repository

Each package has its own rules where it has an `AGENTS.md` (`packages/server/AGENTS.md`, `packages/components/AGENTS.md`); this file holds what applies to all of them.

## Packages

A new module is its own scoped package, `@lightstart/<name>` in `packages/<name>/`, as `@lightstart/server` and `@lightstart/sqlite` are. Never add a subpath to light for it (`@lightstart/light/<name>`): `@lightstart/light` holds the engine, and what is built on it ships beside it.

## Workflow

A big change reaches `main` through an issue and a pull request on GitHub, so each one is visible and linked to why it was made. A change is big when it adds a package or a module, changes or removes a public API, moves code across packages, needs another repository (bootstrapp, widecode) to follow, or spans more than a few files. A small change (a typo, a doc fix, a fix confined to a file or two with its test) is committed on `main` directly.

1. Open an issue first: what changes and why, and what is left for later.
2. Branch from the latest `origin/main` (`git fetch origin && git switch -c <area>/<name> origin/main`). Commits keep the `<area>: <summary>` form.
3. Open the pull request with `Closes #<issue>` on its first line, an explanation of the implementation, and the gates that were run with their results: pass and fail counts, and any failure that predates the change, named.
4. Before merging, rebase on the latest `main` (`git fetch origin && git rebase origin/main`), rerun the gates the rebase can affect, and push with `git push --force-with-lease`.
5. Merge with "Rebase and merge", the repository's default, and delete the branch. Then reset the local `main` to `origin/main`: a rebase merge rewrites the commits, so a local copy of them no longer matches.
