/**
 * @file Dev-server peer relay: room-scoped WebSocket forwarding on `/_relay`,
 * the "relay" signaling and transport strategy behind `strategy.js`. Unlike
 * the tools bridge (node -> one tab), this hub pairs browsers with each
 * other: peers join a room with a shared secret and every `data` frame is
 * forwarded to its target peer (or broadcast) verbatim.
 *
 * Wire (JSON strings):
 *   C->S { t: "join", roomId, peerId, auth }
 *   S->C { t: "joined", peers } | { t: "error", code }
 *   S->C { t: "peer-joined", peerId } | { t: "peer-left", peerId }
 *   C->S { t: "data", action, payload, to? } -> S->C { t: "data", action, payload, from }
 *   C->S { t: "leave" }
 *
 * Threat model: a dev/LAN tool. The first joiner's `auth` becomes the room
 * key and gates every later join; data frames are NOT end-to-end encrypted
 * (plain ws on a LAN is plaintext regardless: off-LAN use rides an HTTPS
 * tunnel, and untrusted networks should use the torrent/WebRTC strategy).
 *
 * `GET /_relay/info` advertises the strategy plus the origins a phone can
 * actually reach (`--host 0.0.0.0` / `--tunnel` feed `setOrigins`).
 *
 * `POST /_relay/pair` lets a host publish its current pairing payload and
 * the path guests land on; `GET /_relay/pair` hands it to LAN visitors only
 * while the host's room is actually live: the zero-QR auto-pair path.
 * Approval on the host is still the gate; holding the payload only lets a
 * device ask to join.
 *
 * Each connection is a `@lightstart/server` channel (`channel()`), whose
 * socket the dev server keeps alive: it pings every socket and drops one that
 * stops answering, which the room hears as `peer-left`.
 */

import { Channel, type Socket } from "@lightstart/server";

type Peer = { peerId: string; socket: Socket };
type Room = { auth: string; peers: Map<string, Peer> };
type Frame = { t?: string; roomId?: string; peerId?: string; auth?: string; action?: string; payload?: unknown; to?: string };

export type RelayHub = ReturnType<typeof createRelayHub>;

/** A hub over its rooms, reachable origins and published pair payload. */
export const createRelayHub = (log?: { debug?: (msg: string) => void }) => {
  const rooms = new Map<string, Room>();
  const origins: { lan?: string; tunnel?: string } = {};
  let pair: { payload: string; roomId: string; path: string } | null = null;

  const send = (socket: Socket, message: object): void => socket.send(JSON.stringify(message));

  const drop = (roomId: string, peerId: string): void => {
    const room = rooms.get(roomId);
    if (!room || !room.peers.delete(peerId)) return;
    for (const other of room.peers.values()) send(other.socket, { t: "peer-left", peerId });
    if (room.peers.size === 0) rooms.delete(roomId);
  };

  /** One connection's side of the hub: the room it joined, and the frames it sends. */
  class Connection extends Channel {
    joined: { roomId: string; peerId: string } | null = null;

    private refuse(socket: Socket, code: string): void {
      send(socket, { t: "error", code });
      socket.close();
    }

    override message(socket: Socket, text: string): void {
      let msg: Frame;
      try { msg = JSON.parse(text); } catch { return; }

      if (msg.t === "join" && !this.joined) {
        if (!msg.roomId || !msg.peerId || typeof msg.auth !== "string") return this.refuse(socket, "bad-join");
        let room = rooms.get(msg.roomId);
        if (!room) {
          room = { auth: msg.auth, peers: new Map() };
          rooms.set(msg.roomId, room);
        }
        if (room.auth !== msg.auth) return this.refuse(socket, "bad-auth");
        if (room.peers.has(msg.peerId)) return this.refuse(socket, "duplicate-peer");
        this.joined = { roomId: msg.roomId, peerId: msg.peerId };
        const others = [...room.peers.keys()];
        room.peers.set(msg.peerId, { peerId: msg.peerId, socket });
        send(socket, { t: "joined", peers: others });
        for (const other of room.peers.values()) if (other.peerId !== msg.peerId) send(other.socket, { t: "peer-joined", peerId: msg.peerId });
        log?.debug?.(`[relay] ${msg.peerId} joined ${msg.roomId} (${room.peers.size} peers)`);
        return;
      }

      const joined = this.joined;
      if (!joined) return;

      if (msg.t === "data") {
        const room = rooms.get(joined.roomId);
        if (!room) return;
        const frame = { t: "data", action: msg.action, payload: msg.payload, from: joined.peerId };
        if (msg.to) {
          const target = room.peers.get(msg.to);
          if (target) send(target.socket, frame);
          return;
        }
        for (const other of room.peers.values()) if (other.peerId !== joined.peerId) send(other.socket, frame);
        return;
      }

      if (msg.t === "leave") {
        this.joined = null;
        drop(joined.roomId, joined.peerId);
        socket.close();
      }
    }

    override close(): void {
      const joined = this.joined;
      if (!joined) return;
      this.joined = null;
      drop(joined.roomId, joined.peerId);
    }
  }

  return {
    /** The channel a new `/_relay` socket is accepted on. */
    channel: (): Channel => new Connection(),
    setOrigins: (next: { lan?: string; tunnel?: string }) => Object.assign(origins, next),
    getOrigins: () => ({ ...origins }),
    setPair: (next: { payload: string; roomId: string; path: string }) => { pair = next; },
    getPair: () => {
      if (!pair) return null;
      const room = rooms.get(pair.roomId);
      return room && room.peers.size > 0 ? { payload: pair.payload, path: pair.path } : null;
    },
    roomCount: () => rooms.size,
    roomIds: () => [...rooms.keys()],
    close: () => {
      pair = null;
      for (const room of rooms.values())
        for (const peer of room.peers.values()) peer.socket.close(1001, "the server is going away");
      rooms.clear();
    },
  };
};

/** The one hub of this server process, created on first use. */
let hub: RelayHub | null = null;
/** The process's relay hub, created on first use. */
export const relayHub = (log?: { debug?: (msg: string) => void }): RelayHub => (hub ??= createRelayHub(log));
