/**
 * @file `timeout(ms)`: a fast handler unaffected and its timer cleared, a slow one answered 504
 * with the default or given message and its signal aborted, the late reply discarded, and the
 * middleware nested with another that still shapes the 504. Through the memory adapter, the same
 * under node and natively.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { Reply, text } from "../reply.ts";
import type { Middleware, Next } from "../router.ts";
import { request, bodyOf } from "../memory/index.ts";
import { timeout } from "../timeout.ts";
import { done, eq, ok } from "@light/test/assert.ts";

const pause = (ms: number): Promise<void> =>
  new Promise((resolve: () => void) => {
    setTimeout(resolve, ms);
  });

const tag: Middleware = async (_c: Context, next: Next): Promise<Reply> => {
  const reply = await next();
  return reply.header("x-tag", "seen");
};

const main = async (): Promise<void> => {
  const fast = new App().get("/fast", () => text("fast"), [timeout(10000)]);
  const started = Date.now();
  const quick = await request(fast, "GET", "/fast");
  const fastMs = Date.now() - started;
  eq("a fast handler is answered as it is", String(quick.status) + " " + (await bodyOf(quick)), "200 fast");
  eq("and the timer is cleared, not waited for", String(fastMs < 1000), "true");

  let sawAbort = false;
  let late = 0;
  let replies = 0;
  const slow = new App().get(
    "/slow",
    async (c: Context): Promise<Reply> => {
      const signal = c.signal;
      await pause(30);
      sawAbort = signal.aborted;
      late++;
      return text("late");
    },
    [timeout(5, "too slow")],
  );
  slow.onReply(() => {
    replies++;
  });
  const expired = await request(slow, "GET", "/slow");
  eq("a slow handler is a 504", String(expired.status), "504");
  eq("with the message", await bodyOf(expired), "{\"error\":\"too slow\"}");
  eq("and is not cached", expired.headers.get("cache-control") ?? "", "no-store");
  await pause(80);
  eq("the late work ran and saw its signal aborted", String(sawAbort) + " " + String(late), "true 1");
  eq("but its late reply was discarded", String(replies), "1");

  const silent = new App().get("/silent", async (): Promise<Reply> => {
    await pause(30);
    return text("late");
  }, [timeout(5)]);
  const defaulted = await request(silent, "GET", "/silent");
  eq("the default message", await bodyOf(defaulted), "{\"error\":\"the request timed out\"}");
  await pause(50);

  const nested = new App().get("/nested", async (): Promise<Reply> => {
    await pause(30);
    return text("late");
  }, [tag, timeout(5, "nested timeout")]);
  const wrapped = await request(nested, "GET", "/nested");
  eq("another middleware still shapes the 504", String(wrapped.status) + " " + (wrapped.headers.get("x-tag") ?? ""), "504 seen");
  await pause(50);

  const okay = new App().get("/nested-fast", () => text("nested"), [tag, timeout(1000)]);
  const shaped = await request(okay, "GET", "/nested-fast");
  ok("and a fast nested reply keeps its header", shaped.status === 200 && shaped.headers.get("x-tag") === "seen");

  done();
};

main();
