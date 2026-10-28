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
| `@lightstart/server/node` | `serve(app, options)`: node and scriptc native. Lazy bodies with a limit, streamed replies with backpressure, abort on client disconnect, graceful `close()` |
| `@lightstart/server/fetch` | `toFetch(app, options)`: a `(request, env?, ctx?) => Promise<Response>` handler for Cloudflare Workers and Pages, Bun, Deno and any Fetch host. Work given to `waitUntil` goes to the platform's |
| `@lightstart/server/lambda` | `toLambda(app)`: a handler for API Gateway HTTP APIs and Lambda function URLs (the 2.0 event). Base64 bodies both ways, every `set-cookie` in `cookies`, `waitUntil` work awaited before returning. It reaches only the core's public entry, as an adapter from another package would |
| `@lightstart/server/memory` | `request(app, method, target, init)` and `bodyOf(reply)`: an app driven without a socket, for tests |

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

## The reply

A handler answers a `Reply`, or a promise of one: `json(data, status)`, `text`, `html`, `bytes(body, type)`, `empty(status)`, `redirect(location)`, `fail(message, status)`, `stream(async (out) => { await out.write(chunk) }, type)`, or `respond(response)` for a Fetch `Response`. `reply.header(name, value)` sets a header and answers the reply. `reply.headers` keeps repeated names, so two `set-cookie` headers stay two.

Throw `new HttpError(status, message)` to answer `{ "error": message }` with that status; anything else thrown is logged and answers 500.

`sse(async (events) => { await events.send(data, event, id) })` is an event stream: never cached, and marked `x-accel-buffering: no` so nginx in front sends each event when it is written.

## Plugins

| Entry | Plugin |
|---|---|
| `@lightstart/server/cors` | `new Cors({ origins, allow?, prefix?, methods?, headers?, expose?, credentials?, maxAge? })`: preflights answered before routing, the grant on every reply to an allowed origin |
| `@lightstart/server/proxy` | `new TrustProxy({ trust: ["10.0.0.0/8"] \| true })`: `Forwarded` / `X-Forwarded-*` from a trusted peer become `c.protocol`, `c.host`, `c.ip`; anyone else's are ignored; the client is the rightmost address that is not a trusted proxy |
| `@lightstart/server/static` | `new Static({ root, prefix?, index?, spa?, dotfiles?, cacheControl?, streamAbove? })`: files from a folder (node and native). Path guard, index and `.html` lookup, a single-page fallback, ETag and `last-modified` with 304s, `.br`/`.gz` neighbours, large files streamed |
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

The sources follow the rules light's native core keeps (`packages/light/native/probes/README.md`): TypeScript with erasable syntax, `unknown` narrowed by `typeof` and `instanceof`, identity in classes, no `Map` of functions, no write by a computed string key. `benchmarks/server/` measures the package against bare `node:http` and against a Fetch bridge, under node and natively.
