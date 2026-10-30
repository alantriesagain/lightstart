/**
 * @file Websockets on node's server (RFC 6455), for node and scriptc native alike. `Sockets` answers
 * an `upgrade` request with an app, which routes it like any request: a route's `upgrade(c,
 * channel)` gets the handshake and a `NodeSocket` on the connection, any other reply is written on
 * the connection before it closes, and a request the app has no route for is the caller's, the
 * connection untouched (`acceptUpgrades` answers it with the app's not-found reply). Frames are
 * read as they arrive: a client's must be masked, a message may come in fragments and may hold at
 * most `maxMessage` bytes (closed 1009 past it), a ping is answered and a close echoed. Every
 * `idle` ms each socket is pinged, and one that sent nothing since the last ping is dropped.
 * `close()` closes every socket 1001.
 */
import { createHash } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import type { Socket as NetSocket } from "node:net";
import { Context } from "../context.ts";
import { HeaderList } from "../headers.ts";
import { Reply, fail } from "../reply.ts";
import { Channel, Socket } from "../socket.ts";
import { MessageIncoming, WorkTracker } from "./incoming.ts";
import type { App } from "../app.ts";

const ACCEPT_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const TEXT = 1;
const BINARY = 2;
const CLOSE = 8;
const PING = 9;
const PONG = 10;

export interface SocketOptions {
  /** Milliseconds between keep-alive pings, 30 seconds by default; 0 sends none. */
  idle?: number;
  /** The most bytes one message may hold, 1 MiB by default. */
  maxMessage?: number;
}

class Detached extends WorkTracker {
  track(_work: Promise<void>): void {}
}

const DETACHED = new Detached();

/** An upgrade request on its bare connection: it carries no body, and the client has gone once the connection closes. */
export class UpgradeIncoming extends MessageIncoming {
  readonly socket: NetSocket;

  constructor(req: IncomingMessage, socket: NetSocket, tracker: WorkTracker = DETACHED) {
    super(req, tracker);
    this.socket = socket;
    socket.once("close", () => {
      this.left();
    });
    socket.on("error", (_error: Error) => {
      socket.destroy();
    });
  }

  override text(_limit: number): Promise<string> {
    return Promise.resolve("");
  }

  override bytes(_limit: number): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array(0));
  }
}

const headLines = (headers: HeaderList): string => {
  let out = "";
  for (let i = 0; i < headers.names.length; i++) out += headers.names[i]! + ": " + headers.values[i]! + "\r\n";
  return out;
};

/** Writes `reply` on a connection that will not be upgraded, and closes it: its status, headers and whole body. */
const refuse = (socket: NetSocket, reply: Reply): void => {
  const body = reply.text !== null ? Buffer.from(reply.text, "utf8") : reply.bytes !== null ? Buffer.from(reply.bytes) : Buffer.alloc(0);
  reply.headers.set("content-length", String(body.length));
  reply.headers.set("connection", "close");
  socket.write("HTTP/1.1 " + String(reply.status) + " \r\n" + headLines(reply.headers) + "\r\n");
  socket.end(body);
};

const frameHead = (op: number, size: number): Buffer => {
  if (size < 126) {
    const head = Buffer.alloc(2);
    head[0] = 128 | op;
    head[1] = size;
    return head;
  }
  if (size < 65536) {
    const head = Buffer.alloc(4);
    head[0] = 128 | op;
    head[1] = 126;
    head.writeUInt16BE(size, 2);
    return head;
  }
  const head = Buffer.alloc(10);
  head[0] = 128 | op;
  head[1] = 127;
  head.writeUInt32BE(0, 2);
  head.writeUInt32BE(size, 6);
  return head;
};

const closeBody = (code: number, reason: string): Buffer => {
  if (code === 1005) return Buffer.alloc(0);
  const text = Buffer.from(reason, "utf8");
  const body = Buffer.alloc(2 + text.length);
  body.writeUInt16BE(code, 0);
  text.copy(body, 2);
  return body;
};

/** An accepted websocket on node's connection. */
export class NodeSocket extends Socket {
  readonly stream: NetSocket;
  readonly channel: Channel;
  /** Whether anything arrived since the last keep-alive ping. */
  alive = true;
  private readonly owner: Sockets;
  private readonly most: number;
  private pending: Buffer = Buffer.alloc(0);
  private parts: Buffer[] = [];
  private partSize = 0;
  private partKind = 0;
  private shutCode = 0;
  private shutReason = "";
  private deaf = false;
  private ended = false;

  constructor(stream: NetSocket, channel: Channel, most: number, owner: Sockets) {
    super();
    this.stream = stream;
    this.channel = channel;
    this.most = most;
    this.owner = owner;
  }

  /** Hands the socket to its channel and reads `head`, what arrived with the handshake, then the rest. */
  start(head: Buffer): void {
    const stream = this.stream;
    stream.on("data", (chunk: Buffer) => {
      this.read(chunk);
    });
    stream.on("end", () => {
      stream.end();
    });
    stream.on("error", (_error: Error) => {
      stream.destroy();
    });
    stream.on("close", () => {
      this.finish();
    });
    this.channel.open(this);
    if (head.length > 0) this.read(head);
  }

  send(data: string | Uint8Array): void {
    if (this.closed) return;
    if (typeof data === "string") this.write(TEXT, Buffer.from(data, "utf8"));
    else this.write(BINARY, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  }

  close(code = 1000, reason = ""): void {
    if (this.closed) return;
    this.closed = true;
    this.shutCode = code;
    this.shutReason = reason;
    this.write(CLOSE, closeBody(code, reason));
    const stream = this.stream;
    const timer = setTimeout(() => {
      stream.destroy();
    }, 1000);
    timer.unref();
  }

  /** A keep-alive ping; the pong, like anything the client sends, marks it alive. */
  ping(): void {
    if (!this.closed) this.write(PING, Buffer.alloc(0));
  }

  /** Drops the connection with no close handshake: the channel hears 1006. */
  drop(): void {
    this.stream.destroy();
  }

  private write(op: number, payload: Buffer): void {
    this.stream.write(Buffer.concat([frameHead(op, payload.length), payload]));
  }

  /** Ends on a protocol fault: the close frame goes out and the connection with it. */
  private fault(code: number, reason: string): void {
    if (!this.closed) {
      this.closed = true;
      this.shutCode = code;
      this.shutReason = reason;
      this.write(CLOSE, closeBody(code, reason));
    }
    this.deaf = true;
    this.stream.end();
  }

  private read(chunk: Buffer): void {
    if (this.deaf) return;
    this.alive = true;
    let data = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    while (data.length >= 2) {
      const first = data[0]!;
      const second = data[1]!;
      const op = first & 15;
      const fin = (first & 128) !== 0;
      let size = second & 127;
      let at = 2;
      if (size === 126) {
        if (data.length < 4) break;
        size = data.readUInt16BE(2);
        at = 4;
      } else if (size === 127) {
        if (data.length < 10) break;
        if (data.readUInt32BE(2) !== 0) return this.fault(1009, "the message is too big");
        size = data.readUInt32BE(6);
        at = 10;
      }
      if ((second & 128) === 0) return this.fault(1002, "a client's frames are masked");
      if ((first & 112) !== 0) return this.fault(1002, "no extension was agreed");
      if (op >= CLOSE && (size > 125 || !fin)) return this.fault(1002, "a control frame is whole and at most 125 bytes");
      if (op < CLOSE && this.partSize + size > this.most) return this.fault(1009, "the message is too big");
      if (data.length < at + 4 + size) break;
      const payload = Buffer.alloc(size);
      const start = at + 4;
      for (let i = 0; i < size; i++) payload[i] = data[start + i]! ^ data[at + (i & 3)]!;
      data = data.subarray(start + size);
      this.frame(fin, op, payload);
      if (this.deaf) return;
    }
    this.pending = data;
  }

  private frame(fin: boolean, op: number, payload: Buffer): void {
    if (op === CLOSE) {
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1005;
      if (!this.closed) {
        this.closed = true;
        this.shutCode = code;
        this.shutReason = payload.length > 2 ? payload.toString("utf8", 2) : "";
        this.write(CLOSE, closeBody(code, ""));
      }
      this.deaf = true;
      this.stream.end();
      return;
    }
    if (op === PING) {
      if (!this.closed) this.write(PONG, payload);
      return;
    }
    if (op === PONG) return;
    if (op === 0) {
      if (this.partKind === 0) return this.fault(1002, "a continuation of no message");
    } else if (op === TEXT || op === BINARY) {
      if (this.partKind !== 0) return this.fault(1002, "a message began before the last one ended");
      this.partKind = op;
    } else return this.fault(1002, "an unknown opcode");
    this.parts.push(payload);
    this.partSize += payload.length;
    if (!fin) return;
    const whole = this.parts.length === 1 ? payload : Buffer.concat(this.parts);
    const kind = this.partKind;
    this.parts = [];
    this.partSize = 0;
    this.partKind = 0;
    if (this.closed) return;
    if (kind === TEXT) this.channel.message(this, whole.toString("utf8"));
    else this.channel.binary(this, whole);
  }

  /** Once the connection closed: the channel hears the close that was sent, 1006 when none was. */
  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.deaf = true;
    this.closed = true;
    this.owner.forget(this);
    this.channel.close(this, this.shutCode === 0 ? 1006 : this.shutCode, this.shutReason);
  }
}

/** The websockets one server accepted, and how it accepts them. */
export class Sockets {
  readonly idle: number;
  readonly maxMessage: number;
  /** Where the work an upgrade request hands to `waitUntil` is counted. */
  readonly tracker: WorkTracker;
  private readonly live = new Set<NodeSocket>();
  private timer: NodeJS.Timeout | null = null;

  constructor(options: SocketOptions = {}, tracker: WorkTracker = DETACHED) {
    this.idle = options.idle ?? 30000;
    this.maxMessage = options.maxMessage ?? 1048576;
    this.tracker = tracker;
  }

  /** How many are open. */
  get size(): number {
    return this.live.size;
  }

  /** `app`'s answer to the upgrade request `incoming`: true once answered, false (the connection untouched) when no route matches it. */
  async answer(app: App, incoming: UpgradeIncoming, head: Buffer): Promise<boolean> {
    const c = new Context(incoming);
    const reply = await app.handle(c);
    if (reply === null) return false;
    this.take(c, reply, head);
    return true;
  }

  /** Answers the upgrade request `c` with `reply`: the handshake and the socket for an `upgrade` reply, anything else written as it is. */
  take(c: Context, reply: Reply, head: Buffer): void {
    const incoming = c.incoming;
    if (!(incoming instanceof UpgradeIncoming)) throw new Error("an upgrade is answered on the UpgradeIncoming it arrived as");
    const stream = incoming.socket;
    const channel = reply.channel;
    if (channel === null) return refuse(stream, reply);
    const key = c.header("sec-websocket-key");
    if (key === null || c.header("sec-websocket-version") !== "13") return refuse(stream, fail("a websocket handshake sends sec-websocket-key and sec-websocket-version 13", 400).header("sec-websocket-version", "13"));
    const accept = createHash("sha1").update(key + ACCEPT_GUID).digest("base64");
    stream.write("HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: Upgrade\r\nsec-websocket-accept: " + accept + "\r\n" + headLines(reply.headers) + "\r\n");
    const socket = new NodeSocket(stream, channel, this.maxMessage, this);
    this.live.add(socket);
    if (this.timer === null && this.idle > 0) {
      const timer = setInterval(() => {
        this.beat();
      }, this.idle);
      timer.unref();
      this.timer = timer;
    }
    socket.start(head);
  }

  /** Drops a socket that closed. */
  forget(socket: NodeSocket): void {
    this.live.delete(socket);
    if (this.live.size === 0 && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private beat(): void {
    for (const socket of Array.from(this.live)) {
      if (!socket.alive) socket.drop();
      else {
        socket.alive = false;
        socket.ping();
      }
    }
  }

  /** Closes every open socket, 1001 by default. */
  close(code = 1001, reason = "the server is going away"): void {
    for (const socket of Array.from(this.live)) socket.close(code, reason);
  }
}

/** Takes every upgrade request `server` receives to `app`; one no route matches is answered with the app's not-found reply. */
export const acceptUpgrades = (server: Server, app: App, sockets: Sockets = new Sockets()): Sockets => {
  server.on("upgrade", (req: IncomingMessage, stream: NetSocket, head: Buffer) => {
    const c = new Context(new UpgradeIncoming(req, stream, sockets.tracker));
    app.dispatch(c).then(
      (reply: Reply) => {
        sockets.take(c, reply, head);
      },
      (error: unknown) => {
        app.logger.error("the upgrade could not be answered", error);
        stream.destroy();
      },
    );
  });
  return sockets;
};
