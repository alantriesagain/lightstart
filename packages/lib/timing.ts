/**
 * @file Time as the core keeps it: a watcher's close held in a class (natively a handle cannot sit in
 * an array or a field typed by the library), and "the latest call wins", a ticket a delayed step
 * checks before it runs.
 */

/** A watcher's close function, held in a class. */
export class Closer {
  readonly unwatch: () => void;

  constructor(unwatch: () => void) {
    this.unwatch = unwatch;
  }
}

/** The latest call wins: `next()` takes a ticket, `is(ticket)` says it is still the latest, `cancel()` retires every ticket out. */
export class Latest {
  private seq = 0;

  next(): number {
    return ++this.seq;
  }

  is(ticket: number): boolean {
    return ticket === this.seq;
  }

  cancel(): void {
    this.seq++;
  }
}
