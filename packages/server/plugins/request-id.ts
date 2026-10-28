/**
 * @file A request id on every request and its reply: the incoming `x-request-id` when it is a
 * plausible id (at most 128 characters of letters, digits and `-_.:`), so a trace crosses the
 * proxy in front, else a new random UUID. A handler reads it with `c.get(REQUEST_ID)`; every reply
 * carries it back in the same header.
 */
import type { App } from "../app.ts";
import { Context } from "../context.ts";
import { Key } from "../key.ts";
import { Plugin } from "../plugin.ts";
import { Reply } from "../reply.ts";

export const REQUEST_ID = new Key<string>("request id");

const PLAUSIBLE = /^[A-Za-z0-9\-_.:]{1,128}$/;

export class RequestId extends Plugin {
  readonly header: string;

  constructor(header = "x-request-id") {
    super("request-id", []);
    this.header = header.toLowerCase();
  }

  setup(app: App): void {
    const header = this.header;
    app.onRequest((c: Context): Reply | null => {
      const given = c.header(header);
      c.set(REQUEST_ID, given !== null && PLAUSIBLE.test(given) ? given : crypto.randomUUID());
      return null;
    });
    app.onReply((c: Context, reply: Reply): void => {
      const id = c.get(REQUEST_ID);
      if (id !== undefined) reply.headers.set(header, id);
    });
  }
}
