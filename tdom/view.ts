/**
 * @bootstrapp/light/tdom/view: a component on the terminal. A View is a
 * ViewCore that owns a box: `render()` answers a template rendered into
 * the box, signal fields it reads re-render it, `${this.child}` in a
 * template places a child view's box, and the host attaches the view when
 * its box joins the root's tree and detaches it when it leaves. The
 * lifecycle hooks are methods: `connected`, `disconnected`, `willUpdate`,
 * `firstUpdated`, `updated`.
 */
import { disposeTree, render } from "../html/core.ts";
import { currentHost } from "../html/host.ts";
import { ViewCore } from "../view/core.ts";
import { TBox, TElement } from "./node.ts";

export class View extends ViewCore {
  box: TBox;

  constructor() {
    super();
    this.box = new TBox("view");
    this.box.owner = this;
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

  $render() {
    return this.render();
  }

  /** @returns the template to render into the box */
  render(): unknown {
    return null;
  }

  $commit(value: unknown) {
    render(value, this.box, { host: this });
  }

  dispose() {
    this.$detach();
    disposeTree(this.box);
  }
}

/**
 * Put a view's box at the end of `parent`; a connected parent attaches it.
 */
export const mount = (view: View, parent: TElement) => {
  currentHost().insertBefore(parent, view.box, null);
};

/**
 * Take a view's box out of its parent, detaching the view.
 */
export const unmount = (view: View) => {
  currentHost().remove(view.box);
};
