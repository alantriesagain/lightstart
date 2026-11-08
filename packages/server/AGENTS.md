# Working on @lightstart/server

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `app.ts`, `context.ts`, `reply.ts`, `socket.ts`, `headers.ts`, `router.ts`, `plugin.ts`, `key.ts`, `logger.ts`, `errors.ts`, `incoming.ts` | The core: runtime-neutral, imports nothing outside the package, compiled fully statically by scriptc |
| `node/`, `fetch/`, `lambda/`, `memory/` | The adapters, each a subclass of `Incoming` and a writer of `Reply`. `node/` is node and scriptc native alike, websockets (`node/socket.ts`) included; `lambda/` runs on node's runtime (`Buffer`) |
| `plugins/` | The built-in plugins; `static.ts` reads the disk (`node:fs`), `mime.ts` and the rest are runtime-neutral |
| `test/` | Plain scripts on `@light/test/assert.ts`, run under node and natively, the outputs equal |
| `probes/` | What scriptc refused and what each became (`probes/README.md`), and `backpressure.ts` |
| `scripts/pack.js` | What npm gets: JavaScript with a `.d.ts` per module (`npm run pack`, into `dist/`) |

## Rules the sources keep

scriptc compiles them as program source, so they follow light's native rules (`packages/light/native/probes/README.md`) and the ones `probes/README.md` adds:

- TypeScript with erasable syntax only, no `any`; `unknown` narrowed by `typeof`, `instanceof` on module-level classes, `Array.isArray`.
- Identity lives in classes. A `Map` never holds functions; a function-typed field never shares its name with a method anywhere in the program (`handlerFn`, `notFoundFn`, `deliver`).
- No `async` method overrides another: an abstract method answering a promise is implemented as a plain method (`Incoming.text`, `Writer.write`).
- Never `instanceof` on `Reply | Promise<Reply>`: `await` it.
- No write by a computed string key; empty arrays and maps are typed where they are declared.
- An `upgrade` listener's parameters are typed `(req: IncomingMessage, socket: net.Socket, head: Buffer)`, the shape scriptc lowers (node's types say `Duplex`).
- On `node:http`: `res.write` takes a narrowed chunk and is called as a statement; no `off`, `removeListener`, `drain`, `writableNeedDrain` on a response, nor `destroyed`; `writeHead` takes a `string[]` value, never a literal; a Fetch `Headers` is read with `forEach`; a Promise executor types its reject `(reason: Error) => void`.
- Comments: a JSDoc module header and JSDoc on exported symbols, nothing else (light's comment rule).
- What a request may not use costs it nothing (`PLAN-FEATURES.md`): a `Context` reader (`cookie`, `bearer`, `sameOrigin`, `form`, `accepts`) parses on its first call into a field that starts null, never in the constructor; a `Reply`'s `autoSecure` stays null until a cookie asks for it. A change to the per-request path is measured on `benchmarks/server --workload hello-get --cpu`.
- Workers: the app writes the spawn, with `new Worker(new URL("./worker.ts", import.meta.url))` in its own module; scriptc resolves that URL at build time and refuses one passed into the library (SC2020). The primary (`serveThreads`) never listens; worker settings travel as plain record messages (a class instance loses its methods across threads).
- `Incoming.abort(reason)` stops a request's work (a timeout); an adapter that makes its own `AbortController` makes it on the first `signal()` or `abort()`, never per request.
- A worker-side module must not end in `.test.ts`: the runner takes every `test/*.test.ts` as a test.
- A record field named `host` collides with `Context.host` and makes that property dynamically dispatched (SC6901); the thread messages call it `hostName`. `server.listen({ host })` is refused when the host is typed `string | undefined` (SC2020), so the `reusePort` branch passes a defined host and has a no-host arm.
- `reusePort` needs an explicit port other than 0 and is refused with `path`; it is Linux-only, and `serveThreads` falls back to one worker without it on `ENOTSUP`/`EOPNOTSUPP`.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `app.handle(c)` answers null for a path no route matches, or one its route answered `pass()` to (a 405 when one matches under another method) | `@bootstrapp/serve`, which tries each route file's app in turn, and bootstrapp's endpoints app (`@bootstrapp/cloudflare/pages/endpoints.js`) with its dev route |
| `writeReply(res, reply, method)` and `respond(response)` | `@bootstrapp/serve`, which writes every answer through them, a server module's `Response` included |
| `NodeIncoming`, `WorkTracker` | `@bootstrapp/serve`, which finishes a route's `waitUntil` work before writing its answer |
| `FetchIncoming`, `toResponse` | bootstrapp's `answer()` in Pages Functions |
| `Static.find`, `Static.reply`, its `typeOf` and `precompressed` options | light's `test/serve.js` (TypeScript stripped as it goes out), `benchmarks/serve.js`, and `@bootstrapp/serve`'s deployed-build mirror (the `mime` package's types, the build served as it is) |
| `NodeIncoming.req`/`res` | `@bootstrapp/serve`, whose route requests carry the path with the project's `basePath` stripped, and its deployed-build mirror, which sets the routes' CORS grant on the response |
| `Sockets.answer(app, new UpgradeIncoming(req, socket), head)` answering false for a path no route matches, the connection untouched; `Sockets.take(c, upgrade(c, channel), head)`; `MessageIncoming` as what `NodeIncoming` and `UpgradeIncoming` share | `@bootstrapp/serve`, which tries each route file's app on an upgrade and takes the rest as HMR clients |
| `serve()` resolving a `NodeServer` whose `server` is node's `http.Server` | light's `test/serve.js` and `benchmarks/serve.js` answer that server, and `benchmarks/ab.js` reads it from two trees |
| `fresh(c, etag)`, `mapError`, `setCookie`/`clearCookie` and `c.cookie`, `c.bearer`, `SameOrigin`, `SecurityHeaders` | `@bootstrapp/server`: views and pages answer 304 before running their query, its App maps SQLite constraint errors and registers both plugins, and sign-in writes and reads its cookies through them |
| `serveThreads(options)` resolving a handle with `port`, `threads` and idempotent `close()`, the primary never listening; `serveWorker(app, options?)` reading settings from its options, `workerData` or the primary's `serve` message | apps that put several workers behind one `reusePort` port, and the thread tests |

## Gates

From the repository root:

```bash
node packages/native/cli/bin/light-native.js test @lightstart/server       # node and native, outputs equal (--node-only without a scriptc)
node packages/native/cli/bin/light-native.js coverage @lightstart/server   # every test fully static, no slow path
node packages/native/cli/bin/light-native.js typecheck @lightstart/server
node packages/native/cli/bin/light-native.js check --all
node benchmarks/server/run.js --engines node,native                        # every contender's digest must match; read the ratios
```

`pnpm verify` runs the first four with the workspace packages. A change to an adapter or to `Static` also reaches light's browser tests (`npm test` in `packages/light`, served by `test/serve.js`), widecode's desktop coverage (its backend compiles the desktop asset server), and in bootstrapp `packages/serve/src/request.test.ts`, `packages/p2p` (its relay and signalers' fake servers run on the node adapter) and `packages/cloudflare/pages/endpoints.test.js`.

## Known limits

- Websockets: no `permessage-deflate`, no subprotocol negotiation of its own (a route sets `sec-websocket-protocol` on its `upgrade` reply), and text is not checked for valid UTF-8. The fetch and Lambda adapters answer an `upgrade` with 501.
- Natively a response has no backpressure: scriptc's runtime buffers its writes and never reports a full socket, so a slow client of a large stream holds it in memory. Under node the writer pauses (`node/write.ts`).
- `@lightstart/light` lists the package as an optional peer at `^0.1.0`; a release that breaks it moves both.
