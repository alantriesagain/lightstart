/**
 * @file safeRedirect through the memory adapter: a same-origin path, and an absolute http(s) URL
 * to the request's host (a trusted proxy's forwarded host included), is written as it arrived;
 * a protocol-relative or backslash target, another scheme, leading whitespace or a control
 * character, userinfo, another host and an empty target answer the fallback. The status and a
 * custom fallback are checked too. Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { Reply } from "../reply.ts";
import { safeRedirect } from "../redirect.ts";
import { request } from "../memory/index.ts";
import { TrustProxy } from "../plugins/proxy.ts";
import { done, eq, eqn } from "@light/test/assert.ts";

const go = (c: Context): Reply => {
  const target = c.header("x-target") ?? "";
  const fallback = c.header("x-fallback") ?? "/";
  const status = Number(c.header("x-status") ?? "302");
  return safeRedirect(c, target, fallback, status);
};

const drive = (app: App, target: string, host: string, fallback: string, status: number, extra: Record<string, string>): Promise<Reply> => {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(extra)) headers[name] = value;
  headers["host"] = host;
  headers["x-target"] = target;
  headers["x-fallback"] = fallback;
  headers["x-status"] = String(status);
  return request(app, "GET", "/go", { headers });
};

const location = (reply: Reply): string => reply.headers.get("location") ?? "(none)";

const main = async (): Promise<void> => {
  const app = new App().get("/go", go);

  const allowed = async (name: string, target: string, host = "shop.example"): Promise<void> => {
    const reply = await drive(app, target, host, "/fallback", 302, {});
    eq(name, location(reply), target);
    eqn(name + ", 302", reply.status, 302);
  };

  const refused = async (name: string, target: string, host = "shop.example"): Promise<void> => {
    const reply = await drive(app, target, host, "/fallback", 302, {});
    eq(name, location(reply), "/fallback");
    eqn(name + ", 302", reply.status, 302);
  };

  await allowed("a same-origin path", "/x");
  await allowed("a same-origin path with a query and a fragment", "/x?y#z");
  await allowed("the root", "/");
  await allowed("an absolute http URL to the host", "http://shop.example");
  await allowed("an absolute https URL to the host with a path", "https://shop.example/x");
  await allowed("the scheme is case-insensitive", "HtTpS://shop.example/x");
  await allowed("a matching port", "https://shop.example:8443/x", "shop.example:8443");

  await refused("a protocol-relative target", "//evil.example");
  await refused("a backslash after the slash", "/\\evil.example");
  await refused("two backslashes", "\\\\evil");
  await refused("javascript:", "javascript:alert(1)");
  await refused("data:", "data:text/html,x");
  await refused("mailto:", "mailto:a@shop.example");
  await refused("leading whitespace", " /x");
  await refused("leading tab", "\t/x");
  await refused("leading newline", "\nhttps://shop.example/x");
  await refused("another host", "https://evil.example/x");
  await refused("userinfo on the matching host", "http://a@shop.example/x");
  await refused("userinfo on another host", "http://a@evil.example");
  await refused("a relative target that is not a path", "evil.example");
  await refused("an empty target", "");

  const custom = await drive(app, "/x", "shop.example", "/fallback", 303, {});
  eq("a custom status on an allowed target", location(custom), "/x");
  eqn("a custom status on an allowed target, 303", custom.status, 303);

  const customFallback = await drive(app, "//evil.example", "shop.example", "/login", 307, {});
  eq("a custom fallback for a refused target", location(customFallback), "/login");
  eqn("a custom fallback for a refused target, 307", customFallback.status, 307);

  const proxied = new App().plugin(new TrustProxy({ trust: true })).get("/go", go);
  const forwarded = await drive(proxied, "https://shop.example/x", "internal.example", "/fallback", 302, { "x-forwarded-host": "shop.example" });
  eq("the host a trusted proxy forwarded is the one matched", location(forwarded), "https://shop.example/x");
  const mismatch = await drive(proxied, "https://internal.example/x", "internal.example", "/fallback", 302, { "x-forwarded-host": "shop.example" });
  eq("the connection's own host is not, behind the proxy", location(mismatch), "/fallback");

  done();
};

main();
