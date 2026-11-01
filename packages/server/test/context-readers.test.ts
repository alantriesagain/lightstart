/**
 * @file The readers on `Context` that parse a header or the body on the first call: cookies
 * (duplicates, quotes and percent-escapes), the bearer token's variants, the same-origin check
 * against `Sec-Fetch-Site`, `Origin`, ports and a trusted proxy, the urlencoded form (plus as
 * space, percent-decoding, repeated names, a malformed escape, the wrong type and the body limit),
 * and content negotiation over `Accept` (q-values, wildcards, specificity, q=0, no header).
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { Reply, text } from "../reply.ts";
import { bodyOf, request } from "../memory/index.ts";
import { TrustProxy } from "../plugins/proxy.ts";
import { done, eq, eqn } from "@light/test/assert.ts";

const cookie = (c: Context): Reply =>
  text(
    [
      c.cookie("a") ?? "null",
      c.cookie("b") ?? "null",
      c.cookie("c") ?? "null",
      c.cookie("missing") ?? "null",
      String(c.cookies().size),
    ].join("|"),
  );

const bearer = (c: Context): Reply => text(c.bearer() ?? "null");

const origin = (c: Context): Reply => text(c.sameOrigin() ? "yes" : "no");

const form = async (c: Context): Promise<Reply> => {
  const parsed = await c.form();
  const names = ["a", "b", "dup", "empty"];
  const out: string[] = [];
  for (const name of names) {
    const values = parsed.get(name);
    out.push(name + "=" + (values === undefined ? "none" : values.join(",")));
  }
  return text(out.join("|"));
};

const limited = async (c: Context): Promise<Reply> => {
  c.limit = 5;
  const parsed = await c.form();
  return text(String(parsed.size));
};

const negotiated = (c: Context): Reply => text(c.accepts("application/json", "text/html") ?? "null");

const three = (c: Context): Reply => text(c.accepts("application/json", "text/html", "text/plain") ?? "null");

const none = (c: Context): Reply => text(c.accepts() ?? "null");

const main = async (): Promise<void> => {
  const readers = new App()
    .get("/cookies", cookie)
    .get("/bearer", bearer)
    .get("/origin", origin)
    .post("/form", form)
    .post("/small", limited)
    .get("/negotiated", negotiated)
    .get("/three", three)
    .get("/none", none);

  eq(
    "cookies strip quotes, keep the first duplicate and percent-decode",
    await bodyOf(await request(readers, "GET", "/cookies", { headers: { cookie: "a=1; b=\"two words\"; a=first; c=%41" } })),
    "1|two words|A|null|3",
  );
  eq("no Cookie header is an empty map", await bodyOf(await request(readers, "GET", "/cookies")), "null|null|null|null|0");

  const auth = async (value: string): Promise<string> => bodyOf(await request(readers, "GET", "/bearer", { headers: { authorization: value } }));
  eq("a bearer token", await auth("Bearer abc"), "abc");
  eq("the scheme is case-insensitive and the token trimmed", await auth("bEaReR   tok  "), "tok");
  eq("another scheme is no bearer", await auth("Basic abc"), "null");
  eq("a scheme without a token is no bearer", await auth("Bearer"), "null");
  eq("a blank token is no bearer", await auth("Bearer    "), "null");
  eq("no Authorization header is no bearer", await bodyOf(await request(readers, "GET", "/bearer")), "null");

  const same = async (target: string, headers: Record<string, string>): Promise<string> => bodyOf(await request(readers, "GET", target, { headers }));
  eq("no headers is same-origin", await same("/origin", {}), "yes");
  eq("Sec-Fetch-Site: same-origin", await same("/origin", { "sec-fetch-site": "same-origin" }), "yes");
  eq("Sec-Fetch-Site: none", await same("/origin", { "sec-fetch-site": "none" }), "yes");
  eq("Sec-Fetch-Site: same-site is not", await same("/origin", { "sec-fetch-site": "same-site" }), "no");
  eq("Sec-Fetch-Site: cross-site is not, a matching Origin included", await same("/origin", { "sec-fetch-site": "cross-site", origin: "http://localhost" }), "no");
  eq("an Origin matching the host", await same("/origin", { host: "shop.example", origin: "https://shop.example" }), "yes");
  eq("the scheme does not matter", await same("/origin", { host: "shop.example", origin: "http://shop.example" }), "yes");
  eq("an Origin with another host", await same("/origin", { host: "shop.example", origin: "https://evil.example" }), "no");
  eq("a matching port", await same("/origin", { host: "shop.example:8443", origin: "https://shop.example:8443" }), "yes");
  eq("another port", await same("/origin", { host: "shop.example:8443", origin: "https://shop.example:443" }), "no");
  eq("Origin: null is cross-origin", await same("/origin", { origin: "null" }), "no");
  eq("a malformed Origin", await same("/origin", { origin: "not a url" }), "no");
  eq("an Origin with a path", await same("/origin", { origin: "https://shop.example/path" }), "no");

  const trusted = new App().plugin(new TrustProxy({ trust: true })).get("/origin", origin);
  eq(
    "the host a trusted proxy forwarded is the one matched",
    await bodyOf(await request(trusted, "GET", "/origin", { address: "10.0.0.7", headers: { host: "internal.example", "x-forwarded-host": "shop.example", origin: "https://shop.example" } })),
    "yes",
  );
  eq(
    "and a mismatch is still cross-origin",
    await bodyOf(await request(trusted, "GET", "/origin", { address: "10.0.0.7", headers: { host: "shop.example", "x-forwarded-host": "shop.example", origin: "https://evil.example" } })),
    "no",
  );

  const type = { "content-type": "application/x-www-form-urlencoded" };
  eq(
    "a form decodes plus, percent-escapes and repeated names",
    await bodyOf(await request(readers, "POST", "/form", { headers: type, body: "a=hello+world&b=%41%42&dup=1&dup=2&empty" })),
    "a=hello world|b=AB|dup=1,2|empty=",
  );
  eq(
    "a charset parameter is fine",
    await bodyOf(await request(readers, "POST", "/form", { headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" }, body: "a=1" })),
    "a=1|b=none|dup=none|empty=none",
  );
  eqn("a malformed escape is a 400", (await request(readers, "POST", "/form", { headers: type, body: "a=%ZZ" })).status, 400);
  eqn("another content type is a 415", (await request(readers, "POST", "/form", { headers: { "content-type": "text/plain" }, body: "a=1" })).status, 415);
  eqn("no content type is a 415", (await request(readers, "POST", "/form", { body: "a=1" })).status, 415);
  eqn("a body over the limit is a 413", (await request(readers, "POST", "/small", { headers: type, body: "a=123456" })).status, 413);

  const accept = async (value: string, target = "/negotiated"): Promise<string> => bodyOf(await request(readers, "GET", target, { headers: { accept: value } }));
  eq("no Accept header is the first type", await bodyOf(await request(readers, "GET", "/negotiated")), "application/json");
  eq("the only one acceptable", await accept("text/html"), "text/html");
  eq("q-values pick the higher", await accept("text/html;q=0.5, application/json;q=0.9"), "application/json");
  eq("a type wildcard", await accept("text/*"), "text/html");
  eq("a full wildcard is the first type", await accept("*/*"), "application/json");
  eq("the more specific range wins a tie", await accept("*/*;q=0.8, application/json;q=0.8"), "application/json");
  eq("q=0 excludes a type", await accept("application/json;q=0, text/html"), "text/html");
  eq("only a q=0 type is nothing", await accept("application/json;q=0"), "null");
  eq("nothing acceptable", await accept("application/xml"), "null");
  eq("a third type", await accept("text/plain", "/three"), "text/plain");
  eq("no types at all is null", await bodyOf(await request(readers, "GET", "/none", { headers: { accept: "*/*" } })), "null");

  done();
};

main();
