/**
 * @file Refusing a caller that asks too often: `app.get("/", handler, [rateLimit({ window: 60_000, max: 30 })])`
 * for one route, or `app.plugin(new RateLimit({ window: 60_000, max: 30 }))` for every route. A fixed
 * window per key (the client's address unless `key` says otherwise) counts the requests of the
 * window; the limit's reply carries `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`,
 * and a request past the limit is answered 429 with `Retry-After` without reaching the handler. The
 * state sits behind `RateStore`, which may answer at once or asynchronously, so a SQLite or D1 store
 * can replace the in-memory one. The app-wide form contributes middleware rather than a request
 * hook, since a store may answer a promise and the hooks are synchronous.
 */
import type { App } from "../app.ts";
import { Context } from "../context.ts";
import { Plugin } from "../plugin.ts";
import { Reply, fail } from "../reply.ts";
import type { Middleware, Next } from "../router.ts";

/** One key's count in its window: how many requests it has made, and when the count restarts (epoch ms). */
export class RateHit {
  count: number;
  reset: number;

  constructor(count: number, reset: number) {
    this.count = count;
    this.reset = reset;
  }
}

/** Where a limit's counts live; a promise lets a database-backed store answer without blocking. */
export interface RateStore {
  hit(key: string, windowMs: number, now: number): RateHit | Promise<RateHit>;
}

const SWEEP_EVERY = 256;
const DEFAULT_MAX_KEYS = 10000;

/**
 * A fixed window per key in memory, bounded: expired entries are swept every 256 hits and when
 * asked, and past `maxKeys` the oldest key is evicted, so many distinct addresses cannot grow it
 * without limit. Suitable for one process; a host with several processes shares a real store.
 */
export class MemoryRateStore implements RateStore {
  private readonly entries = new Map<string, RateHit>();
  private readonly maxKeys: number;
  private hits = 0;

  constructor(maxKeys = DEFAULT_MAX_KEYS) {
    this.maxKeys = maxKeys;
  }

  /** How many keys the store holds now, after any sweep. */
  get size(): number {
    return this.entries.size;
  }

  /** Drops every key whose window ended at or before `now`. */
  sweep(now: number): void {
    const expired: string[] = [];
    for (const [key, hit] of this.entries) if (now >= hit.reset) expired.push(key);
    for (const key of expired) this.entries.delete(key);
  }

  private evictOldest(): void {
    for (const [key] of this.entries) {
      this.entries.delete(key);
      return;
    }
  }

  hit(key: string, windowMs: number, now: number): RateHit {
    this.hits++;
    if (this.hits % SWEEP_EVERY === 0) this.sweep(now);
    let hit = this.entries.get(key);
    if (hit === undefined || now >= hit.reset) {
      if (hit !== undefined) this.entries.delete(key);
      hit = new RateHit(0, now + windowMs);
      this.entries.set(key, hit);
    }
    hit.count++;
    if (this.entries.size > this.maxKeys) this.evictOldest();
    return hit;
  }
}

/** A route's limit: the window in milliseconds, the most requests allowed in it, and how a caller is named. */
export interface RateLimitOptions {
  /** The length of a window, in milliseconds. */
  window: number;
  /** The most requests one key may make in a window; the next is a 429. */
  max: number;
  /** Names the caller; the client's address (`c.ip`) by default. */
  key?: (c: Context) => string;
  /** Where counts live; a new `MemoryRateStore()` by default. */
  store?: RateStore;
  /** Requests it answers true for are not counted and not limited. */
  skip?: (c: Context) => boolean;
  /** The 429's message, "too many requests" by default. */
  message?: string;
  /** The clock, `Date.now` by default; a test passes a fixed one. */
  now?: () => number;
}

const seconds = (ms: number): number => (ms <= 0 ? 0 : Math.ceil(ms / 1000));

/** A limit as middleware for a route's own list, inside the app's middleware. */
export const rateLimit = (options: RateLimitOptions): Middleware => {
  const windowMs = options.window;
  const max = options.max;
  const store = options.store ?? new MemoryRateStore();
  const keyOf = options.key ?? ((c: Context): string => c.ip);
  const skip = options.skip ?? null;
  const clock = options.now ?? Date.now;
  const message = options.message ?? "too many requests";
  return async (c: Context, next: Next): Promise<Reply> => {
    if (skip !== null && skip(c)) return await next();
    const now = clock();
    const hit = await store.hit(keyOf(c), windowMs, now);
    const reset = seconds(hit.reset - now);
    const remaining = hit.count >= max ? 0 : max - hit.count;
    if (hit.count > max) {
      const reply = fail(message, 429);
      reply.headers.set("retry-after", String(reset));
      reply.headers.set("ratelimit-limit", String(max));
      reply.headers.set("ratelimit-remaining", "0");
      reply.headers.set("ratelimit-reset", String(reset));
      return reply;
    }
    const reply = await next();
    reply.headers.set("ratelimit-limit", String(max));
    reply.headers.set("ratelimit-remaining", String(remaining));
    reply.headers.set("ratelimit-reset", String(reset));
    return reply;
  };
};

/** The same limit on every request of the app, added with `app.plugin(new RateLimit(options))`. */
export class RateLimit extends Plugin {
  readonly options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
    super("rate-limit", []);
    this.options = options;
  }

  setup(app: App): void {
    app.use(rateLimit(this.options));
  }
}
