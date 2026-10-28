/**
 * @file The most bytes a request body may hold, for every request (`app.plugin(new BodyLimit(64 * 1024))`)
 * or for one route (`app.post("/upload", handler, [limit(50 * 1024 * 1024)])`). A body past it is
 * refused with a 413 as it is read, before it is kept whole.
 */
import type { App } from "../app.ts";
import { Context } from "../context.ts";
import { Plugin } from "../plugin.ts";
import { Reply } from "../reply.ts";
import type { Middleware, Next } from "../router.ts";

export class BodyLimit extends Plugin {
  readonly bytes: number;

  constructor(bytes: number) {
    super("body-limit", []);
    this.bytes = bytes;
  }

  setup(app: App): void {
    const bytes = this.bytes;
    app.onRequest((c: Context): Reply | null => {
      c.limit = bytes;
      return null;
    });
  }
}

/** A route's own limit, over the app's. */
export const limit = (bytes: number): Middleware => (c: Context, next: Next): Promise<Reply> => {
  c.limit = bytes;
  return next();
};
