/**
 * @lightstart/light/controller/class: a controller as a TypeScript class, the
 * form that compiles natively (`defineController`'s literal does not lower
 * from TypeScript). A subclass's signal fields are its props, a live query of
 * a model is `liveRows(this, model, build)` from `@lightstart/light/model/binder`
 * (its `sync:` block), `connected()` and `disconnected()` are its hooks,
 * `$onStart` keeps a setup that runs on every `start()`, `$own` keeps a
 * teardown for `dispose()`, `$wait` names work `$ready` waits for, and
 * `$ready` settles once `start()` ran the setups and `connected()` and that
 * work is done. A base constructor runs before the subclass's fields exist, so
 * `start()` is a call of its own: the entry makes it, or the subclass's
 * constructor does, last.
 */
import { tracked } from "./config.ts";
import { Teardowns } from "./teardowns.ts";

export class Controller {
  readonly $name: string;
  /** Settles once `start()` ran the setups and `connected()` and the work `$wait` named for that run is done; a throw rejects it. */
  $ready: Promise<void>;
  private readonly owned = new Teardowns();
  private readonly setups: Array<() => void> = [];
  private waiting: Promise<void>[] = [];
  private running: Promise<void>[] | null = null;

  constructor(name: string) {
    this.$name = name;
    this.$ready = Promise.resolve();
  }

  /** Keep `teardown` (an unsubscribe, a dispose, a clearInterval closure) for `dispose()`; answers it, so it wraps a call inline. */
  $own<T extends () => void>(teardown: T): T {
    this.owned.own(teardown);
    return teardown;
  }

  /**
   * Keep `setup` for every `start()`, run in registration order before
   * `connected()`: the work it `$wait`s and the teardowns it `$own`s belong to
   * that run. A field initialiser or the constructor registers one, so a query
   * it starts runs against the stores the run opened and runs again after a
   * dispose and a second start.
   */
  $onStart(setup: () => void): void {
    this.setups.push(setup);
  }

  /** Work `$ready` waits for (a query's first load); a setup's work belongs to that run, any other to the next start. */
  $wait(work: Promise<void>): void {
    const running = this.running;
    if (running !== null) running.push(work);
    else this.waiting.push(work);
  }

  /**
   * Runs once, from `start()`: answers the promise of the work it starts (an
   * async method's), which `$ready` waits for, or null. A plain method, not
   * an async one, since natively an async method cannot be overridden and an
   * override's signature matches the base's exactly.
   */
  connected(): Promise<void> | null {
    return null;
  }

  /** Runs from `dispose()`, before the teardowns: the promise of the work it starts, or null. */
  disconnected(): Promise<void> | null {
    return null;
  }

  /** Run every setup, then `connected()`, and settle `$ready` with that run's work; answers `$ready`. */
  start(): Promise<void> {
    const pending: Promise<void>[] = this.waiting.splice(0);
    this.running = pending;
    try {
      for (const setup of this.setups) setup();
    } finally {
      this.running = null;
    }
    const work = this.connected();
    if (work !== null) pending.push(work);
    this.$ready = tracked(Promise.all(pending).then(() => undefined), "controller:" + this.$name);
    return this.$ready;
  }

  /** `disconnected()`, then every teardown owned, the queries' included. */
  async dispose(): Promise<void> {
    try {
      const work = this.disconnected();
      if (work !== null) await work;
    } finally {
      this.owned.drain(this.$name);
    }
  }
}
