/**
 * @file The request pipeline through the memory adapter: middleware outermost first, the app's
 * around a route's own, one answering without `next` and one changing what `next` answered;
 * `onRequest` hooks answering before routing and `onReply` hooks over every reply, the 404s
 * included; a thrown `HttpError` answering its status and anything else a logged 500; a custom
 * error and not-found handler; plugins set up after what they require, a missing requirement and
 * a loop refused; a mounted app's routes under its prefix with its middleware inside the mounting
 * app's; nothing added once built; the query, the body as text, bytes and JSON (read once), a
 * malformed or oversized body refused; values handed from a middleware by key; work handed to
 * `waitUntil` done before the memory adapter answers, a failure logged and never answered; the
 * reply builders and the request rebuilt as a Fetch `Request`.
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { HttpError } from "../errors.ts";
import { Key } from "../key.ts";
import { MemoryLogger } from "../logger.ts";
import { Plugin } from "../plugin.ts";
import { Reply, bytes, empty, fail, html, json, redirect, stream, text } from "../reply.ts";
import type { Next } from "../router.ts";
import { MemoryIncoming, bodyOf, request } from "../memory/index.ts";
import { done, eq, eqn, ok, throws } from "@light/test/assert.ts";

class Journal {
  lines: string[] = [];
}

const tagged = (journal: Journal, name: string) => async (_c: Context, next: Next): Promise<Reply> => {
  journal.lines.push(">" + name);
  const reply = await next();
  journal.lines.push("<" + name);
  return reply;
};

class Recorder extends Plugin {
  readonly journal: Journal;

  constructor(id: string, requires: string[], journal: Journal) {
    super(id, requires);
    this.journal = journal;
  }

  setup(app: App): void {
    this.journal.lines.push(this.id);
    const id = this.id;
    app.get("/" + id, () => text(id));
  }
}

const USER = new Key<string>("user");
const COUNT = new Key<number>("count");

const main = async (): Promise<void> => {
  const journal = new Journal();
  const layered = new App()
    .use(tagged(journal, "outer"))
    .use(tagged(journal, "inner"))
    .get("/x", (): Reply => {
      journal.lines.push("handler");
      return text("x");
    }, [tagged(journal, "own")]);
  await request(layered, "GET", "/x");
  eq("middleware runs outermost first, the route's own inside the app's", journal.lines.join(" "), ">outer >inner >own handler <own <inner <outer");

  const guarded = new App()
    .use(async (c: Context, next: Next): Promise<Reply> => (c.header("authorization") === null ? fail("who are you", 401) : next()))
    .use(async (_c: Context, next: Next): Promise<Reply> => (await next()).header("x-seen", "yes"))
    .get("/secret", () => text("s"));
  const denied = await request(guarded, "GET", "/secret");
  eqn("a middleware answers without next", denied.status, 401);
  ok("and the inner middleware never ran", !denied.headers.has("x-seen"));
  const allowed = await request(guarded, "GET", "/secret", { headers: { Authorization: "Bearer t" } });
  eq("a middleware changes what next answered", allowed.headers.get("x-seen") ?? "", "yes");

  const hooks = new Journal();
  const hooked = new App()
    .onRequest((c: Context): Reply | null => (c.path === "/ping" ? text("pong") : null))
    .onReply((c: Context, reply: Reply): void => {
      hooks.lines.push(c.method + " " + c.path + " " + String(reply.status));
      reply.headers.set("x-served-by", "light");
    })
    .get("/real", () => text("real"));
  eq("an onRequest hook answers before routing", await bodyOf(await request(hooked, "GET", "/ping")), "pong");
  const real = await request(hooked, "GET", "/real");
  eq("onReply runs over a route's reply", real.headers.get("x-served-by") ?? "", "light");
  const lost = await request(hooked, "GET", "/lost");
  eq("and over the 404", lost.headers.get("x-served-by") ?? "", "light");
  eq("in order, hook answers included", hooks.lines.join(" | "), "GET /ping 200 | GET /real 200 | GET /lost 404");

  const logged = new MemoryLogger();
  const failing = new App()
    .logTo(logged)
    .get("/teapot", (): Reply => {
      throw new HttpError(418, "short and stout");
    })
    .get("/broken", (): Reply => {
      throw new Error("the database is on fire");
    })
    .get("/async", async (): Promise<Reply> => {
      await Promise.resolve();
      throw new HttpError(409, "conflict later");
    });
  const teapot = await request(failing, "GET", "/teapot");
  eq("a thrown HttpError answers its status and message", String(teapot.status) + " " + (await bodyOf(teapot)), "418 {\"error\":\"short and stout\"}");
  const broken = await request(failing, "GET", "/broken");
  eq("anything else is a 500 that says nothing of the cause", String(broken.status) + " " + (await bodyOf(broken)), "500 {\"error\":\"internal error\"}");
  eqn("an async handler's rejection is caught the same way", (await request(failing, "GET", "/async")).status, 409);
  eq("only the unexpected error is logged, with the request", logged.lines.join(" | "), "GET /broken: the database is on fire");
  failing.onError((_c: Context, error: unknown): Reply => text("custom: " + (error instanceof Error ? error.message : "?"), 503));
  eq("a custom error handler", await bodyOf(await request(failing, "GET", "/broken")), "custom: the database is on fire");
  const custom = new App().notFound((c: Context): Reply => html("<h1>nothing at " + c.path + "</h1>", 404));
  eq("a custom not-found handler", await bodyOf(await request(custom, "GET", "/nope")), "<h1>nothing at /nope</h1>");

  const setups = new Journal();
  const plugged = new App()
    .plugin(new Recorder("c", ["b"], setups))
    .plugin(new Recorder("a", [], setups))
    .plugin(new Recorder("b", ["a"], setups));
  eq("a plugin's route answers", await bodyOf(await request(plugged, "GET", "/c")), "c");
  eq("plugins are set up after what they require", setups.lines.join(" "), "a b c");
  throws("a missing requirement refuses the build", () => {
    new App().plugin(new Recorder("x", ["y"], setups)).build();
  }, "plugin x requires y, which was not added");
  throws("a loop refuses the build", () => {
    new App().plugin(new Recorder("x", ["y"], setups)).plugin(new Recorder("y", ["x"], setups)).build();
  }, "require each other");
  throws("nothing is added once built", () => {
    plugged.get("/late", () => text("late"));
  }, "cannot be added after its first request");

  const mountJournal = new Journal();
  const api = new App().use(tagged(mountJournal, "api")).get("/", () => text("api root")).get("/users/:id", (c: Context) => text("user " + (c.param("id") ?? "")));
  const site = new App().use(tagged(mountJournal, "site")).mount("/api", api).get("/", () => text("home"));
  eq("a mounted app's routes sit under its prefix", await bodyOf(await request(site, "GET", "/api/users/3")), "user 3");
  eq("its root is the prefix itself", await bodyOf(await request(site, "GET", "/api")), "api root");
  eq("its middleware runs inside the mounting app's", mountJournal.lines.join(" "), ">site >api <api <site >site >api <api <site");
  throws("a mounted app with hooks is refused", () => {
    new App().mount("/x", new App().onReply(() => {})).build();
  }, "has hooks");
  throws("a prefix starts with / and does not end with one", () => {
    new App().mount("/x/", new App());
  }, "a mount prefix");

  const bodies = new App()
    .get("/search", (c: Context) => json({ q: c.query("q"), tags: c.queryAll("tag"), missing: c.query("nope"), bare: c.query("flag") }))
    .post("/echo", async (c: Context): Promise<Reply> => {
      const first = await c.text();
      const again = await c.text();
      const raw = await c.bytes();
      return json({ first, same: first === again, length: raw.length });
    })
    .post("/json", async (c: Context): Promise<Reply> => {
      const data = await c.json();
      if (data === null || typeof data !== "object" || Array.isArray(data)) return fail("expected an object", 422);
      return json({ got: data });
    })
    .post("/small", async (c: Context): Promise<Reply> => {
      c.limit = 4;
      return text(await c.text());
    });
  eq("the query, decoded, repeated and bare", await bodyOf(await request(bodies, "GET", "/search?q=a+b%20c&tag=x&tag=y&flag")), "{\"q\":\"a b c\",\"tags\":[\"x\",\"y\"],\"missing\":null,\"bare\":\"\"}");
  eq("a malformed escape is kept as sent", await bodyOf(await request(bodies, "GET", "/search?q=100%")), "{\"q\":\"100%\",\"tags\":[],\"missing\":null,\"bare\":null}");
  eq("the body is read once, as text and as bytes", await bodyOf(await request(bodies, "POST", "/echo", { body: "héllo" })), "{\"first\":\"héllo\",\"same\":true,\"length\":6}");
  eq("a JSON body is parsed", await bodyOf(await request(bodies, "POST", "/json", { body: "{\"a\":1}" })), "{\"got\":{\"a\":1}}");
  const junk = await request(bodies, "POST", "/json", { body: "{\"a\":" });
  eq("a malformed one is a 400", String(junk.status) + " " + (await bodyOf(junk)), "400 {\"error\":\"malformed JSON body\"}");
  eqn("an empty one is a 400", (await request(bodies, "POST", "/json")).status, 400);
  eqn("a body over the limit is a 413", (await request(bodies, "POST", "/small", { body: "12345" })).status, 413);
  eq("one within it is read", await bodyOf(await request(bodies, "POST", "/small", { body: "1234" })), "1234");

  const keyed = new App()
    .use(async (c: Context, next: Next): Promise<Reply> => {
      c.set(USER, c.header("x-user") ?? "anonymous");
      c.set(COUNT, 1);
      c.set(COUNT, (c.get(COUNT) ?? 0) + 1);
      return next();
    })
    .get("/me", (c: Context) => text((c.get(USER) ?? "?") + " " + String(c.get(COUNT) ?? 0)));
  eq("a middleware hands values to the handler by key", await bodyOf(await request(keyed, "GET", "/me", { headers: { "x-user": "ada" } })), "ada 2");
  eq("a key nobody set reads undefined", String(new Context(new MemoryIncoming("GET", "/", {})).get(USER)), "undefined");

  const work = new Journal();
  const laterLog = new MemoryLogger();
  const later = new App().logTo(laterLog).post("/order", (c: Context): Reply => {
    c.waitUntil(
      new Promise<void>((resolve: () => void) => {
        setTimeout(() => {
          work.lines.push("receipt sent");
          resolve();
        }, 10);
      }),
    );
    c.waitUntil(Promise.reject(new Error("the push service is down")));
    return json({ ok: true }, 201);
  });
  const ordered = await request(later, "POST", "/order");
  eqn("the reply is the handler's", ordered.status, 201);
  eq("the work handed to waitUntil is done before the memory adapter answers", work.lines.join(","), "receipt sent");
  eq("a failure of that work is logged, never answered", laterLog.lines.join(" | "), "POST /order: work after the reply: the push service is down");

  eq("text", (await bodyOf(text("t"))) + " " + (text("t").headers.get("content-type") ?? ""), "t text/plain; charset=utf-8");
  eq("bytes", (await bodyOf(bytes(new TextEncoder().encode("b"), "application/octet-stream"))), "b");
  eqn("empty is a 204", empty().status, 204);
  eq("redirect", String(redirect("/there").status) + " " + (redirect("/there").headers.get("location") ?? ""), "302 /there");
  eq("a stream is written to its end", await bodyOf(stream(async (out) => {
    await out.write("a");
    await out.write(new TextEncoder().encode("b"));
  }, "text/plain")), "ab");

  const rebuilt = new App().post("/fetch", async (c: Context): Promise<Reply> => {
    const req = await c.request();
    return json({ url: req.url, method: req.method, type: req.headers.get("content-type"), body: await req.text() });
  });
  eq("the request rebuilt as a Fetch Request", await bodyOf(await request(rebuilt, "POST", "/fetch?x=1", { headers: { host: "example.com", "content-type": "text/plain" }, body: "hi" })), "{\"url\":\"http://example.com/fetch?x=1\",\"method\":\"POST\",\"type\":\"text/plain\",\"body\":\"hi\"}");
  done();
};

main();
