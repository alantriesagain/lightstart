/**
 * @file A reply's headers as two parallel lists, names lower-cased and values as given, in the
 * order they were added. A repeated name keeps every value, so two `set-cookie` headers are two
 * entries and reach the wire as two lines; `get` joins a repeated name with ", ", as Fetch's
 * `Headers` does for every name but `set-cookie`. The node adapter writes `flat()` in one
 * `writeHead` call and the fetch adapter builds a `Headers` from the same pairs.
 */
export class HeaderList {
  readonly names: string[] = [];
  readonly values: string[] = [];

  /** Replaces every value of `name` with `value`. */
  set(name: string, value: string): void {
    const key = name.toLowerCase();
    this.delete(key);
    this.names.push(key);
    this.values.push(value);
  }

  /** Adds `value` after the values `name` already has. */
  append(name: string, value: string): void {
    this.names.push(name.toLowerCase());
    this.values.push(value);
  }

  /** Sets `name` only when it has no value yet. */
  default(name: string, value: string): void {
    const key = name.toLowerCase();
    if (this.names.indexOf(key) < 0) {
      this.names.push(key);
      this.values.push(value);
    }
  }

  /** The values of `name` joined with ", ", or null when it has none. */
  get(name: string): string | null {
    const key = name.toLowerCase();
    let out: string | null = null;
    for (let i = 0; i < this.names.length; i++)
      if (this.names[i] === key) out = out === null ? this.values[i]! : out + ", " + this.values[i]!;
    return out;
  }

  /** Every value of `name`, in order: the form a repeated `set-cookie` is read in. */
  all(name: string): string[] {
    const key = name.toLowerCase();
    const out: string[] = [];
    for (let i = 0; i < this.names.length; i++) if (this.names[i] === key) out.push(this.values[i]!);
    return out;
  }

  has(name: string): boolean {
    return this.names.indexOf(name.toLowerCase()) >= 0;
  }

  /** Removes every value of `name`. */
  delete(name: string): void {
    const key = name.toLowerCase();
    let at = this.names.indexOf(key);
    while (at >= 0) {
      this.names.splice(at, 1);
      this.values.splice(at, 1);
      at = this.names.indexOf(key, at);
    }
  }

  get size(): number {
    return this.names.length;
  }

  /** Name, value, name, value: the array form node's `writeHead` takes. */
  flat(): string[] {
    const out: string[] = [];
    for (let i = 0; i < this.names.length; i++) {
      out.push(this.names[i]!);
      out.push(this.values[i]!);
    }
    return out;
  }
}
