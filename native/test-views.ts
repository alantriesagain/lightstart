/**
 * @file The views the parts and elements tests mount: a counter that
 * records its lifecycle hooks, a parent that places it, and the defined
 * elements `<test-board>` and `<test-emitter>` with the shells that place
 * them. They are TypeScript because they subclass `View`, and scriptc
 * compiles a subclass of a TypeScript class reliably only when the subclass
 * is TypeScript too.
 */
import { View, define, html, signal } from "./index.js";
import type { Signal } from "../signals/index.ts";

/** A signal the board's template reads through a thunk, so a disposed thunk can be told from a live one. */
export const tick = signal(0);

export class Counter extends View {
  count: Signal<number>;
  renders: number;
  hooks: string[];

  constructor() {
    super();
    this.count = signal(0);
    this.renders = 0;
    this.hooks = [];
  }

  override connected() {
    this.hooks.push("connected");
  }

  override disconnected() {
    this.hooks.push("disconnected");
  }

  override updated(_changed: Map<string, unknown>) {
    this.hooks.push("updated");
  }

  override render(): unknown {
    this.renders++;
    return html`<text>count: ${this.count.value}</text>`;
  }
}

export class Parent extends View {
  child: Counter;
  label: Signal<string>;

  constructor() {
    super();
    this.child = new Counter();
    this.label = signal("top");
  }

  override render(): unknown {
    return html`<box border title=${this.label.value}>${this.child}</box>`;
  }
}

/** `<test-board>`: declared props, a count of renders, the hooks, and a thunk on `tick`. */
export class Board extends View {
  rows = this.prop("rows", [] as string[]);
  filter = this.prop("filter", "all");
  limit = this.prop("limit", 10);
  compact = this.prop("compact", false);
  renders: number;
  hooks: string[];

  constructor() {
    super();
    this.renders = 0;
    this.hooks = [];
  }

  override connected() {
    this.hooks.push("connected");
  }

  override disconnected() {
    this.hooks.push("disconnected");
  }

  override updated(_changed: Map<string, unknown>) {
    this.hooks.push("updated");
  }

  override render(): unknown {
    this.renders++;
    return html`<text>${this.filter.value}/${this.limit.value}${this.compact.value ? "/compact" : ""}: ${this.rows.value.join(",")} tick ${() => tick.value}</text>`;
  }
}

/** `<test-emitter>`: emits `picked` with a detail when asked. */
export class Emitter extends View {
  fire(detail: unknown) {
    return this.$emit("picked", detail);
  }

  override render(): unknown {
    return html`<text>emitter</text>`;
  }
}

/** A view placing `<test-board>` with bindings from its own signals. */
export class Shell extends View {
  rows: Signal<string[]>;
  limit: Signal<number>;

  constructor() {
    super();
    this.rows = signal(["a", "b"]);
    this.limit = signal(3);
  }

  override render(): unknown {
    return html`<box border><test-board .rows=${this.rows.value} filter="open" limit=${this.limit.value} compact flex=1></test-board></box>`;
  }
}

/** A view placing a hand-constructed `Board` by value, as a parent owns a child today. */
export class Owner extends View {
  child: Board;

  constructor() {
    super();
    this.child = new Board();
  }

  override render(): unknown {
    return html`<box>${this.child}</box>`;
  }
}

define("test-board", () => new Board());
define("test-emitter", () => new Emitter());
