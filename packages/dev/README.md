# @lightstart/dev

The dev server behind `light serve`: it serves a project's files and routes, strips TypeScript on the way out, resolves bare specifiers through an importmap, injects the app shell, and reloads the page when a watched file changes.

```bash
light serve                  # the working directory
light serve examples/starter --watch
light serve --build          # preview the last build instead
```

| Entry | What it is |
|---|---|
| `@lightstart/dev` | The public entry: port rules, the importmap and its merging, specifier rewriting, the app shell, the request pipeline, and the hook payload types |
| `@lightstart/dev/node` | What needs node: the importmap read from disk, TypeScript stripping through `node:module`, `startServer`, the build preview, the watcher and the reload websockets |

## Options

`light serve [dir] [--port <n>] [--host <addr>] [--watch] [--build]`, alias `s`.

| Option | Default | What |
|---|---|---|
| `dir` | the working directory | The project to serve; a path that is not a folder falls back to the working directory |
| `--port`, `-p` | see below | The first port to try |
| `--host` | `127.0.0.1` | The address to bind; `0.0.0.0` also prints the LAN URLs |
| `--watch`, `-w` | off | Watch the project and reload the page on a change |
| `--build` | off | Preview `.deployed/current` instead of serving sources |

The port is the first that is free, trying the requested port and up to 99 above it (`MAX_PORT_ATTEMPTS`, 100 ports in all) and giving up past them. The one asked for is, in order:

| Source | Where |
|---|---|
| The flag | `--port <n>` |
| The project | `light.dev.port` in its `package.json` |
| The environment | `PORT` |
| The default | `DEFAULT_PORT`, 3000 |

A value that is not a port falls through to the next source; `0` is a port, not a fallback.

## The importmap

The server builds an importmap from the project's `package.json` and from the `package.json` of every package it declares (dependencies, devDependencies, then peerDependencies) that is present under `node_modules`. Each manifest contributes its `.` export as `<name>`, every `./sub` export as `<name>/sub`, and a `./*` export as the `<name>/` prefix. Conditional exports (`default`, `import`, `browser`, `node`, `require`) are read to a file.

A workspace package linked into `node_modules` is served from its real path when that path lies inside the project, so the module has one URL: the one the page's own importmap names.

The map the page already carries is read from its `index.html` and merged on top, so the page's entries win. The merged map is what the shell writes and what the module transform resolves.

## The request pipeline

A request is answered in this order:

1. Every route app, in discovery order; a `pass()` falls through to the next, and a reply ends the request.
2. `/__light/reload.js`, the reload client.
3. A file under the project root. A request for `name.js` also probes `name.ts` and `name.tsx`.
4. The app shell for `/` and for a path with no extension (a route such as `/posts/one`).
5. A 404 for a missing path that has an extension, so a missing asset is not answered with the shell.

Route, reload, file and shell replies carry `cache-control: no-store`.

Files go through a transform that touches only modules (`.js`, `.mjs`, `.ts`, `.tsx`, `.mts`): TypeScript is stripped in place with `node:module`'s `stripTypeScriptTypes`, and bare specifiers are rewritten to the URLs the importmap names. A `.d.ts` is served as it is. Rewriting covers `from "..."`, `export ... from "..."`, a side-effect `import "..."` and `import("...")`; relative paths, URLs and ordinary strings are left alone.

## The shell

The shell is the project's `index.html` with its importmap scripts replaced by one `<script type="importmap">` holding the merged map, in `<head>`. When the server watches, a `<script type="module" src="/__light/reload.js">` is added to `<body>`.

## Routes and websockets

A route file default-exports a factory `(ctx) => App`, where `ctx` holds `projectDir`, `log` and `cli`. The pipeline builds every app once. On a websocket upgrade the route apps get first claim; every socket none of them takes joins the reload set, and the server pings each socket every 30 seconds.

## Hooks

`light serve` dispatches three hooks, declared by adding to `@lightstart/cli`'s `Hooks` through declaration merging:

| Hook | When | Payload |
|---|---|---|
| `serve:before` | Before listening | `{ projectDir, port, watch }` |
| `serve:after` | Once listening; its teardown runs at shutdown | `{ projectDir, port, watch, origins: { local, lan? } }` |
| `serve:file-changed` | On each settled watched change | `{ path, type }`, the project-relative path and `"change"` or `"rename"` |

## Watch and reload

`--watch` runs a recursive `fs.watch` over the project, ignoring `node_modules`, `.git` and `.deployed`, and debounces changes per path for 50 ms. Each settled change is broadcast to the reload clients as `{ "type": "file-changed", "path": "..." }` and dispatched as `serve:file-changed`. The client at `/__light/reload.js` reloads the page on that message and reconnects a second after the socket drops.

## Build preview

With `--build`, the server does not serve sources. It serves `.deployed/current` strictly: files as they were built, no TypeScript, no importmap and no rewriting, a missing asset a 404, and an extensionless path the build's `index.html`. A project with no build there is an error with exit code 1. The preview does not watch.

## What is node-only

`@lightstart/dev/node` reads the disk, uses `node:module` to strip types, `fs.watch` to watch, and `node:http` upgrades to hold the reload websockets; the build preview serves a folder from disk. The pipeline reads the project through `@lightstart/server/static`, and the transform is injected into it, so the importmap, the rewriter and the shell stay plain functions.

A native entry at `packages/dev/native/serve.ts` serves a folder natively without TypeScript, built with:

```bash
node packages/native/cli/bin/light-native.js build @lightstart/dev
```

[`benchmarks/dev/`](../../benchmarks/dev/README.md) measures it against the node server.
