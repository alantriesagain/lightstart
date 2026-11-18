/**
 * @lightstart/light/signals/event: an occurrence beside a signal. State is a
 * signal (what something reads now); an event is an occurrence (a request
 * opened, a message about to be sent), and every value is delivered to every
 * listener. Delivery snapshots the listeners, so one added during a pass
 * misses the current value, and one removed before its turn is skipped. An
 * emit from inside a listener is queued and delivered after the pass ends by
 * the outer emit, so a pass never nests.
 */

class Entry<T> {
  listener: (value: T) => void;
  owner: string | undefined;
  active: boolean;

  constructor(listener: (value: T) => void, owner: string | undefined) {
    this.listener = listener;
    this.owner = owner;
    this.active = true;
  }
}

export class Emitter<T> {
  _entries: Array<Entry<T>> = [];
  _queue: Array<T> = [];
  _delivering = false;
  _queued = 0;
  _loopError: Error | null = null;

  /** Listen; the answer stops listening. `owner` tags the listener for `off(owner)`. */
  on(listener: (value: T) => void, owner?: string): () => void {
    const entry = new Entry(listener, owner);
    this._entries.push(entry);
    return () => this._remove(entry);
  }

  /** Hear the next value only. */
  once(listener: (value: T) => void, owner?: string): () => void {
    const entry = new Entry<T>(listener, owner);
    entry.listener = (value) => {
      this._remove(entry);
      listener(value);
    };
    this._entries.push(entry);
    return () => this._remove(entry);
  }

  /** Deliver `value` to every listener, in the order they were added. */
  emit(value: T): void {
    if (this._delivering) {
      this._queued++;
      if (this._queued > 100) {
        this._queue = [];
        this._loopError = new Error("an event was emitted from its own listeners more than 100 times in one delivery");
        throw this._loopError;
      }
      this._queue.push(value);
      return;
    }

    this._delivering = true;
    this._queued = 0;
    this._loopError = null;
    let firstError: unknown = undefined;
    let failed = false;
    let loopError: Error | null = null;
    try {
      this._queue.push(value);
      while (this._queue.length > 0) {
        const next = this._queue.shift() as T;
        const snapshot = this._entries.slice();
        for (const entry of snapshot) {
          if (!entry.active) continue;
          try {
            entry.listener(next);
          } catch (caught) {
            if (!failed) {
              failed = true;
              firstError = caught;
            }
          }
        }
        if (this._loopError !== null) {
          loopError = this._loopError;
          break;
        }
      }
    } finally {
      this._delivering = false;
      this._queue = [];
      this._queued = 0;
      this._loopError = null;
    }
    if (loopError !== null) throw loopError;
    if (failed) throw firstError;
  }

  /** Stop every listener `owner` added. */
  off(owner: string): void {
    const kept: Array<Entry<T>> = [];
    for (const entry of this._entries) {
      if (entry.owner === owner) entry.active = false;
      else kept.push(entry);
    }
    this._entries = kept;
  }

  /** How many listeners are on. */
  get size(): number {
    return this._entries.length;
  }

  _remove(entry: Entry<T>): void {
    entry.active = false;
    const at = this._entries.indexOf(entry);
    if (at !== -1) this._entries.splice(at, 1);
  }
}

export function event<T = void>(): Emitter<T> {
  return new Emitter<T>();
}
