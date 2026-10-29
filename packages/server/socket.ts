/**
 * @file Websockets as a route sees them. A route answers `upgrade(c, channel)`, and an adapter whose
 * platform takes websockets accepts the connection and hands `channel` the `Socket`: `open` once,
 * `message` for each text message, `binary` for each binary one, `close` once when either side
 * closes or the connection drops. The upgrade is a request like any other until then, so it runs
 * the app's hooks and middleware, a route may refuse it with any reply, and `pass()` lets a host try
 * what sits behind the app. A plain request to a websocket route is answered 426, and an adapter
 * that takes no websockets answers 501.
 */
import { Reply, fail } from "./reply.ts";
import type { Context } from "./context.ts";

/** One accepted websocket, as its channel holds it. After a close, sends are dropped. */
export abstract class Socket {
  closed = false;

  /** Sends a text message for a string, a binary one for bytes. */
  abstract send(data: string | Uint8Array): void;

  /** Closes with `code` and `reason` (1000, "" by default); the channel's `close` follows once. */
  abstract close(code?: number, reason?: string): void;
}

/** What a websocket route does with its socket; each method does nothing until a subclass says otherwise. */
export class Channel {
  open(_socket: Socket): void {}

  message(_socket: Socket, _text: string): void {}

  binary(_socket: Socket, _data: Uint8Array): void {}

  /** Once, when the socket closed: the code the closing side sent (1005 when it sent none, 1006 when the connection dropped). */
  close(_socket: Socket, _code: number, _reason: string): void {}
}

/** Whether `c` asks to become a websocket. */
export const upgrading = (c: Context): boolean => {
  const asked = c.header("upgrade");
  return asked !== null && asked.toLowerCase() === "websocket";
};

/** Accepts the websocket `c` asks for, on `channel`; a request that asks none is answered 426. */
export const upgrade = (c: Context, channel: Channel): Reply => {
  if (!upgrading(c)) return fail("this route takes websockets: ask with upgrade: websocket", 426).header("upgrade", "websocket");
  const reply = new Reply(101);
  reply.channel = channel;
  return reply;
};

/** What an adapter that takes no websockets answers in place of an `upgrade` reply. */
export const unaccepted = (): Reply => fail("this server takes no websockets", 501);
