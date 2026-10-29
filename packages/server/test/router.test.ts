/**
 * @file The router through an app and the memory adapter: an exact path and nothing else; a
 * wildcard at and below its prefix, its rest as `*`; literal segments before parameters before
 * wildcards, deeper wildcards before shallower; parameters by name; the walk backing up past a
 * branch with nothing for the method; null for a path nothing matches, so a host can fall through;
 * a 405 with `Allow` for a path matched under other methods; HEAD answered by GET; `ALL` for
 * whatever else; malformed patterns and duplicate routes refused when the app is built. Ported
 * from bootstrapp's `framework/endpoints/run.test.js`, which this router replaces.
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { Reply, pass, text } from "../reply.ts";
import { MemoryIncoming, bodyOf, request } from "../memory/index.ts";
import { done, eq, eqn, ok, throws } from "@light/test/assert.ts";

const named = (name: string) => (c: Context): Reply => text(name + (c.paramNames.length > 0 ? " " + c.paramNames.join(",") + "=" + c.paramValues.join(",") : ""));

const answer = async (app: App, method: string, target: string): Promise<string> => {
  const reply = await request(app, method, target);
  return String(reply.status) + " " + (await bodyOf(reply));
};

const main = async (): Promise<void> => {
  const exact = new App().get("/health", named("health"));
  eq("an exact path matches", await answer(exact, "GET", "/health"), "200 health");
  eq("a longer path does not", (await request(exact, "GET", "/health/x")).status === 404 ? "404" : "matched", "404");
  eq("a trailing slash is another path", (await request(exact, "GET", "/health/")).status === 404 ? "404" : "matched", "404");
  eq("the query is not part of the path", await answer(exact, "GET", "/health?x=1"), "200 health");

  const files = new App().get("/files/*", named("files"));
  eq("a wildcard answers its prefix", await answer(files, "GET", "/files"), "200 files *=");
  eq("and below it, the rest as *", await answer(files, "GET", "/files/a/b.txt"), "200 files *=a/b.txt");
  eq("a trailing slash leaves an empty rest", await answer(files, "GET", "/files/"), "200 files *=");
  eq("not a sibling sharing the prefix", (await request(files, "GET", "/filesystem")).status === 404 ? "404" : "matched", "404");

  const order = new App()
    .get("/*", named("root wildcard"))
    .get("/api/*", named("api wildcard"))
    .get("/api/users/*", named("users wildcard"))
    .get("/api/users/:id", named("user"))
    .get("/api/users/me", named("me"));
  eq("a literal before a parameter", await answer(order, "GET", "/api/users/me"), "200 me");
  eq("a parameter before a wildcard", await answer(order, "GET", "/api/users/7"), "200 user id=7");
  eq("a deeper wildcard before a shallower", await answer(order, "GET", "/api/users/7/posts"), "200 users wildcard *=7/posts");
  eq("a shallower wildcard when the deeper has no match", await answer(order, "GET", "/api/other"), "200 api wildcard *=other");
  eq("the root wildcard catches the rest", await answer(order, "GET", "/elsewhere"), "200 root wildcard *=elsewhere");

  const params = new App().get("/carts/:cart/items/:sku", named("line"));
  eq("parameters by name, in order", await answer(params, "GET", "/carts/c1/items/sku-9"), "200 line cart,sku=c1,sku-9");
  eq("a parameter is never empty", (await request(params, "GET", "/carts//items/x")).status === 404 ? "404" : "matched", "404");

  const backtrack = new App().get("/a/:x/c", named("param branch")).post("/a/b/c", named("literal branch"));
  eq("the walk backs up past a branch with nothing for the method", await answer(backtrack, "GET", "/a/b/c"), "200 param branch x=b");
  eq("and takes the literal branch for its method", await answer(backtrack, "POST", "/a/b/c"), "200 literal branch");
  const mixed = new App().get("/x/static", named("static")).post("/x/:p", named("dynamic"));
  eq("a static path without the method falls back to a pattern with it", await answer(mixed, "POST", "/x/static"), "200 dynamic p=static");

  const unmatched = new App().get("/known", named("known"));
  const none = await unmatched.handle(new Context(new MemoryIncoming("GET", "/unknown", {})));
  ok("handle answers null when nothing claims the path", none === null);
  const missing = await request(unmatched, "GET", "/unknown");
  eqn("dispatch answers 404 then", missing.status, 404);
  eq("with the path in the message", await bodyOf(missing), "{\"error\":\"no route for GET /unknown\"}");

  const declining = new App().get("/models/:name", (c: Context): Reply => (c.param("name") === "known" ? text("a model") : pass()));
  eq("a route answers what it serves", await answer(declining, "GET", "/models/known"), "200 a model");
  ok("pass() makes handle answer null, as for a path nothing matches", (await declining.handle(new Context(new MemoryIncoming("GET", "/models/other", {})))) === null);
  eqn("and dispatch the not-found reply", (await request(declining, "GET", "/models/other")).status, 404);

  const methods = new App().get("/thing", named("read")).put("/thing", named("write"));
  eq("routes by method on one path", await answer(methods, "PUT", "/thing"), "200 write");
  const refused = await request(methods, "DELETE", "/thing");
  eqn("405s a method no route answers rather than falling through", refused.status, 405);
  eq("naming the ones that would", refused.headers.get("allow") ?? "", "GET, HEAD, PUT");
  const refusedNull = await methods.handle(new Context(new MemoryIncoming("DELETE", "/thing", {})));
  ok("handle answers the 405 too, never null, once a path matches", refusedNull !== null && refusedNull.status === 405);

  eq("HEAD is answered by GET", await answer(methods, "HEAD", "/thing"), "200 read");
  const all = new App().get("/any", named("get")).all("/any", named("all"));
  eq("ALL answers what has no route of its own", await answer(all, "PATCH", "/any"), "200 all");
  eq("and leaves the ones that do", await answer(all, "GET", "/any"), "200 get");
  eq("ALL allows every method", ((await request(new App().all("/x", named("x")).get("/y", named("y")), "GET", "/x")).status === 200) ? "ok" : "no", "ok");

  throws("a pattern starts with /", () => {
    new App().get("x", named("x")).build();
  }, "a pattern starts with /");
  throws("a wildcard is only the last segment", () => {
    new App().get("/a/*/b", named("x")).build();
  }, "a wildcard is only ever the last segment");
  throws("a parameter is a whole segment", () => {
    new App().get("/a/b:c", named("x")).build();
  }, "a parameter is a whole segment");
  throws("a parameter name appears once", () => {
    new App().get("/a/:id/b/:id", named("x")).build();
  }, "the parameter :id appears twice");
  throws("a route is declared once", () => {
    new App().get("/a/:id", named("x")).get("/a/:id", named("y")).build();
  }, "is declared twice");
  throws("a method the router answers", () => {
    new App().on("BREW", "/pot", named("x")).build();
  }, "BREW is not a method");
  done();
};

main();
