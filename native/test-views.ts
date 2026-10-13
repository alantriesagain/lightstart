/**
 * @file The views the parts test mounts: a counter that records its
 * lifecycle hooks and a parent that places it. They are TypeScript because
 * they subclass `View`, and scriptc compiles a subclass of a TypeScript class
 * reliably only when the subclass is TypeScript too.
 */
import { View, html, signal } from "./index.js";
import type { Signal } from "../signals/index.ts";

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
