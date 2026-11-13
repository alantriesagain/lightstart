# Working on @lightstart/dev

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The public entry: port rules, importmap, rewrite, shell, pipeline and the hook payload types |
| `config.ts` | `DEFAULT_PORT`, `MAX_PORT_ATTEMPTS`, `portOf`, `resolvePort` |
| `importmap.ts` | `packageImports`, `importMapFor`, `declaredPackages`, `mergeImportMaps`, `importmapFromHtml` |
| `rewrite.ts` | `resolveSpecifier`, `rewriteSpecifiers` |
| `shell.ts` | `renderShell`, `RELOAD_CLIENT` |
| `pipeline.ts` | `createPipeline`: the request order, the shell, `.js` to `.ts`/`.tsx` probing |
| `types.ts` | `RouteContext`, `RouteFactory`, `ModuleTransform` |
| `hooks.ts` | `serve:before`, `serve:after` and `serve:file-changed`, added to `Hooks` by declaration merging |
| `node/` | The disk importmap, type stripping, `startServer`, the build preview, the websockets and the watcher |
| `cli/commands/serve.ts` | `light serve`: the flags, then `startServer` |
| `native/serve.ts` | The native entry: serves a folder without TypeScript |
| `test/` | Plain scripts on `@light/test/assert.ts`; `test/fixtures/project` has a package, a page and TypeScript modules |

## Rules the sources keep

- The public entry holds the port rules, the importmap, the rewriter, the shell and the pipeline. The node-specific pieces (the disk importmap, type stripping, the watcher, the upgrades and the build preview) stay in `node/`; the pipeline serves the project through `@lightstart/server/static`, reads its `index.html` with `node:fs`, and takes its transform injected.
- The transform is injected into the pipeline, so the shell, the importmap and the rewriter stay plain functions a caller can test without a server.
- Port precedence is the flag, then `light.dev.port`, then `PORT`, then 3000; a value that is not a port falls through; `0` is a port. The server tries the next port on `EADDRINUSE`, up to `MAX_PORT_ATTEMPTS`.
- The importmap is built from the project and the packages it declares, root first; the page's own map is merged on top and wins. A workspace package linked into `node_modules` is served from its real path when that path is inside the project, so a module has one URL.
- The pipeline order is route apps, the reload client, files, the shell for `/` and extensionless paths, then a 404 for a missing asset. Route, reload, file and shell replies are `no-store`. A `.js` request probes `.ts` and `.tsx`; only modules are transformed and a `.d.ts` is left as it is.
- The watcher ignores `node_modules`, `.git` and `.deployed`, debounces per path for 50 ms, broadcasts to the reload clients and then dispatches `serve:file-changed`.
- Route apps are built once; `pass()` falls through to the next. A websocket upgrade goes to the route apps first, and the rest join the reload set.
- Tests are plain scripts on `@light/test/assert.ts`, not a test framework. A node-only test starts with `// node-only` and is left out of the native and coverage runs.
- Comments are a JSDoc module header and JSDoc on exported symbols, nothing else.
- TypeScript with erasable syntax only; the package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `startServer(ctx, args)` and the `serve` command flags | `light serve`, and the hooks a project contributes under `cli/hooks/` |
| The hook names and payloads (`serve:before`, `serve:after`, `serve:file-changed`) declared on `@lightstart/cli`'s `Hooks` | project hook files, and any package that dispatches or listens to `light serve` |
| `resolvePort`, `DEFAULT_PORT` and `MAX_PORT_ATTEMPTS` | the serve command's port behavior and the build preview |
| `createPipeline`, `renderShell`, `RELOAD_CLIENT`, `buildImportMap` and `createModuleTransform` | `@lightstart/dev/node`, the native entry, and the pipeline tests |
| `.deployed/current` naming the newest build | `--build`, and `@lightstart/build`, whose output this preview serves |
| `/__light/reload.js` and the `file-changed` websocket message | the shell's reload client and the watcher |

## Gates

From the repository root:

```bash
node packages/native/cli/bin/light-native.js test @lightstart/dev       # node and native where the test allows it
node packages/native/cli/bin/light-native.js typecheck @lightstart/dev
node packages/native/cli/bin/light-native.js check --all
npx eslint packages/dev
node benchmarks/dev/run.js                 # node and native, then the ratios (benchmarks/dev/README.md)
```

The native entry (`packages/dev/native/serve.ts`) is built with `node packages/native/cli/bin/light-native.js build @lightstart/dev`.
