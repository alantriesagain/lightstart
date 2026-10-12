/**
 * @bootstrapp/light/html/host.js: the renderer behind the parts engine. The
 * engine never touches a document; it asks the installed host to prepare and
 * clone templates, create and move nodes, write attributes, properties and
 * text, and bind listeners. The browser host is `dom/host.js`; a terminal or
 * string host implements the same class. `configure({ host })` installs one;
 * until then every method throws, so a page that renders without a host
 * fails at its first render rather than later.
 */

/** @import { PartSpec } from "./types.ts" */

/** @typedef {unknown} HostNode An opaque node of the active host; only the host reads it. */

/**
 * @param {string} what
 * @returns {never}
 */
const unsupported = (what) => {
  throw new Error(`[light/html] the active host does not support ${what}`);
};

/** A template the host prepared: the part specs in document order, plus whatever the host keeps beside them. */
export class Prepared {
  /** @param {PartSpec[]} parts */
  constructor(parts) {
    this.parts = parts;
  }
}

/** A fresh copy of a prepared template: its root (a fragment or a list holder) and the node each part binds to, in `parts` order. */
export class Clone {
  /**
   * @param {HostNode} root
   * @param {HostNode[]} targets
   */
  constructor(root, targets) {
    this.root = root;
    this.targets = targets;
  }
}

/** Listener options as the engine compares them; a host reads them off a handler object it understands. */
export class ListenerOptions {
  /**
   * @param {boolean} capture
   * @param {boolean} once
   * @param {boolean} passive
   */
  constructor(capture, once, passive) {
    this.capture = capture;
    this.once = once;
    this.passive = passive;
  }

  /** @param {ListenerOptions | null} other */
  equals(other) {
    return other !== null && other.capture === this.capture && other.once === this.once && other.passive === this.passive;
  }
}

/** The renderer interface. Every method throws here; a host overrides what it supports. */
export class Host {
  /**
   * @param {ReadonlyArray<string>} strings
   * @param {number} kind
   * @returns {Prepared}
   */
  prepare(strings, kind) {
    return unsupported(`templates (${String(strings.length)} strings, kind ${String(kind)})`);
  }

  /**
   * @param {Prepared} prepared
   * @returns {Clone}
   */
  clone(prepared) {
    return unsupported(`cloning templates (${String(prepared.parts.length)} parts)`);
  }

  /**
   * @param {string} text
   * @returns {HostNode}
   */
  createText(text) {
    return unsupported(`text nodes (${JSON.stringify(text)})`);
  }

  /**
   * @param {HostNode} node
   * @param {string} text
   */
  setText(node, text) {
    unsupported(`text updates (${JSON.stringify(text)}, ${String(node === null)})`);
  }

  /**
   * @param {string} label
   * @returns {HostNode}
   */
  createAnchor(label) {
    return unsupported(`anchors (${label})`);
  }

  /**
   * @param {string} tag
   * @returns {HostNode}
   */
  createElement(tag) {
    return unsupported(`elements (<${tag}>)`);
  }

  /** @returns {HostNode} a parent whose children move out of it when it is inserted */
  createFragment() {
    return unsupported("fragments");
  }

  /**
   * @param {HostNode} parent
   * @param {HostNode} node
   * @param {HostNode | null} ref
   */
  insertBefore(parent, node, ref) {
    unsupported(`insertion (${String(parent === node)}, ${String(ref === null)})`);
  }

  /** @param {HostNode} node detach through the host's own primitive, never a method the node may override */
  remove(node) {
    unsupported(`removal (${String(node === null)})`);
  }

  /**
   * @param {HostNode} node
   * @returns {HostNode | null}
   */
  parentOf(node) {
    return unsupported(`parent lookup (${String(node === null)})`);
  }

  /**
   * @param {HostNode} node
   * @returns {HostNode | null}
   */
  nextSibling(node) {
    return unsupported(`sibling lookup (${String(node === null)})`);
  }

  /**
   * @param {HostNode} node
   * @returns {boolean}
   */
  isConnected(node) {
    return unsupported(`connectivity (${String(node === null)})`);
  }

  /**
   * The node a child-position value stands for, or null when the value is not a node of this host.
   * @param {unknown} value
   * @returns {HostNode | null}
   */
  asNode(value) {
    return value === null ? null : null;
  }

  /**
   * A non-array iterable as a list, or null when the value is not one.
   * @param {unknown} value
   * @returns {unknown[] | null}
   */
  toList(value) {
    return value === null ? null : null;
  }

  /**
   * The text for a child value the engine cannot classify (an object).
   * @param {unknown} value
   * @returns {string}
   */
  stringify(value) {
    return unsupported(`unknown child values (${typeof value})`);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {string} value
   */
  setAttribute(el, name, value) {
    unsupported(`attributes (${name}=${JSON.stringify(value)}, ${String(el === null)})`);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   */
  removeAttribute(el, name) {
    unsupported(`attribute removal (${name}, ${String(el === null)})`);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {boolean} on
   */
  toggleAttribute(el, name, on) {
    unsupported(`boolean attributes (${name}=${String(on)}, ${String(el === null)})`);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {unknown} value
   */
  setProperty(el, name, value) {
    unsupported(`properties (.${name}, ${typeof value}, ${String(el === null)})`);
  }

  /**
   * The whole text content of a raw-text element (`<textarea>`, `<title>`, …).
   * @param {HostNode} el
   * @param {string} text
   */
  setContent(el, text) {
    unsupported(`raw text (${JSON.stringify(text)}, ${String(el === null)})`);
  }

  /**
   * The options a handler value carries, or null for a plain handler.
   * @param {unknown} handler
   * @returns {ListenerOptions | null}
   */
  listenerOptions(handler) {
    return handler === null ? null : null;
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {{ handleEvent: (event: unknown) => unknown }} binding
   * @param {ListenerOptions | null} options
   */
  addListener(el, name, binding, options) {
    unsupported(`listeners (@${name}, ${String(binding === null)}, ${String(options === null)}, ${String(el === null)})`);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {{ handleEvent: (event: unknown) => unknown }} binding
   * @param {ListenerOptions | null} options
   */
  removeListener(el, name, binding, options) {
    unsupported(`listener removal (@${name}, ${String(binding === null)}, ${String(options === null)}, ${String(el === null)})`);
  }

  /**
   * Invoke a handler that is not a function (a `handleEvent` object, say).
   * @param {unknown} handler
   * @param {unknown} event
   * @returns {unknown}
   */
  invokeListener(handler, event) {
    return unsupported(`object handlers (${typeof handler}, ${typeof event})`);
  }

  /**
   * Parse markup into a fragment, for `unsafeHTML`.
   * @param {string} markup
   * @returns {HostNode}
   */
  parseMarkup(markup) {
    return unsupported(`unsafeHTML (${String(markup.length)} chars)`);
  }

  /**
   * The part for a `<slot>` element, when the host projects light children.
   * @param {PartSpec} spec
   * @param {HostNode} el
   * @param {object | undefined} owner
   * @returns {{ setFromValues(values: unknown[]): void, adopt(values: unknown[], bind: boolean): void, dispose(): void }}
   */
  createSlotPart(spec, el, owner) {
    return unsupported(`slots (${String(spec.valueIndex)}, ${String(el === null)}, ${String(owner === undefined)})`);
  }

  /**
   * Whether a template may use this tag.
   * @param {string} tag
   * @returns {boolean}
   */
  knownTag(tag) {
    return tag.length > 0;
  }

  /**
   * Whether an element of `tag` takes a prop or attribute named `name`.
   * @param {string} tag
   * @param {string} name
   * @returns {boolean}
   */
  knownProp(tag, name) {
    return tag.length > 0 && name.length > 0;
  }

  /**
   * Run the view queue's flush once, on the host's next frame.
   * @param {() => void} flush
   */
  scheduleFlush(flush) {
    unsupported(`frame scheduling (${String(flush === null)})`);
  }
}

let host = new Host();

/** The installed host. */
export const currentHost = () => host;

/** @param {Host} next */
export const setHost = (next) => {
  host = next;
};
