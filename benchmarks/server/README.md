# Server benchmark

scriptc's `http-api` workload (a JSON API with routing, query parsing, a seeded catalog, per-cart state, JSON bodies, ETags and request ids), written three ways and driven by scriptc's own load client (`load.mjs`: keep-alive HTTP/1.1, 64 connections, one request in flight per connection, a seeded request sequence):

| Variant | What it is |
|---|---|
| `variants/raw.ts` | The workload as scriptc ships it, on bare `node:http` |
| `variants/bridge.ts` | The same API as a Fetch handler, `(Request) => Promise<Response>`, behind the node-to-Fetch bridge bootstrapp's dev server uses (`bootstrapp/packages/serve/src/http.ts`) |
| `variants/light.ts` | The same API on `@lightstart/server` and its node adapter |

```
node benchmarks/server/run.js [--rounds 3] [--engines node,native] [--variants raw,bridge,light]
  [--connections 64] [--requests 40000] [--cpu] [--server-core 6] [--load-core 7]
```

Every contender must answer the same digest (status, content type, cache control, ETag, request id and body of every response) and print the same totals as the first one, or the run fails. `--engines native` builds each variant with light's scriptc (`packages/light/native/scriptc.js`) into `out/`.

`--cpu` pins each server to one core (`--server-core`, 6 by default) and the load client to another (`--load-core`, 7), and adds the server's user+system CPU seconds to the report, as seconds per request and per 10,000 requests (warm-up requests included, as the process's CPU includes them). Throughput on a shared machine moves about ±20% between rounds; CPU on a pinned core is the quieter yardstick.

`raw.ts` and `load.mjs` come from [vercel-labs/scriptc](https://github.com/vercel-labs/scriptc) (`benchmarks/runtime/`, Apache-2.0), unchanged but for the `@ts-expect-error` `raw.ts` needs under `@types/node`.

## Results

Linux x64, node v25.3.0 and scriptc (the fork's `light-integration`, v0.4.5), load average about 2, 3 rounds of 40,000 measured requests, medians:

| Contender | req/s | p50 ms | p99 ms | vs raw node |
|---|---:|---:|---:|---:|
| raw node | 25791 | 2.3 | 4.5 | 1.00x |
| raw native | 77645 | 0.7 | 1.7 | 3.01x |
| bridge node | 12981 | 4.6 | 8.6 | 0.50x |
| bridge native | 32994 | 1.8 | 4.1 | 1.28x |
| light node | 24085 | 2.5 | 4.8 | 0.93x |
| light native | 52954 | 1.1 | 2.6 | 2.05x |

A `Request` and a `Response` per request halve the throughput on both engines, which is why the package's core has its own `Context` and `Reply` and an adapter reads and writes the platform's own objects. Natively the package answered twice node's rate but 0.68x of the hand-written native server, and a profile showed why: scriptc's `writeHead` sends the head at once, so each response took two `sendto` calls where raw's took one `sendmsg`. The node adapter now sets a whole body's head with `setHeader` natively (`packages/server/node/write.ts`), and `--cpu` (3 rounds, load average about 10, so ratios rather than absolutes) gives:

| Contender | CPU µs/req | vs raw, same engine |
|---|---:|---:|
| raw node | 67.5 | 1.00x |
| light node | 68.4 | 1.01x |
| raw native | 23.6 | 1.00x |
| light native | 27.3 | 1.15x |

Light native's throughput in that run matched raw native's (28.0k vs 27.8k req/s).
