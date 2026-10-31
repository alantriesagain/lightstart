/**
 * @file A hook: something the host announces ("the conversation changed", "git status was read") that
 * plugins listen to. Most listeners get no payload and read what changed from the host; one that
 * names its event ("a request opened") gets the value the host fired with.
 *
 * Emitting goes over a snapshot of the listeners: a listener's plugin may be switched off while it
 * runs.
 */
class Listener {
  readonly owner: string;
  readonly onFire: (value?: unknown) => void;

  constructor(owner: string, onFire: (value?: unknown) => void) {
    this.owner = owner;
    this.onFire = onFire;
  }
}

export class Hook {
  private listeners: Listener[] = [];

  /** Listen on behalf of plugin `owner`; `onFire` gets the value the hook fired with, if any. */
  add(owner: string, onFire: (value?: unknown) => void): void {
    this.listeners.push(new Listener(owner, onFire));
  }

  /** Stop listening on behalf of `owner`. */
  remove(owner: string): void {
    this.listeners = this.listeners.filter((l) => l.owner !== owner);
  }

  /** Call every listener with `value`, in the order they were added; one removed during the pass is not called. */
  fire(value?: unknown): void {
    const listeners = this.listeners.slice();
    for (const l of listeners) if (this.listeners.includes(l)) l.onFire(value);
  }

  get size(): number {
    return this.listeners.length;
  }
}
