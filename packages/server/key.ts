/**
 * @file A typed name for a value one request carries from a middleware to a handler
 * (`const USER = new Key<User>("user")`, then `c.set(USER, user)` and `c.get(USER)`), and for a
 * capability an adapter offers plugins. A key is its id: two keys with the same name are two
 * slots. The class has no methods and its type parameter no field, so every instantiation
 * shares one layout natively.
 */
let nextId = 0;

export class Key<T> {
  readonly id: number;
  readonly name: string;
  declare readonly type: T;

  constructor(name: string) {
    this.id = nextId++;
    this.name = name;
  }
}

/**
 * Values by key, in two parallel lists scanned in order: a request holds a handful, where a
 * `Map` keyed by objects costs more natively than the scan.
 */
export class Slots {
  readonly ids: number[] = [];
  readonly values: unknown[] = [];

  read(id: number): unknown {
    const at = this.ids.indexOf(id);
    return at < 0 ? undefined : this.values[at];
  }

  write(id: number, value: unknown): void {
    const at = this.ids.indexOf(id);
    if (at >= 0) this.values[at] = value;
    else {
      this.ids.push(id);
      this.values.push(value);
    }
  }
}
