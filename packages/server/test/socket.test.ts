/**
 * @file Websockets. Through the memory adapter: a plain request to a websocket route is a 426; an
 * upgrade runs the app's middleware like any request and a route's `pass()` falls through; an
 * accepted socket opens, echoes text and bytes and closes from either end. Through the fetch
 * adapter an `upgrade` reply is a 501. Over node's wire, with a client written against RFC 6455 on
 * `node:net`: the handshake's accept key; a masked text frame, a fragmented message and a 16-bit
 * length echoed; a ping answered with its payload; a route that is not a websocket answering the
 * upgrade with its own status; an unmasked frame closed 1002 and an oversized message 1009; a close
 * from the client echoed and heard by the channel, one from the server sent with its code; a client
 * that answers no ping dropped; and `close()` closing what is still open 1001.
 * Runs under node and natively; the outputs must be identical.
 */
import { connect as dial, type Socket as NetSocket } from "node:net";
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { MemoryLogger } from "../logger.ts";
import { Reply, fail, pass, text } from "../reply.ts";
import { Channel, Socket, upgrade } from "../socket.ts";
import { toResponse } from "../fetch/index.ts";
import { MemoryIncoming, connect, request } from "../memory/index.ts";
import { serve } from "../node/index.ts";
import type { Next } from "../router.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

class Journal {
  lines: string[] = [];
}

class Echo extends Channel {
  readonly journal: Journal;

  constructor(journal: Journal) {
    super();
    this.journal = journal;
  }

  override open(socket: Socket): void {
    socket.send("welcome");
  }

  override message(socket: Socket, text: string): void {
    if (text === "bye") socket.close(4000, "asked to");
    else socket.send("echo:" + text);
  }

  override binary(socket: Socket, data: Uint8Array): void {
    socket.send(new Uint8Array([data.length]));
  }

  override close(_socket: Socket, code: number, reason: string): void {
    this.journal.lines.push("closed " + String(code) + (reason === "" ? "" : " " + reason));
  }
}

class Frame {
  readonly op: number;
  readonly payload: Buffer;

  constructor(op: number, payload: Buffer) {
    this.op = op;
    this.payload = payload;
  }

  get code(): number {
    return this.payload.length >= 2 ? this.payload.readUInt16BE(0) : 0;
  }
}

const later = (ms: number): Promise<void> =>
  new Promise<void>((resolve: () => void) => {
    setTimeout(resolve, ms);
  });

/** A websocket client over a raw connection: it writes the handshake and masked frames, and reads the server's frames. */
class Wire {
  readonly socket: NetSocket;
  private data: Buffer = Buffer.alloc(0);
  ended = false;

  constructor(port: number) {
    const socket = dial(port, "127.0.0.1");
    this.socket = socket;
    socket.on("data", (chunk: Buffer) => {
      this.data = Buffer.concat([this.data, chunk]);
    });
    socket.on("close", () => {
      this.ended = true;
    });
  }

  /** Sends the upgrade request for `path` and answers the response's head. */
  async handshake(path: string): Promise<string> {
    this.socket.write("GET " + path + " HTTP/1.1\r\nhost: 127.0.0.1\r\nupgrade: websocket\r\nconnection: Upgrade\r\nsec-websocket-key: dGhlIHNhbXBsZSBub25jZQ==\r\nsec-websocket-version: 13\r\n\r\n");
    for (let i = 0; i < 200; i++) {
      const end = this.data.indexOf("\r\n\r\n");
      if (end >= 0) {
        const head = this.data.subarray(0, end).toString("utf8");
        this.data = this.data.subarray(end + 4);
        return head;
      }
      await later(5);
    }
    return "";
  }

  /** What is left after the head, as text: a refusal's body. */
  async rest(): Promise<string> {
    for (let i = 0; i < 200 && !this.ended; i++) await later(5);
    return this.data.toString("utf8");
  }

  write(first: number, payload: Buffer, masked: boolean): void {
    const size = payload.length;
    const head = Buffer.alloc(size < 126 ? 2 : 4);
    head[0] = first;
    head[1] = (masked ? 128 : 0) | (size < 126 ? size : 126);
    if (size >= 126) head.writeUInt16BE(size, 2);
    if (!masked) {
      this.socket.write(Buffer.concat([head, payload]));
      return;
    }
    const mask = Buffer.from([1, 2, 3, 4]);
    const body = Buffer.alloc(size);
    for (let i = 0; i < size; i++) body[i] = payload[i]! ^ mask[i & 3]!;
    this.socket.write(Buffer.concat([head, mask, body]));
  }

  send(text: string): void {
    this.write(129, Buffer.from(text, "utf8"), true);
  }

  /** The next frame the server sends, null when none comes. */
  async next(): Promise<Frame | null> {
    for (let i = 0; i < 400; i++) {
      if (this.data.length >= 2) {
        let size = this.data[1]! & 127;
        let at = 2;
        if (size === 126 && this.data.length >= 4) {
          size = this.data.readUInt16BE(2);
          at = 4;
        }
        if (size !== 126 && this.data.length >= at + size) {
          const frame = new Frame(this.data[0]! & 15, this.data.subarray(at, at + size));
          this.data = this.data.subarray(at + size);
          return frame;
        }
      }
      if (this.ended) return null;
      await later(5);
    }
    return null;
  }

  async nextText(): Promise<string> {
    const frame = await this.next();
    return frame === null ? "(none)" : frame.payload.toString("utf8");
  }

  /** Waits for the connection to close. */
  async gone(): Promise<boolean> {
    for (let i = 0; i < 200 && !this.ended; i++) await later(5);
    return this.ended;
  }
}

const waitFor = async (journal: Journal, line: string): Promise<boolean> => {
  for (let i = 0; i < 200; i++) {
    if (journal.lines.indexOf(line) >= 0) return true;
    await later(5);
  }
  return false;
};

const main = async (): Promise<void> => {
  const journal = new Journal();
  const guarded = async (c: Context, next: Next): Promise<Reply> => (c.header("x-key") === "secret" ? await next() : fail("not yours", 403));
  const app = new App()
    .logTo(new MemoryLogger())
    .get("/echo", (c: Context) => upgrade(c, new Echo(journal)))
    .get("/guarded", (c: Context) => upgrade(c, new Echo(journal)), [guarded])
    .get("/maybe/:name", (c: Context) => (c.param("name") === "known" ? upgrade(c, new Echo(journal)) : pass()))
    .get("/plain", () => text("not a socket", 409));

  const plain = await request(app, "GET", "/echo");
  eq("a plain request to a websocket route is a 426", String(plain.status) + " " + (plain.headers.get("upgrade") ?? ""), "426 websocket");

  const client = await connect(app, "/echo");
  eqn("an upgrade a route accepts is a 101", client.reply.status, 101);
  eq("the channel opens", client.received.join(","), "welcome");
  client.send("hi");
  client.send(new Uint8Array([1, 2, 3]));
  eq("text is echoed", client.received.join(","), "welcome,echo:hi");
  eq("and bytes", String(client.receivedBytes[0]![0]), "3");
  client.close();
  ok("a close from the client reaches the channel", journal.lines.indexOf("closed 1000") >= 0);
  ok("and the client is closed", !client.open);
  const asked = await connect(app, "/echo");
  asked.send("bye");
  eq("a close from the channel reaches the client", String(asked.code) + " " + asked.reason, "4000 asked to");

  eqn("an upgrade runs the route's middleware", (await connect(app, "/guarded")).reply.status, 403);
  ok("which lets it through", (await connect(app, "/guarded", { headers: { "x-key": "secret" } })).open);
  ok("pass() falls through an upgrade too", (await app.handle(new Context(new MemoryIncoming("GET", "/maybe/other", { headers: { upgrade: "websocket" } })))) === null);

  const fetchUpgrade = upgrade(new Context(new MemoryIncoming("GET", "/echo", { headers: { upgrade: "websocket" } })), new Echo(journal));
  eqn("a fetch runtime takes no websockets yet: a 501", toResponse(fetchUpgrade, "GET").status, 501);

  const server = await serve(app, { port: 0, host: "127.0.0.1", sockets: { idle: 100, maxMessage: 1024 } });
  const wire = new Wire(server.port);
  const head = await wire.handshake("/echo");
  ok("the handshake switches protocols", head.startsWith("HTTP/1.1 101 "));
  ok("with the accept key RFC 6455 gives for its sample", head.indexOf("sec-websocket-accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=") >= 0);
  eq("the channel's first message", await wire.nextText(), "welcome");
  wire.send("over the wire");
  eq("a masked text frame is echoed", await wire.nextText(), "echo:over the wire");
  wire.write(1, Buffer.from("frag", "utf8"), true);
  wire.write(128, Buffer.from("ments", "utf8"), true);
  eq("a fragmented message arrives whole", await wire.nextText(), "echo:fragments");
  wire.send("x".repeat(300));
  eqn("a 16-bit length", (await wire.nextText()).length, 305);
  wire.write(137, Buffer.from("are you there", "utf8"), true);
  const pong = await wire.next();
  eq("a ping is answered with its payload", pong === null ? "(none)" : String(pong.op) + " " + pong.payload.toString("utf8"), "10 are you there");
  wire.write(136, Buffer.from([3, 232]), true);
  const echoed = await wire.next();
  eqn("a close from the client is echoed", echoed === null ? 0 : echoed.code, 1000);
  ok("and the connection ends", await wire.gone());

  const refused = new Wire(server.port);
  ok("a route that is not a websocket answers the upgrade with its own status", (await refused.handshake("/plain")).startsWith("HTTP/1.1 409 "));
  eq("and body", await refused.rest(), "not a socket");
  const missing = new Wire(server.port);
  ok("a path no route matches is the app's not-found", (await missing.handshake("/nowhere")).startsWith("HTTP/1.1 404 "));

  const unmasked = new Wire(server.port);
  await unmasked.handshake("/echo");
  await unmasked.next();
  unmasked.write(129, Buffer.from("bare", "utf8"), false);
  const protocol = await unmasked.next();
  eqn("an unmasked frame is closed 1002", protocol === null ? 0 : protocol.code, 1002);

  const big = new Wire(server.port);
  await big.handshake("/echo");
  await big.next();
  big.send("y".repeat(1100));
  const tooBig = await big.next();
  eqn("a message over maxMessage is closed 1009", tooBig === null ? 0 : tooBig.code, 1009);

  const bye = new Wire(server.port);
  await bye.handshake("/echo");
  await bye.next();
  bye.send("bye");
  const closing = await bye.next();
  eq("a close from the server carries its code and reason", closing === null ? "(none)" : String(closing.code) + " " + closing.payload.subarray(2).toString("utf8"), "4000 asked to");
  bye.write(136, Buffer.from([15, 160]), true);
  ok("the channel hears the close it sent", await waitFor(journal, "closed 4000 asked to"));

  const silent = new Wire(server.port);
  await silent.handshake("/echo");
  await silent.next();
  ok("a client that answers no ping is dropped", await silent.gone());
  ok("which the channel hears as 1006", await waitFor(journal, "closed 1006"));

  const open = new Wire(server.port);
  await open.handshake("/echo");
  await open.next();
  const closed = server.close();
  const away = await open.next();
  eqn("close() closes the open sockets 1001", away === null ? 0 : away.code, 1001);
  open.socket.destroy();
  await closed;
  done();
};

main();
