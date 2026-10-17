/**
 * @bootstrapp/light/controller/resource: resource()
 * The async primitive for a value something fetches: an HTTP answer, baked
 * JSON, a join across sources. It holds the value, whether it is loading and
 * the last error as signals, dedupes concurrent loads, and never shows an
 * empty middle state: a refresh keeps the last good value until the new
 * answer lands (stale-while-revalidate). The ready gate, the event bus behind
 * `invalidateOn` and work tracking come from `configureControllers`.
 */

import { batch, signal } from "../signals/index.ts";
import { config } from "./config.ts";

import type { EventBus, KeyedResource, KeyedResourceOptions, Resource, ResourceOptions } from "./types.ts";

type Dependency = { readonly value: { peek(): unknown, subscribe(callback: (value: unknown) => void): () => void } };

type LoadOptions = {
  name?: string;
  eager?: boolean;
  ready?: false | (() => Promise<unknown> | undefined);
  events?: EventBus | null;
  invalidateOn?: string | string[];
  filter?: (payload: unknown, eventKey: string) => boolean;
  dependsOn?: readonly Dependency[];
};

const swallow = () => {};

const createResource = (fetcher: () => unknown, options: LoadOptions): Resource<unknown> => {
  const {
    name = "resource",
    eager = false,
    ready,
    events,
    invalidateOn,
    filter,
    dependsOn,
  } = options;

  const value = signal<unknown>(undefined);
  const pending = signal(false);
  const error = signal<unknown>(null);

  let loading: Promise<unknown> | null = null;
  let resolvedOnce = false;
  let stale = false;
  let generation = 0;
  const offs: Array<() => void> = [];

  const readyGate = (): Promise<unknown> => {
    if (ready === false) return Promise.resolve();
    const gate = typeof ready === "function" ? ready() : config.ready();
    return gate ?? Promise.resolve();
  };

  let listening = false;
  let disposed = false;
  const listen = () => {
    if (listening || disposed || !invalidateOn) return;
    listening = true;
    const bus = events !== undefined ? events : config.events;
    if (!bus) return;
    for (const eventKey of Array.isArray(invalidateOn) ? invalidateOn : [invalidateOn])
      offs.push(
        bus.on(eventKey, (payload) => {
          if (filter && !filter(payload, eventKey)) return undefined;
          if (!resolvedOnce) return undefined;
          return self.refresh().catch(swallow);
        }),
      );
  };

  const runFetch = async (): Promise<unknown> => {
    const gen = ++generation;
    pending.value = true;
    listen();
    const done = config.track(`resource:${name}`);
    try {
      const next = await fetcher();
      if (gen !== generation) return value.peek();
      batch(() => {
        value.value = next;
        pending.value = false;
        error.value = null;
      });
      resolvedOnce = true;
      if (stale) {
        stale = false;
        self.refresh().catch(swallow);
      }
      return next;
    } catch (err) {
      if (gen === generation)
        batch(() => {
          error.value = err;
          pending.value = false;
        });
      throw err;
    } finally {
      done?.();
    }
  };

  const load = async () => {
    await readyGate();
    return runFetch();
  };

  const self: Resource<unknown> = {
    name,
    value,
    pending,
    error,

    ensure() {
      if (!loading)
        loading = load().catch((err) => {
          loading = null;
          throw err;
        });
      return loading.then(() => value.peek());
    },

    refresh() {
      if (!resolvedOnce) return self.ensure();
      return runFetch();
    },

    invalidate() {
      if (resolvedOnce) self.refresh().catch(swallow);
    },

    mutate(updater) {
      const next = updater(value.peek());
      value.value = next;
      return next;
    },

    peek() {
      return value.peek();
    },

    subscribe(cb) {
      return value.subscribe(cb);
    },

    own(teardown) {
      offs.push(teardown);
    },

    dispose() {
      disposed = true;
      generation++;
      for (const off of offs.splice(0)) off();
    },
  };

  if (dependsOn)
    for (const dep of dependsOn) {
      let first = true;
      let held = dep.value.peek() !== undefined;
      offs.push(
        dep.value.subscribe((v) => {
          if (first) {
            first = false;
            return;
          }
          const moved = held;
          held = v !== undefined;
          if (resolvedOnce) {
            self.refresh().catch(swallow);
            return;
          }
          if (moved && loading) stale = true;
        }),
      );
    }

  if (eager) queueMicrotask(() => self.ensure().catch(swallow));

  return self;
};

/**
 * A resource over `fetcher`. `mutate(updater)` must return a NEW reference:
 * the signal's === dedupe makes in-place mutation invisible. `subscribe(cb)`
 * fires immediately with the current value, then on every change.
 */
export function resource<T>(fetcher: () => Promise<T> | T, options?: ResourceOptions): Resource<T>;
export function resource(fetcher: () => unknown, options: LoadOptions = {}): Resource<unknown> {
  return createResource(fetcher, options);
}

/**
 * Keyed resources: one lazily-created resource per key (per-URL caches,
 * per-slug fetches). `invalidate(key)` has DROP semantics: the entry is
 * disposed and deleted, so the next get(key) starts fresh, unlike a
 * singular Resource.invalidate, which refreshes in place.
 */
export function keyedResource<T>(fetcherForKey: (key: string) => Promise<T> | T, options?: KeyedResourceOptions): KeyedResource<T>;
export function keyedResource(fetcherForKey: (key: string) => unknown, options: LoadOptions = {}): KeyedResource<unknown> {
  const entries: Map<string, Resource<unknown>> = new Map();

  return {
    get(key) {
      let entry = entries.get(key);
      if (!entry) {
        const { filter, ...rest } = options;
        entry = createResource(() => fetcherForKey(key), {
          ...rest,
          name: `${options.name ?? "keyed"}:${key}`,
          filter: filter ? (payload) => filter(payload, key) : undefined,
        });
        entries.set(key, entry);
      }
      return entry;
    },

    invalidate(key) {
      entries.get(key)?.dispose();
      entries.delete(key);
    },

    invalidateAll() {
      for (const entry of entries.values()) entry.dispose();
      entries.clear();
    },

    keys() {
      return [...entries.keys()];
    },

    dispose() {
      this.invalidateAll();
    },
  };
}
