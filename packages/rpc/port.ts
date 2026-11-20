/**
 * @lightstart/rpc/port: the one thing `@lightstart/rpc` asks of a transport.
 * A `MessagePort`, a `Worker`, a service worker or a native bridge adapted by
 * hand all answer `postMessage` and deliver `"message"` events with `data`;
 * `portOf` turns any of them into a `Port` and `listen` subscribes to one
 * event name and answers the unsubscribe.
 */

/** A delivered message or error, in the shape a `MessageEvent` has. */
export interface MessageLike {
  data?: unknown;
  error?: unknown;
}

/**
 * The transport contract. `addEventListener` and `on` are both optional so
 * an `EventTarget` (`MessagePort`, a browser `Worker`) and an
 * `EventEmitter` (node's `worker_threads.Worker`) both adapt.
 */
export interface Port {
  postMessage(message: unknown, transfer?: unknown[]): void;
  addEventListener?(type: string, listener: (event: MessageLike) => void): void;
  removeEventListener?(type: string, listener: (event: MessageLike) => void): void;
  on?(type: string, listener: (event: MessageLike) => void): (() => void) | void;
  start?(): void;
}

interface EmitterSource {
  postMessage(message: unknown, transfer?: unknown[]): void;
  on(type: string, listener: (value: unknown) => void): unknown;
  off?(type: string, listener: (value: unknown) => void): unknown;
  start?(): void;
}

const adapt = (source: EmitterSource): Port => ({
  postMessage: (message, transfer) => source.postMessage(message, transfer),
  on: (type, listener) => {
    const relay = (value: unknown): void => listener(type === "message" ? { data: value } : { error: value });
    source.on(type, relay);
    return () => source.off?.(type, relay);
  },
  start: () => source.start?.(),
});

/**
 * The `Port` behind a `MessagePort`, a `Worker` or a plain
 * `{ postMessage, addEventListener }`; an `EventEmitter` transport is wrapped
 * so its raw message values arrive as `{ data }`.
 */
export const portOf = (source: unknown): Port => {
  if ((typeof source !== "object" && typeof source !== "function") || source === null)
    throw new TypeError("portOf expects something with postMessage");
  const candidate = source as Partial<Port> & Partial<EmitterSource>;
  if (typeof candidate.postMessage !== "function") throw new TypeError("portOf expects something with postMessage");
  if (typeof candidate.addEventListener === "function") return candidate as Port;
  if (typeof candidate.on === "function") return adapt(candidate as EmitterSource);
  throw new TypeError("portOf expects something with addEventListener or on");
};

/** Subscribe to one event on `port`; the answer stops it. */
export const listen = (port: Port, type: string, listener: (event: MessageLike) => void): (() => void) => {
  if (typeof port.addEventListener === "function") {
    port.start?.();
    port.addEventListener(type, listener);
    return () => port.removeEventListener?.(type, listener);
  }
  if (typeof port.on === "function") {
    const stop = port.on(type, listener);
    return typeof stop === "function" ? stop : () => undefined;
  }
  throw new TypeError("port has no addEventListener or on");
};
