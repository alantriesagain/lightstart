/**
 * @file A registry the kernel keeps: items under a key, each a plugin's (its owner), a later item of a
 * key replacing the earlier in its place, an owner's items dropped together. Three parallel arrays
 * and no function field, so a native build keeps the class as it is (probe p42).
 */

export class Keyed<T> {
  private keys: string[] = [];
  private owners: string[] = [];
  private items: T[] = [];
  /** What each key held before its current item, so removing a replacement restores it. */
  private previousOwners: string[][] = [];
  private previousItems: T[][] = [];

  /** Put `item` under `key` as `owner`'s: in the place of the earlier item of the key, else last. */
  put(key: string, owner: string, item: T): void {
    for (let i = 0; i < this.keys.length; i++)
      if (this.keys[i] === key) {
        this.previousOwners[i].push(this.owners[i]);
        this.previousItems[i].push(this.items[i]);
        this.owners[i] = owner;
        this.items[i] = item;
        return;
      }
    this.keys.push(key);
    this.owners.push(owner);
    this.items.push(item);
    this.previousOwners.push([]);
    this.previousItems.push([]);
  }

  /** The item under `key`, or null. */
  get(key: string): T | null {
    for (let i = 0; i < this.keys.length; i++) if (this.keys[i] === key) return this.items[i];
    return null;
  }

  /** Drop every item of `owner`; a key it replaced goes back to what it held before. */
  removeOwner(owner: string): void {
    for (let i = this.keys.length - 1; i >= 0; i--)
      if (this.owners[i] === owner) {
        const owners = this.previousOwners[i];
        const items = this.previousItems[i];
        if (items.length > 0) {
          this.owners[i] = owners.pop() ?? "";
          this.items[i] = items.pop() as T;
        } else {
          this.keys.splice(i, 1);
          this.owners.splice(i, 1);
          this.items.splice(i, 1);
          this.previousOwners.splice(i, 1);
          this.previousItems.splice(i, 1);
        }
      }
  }

  /** Every item, in the order added. */
  values(): T[] {
    return this.items.slice();
  }

  /** Every key, in the order added. */
  names(): string[] {
    return this.keys.slice();
  }
}
