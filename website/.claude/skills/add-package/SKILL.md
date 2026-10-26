---
name: add-package
description: Add a @bootstrapp package to the current project and wire it
user_invocable: true
---

<!-- Managed by Bootstrapp: generated from @bootstrapp/generator/skills/add-package.md. Edit the source, then run `bootstrapp types`. -->

# Add a @bootstrapp package

## Steps

1. **Discover** what exists (the catalog is live, never hand-maintained):
   ```bash
   bootstrapp packages:list
   bootstrapp packages:list --json
   ```
2. **Read the chosen package's README** (`packages/<name>/README.md`) for its API and wiring.
3. **Declare the dependency** in the project's `package.json` with `workspace:*`: runtime packages in `dependencies`, tooling in `devDependencies` (a project's devDependencies never reach the shipped app). Declare every framework package it uses transitively too (`node-linker=isolated` does not propagate workspace links): mirror the package's own `dependencies`, and one of its `peerDependencies` when the project uses that feature.
4. **`pnpm install`** from the repo root, then `bootstrapp types` and restart `bootstrapp serve`. The package's skills, if it ships any, appear under `.claude/skills/`.
5. **Wire it** if the README says so. Most packages integrate through their `bootstrapp.*` keys (`autoload`, `components`, `schema`, `sw`), visible in the `packages:list` contributes column.

## Wiring that metadata cannot express

- `@bootstrapp/i18n`: `/add-i18n`.
- `@bootstrapp/theme`: `/restyle-theme`.
- Database adapters (`@bootstrapp/model-file`, `@bootstrapp/cloudflare`): register the adapter in `backend.js` and set `$adapter` per model; `packages/cloudflare/README.md`.
- Icons reached through computed names go in `bootstrapp.bundle.icons` or the component's `icons: [...]`.

## Rules

- `workspace:*` always, never `file:` paths (`check/workspace-protocol`).
- `check/undeclared-bootstrapp-deps` and `check/dependency-classes` verify the declaration; `bootstrapp check` after editing `package.json`.
- Reference: `examples/centavo/package.json`.
