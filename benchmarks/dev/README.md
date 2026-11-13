# Dev server benchmark

How the dev server in `packages/dev` answers a small app twice: the node server (`node packages/cli/bin/light.js serve benchmarks/dev/fixture`) and the native binary (`packages/dev/dist/light-serve benchmarks/dev/fixture`, built by `node packages/native/cli/bin/light-native.js build @lightstart/dev`).

The fixture is under `fixture/`: an `index.html` with an importmap for `page-lib`, a `package.json` whose `exports` map four bare specifiers to modules, a `main.js` importing all five, a 50 KB `asset.txt`, and a `types.ts` the node server strips. The native binary does not strip TypeScript, so that case is node only.

Each engine serves the same folder on a system-chosen port; the runner reads the URL they print, checks that node and native answer identical bodies for the shell, the module and the asset, then drives each case with a keep-alive client for a fixed time (or request count). Every case gets a warm-up, then the measured run.

```bash
node benchmarks/dev/run.js                      # build, then 10 s per case, 32 connections
node benchmarks/dev/run.js --seconds 30         # a longer run
node benchmarks/dev/run.js --requests 20000     # a request count instead of a time
node benchmarks/dev/run.js --connections 64 --warmup 1000
node benchmarks/dev/run.js --no-build           # reuse packages/dev/dist/light-serve
node benchmarks/dev/run.js --json results.json  # save the results
```

## Results

Linux x86_64, node v25.3.0, scriptc 0.4.12, `/proc/loadavg` 5.06 before the run and 3.83 after, 2026-11-13. 10 s per case, 32 keep-alive connections, 300 warm-up requests per case, one run:

| Case | Engine | req/s | p50 ms | p99 ms | native/node req/s | native/node p50 |
|---|---|---:|---:|---:|---:|---:|
| `/` (shell) | node | 9167 | 3.08 | 8.87 | 1.00 | 1.00 |
| `/` (shell) | native | 15340 | 1.87 | 4.33 | 1.67 | 0.61 |
| `/main.js` (bare imports) | node | 8108 | 3.61 | 8.17 | 1.00 | 1.00 |
| `/main.js` (bare imports) | native | 14971 | 1.89 | 4.29 | 1.85 | 0.52 |
| `/asset.txt` (50 KB) | node | 7824 | 3.39 | 12.01 | 1.00 | 1.00 |
| `/asset.txt` (50 KB) | native | 10458 | 2.53 | 7.43 | 1.34 | 0.75 |
| `/types.ts` (stripped) | node | 5321 | 5.73 | 9.43 | 1.00 | 1.00 |

The native binary is 3.34 MB. A ratio above 1 in requests/s means native answered more requests; a ratio above 1 in p50 means native took longer per request. Read the ratios, not the absolute numbers: on a shared machine the load average moved from 3.8 to 5.1 during another run, and the same node shell case read 16424 req/s in one run and 9167 in the next. The TypeScript case measures node only, and as a reference for what its stripping costs.
