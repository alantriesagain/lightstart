/**
 * @file Cookies: `parseCookies` over the edge cases of a `Cookie` header (quotes, `=` in a value,
 * percent-decoding that fails, duplicates, empty names); `setCookie`'s exact lines, its defaults
 * and every option, several cookies on one reply, `clearCookie`; the name-token and prefix rules
 * (`__Host-`, `__Secure-`, `SameSite=None`) refusing an unsafe cookie; and `"auto"` Secure settled
 * by the app where it finishes a reply, over https and not over http, on a route's reply, an
 * `onRequest` answer, a 405, an error and the not-found reply, and with a reply hook removing a
 * header ahead of the cookie.
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { MemoryLogger } from "../logger.ts";
import { Reply, text } from "../reply.ts";
import { clearCookie, parseCookies, setCookie, type CookieOptions } from "../cookies.ts";
import { request } from "../memory/index.ts";
import { done, eq, eqn, ok, throws } from "@light/test/assert.ts";

const main = async (): Promise<void> => {
  eqn("no header is no cookie", parseCookies(null).size, 0);
  eq("two pairs", parseCookies("a=1; b=2").get("b") ?? "", "2");
  eq("a quoted empty value is empty", parseCookies("a=\"\"").get("a") ?? "fallback", "");
  eq("and a quoted value keeps its spaces", parseCookies("q=\"hello world\"").get("q") ?? "", "hello world");
  eq("a value may hold =", parseCookies("token=abc==; eq=a=b=c").get("eq") ?? "", "a=b=c");
  eq("percent-encoding is decoded", parseCookies("name=hello%20there").get("name") ?? "", "hello there");
  eq("bad percent-encoding keeps the raw value", parseCookies("bad=%E0%A4%A; ok=1").get("bad") ?? "", "%E0%A4%A");
  eq("the first occurrence wins", parseCookies("a=1; a=2").get("a") ?? "", "1");
  eq("an empty name is skipped", String(parseCookies("=gone; ; ok=; kept=yes").size), "2");
  eq("an empty value is kept", parseCookies("ok=").get("ok") ?? "missing", "");
  eq("names and values are trimmed", parseCookies(" spaced = value ").get("spaced") ?? "", "value");
  eq("a plus is literal in a cookie value", parseCookies("plus=x+y").get("plus") ?? "", "x+y");
  ok("an empty pair adds nothing", !parseCookies("=gone; ; ok=; kept=yes").has(""));

  const defaults = setCookie(new Reply(200), "id", "abc");
  eq("the defaults are Path=/, HttpOnly and SameSite=Lax", defaults.headers.all("set-cookie")[0] ?? "", "id=abc; Path=/; HttpOnly; SameSite=Lax");
  const encoded = setCookie(new Reply(200), "id", "a b;/");
  eq("the value is percent-encoded", encoded.headers.all("set-cookie")[0] ?? "", "id=a%20b%3B%2F; Path=/; HttpOnly; SameSite=Lax");
  const expires = new Date(60000);
  const all = setCookie(new Reply(200), "token", "abc", {
    maxAge: 60,
    expires: expires,
    path: "/x",
    domain: "example.com",
    httpOnly: false,
    secure: true,
    sameSite: "Strict",
    partitioned: true,
  });
  eq(
    "every option writes its attribute",
    all.headers.all("set-cookie")[0] ?? "",
    "token=abc; Path=/x; Domain=example.com; Max-Age=60; Expires=" + expires.toUTCString() + "; Secure; SameSite=Strict; Partitioned",
  );
  const two = setCookie(setCookie(new Reply(200), "a", "1"), "b", "2");
  eq("two cookies on one reply stay two headers", String(two.headers.all("set-cookie").length), "2");
  eq("the second is its own line", two.headers.all("set-cookie")[1] ?? "", "b=2; Path=/; HttpOnly; SameSite=Lax");
  const cleared = clearCookie(new Reply(200), "id");
  eq("clearCookie empties the value and expires it", cleared.headers.all("set-cookie")[0] ?? "", "id=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  const kept = clearCookie(new Reply(200), "id", { path: "/x", domain: "example.com" });
  eq("clearCookie keeps the path and domain given", kept.headers.all("set-cookie")[0] ?? "", "id=; Path=/x; Domain=example.com; Max-Age=0; HttpOnly; SameSite=Lax");

  const host: CookieOptions = { path: "/", secure: "auto" };
  eq("a __Host- cookie over auto Secure is accepted", setCookie(new Reply(200), "__Host-sid", "1", host).headers.all("set-cookie")[0] ?? "", "__Host-sid=1; Path=/; HttpOnly; SameSite=Lax");
  eq("a __Secure- cookie over auto Secure is accepted", setCookie(new Reply(200), "__Secure-sid", "1").headers.all("set-cookie")[0] ?? "", "__Secure-sid=1; Path=/; HttpOnly; SameSite=Lax");
  throws("a name that is not a token is refused", () => {
    setCookie(new Reply(200), "bad name", "1");
  }, "not an RFC 6265 token");
  throws("__Host- refuses secure: false", () => {
    setCookie(new Reply(200), "__Host-sid", "1", { secure: false });
  }, "requires Secure");
  throws("__Host- refuses a path other than /", () => {
    setCookie(new Reply(200), "__Host-sid", "1", { path: "/sub" });
  }, "Path=/");
  throws("__Host- refuses a domain", () => {
    setCookie(new Reply(200), "__Host-sid", "1", { domain: "example.com" });
  }, "no Domain");
  throws("__Secure- refuses secure: false", () => {
    setCookie(new Reply(200), "__Secure-sid", "1", { secure: false });
  }, "requires Secure");
  throws("SameSite=None refuses secure: false", () => {
    setCookie(new Reply(200), "sid", "1", { sameSite: "None", secure: false });
  }, "requires Secure");
  eq("SameSite=None with secure: true is written", setCookie(new Reply(200), "sid", "1", { sameSite: "None", secure: true }).headers.all("set-cookie")[0] ?? "", "sid=1; Path=/; HttpOnly; Secure; SameSite=None");

  const app = new App().get("/set", () => setCookie(text("ok"), "sid", "v"));
  const overTls = await request(app, "GET", "/set", { protocol: "https" });
  eq("auto Secure is settled over https", overTls.headers.all("set-cookie")[0] ?? "", "sid=v; Path=/; HttpOnly; SameSite=Lax; Secure");
  const plain = await request(app, "GET", "/set", { protocol: "http" });
  eq("and not over http", plain.headers.all("set-cookie")[0] ?? "", "sid=v; Path=/; HttpOnly; SameSite=Lax");
  const fixed = new App()
    .get("/on", () => setCookie(text("ok"), "sid", "v", { secure: true }))
    .get("/off", () => setCookie(text("ok"), "sid", "v", { secure: false }));
  eq("secure: true is written on http", (await request(fixed, "GET", "/on")).headers.all("set-cookie")[0] ?? "", "sid=v; Path=/; HttpOnly; Secure; SameSite=Lax");
  eq("secure: false is not written on https", (await request(fixed, "GET", "/off", { protocol: "https" })).headers.all("set-cookie")[0] ?? "", "sid=v; Path=/; HttpOnly; SameSite=Lax");

  const every = new App()
    .logTo(new MemoryLogger())
    .onRequest((c: Context): Reply | null => (c.path === "/early" ? setCookie(text("early"), "early", "1") : null))
    .onReply((_c: Context, reply: Reply): void => {
      setCookie(reply, "seen", "1");
    })
    .get("/only", () => text("ok"))
    .get("/boom", (): Reply => {
      throw new Error("boom");
    });
  const early = await request(every, "GET", "/early", { protocol: "https" });
  eq("an onRequest answer settles auto Secure", early.headers.all("set-cookie")[0] ?? "", "early=1; Path=/; HttpOnly; SameSite=Lax; Secure");
  const reply = await request(every, "GET", "/only", { protocol: "https" });
  eq("an onReply cookie on a route's reply", reply.headers.all("set-cookie")[0] ?? "", "seen=1; Path=/; HttpOnly; SameSite=Lax; Secure");
  const method = await request(every, "POST", "/only", { protocol: "https" });
  eq("a 405 settles it too", String(method.status) + " " + (method.headers.all("set-cookie")[0] ?? ""), "405 seen=1; Path=/; HttpOnly; SameSite=Lax; Secure");
  const fault = await request(every, "GET", "/boom", { protocol: "https" });
  eq("so does an error's reply", String(fault.status) + " " + (fault.headers.all("set-cookie")[0] ?? ""), "500 seen=1; Path=/; HttpOnly; SameSite=Lax; Secure");
  const missing = await request(every, "GET", "/missing", { protocol: "https" });
  eq("and the not-found reply", String(missing.status) + " " + (missing.headers.all("set-cookie")[0] ?? ""), "404 seen=1; Path=/; HttpOnly; SameSite=Lax; Secure");
  const notTls = await request(every, "GET", "/missing", { protocol: "http" });
  eq("the not-found reply over http has no Secure", notTls.headers.all("set-cookie")[0] ?? "", "seen=1; Path=/; HttpOnly; SameSite=Lax");

  const shifted = new App()
    .onReply((_c: Context, reply: Reply): void => {
      reply.headers.delete("x-before");
    })
    .get("/shift", () => setCookie(text("ok").header("x-before", "1"), "sid", "v"));
  const moved = await request(shifted, "GET", "/shift", { protocol: "https" });
  eq("a hook removing a header ahead of the cookie leaves it settled", moved.headers.all("set-cookie")[0] ?? "", "sid=v; Path=/; HttpOnly; SameSite=Lax; Secure");
  eq("and the header gone", moved.headers.get("x-before") ?? "gone", "gone");

  done();
};

await main();
