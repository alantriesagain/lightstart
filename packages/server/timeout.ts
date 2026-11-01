/**
 * @file A route's time budget. `timeout(ms)` runs the rest of the chain against a timer: a reply
 * that comes first is answered and the timer cleared; a timer that comes first aborts the
 * request's signal, so work listening to it stops, and answers 504 with `{ "error": message }`.
 * The rest of the chain is not torn down: whatever it answers later is discarded, and a rejection
 * it makes later is already handled by the race (never an unhandled rejection). A fast handler
 * pays one timer, one `Promise.race` and one `clearTimeout`.
 */
import { Context } from "./context.ts";
import { Reply, fail } from "./reply.ts";
import type { Middleware, Next } from "./router.ts";

/** Answers 504 when the rest of the chain has not answered within `ms`, aborting `c.signal`. */
export const timeout = (ms: number, message?: string): Middleware => {
  return async (c: Context, next: Next): Promise<Reply> => {
    const text = message === undefined ? "the request timed out" : message;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const expired = new Promise<Reply>((resolve: (reply: Reply) => void) => {
      timer = setTimeout(() => {
        c.incoming.abort("timeout");
        resolve(fail(text, 504));
      }, ms);
    });
    try {
      return await Promise.race([next(), expired]);
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  };
};
