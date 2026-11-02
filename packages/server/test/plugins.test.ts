/**
 * @file The plugins that need no files, through the memory adapter. CORS: a preflight answered
 * before routing, granting an allowed origin and nothing to another, the headers asked for echoed;
 * a real reply's grant with `Vary: Origin`; only under the prefix, and only on the paths `paths` keeps; "*" and credentials; an origin
 * an `allow` function admits. The proxy's trust: forwarded headers taken from a trusted peer and
 * ignored from any other, `Forwarded` over the `X-Forwarded-*` headers, the client the rightmost
 * address that is not a trusted proxy, an IPv4 range and a mapped IPv6 peer. A request id taken
 * when plausible and made otherwise, on every reply. The health route, healthy and failing. The
 * body limit for every request and one route's own. The access log's lines.
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { Reply, json, text } from "../reply.ts";
import { bodyOf, request } from "../memory/index.ts";
import { Cors } from "../plugins/cors.ts";
import { TrustProxy } from "../plugins/proxy.ts";
import { REQUEST_ID, RequestId } from "../plugins/request-id.ts";
import { Health } from "../plugins/health.ts";
import { BodyLimit, limit } from "../plugins/body-limit.ts";
import { AccessLog, LineSink } from "../plugins/access-log.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

class Lines extends LineSink {
  readonly lines: string[] = [];

  override write(line: string): void {
    this.lines.push(line);
  }
}

class Clock {
  now = 100;
}

const preflight = (origin: string) => ({ headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type, x-token" } });

const main = async (): Promise<void> => {
  const api = new App()
    .plugin(new Cors({ origins: ["https://app.example"], prefix: "/api/", credentials: true, expose: ["x-total"] }))
    .post("/api/items", () => json({ ok: true }, 201))
    .get("/page", () => text("page"));
  const pre = await request(api, "OPTIONS", "/api/items", preflight("https://app.example"));
  eq("a preflight is answered before routing", String(pre.status) + " " + (pre.headers.get("access-control-allow-origin") ?? ""), "204 https://app.example");
  eq("with the methods", pre.headers.get("access-control-allow-methods") ?? "", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
  eq("the headers asked for", pre.headers.get("access-control-allow-headers") ?? "", "content-type, x-token");
  eq("how long to keep it", pre.headers.get("access-control-max-age") ?? "", "86400");
  eq("and credentials", pre.headers.get("access-control-allow-credentials") ?? "", "true");
  const stranger = await request(api, "OPTIONS", "/api/items", preflight("https://evil.example"));
  ok("an origin nobody allowed gets no grant", stranger.status === 204 && !stranger.headers.has("access-control-allow-origin"));
  const real = await request(api, "POST", "/api/items", { headers: { origin: "https://app.example" } });
  eq("a real reply carries the grant", (real.headers.get("access-control-allow-origin") ?? "") + " | " + (real.headers.get("vary") ?? ""), "https://app.example | Origin");
  eq("and the headers a script may read", real.headers.get("access-control-expose-headers") ?? "", "x-total");
  ok("outside the prefix nothing is granted", !(await request(api, "GET", "/page", { headers: { origin: "https://app.example" } })).headers.has("access-control-allow-origin"));
  eqn("a plain OPTIONS is no preflight", (await request(api, "OPTIONS", "/api/items", { headers: { origin: "https://app.example" } })).status, 405);
  const narrowed = new App()
    .plugin(new Cors({ origins: ["https://app.example"], paths: (path: string): boolean => path !== "/api/private" }))
    .post("/api/items", () => json({ ok: true }, 201))
    .post("/api/private", () => json({ ok: true }, 201));
  eqn("paths narrows which preflights are answered", (await request(narrowed, "OPTIONS", "/api/items", preflight("https://app.example"))).status, 204);
  eqn("a preflight to a path it leaves out routes as any request", (await request(narrowed, "OPTIONS", "/api/private", preflight("https://app.example"))).status, 405);
  ok("and gets no grant", !(await request(narrowed, "POST", "/api/private", { headers: { origin: "https://app.example" } })).headers.has("access-control-allow-origin"));

  const open = new App().plugin(new Cors({ origins: "*" })).get("/x", () => text("x"));
  eq("\"*\" grants any origin as \"*\"", (await request(open, "GET", "/x", { headers: { origin: "https://a.example" } })).headers.get("access-control-allow-origin") ?? "", "*");
  const decided = new App().plugin(new Cors({ origins: [], allow: (origin: string) => origin.endsWith(".trusted.example") })).get("/x", () => text("x"));
  eq("allow admits what the list does not", (await request(decided, "GET", "/x", { headers: { origin: "https://a.trusted.example" } })).headers.get("access-control-allow-origin") ?? "", "https://a.trusted.example");

  const where = (c: Context): Reply => text(c.protocol + " " + c.host + " " + c.ip + " " + c.url);
  const behind = new App().plugin(new TrustProxy({ trust: ["10.0.0.0/8", "192.168.1.5"] })).get("/where", where);
  const forwarded = { "x-forwarded-proto": "https", "x-forwarded-host": "shop.example", "x-forwarded-for": "203.0.113.9, 10.1.2.3" };
  eq("a trusted proxy's forwarding is taken", await bodyOf(await request(behind, "GET", "/where?a=1", { address: "10.0.0.7", headers: forwarded })), "https shop.example 203.0.113.9 https://shop.example/where?a=1");
  eq("anyone else's is ignored", await bodyOf(await request(behind, "GET", "/where", { address: "198.51.100.1", headers: { host: "origin.example", ...forwarded } })), "http origin.example 198.51.100.1 http://origin.example/where");
  eq("a client cannot pose as another behind the proxy", await bodyOf(await request(behind, "GET", "/where", { address: "192.168.1.5", headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.50" } })), "http localhost 203.0.113.50 http://localhost/where");
  eq("Forwarded wins over X-Forwarded-*", await bodyOf(await request(behind, "GET", "/where", { address: "::ffff:10.9.9.9", headers: { forwarded: "for=\"[2001:db8::1]:4711\";proto=https;host=api.example", "x-forwarded-host": "ignored.example" } })), "https api.example 2001:db8::1 https://api.example/where");
  const everyone = new App().plugin(new TrustProxy({ trust: true })).get("/where", where);
  eq("trust: true trusts every peer", await bodyOf(await request(everyone, "GET", "/where", { address: "172.17.0.1", headers: { "x-forwarded-for": "203.0.113.1" } })), "http localhost 203.0.113.1 http://localhost/where");

  const traced = new App().plugin(new RequestId()).get("/id", (c: Context) => text(c.get(REQUEST_ID) ?? "none"));
  const kept = await request(traced, "GET", "/id", { headers: { "x-request-id": "abc-123" } });
  eq("a plausible incoming id is kept and sent back", (await bodyOf(kept)) + " " + (kept.headers.get("x-request-id") ?? ""), "abc-123 abc-123");
  const made = await request(traced, "GET", "/id", { headers: { "x-request-id": "no spaces <allowed>" } });
  const id = await bodyOf(made);
  ok("an implausible one is replaced by a UUID", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) && made.headers.get("x-request-id") === id);
  ok("the 404s carry one too", (await request(traced, "GET", "/missing")).headers.has("x-request-id"));

  const healthy = new App().plugin(new Health());
  eq("the health route", await bodyOf(await request(healthy, "GET", "/health")), "{\"ok\":true}");
  const failing = new App().plugin(new Health({ path: "/ready", check: async () => false }));
  const down = await request(failing, "GET", "/ready");
  eq("a failing check is a 503", String(down.status) + " " + (await bodyOf(down)) + " " + (down.headers.get("cache-control") ?? ""), "503 {\"ok\":false} no-store");

  const limited = new App()
    .plugin(new BodyLimit(5))
    .post("/small", async (c: Context): Promise<Reply> => text(await c.text()))
    .post("/upload", async (c: Context): Promise<Reply> => text(String((await c.bytes()).length)), [limit(1000)]);
  eqn("the app's limit refuses a larger body", (await request(limited, "POST", "/small", { body: "123456" })).status, 413);
  eq("a route's own limit is over it", await bodyOf(await request(limited, "POST", "/upload", { body: "123456" })), "6");

  const lines = new Lines();
  const clock = new Clock();
  const logged = new App()
    .plugin(new AccessLog(lines, () => clock.now))
    .get("/slow", async (): Promise<Reply> => {
      clock.now += 12.5;
      return text("slow");
    });
  await request(logged, "GET", "/slow", { address: "203.0.113.4" });
  await request(logged, "GET", "/nothing");
  eq("one line per request", lines.lines.join(" | "), "GET /slow 200 12.5ms 203.0.113.4 | GET /nothing 404 0.0ms 127.0.0.1");
  done();
};

main();
