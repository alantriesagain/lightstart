/**
 * @bootstrapp/events
 * Lightweight event system with pub/sub pattern.
 *
 * Public types live in `./types.ts`. Cross-package consumers reach them
 * via `import("/app/events/index.js").Foo`.
 */

/** @import { EventCallback, EventHandler, GlobalEventHandler } from "./types.js" */

/**
 * Install pub/sub methods on `target` and return it.
 *
 * @template {object} T
 * @param {T} [target]
 * @param {{ getter?: boolean }} [options]
 * @returns {T & EventHandler}
 */
function createEventHandler(target = /** @type {T} */ ({}), { getter = true } = {}) {
  /** @type {Map<string, Set<EventCallback>>} */
  const listeners = new Map();
  const handler = /** @type {T & EventHandler} */ (target);

  handler.listeners = listeners;
  handler.hasListeners = (key) => listeners.has(key);

  handler.on = (/** @type {string} */ key, /** @type {EventCallback} */ callback) => {
    if (!callback) {
      events.emit("events:error", { type: "no_callback", key });
      return () => {};
    }
    let bucket = listeners.get(key);
    if (!bucket) {
      bucket = new Set();
      listeners.set(key, bucket);
    }
    bucket.add(callback);
    return () => handler.off(key, callback);
  };

  handler.set = (events) =>
    Object.entries(events).forEach(([key, callback]) =>
      handler.on(key, callback),
    );

  if (getter) handler.get = (key) => [...(listeners.get(key) ?? [])];

  handler.off = (key, callback) => {
    const callbackSet = listeners.get(key);
    if (!callbackSet) return;
    callbackSet.delete(callback);
    if (callbackSet.size === 0) listeners.delete(key);
  };

  handler.once = (/** @type {string} */ key, /** @type {EventCallback} */ callback) => {
    const wrapper = (/** @type {unknown} */ data) => {
      handler.off(key, wrapper);
      return callback(data);
    };
    return handler.on(key, wrapper);
  };

  handler.emit = async (/** @type {string} */ key, /** @type {unknown} */ data) => {
    /** @type {unknown[]} */
    const results = [];
    listeners.get(key)?.forEach((callback) => {
      try {
        results.push(callback(data));
      } catch (error) {
        events.emit("events:error", { type: "listener_error", key, error });
      }
    });
    return Promise.all(results);
  };

  return handler;
}

/**
 * Strip non-serializable values (functions, symbols, DOM objects, class
 * instances) from `data` so it can be sent via `postMessage`.
 *
 * @param {unknown} data
 * @returns {unknown}
 */
export const sanitizeForPostMessage = (data, seen = new Map()) => {
  if (data === null || data === undefined) return data;
  if (typeof data === "function") return undefined;
  if (typeof data === "symbol") return undefined;
  if (typeof data !== "object") return data;

  if (data instanceof Error)
    return {
      __isError: true,
      name: data.name,
      message: data.message,
      stack: data.stack,
    };

  if (data.constructor && !["Object", "Array"].includes(data.constructor.name))
    return undefined;

  if (seen.has(data)) return seen.get(data);

  if (Array.isArray(data)) {
    /** @type {unknown[]} */
    const list = [];
    seen.set(data, list);
    for (const item of data) list.push(sanitizeForPostMessage(item, seen));
    return list;
  }

  /** @type {Record<string, unknown>} */
  const result = {};
  seen.set(data, result);
  for (const [key, value] of Object.entries(data)) {
    const sanitized = sanitizeForPostMessage(value, seen);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
};

/**
 * Singleton event emitter that libraries can import directly.
 * Works without `$APP`: use `events.connect()` to set up cross-runtime
 * forwarding (e.g. worker → main thread).
 *
 * @type {GlobalEventHandler}
 */
export const events = /** @type {GlobalEventHandler} */ (createEventHandler());

/** @type {Set<(key: string, data?: unknown) => void>} */
const forwarders = new Set();
events.connect = (fn) => {
  forwarders.add(fn);
  return () => forwarders.delete(fn);
};

const originalEmit = events.emit;
events.emit = async (/** @type {string} */ key, /** @type {unknown} */ data) => {
  const out = await originalEmit(key, data);
  for (const forward of forwarders) forward(key, data);
  return out;
};

const EVENT_CONSTANT = /^[A-Z][A-Z0-9_]*$/;

/**
 * Wrap an event handler so registered event-name constants are reachable as
 * flat properties (`$APP.events.SELECT_SOMETHING` → `"select:something"`) and a
 * typo on an unregistered SCREAMING_SNAKE key throws instead of silently
 * returning `undefined`. Constants are installed as own properties on the
 * handler; `registerEventConstants` adds more later (the manifest lands after
 * boot begins). Every other access (methods, `listeners`, symbols,
 * feature-detection, lowercase/camelCase reads) passes straight through.
 *
 * @template {object} T
 * @param {T} handler
 * @param {Record<string, string>} [registry]
 * @returns {T}
 */
export const installEventRegistry = (handler, registry = {}) => {
  registerEventConstants(handler, registry);
  return new Proxy(handler, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (
        value === undefined &&
        typeof prop === "string" &&
        !(prop in target) &&
        EVENT_CONSTANT.test(prop)
      )
        throw new ReferenceError(
          `Unknown event constant $APP.events.${prop}; declare it in an events.js registry`,
        );
      return value;
    },
  });
};

/**
 * Install (or extend) the flat event-name constants on `handler`. Safe to call
 * through the {@link installEventRegistry} Proxy; the assignment forwards to
 * the underlying handler.
 *
 * @param {object} handler
 * @param {Record<string, string>} [registry]
 */
export const registerEventConstants = (handler, registry = {}) =>
  Object.assign(handler, registry);

export default createEventHandler;

if (typeof globalThis !== "undefined" && /** @type {any} */ (globalThis).$APP && !(/** @type {any} */ (globalThis).$APP.events))
  /** @type {any} */ (globalThis).$APP.events = events;
