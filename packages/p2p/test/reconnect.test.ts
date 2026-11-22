// node-only
/**
 * @file The reconnecting socket: it gives up after the attempt cap and says
 * so once, and without a cap it keeps trying with a doubling delay.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { createReconnectingSocket } from "../signal/reconnect.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const failingSocket = () => {
  /** @type {Array<{ url: string, readyState: number, listeners: Record<string, Array<(event: object) => void>>, emit: (type: string) => void, close: () => void }>} */
  const made: Array<{ url: string, readyState: number, listeners: Record<string, Array<(event: object) => void>>, emit: (type: string) => void, close: () => void }> = [];
  class Socket {
    url: string;
    readyState = 0;
    listeners: Record<string, Array<(event: object) => void>> = {};
    constructor(url: string) {
      this.url = url;
      made.push(this);
      setTimeout(() => this.emit("close"), 1);
    }
    addEventListener(type: string, fn: (event: object) => void) { (this.listeners[type] ??= []).push(fn); }
    emit(type: string) { for (const fn of this.listeners[type] ?? []) fn({}); }
    close() {}
  }
  return { Socket, made };
};

{
  const { Socket, made } = failingSocket();
  const gaveUp: number[] = [];
  createReconnectingSocket({ url: "ws://x", WebSocket: Socket as unknown as typeof WebSocket, initialDelay: 1, maxDelay: 2, maxAttempts: 3, onGiveUp: (n) => gaveUp.push(n) });
  await wait(60);
  eq("it stops at maxAttempts", String(made.length), "3");
  eq("it says so once", JSON.stringify(gaveUp), JSON.stringify([3]));
}

{
  const { Socket, made } = failingSocket();
  const socket = createReconnectingSocket({ url: "ws://x", WebSocket: Socket as unknown as typeof WebSocket, initialDelay: 1, maxDelay: 4 });
  await wait(40);
  socket.close();
  ok("without a cap it keeps trying", made.length >= 3);
}

done();
