/**
 * @file A `Reply` written out through a node `ServerResponse`, in one `writeHead` with the headers
 * as a flat list (so every `set-cookie` is its own line). A whole body gets its `content-length`
 * and goes out with `end`; a streamed one goes out chunked and stops once the client has gone; a
 * Fetch `Response` is copied out the same way, its body read chunk by chunk. A HEAD, a 204, a 304
 * and a 1xx carry no body. A write waits while the socket's buffer is full, polling
 * `writableNeedDrain` rather than listening for `drain`, since scriptc lowers neither a response's
 * `drain` nor removing a listener and a listener per wait would pile up on a keep-alive socket;
 * natively the runtime buffers a response's writes itself and the socket never reports full. A
 * websocket is accepted on the server's `upgrade` event (`socket.ts`), never here: an `upgrade`
 * reply that reaches a response is answered 501.
 */
import type { ServerResponse } from "node:http";
import { HeaderList } from "../headers.ts";
import { Reply, Writer } from "../reply.ts";
import { unaccepted } from "../socket.ts";

const bodiless = (method: string, status: number): boolean => method === "HEAD" || status === 204 || status === 304 || (status >= 100 && status < 200);

const tick = (): Promise<void> =>
  new Promise<void>((resolve: () => void) => {
    setTimeout(resolve, 2);
  });

export class NodeWriter extends Writer {
  private readonly res: ServerResponse;

  constructor(res: ServerResponse) {
    super();
    this.res = res;
    res.once("close", () => {
      this.closed = true;
    });
  }

  write(chunk: string | Uint8Array): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (typeof chunk === "string") this.res.write(chunk);
    else this.res.write(chunk);
    return this.settle();
  }

  /** Resolves once the socket's buffer has room again, or the client has gone. */
  private async settle(): Promise<void> {
    const socket = this.res.socket;
    while (!this.closed && socket !== null && socket.writableNeedDrain) await tick();
  }
}

const streamOut = async (res: ServerResponse, status: number, headers: HeaderList, body: (out: Writer) => Promise<void>): Promise<void> => {
  res.writeHead(status, headers.flat());
  const writer = new NodeWriter(res);
  try {
    await body(writer);
  } finally {
    if (!writer.closed) res.end();
  }
};

const responseOut = async (res: ServerResponse, response: Response, own: HeaderList, method: string): Promise<void> => {
  const headers = new HeaderList();
  response.headers.forEach((value: string, name: string) => {
    headers.append(name, value);
  });
  for (let i = 0; i < own.names.length; i++) {
    const name = own.names[i]!;
    if (name === "set-cookie" || !headers.has(name)) headers.append(name, own.values[i]!);
  }
  const source = response.body;
  if (source === null || bodiless(method, response.status)) {
    res.writeHead(response.status, headers.flat());
    res.end();
    return;
  }
  const reader = source.getReader();
  res.writeHead(response.status, headers.flat());
  const writer = new NodeWriter(res);
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      if (writer.closed) {
        await reader.cancel();
        break;
      }
      await writer.write(next.value);
    }
  } finally {
    if (!writer.closed) res.end();
  }
};

/** Writes `reply` as the answer to a request made with `method`. */
export const writeReply = async (res: ServerResponse, reply: Reply, method: string): Promise<void> => {
  if (reply.channel !== null) return writeReply(res, unaccepted(), method);
  if (reply.response !== null) return responseOut(res, reply.response, reply.headers, method);
  const status = reply.status;
  const headers = reply.headers;
  const none = bodiless(method, status);
  if (reply.stream !== null) {
    if (none) {
      res.writeHead(status, headers.flat());
      res.end();
      return;
    }
    return streamOut(res, status, headers, reply.stream);
  }
  if (reply.text !== null) {
    headers.defaultLower("content-length", String(Buffer.byteLength(reply.text)));
    res.writeHead(status, headers.flat());
    if (none) res.end();
    else res.end(reply.text);
    return;
  }
  if (reply.bytes !== null) {
    headers.defaultLower("content-length", String(reply.bytes.length));
    res.writeHead(status, headers.flat());
    if (none) res.end();
    else res.end(reply.bytes);
    return;
  }
  if (status !== 204 && status !== 304 && status >= 200) headers.defaultLower("content-length", "0");
  res.writeHead(status, headers.flat());
  res.end();
};
