/**
 * @file The SameOrigin plugin through the memory adapter: an unsafe method refused when the
 * request is cross-origin and let through when it is same-origin or carries no Origin; a safe
 * method unaffected; a websocket upgrade checked too, and left alone with `upgrades: false`; a
 * custom method set. Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { Reply, text } from "../reply.ts";
import { bodyOf, connect, request } from "../memory/index.ts";
import { Channel, Socket, upgrade } from "../socket.ts";
import { SameOrigin } from "../plugins/same-origin.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

class Quiet extends Channel {
  override open(_socket: Socket): void {}

  override message(_socket: Socket, _text: string): void {}

  override binary(_socket: Socket, _data: Uint8Array): void {}

  override close(_socket: Socket, _code: number, _reason: string): void {}
}

const status = async (app: App, method: string, target: string, headers: Record<string, string>): Promise<number> =>
  (await request(app, method, target, { headers })).status;

const main = async (): Promise<void> => {
  const app = new App()
    .plugin(new SameOrigin())
    .get("/read", (): Reply => text("read"))
    .post("/write", (): Reply => text("write"))
    .put("/write", (): Reply => text("put"))
    .delete("/write", (): Reply => text("delete"))
    .get("/ws", (c: Context) => upgrade(c, new Quiet()));

  eqn("a POST with no Origin passes", await status(app, "POST", "/write", {}), 200);
  eqn("a POST from the same origin passes", await status(app, "POST", "/write", { host: "shop.example", origin: "https://shop.example" }), 200);
  const refused = await request(app, "POST", "/write", { headers: { host: "shop.example", origin: "https://evil.example" } });
  eqn("a cross-origin POST is refused", refused.status, 403);
  eq("with the refusal's message", await bodyOf(refused), "{\"error\":\"cross-origin request refused\"}");
  eqn("PUT is refused too", await status(app, "PUT", "/write", { origin: "https://evil.example" }), 403);
  eqn("and DELETE", await status(app, "DELETE", "/write", { origin: "https://evil.example" }), 403);
  eqn("a GET passes whatever its Origin", await status(app, "GET", "/read", { origin: "https://evil.example" }), 200);
  eqn("Sec-Fetch-Site: cross-site is refused even with a matching Origin", await status(app, "POST", "/write", { host: "shop.example", origin: "https://shop.example", "sec-fetch-site": "cross-site" }), 403);

  const plain = await connect(app, "/ws");
  ok("an upgrade with no Origin is accepted", plain.open && plain.reply.status === 101);
  const forged = await connect(app, "/ws", { headers: { origin: "https://evil.example" } });
  eqn("a cross-origin upgrade is refused", forged.reply.status, 403);
  ok("and the connection is not open", !forged.open);

  const permissive = new App().plugin(new SameOrigin({ upgrades: false })).get("/ws", (c: Context) => upgrade(c, new Quiet()));
  ok("with upgrades: false a cross-origin upgrade is accepted", (await connect(permissive, "/ws", { headers: { origin: "https://evil.example" } })).open);

  const narrow = new App().plugin(new SameOrigin({ methods: ["POST"] })).post("/x", (): Reply => text("x")).put("/x", (): Reply => text("x"));
  eqn("a custom method set still refuses POST", await status(narrow, "POST", "/x", { origin: "https://evil.example" }), 403);
  eqn("and leaves PUT alone", await status(narrow, "PUT", "/x", { origin: "https://evil.example" }), 200);

  done();
};

main();
