# @lightstart/server: what is open

Where the server work stands (2026-11-03), and what is left, so it is picked up rather than re-derived. The detail lives in [PLAN.md](PLAN.md) (speed, several cores, contracts, plugins) and [PLAN-FEATURES.md](PLAN-FEATURES.md) (the features most requests need, and bootstrapp's Cloudflare plane). Bootstrapp's side is in its `BACKLOG.md`.

## Done

- **Several cores:** `serveThreads` and `serveWorker`, each worker on one port with `reusePort` (Linux), under node and natively.
- **Phase A:** `c.cookie`, `c.bearer`, `c.sameOrigin`, `c.form` and `c.accepts`, read on first use; `setCookie` and `clearCookie`, Secure settled for https; `SameOrigin`.
- **Phase B:** `SecurityHeaders`, the automatic 304 for a reply carrying a validator, `fresh(c, etag)` for answering 304 before the work, `mapError`.
- **Phase C:** `validate` on light's field descriptors, `rateLimit`/`RateLimit`, `timeout`, and the `Crypto`/`NodeCrypto` hashing seam with signed cookie values.
- **Phase D, the part that pays now:** `Static`'s `transform`/`transformable`/`transformVersion`, which bootstrapp's dev server uses, and `safeRedirect`.
- **Phase F:** bootstrapp's Cloudflare plane on light, its standalone Worker retired; `Cors` takes `paths`; a handler's own `Response` gains the reply's headers.
- **Measuring:** the `--cpu` mode, the hello workloads, the Express, Fastify and Hono variants (`benchmarks/server`, its own `@light/benchmarks` package), and `benchmarks/server/pair.js` for paired A/B runs.
- **Native:** `@lightstart/light/markup/core` for server-side rendering in a scriptc build. Bootstrapp's SQLite server builds into one binary and serves on several threads.

## Open, each waiting for a need

- **Signed storage URLs.** Presigned PUT and GET to an S3-compatible bucket (R2 included), SigV4 over `Crypto`, for when a project needs uploads; bytes never pass through the app (PLAN-FEATURES.md phase D).
- **Generated validators.** Phase E, only if a profile shows validation costing real time.
- **A plugin list found at build time.** A README recipe (a `native.prepare` step writing the static imports), not a command (PLAN.md item 4).

## Open: speed

- **The native per-request cost.** Light natively spends about 1.2x a hand-written server's CPU on the full workload and 1.38x on hello-get. Changes that save 3% cannot be judged on this machine: two identical binaries differed by 9%. The next step needs a quiet machine, or a structural change: deciding at `build()` what each route needs (hooks, middleware, the async hop). A synchronous handler path measured 2 to 6% and was not kept (PLAN.md item 1).
- **scriptc contracts.** `Immutable` on the module tables and `Int32` on statuses and lengths, kept only if `pair.js` shows them (PLAN.md item 3).
- **Two untyped hot paths** scriptc reports (SC6101) when bootstrapp's server builds: `responseOut`'s header copy in `node/write.ts`, and `Statement.all`'s parsed rows in `packages/sqlite/native.ts`.

## Lessons kept

- **Run the binary.** A native change is checked by running the binary, not only by its tests under node. scriptc checks JSDoc casts and record shapes at run time, so a binary can build and then die at startup (`null` cast to `App`, a `Map` annotation over another object).
- **Measure in pairs.** Judge a speed change with `pair.js`, several rounds and their medians, and with a control run of the same binary twice. One run, or req/s alone, has misled here more than once: a "two sends a response" diagnosis came from a stale binary.
- **What belongs in front.** Proxy work stays in front of the server (README, "What belongs in front of it"): TLS, compression, per-IP floods, slow clients, file bytes.
