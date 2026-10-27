/**
 * @bootstrapp/light/signals/listeners: a list of callbacks that behaves as a
 * Set of them does, for a runtime that cannot hold functions in a Set. A
 * callback is held once and in the order it was added; one added while the
 * list runs is reached in the same run, and one removed before its turn is
 * skipped.
 */
export class Listeners    {
  items                  = [];
  running = 0;

  get size()         {
    let count = 0;
    for (const cb of this.items) if (cb !== null) count++;
    return count;
  }

  has(cb   )          {
    return this.items.includes(cb);
  }

  add(cb   )       {
    if (!this.items.includes(cb)) this.items.push(cb);
    return this;
  }

  delete(cb   )          {
    const at = this.items.indexOf(cb);
    if (at === -1) return false;
    if (this.running > 0) this.items[at] = null;
    else this.items.splice(at, 1);
    return true;
  }

  clear()       {
    if (this.running > 0) this.items.fill(null);
    else this.items = [];
  }

  forEach(run                 )       {
    this.running++;
    try {
      for (let i = 0; i < this.items.length; i++) {
        const cb = this.items[i];
        if (cb !== null) run(cb);
      }
    } finally {
      this.running--;
      if (this.running === 0 && this.items.includes(null)) this.items = this.items.filter((cb) => cb !== null);
    }
  }
}
