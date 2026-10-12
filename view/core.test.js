import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { configure, html, render } from "../html/core.js";
import { effect, signal } from "../signals/index.js";
import { MRoot, MarkupHost, markupOf } from "../markup/index.js";
import { ViewCore, configureView } from "./core.js";

class MarkupView extends ViewCore {
  /**
   * @param {MarkupHost} host
   * @param {string} tag
   */
  constructor(host, tag) {
    super();
    this.host = host;
    this.el = host.createElement(tag);
    /** @type {string[]} */
    this.hooks = [];
    this.renders = 0;
    /** @type {(() => unknown) | null} */
    this.template = null;
  }

  get $node() {
    return this.el;
  }

  get $label() {
    return this.el.tag;
  }

  /**
   * @param {string} name
   * @param {Map<string, unknown> | null} changedProps
   */
  $hook(name, changedProps) {
    this.hooks.push(changedProps === null ? name : `${name}:${[...changedProps.keys()].join(",")}`);
  }

  $render() {
    this.renders++;
    return this.template === null ? null : this.template();
  }

  /** @param {unknown} value */
  $commit(value) {
    render(value, this.el, { host: this });
  }

  /** @param {import("../markup/index.js").MElement} parent */
  mount(parent) {
    this.host.insertBefore(parent, this.el, null);
    this.$attach();
  }

  unmount() {
    this.$detach();
    this.host.remove(this.el);
  }
}

describe("light/view/core on markup", () => {
  /** @type {MarkupHost} */
  let host;
  /** @type {MRoot} */
  let root;
  const frame = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    host = new MarkupHost();
    configure({ host, effect });
    root = new MRoot();
  });

  afterEach(() => {
    configureView({ track: () => {} });
  });

  it("renders on attach, resolves the update it scheduled, and runs the hooks in order", async () => {
    const view = new MarkupView(host, "x-a");
    view.template = () => html`<b>hi</b>`;
    view.mount(root);
    assert.equal(view.renders, 0);
    await view.$requestUpdate();
    assert.equal(markupOf(root), "<x-a><b>hi</b></x-a>");
    assert.deepEqual(view.hooks, ["connected", "willUpdate:", "firstUpdated:", "updated:"]);
    assert.equal(view.$hasUpdated, true);
  });

  it("re-renders when a signal its render read changes, once per flush", async () => {
    const view = new MarkupView(host, "x-b");
    const n = signal(0);
    view.template = () => html`${n.value}`;
    view.mount(root);
    await view.$requestUpdate();
    n.value = 1;
    n.value = 2;
    assert.ok(view.$updatePromise);
    await view.$requestUpdate();
    assert.equal(markupOf(root), "<x-b>2</x-b>");
    assert.equal(view.renders, 2);
  });

  it("flushes parents before children, and a child dirtied twice once", async () => {
    const parent = new MarkupView(host, "x-p");
    const child = new MarkupView(host, "x-c");
    /** @type {string[]} */
    const order = [];
    parent.template = () => (order.push("parent"), null);
    child.template = () => (order.push("child"), null);
    parent.mount(root);
    child.mount(parent.el);
    await Promise.all([child.$requestUpdate(), parent.$requestUpdate()]);
    order.length = 0;
    child.$requestUpdate();
    parent.$requestUpdate();
    child.$requestUpdate();
    await parent.$requestUpdate();
    assert.deepEqual(order, ["parent", "child"]);
  });

  it("skips a view detached before its turn and renders it when it returns", async () => {
    const view = new MarkupView(host, "x-d");
    view.template = () => html`x`;
    view.mount(root);
    view.unmount();
    await frame();
    assert.equal(view.renders, 0);
    view.mount(root);
    await view.$requestUpdate();
    assert.equal(view.renders, 1);
  });

  it("keeps updating after a render throws, reporting the error through the host", async () => {
    const view = new MarkupView(host, "x-e");
    /** @type {unknown[]} */
    const reported = [];
    host.onError = (error) => reported.push(error);
    let fail = true;
    view.template = () => {
      if (fail) throw new Error("boom");
      return html`ok`;
    };
    view.mount(root);
    await view.$requestUpdate();
    assert.equal(reported.length, 1);
    fail = false;
    await view.$requestUpdate();
    assert.equal(markupOf(root), "<x-e>ok</x-e>");
  });

  it("drops recorded keys whose value did not change", async () => {
    const view = new MarkupView(host, "x-f");
    view.$hasChanged = (key) => key === "changed";
    view.mount(root);
    await view.$requestUpdate();
    view.hooks.length = 0;
    await view.$requestUpdate("same", 1);
    assert.deepEqual(view.hooks, []);
    await view.$requestUpdate("changed", 1);
    assert.deepEqual(view.hooks, ["willUpdate:changed", "updated:changed"]);
  });

  it("runs owned teardowns on detach and stops following its signals", async () => {
    const view = new MarkupView(host, "x-g");
    const n = signal(0);
    let torn = 0;
    view.template = () => html`${n.value}`;
    view.$own(() => torn++);
    view.mount(root);
    await view.$requestUpdate();
    view.unmount();
    assert.equal(torn, 1);
    assert.deepEqual(view.hooks.at(-1), "disconnected");
    n.value = 1;
    await frame();
    assert.equal(view.renders, 1);
  });

  it("hands the host's tracker every scheduled update by label", async () => {
    /** @type {string[]} */
    const tracked = [];
    configureView({ track: (label) => () => tracked.push(label) });
    const view = new MarkupView(host, "x-h");
    view.mount(root);
    await view.$requestUpdate();
    assert.deepEqual(tracked, ["view:x-h"]);
  });
});
