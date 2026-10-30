// node-only
/**
 * @file A client that resets its connection (a TCP RST) while the route for
 * its upgrade is still answering: the server drops the connection and keeps
 * serving, where an unwatched socket error would end the process. Node only,
 * since only node's `resetAndDestroy` sends a reset.
 */
import { connect as dial } from "node:net";
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { MemoryLogger } from "../logger.ts";
import { Channel, upgrade } from "../socket.ts";
import { text } from "../reply.ts";
import { serve } from "../node/index.ts";
import { done, ok } from "@light/test/assert.ts";

const later = (ms: number): Promise<void> => new Promise<void>((resolve: () => void) => {
  setTimeout(resolve, ms);
});

const app = new App()
  .logTo(new MemoryLogger())
  .get("/slow", async (c: Context) => {
    await later(60);
    return upgrade(c, new Channel());
  })
  .get("/health", () => text("ok"));

const main = async (): Promise<void> => {
  const server = await serve(app, { port: 0, host: "127.0.0.1", sockets: {} });
  const client = dial(server.port, "127.0.0.1");
  await new Promise<void>((resolve: () => void) => { client.once("connect", resolve); });
  client.write("GET /slow HTTP/1.1\r\nhost: 127.0.0.1\r\nupgrade: websocket\r\nconnection: Upgrade\r\nsec-websocket-key: dGhlIHNhbXBsZSBub25jZQ==\r\nsec-websocket-version: 13\r\n\r\n");
  await later(10);
  client.resetAndDestroy();
  await later(150);
  const answer = await fetch(`http://127.0.0.1:${server.port}/health`);
  ok("a client that resets while its upgrade is routed costs the server nothing", answer.status === 200);
  await server.close();
  done();
};

main();
