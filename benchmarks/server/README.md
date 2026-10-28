# Server benchmark

scriptc's `http-api` workload (a JSON API with routing, query parsing, a seeded catalog, per-cart state, JSON bodies, ETags and request ids), written three ways and driven by scriptc's own load client (`load.mjs`: keep-alive HTTP/1.1, 64 connections, one request in flight per connection, a seeded request sequence):

| Variant | What it is |
|---|---|
| `variants/raw.ts` | The workload as scriptc ships it, on bare `node:http` |
| `variants/bridge.ts` | The same API as a Fetch handler, `(Request) => Promise<Response>`, behind the node-to-Fetch bridge bootstrapp's dev server uses (`bootstrapp/packages/serve/src/http.ts`) |
| `variants/light.ts` | The same API on `@lightstart/server` and its node adapter |

```
node benchmarks/server/run.js [--rounds 3] [--engines node,native] [--variants raw,bridge,light]
```

Every contender must answer the same digest (status, content type, cache control, ETag, request id and body of every response) and print the same totals as the first one, or the run fails. `--engines native` builds each variant with light's scriptc (`packages/light/native/scriptc.js`) into `out/`.

`raw.ts` and `load.mjs` are copied unchanged from [vercel-labs/scriptc](https://github.com/vercel-labs/scriptc) (`benchmarks/runtime/`, Apache-2.0).

## Results

Node v25.3.0, Linux x64, load average about 4, 3 rounds of 40,000 measured requests, medians:

| Contender | req/s | p50 ms | p99 ms | vs raw node |
|---|---:|---:|---:|---:|
| raw node | 15315 | 4.0 | 8.1 | 1.00x |
| bridge node | 7567 | 8.2 | 15.9 | 0.49x |
| light node | 14672 | 4.2 | 8.9 | 0.96x |

A `Request` and a `Response` per request halve the throughput under node, which is why the package's core has its own `Context` and `Reply` and an adapter reads and writes the platform's own objects. Native numbers are pending a scriptc build of the fork.
