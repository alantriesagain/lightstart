/**
 * @file The Lambda adapter over recorded version 2.0 events: a GET with a query, its headers and its
 * cookies; a POST whose body came base64; the source address; every `set-cookie` in `cookies`,
 * the other headers joined; a bytes reply as base64 and a JSON one as text; a streamed reply
 * collected; a HEAD with no body; the work handed to `waitUntil` done before the result returns.
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { Reply, bytes, json, stream, text } from "../reply.ts";
import { toLambda, type LambdaEvent } from "../lambda/index.ts";
import { done, eq, ok } from "@light/test/assert.ts";

class Journal {
  lines: string[] = [];
}

const event = (method: string, rawPath: string, rawQueryString: string, extra: { body?: string; isBase64Encoded?: boolean; cookies?: string[] }): LambdaEvent => ({
  rawPath,
  rawQueryString,
  headers: { "user-agent": "curl/8", "content-type": "application/json", accept: "*/*" },
  cookies: extra.cookies,
  body: extra.body,
  isBase64Encoded: extra.isBase64Encoded,
  requestContext: { domainName: "abc123.lambda-url.us-east-1.on.aws", http: { method, sourceIp: "198.51.100.7" } },
});

const main = async (): Promise<void> => {
  const journal = new Journal();
  const app = new App()
    .get("/items/:id", (c: Context) => json({ id: c.param("id"), sort: c.query("sort"), ua: c.header("user-agent"), cookie: c.header("cookie"), ip: c.ip, url: c.url }))
    .post("/upload", async (c: Context): Promise<Reply> => json({ got: await c.json() }, 201))
    .get("/login", () => {
      const reply = text("in");
      reply.headers.append("set-cookie", "session=s1; HttpOnly");
      reply.headers.append("set-cookie", "theme=dark");
      reply.headers.append("vary", "accept");
      reply.headers.append("vary", "origin");
      return reply;
    })
    .get("/png", () => bytes(new Uint8Array([137, 80, 78, 71]), "image/png"))
    .get("/stream", () =>
      stream(async (out) => {
        await out.write("a");
        await out.write("b");
      }, "text/plain"),
    )
    .post("/later", (c: Context) => {
      c.waitUntil(new Promise<void>((resolve: () => void) => {
        setTimeout(() => {
          journal.lines.push("flushed");
          resolve();
        }, 10);
      }));
      return text("queued", 202);
    });
  const handler = toLambda(app);

  const got = await handler(event("GET", "/items/42", "sort=desc", { cookies: ["a=1", "b=2"] }));
  eq("a GET with its query, headers, cookies and source address", String(got.statusCode) + " " + got.body, "200 {\"id\":\"42\",\"sort\":\"desc\",\"ua\":\"curl/8\",\"cookie\":\"a=1; b=2\",\"ip\":\"198.51.100.7\",\"url\":\"https://abc123.lambda-url.us-east-1.on.aws/items/42?sort=desc\"}");
  ok("a JSON reply goes back as text", !got.isBase64Encoded);

  const posted = await handler(event("POST", "/upload", "", { body: Buffer.from("{\"n\":7}").toString("base64"), isBase64Encoded: true }));
  eq("a base64 body is decoded", String(posted.statusCode) + " " + posted.body, "201 {\"got\":{\"n\":7}}");

  const login = await handler(event("GET", "/login", "", {}));
  eq("every set-cookie goes in cookies", login.cookies.join(" | "), "session=s1; HttpOnly | theme=dark");
  eq("the other headers are joined", login.headers["vary"] ?? "", "accept, origin");
  ok("set-cookie is not among the headers", login.headers["set-cookie"] === undefined);

  const png = await handler(event("GET", "/png", "", {}));
  eq("a bytes reply goes back base64", String(png.isBase64Encoded) + " " + png.body, "true iVBORw==");
  eq("a streamed reply is collected", (await handler(event("GET", "/stream", "", {}))).body, "ab");
  const head = await handler(event("HEAD", "/login", "", {}));
  eq("a HEAD has no body", String(head.statusCode) + " [" + head.body + "]", "200 []");

  const queued = await handler(event("POST", "/later", "", {}));
  eq("the work handed to waitUntil is done before the result returns", String(queued.statusCode) + " " + journal.lines.join(","), "202 flushed");
  done();
};

main();
