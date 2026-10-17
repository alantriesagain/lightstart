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

/** `<test-card>`: a default slot with a fallback, inside a bordered box. */
export class Card extends View {
  override render(): unknown {
    return html`<box border title="card"><slot><text>fallback</text></slot></box>`;
  }
}

/** `<test-layout>`: a named slot, then the default one. */
export class Layout extends View {
  override render(): unknown {
    return html`<box><text>header:</text><slot name="head"><text>no head</text></slot><text>body:</text><slot></slot></box>`;
  }
}

/** `<test-nested>`: a default slot whose fallback holds another default slot. */
export class Nested extends View {
  override render(): unknown {
    return html`<box><slot><box><slot><text>inner fallback</text></slot></box></slot></box>`;
  }
}

/** `<test-swap>`: one of two templates, each with a default slot. */
export class Swap extends View {
  mode: Signal<string>;

  constructor() {
    super();
    this.mode = signal("a");
  }

  override render(): unknown {
    return this.mode.value === "a" ? html`<box><text>A:</text><slot></slot></box>` : html`<box><text>B:</text><slot></slot></box>`;
  }
}

/** `<test-later>`: a slot a thunk renders once `show` is on. */
export class Later extends View {
  show: Signal<boolean>;

  constructor() {
    super();
    this.show = signal(false);
  }

  override render(): unknown {
    return html`<box><text>content</text>${() => (this.show.value ? html`<slot></slot>` : null)}</box>`;
  }
}

/** `<test-grower>`: a default slot, and a named `side` slot once `more` is on. */
export class Grower extends View {
  more: Signal<boolean>;

  constructor() {
    super();
    this.more = signal(false);
  }

  override render(): unknown {
    return html`<box><slot></slot>${() => (this.more.value ? html`<slot name="side"></slot>` : null)}</box>`;
  }
}

/** `<test-watch>`: counts the slotchange events of its slot. */
export class Watch extends View {
  changes: number;

  constructor() {
    super();
    this.changes = 0;
  }

  override render(): unknown {
    return html`<box><slot @slotchange=${() => {
      this.changes++;
    }}></slot></box>`;
  }
}

/** `<test-forward>`: forwards its default slot through a card. */
export class Forward extends View {
  override render(): unknown {
    return html`<box><test-card><slot></slot></test-card></box>`;
  }
}

/** A view placing a counter inside a card's tag, so the counter is slotted. */
export class Slotter extends View {
  child: Counter;

  constructor() {
    super();
    this.child = new Counter();
  }

  override render(): unknown {
    return html`<test-card>${this.child}</test-card>`;
  }
}

define("test-card", () => new Card());
define("test-layout", () => new Layout());
define("test-nested", () => new Nested());
define("test-swap", () => new Swap());
define("test-later", () => new Later());
define("test-grower", () => new Grower());
define("test-watch", () => new Watch());
define("test-forward", () => new Forward());
