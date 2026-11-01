# Probes

What scriptc (the fork's `light-integration`, v0.4.5) accepts and does for this package's shapes, and the decisions that came from it. `backpressure.ts`, `cancellation.ts`, `crypto-node.ts` and `crypto-web.ts` are kept as programs: run each with `node probes/<name>.ts`, and natively with `scriptc-dev build probes/<name>.ts -o /tmp/<name>` then `/tmp/<name>` from this folder's package, so it sees `@types/node`.

| Finding | Decision |
|---|---|
| `instanceof` on `Reply \| Promise<Reply>` is refused (a promise has no class prototype test natively); `await` on the same union compiles (scriptc's corpus `6241-maybe-promise-handlers.ts`) | A handler may answer a `Reply` or a promise of one; the app awaits whatever comes back |
| An `async` method cannot override another (async methods dispatch statically), and a class that tries is rejected along with every value of it | `Incoming.text`/`bytes` and `Writer.write` are plain methods answering promises, from module-level helpers or `Promise.resolve`/`reject` |
| A `ServerResponse` has no `drain` event, no `writableNeedDrain`, no `writableLength`; neither it, its `Server` nor a `net.Socket` has `off`, `removeListener` or `listenerCount`. A socket's `writableNeedDrain` compiles, and natively never turns true: the runtime buffers a response's writes itself | The node writer polls the socket's `writableNeedDrain` every 2 ms while it is full (node pauses a large stream; natively it never waits), with no listener per wait to pile up on a keep-alive socket. Natively a slow client of a large stream buffers in memory, a scriptc gap to report |
| `res.write` of a `string \| Uint8Array` is refused; each arm alone compiles. Using `res.write`'s result is refused (it is `void` natively) | The writer narrows the chunk and calls `write` as a statement |
| `res.destroyed` has no lowering | One `close` listener per request records a client gone before the handler asked for its signal |
| `writeHead(status, [literal, …])` infers an array type with no lowering; a `string[]`-typed value compiles | Header lists are built as `string[]` (`HeaderList.flat()`) |
| Iterating a `Headers` has no lowering; `headers.forEach((value, name) => …)` compiles and visits every `set-cookie` on its own | Adapters read Fetch headers with `forEach` |
| A class field typed `ReadableStreamDefaultController<…>` is refused | The fetch adapter's stream writer holds a `deliver` function instead |
| A Promise executor's reject must be typed `(reason: Error) => void` | Every executor here types it so |
| An `upgrade` listener is lowered only as `(req: IncomingMessage, socket: Socket, head: Buffer)` with `net.Socket`, not node's declared `Duplex`; with it the handshake, `createHash("sha1")`, `Buffer` framing and a socket's `end` all compile and behave as under node | `node/socket.ts` types the connection `net.Socket` and speaks RFC 6455 itself, natively too |
| A socket an `http.Server` upgraded is half-open: the client's FIN does not end it | The websocket ends its side on `end`, or `close()` would wait for it forever |
| `Promise.all` over `Promise<unknown>[]` has no lowering | A test awaits such a list in a loop |
| An override's parameters must match the base's exactly | `setup(_app: App)` in a test plugin with nothing to set up |
| `probes/cancellation.ts`: `new AbortController()`, `abort()`, a signal's `aborted`, `reason` and `addEventListener`, a loop stopped by a timer's abort; `Promise.race` of two `setTimeout` promises; an inferred `setTimeout` handle passed to `clearTimeout` | PASS, identical to node: `AbortController` and its events exist natively (the belief that it is missing is wrong). A handle typed `unknown` fails SC0001 ("Argument of type 'unknown' is not assignable to parameter of type 'number \| Timeout \| null \| undefined'"); inferring it compiles | `timeout(ms)` keeps an inferred timer handle, races the chain against it, aborts `c.signal` and clears the timer; work that listens to the signal stops, work that does not runs on with its reply discarded |
| `probes/crypto-node.ts`: `createHmac("sha256").update(…).digest("base64url"/"hex")`, `createHash("sha256")` over text and bytes, `timingSafeEqual`, `randomBytes`, `randomUUID`, `Buffer` base64url round trip | PASS, identical to node | The `Crypto` seam stays synchronous, and `node/crypto.ts` (`NodeCrypto`) is its node and native implementation |
| `probes/crypto-web.ts`: `crypto.subtle.digest("SHA-256")`, `importKey`/`sign` for HMAC-SHA256, `getRandomValues`, `randomUUID` | PASS, identical to node; `crypto.subtle` is present natively too | WebCrypto's digest and sign are promises, so a fetch adapter filling the same seam needs an async seam; the node path stays synchronous |

With these, every test compiles fully statically (`light-native coverage @lightstart/server`: 100% of statements, no slow path) and prints under scriptc exactly what it prints under node.

## Throughput

`benchmarks/server/` (scriptc's http-api workload, 64 keep-alive connections, 40,000 measured requests, 3 rounds, medians; Linux x64, load about 2):

| Contender | req/s | p99 ms | vs raw node |
|---|---:|---:|---:|
| raw `node:http`, node | 25791 | 4.5 | 1.00x |
| raw, native | 77645 | 1.7 | 3.01x |
| Fetch bridge, node | 12981 | 8.6 | 0.50x |
| Fetch bridge, native | 32994 | 4.1 | 1.28x |
| @lightstart/server, node | 24085 | 4.8 | 0.93x |
| @lightstart/server, native | 52954 | 2.6 | 2.05x |

Under node the package costs a few percent over a hand-written server; natively it answers twice node's rate but 0.68x of the hand-written native one, so its per-request work weighs more there. That gap is the next thing to measure and cut.
