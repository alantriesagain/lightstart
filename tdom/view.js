/**
 * @bootstrapp/light/tdom/view: a component on the terminal. A View is a
 * ViewCore that owns a box: `render()` answers a template rendered into
 * the box, signal fields it reads re-render it, `${this.child}` in a
 * template places a child view's box, and the host attaches the view when
 * its box joins the root's tree and detaches it when it leaves. The
 * lifecycle hooks are methods: `connected`, `disconnected`, `willUpdate`,
 * `firstUpdated`, `updated`.
 */
import { disposeTree, render } from "../html/core.js";
import { currentHost } from "../html/host.js";
import { ViewCore } from "../view/core.js";
import { TBox, TElement } from "./node.ts";

export class View extends ViewCore {
  constructor() {
    super();
    this.box = new TBox("view");
    this.box.owner = this;
  }

  get $node() {
    return this.box;
  }

  get $label() {
    return this.box.tag;
  }

  /**
   * @param {string} name
   * @param {Map<string, unknown> | null} changedProps
   */
  $hook(name, changedProps) {
    /** @type {Map<string, unknown>} */
    const changed = changedProps === null ? new Map() : changedProps;
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

  /** @param {Map<string, unknown>} _changed */
  willUpdate(_changed) {}

  /** @param {Map<string, unknown>} _changed */
  firstUpdated(_changed) {}

  /** @param {Map<string, unknown>} _changed */
  updated(_changed) {}

  $render() {
    return this.render();
  }

  /** @returns {unknown} the template to render into the box */
  render() {
    return null;
  }

  /** @param {unknown} value */
  $commit(value) {
    render(value, this.box, { host: this });
  }

  dispose() {
    this.$detach();
    disposeTree(this.box);
  }
}

/**
 * Put a view's box at the end of `parent`; a connected parent attaches it.
 * @param {View} view
 * @param {TElement} parent
 */
export const mount = (view, parent) => {
  currentHost().insertBefore(parent, view.box, null);
};

/**
 * Take a view's box out of its parent, detaching the view.
 * @param {View} view
 */
export const unmount = (view) => {
  currentHost().remove(view.box);
};
