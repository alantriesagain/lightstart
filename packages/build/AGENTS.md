# Working on @lightstart/build

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The public entry: `build`, the bundlers, the page scanner and rewriter, the importmap resolver, the build ids and the folder layout |
| `build.ts` | `build(options)`: the step list, the in-memory outputs and the write |
| `bundle.ts` | `bundleModules`, `bundleStyles`: the esbuild build, the importmap plugin, the loaders |
| `html.ts` | `parsePage`, `renderPage`: the ranges of the importmap, module scripts and stylesheet links |
| `importmap.ts` | `parseImportMap`, `resolveSpecifier`: exact keys, then the longest trailing-slash prefix |
| `build-id.ts` | `generateBuildId`: `YYYYMMDD-HHMMSS` |
| `versioning.ts` | `getBuilds`, `cleanupOldBuilds`, `updateCurrent` |
| `types.ts` | `BuildOptions`, `BuildContext`, `BuildStep`, `BuildReport`, `BuildFile`, `BuildLog` |
| `cli/commands/build.ts` | `light build`: the flags, then `build` |
| `test/` | Plain scripts on `@light/test/assert.ts`; `test/fixtures/app` and the repository examples |

## Rules the sources keep

- The step order is page, modules, stylesheets, public, html, every `options.steps` entry, then write. An extra step runs before anything is written, so it can add outputs or change the module and style URLs.
- Outputs live in `ctx.outputs` until the `write` step. Nothing writes to the build folder before it.
- Every build is `<root>/<outDir>/builds/<id>/`; `<outDir>/current` is a symlink to `builds/<id>` and is replaced each time. An id that already exists takes a `-2`, `-3`, … suffix.
- `keep` is at least 1 and 5 when it is not a finite number; pruning removes the oldest builds first, never `current`.
- The page's importmap is the only resolver: an exact key, then the longest trailing-slash prefix, to a path relative to the page. A remote target is not a local path. A specifier the map does not name is left to esbuild.
- The HTML rewrite removes the importmap, points each module script at its bundle and each stylesheet link at its output, and leaves the rest of the page unchanged.
- The package is node-only: esbuild is a native node module and the build reads and writes the disk. The scanner, resolver, id and versioning helpers stay pure.
- Tests are plain scripts on `@light/test/assert.ts`; a node-only test starts with `// node-only`.
- Comments are a JSDoc module header and JSDoc on exported symbols, nothing else.
- TypeScript with erasable syntax only; the package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `build(options)` answering `{ id, dir, files, ms }` with `dir` at `<outDir>/builds/<id>` | the `light build` command and the build tests |
| `<outDir>/builds/<id>/` and `<outDir>/current` pointing at it | `@lightstart/dev`'s `--build` preview, which serves `.deployed/current` |
| `parsePage` and `renderPage` keeping every range outside the importmap, module scripts and stylesheet links | the build tests, and any step that rewrites the page |
| `parseImportMap` and `resolveSpecifier` | the esbuild importmap plugin, and pages whose entries name local files |
| `options.steps` as `{ name, run(ctx) }` inserted before `write` | packages that add outputs to a build |
| The `light build` flags (`dir`, `--page`, `--out`, `--no-minify`, `--keep`) | `light build` users and the examples test |

## Gates

From the repository root:

```bash
node packages/native/cli/bin/light-native.js test @lightstart/build       # node and native where the test allows it
node packages/native/cli/bin/light-native.js typecheck @lightstart/build
node packages/native/cli/bin/light-native.js check --all
npx eslint packages/build
node benchmarks/build/run.js               # then the ratios (benchmarks/build/README.md)
node packages/build/test/browser-smoke.ts  # builds examples/todomvc and checks it in Chromium
```

`test/examples.test.ts` builds `examples/todomvc` and `examples/starter`; a change to the bundler or the page scanner must keep both building.
