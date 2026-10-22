/**
 * @bootstrapp/light/native/tui/view: a component on the terminal. A View is a
 * ViewCore that owns a box: `render()` answers a template rendered into
 * the box, signal fields it reads re-render it, `${this.child}` in a
 * template places a child view's box, and the host attaches the view when
 * its box joins the root's tree and detaches it when it leaves. The
 * lifecycle hooks are methods: `connected`, `disconnected`, `willUpdate`,
 * `firstUpdated`, `updated`. A subclass `define`d under a tag is made by
 * the host wherever a template writes that tag: its `prop`s receive the
 * tag's attributes and `.prop=` bindings, `$emit` sends an event a parent
 * handles with `@type=`, the children the parent wrote inside the tag
 * project into the `<slot>`s of its template, and the host disposes it
 * with its element.
 */
import { disposeTree, render } from "../../html/core.ts";
import { currentHost } from "../../html/host.ts";
import { Signal, signal } from "../../signals/index.ts";
import { ViewCore } from "../../view/core.ts";
import { CustomEvent } from "./events.ts";
import { TBox, TElement, asBool, asNumber } from "./node.ts";
import { TSlotPart, projectSlots } from "./slots.ts";
import { TagDefinition, registerTag } from "./tags.ts";

/**
 * A declared prop as its view reads and writes it, typed over the
 * `Signal<unknown>` the host sets by name. A `Signal<unknown>` cannot
 * become a `Signal<T>` natively (the two differ in layout), so the typed
 * side is this wrapper; reading `value` in `render()` tracks it like a
 * signal's.
 */
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

export class View extends ViewCore {
  box: TBox;
  $props: Map<string, Signal<unknown>> | null;
  $defined: boolean;
  $slots: TSlotPart[];
  $projectQueued: boolean;

  constructor() {
    super();
    this.box = new TBox("view");
    this.box.owner = this;
    this.$props = null;
    this.$defined = false;
    this.$slots = [];
    this.$projectQueued = false;
  }

  get $node(): unknown {
    return this.box;
  }

  get $label() {
    return this.box.tag;
  }

  $hook(name: string, changedProps: Map<string, unknown> | null) {
    const changed: Map<string, unknown> = changedProps === null ? new Map() : changedProps;
    switch (name) {
      case "connected":
        this.connected();
        return;
      case "disconnected":
        this.disconnected();
        return;
      case "willUpdate":
        this.willUpdate(changed);
        return;
      case "firstUpdated":
        this.firstUpdated(changed);
        return;
      default:
        this.updated(changed);
    }
  }

  connected() {}

  disconnected() {}

  willUpdate(_changed: Map<string, unknown>) {}

  firstUpdated(_changed: Map<string, unknown>) {}

  updated(_changed: Map<string, unknown>) {}

  /**
   * Declare a prop, in a field initializer: `rows = this.prop("rows", []
   * as Task[])`. The host sets it by name from the element's attributes
   * and `.prop=` bindings, and `render()` reads `this.rows.value`. A name
   * is lowercase, as attributes are.
   */
  prop<T>(name: string, initial: T): Prop<T> {
    if (name !== name.toLowerCase()) throw new Error("[tdom] prop \"" + name + "\": a prop's name is lowercase, as an attribute's is");
    if (this.$props === null) this.$props = new Map<string, Signal<unknown>>();
    if (this.$props.has(name)) throw new Error("[tdom] prop \"" + name + "\" is declared twice");
    const sig = signal<unknown>(initial);
    this.$props.set(name, sig);
    return new Prop<T>(sig);
  }

  /**
   * Take a prop by name, as the host hands an attribute or a binding: a
   * string takes the type of the prop's current value when that is a
   * number or a boolean, a bare attribute on a string prop is "", anything
   * else lands as given. Answers false for an undeclared name.
   */
  $setProp(name: string, value: unknown): boolean {
    if (this.$props === null) return false;
    const sig = this.$props.get(name);
    if (sig === undefined) return false;
    const current = sig.peek();
    if (typeof value === "string" && typeof current === "number") sig.value = asNumber(name, value);
    else if (typeof value === "string" && typeof current === "boolean") sig.value = asBool(value);
    else if (value === true && typeof current === "string") sig.value = "";
    else sig.value = value;
    return true;
  }

  /**
   * Dispatch a CustomEvent from the view's box: a parent's `@type=` handler
   * receives it, and it bubbles on unless one consumes it. Answers the
   * event; `consumed` says a handler took it.
   */
  $emit(type: string, detail: unknown): CustomEvent {
    const e = new CustomEvent(type, detail);
    this.box.dispatch(e);
    return e;
  }

  $render() {
    return this.render();
  }

  /** @returns the template to render into the box */
  render(): unknown {
    return null;
  }

  $commit(value: unknown) {
    render(value, this.box, { host: this });
    this.$project();
  }

  /** Project the box's light units into the slots of what rendered. */
  $project() {
    this.$projectQueued = false;
    if (this.$slots.length > 0) projectSlots(this.box, this.$slots);
  }

  /** Project on the next microtask: for a slot that appears outside a commit, as one a thunk renders later. */
  $queueProject() {
    if (this.$projectQueued) return;
    this.$projectQueued = true;
    Promise.resolve().then(() => {
      if (this.$projectQueued) this.$project();
    });
  }

  dispose() {
    this.$detach();
    disposeTree(this.box);
  }
}

/**
 * Register a tag: a template writing `<tag>` gets a new instance of the
 * class, its box the element, disposed by the host when the element leaves
 * the tree. The tag is lowercase with a hyphen, and defined once. A view
 * the app constructs and places with `${view}` is the app's to dispose,
 * whether or not its class is defined.
 */
export const define = (tag: string, cls: new () => View) => {
  registerTag(new TagDefinition(tag, () => {
    const view = new cls();
    view.box.tag = tag;
    view.$defined = true;
    return view.box;
  }));
};

/**
 * Put a view's box at the end of `parent`; a connected parent attaches it.
 */
export const mount = (view: View, parent: TElement) => {
  currentHost().insertBefore(parent, view.box, null);
};

/**
 * Take a view's box out of its parent, detaching the view; the content of
 * any defined element inside is dropped with it.
 */
export const unmount = (view: View) => {
  currentHost().remove(view.box);
};
