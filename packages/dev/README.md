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
2. Every app an extension added with `handle()`, in the order added; no route or a `pass()` falls through.
3. `/__light/reload.js`, the reload client.
4. A file under the project root, then a file under an extension's extra roots. A request for `name.js` also probes `name.ts` and `name.tsx`.
5. The app shell for `/` and for a path with no extension (a route such as `/posts/one`).
6. A 404 for a missing path that has an extension, so a missing asset is not answered with the shell.

Route, reload, file and shell replies carry `cache-control: no-store`.

Files go through a transform that touches only modules (`.js`, `.mjs`, `.ts`, `.tsx`, `.mts`): TypeScript is stripped in place with `node:module`'s `stripTypeScriptTypes`, and bare specifiers are rewritten to the URLs the importmap names. A `.d.ts` is served as it is. Rewriting covers `from "..."`, `export ... from "..."`, a side-effect `import "..."` and `import("...")`; relative paths, URLs and ordinary strings are left alone.

## The shell

The shell is the project's `index.html` with its importmap scripts replaced by one `<script type="importmap">` holding the merged map, in `<head>`. When the server watches, a `<script type="module" src="/__light/reload.js">` is added to `<body>`.

## Routes and websockets

A route file default-exports a factory `(ctx) => App`, where `ctx` holds `projectDir`, `log` and `cli`. The pipeline builds every app once. On a websocket upgrade the route apps get first claim; every socket none of them takes joins the reload set, and the server pings each socket every 30 seconds.

## Extending light serve

A package extends `light serve` with `cli/extend/serve.ts`, default-exporting
`defineExtension("serve", { args, setup })`. The command builds a `ServeExtension` after it knows the
project, the port and the importmap, and hands it to `setup` with `ctx.cli.extend("serve", api)`
before it listens. Everything an extension does is optional: with no extension the server behaves
as this README describes.

```ts
import { defineExtension } from "@lightstart/cli";
import { Cors } from "@lightstart/server/cors";
import { App, respond } from "@lightstart/server";

export default defineExtension("serve", {
  args: { previewPort: { description: "Also preview the build here" } },
  setup(ctx, args, api) {
    const handler = (request: Request) => new Response("from a Fetch handler");
    api.app.plugin(new Cors({ origins: ["https://app.example"] }));
    api.handle(new App().all("/*", async (c) => respond(await handler(await c.request()))));
    api.root("/vendor-x/", ctx.projectDir + "/vendor");
    api.watch(ctx.projectDir + "/vendor", "vendor-x");
    api.basePath("/docs");
    api.payload.greeting = "hi";
    if (args.previewPort) api.preview(Number(args.previewPort));
  },
});
```

| Member | What |
|---|---|
| `app` | The root `App` every request goes through first: add plugins, middleware and routes to it. The dev pipeline answers what the root app passes on |
| `handle(app)` | An app tried after the project's route files and before its files, in the order added; a path it has no route for, or `pass()`es, falls through. A Fetch handler goes in as an app whose catch-all route answers `respond(await handler(await c.request()))` |
| `root(prefix, dir)` | More files under a URL prefix, served like the project's own: TypeScript stripped, a `.js` request finding its `.ts`, bare specifiers rewritten through the importmap, the same path guard |
| `importmap` | The merged importmap, mutable before listening; an extension may add entries |
| `page(render)` | Replaces how the shell's HTML is produced from the page: `(c, html) => string`. The default injects the importmap and the reload client |
| `pageFile(path)` | Names another file as the page when the project has no `index.html`; a relative path is from the project |
| `watch(dir, label)` | One more folder watched under `--watch`; its changes reach `serve:file-changed` with `path` as `label` and the relative path |
| `basePath(path)` | Answers the app under `path` as well as at the root (the path is stripped before the pipeline); `/path` itself answers the app's root |
| `preview(port)` | Starts the strict build preview over `.deployed/current` on that port beside the dev server, skipped with a warning when the port is taken |
| `projectDir` | The folder being served |
| `defaultPort(port)` | The port to start from when neither `--port`, `light.dev.port` nor `PORT` names one |
| `payload` | The record every serve hook's payload carries, writable during setup |
| `routeContext` | The fields every route file's context carries beside `projectDir`, `log` and `cli`, writable during setup; `RouteContext` is an interface a package widens to type them |

A route app and an app given to `handle` answer with their `waitUntil` work finished: the dev server holds the reply until it is done, so a dev route's writes are complete by the time its caller hears back. One context serves every app a request passes through, so a body one app reads is still there for the next.

A hook payload is an interface another package widens by declaration merging, so an extension's own
fields reach its hooks typed:

```ts
declare module "@lightstart/dev/hooks" {
  interface ServeBeforePayload {
    greeting: string;
  }
}
```

## Hooks

`light serve` dispatches three hooks, declared by adding to `@lightstart/cli`'s `Hooks` through declaration merging:

| Hook | When | Payload |
|---|---|---|
| `serve:before` | Before listening | `{ projectDir, port, watch }` |
| `serve:after` | Once listening; its teardown runs at shutdown | `{ projectDir, port, watch, origins: { local, lan? } }` |
| `serve:file-changed` | On each settled watched change | `{ path, type }`, the project-relative path and `"change"` or `"rename"` |

An extension's fields on `api.payload` are on every serve hook payload, and an extra watched folder's
path is its label and the relative path.

## Watch and reload

`--watch` runs a recursive `fs.watch` over the project and over each extra folder an extension added, ignoring `node_modules`, `.git` and `.deployed`, and debounces changes per path for 50 ms. Each settled change is broadcast to the reload clients as `{ "type": "file-changed", "path": "..." }` and dispatched as `serve:file-changed`. The client at `/__light/reload.js` reloads the page on that message and reconnects a second after the socket drops.

## Build preview

With `--build`, the server does not serve sources. It serves `.deployed/current` strictly: files as they were built, no TypeScript, no importmap and no rewriting, a missing asset a 404, and an extensionless path the build's `index.html`. A project with no build there is an error with exit code 1. The preview does not watch.

An extension may also ask for a preview beside the dev server with `preview(port)`. It starts when the dev server does, serves `.deployed/current` the same strict way, and is skipped with a warning when the port is taken or no build exists.

## What is node-only

`@lightstart/dev/node` reads the disk, uses `node:module` to strip types, `fs.watch` to watch, and `node:http` upgrades to hold the reload websockets; the build preview serves a folder from disk. The pipeline reads the project through `@lightstart/server/static`, and the transform is injected into it, so the importmap, the rewriter and the shell stay plain functions.

A native entry at `packages/dev/native/serve.ts` serves a folder natively without TypeScript, built with:

```bash
node packages/native/cli/bin/light-native.js build @lightstart/dev
```

[`benchmarks/dev/`](../../benchmarks/dev/README.md) measures it against the node server.
