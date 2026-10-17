/**
 * Probe AG's shapes, the ones a terminal custom element would use: a base
 * class keeping declared props as `Signal<unknown>` in a Map and answering
 * each as a typed `Prop<T>` over that signal from a generic method a
 * subclass calls in its field initializers; a prop set by name with a
 * string coerced to the prop's type; a tag registry whose values are class
 * instances holding a factory. A `Signal<unknown>` cannot be cast to a
 * `Signal<T>` natively (the two instantiations differ in layout), so the
 * typed side is a wrapper whose one field is the unknown-typed signal.
 */
import { Signal, signal } from "../../signals/index.ts";

/** A declared prop as its view reads and writes it: typed over the `Signal<unknown>` the host sets by name. */
export class Prop<T> {
  sig: Signal<unknown>;

  constructor(sig: Signal<unknown>) {
    this.sig = sig;
  }

  get value(): T {
    return this.sig.value as T;
  }

  set value(next: T) {
    this.sig.value = next;
  }

  peek(): T {
    return this.sig.peek() as T;
  }
}

export class Base {
  $props: Map<string, Signal<unknown>> | null;

  constructor() {
    this.$props = null;
  }

  prop<T>(name: string, initial: T): Prop<T> {
    if (this.$props === null) this.$props = new Map<string, Signal<unknown>>();
    if (this.$props.has(name)) throw new Error("[probe] prop \"" + name + "\" declared twice");
    const sig = signal<unknown>(initial);
    this.$props.set(name, sig);
    return new Prop<T>(sig);
  }

  $setProp(name: string, value: unknown): boolean {
    if (this.$props === null) return false;
    const sig = this.$props.get(name);
    if (sig === undefined) return false;
    const current = sig.peek();
    if (typeof value === "string" && typeof current === "number") sig.value = Number(value);
    else if (typeof value === "string" && typeof current === "boolean") sig.value = value === "" || value === "true";
    else if (value === true && typeof current === "string") sig.value = "";
    else sig.value = value;
    return true;
  }
}

export class Sub extends Base {
  rows = this.prop("rows", [] as string[]);
  limit = this.prop("limit", 0);
  compact = this.prop("compact", false);
  label = this.prop("label", "x");

  describe(): string {
    return this.rows.value.join(",") + "|" + String(this.limit.value) + "|" + String(this.compact.value) + "|" + this.label.value;
  }

  bump(): number {
    this.limit.value = this.limit.peek() + 1;
    return this.limit.value;
  }
}

export class Other extends Base {
  describe(): string {
    return "other";
  }
}

/** A tag's definition: a class instance, since a Map's values cannot be functions natively. */
export class Def {
  tag: string;
  makeElement: () => Base;

  constructor(tag: string, makeElement: () => Base) {
    this.tag = tag;
    this.makeElement = makeElement;
  }
}

const defs = new Map<string, Def>();
let defined = 0;

export const registerDef = (def: Def) => {
  defs.set(def.tag, def);
  defined++;
};

/** The instance a tag makes, typed by the base, or null for an unknown tag. */
export const make = (tag: string): Base | null => {
  if (defined === 0) return null;
  const def = defs.get(tag);
  return def === undefined ? null : def.makeElement();
};

/** The same instance through `unknown`, the way a host hands nodes around. */
export const makeUnknown = (tag: string): unknown => make(tag);
