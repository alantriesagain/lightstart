/**
 * @file The node adapter on a loopback port the system picks, reached with `fetch`: a JSON reply
 * framed by its `content-length`; two `set-cookie` headers arriving as two; a HEAD with the GET's
 * length and no body; a 204 with none; a JSON body read and a body over the limit refused with a
 * 413; a 405 with `Allow` over the wire; a streamed body arriving chunk by chunk (the first before
 * the handler writes the second); a Fetch `Response` copied out with its headers; the client's
 * abort reaching the handler's signal; the peer's address; and `close()` waiting for the work
 * handed to `waitUntil` after the last reply.
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { MemoryLogger } from "../logger.ts";
import { Reply, empty, json, respond, sse, stream, text } from "../reply.ts";
import { serve } from "../node/index.ts";
import { done, eq, ok } from "@light/test/assert.ts";

class Journal {
  lines: string[] = [];
}

class Gate {
  open: (() => void) | null = null;
}

const later = (ms: number): Promise<void> =>
  new Promise<void>((resolve: () => void) => {
    setTimeout(resolve, ms);
  });

const waitFor = async (journal: Journal, line: string): Promise<boolean> => {
  for (let i = 0; i < 100; i++) {
    if (journal.lines.indexOf(line) >= 0) return true;
    await later(20);
  }
  return false;
};

const main = async (): Promise<void> => {
  const journal = new Journal();
  const gate = new Gate();
  const app = new App()
    .logTo(new MemoryLogger())
    .get("/json", () => json({ ok: true }))
    .get("/cookies", () => {
      const reply = text("two cookies");
      reply.headers.append("set-cookie", "session=abc; Path=/; HttpOnly");
      reply.headers.append("set-cookie", "csrf=xyz; Path=/");
      return reply;
    })
    .delete("/thing/:id", () => empty())
    .post("/echo", async (c: Context): Promise<Reply> => {
      const body = await c.json();
      return json({ got: body });
    })
    .post("/small", async (c: Context): Promise<Reply> => {
      c.limit = 8;
      return text(await c.text());
    })
    .get("/stream", () =>
      stream(async (out) => {
        await out.write("first;");
        await new Promise<void>((resolve: () => void) => {
          gate.open = resolve;
        });
        await out.write("second");
      }, "text/plain"),
    )
    .get("/fetch-style", () => respond(new Response("from a Response", { status: 201, headers: { "x-kind": "fetch" } })))
    .get("/abort", (c: Context) => {
      const signal = c.signal;
      return stream(async (out) => {
        await out.write("waiting");
        for (let i = 0; i < 100 && !signal.aborted; i++) await later(20);
        journal.lines.push(signal.aborted ? "aborted" : "never aborted");
      }, "text/plain");
    })
    .get("/events", () =>
      sse(async (events) => {
        await events.send("hello", "greeting", "1");
        await events.comment("keep-alive");
        await events.send("two\nlines");
      }),
    )
    .get("/ip", (c: Context) => text(c.ip))
    .post("/later", (c: Context) => {
      c.waitUntil(later(100).then(() => {
        journal.lines.push("work done");
      }));
      return text("accepted", 202);
    });

  const server = await serve(app, { port: 0, host: "127.0.0.1" });
  const base = "http://127.0.0.1:" + String(server.port);
  ok("listens on a port the system picked", server.port > 0);

  const res = await fetch(base + "/json");
  eq("a JSON reply", String(res.status) + " " + (await res.text()), "200 {\"ok\":true}");
  eq("framed by its content-length", res.headers.get("content-length") ?? "chunked", "11");

  const cookies = await fetch(base + "/cookies");
  await cookies.text();
  eq("two set-cookie headers arrive as two", cookies.headers.getSetCookie().join(" | "), "session=abc; Path=/; HttpOnly | csrf=xyz; Path=/");

  const head = await fetch(base + "/json", { method: "HEAD" });
  eq("a HEAD has the GET's length and no body", (head.headers.get("content-length") ?? "") + " [" + (await head.text()) + "]", "11 []");
  const deleted = await fetch(base + "/thing/7", { method: "DELETE" });
  eq("a 204 has no body", String(deleted.status) + " [" + (await deleted.text()) + "]", "204 []");

  const echo = await fetch(base + "/echo", { method: "POST", headers: { "content-type": "application/json" }, body: "{\"n\":1}" });
  eq("a JSON body is read", await echo.text(), "{\"got\":{\"n\":1}}");
  const big = await fetch(base + "/small", { method: "POST", body: "more than eight bytes" });
  eq("a body over the limit is a 413", String(big.status) + " " + (await big.text()), "413 {\"error\":\"the body is larger than 8 bytes\"}");
  const fits = await fetch(base + "/small", { method: "POST", body: "eight b" });
  eq("one within it is read", await fits.text(), "eight b");

  const refused = await fetch(base + "/json", { method: "PUT" });
  await refused.text();
  eq("a 405 carries Allow over the wire", String(refused.status) + " " + (refused.headers.get("allow") ?? ""), "405 GET, HEAD");

  const streamed = await fetch(base + "/stream");
  ok("a streamed body is chunked", streamed.headers.get("content-length") === null);
  const body = streamed.body;
  if (body === null) ok("a streamed body has a body", false);
  else {
    const reader = body.getReader();
    const first = await reader.read();
    eq("its first chunk arrives before the handler writes the second", first.done ? "" : new TextDecoder().decode(first.value), "first;");
    if (gate.open !== null) gate.open();
    let rest = "";
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      rest += new TextDecoder().decode(next.value);
    }
    eq("and the rest after it", rest, "second");
  }

  const fetchStyle = await fetch(base + "/fetch-style");
  eq("a Fetch Response is copied out", String(fetchStyle.status) + " " + (fetchStyle.headers.get("x-kind") ?? "") + " " + (await fetchStyle.text()), "201 fetch from a Response");

  const controller = new AbortController();
  const aborting = await fetch(base + "/abort", { signal: controller.signal });
  const abortBody = aborting.body;
  if (abortBody !== null) await abortBody.getReader().read();
  controller.abort();
  ok("the client's abort reaches the handler's signal", await waitFor(journal, "aborted"));

  const events = await fetch(base + "/events");
  eq("an event stream, unbuffered for a proxy", (events.headers.get("content-type") ?? "") + " " + (events.headers.get("x-accel-buffering") ?? ""), "text/event-stream; charset=utf-8 no");
  eq("its events framed", await events.text(), "id: 1\nevent: greeting\ndata: hello\n\n: keep-alive\n\ndata: two\ndata: lines\n\n");

  eq("the peer's address", await (await fetch(base + "/ip")).text(), "127.0.0.1");

  const accepted = await fetch(base + "/later", { method: "POST" });
  eq("the reply goes out before the work", String(accepted.status) + " " + (await accepted.text()) + " " + String(journal.lines.indexOf("work done") >= 0), "202 accepted false");
  await server.close();
  ok("close() waits for the work handed to waitUntil", journal.lines.indexOf("work done") >= 0);
  done();
};

main();
