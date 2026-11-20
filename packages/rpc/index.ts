/**
 * @lightstart/rpc: a channel between two runtimes over any message port.
 * `serve` answers requests on one side and `client` sends them from the
 * other; `relay` carries a declared set of events both ways and `mirror`
 * keeps a signal from its owner on the follower. Frames are plain objects,
 * errors cross as values and are rebuilt as `Error`s, and nothing outside
 * the declared events crosses.
 */

import { listen } from "./port.ts";

import type { Emitter } from "@lightstart/light/signals";
import type { MessageLike, Port } from "./port.ts";

export { listen, portOf } from "./port.ts";
export type { MessageLike, Port } from "./port.ts";

/** What a handler sees besides its payload: progress reports before the answer. */
export interface HandlerContext {
  progress(value: unknown): void;
}

/** One named operation `serve` answers. */
export type Handler = (payload: unknown, context: HandlerContext) => unknown | Promise<unknown>;

export interface RequestOptions {
  timeoutMs?: number;
  transfer?: unknown[];
  onProgress?: (value: unknown) => void;
}

export interface PostOptions {
  transfer?: unknown[];
}

interface RequestFrame {
  kind: "request";
  id: string;
  name: string;
  payload: unknown;
}

interface ResponseFrame {
  kind: "response";
  id: string;
  ok: boolean;
  value?: unknown;
  error?: RequestErrorValue;
}

interface ProgressFrame {
  kind: "progress";
  id: string;
  value: unknown;
}

interface EventFrame {
  kind: "event";
  event: string;
  value: unknown;
}

interface MirrorFrame {
  kind: "mirror";
  signal: string;
  value: unknown;
}

interface HelloFrame {
  kind: "hello";
  signal: string;
}

/** An error on the wire: its name, message and own enumerable fields. */
export interface RequestErrorValue {
  name: string;
  message: string;
  [field: string]: unknown;
}

export interface Served {
  dispose(): void;
}

export interface RpcClient {
  request(name: string, payload?: unknown, options?: RequestOptions): Promise<unknown>;
  post(name: string, payload?: unknown, options?: PostOptions): void;
  close(): void;
}

export interface Relayed {
  dispose(): void;
  ignored(): number;
}

export interface Mirrored {
  dispose(): void;
}

interface Pending {
  name: string;
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout> | null;
  onProgress: ((value: unknown) => void) | undefined;
}

const errorValue = (caught: unknown): RequestErrorValue => {
  if (!(caught instanceof Error)) return { name: "Error", message: String(caught) };
  const value: RequestErrorValue = { name: caught.name, message: caught.message };
  for (const [key, field] of Object.entries(caught)) value[key] = field;
  return value;
};

const errorFrom = (value: RequestErrorValue): Error => {
  const error = new Error(value.message);
  error.name = value.name;
  for (const [key, field] of Object.entries(value))
    if (key !== "name" && key !== "message") Reflect.set(error, key, field);
  return error;
};

const dataOf = (event: MessageLike): unknown => event.data;

/**
 * Answer requests on `port` with `handlers`. An unknown name and a throw both
 * answer an error response; `dispose` stops listening.
 */
export const serve = (port: Port, handlers: Record<string, Handler>): Served => {
  const stop = listen(port, "message", (event) => {
    const frame = dataOf(event);
    if (typeof frame !== "object" || frame === null) return;
    const request = frame as Partial<RequestFrame>;
    if (request.kind !== "request" || typeof request.id !== "string" || typeof request.name !== "string") return;
    const id = request.id;
    const name = request.name;
    const payload = request.payload;
    const answer = (response: ResponseFrame): void => port.postMessage(response);
    const handler = handlers[name];
    if (typeof handler !== "function") {
      answer({ kind: "response", id, ok: false, error: { name: "Error", message: "unknown request" } });
      return;
    }
    const context: HandlerContext = { progress: (value) => port.postMessage({ kind: "progress", id, value } as ProgressFrame) };
    Promise.resolve()
      .then(() => handler(payload, context))
      .then(
        (value) => answer({ kind: "response", id, ok: true, value }),
        (caught: unknown) => answer({ kind: "response", id, ok: false, error: errorValue(caught) }),
      );
  });
  return { dispose: stop };
};

/**
 * Send requests over `port`. `timeoutMs` bounds each request (`0` disables
 * it); `close` rejects what is still in flight, and a worker's `error` or
 * `messageerror` closes the client.
 */
export const client = (port: Port, options: { timeoutMs?: number, idPrefix?: string } = {}): RpcClient => {
  const defaultTimeout = options.timeoutMs ?? 5000;
  const idPrefix = options.idPrefix ?? "";
  let next = 0;
  let closed = false;
  const pending = new Map<string, Pending>();

  const settle = (id: string): Pending | undefined => {
    const entry = pending.get(id);
    if (!entry) return undefined;
    pending.delete(id);
    if (entry.timer !== null) clearTimeout(entry.timer);
    return entry;
  };

  const stop = listen(port, "message", (event) => {
    const frame = dataOf(event);
    if (typeof frame !== "object" || frame === null) return;
    const answer = frame as { kind?: unknown, id?: unknown, ok?: unknown, value?: unknown, error?: RequestErrorValue };
    if (typeof answer.id !== "string") return;
    if (answer.kind === "progress") {
      const entry = pending.get(answer.id);
      if (entry) entry.onProgress?.(answer.value);
      return;
    }
    if (answer.kind !== "response") return;
    const entry = settle(answer.id);
    if (!entry) return;
    if (answer.ok) entry.resolve(answer.value);
    else entry.reject(errorFrom(answer.error ?? { name: "Error", message: "the request failed" }));
  });

  const close = (): void => {
    if (closed) return;
    closed = true;
    const flight = [...pending.values()];
    pending.clear();
    for (const entry of flight) {
      if (entry.timer !== null) clearTimeout(entry.timer);
      entry.reject(new Error(`rpc: closed with request "${entry.name}" in flight`));
    }
    stop();
  };

  const stopError = listen(port, "error", close);
  const stopMessageError = listen(port, "messageerror", close);

  const request = (name: string, payload?: unknown, requestOptions: RequestOptions = {}): Promise<unknown> => {
    if (closed) return Promise.reject(new Error(`rpc: request "${name}" sent after close`));
    const id = `${idPrefix}${next++}`;
    const timeoutMs = requestOptions.timeoutMs ?? defaultTimeout;
    return new Promise<unknown>((resolve, reject) => {
      const entry: Pending = { name, resolve, reject, timer: null, onProgress: requestOptions.onProgress };
      if (timeoutMs > 0)
        entry.timer = setTimeout(() => {
          const found = settle(id);
          if (found) found.reject(new Error(`rpc: request "${name}" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      pending.set(id, entry);
      try {
        port.postMessage({ kind: "request", id, name, payload } satisfies RequestFrame, requestOptions.transfer);
      } catch (caught) {
        const found = settle(id);
        if (found) found.reject(caught instanceof Error ? caught : new Error(String(caught)));
      }
    });
  };

  const post = (name: string, payload?: unknown, postOptions: PostOptions = {}): void => {
    port.postMessage({ kind: "request", id: `${idPrefix}${next++}`, name, payload } satisfies RequestFrame, postOptions.transfer);
  };

  const workerClose = (): void => {
    stopError();
    stopMessageError();
  };

  return {
    request,
    post,
    close: () => {
      close();
      workerClose();
    },
  };
};

/**
 * Carry a declared set of events both ways over `port`. A relayed value emits
 * on the other side without being posted back, and a name not declared here
 * is ignored (and counted). `dispose` removes every listener.
 */
export const relay = (port: Port, events: Record<string, Emitter<unknown>>): Relayed => {
  const stops: Array<() => void> = [];
  const local = new Map<string, Emitter<unknown>>();
  let inbound = false;
  let ignored = 0;
  for (const [name, emitter] of Object.entries(events)) {
    local.set(name, emitter);
    stops.push(emitter.on((value: unknown) => {
      if (inbound) return;
      port.postMessage({ kind: "event", event: name, value } satisfies EventFrame);
    }));
  }
  const stop = listen(port, "message", (event) => {
    const frame = dataOf(event);
    if (typeof frame !== "object" || frame === null) return;
    const carried = frame as Partial<EventFrame>;
    if (carried.kind !== "event" || typeof carried.event !== "string") return;
    const emitter = local.get(carried.event);
    if (!emitter) {
      ignored++;
      return;
    }
    inbound = true;
    try {
      emitter.emit(carried.value);
    } finally {
      inbound = false;
    }
  });
  return {
    dispose: () => {
      stop();
      for (const off of stops) off();
    },
    ignored: () => ignored,
  };
};

/** What `mirror` needs of a signal: its value, without tracking, and its changes. */
export interface MirrorSignal<T> {
  value: T;
  peek(): T;
  subscribe(callback: (value: T) => void): () => void;
}

/**
 * Keep `signal` on the other side in step with this side's. The owner posts
 * its value on every change and once when the follower says hello; the
 * follower sets its signal from the owner's frames and never posts a write
 * back. One way by design: only the owner writes.
 */
export const mirror = (port: Port, name: string, signal: MirrorSignal<unknown>, options: { owner: boolean }): Mirrored => {
  const owner = options.owner;
  const stops: Array<() => void> = [];
  let first = true;
  if (owner) {
    stops.push(signal.subscribe((value: unknown) => {
      if (first) {
        first = false;
        return;
      }
      port.postMessage({ kind: "mirror", signal: name, value } satisfies MirrorFrame);
    }));
  } else {
    port.postMessage({ kind: "hello", signal: name } satisfies HelloFrame);
  }
  const stop = listen(port, "message", (event) => {
    const frame = dataOf(event);
    if (typeof frame !== "object" || frame === null) return;
    const carried = frame as { kind?: unknown, signal?: unknown, value?: unknown };
    if (carried.signal !== name) return;
    if (owner && carried.kind === "hello") {
      port.postMessage({ kind: "mirror", signal: name, value: signal.peek() } satisfies MirrorFrame);
      return;
    }
    if (!owner && carried.kind === "mirror") signal.value = carried.value;
  });
  stops.push(stop);
  return { dispose: () => { for (const off of stops) off(); } };
};
