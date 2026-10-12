/**
 * @bootstrapp/light/dom/host.js: the browser host. Templates are prepared
 * through `<template>` + `innerHTML` (the parser of record for lit parity)
 * and cloned with `importNode` + a TreeWalker, exactly as the engine did
 * before the host seam; nodes are DOM nodes; listeners are the engine's
 * bindings registered as `EventListenerObject`s; frames are animation frames.
 */

import { Clone, Host, ListenerOptions, Prepared } from "../html/host.js";
import { MARKER_START, SVG_KIND } from "../html/constants.js";
import { parseTemplate } from "../html/parser.js";
import { SlotPart } from "./slots.js";

/** @import { HostNode } from "../html/host.js" */
/** @import { PartSpec } from "../html/types.ts" */

const SHOW_ELEMENT_AND_COMMENT = 129;
const ELEMENT_MARKER = "data-$$";

/** A prepared DOM template: the part specs with the node index each binds to, and the `<template>` holding the markup. */
export class DomPrepared extends Prepared {
  /**
   * @param {PartSpec[]} parts
   * @param {HTMLTemplateElement} el
   */
  constructor(parts, el) {
    super(parts);
    this.el = el;
  }
}

/** @param {unknown} value */
const isNode = (value) => value !== null && typeof value === "object" && typeof (/** @type {{ nodeType?: unknown }} */ (value).nodeType) === "number";

export class DomHost extends Host {
  /** @type {(() => void) | null} */
  _flush = null;
  _frameId = 0;
  _watchingVisibility = false;

  /**
   * @param {ReadonlyArray<string>} strings
   * @param {number} kind
   * @returns {DomPrepared}
   */
  prepare(strings, kind) {
    const { markup, parts } = parseTemplate(strings, kind);
    const el = document.createElement("template");
    el.innerHTML = kind === SVG_KIND ? `<svg>${markup}</svg>` : markup;
    if (kind === SVG_KIND) {
      const wrapper = /** @type {Element} */ (el.content.firstChild);
      wrapper.replaceWith(.../** @type {Iterable<ChildNode>} */ (/** @type {unknown} */ (wrapper.childNodes)));
    }
    const walker = document.createTreeWalker(el.content, SHOW_ELEMENT_AND_COMMENT);
    /** @type {number[]} */
    const elIndex = [];
    /** @type {number[]} */
    const childIndex = [];
    let nodeIndex = -1;
    let node;
    while ((node = walker.nextNode())) {
      nodeIndex++;
      if (node.nodeType === 1 && /** @type {Element} */ (node).hasAttribute(ELEMENT_MARKER)) {
        /** @type {Element} */ (node).removeAttribute(ELEMENT_MARKER);
        elIndex.push(nodeIndex);
      } else if (node.nodeType === 8 && /** @type {Comment} */ (node).data === MARKER_START) childIndex.push(nodeIndex);
    }
    const specs = parts
      .map((p) => ({
        ...p,
        nodeIndex: p.kind === "child" ? childIndex[/** @type {number} */ (p.childOrd)] : elIndex[/** @type {number} */ (p.elOrd)],
      }))
      .sort((a, b) => a.nodeIndex - b.nodeIndex || a.valueIndex - b.valueIndex);
    return new DomPrepared(specs, el);
  }

  /**
   * @param {Prepared} prepared
   * @returns {Clone}
   */
  clone(prepared) {
    const dom = /** @type {DomPrepared} */ (prepared);
    const fragment = document.importNode(dom.el.content, true);
    const specs = dom.parts;
    /** @type {HostNode[]} */
    const targets = [];
    if (specs.length > 0) {
      const walker = document.createTreeWalker(fragment, SHOW_ELEMENT_AND_COMMENT);
      let nodeIndex = -1;
      let partIdx = 0;
      let node;
      while (partIdx < specs.length && (node = walker.nextNode())) {
        nodeIndex++;
        while (partIdx < specs.length && specs[partIdx].nodeIndex === nodeIndex) {
          targets.push(node);
          partIdx++;
        }
      }
    }
    return new Clone(fragment, targets);
  }

  /** @param {string} text */
  createText(text) {
    return new Text(text);
  }

  /**
   * @param {HostNode} node
   * @param {string} text
   */
  setText(node, text) {
    /** @type {Text} */ (node).data = text;
  }

  /** @param {string} label */
  createAnchor(label) {
    return new Comment(label);
  }

  /** @param {string} tag */
  createElement(tag) {
    return document.createElement(tag);
  }

  createFragment() {
    return document.createDocumentFragment();
  }

  /**
   * @param {HostNode} parent
   * @param {HostNode} node
   * @param {HostNode | null} ref
   */
  insertBefore(parent, node, ref) {
    /** @type {Node} */ (parent).insertBefore(/** @type {Node} */ (node), /** @type {Node | null} */ (ref));
  }

  /**
   * Remove a node through the DOM's own method, so a component that defines a
   * `remove()` of its own cannot keep itself in the tree.
   * @param {HostNode} node
   */
  remove(node) {
    const n = /** @type {Node} */ (node);
    const parent = n.parentNode;
    if (parent) Node.prototype.removeChild.call(parent, n);
  }

  /** @param {HostNode} node */
  parentOf(node) {
    return /** @type {Node} */ (node).parentNode;
  }

  /** @param {HostNode} node */
  nextSibling(node) {
    return /** @type {Node} */ (node).nextSibling;
  }

  /** @param {HostNode} node */
  isConnected(node) {
    return /** @type {Node} */ (node).isConnected;
  }

  /** @param {unknown} value */
  asNode(value) {
    return isNode(value) ? value : null;
  }

  /** @param {unknown} value */
  toList(value) {
    if (value === null || typeof value !== "object") return null;
    const iterator = /** @type {{ [Symbol.iterator]?: unknown }} */ (value)[Symbol.iterator];
    return typeof iterator === "function" ? [.../** @type {Iterable<unknown>} */ (value)] : null;
  }

  /** @param {unknown} value */
  stringify(value) {
    return String(value);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {string} value
   */
  setAttribute(el, name, value) {
    /** @type {Element} */ (el).setAttribute(name, value);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   */
  removeAttribute(el, name) {
    /** @type {Element} */ (el).removeAttribute(name);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {boolean} on
   */
  toggleAttribute(el, name, on) {
    /** @type {Element} */ (el).toggleAttribute(name, on);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {unknown} value
   */
  setProperty(el, name, value) {
    /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (el))[name] = value;
  }

  /**
   * @param {HostNode} el
   * @param {string} text
   */
  setContent(el, text) {
    /** @type {Element} */ (el).textContent = text;
  }

  /** @param {unknown} handler */
  listenerOptions(handler) {
    if (handler === null || typeof handler !== "object") return null;
    const o = /** @type {{ capture?: unknown, once?: unknown, passive?: unknown }} */ (handler);
    return new ListenerOptions(o.capture === true, o.once === true, o.passive === true);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {{ handleEvent: (event: unknown) => unknown }} binding
   * @param {ListenerOptions | null} options
   */
  addListener(el, name, binding, options) {
    const listener = /** @type {EventListenerObject} */ (/** @type {unknown} */ (binding));
    if (options === null) /** @type {Element} */ (el).addEventListener(name, listener);
    else /** @type {Element} */ (el).addEventListener(name, listener, { capture: options.capture, once: options.once, passive: options.passive });
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {{ handleEvent: (event: unknown) => unknown }} binding
   * @param {ListenerOptions | null} options
   */
  removeListener(el, name, binding, options) {
    const listener = /** @type {EventListenerObject} */ (/** @type {unknown} */ (binding));
    if (options === null) /** @type {Element} */ (el).removeEventListener(name, listener);
    else /** @type {Element} */ (el).removeEventListener(name, listener, { capture: options.capture });
  }

  /**
   * @param {unknown} handler
   * @param {unknown} event
   */
  invokeListener(handler, event) {
    const h = /** @type {{ handleEvent?: (event: unknown) => unknown } | null | undefined} */ (handler);
    return h?.handleEvent?.(event);
  }

  /** @param {string} markup */
  parseMarkup(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup;
    return template.content;
  }

  /**
   * @param {PartSpec} spec
   * @param {HostNode} el
   * @param {object | undefined} owner
   */
  createSlotPart(spec, el, owner) {
    return new SlotPart(spec, /** @type {Element} */ (el), owner);
  }

  /** @param {() => void} flush */
  scheduleFlush(flush) {
    if (document.visibilityState === "hidden") setTimeout(flush, 0);
    else {
      this._flush = flush;
      this._frameId = requestAnimationFrame(() => {
        this._flush = null;
        flush();
      });
      if (!this._watchingVisibility) {
        this._watchingVisibility = true;
        document.addEventListener("visibilitychange", () => this._onVisibilityChange());
      }
    }
  }

  _onVisibilityChange() {
    const flush = this._flush;
    if (document.visibilityState !== "hidden" || flush === null) return;
    cancelAnimationFrame(this._frameId);
    this._flush = null;
    setTimeout(flush, 0);
  }

  /** @param {unknown} error */
  reportError(error) {
    reportError(error);
  }
}
