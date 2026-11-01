/**
 * @file Conditional replies through the memory adapter: a GET or HEAD with a 2xx and an `etag`
 * answers 304 when the request's `If-None-Match` matches it strongly, weakly, in a comma list or
 * by `*`, keeping the validators and cache headers and dropping the body; a mismatch is the 200,
 * and a POST or a 404 is untouched. `last-modified` with `If-Modified-Since` answers 304 when it
 * is not later, a stale date does not, and an `If-None-Match` that does not match hides it. A
 * streamed reply becomes a 304 without the stream starting, and an ETag an `onReply` hook adds is
 * seen by the check (which runs after it).
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { Reply, fail, stream, text } from "../reply.ts";
import { bodyOf, request } from "../memory/index.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const cached = (): Reply =>
  text("body")
    .header("etag", "\"v1\"")
    .header("cache-control", "public, max-age=60")
    .header("content-location", "/thing")
    .header("date", "Thu, 01 Jan 2026 00:00:00 GMT")
    .header("expires", "Thu, 01 Jan 2026 01:00:00 GMT")
    .header("vary", "Accept-Encoding")
    .header("set-cookie", "sid=1")
    .header("content-length", "4")
    .header("x-private", "drop me");

const main = async (): Promise<void> => {
  const app = new App()
    .get("/thing", cached)
    .get("/weak", () => text("body").header("etag", "W/\"v1\""))
    .get("/stamp", () => text("body").header("last-modified", "Thu, 01 Jan 2026 00:00:00 GMT"))
    .get("/both", () => text("body").header("etag", "\"v1\"").header("last-modified", "Thu, 01 Jan 2026 00:00:00 GMT"))
    .post("/thing", cached)
    .get("/gone", () => fail("gone", 404).header("etag", "\"v1\""));

  const strong = await request(app, "GET", "/thing", { headers: { "if-none-match": "\"v1\"" } });
  eq("a strong match is a 304", String(strong.status), "304");
  eq("the validators and cache headers stay", [strong.headers.get("etag"), strong.headers.get("cache-control"), strong.headers.get("content-location"), strong.headers.get("date"), strong.headers.get("expires"), strong.headers.get("vary"), strong.headers.all("set-cookie")[0]].join(" | "), "\"v1\" | public, max-age=60 | /thing | Thu, 01 Jan 2026 00:00:00 GMT | Thu, 01 Jan 2026 01:00:00 GMT | Accept-Encoding | sid=1");
  eq("content-type, content-length and the rest go", String(strong.headers.has("content-type")) + " " + String(strong.headers.has("content-length")) + " " + String(strong.headers.has("x-private")), "false false false");
  eq("and there is no body", await bodyOf(strong), "");

  eqn("a weak request tag matches a strong one", (await request(app, "GET", "/thing", { headers: { "if-none-match": "W/\"v1\"" } })).status, 304);
  eqn("a strong request tag matches a weak one", (await request(app, "GET", "/weak", { headers: { "if-none-match": "\"v1\"" } })).status, 304);
  eqn("a comma list matches one of its tags", (await request(app, "GET", "/thing", { headers: { "if-none-match": "\"other\", W/\"v1\"" } })).status, 304);
  eqn("an asterisk matches any tag", (await request(app, "GET", "/thing", { headers: { "if-none-match": "*" } })).status, 304);
  const miss = await request(app, "GET", "/thing", { headers: { "if-none-match": "\"other\"" } });
  eq("a mismatch is the 200", String(miss.status) + " " + (await bodyOf(miss)), "200 body");
  const plain = await request(app, "GET", "/thing");
  eq("and no validator at all is no check", String(plain.status) + " " + (await bodyOf(plain)), "200 body");
  eq("a POST is untouched", String((await request(app, "POST", "/thing", { headers: { "if-none-match": "\"v1\"" } })).status), "200");
  eq("a 404 is untouched", String((await request(app, "GET", "/gone", { headers: { "if-none-match": "\"v1\"" } })).status), "404");
  eqn("a HEAD is a 304 too", (await request(app, "HEAD", "/thing", { headers: { "if-none-match": "\"v1\"" } })).status, 304);

  eqn("a last-modified not later than if-modified-since is a 304", (await request(app, "GET", "/stamp", { headers: { "if-modified-since": "Thu, 01 Jan 2026 00:00:00 GMT" } })).status, 304);
  const keptStamp = await request(app, "GET", "/stamp", { headers: { "if-modified-since": "Fri, 02 Jan 2026 00:00:00 GMT" } });
  eq("the 304 from if-modified-since has no body", String(keptStamp.status) + " " + (await bodyOf(keptStamp)), "304 ");
  eqn("a stale if-modified-since is the 200", (await request(app, "GET", "/stamp", { headers: { "if-modified-since": "Wed, 31 Dec 2025 00:00:00 GMT" } })).status, 200);
  eqn("a missing one is the 200", (await request(app, "GET", "/stamp")).status, 200);
  eqn("with an ETag too, if-modified-since still answers when there is no if-none-match", (await request(app, "GET", "/both", { headers: { "if-modified-since": "Fri, 02 Jan 2026 00:00:00 GMT" } })).status, 304);
  eqn("but a non-matching if-none-match wins over it", (await request(app, "GET", "/both", { headers: { "if-none-match": "\"other\"", "if-modified-since": "Fri, 02 Jan 2026 00:00:00 GMT" } })).status, 200);

  let started = false;
  const streamed = new App().get("/events", () =>
    stream(async (out) => {
      started = true;
      await out.write("chunk");
    }, "text/plain").header("etag", "\"s1\"")
  );
  const notRun = await request(streamed, "GET", "/events", { headers: { "if-none-match": "\"s1\"" } });
  eq("a streamed reply's 304", String(notRun.status) + " " + String(notRun.stream === null), "304 true");
  eq("its stream never started", String(started) + " " + (await bodyOf(notRun)), "false ");

  const hooked = new App()
    .onReply((_c: Context, reply: Reply): void => {
      reply.header("etag", "\"hook\"");
    })
    .get("/hooked", () => text("hook body"));
  eqn("an ETag an onReply hook adds is matched", (await request(hooked, "GET", "/hooked", { headers: { "if-none-match": "\"hook\"" } })).status, 304);
  ok("and a miss is still the body", (await bodyOf(await request(hooked, "GET", "/hooked"))) === "hook body");

  done();
};

main();
