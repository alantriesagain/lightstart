# @lightstart/build

The production build behind `light build`: it reads a page, bundles its module scripts and stylesheets with esbuild through the page's importmap, copies `public/`, rewrites the page to the hashed outputs, and keeps each build in its own folder.

```bash
light build                       # the working directory into .deployed
light build examples/todomvc --no-minify
light build --page app.html --out dist --keep 3
```

`light build [dir] [--page <file>] [--out <dir>] [--no-minify] [--keep <n>]`.

## Options

| Option | Default | What |
|---|---|---|
| `dir` | the working directory | The app folder |
| `--page` | `index.html` | The page to build, relative to the app folder |
| `--out` | `.deployed` | The output folder, relative to the app folder |
| `--no-minify` | minified | Keep the bundles readable |
| `--keep` | `5` | How many builds to keep; at least 1 |

The programmatic `build(options)` takes the same as `BuildOptions`, plus `steps`, extra steps over the build context, and `log`, a `(message) => void` a step may write through. It answers a `BuildReport`: the id, the build folder, the files with their sizes, and the elapsed milliseconds. The command prints each file and the total, and answers exit code 1 on a failed build.

## Steps

A build is a list of named steps over one `BuildContext`:

| Step | What |
|---|---|
| `page` | Read the page and scan its importmap, module scripts and stylesheets |
| `modules` | Bundle the module scripts and put their outputs in the context |
| `stylesheets` | Bundle each linked stylesheet and its assets |
| `public` | Copy `public/` as it is |
| `html` | Write the page with the bundles and stylesheet URLs |
| extra steps | Every `options.steps` entry, in order |
| `write` | Write the outputs, point `current` at the build, prune old builds |

A package adds a step through `options.steps`: `{ name, run(ctx) }`. Extra steps run after the page is rewritten in memory and before anything is written, so they can add files to `ctx.outputs` or change `ctx.moduleOutputs` and `ctx.styleOutputs`.

## Output layout

Every build is written to `<root>/<outDir>/builds/<id>/`. The id is `YYYYMMDD-HHMMSS` from the moment of the build, with `-2`, `-3`, … appended when that id already exists. `<outDir>/current` is a symbolic link to `builds/<id>`, replaced by each new build.

The newest `keep` builds are kept (5 by default, never fewer than one); the rest are removed oldest first. `getBuilds(outDir)` lists the ids newest first, `cleanupOldBuilds(outDir, keep)` prunes, and `updateCurrent(outDir, id)` moves the link.

## What is bundled

The page's module scripts, external and inline, are entries in one esbuild build: the inline ones become virtual entries. The build is ESM with splitting, `es2022`, content-hashed file names, and minification on unless `--no-minify`. Assets reached by a loader (images, icons, fonts) are emitted as hashed files, and each linked stylesheet is bundled with its `@import`s inlined and its `url()` assets emitted.

A bare specifier is resolved through the page's importmap before esbuild sees it: an exact key first, then the longest trailing-slash prefix key, to a path relative to the page. A target that is remote (`//…` or another scheme) is not a local path and is left to esbuild, as is a specifier the map does not name. `@lightstart/build` exports `parseImportMap` and `resolveSpecifier` for that resolver.

## The HTML rewrite

`parsePage` scans a page's importmap script, its module scripts (external and inline) and its stylesheet links, keeping the ranges of each. `renderPage`:

- removes every importmap script;
- replaces each module script with `<script type="module" src="...">` pointing at its hashed bundle, the inline script's code included;
- rewrites each stylesheet link's `href` to its hashed output;
- leaves the rest of the page byte for byte as it was.

`public/` is copied after the bundles are collected, and an output the bundles already wrote is not overwritten.

## Node-only

The build is node-only: it bundles with esbuild, a native node module, and it reads and writes the disk. Its page scanner, importmap resolver, build ids and folder layout are pure functions, but the package as a whole has no browser or native entry.

[`benchmarks/build/`](../../benchmarks/build/README.md) measures it. `node packages/build/test/browser-smoke.ts` builds `examples/todomvc` and checks its rendering in Chromium.
