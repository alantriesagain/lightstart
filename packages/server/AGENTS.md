# Working on @lightstart/server

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `app.ts`, `context.ts`, `reply.ts`, `headers.ts`, `router.ts`, `plugin.ts`, `key.ts`, `logger.ts`, `errors.ts`, `incoming.ts` | The core: runtime-neutral, imports nothing outside the package, compiled fully statically by scriptc |
| `node/`, `fetch/`, `lambda/`, `memory/` | The adapters, each a subclass of `Incoming` and a writer of `Reply`. `node/` is node and scriptc native alike; `lambda/` is node only (`Buffer`) |
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
- On `node:http`: `res.write` takes a narrowed chunk and is called as a statement; no `off`, `removeListener`, `drain`, `writableNeedDrain` on a response, nor `destroyed`; `writeHead` takes a `string[]` value, never a literal; a Fetch `Headers` is read with `forEach`; a Promise executor types its reject `(reason: Error) => void`.
- Comments: a JSDoc module header and JSDoc on exported symbols, nothing else (light's comment rule).

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `app.handle(c)` answers null for a path no route matches (a 405 when one does under another method) | bootstrapp's endpoints app (`@bootstrapp/cloudflare/pages/endpoints.js`) and its dev route, which fall through on null |
| `writeReply(res, reply, method)` and `respond(response)` | `@bootstrapp/serve`'s `fromFetchResponse`, under every dev route that answers a `Response` |
| `NodeIncoming`, `WorkTracker` | bootstrapp's dev endpoints route, which counts a request's `waitUntil` work itself |
| `FetchIncoming`, `toResponse` | bootstrapp's `answer()` in Pages Functions |
| `Static.find`, `Static.reply` | light's `test/serve.js` (TypeScript stripped as it goes out) and `benchmarks/serve.js` |
| `serve()` resolving a `NodeServer` whose `server` is node's `http.Server` | light's `test/serve.js` and `benchmarks/serve.js` answer that server, and `benchmarks/ab.js` reads it from two trees |

## Gates

From the repository root:

```bash
node packages/native/cli/bin/light-native.js test @lightstart/server       # node and native, outputs equal (--node-only without a scriptc)
node packages/native/cli/bin/light-native.js coverage @lightstart/server   # every test fully static, no slow path
node packages/native/cli/bin/light-native.js typecheck @lightstart/server
node packages/native/cli/bin/light-native.js check --all
node benchmarks/server/run.js --engines node,native                        # every contender's digest must match; read the ratios
```

`pnpm verify` runs the first four with the workspace packages. A change to an adapter or to `Static` also reaches light's browser tests (`npm test` in `packages/light`, served by `test/serve.js`), widecode's desktop coverage (its backend compiles the desktop asset server), and in bootstrapp `packages/serve/src/http.test.ts` and `packages/cloudflare/pages/endpoints.test.js`.

## Known limits

- Natively a response has no backpressure: scriptc's runtime buffers its writes and never reports a full socket, so a slow client of a large stream holds it in memory. Under node the writer pauses (`node/write.ts`).
- `@lightstart/light` lists the package as an optional peer at `^0.1.0`; a release that breaks it moves both.
