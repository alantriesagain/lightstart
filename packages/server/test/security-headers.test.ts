/**
 * @file The SecurityHeaders plugin through the memory adapter: the defaults on every reply and
 * HSTS only over https; each header changed or turned off; CSP and Permissions-Policy given or
 * left off; a route's own header winning; `noSecurityHeaders` opting a route out; 404, 405, 500 and
 * HEAD replies carrying them; a 101 upgrade and a passed reply left sound. Runs under node and
 * natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { MemoryLogger } from "../logger.ts";
import { MemoryIncoming, connect, request } from "../memory/index.ts";
import { Reply, pass, text } from "../reply.ts";
import { Channel, Socket, upgrade } from "../socket.ts";
import { SecurityHeaders, noSecurityHeaders } from "../plugins/security-headers.ts";
import { done, eq, ok } from "@light/test/assert.ts";

class Quiet extends Channel {
  override open(_socket: Socket): void {}

  override message(_socket: Socket, _text: string): void {}

  override binary(_socket: Socket, _data: Uint8Array): void {}

  override close(_socket: Socket, _code: number, _reason: string): void {}
}

const read = (reply: Reply, name: string): string => reply.headers.get(name) ?? "";
const presence = (reply: Reply, names: string[]): string => {
  const out: string[] = [];
  for (const name of names) out.push(name + "=" + read(reply, name));
  return out.join(" | ");
};

const main = async (): Promise<void> => {
  const app = new App().plugin(new SecurityHeaders()).get("/", () => text("ok"));
  const http = await request(app, "GET", "/");
  eq(
    "the defaults are on an http reply",
    presence(http, ["x-content-type-options", "x-frame-options", "referrer-policy", "cross-origin-opener-policy"]),
    "x-content-type-options=nosniff | x-frame-options=SAMEORIGIN | referrer-policy=strict-origin-when-cross-origin | cross-origin-opener-policy=same-origin",
  );
  ok("and HSTS is not", !http.headers.has("strict-transport-security"));
  const https = await request(app, "GET", "/", { protocol: "https" });
  eq("HSTS is on an https reply", read(https, "strict-transport-security"), "max-age=31536000; includeSubDomains");

  const changed = new App()
    .plugin(
      new SecurityHeaders({
        contentTypeOptions: false,
        frameOptions: "DENY",
        referrerPolicy: false,
        openerPolicy: false,
        csp: "default-src 'self'",
        permissionsPolicy: "geolocation=()",
        hsts: "max-age=60",
      }),
    )
    .get("/", () => text("ok"));
  const custom = await request(changed, "GET", "/", { protocol: "https" });
  eq("frameOptions changes the value", read(custom, "x-frame-options"), "DENY");
  ok("contentTypeOptions false turns it off", !custom.headers.has("x-content-type-options"));
  ok("referrerPolicy false turns it off", !custom.headers.has("referrer-policy"));
  ok("openerPolicy false turns it off", !custom.headers.has("cross-origin-opener-policy"));
  eq("csp is sent when given", read(custom, "content-security-policy"), "default-src 'self'");
  eq("permissionsPolicy is sent when given", read(custom, "permissions-policy"), "geolocation=()");
  eq("hsts is the string given", read(custom, "strict-transport-security"), "max-age=60");

  const noHsts = new App().plugin(new SecurityHeaders({ hsts: false })).get("/", () => text("ok"));
  ok("hsts false turns it off over https", !(await request(noHsts, "GET", "/", { protocol: "https" })).headers.has("strict-transport-security"));
  const off = new App().plugin(new SecurityHeaders({ csp: false, permissionsPolicy: false })).get("/", () => text("ok"));
  const plain = await request(off, "GET", "/");
  ok("csp and permissionsPolicy stay off by default", !plain.headers.has("content-security-policy") && !plain.headers.has("permissions-policy"));

  const own = new App()
    .plugin(new SecurityHeaders())
    .get("/", () => text("ok").header("x-frame-options", "DENY").header("referrer-policy", "no-referrer"));
  const winning = await request(own, "GET", "/");
  eq("a route's own header wins", read(winning, "x-frame-options") + " | " + read(winning, "referrer-policy"), "DENY | no-referrer");
  eq("the others are still added", read(winning, "x-content-type-options"), "nosniff");

  const opted = new App()
    .plugin(new SecurityHeaders())
    .get("/embed", () => text("embed"), [noSecurityHeaders])
    .get("/page", () => text("page"));
  const embed = await request(opted, "GET", "/embed");
  ok("noSecurityHeaders leaves a route without them", !embed.headers.has("x-content-type-options") && !embed.headers.has("x-frame-options"));
  eq("and another route still has them", read(await request(opted, "GET", "/page"), "x-content-type-options"), "nosniff");

  const notFound = await request(app, "GET", "/missing");
  eq("a 404 carries them", String(notFound.status) + " " + read(notFound, "x-content-type-options"), "404 nosniff");
  const notAllowed = await request(app, "POST", "/");
  eq("a 405 carries them", String(notAllowed.status) + " " + read(notAllowed, "x-frame-options"), "405 SAMEORIGIN");
  const broken = new App()
    .logTo(new MemoryLogger())
    .plugin(new SecurityHeaders())
    .get("/broken", (): Reply => {
      throw new Error("the database is on fire");
    });
  const failed = await request(broken, "GET", "/broken");
  eq("a 500 carries them", String(failed.status) + " " + read(failed, "referrer-policy"), "500 strict-origin-when-cross-origin");
  const head = await request(app, "HEAD", "/");
  eq("a HEAD reply carries them", String(head.status) + " " + read(head, "x-content-type-options"), "200 nosniff");

  const sockets = new App().plugin(new SecurityHeaders()).get("/ws", (c: Context) => upgrade(c, new Quiet()));
  const client = await connect(sockets, "/ws");
  eq("a 101 upgrade carries them and still opens", String(client.reply.status) + " " + read(client.reply, "x-content-type-options") + " " + String(client.open), "101 nosniff true");

  const passing = new App().plugin(new SecurityHeaders()).get("/pass", () => pass());
  const handled = await passing.handle(new Context(new MemoryIncoming("GET", "/pass", {})));
  ok("a passed reply is not finished", handled === null);

  done();
};

main();
