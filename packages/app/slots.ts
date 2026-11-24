/**
 * @file Slots: a named place an app leaves open for its extensions to fill.
 * The module that owns a place exports its handle (`defineSlot<Item>(name)`);
 * an extension fills it (`slot.fill(item)` or `slot.entry(item)` in its
 * `fills`), and whoever draws the place reads `slot.items`, a signal of the
 * items themselves in order: by `order` (0 when absent), then by fill order.
 * `slot.extensionOf(item)` answers the extension that filled one, `null` for a
 * fill from the app itself.
 */

import { signal } from "@lightstart/light/signals";
import type { Signal } from "@lightstart/light/signals";

class Held<Item extends object> {
  readonly item: Item;
  readonly extension: string | null;
  readonly seq: number;

  constructor(item: Item, extension: string | null, seq: number) {
    this.item = item;
    this.extension = extension;
    this.seq = seq;
  }
}

const orderOf = (item: object): number => {
  const order = Reflect.get(item, "order");
  return typeof order === "number" && Number.isFinite(order) ? order : 0;
};

const names = new Set<string>();

/** One item bound to its slot, for an extension's `fills`: `fill(extension)` puts it there and answers its withdraw. */
export class SlotEntry {
  readonly slot: string;
  readonly fill: (extension: string | null) => () => void;

  constructor(slot: string, fill: (extension: string | null) => () => void) {
    this.slot = slot;
    this.fill = fill;
  }
}

/** A named place extensions fill; `items` is the ordered list, a signal. */
export class Slot<Item extends object> {
  readonly name: string;
  readonly items: Signal<readonly Item[]>;
  private held: Held<Item>[] = [];
  private seq = 0;

  constructor(name: string) {
    this.name = name;
    this.items = signal<readonly Item[]>([]);
  }

  private publish(): void {
    const sorted = [...this.held].sort((a, b) => orderOf(a.item) - orderOf(b.item) || a.seq - b.seq);
    this.items.value = sorted.map((held) => held.item);
  }

  /** Add `item`, filled by `extension` (the app itself when absent); answers the function that withdraws it. */
  fill(item: Item, extension: string | null = null): () => void {
    const held = new Held(item, extension, this.seq++);
    this.held.push(held);
    this.publish();
    return () => {
      const at = this.held.indexOf(held);
      if (at < 0) return;
      this.held.splice(at, 1);
      this.publish();
    };
  }

  /** The extension that filled `item`: its name, `null` for the app's own fill or an item this slot does not hold. */
  extensionOf(item: Item): string | null {
    for (const held of this.held) if (held.item === item) return held.extension;
    return null;
  }

  /** Withdraw every item `extension` filled. */
  clear(extension: string): void {
    const kept = this.held.filter((held) => held.extension !== extension);
    if (kept.length === this.held.length) return;
    this.held = kept;
    this.publish();
  }

  /** This slot and `item`, typed, for an extension's `fills`. */
  entry(item: Item): SlotEntry {
    return new SlotEntry(this.name, (extension) => this.fill(item, extension));
  }
}

/** Define the slot named `name`; a second slot with the same name is an error. */
export const defineSlot = <Item extends object>(name: string): Slot<Item> => {
  if (name.trim() === "") throw new Error("A slot needs a name");
  if (names.has(name)) throw new Error(`The slot "${name}" is defined twice; export one handle and import it where it is filled and drawn`);
  names.add(name);
  return new Slot<Item>(name);
};

/** Forget every slot name, so a test can define its slots again. */
export const resetSlotNames = (): void => {
  names.clear();
};
