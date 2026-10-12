/**
 * @bootstrapp/light/tdom/host: the renderer on the terminal node tree.
 * Templates are read from the parser's marker markup with the tokenizer
 * and cloned into terminal nodes under the terminal's whitespace rules
 * (blank text between block children is dropped, inline text collapses
 * its spaces); attributes become the element's props; listeners are
 * handler entries on the element; a view that owns an element attaches
 * when the element joins the root's tree and detaches when it leaves;
 * frames are the scheduler's ticks. Installed by native/index.js.
 */
import { Clone, Host, ListenerOptions, Prepared } from "../html/host.js";
import { HTML_KIND } from "../html/constants.js";
import { parseTemplate } from "../html/parser.js";
import { TplComment, TplElement, TplNode, TplText, indexParts, tokenize } from "../html/tokenizer.js";
import { setValue } from "./editor.js";
import { forgetLayout } from "./layout.js";
import { TAnchor, TElement, TFragment, TInput, TNode, TRun } from "./node.js";
import { FLUSH_VIEWS, frames } from "./scheduler.js";
import { createElement } from "./tags.js";
import { View } from "./view.js";

/** @import { EventBinding } from "../html/parts.js" */
/** @import { HostNode } from "../html/host.js" */
/** @import { PartSpec } from "../html/types.ts" */

/** A prepared terminal template: the part specs with the node index each binds to, and the template tree. */
export class TermPrepared extends Prepared {
  /**
   * @param {PartSpec[]} parts
   * @param {TplNode[]} tree
   */
  constructor(parts, tree) {
    super(parts);
    this.tree = tree;
  }
}

/** @param {string} c */
const isWS = (c) => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";

/** @param {string} s */
const isBlank = (s) => {
  for (let i = 0; i < s.length; i++) if (!isWS(s[i])) return false;
  return true;
};

/** @param {string} s */
const collapse = (s) => {
  let out = "";
  let inWs = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (isWS(c)) {
      if (!inWs) out += " ";
      inWs = true;
    } else {
      out += c;
      inWs = false;
    }
  }
  return out;
};

class CloneWalk {
  /** @param {PartSpec[]} specs */
  constructor(specs) {
    this.specs = specs;
    /** @type {HostNode[]} */
    this.targets = [];
    this.index = -1;
    this.partIdx = 0;
  }

  /** @param {TNode} node */
  visit(node) {
    this.index++;
    while (this.partIdx < this.specs.length && this.specs[this.partIdx].nodeIndex === this.index) {
      this.targets.push(node);
      this.partIdx++;
    }
  }
}

/**
 * @param {TElement} parent
 * @param {TNode} node
 */
const push = (parent, node) => {
  node.parent = parent;
  parent.children.push(node);
};

/**
 * @param {TplNode[]} nodes
 * @param {TElement} parent
 * @param {boolean} inline whether text keeps its spaces, as inside a text or span
 * @param {CloneWalk | null} walk
 */
const cloneInto = (nodes, parent, inline, walk) => {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node instanceof TplElement) {
      const el = createElement(node.tag);
      for (const [name, value] of node.attrs)
        if (value === "") el.setProp(name, true);
        else el.setProp(name, value);
      push(parent, el);
      if (walk !== null) walk.visit(el);
      cloneInto(node.children, el, el.kind === "text" || el.kind === "span", walk);
    } else if (node instanceof TplComment) {
      const anchor = new TAnchor(node.data);
      push(parent, anchor);
      if (walk !== null) walk.visit(anchor);
    } else if (node instanceof TplText)
      if (inline) {
        let text = collapse(node.data);
        if (i === 0) text = text.trimStart();
        if (i === nodes.length - 1) text = text.trimEnd();
        if (text.length > 0) push(parent, new TRun(text));
      } else if (!isBlank(node.data)) push(parent, new TRun(collapse(node.data).trim()));
  }
};

/**
 * @param {TNode} node
 * @param {boolean} on
 */
const setAttached = (node, on) => {
  if (!(node instanceof TElement)) return;
  if (node.owner !== null && node.attached !== on) {
    node.attached = on;
    if (on) node.owner.$attach();
    else node.owner.$detach();
  }
  for (const c of node.children) setAttached(c, on);
};

export class TermHost extends Host {
  constructor() {
    super();
    this.bindsHandlerThis = false;
    this.registered = false;
    /** @type {((error: unknown) => void) | null} */
    this.onError = null;
  }

  /**
   * @param {ReadonlyArray<string>} strings
   * @param {number} kind
   * @returns {TermPrepared}
   */
  prepare(strings, kind) {
    const { markup, parts } = parseTemplate(strings, kind);
    const tree = tokenize(markup, kind);
    return new TermPrepared(indexParts(tree, parts), tree);
  }

  /**
   * @param {Prepared} prepared
   * @returns {Clone}
   */
  clone(prepared) {
    const term = /** @type {TermPrepared} */ (prepared);
    const fragment = new TFragment();
    const walk = new CloneWalk(term.parts);
    cloneInto(term.tree, fragment, false, walk);
    return new Clone(fragment, walk.targets);
  }

  /** @param {string} text */
  createText(text) {
    return new TRun(text);
  }

  /**
   * @param {HostNode} node
   * @param {string} text
   */
  setText(node, text) {
    /** @type {TRun} */ (node).setText(text);
  }

  /** @param {string} label */
  createAnchor(label) {
    return new TAnchor(label);
  }

  /** @param {string} tag */
  createElement(tag) {
    return createElement(tag);
  }

  createFragment() {
    return new TFragment();
  }

  /**
   * @param {HostNode} parent
   * @param {HostNode} node
   * @param {HostNode | null} ref
   */
  insertBefore(parent, node, ref) {
    const p = /** @type {TElement} */ (parent);
    const n = /** @type {TNode} */ (node);
    const r = ref === null ? null : /** @type {TNode} */ (ref);
    const connected = p.isConnected();
    if (n instanceof TFragment) {
      const kids = n.children.splice(0, n.children.length);
      for (const k of kids) {
        k.parent = null;
        p.insertBefore(k, r);
      }
      if (connected) for (const k of kids) setAttached(k, true);
      return;
    }
    p.insertBefore(n, r);
    if (connected) setAttached(n, true);
  }

  /** @param {HostNode} node */
  remove(node) {
    const n = /** @type {TNode} */ (node);
    const parent = n.parent;
    if (parent === null) return;
    if (n.isConnected()) setAttached(n, false);
    parent.remove(n);
    forgetLayout(n);
  }

  /** @param {HostNode} node */
  parentOf(node) {
    return /** @type {TNode} */ (node).parent;
  }

  /** @param {HostNode} node */
  nextSibling(node) {
    return /** @type {TNode} */ (node).nextSibling();
  }

  /** @param {HostNode} node */
  isConnected(node) {
    return /** @type {TNode} */ (node).isConnected();
  }

  /** @param {unknown} value */
  asNode(value) {
    if (value instanceof TNode) return value;
    if (value instanceof View) return value.box;
    return null;
  }

  /** @param {unknown} value */
  stringify(value) {
    if (typeof value !== "object" || value === null) return String(value);
    const toString = /** @type {{ toString?: unknown }} */ (value).toString;
    return typeof toString === "function" ? String(toString.call(value)) : "[object]";
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {string} value
   */
  setAttribute(el, name, value) {
    /** @type {TElement} */ (el).setProp(name, value);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   */
  removeAttribute(el, name) {
    /** @type {TElement} */ (el).setProp(name, null);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {boolean} on
   */
  toggleAttribute(el, name, on) {
    /** @type {TElement} */ (el).setProp(name, on);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {unknown} value
   */
  setProperty(el, name, value) {
    const e = /** @type {TElement} */ (el);
    e.props.set(name, value);
    if (e instanceof TInput && name === "value") {
      const text = typeof value === "string" ? value : value === null || value === undefined ? "" : typeof value === "number" ? String(value) : e.value();
      if (text !== e.value()) setValue(e, text);
      return;
    }
    if (value === null || value === undefined) e.setKnownProp(name, null);
    else if (typeof value === "string") e.setKnownProp(name, value);
    else if (typeof value === "number") e.setKnownProp(name, value);
    else if (typeof value === "boolean") e.setKnownProp(name, value);
  }

  /**
   * @param {HostNode} el
   * @param {string} text
   */
  setContent(el, text) {
    const e = /** @type {TElement} */ (el);
    if (e instanceof TInput) {
      setValue(e, text);
      return;
    }
    for (const c of e.children) c.parent = null;
    e.children.length = 0;
    push(e, new TRun(text));
    e.invalidate();
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
   * @param {EventBinding} binding
   * @param {ListenerOptions | null} options
   */
  addListener(el, name, binding, options) {
    /** @type {TElement} */ (el).addHandler(name, binding, options !== null && options.once);
  }

  /**
   * @param {HostNode} el
   * @param {string} name
   * @param {EventBinding} binding
   * @param {ListenerOptions | null} _options
   */
  removeListener(el, name, binding, _options) {
    /** @type {TElement} */ (el).removeHandler(name, binding);
  }

  /**
   * @param {unknown} handler
   * @param {unknown} event
   */
  invokeListener(handler, event) {
    const h = /** @type {{ handleEvent: (event: unknown) => unknown }} */ (handler);
    return h.handleEvent(event);
  }

  /** @param {string} markup */
  parseMarkup(markup) {
    const fragment = new TFragment();
    cloneInto(tokenize(markup, HTML_KIND), fragment, false, null);
    return fragment;
  }

  /** @param {() => void} flush */
  scheduleFlush(flush) {
    if (!this.registered) {
      this.registered = true;
      frames.onFlush(flush, FLUSH_VIEWS);
    }
    frames.request();
  }

  /** @param {unknown} error */
  reportError(error) {
    if (this.onError !== null) this.onError(error);
    else console.error(error);
  }
}
