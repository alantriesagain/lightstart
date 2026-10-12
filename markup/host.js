/**
 * @bootstrapp/light/markup/host: the renderer on an in-memory tree. It
 * prepares templates by reading the parser's marker markup with the
 * tokenizer, clones them into markup nodes, and answers every node,
 * attribute and listener operation on the tree in markup/node.js. Frames
 * are timeouts; `unsafeHTML` goes through the tokenizer; `<slot>` elements
 * stay as written, since nothing projects into them. Installed with
 * `configure({ host: new MarkupHost(), effect })`.
 */
import { Clone, Host, ListenerOptions, Prepared } from "../html/host.js";
import { parseTemplate } from "../html/parser.js";
import { TplComment, TplElement, TplNode, TplText, indexParts, tokenize } from "../html/tokenizer.js";
import { MComment, MElement, MFragment, MListener, MNode, MText, insertBefore, isConnected, nextSiblingOf, removeNode } from "./node.js";

/** @import { HostNode } from "../html/host.js" */
/** @import { PartSpec } from "../html/types.ts" */

/** A prepared markup template: the part specs with the node index each binds to, and the template tree. */
export class MarkupPrepared extends Prepared {
  /**
   * @param {PartSpec[]} parts
   * @param {TplNode[]} tree
   */
  constructor(parts, tree) {
    super(parts);
    this.tree = tree;
  }
}

class CloneWalk {
  /** @param {PartSpec[]} specs */
  constructor(specs) {
    this.specs = specs;
    /** @type {HostNode[]} */
    this.targets = [];
    this.index = -1;
    this.partIdx = 0;
  }

  /** @param {MNode} node */
  visit(node) {
    this.index++;
    while (this.partIdx < this.specs.length && this.specs[this.partIdx].nodeIndex === this.index) {
      this.targets.push(node);
      this.partIdx++;
    }
  }

}

/**
 * @param {TplNode[]} nodes
 * @param {MElement} parent
 * @param {CloneWalk | null} walk
 */
const cloneInto = (nodes, parent, walk) => {
  for (const node of nodes)
    if (node instanceof TplElement) {
      const el = new MElement(node.tag);
      for (const [name, value] of node.attrs) el.attrs.set(name, value);
      el.parent = parent;
      parent.children.push(el);
      if (walk !== null) walk.visit(el);
      cloneInto(node.children, el, walk);
    } else if (node instanceof TplComment) {
      const comment = new MComment(node.data);
      comment.parent = parent;
      parent.children.push(comment);
      if (walk !== null) walk.visit(comment);
    } else if (node instanceof TplText) {
      const text = new MText(node.data);
      text.parent = parent;
      parent.children.push(text);
    }

};

const noSlot = { setFromValues() {}, adopt() {}, dispose() {} };

export class MarkupHost extends Host {
  constructor() {
    super();
    /** @type {((error: unknown) => void) | null} */
    this.onError = null;
  }

  /**
   * @param {ReadonlyArray<string>} strings
   * @param {number} kind
   * @returns {MarkupPrepared}
   */
  prepare(strings, kind) {
    const { markup, parts } = parseTemplate(strings, kind);
    const tree = tokenize(markup, kind);
    const specs = indexParts(tree, parts);
    return new MarkupPrepared(specs, tree);
  }

  /**
   * @param {Prepared} prepared
   * @returns {Clone}
   */
  clone(prepared) {
    const markup = /** @type {MarkupPrepared} */ (prepared);
    const fragment = new MFragment();
    const walk = new CloneWalk(markup.parts);
    cloneInto(markup.tree, fragment, walk);
    return new Clone(fragment, walk.targets);
  }

  /** @param {string} text */
  createText(text) {
    return new MText(text);
  }

  /**
   * @param {HostNode} node
   * @param {string} text
   */
  setText(node, text) {
    /** @type {MText} */ (node).data = text;
  }

  /** @param {string} label */
  createAnchor(label) {
    return new MComment(label);
  }

  /** @param {string} tag */
  createElement(tag) {
    return new MElement(tag);
  }

  createFragment() {
    return new MFragment();
  }

  /**
   * @param {HostNode} parent
   * @param {HostNode} node
   * @param {HostNode | null} ref
   */
  insertBefore(parent, node, ref) {
    insertBefore(/** @type {MElement} */ (parent), /** @type {MNode} */ (node), /** @type {MNode | null} */ (ref));
  }

  /** @param {HostNode} node */
  remove(node) {
    removeNode(/** @type {MNode} */ (node));
  }

  /** @param {HostNode} node */
  parentOf(node) {
    return /** @type {MNode} */ (node).parent;
  }

  /** @param {HostNode} node */
  nextSibling(node) {
    return nextSiblingOf(/** @type {MNode} */ (node));
  }

  /** @param {HostNode} node */
  isConnected(node) {
    return isConnected(/** @type {MNode} */ (node));
  }

  /** @param {unknown} value */
  asNode(value) {
    return value instanceof MNode ? value : null;
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
    /** @type {MElement} */ (el).attrs.set(name, value);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   */
  removeAttribute(el, name) {
    /** @type {MElement} */ (el).attrs.delete(name);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {boolean} on
   */
  toggleAttribute(el, name, on) {
    if (on) /** @type {MElement} */ (el).attrs.set(name, "");
    else /** @type {MElement} */ (el).attrs.delete(name);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {unknown} value
   */
  setProperty(el, name, value) {
    /** @type {MElement} */ (el).props.set(name, value);
  }

  /**
   * @param {HostNode} el
   * @param {string} text
   */
  setContent(el, text) {
    const element = /** @type {MElement} */ (el);
    for (const child of element.children) child.parent = null;
    element.children = [];
    const node = new MText(text);
    node.parent = element;
    element.children.push(node);
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
    const element = /** @type {MElement} */ (el);
    let list = element.listeners.get(name);
    if (list === undefined) {
      list = [];
      element.listeners.set(name, list);
    }
    for (const listener of list) if (listener.binding === binding && (listener.options?.capture ?? false) === (options?.capture ?? false)) return;
    list.push(new MListener(binding, options === null ? null : { capture: options.capture, once: options.once, passive: options.passive }));
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {{ handleEvent: (event: unknown) => unknown }} binding
   * @param {ListenerOptions | null} options
   */
  removeListener(el, name, binding, options) {
    const element = /** @type {MElement} */ (el);
    const list = element.listeners.get(name);
    if (list === undefined) return;
    const capture = options?.capture ?? false;
    const at = list.findIndex((listener) => listener.binding === binding && (listener.options?.capture ?? false) === capture);
    if (at >= 0) list.splice(at, 1);
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
    const fragment = new MFragment();
    cloneInto(tokenize(markup, 1), fragment, null);
    return fragment;
  }

  /**
   * @param {PartSpec} _spec
   * @param {HostNode} _el
   * @param {object | undefined} _owner
   */
  createSlotPart(_spec, _el, _owner) {
    return noSlot;
  }

  /** @param {() => void} flush */
  scheduleFlush(flush) {
    setTimeout(flush, 0);
  }

  /** @param {unknown} error */
  reportError(error) {
    if (this.onError !== null) this.onError(error);
    else console.error(error);
  }
}

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
