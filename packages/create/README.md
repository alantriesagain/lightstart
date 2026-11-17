# @lightstart/create

The generator behind `light new`: a project of a named kind, with light's commands, layout and conventions already in place. It copies a kind's template, writes the `package.json`, links light's packages from a checkout, and runs the install. A kind that compiles with scriptc needs scriptc's own install step, which puts its native compiler in place: install scripts stay off for everything else, and the generator runs that one (`pnpm rebuild scriptc --config.ignore-scripts=false`, or npm's) when the compiler does not answer after the install. Node-only, TypeScript with no build step.

```bash
light new                          # list the kinds, one line each
light new web my-app               # a web app on @lightstart/app
light new web my-app --dir sites/my-app
light new package my-package --no-install
```

`light new <kind> <name> [--dir <path>] [--light <path>] [--npm] [--pm pnpm|npm] [--no-install] [--force]`

| Option | Default | What |
|---|---|---|
| `kind` | | `web`, `tui`, `desktop` or `package` |
| `name` | | The package name, and the folder when `--dir` is not given |
| `--dir` | `./<name>` | The folder to write |
| `--light` | the checkout the generator runs from | The light checkout that holds `packages/light` |
| `--npm` | off | Write semver ranges of the packages' current versions instead of linking; the packages may not be published yet, so the install may fail |
| `--pm` | `pnpm`, or `npm` with `--npm` | The package manager |
| `--no-install` | install | Do not run the install |
| `--force` | off | Write into a folder that is not empty |

## Kinds

| Kind | What it starts | Its scripts |
|---|---|---|
| `web` | A web app on `@lightstart/app`: a model, a controller, views and routes | `light serve --watch`, `light build`, `light test`, `light check` |
| `tui` | A terminal app on `@lightstart/app`: a model, a controller and views, compiled by `scriptc` | `light run`, `light test`, `light build`, `light check` |
| `desktop` | A page in light's desktop shell with a native backend | `light desktop run`, `light desktop build`, node's test runner, `light check` |
| `package` | A light package with modules, tests and a README | node's test runner, `tsc`, `light check`, the pack script |

The `web` and `tui` kinds start on [`@lightstart/app`](../app/README.md): the project's `src/app.ts` names the host, its `src/models/`, `src/controllers/` and `src/views/` folders are the app, and light generates the wiring into `.light/`. Their own `AGENTS.md` explains the folders and the scripts.

Sources are TypeScript with erasable syntax, as light's own packages are, so what `scriptc` compiles in one kind reads the same in another. Each kind is a template folder under `templates/` and a module under `kinds/`.

## Where light comes from

Light's packages are not on npm yet. The generator links a checkout: the one it runs from (`packages/create/../..` holding `packages/light`), or the one `--light <path>` names.

| Mode | package.json |
|---|---|
| `link` (pnpm, default) | `"@lightstart/light": "link:/abs/path/packages/light"` |
| `file` (`--pm npm`) | `"@lightstart/light": "file:/abs/path/packages/light"` |
| `npm` (`--npm`) | `"@lightstart/light": "^0.1.0"` |

Every package a linked package depends on from the same checkout is added too, so an outside project can resolve light's workspace dependencies: `@lightstart/components` brings `@lightstart/markdown` and `@lightstart/highlight`, `@lightstart/dev` brings `@lightstart/cli` and `@lightstart/server`.

## Templates

A kind is a folder `templates/<kind>/` plus an entry in `kinds.ts` (its name, description, light packages, scripts and devDependencies). The generator writes `package.json` from the table.

A file is copied with `__NAME__` and `__TITLE__` replaced. A `.tpl` suffix is dropped, so no template's `package.json` or `AGENTS.md` acts as a real one inside this repository.

## Tests

`packages/create/test/*.test.ts` are plain node scripts on `@lightstart/test/assert.ts`; each starts `// node-only`. They cover tokens and `.tpl` names, the kind table, the three install modes and their dependency closure, a non-empty target, and an end-to-end `light new web` with an install, a build and a served page.

```bash
light test @lightstart/create
```
