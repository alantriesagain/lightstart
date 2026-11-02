/**
 * @file The fetch adapter as a Worker runs it: the target taken from the request's URL, with and
 * without a query; headers by name; the original `Request` handed back; the `env` and the address
 * the options name; work handed to the platform's `waitUntil`; a JSON body, and one over the limit
 * refused as it streams in; two `set-cookie` headers kept apart; a HEAD and a 204 with no body; a
 * streamed body read through the `Response`; a handler's own `Response` passed on untouched, and
 * one a hook added headers to keeping its own and gaining the hook's.
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { Reply, empty, json, respond, stream, text } from "../reply.ts";
import { toFetch, type FetchPlatform } from "../fetch/index.ts";
import { done, eq, ok } from "@light/test/assert.ts";

class Platform implements FetchPlatform {
  readonly work: Promise<unknown>[] = [];

  waitUntil(work: Promise<unknown>): void {
    this.work.push(work);
  }
}

class Journal {
  lines: string[] = [];
}

const main = async (): Promise<void> => {
  const journal = new Journal();
  const passed = new Response("made by hand", { status: 202, headers: { "x-hand": "yes" } });
  const app = new App()
    .get("/where", (c: Context) => json({ path: c.path, q: c.query("q"), proto: c.protocol, host: c.host, ip: c.ip, ua: c.header("user-agent") }))
    .get("/same", async (c: Context): Promise<Reply> => text(String((await c.request()).url)))
    .get("/env", (c: Context) => {
      const env = c.env;
      const name = env !== null && typeof env === "object" && !Array.isArray(env) ? (env as Record<string, unknown>)["NAME"] : undefined;
      return text(typeof name === "string" ? name : "none");
    })
    .post("/later", (c: Context) => {
      c.waitUntil(Promise.resolve().then(() => {
        journal.lines.push("done later");
      }));
      return text("ok");
    })
    .post("/echo", async (c: Context): Promise<Reply> => json({ got: await c.json() }))
    .post("/small", async (c: Context): Promise<Reply> => {
      c.limit = 4;
      return text(await c.text());
    })
    .get("/cookies", () => text("c").header("x-one", "1"))
    .get("/stream", () =>
      stream(async (out) => {
        await out.write("one,");
        await out.write(new TextEncoder().encode("two"));
      }, "text/plain"),
    )
    .delete("/gone", () => empty())
    .get("/passed", () => respond(passed))
    .get("/passed-grant", () => respond(new Response("by hand", { status: 202, headers: { "x-hand": "own" } })));
  app.onReply((c: Context, reply: Reply): void => {
    if (c.path === "/passed-grant") {
      reply.headers.set("x-grant", "yes");
      reply.headers.set("x-hand", "hook");
      reply.headers.append("set-cookie", "g=1");
    }
    if (c.path === "/cookies") {
      reply.headers.append("set-cookie", "a=1");
      reply.headers.append("set-cookie", "b=2");
    }
  });
  const handler = toFetch(app, { address: (r: Request) => r.headers.get("cf-connecting-ip") ?? "" });

  const where = await handler(new Request("https://example.com/where?q=hi%20there", { headers: { "user-agent": "test", "cf-connecting-ip": "203.0.113.9" } }));
  eq("the target, the protocol, the host and the address", await where.text(), "{\"path\":\"/where\",\"q\":\"hi there\",\"proto\":\"https\",\"host\":\"example.com\",\"ip\":\"203.0.113.9\",\"ua\":\"test\"}");
  const bare = await handler(new Request("http://example.com/where"));
  eq("a URL with no query", await bare.text(), "{\"path\":\"/where\",\"q\":null,\"proto\":\"http\",\"host\":\"example.com\",\"ip\":\"\",\"ua\":null}");
  eq("the original Request is handed back", await (await handler(new Request("https://example.com/same?x=1"))).text(), "https://example.com/same?x=1");
  eq("the env reaches the handler", await (await handler(new Request("https://example.com/env"), { NAME: "worker" })).text(), "worker");

  const platform = new Platform();
  await (await handler(new Request("https://example.com/later", { method: "POST" }), {}, platform)).text();
  ok("work goes to the platform's waitUntil", platform.work.length === 1);
  for (const work of platform.work) await work;
  eq("and runs there", journal.lines.join(","), "done later");

  eq("a JSON body is read", await (await handler(new Request("https://example.com/echo", { method: "POST", body: "{\"a\":[1,2]}" }))).text(), "{\"got\":{\"a\":[1,2]}}");
  const big = await handler(new Request("https://example.com/small", { method: "POST", body: "too long" }));
  eq("a body over the limit is a 413", String(big.status) + " " + (await big.text()), "413 {\"error\":\"the body is larger than 4 bytes\"}");

  const cookies = await handler(new Request("https://example.com/cookies"));
  eq("two set-cookie headers stay two", cookies.headers.getSetCookie().join(" | "), "a=1 | b=2");
  const head = await handler(new Request("https://example.com/cookies", { method: "HEAD" }));
  eq("a HEAD has no body", String(head.status) + " [" + (await head.text()) + "]", "200 []");
  const gone = await handler(new Request("https://example.com/gone", { method: "DELETE" }));
  eq("a 204 has no body", String(gone.status) + " [" + (await gone.text()) + "]", "204 []");
  eq("a streamed body reads through the Response", await (await handler(new Request("https://example.com/stream"))).text(), "one,two");
  const hand = await handler(new Request("https://example.com/passed"));
  ok("a handler's own Response is passed on untouched", hand === passed);
  const granted = await handler(new Request("https://example.com/passed-grant"));
  eq("a hook's headers reach a handler's own Response, its own header winning", String(granted.status) + " " + (granted.headers.get("x-grant") ?? "") + " " + (granted.headers.get("x-hand") ?? "") + " " + (granted.headers.get("set-cookie") ?? "") + " " + (await granted.text()), "202 yes own g=1 by hand");
  const missing = await handler(new Request("https://example.com/nope"));
  eq("a path no route matches is a 404", String(missing.status), "404");
  done();
};

main();
