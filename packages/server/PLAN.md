# @lightstart/server: next steps

Four items, from a stale `light/server` draft that redesigned this package. Each was researched before it was planned: probes in `/tmp/plan-a` (native throughput), `/tmp/plan-b` (threads) and `/tmp/plan-c` (contracts), on node v25.3.0 and scriptc 0.4.5, Linux x64.

## 1. Native throughput: profile, then fix

**Status: open.** `--cpu` is in (`3824ecc`) and a `perf` profile is in hand: the extra cost is spread over fiber and promise scheduling, refcounting and allocation, not one function. A paired run on a quiet machine (load about 1.7, three rounds, native): light 16.4 to 17.5 µs/req, raw 13.4 to 15.9. A light response is one `sendmsg`, as raw's is (`strace -c`, 1000 requests on `/health`). Two leads were wrong and are not in: setting the head with `setHeader` natively (built on a misread `strace`, measured no change) and the synchronous path as first built (its `writeReplySync` sent head and body in two `sendto` calls, which hid whatever the removed awaits saved; worth measuring again with that fixed). Later, five per-request changes were re-tested with 7 paired pinned rounds each (`c73bd25`): lazy `Slots` and lower-cased header names kept (about 3% each, together 6 to 9% on hello), the rest no better; but two identical binaries differed by 9% on this machine, so changes this small can no longer be judged here. What is left needs a quiet machine to measure, or a structural change: what each route needs (hooks, middleware, the async hop) decided at `build()`.

Where it stands, measured:

- `benchmarks/server` natively: light 44.6k req/s, raw `node:http` 64.1k (0.70x; the README's run had 0.68x). Under node light is 0.93x of raw.
- A pinned-CPU run on `/health` (one core, 3 × 20k pipelined requests): light spends about 1.5x raw's CPU per request.
- `scriptc coverage` on the light variant: 1111 statements, 100% static, no slow paths. The gap is not a dynamic fallback.
- Five targeted changes, each on a copy of the package, none moved the pinned numbers beyond run-to-run noise: one shared default `Logger` instead of one per `Context`; `Context` slots allocated lazily; reply headers as one flat list; `setHeader` per header instead of `writeHead(status, flat)`; header names not lower-cased.

So guessing is done. Steps:

1. **A CPU benchmark mode** in `benchmarks/server/run.js`: each server pinned to one core, pipelined requests, user+system CPU per request reported beside req/s. Throughput on this machine moves ±20% between rounds; CPU per request on a pinned core is what a change is judged by.
2. **Profile** raw and light natively with `perf record -g` on `/health` and on the full workload, and attribute the difference: our code (`App.handle`, `Context`, `Router.match`, `HeaderList`, `writeReply`) vs runtime work it causes (refcounting, promise and microtask turns, string building). Needs `kernel.perf_event_paranoid` ≤ 1 (now 4; `sudo sysctl kernel.perf_event_paranoid=1`).
3. **Fix the top items** the profile names, each kept only if the CPU mode shows it. The first suspect, not yet measured: a sync handler's reply still goes through a promise and an `await` per request, which raw does not pay.
4. **Budget:** natively ≥ 0.85x raw on the full workload; under node no worse than today's 0.93x. Record the result in `benchmarks/server/README.md`.

## 2. Several cores: `reusePort` and `serveThreads`

Measured on node and natively:

| Mechanism | node | native |
|---|---|---|
| `worker_threads`: `Worker`, `workerData`, messages both ways, `MessagePort` transfer | works | works |
| N threads each `listen({ port, reusePort: true })` on one port | works | works, 100% static |
| a server handle or an accepted socket sent to a worker | `DataCloneError` | only `MessagePort`s transfer |
| `cluster.fork` | works | does not compile (SC0001) |
| `new Worker(url)` with `url` a parameter (spawned inside a library) | works | SC2020: the entry must be static |
| a worker opening `@lightstart/sqlite` (one writer, two read-only readers, WAL) | works | works, 100% static |

Steps:

1. **`reusePort?: boolean`** on `ServeOptions` (`node/index.ts`): `listen({ port, host, reusePort })`. An explicit port is required with it (each `port: 0` listener gets its own port); not with `path`.
2. **`serveThreads(app, { port, host, threads, spawn })`** in `@lightstart/server/node`, and **`serveWorker(app, options)`** for the worker side. The app writes the spawn, because scriptc needs `new Worker(new URL("./worker.ts", import.meta.url))` in its own module:

   ```ts
   await serveThreads({ port: 3000, threads: 4, spawn: () => new Worker(new URL("./worker.ts", import.meta.url)) });
   // worker.ts
   await serveWorker(app, { port: 3000 });
   ```

   The primary does not listen. It waits for every worker's `listening`, broadcasts `close()` over each worker's control port, waits out `grace`, then terminates, and handles the signals. On `ENOTSUP` (macOS, Windows: no kernel-balanced `reusePort`) it serves on one thread and says so.
3. **Per-thread state** is documented: module state, caches and websocket registries are per worker; what must reach every worker goes over a `MessagePort`.
4. **Tests:** node tests for `reusePort` and for `serveThreads` start, spread and close; the `/tmp/plan-b` reuse-port probe as a native test.
5. **Then bootstrapp's SQLite server**, decided after mapping it: every worker thread opens its own writable connection and SQLite takes turns (WAL, `busy_timeout`); no dedicated writer thread. What lives only in one process's memory today moves: the ETag stamps (`backend.counters`, `version`) into a table written in the same transaction as the data, so every thread reads one truth; the written-models notification is broadcast by the thread that committed, so each re-runs its own live subscriptions; the dev sign-in codes into SQLite. Schema, secret and seed run once before the workers start; a session's sliding expiry writes on its thread's connection. Group commit stays per thread. A dedicated writer (cross-thread batching, one ordered change stream, about 600 to 900 lines more) is the step after this if writes ever become the bottleneck; `:memory:` stays single-threaded.

## 3. scriptc contracts: only where they change code

What each does in 0.4.5 (`../scriptc/docs/content/docs/contracts.mdx`, checked on probes):

- `Int32`: checked, and slots become 32-bit integers.
- `Immutable`: checked, and module constants built from literals become immortal (no refcounting).
- `ProgramLifetime`: instances never freed, no refcounting; an executable's own classes only (SC7008 in a library).
- `NoThrow`, `Acyclic`: checks over what scriptc already infers. `NoThrow` on `Router`'s `namesOf` produced identical LLVM.

Steps, measured with item 1's CPU mode and kept only if they show:

1. `@scriptc/types` as a devDependency (types only; `import type` is erased, `scripts/pack.js` drops devDependencies).
2. `Immutable` on the module tables: MIME types, status texts, the 405 and 404 bodies.
3. `Int32` on status codes and lengths in `Reply` and `writeReply`.
4. Not `ProgramLifetime` in the package: an `App` a test builds and drops would never be freed. The README says an app may put it on its own long-lived classes.

## 4. Plugins found at build time: a recipe, no command

`light-native` already runs a member's `native.prepare` steps before build, test, coverage, typecheck and desktop, with `LIGHT_NATIVE_COMMAND` set (`packages/native/cli/src/prepare.js`), and widecode generates its plugin modules that way (`apps/widecode/scripts/builtin-plugins.mjs`). A `Plugin` is constructed with an app's own options, so a generator can list modules but not build them. The README's Plugins section gets the recipe instead of a `light server generate` command:

- `server/plugins/*.ts`, each exporting `plugin: Plugin` (or `createPlugin(): Plugin`);
- a prepare step writes `plugins.generated.ts` with their static imports, only when its text changed (scriptc caches by text);
- the app does `for (const plugin of plugins) app.plugin(plugin)`.

## Order

1 first (biggest gap, and its CPU mode is the yardstick for 3). 2 is independent of 1 and can run beside it. 3 after 1's profile. 4 is a README change, any time.
