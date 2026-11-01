/**
 * @file The rate limit through the memory adapter: counting and the 429 past the limit, the
 * `RateLimit-*` and `Retry-After` headers, a window that starts again when the clock passes it, a
 * key per address and a custom key, a skipped request not counted, a store that answers a promise,
 * the app-wide plugin against the route's own middleware, and a memory store's cap and sweep.
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { Reply, text } from "../reply.ts";
import { bodyOf, request } from "../memory/index.ts";
import { MemoryRateStore, RateHit, RateLimit, rateLimit, type RateStore } from "../plugins/rate-limit.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const read = (reply: Reply, name: string): string => reply.headers.get(name) ?? "";

const limited = (reply: Reply): string => {
  const out: string[] = [];
  out.push("limit=" + read(reply, "ratelimit-limit"));
  out.push("remaining=" + read(reply, "ratelimit-remaining"));
  out.push("reset=" + read(reply, "ratelimit-reset"));
  return out.join(" ");
};

class SlowStore implements RateStore {
  calls = 0;
  private readonly counts = new Map<string, number>();

  hit(key: string, windowMs: number, now: number): Promise<RateHit> {
    this.calls++;
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return Promise.resolve(new RateHit(count, now + windowMs));
  }
}

const main = async (): Promise<void> => {
  let clock = 10000;
  const now = (): number => clock;

  const app = new App().get("/", (): Reply => text("ok"), [rateLimit({ window: 2000, max: 2, now })]);

  const first = await request(app, "GET", "/");
  eqn("the first request passes", first.status, 200);
  eq("and its headers count it", limited(first), "limit=2 remaining=1 reset=2");
  const second = await request(app, "GET", "/");
  eqn("the second request passes", second.status, 200);
  eq("with no room left", limited(second), "limit=2 remaining=0 reset=2");
  const third = await request(app, "GET", "/");
  eqn("the request past the limit is a 429", third.status, 429);
  eq("with the limit's headers", limited(third), "limit=2 remaining=0 reset=2");
  eq("Retry-After is the seconds until the window ends", read(third, "retry-after"), "2");
  eq("and the default message", await bodyOf(third), "{\"error\":\"too many requests\"}");

  clock = 12000;
  const after = await request(app, "GET", "/");
  eqn("a request after the window passes", after.status, 200);
  eq("and counts from one again", limited(after), "limit=2 remaining=1 reset=2");

  const perAddress = new App().get("/", (): Reply => text("ok"), [rateLimit({ window: 1000, max: 1, now })]);
  eqn("one address passes once", (await request(perAddress, "GET", "/", { address: "10.0.0.1" })).status, 200);
  eqn("and is refused next", (await request(perAddress, "GET", "/", { address: "10.0.0.1" })).status, 429);
  eqn("another address has its own count", (await request(perAddress, "GET", "/", { address: "10.0.0.2" })).status, 200);

  const custom = new App().get(
    "/",
    (): Reply => text("ok"),
    [rateLimit({ window: 1000, max: 1, now, key: (c: Context): string => c.header("x-client") ?? c.ip })],
  );
  eqn("a custom key's first request passes", (await request(custom, "GET", "/", { address: "10.0.0.1", headers: { "x-client": "one" } })).status, 200);
  eqn(
    "the same key from another address is refused",
    (await request(custom, "GET", "/", { address: "10.0.0.2", headers: { "x-client": "one" } })).status,
    429,
  );
  eqn("another key from the first address passes", (await request(custom, "GET", "/", { address: "10.0.0.1", headers: { "x-client": "two" } })).status, 200);

  const skipping = new App().get(
    "/",
    (): Reply => text("ok"),
    [rateLimit({ window: 1000, max: 1, now, skip: (c: Context): boolean => c.header("x-skip") === "1" })],
  );
  eqn("a skipped request passes", (await request(skipping, "GET", "/", { headers: { "x-skip": "1" } })).status, 200);
  eqn("and again", (await request(skipping, "GET", "/", { headers: { "x-skip": "1" } })).status, 200);
  eqn("a counted request passes", (await request(skipping, "GET", "/")).status, 200);
  eqn("the next counted request is refused", (await request(skipping, "GET", "/")).status, 429);

  const slow = new SlowStore();
  const asynchronous = new App()
    .get("/", (): Reply => text("ok"), [rateLimit({ window: 1000, max: 1, now, store: slow, message: "slow down" })]);
  eqn("an async store's first request passes", (await request(asynchronous, "GET", "/")).status, 200);
  const refused = await request(asynchronous, "GET", "/");
  eqn("its second is refused", refused.status, 429);
  eq("with the configured message", await bodyOf(refused), "{\"error\":\"slow down\"}");
  eqn("the store answered both", slow.calls, 2);

  const wide = new App()
    .plugin(new RateLimit({ window: 1000, max: 1, now }))
    .get("/a", (): Reply => text("a"))
    .get("/b", (): Reply => text("b"));
  eqn("the plugin limits one route", (await request(wide, "GET", "/a", { address: "10.0.0.1" })).status, 200);
  eqn("and the limit covers another route", (await request(wide, "GET", "/b", { address: "10.0.0.1" })).status, 429);
  eqn("another address passes", (await request(wide, "GET", "/b", { address: "10.0.0.2" })).status, 200);

  const store = new MemoryRateStore(3);
  for (const key of ["a", "b", "c", "d", "e"]) store.hit(key, 1000, 0);
  eqn("the store holds no more than its cap", store.size, 3);
  eqn("the oldest key was evicted, so it starts over", store.hit("a", 1000, 0).count, 1);
  eqn("and the cap still holds", store.size, 3);

  const swept = new MemoryRateStore(10);
  swept.hit("a", 1000, 0);
  swept.hit("b", 1000, 0);
  swept.sweep(1000);
  eqn("sweeping drops the entries whose window ended", swept.size, 0);

  const lazy = new MemoryRateStore(10);
  for (const key of ["a", "b", "c", "d", "e"]) lazy.hit(key, 1000, 0);
  for (let i = 0; i < 251; i++) lazy.hit("x", 1000, 2000);
  eqn("the every-256-hits sweep dropped the expired entries", lazy.size, 1);

  ok("a hit answers a count and a reset", new MemoryRateStore().hit("k", 1000, 0).reset === 1000);

  done();
};

main();
