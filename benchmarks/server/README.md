# Server benchmark

scriptc's `http-api` workload (a JSON API with routing, query parsing, a seeded catalog, per-cart state, JSON bodies, ETags and request ids), written six ways and driven by scriptc's own load client (`load.mjs`: keep-alive HTTP/1.1, 64 connections, one request in flight per connection, a seeded request sequence):

| Variant | What it is |
|---|---|
| `variants/raw.ts` | The workload as scriptc ships it, on bare `node:http` |
| `variants/bridge.ts` | The same API as a Fetch handler, `(Request) => Promise<Response>`, behind the node-to-Fetch bridge bootstrapp's dev server uses (`bootstrapp/packages/serve/src/http.ts`) |
| `variants/light.ts` | The same API on `@lightstart/server` and its node adapter |
| `variants/express.ts` | On Express 5, its routes as an Express user writes them; its own ETag off, the body read by hand (`express.json()` answers a malformed body with its own 400 before the API's checks) |
| `variants/fastify.ts` | On Fastify 5 with its JSON body parser; its error handler answers a malformed body as raw does and keeps the connection open |
| `variants/hono.ts` | On Hono served by `@hono/node-server`, its official node adapter; headers set by hand where `c.json` would differ (no `charset`) |

Express, Fastify and Hono are devDependencies of `@light/benchmarks` (`benchmarks/package.json`), not of the repository. None of them builds natively: Express and Fastify call into node's own JavaScript, which scriptc reaches only through a libnode pack (SC8005), and scriptc's shim for `@hono/node-server` stops at a `write` it does not lower yet (SC2020).

```
node benchmarks/server/run.js [--workload http-api] [--rounds 3] [--engines node,native] [--variants raw,bridge,light,express,fastify,hono]
  [--connections 64] [--requests 40000] [--cpu] [--server-core 6] [--load-core 7]
```

Every contender must answer the same digest (status, content type, cache control, ETag, request id and body of every response) and print the same totals as the first one, or the run fails. `--engines native` builds each variant with light's scriptc (`packages/light/native/scriptc.js`) into `out/`.

`--cpu` pins each server to one core (`--server-core`, 6 by default) and the load client to another (`--load-core`, 7), and adds the server's user+system CPU seconds to the report, as seconds per request and per 10,000 requests (warm-up requests included, as the process's CPU includes them). Throughput on a shared machine moves about ±20% between rounds; CPU on a pinned core is the quieter yardstick.

`raw.ts` and `load.mjs` come from [vercel-labs/scriptc](https://github.com/vercel-labs/scriptc) (`benchmarks/runtime/`, Apache-2.0), unchanged but for the `@ts-expect-error` `raw.ts` needs under `@types/node` and load.mjs's `--workload` flag (the hello schedules and their digest below).

## A paired comparison

`node benchmarks/server/pair.js <before> <after> [--workload hello-get] [--rounds 7]` judges a change to the server: each round runs the BEFORE binary then the AFTER one, each pinned to a core with the load client on another, and prints the server's CPU µs a request per round and the medians, with how many rounds AFTER was lower. Build BEFORE from a copy of the package as it was (`git archive HEAD packages/server | tar -x -C <dir>`) and AFTER from the working tree, each with a copy of a variant whose imports point at its own copy. On this machine two identical binaries differed by up to 9%, so run a control (the same binary twice) and read a change of a few percent as noise.

## Hello workloads

`--workload hello-get` and `--workload hello-post` run Fastify's own benchmark routes ([fastify/benchmarks](https://github.com/fastify/benchmarks), the chart on fastify.dev) instead of scriptc's http-api. Each contender is one file in `hello/<variant>.ts` serving both routes: GET / answers `{"hello":"world"}`, and POST / with the JSON body `{"hello":"world"}` parses and echoes it back as JSON. Both count one request; POST /shutdown answers `{"bye":true}`, then the server prints `requests <n>` and exits. The workload decides the load client's request: hello-get is always GET /, hello-post always POST / with `content-type: application/json`. Native binaries are written as `out/<workload>-<variant>` so the workloads do not overwrite each other.

The hello digest covers each response's status and body and only whether its content type starts with `application/json` (the frameworks differ in the `charset` suffix, which is idiomatic, not wrong); the http-api digest is unchanged. `load.mjs --workload=hello-get|hello-post` drives them directly.

The client is scriptc's, not autocannon: one request in flight per keep-alive connection with no pipelining, versus autocannon's pipelining on fastify.dev, so the absolute numbers are not comparable with that chart even for the same route.

Linux x64, node v25.3.0, scriptc v0.4.7, `--cpu` (load average 2.5 to 3.4), 3 rounds of 40,000 measured requests, medians, fastest first; "vs raw" is CPU per request against raw on the same engine:

**hello-get**

| Contender | req/s | CPU µs/req | vs raw |
|---|---:|---:|---:|
| raw native | 50790 | 10.7 | 1.00x |
| light native | 47815 | 14.8 | 1.38x |
| raw node | 34310 | 30.9 | 1.00x |
| light node | 32216 | 36.1 | 1.17x |
| hono node | 32156 | 34.1 | 1.10x |
| fastify node | 26581 | 42.3 | 1.37x |
| express node | 21602 | 51.4 | 1.66x |

**hello-post**

| Contender | req/s | CPU µs/req | vs raw |
|---|---:|---:|---:|
| raw native | 50739 | 11.6 | 1.00x |
| light native | 49092 | 16.1 | 1.39x |
| raw node | 29326 | 36.6 | 1.00x |
| light node | 25984 | 43.4 | 1.19x |
| fastify node | 23786 | 47.7 | 1.30x |
| hono node | 22820 | 49.1 | 1.34x |
| express node | 16609 | 66.8 | 1.83x |

The load client, on one core, caps the native contenders' req/s, so natively CPU per request is the comparison.

With no work in the handler, a framework's own cost per request is all that differs: light's is about 5 µs under node and 4 µs natively, the same few microseconds the http-api workload shows, there spread over more work. Hono's node adapter answers a GET without building a full `Request`, which puts it under light there; a body puts it back above. The frameworks do not build natively (above).

## Results

With the frameworks, Linux x64, node v25.3.0, scriptc v0.4.7, `--cpu` (servers on one core, load average 1.9 rising to 4.3 during the run), 3 rounds of 40,000 measured requests, medians:

| Contender | req/s | CPU µs/req | vs raw node |
|---|---:|---:|---:|
| raw node | 21546 | 50.7 | 1.00x |
| light node | 22070 | 50.7 | 1.02x |
| express node | 17320 | 64.6 | 0.80x |
| fastify node | 16550 | 73.6 | 0.77x |
| hono node | 13346 | 80.5 | 0.62x |
| bridge node | 10411 | 105.2 | 0.48x |
| raw native | 35666 | 16.4 | 1.66x |
| light native | 43539 | 17.3 | 2.02x |
| bridge native | 26589 | 32.3 | 1.23x |

The load client, on one core, is what caps the native contenders' req/s; their CPU per request is the comparison. The API answers prebuilt JSON strings, so Fastify's compiled response serializers have nothing to do here, and a route that returns objects with a response schema would place it differently.

An earlier run, without the frameworks:


Linux x64, node v25.3.0 and scriptc (the fork's `light-integration`, v0.4.5), load average about 2, 3 rounds of 40,000 measured requests, medians:

| Contender | req/s | p50 ms | p99 ms | vs raw node |
|---|---:|---:|---:|---:|
| raw node | 25791 | 2.3 | 4.5 | 1.00x |
| raw native | 77645 | 0.7 | 1.7 | 3.01x |
| bridge node | 12981 | 4.6 | 8.6 | 0.50x |
| bridge native | 32994 | 1.8 | 4.1 | 1.28x |
| light node | 24085 | 2.5 | 4.8 | 0.93x |
| light native | 52954 | 1.1 | 2.6 | 2.05x |

A `Request` and a `Response` per request halve the throughput on both engines, which is why the package's core has its own `Context` and `Reply` and an adapter reads and writes the platform's own objects. Natively the package answers twice node's rate, and 0.68x of the hand-written native server: its per-request work weighs more there than under node (`packages/server/probes/README.md`).
