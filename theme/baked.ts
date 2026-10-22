/**
 * @bootstrapp/light/theme/baked: the utility classes on a host from a table
 * baked ahead of time. `light classes:bake` compiles the class strings an
 * app's templates write through the engine once, under node, into entries of
 * `[classString, [name, value, state][]]` per scheme, and `BakedClasses`
 * answers them at run time by lookup, with no engine in the binary. The
 * keys are the exact strings the templates write; a string the table lacks
 * styles nothing and lands in `ignored`, token by token, which a test
 * asserting the set empty turns into a stale-table detector.
 */
import { ClassProp, ClassStyler } from "../native/tui/classes.ts";

import type { PropValue } from "../native/tui/node.ts";

/** One prop a class string means: the prop's name, its value and the state bits it needs (0 for always). */
export type BakedProp = [string, PropValue, number];

/** A class string, as a template writes it, with the props it means. */
export type BakedEntry = [string, BakedProp[]];

export class BakedClasses extends ClassStyler {
  table: Map<string, ClassProp[]>;
  /** The tokens of every class string the table lacked. */
  ignored: Set<string>;

  constructor(entries: BakedEntry[]) {
    super();
    this.table = new Map<string, ClassProp[]>();
    this.ignored = new Set<string>();
    for (const [classes, props] of entries) {
      const list: ClassProp[] = [];
      for (const [name, value, state] of props) list.push(new ClassProp(name, value, state));
      this.table.set(classes, list);
    }
  }

  override propsFor(classes: string): ClassProp[] {
    const hit = this.table.get(classes);
    if (hit !== undefined) return hit;
    for (const token of classes.split(/\s+/)) if (token.length > 0) this.ignored.add(token);
    return [];
  }
}
