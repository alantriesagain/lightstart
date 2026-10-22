/**
 * @file A hook: something the host announces ("the conversation changed", "git status was read") that
 * plugins listen to. Listeners get no payload; they read what changed from the host, so one hook
 * type serves every event.
 *
 * Emitting goes over a snapshot of the listeners: a listener's plugin may be switched off while it
 * runs.
 */
class Listener {
  readonly owner: string;
  readonly onFire: () => void;

  constructor(owner: string, onFire: () => void) {
    this.owner = owner;
    this.onFire = onFire;
  }
}

export class Hook {
  private listeners: Listener[] = [];

  /** Listen on behalf of plugin `owner`. */
  add(owner: string, onFire: () => void): void {
    this.listeners.push(new Listener(owner, onFire));
  }

  /** Stop listening on behalf of `owner`. */
  remove(owner: string): void {
    this.listeners = this.listeners.filter((l) => l.owner !== owner);
  }

  /** Call every listener, in the order they were added; one removed during the pass is not called. */
  fire(): void {
    const listeners = this.listeners.slice();
    for (const l of listeners) if (this.listeners.includes(l)) l.onFire();
  }

  get size(): number {
    return this.listeners.length;
  }
}
