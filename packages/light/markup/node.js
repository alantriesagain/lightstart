/**
 * @lightstart/light/markup/node: an in-memory tree with the shape the
 * renderer's host seam needs and the DOM members a view reads. Elements hold
 * attributes, properties and listeners as maps; a fragment's children move
 * into the parent it is inserted into; a root is the one container whose
 * descendants count as connected.
 */

import { currentHost } from "../html/host.ts";

/** @import { EventBinding } from "../html/parts.ts" */

export class MNode {
  constructor() {
    /** @type {MElement | null} */
    this.parent = null;
  }
}

export class MText extends MNode {
  /** @param {string} data */
  constructor(data) {
    super();
    /** @type {string} */
    this.data = data;
  }

  get nodeType() {
    return 3;
  }

  get textContent() {
    return this.data;
  }
}

export class MComment extends MNode {
  /** @param {string} data */
  constructor(data) {
    super();
    /** @type {string} */
    this.data = data;
  }

  get nodeType() {
    return 8;
  }

  get textContent() {
    return "";
  }
}

/** A listener an element holds: the engine's binding and the options it was added with. */
export class MListener {
  /**
   * @param {EventBinding} binding
   * @param {{ capture: boolean, once: boolean, passive: boolean } | null} options
   */
  constructor(binding, options) {
    /** @type {EventBinding} */
    this.binding = binding;
    /** @type {{ capture: boolean, once: boolean, passive: boolean } | null} */
    this.options = options;
    /** @type {unknown} */
    this.raw = null;
  }
}

export class MElement extends MNode {
  /** @param {string} tag */
  constructor(tag = "") {
    super();
    /** @type {string} */
    this.tag = tag;
    /** @type {Map<string, string>} */
    this.attrs = new Map();
    /** @type {Map<string, unknown>} */
    this.props = new Map();
    /** @type {Map<string, MListener[]>} */
    this.listeners = new Map();
    /** @type {MNode[]} */
    this.childNodes = [];
    /** @type {boolean} */
    this._viewConnected = false;
  }

  get nodeType() {
    return 1;
  }

  /** @param {string} name */
  getAttribute(name) {
    const value = this.attrs.get(name);
    return value === undefined ? null : value;
  }

  /**
   * @param {string} name
   * @param {unknown} value
   */
  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }

  /** @param {string} name */
  hasAttribute(name) {
    return this.attrs.has(name);
  }

  /** @param {string} name */
  removeAttribute(name) {
    this.attrs.delete(name);
  }

  /**
   * @param {string} name
   * @param {boolean} [force]
   */
  toggleAttribute(name, force) {
    const on = force === undefined ? !this.attrs.has(name) : Boolean(force);
    if (on) this.attrs.set(name, "");
    else this.attrs.delete(name);
    return on;
  }

  getAttributeNames() {
    return [...this.attrs.keys()];
  }

  get attributes() {
    return [...this.attrs].map(([name, value]) => ({ name, value }));
  }

  get childNodes() {
    return this._childNodes;
  }

  set childNodes(nodes) {
    /** @type {MNode[]} */
    this._childNodes = nodes;
  }

  /** @returns {MNode[]} */
  get children() {
    return this._childNodes.filter((node) => node instanceof MElement);
  }

  get firstChild() {
    return this._childNodes.length > 0 ? this._childNodes[0] : null;
  }

  get lastChild() {
    return this._childNodes.length > 0 ? this._childNodes[this._childNodes.length - 1] : null;
  }

  get parentNode() {
    return this.parent;
  }

  /** @returns {MElement | null} */
  get parentElement() {
    return this.parent instanceof MElement ? this.parent : null;
  }

  get isConnected() {
    return isConnected(this);
  }

  get localName() {
    return this.tag;
  }

  get tagName() {
    return this.tag.startsWith("#") ? this.tag : this.tag.toUpperCase();
  }

  get classList() {
    const el = this;
    const read = () => (el.attrs.get("class") ?? "").split(/\s+/).filter(Boolean);
    const write = (/** @type {string[]} */ names) => {
      if (names.length === 0) el.attrs.delete("class");
      else el.attrs.set("class", names.join(" "));
    };
    return {
      /** @param {...string} names */
      add(...names) {
        const set = new Set(read());
        for (const name of names) for (const one of name.split(/\s+/)) if (one) set.add(one);
        write([...set]);
      },
      /** @param {...string} names */
      remove(...names) {
        const drop = new Set(names.flatMap((name) => name.split(/\s+/)).filter(Boolean));
        write(read().filter((name) => !drop.has(name)));
      },
      /** @param {string} name */
      contains(name) {
        return read().includes(name);
      },
      /**
       * @param {string} name
       * @param {boolean} [force]
       */
      toggle(name, force) {
        const on = force === undefined ? !read().includes(name) : Boolean(force);
        if (on) this.add(name);
        else this.remove(name);
        return on;
      },
      get length() {
        return read().length;
      },
    };
  }

  /**
   * @param {string} name
   * @param {EventListenerOrEventListenerObject} listener
   * @param {AddEventListenerOptions | boolean} [options]
   */
  addEventListener(name, listener, options) {
    let list = this.listeners.get(name);
    if (list === undefined) {
      list = [];
      this.listeners.set(name, list);
    }
    for (const known of list) if (known.raw === listener) return;
    const capture = typeof options === "boolean" ? options : options?.capture === true;
    const once = typeof options === "object" && options?.once === true;
    const passive = typeof options === "object" && options?.passive === true;
    const self = this;
    const binding = /** @type {EventBinding} */ (/** @type {unknown} */ ({
      /** @param {unknown} event */
      handleEvent(event) {
        const actual = /** @type {Event} */ (event);
        if (typeof listener === "function") return listener.call(self, actual);
        return listener.handleEvent(actual);
      },
    }));
    const listener2 = new MListener(binding, { capture, once, passive });
    listener2.raw = listener;
    list.push(listener2);
  }

  /**
   * @param {string} name
   * @param {EventListenerOrEventListenerObject} listener
   */
  removeEventListener(name, listener) {
    const list = this.listeners.get(name);
    if (list === undefined) return;
    const at = list.findIndex((known) => known.raw === listener);
    if (at >= 0) list.splice(at, 1);
  }

  /** @param {{ type?: string }} event */
  dispatchEvent(event) {
    return dispatch(this, /** @type {string} */ (event.type), event) > 0;
  }

  /** @param {...(MNode | string)} nodes */
  append(...nodes) {
    for (const node of nodes) insertBefore(this, toNode(node), null);
  }

  /** @param {MNode | string} node */
  appendChild(node) {
    const child = toNode(node);
    insertBefore(this, child, null);
    return child;
  }

  /**
   * @param {MNode | string} node
   * @param {MNode | null} ref
   */
  insertBefore(node, ref) {
    const child = toNode(node);
    insertBefore(this, child, ref);
    return child;
  }

  /** @param {MNode} node */
  removeChild(node) {
    removeNode(node);
    return node;
  }

  /** @param {...(MNode | string)} nodes */
  replaceWith(...nodes) {
    const parent = this.parent;
    if (parent === null) return;
    for (const node of nodes) insertBefore(parent, toNode(node), this);
    removeNode(this);
  }

  remove() {
    removeNode(this);
  }

  /** @param {MNode} node */
  contains(node) {
    /** @type {MNode | null} */
    let current = node;
    while (current !== null) {
      if (current === this) return true;
      current = current.parent;
    }
    return false;
  }

  getRootNode() {
    /** @type {MNode} */
    let node = this;
    while (node.parent !== null) node = node.parent;
    return node;
  }

  /** @param {string} selector */
  querySelector(selector) {
    const parsed = parseSelector(selector);
    if (parsed === null) return null;
    for (const el of descendants(this)) if (matchesSelector(el, parsed)) return el;
    return null;
  }

  /** @param {string} selector */
  querySelectorAll(selector) {
    const parsed = parseSelector(selector);
    if (parsed === null) return [];
    return descendants(this).filter((el) => matchesSelector(el, parsed));
  }

  get textContent() {
    return textOf(this);
  }

  set textContent(value) {
    const connected = isConnected(this);
    for (const node of [...this._childNodes]) {
      node.parent = null;
      if (connected) disconnectSubtree(node);
    }
    this._childNodes = [];
    const text = value === null || value === undefined ? "" : String(value);
    if (text !== "") {
      const node = new MText(text);
      node.parent = this;
      this._childNodes.push(node);
    }
  }
}

/** A holder whose children splice into the parent it is inserted into, leaving it empty. */
export class MFragment extends MElement {
  constructor() {
    super("#fragment");
  }
}

/** The container a rendered tree hangs from; its descendants are connected. */
export class MRoot extends MElement {
  constructor() {
    super("#root");
  }
}

/**
 * @param {MNode | string} node
 * @returns {MNode}
 */
const toNode = (node) => (typeof node === "string" ? new MText(node) : node);

/** @param {MNode} node */
export const removeNode = (node) => {
  const parent = node.parent;
  if (parent === null) return;
  const connected = isConnected(node);
  const at = parent.childNodes.indexOf(node);
  if (at >= 0) parent.childNodes.splice(at, 1);
  node.parent = null;
  if (connected) disconnectSubtree(node);
};

/**
 * Put `node` into `parent` before `ref` (at the end when `ref` is null),
 * taking it out of wherever it was; a fragment's children go in its place.
 * @param {MElement} parent
 * @param {MNode} node
 * @param {MNode | null} ref
 */
export const insertBefore = (parent, node, ref) => {
  const nodes = node instanceof MFragment ? node.childNodes.splice(0, node.childNodes.length) : [node];
  for (const n of nodes) removeNode(n);
  const at = ref === null ? parent.childNodes.length : parent.childNodes.indexOf(ref);
  if (at < 0) throw new Error("[light/markup] the reference node is not a child of the parent");
  parent.childNodes.splice(at, 0, ...nodes);
  for (const n of nodes) n.parent = parent;
  if (isConnected(parent)) for (const n of nodes) connectSubtree(n);
};

/** @param {MNode} node */
export const nextSiblingOf = (node) => {
  const parent = node.parent;
  if (parent === null) return null;
  const at = parent.childNodes.indexOf(node);
  return at >= 0 && at + 1 < parent.childNodes.length ? parent.childNodes[at + 1] : null;
};

/** @param {MNode} node */
export const isConnected = (node) => {
  /** @type {MNode | null} */
  let n = node;
  while (n !== null) {
    if (n instanceof MRoot) return true;
    n = n.parent;
  }
  return false;
};

/**
 * Every descendant element of `node` in document order, itself excluded.
 * @param {MElement} node
 * @returns {MElement[]}
 */
export const descendants = (node) => {
  /** @type {MElement[]} */
  const out = [];
  const visit = (/** @type {MElement} */ el) => {
    for (const child of el.childNodes)
      if (child instanceof MElement) {
        out.push(child);
        visit(child);
      }
  };
  visit(node);
  return out;
};

/**
 * @param {MNode} node
 * @param {(el: MElement) => void} visit
 */
const walkElements = (node, visit) => {
  if (!(node instanceof MElement)) return;
  visit(node);
  for (const child of node.childNodes) walkElements(child, visit);
};

/** @param {MNode} node */
const connectSubtree = (node) => {
  if (!isConnected(node)) return;
  walkElements(node, (el) => {
    const view = /** @type {{ connectedCallback?: () => void }} */ (/** @type {unknown} */ (el));
    if (el._viewConnected || typeof view.connectedCallback !== "function") return;
    el._viewConnected = true;
    try {
      view.connectedCallback();
    } catch (error) {
      currentHost().reportError(error);
    }
  });
};

/** @param {MNode} node */
const disconnectSubtree = (node) => {
  walkElements(node, (el) => {
    if (!el._viewConnected) return;
    el._viewConnected = false;
    const view = /** @type {{ disconnectedCallback?: () => void }} */ (/** @type {unknown} */ (el));
    if (typeof view.disconnectedCallback !== "function") return;
    try {
      view.disconnectedCallback();
    } catch (error) {
      currentHost().reportError(error);
    }
  });
};

/** Disconnect every view in `node`'s subtree, for a host done with the tree. @param {MNode} node */
export const disconnectTree = (node) => disconnectSubtree(node);

/** @param {MNode} node */
const textOf = (node) => {
  if (node instanceof MText) return node.data;
  if (!(node instanceof MElement)) return "";
  let out = "";
  for (const child of node.childNodes) out += textOf(child);
  return out;
};

/**
 * Deliver `event` to the listeners `el` holds for `name`, in the order they
 * were added, dropping the ones added once. Answers how many ran.
 * @param {MElement} el
 * @param {string} name
 * @param {unknown} event
 */
export const dispatch = (el, name, event) => {
  const list = el.listeners.get(name);
  if (list === undefined) return 0;
  const listeners = [...list];
  for (const listener of listeners) {
    if (listener.options?.once) {
      const at = list.indexOf(listener);
      if (at >= 0) list.splice(at, 1);
    }
    listener.binding.handleEvent(event);
  }
  return listeners.length;
};

/**
 * @typedef {{ compound: string, combinator: string }[]} ParsedSelector
 */

/**
 * @param {string} selector
 * @returns {ParsedSelector | null}
 */
const parseSelector = (selector) => {
  const parts = selector.trim().replace(/\s*>\s*/g, " > ").split(/\s+/).filter(Boolean);
  /** @type {{ compound: string, combinator: string }[]} */
  const parsed = [];
  let combinator = "";
  for (const part of parts) {
    if (part === ">") {
      combinator = ">";
      continue;
    }
    if (part === ":scope") continue;
    parsed.push({ compound: part, combinator: parsed.length === 0 ? "" : combinator || " " });
    combinator = "";
  }
  return parsed.length === 0 ? null : parsed;
};

/**
 * @param {MElement} el
 * @param {string} compound
 */
const matchCompound = (el, compound) => {
  if (compound === "" || compound === "*") return true;
  let at = 0;
  const tag = /^[A-Za-z][A-Za-z0-9-]*/.exec(compound);
  if (tag) {
    if (el.tag.toLowerCase() !== tag[0].toLowerCase()) return false;
    at = tag[0].length;
  }
  while (at < compound.length) {
    const rest = compound.slice(at);
    if (rest.startsWith(".")) {
      const match = /^\.([A-Za-z0-9_-]+)/.exec(rest);
      if (!match || !el.classList.contains(match[1])) return false;
      at += match[0].length;
    } else if (rest.startsWith("#")) {
      const match = /^#([A-Za-z0-9_-]+)/.exec(rest);
      if (!match || el.getAttribute("id") !== match[1]) return false;
      at += match[0].length;
    } else if (rest.startsWith("[")) {
      const end = rest.indexOf("]");
      if (end < 0) return false;
      const inner = rest.slice(1, end);
      const eq = inner.indexOf("=");
      const name = (eq < 0 ? inner : inner.slice(0, eq)).trim();
      if (!el.hasAttribute(name)) return false;
      if (eq >= 0) {
        const value = inner.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (el.getAttribute(name) !== value) return false;
      }
      at += end + 1;
    } else return false;
  }
  return true;
};

/**
 * @param {MElement} el
 * @param {ParsedSelector} parsed
 */
const matchesSelector = (el, parsed) => {
  const last = parsed[parsed.length - 1];
  if (!matchCompound(el, last.compound)) return false;
  /** @type {MElement | null} */
  let ancestor = el.parentElement;
  for (let i = parsed.length - 2; i >= 0; i--) {
    const { combinator } = parsed[i + 1];
    if (combinator === ">") {
      if (ancestor === null || !matchCompound(ancestor, parsed[i].compound)) return false;
      ancestor = ancestor.parentElement;
    } else {
      while (ancestor !== null && !matchCompound(ancestor, parsed[i].compound)) ancestor = ancestor.parentElement;
      if (ancestor === null) return false;
      ancestor = ancestor.parentElement;
    }
  }
  return true;
};
