/**
 * @file The dev server's websockets: route apps get first claim on an upgrade, and every socket
 * none of them takes is a reload client the server broadcasts file changes to.
 */
import type { IncomingMessage, Server } from "node:http";
import type { Socket as NetSocket } from "node:net";
import { Channel, Context, type Socket, upgrade } from "@lightstart/server";
import { Sockets, UpgradeIncoming } from "@lightstart/server/node";
import type { App } from "@lightstart/server";

/** The reload clients, and one close for every socket the server took. */
export type SocketServer = {
  broadcast(message: object): void;
  close(): void;
};

class ReloadClients extends Channel {
  readonly clients = new Set<Socket>();

  override open(socket: Socket): void {
    this.clients.add(socket);
  }

  override close(socket: Socket): void {
    this.clients.delete(socket);
  }
}

/** Takes the server's upgrades: the route apps' first, the rest joining the reload set. Every socket is pinged every 30 seconds. */
export const attachSockets = (server: Server, apps: readonly App[]): SocketServer => {
  const sockets = new Sockets({ idle: 30000 });
  const clients = new ReloadClients();
  server.on("upgrade", (req: IncomingMessage, socket: NetSocket, head: Buffer) => {
    void (async () => {
      for (const app of apps) {
        if (await sockets.answer(app, new UpgradeIncoming(req, socket, sockets.tracker), head)) return;
      }
      const c = new Context(new UpgradeIncoming(req, socket));
      sockets.take(c, upgrade(c, clients), head);
    })().catch(() => socket.destroy());
  });
  return {
    broadcast: (message: object) => {
      const data = JSON.stringify(message);
      for (const client of clients.clients) client.send(data);
    },
    close: () => sockets.close(),
  };
};
