# @lightstart/server

A small HTTP server core: routes, middleware, hooks and plugins over one `Context` and one `Reply`, with no dependencies. Adapters run it on Node, as a native binary compiled by [scriptc](https://github.com/vercel-labs/scriptc) (the same code, whose `node:http` is scriptc's own native server), and in memory for tests.

```ts
import { App, json, text, HttpError, type Context } from "@lightstart/server";
import { serve } from "@lightstart/server/node";

const app = new App()
  .get("/health", () => text("ok"))
  .get("/users/:id", (c: Context) => {
    const id = c.param("id");
    if (id === "0") throw new HttpError(404, "no such user");
    return json({ id, tab: c.query("tab") });
  });

const server = await serve(app, { port: 3000, signals: true });
```

| Entry | What it is |
|---|---|
| `@lightstart/server` | The core, runtime-neutral: `App`, `Context`, `Reply` and its builders, `HeaderList`, `Router`, `Plugin`, `Key`, `HttpError`, `Logger`, and `Incoming`, the seam an adapter fills |
| `@lightstart/server/node` | `serve(app, options)`: node and scriptc native. Lazy bodies with a limit, streamed replies with backpressure, abort on client disconnect, graceful `close()`, websockets with `sockets` |
| `@lightstart/server/fetch` | `toFetch(app, options)`: a `(request, env?, ctx?) => Promise<Response>` handler for Cloudflare Workers and Pages, Bun, Deno and any Fetch host. Work given to `waitUntil` goes to the platform's |
| `@lightstart/server/lambda` | `toLambda(app)`: a handler for API Gateway HTTP APIs and Lambda function URLs (the 2.0 event). Base64 bodies both ways, every `set-cookie` in `cookies`, `waitUntil` work awaited before returning. It reaches only the core's public entry, as an adapter from another package would |
| `@lightstart/server/memory` | `request(app, method, target, init)` and `bodyOf(reply)`: an app driven without a socket, for tests; `connect(app, target, init)` for a websocket route |

```ts
// Cloudflare Workers
export default { fetch: toFetch(app, { address: (r) => r.headers.get("cf-connecting-ip") ?? "" }) };
// Bun
Bun.serve({ fetch: toFetch(app) });
// Deno: its second argument is not an env
const handler = toFetch(app);
Deno.serve((request) => handler(request));
// AWS Lambda
export const handler = toLambda(app);
```

## Routes

A pattern is `/`-separated segments: a literal, a `:name` parameter (one non-empty segment), or a trailing `*` (the rest, possibly empty, so `/files/*` also answers `/files`). Literals win over parameters and parameters over wildcards; deeper wildcards win over shallower ones; a branch with nothing for the method is backed out of, so a specific route never hides a broader one that has the method. A path matched only under other methods answers 405 with `Allow`; HEAD falls back to GET; `app.all(pattern, …)` answers whatever else. Patterns with no parameter are one `Map` lookup.

`app.handle(c)` answers null for a path no route matches, so a host can fall through to what sits behind the app; `app.dispatch(c)` answers the not-found handler's reply instead.

## The request

`c.method`, `c.path`, `c.search`, `c.param(name)`, `c.query(name)`, `c.queryAll(name)`, `c.header(name)`, `c.ip`, `c.protocol`, `c.host`, `c.url`, `c.signal`, `c.env`. The body is read once, when first asked for: `await c.text()`, `await c.bytes()`, `await c.json()` (`unknown` until narrowed; an empty or malformed body is a 400). A body larger than `c.limit` (1 MiB by default) is a 413. `await c.request()` is the request as a Fetch `Request`, built only when asked for.

Read on their first call and kept for the rest of the request, so a request that never asks pays nothing for them:

- `c.cookie(name)` and `c.cookies()`: the `Cookie` header (RFC 6265: one pair of quotes stripped, percent-decoded where it decodes, the first of a repeated name).
- `c.bearer()`: the token of `Authorization: Bearer <token>`, or null.
- `c.sameOrigin()`: whether a browser sent the request from this origin, or no browser sent it: `Sec-Fetch-Site` when present (`same-origin` or `none`), else `Origin` against `c.host` (which `TrustProxy` corrects); no `Origin` passes, `Origin: null` does not.
- `await c.form()`: an `application/x-www-form-urlencoded` body as a `Map` of every value of each name, within `c.limit`; another content type is a 415, a malformed escape a 400.
- `c.accepts("application/json", "text/html")`: the best of the types for `Accept` (q-values, wildcards, the more specific range first), the first when there is no `Accept`, null when none is acceptable.

## The reply

A handler answers a `Reply`, or a promise of one: `json(data, status)`, `text`, `html`, `bytes(body, type)`, `empty(status)`, `redirect(location)`, `fail(message, status)`, `stream(async (out) => { await out.write(chunk) }, type)`, or `respond(response)` for a Fetch `Response`. `reply.header(name, value)` sets a header and answers the reply. `reply.headers` keeps repeated names, so two `set-cookie` headers stay two.

`setCookie(reply, name, value, options)` and `clearCookie(reply, name, options)` add a `set-cookie` and answer the reply. The defaults are `Path=/`, `HttpOnly`, `SameSite=Lax`, and `secure: "auto"`: `Secure` when the request came over https, settled where the app finishes the reply (a reply written without an `App` leaves it off). The options are `maxAge` (seconds), `expires`, `path`, `domain`, `httpOnly`, `secure` (`true`, `false` or `"auto"`), `sameSite` (`"Strict"`, `"Lax"`, `"None"`) and `partitioned`. A name that is not an RFC 6265 token, a `__Host-` or `__Secure-` cookie without `Secure` (or `__Host-` with a domain or another path), and `SameSite=None` without `Secure` are refused with an error.

```ts
app.post("/login", async (c: Context) => setCookie(json({ ok: true }), "sid", await signIn(c), { maxAge: 60 * 60 * 24 * 30 }));
app.get("/me", (c: Context) => json({ sid: c.cookie("sid") }));
```

`pass()` is the reply of a route that matched but declines the request (what it serves is decided per request): `app.handle` answers null, so a host tries what sits behind the app. An `onRequest` hook may answer it too, declining every request it picks (an app of pages that leaves websocket upgrades to the host).

Throw `new HttpError(status, message)` to answer `{ "error": message }` with that status; anything else thrown is logged and answers 500. `app.mapError((c, error) => Reply | null)` maps a library's errors once (`error instanceof Error && error.message.includes("UNIQUE constraint failed") ? fail("conflict", 409) : null`): mappers are tried in the order added, the first reply wins, then `onError`'s handler, then the default; a mapper that throws answers the default 500.

A GET or HEAD whose reply is 2xx and carries an `etag` is answered 304 when the request's `If-None-Match` matches it (a list, `*`, weak comparison), and one carrying `last-modified` when `If-Modified-Since` is not earlier and there is no `If-None-Match`. The 304 keeps `etag`, `cache-control`, `content-location`, `date`, `expires`, `vary` and `set-cookie`, and its body (a stream included) is never produced. It runs after the reply hooks, so an ETag a hook adds counts; a reply with neither header costs one pass over its header names.

When the ETag is known before the work (a version stamp, a write counter), `fresh(c, etag)` says the client's copy is current, so the route answers 304 without producing the body: `if (fresh(c, etag)) return empty(304).header("etag", etag);`.

`sse(async (events) => { await events.send(data, event, id) })` is an event stream: never cached, and marked `x-accel-buffering: no` so nginx in front sends each event when it is written.

## Websockets

A route accepts a websocket by answering `upgrade(c, channel)`. The upgrade is a request like any other until then: it runs the app's hooks and middleware (an auth guard refuses it with its own reply), and `pass()` falls through. A plain request to the route is a 426.

```ts
import { Channel, upgrade, type Socket } from "@lightstart/server";

class Echo extends Channel {
  override open(socket: Socket) { socket.send("hello"); }
  override message(socket: Socket, text: string) { socket.send(text); }
  override binary(socket: Socket, data: Uint8Array) { socket.send(data); }
  override close(_socket: Socket, code: number, reason: string) {}
}

const app = new App().get("/ws", (c) => upgrade(c, new Echo()));
await serve(app, { port: 3000, sockets: { idle: 30000, maxMessage: 1048576 } });
```

The node adapter speaks RFC 6455 itself, under node and natively: fragmented messages, pings answered, at most `maxMessage` bytes a message (closed 1009 past it), every socket pinged each `idle` ms and dropped when it answered nothing since the last ping, `close()` closing the open ones 1001. A server built elsewhere takes upgrades with `acceptUpgrades(server, app)`, or answers each one itself with `sockets.answer(app, new UpgradeIncoming(req, socket), head)`, false when no route matches, the connection left for whatever else listens. The fetch and Lambda adapters take no websockets yet and answer an `upgrade` with 501.

## Several cores

`serveThreads` runs one app on several workers, each listening on the same explicit port with the kernel's balanced `reusePort`. The primary does not listen: it spawns the workers, waits for each one's `listening`, and `close()` asks each to close, waits `grace` (10 seconds by default) and terminates a straggler. With `signals: true` a SIGTERM or SIGINT closes it that way.

```ts
// main.ts
import { Worker } from "node:worker_threads";
import { serveThreads } from "@lightstart/server/node";

const server = await serveThreads({
  port: 3000,
  threads: 4,
  spawn: () => new Worker(new URL("./worker.ts", import.meta.url)),
  signals: true,
});
```

```ts
// worker.ts
import { serveWorker } from "@lightstart/server/node";

await serveWorker(app);
```

The spawn has to be written in the app's own module: scriptc resolves `new Worker(new URL("./worker.ts", import.meta.url))` at build time, and a URL passed into a library is refused (SC2020). `serveWorker` reads the port, host, sockets and grace from its own options, `workerData`, or the primary's message, so `serveWorker(app, { port: 3000 })` works too. Every worker answers its share of the requests; none is special.

Balanced `reusePort` is Linux-only. Where listening reports `ENOTSUP` or `EOPNOTSUPP` (as on macOS), `serveThreads` warns and serves on one worker without it.

State is per thread. Module state, caches and websocket registries belong to each worker, so a websocket is answered by the worker that accepted it and an in-memory cache is filled once per worker. What every worker needs to see goes over a `MessagePort`, or through a shared store such as a database: a server handle or an accepted socket does not transfer.

## Plugins

| Entry | Plugin |
|---|---|
| `@lightstart/server/cors` | `new Cors({ origins, allow?, prefix?, methods?, headers?, expose?, credentials?, maxAge? })`: preflights answered before routing, the grant on every reply to an allowed origin |
| `@lightstart/server/same-origin` | `new SameOrigin({ methods?, upgrades? })`: a cross-origin POST, PUT, PATCH or DELETE (the methods given), and a websocket upgrade unless `upgrades: false`, is answered 403 before routing, by `c.sameOrigin()`; safe methods pass unread. Registered, it cost nothing measurable natively on the hello workloads (within noise, about 0.5 µs a request) |
| `@lightstart/server/security-headers` | `new SecurityHeaders(options)`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, and `Strict-Transport-Security` on https replies; `csp` and `permissionsPolicy` only when given; each option takes `false`. Built once; a reply's own header wins; a route lists `noSecurityHeaders` to go without. Registered, it cost about 0.2 to 0.5 µs a request natively on hello-get (within noise) |
| `@lightstart/server/proxy` | `new TrustProxy({ trust: ["10.0.0.0/8"] \| true })`: `Forwarded` / `X-Forwarded-*` from a trusted peer become `c.protocol`, `c.host`, `c.ip`; anyone else's are ignored; the client is the rightmost address that is not a trusted proxy |
| `@lightstart/server/static` | `new Static({ root, prefix?, index?, spa?, dotfiles?, cacheControl?, streamAbove?, typeOf?, precompressed? })`: files from a folder (node and native). Path guard, index and `.html` lookup, a single-page fallback, ETag and `last-modified` with 304s, `.br`/`.gz` neighbours (unless `precompressed: false`), large files streamed; `typeOf` replaces the MIME table |
| `@lightstart/server/request-id` | `new RequestId()`: a plausible incoming `x-request-id` kept, else a UUID; `c.get(REQUEST_ID)`, and sent back on every reply |
| `@lightstart/server/health` | `new Health({ path?, check? })`: `{ "ok": true }`, or a 503 when the check fails |
| `@lightstart/server/body-limit` | `new BodyLimit(bytes)` for every request, `limit(bytes)` as a route's own middleware |
| `@lightstart/server/access-log` | `new AccessLog(sink?)`: one line per request, `GET /carts/7 200 1.4ms 203.0.113.9` |
| `@lightstart/server/mime` | `mimeOf(path)`: the content type table every server of files here shares |

## Extending it

- **Middleware**, `(c, next) => Promise<Reply>`: `app.use(mw)` for every route, outermost first; a route's own as the last argument (`app.get("/admin", handler, [auth])`), inside the app's. Each route's chain is composed once, when the app is built.
- **Hooks**, cheaper than middleware and run for every request, the unmatched ones included: `onRequest(c => Reply | null)` before routing (a reply ends the request), `onReply((c, reply) => void)` over every reply, `onError((c, error) => Reply)`, `notFound(handler)`.
- **Values between them**: `const USER = new Key<User>("user")`, then `c.set(USER, user)` in a middleware and `c.get(USER)` in the handler.
- **Plugins**: subclass `Plugin` with an id, the ids it requires, and a `setup(app)` that adds routes, middleware and hooks. Plugins are set up when the app is built, each after the ones it requires.
- **Mounting**: `app.mount("/api", api)` serves another app's routes under a prefix, its middleware inside this app's.
- **Adapters**: subclass `Incoming` for a new runtime (method, target, headers, body, address, abort signal, `waitUntil`), make a `Context` from it and write what `app.dispatch` answers.

## scriptc

In the workspace the exports name the TypeScript sources, which scriptc compiles as program source. `npm run pack` stages what npm gets into `dist/`: each module as JavaScript (types stripped in place, so lines match) with its `.d.ts`, since node strips no types inside `node_modules`.

`@lightstart/light` lists this package as an optional peer: `light test`, `light serve` and its desktop shell serve their pages with it, and a project that uses none of them never installs it.

The sources follow the rules light's native core keeps (`packages/light/native/probes/README.md`): TypeScript with erasable syntax, `unknown` narrowed by `typeof` and `instanceof`, identity in classes, no `Map` of functions, no write by a computed string key. `benchmarks/server/` measures the package against bare `node:http` and against a Fetch bridge, under node and natively.
