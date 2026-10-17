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
import { Clone, Host, ListenerOptions, Prepared } from "../html/host.ts";
import { HTML_KIND } from "../html/constants.ts";
import { disposeTree } from "../html/core.ts";
import { parseTemplate } from "../html/parser.ts";
import { TplComment, TplElement, TplNode, TplText, indexParts, tokenize } from "../html/tokenizer.ts";
import { setValue } from "./editor.ts";
import { forgetLayout } from "./layout.ts";
import { TAnchor, TBox, TElement, TFragment, TInput, TNode, TRun } from "./node.ts";
import { FLUSH_VIEWS, frames } from "./scheduler.ts";
import { TSlotPart } from "./slots.ts";
import { createElement } from "./tags.ts";
import { View } from "./view.ts";

import type { EventBinding } from "../html/parts.ts";
import type { HostNode } from "../html/host.ts";
import type { PartSpec } from "../html/types.ts";

/** A prepared terminal template: the part specs with the node index each binds to, and the template tree. */
export class TermPrepared extends Prepared {
  tree: TplNode[];

  constructor(parts: PartSpec[], tree: TplNode[]) {
    super(parts);
    this.tree = tree;
  }
}

const isWS = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";

const isBlank = (s: string) => {
  for (let i = 0; i < s.length; i++) if (!isWS(s[i])) return false;
  return true;
};

const collapse = (s: string) => {
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
  specs: PartSpec[];
  targets: HostNode[];
  index: number;
  partIdx: number;

  constructor(specs: PartSpec[]) {
    this.specs = specs;
    this.targets = [];
    this.index = -1;
    this.partIdx = 0;
  }

  visit(node: TNode) {
    this.index++;
    while (this.partIdx < this.specs.length && this.specs[this.partIdx].nodeIndex === this.index) {
      this.targets.push(node);
      this.partIdx++;
    }
  }
}

const push = (parent: TElement, node: TNode) => {
  parent.link(node, null);
};

/**
 * @param inline whether text keeps its spaces, as inside a text or span
 */
const cloneInto = (nodes: TplNode[], parent: TElement, inline: boolean, walk: CloneWalk | null) => {
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

const setAttached = (node: TNode, on: boolean) => {
  if (!(node instanceof TElement)) return;
  if (node.owner !== null && node.attached !== on) {
    node.attached = on;
    if (on) node.owner.$attach();
    else node.owner.$detach();
  }
  for (let c = node.firstChild; c !== null; c = c.next) setAttached(c, on);
};

/**
 * Drop what the views a template made by tag rendered inside `node`,
 * children first: their root parts and the effects of their thunks, and
 * their content, so that an element put back in a tree renders afresh. A
 * view the app constructed keeps its content, as `unmount` leaves it.
 */
const disposeDefined = (node: TNode) => {
  if (!(node instanceof TElement)) return;
  for (let c = node.firstChild; c !== null;) {
    const next = c.next;
    disposeDefined(c);
    c = next;
  }
  if (node.owner instanceof View && node.owner.$defined) {
    disposeTree(node);
    node.clearChildren();
  }
};

export class TermHost extends Host {
  registered: boolean;
  onError: ((error: unknown) => void) | null;

  constructor() {
    super();
    this.bindsHandlerThis = false;
    this.registered = false;
    this.onError = null;
  }

  prepare(strings: ReadonlyArray<string>, kind: number): TermPrepared {
    const { markup, parts } = parseTemplate(strings, kind);
    const tree = tokenize(markup, kind);
    return new TermPrepared(indexParts(tree, parts), tree);
  }

  clone(prepared: Prepared): Clone {
    const term = prepared as TermPrepared;
    const fragment = new TFragment();
    const walk = new CloneWalk(term.parts);
    cloneInto(term.tree, fragment, false, walk);
    return new Clone(fragment, walk.targets);
  }

  createText(text: string): HostNode {
    return new TRun(text);
  }

  setText(node: HostNode, text: string) {
    (node as TRun).setText(text);
  }

  createAnchor(label: string): HostNode {
    return new TAnchor(label);
  }

  createElement(tag: string): HostNode {
    return createElement(tag);
  }

  createSlotPart(_spec: PartSpec, el: HostNode, owner: object | undefined): TSlotPart {
    return new TSlotPart(el as TBox, owner instanceof View ? owner : null);
  }

  createFragment(): HostNode {
    return new TFragment();
  }

  insertBefore(parent: HostNode, node: HostNode, ref: HostNode | null) {
    const p = parent as TElement;
    const n = node as TNode;
    const r = ref === null ? null : (ref as TNode);
    const connected = p.isConnected();
    if (n instanceof TFragment) {
      const kids: TNode[] = [];
      for (let k = n.firstChild; k !== null; k = k.next) kids.push(k);
      n.clearChildren();
      for (const k of kids) p.insertBefore(k, r);
      if (connected) for (const k of kids) setAttached(k, true);
      return;
    }
    p.insertBefore(n, r);
    if (connected) setAttached(n, true);
  }

  remove(node: HostNode) {
    const n = node as TNode;
    const parent = n.parent;
    if (parent === null) return;
    if (n.isConnected()) setAttached(n, false);
    parent.remove(n);
    forgetLayout(n);
    disposeDefined(n);
  }

  parentOf(node: HostNode): HostNode {
    return (node as TNode).parent;
  }

  nextSibling(node: HostNode): HostNode {
    return (node as TNode).next;
  }

  isConnected(node: HostNode) {
    return (node as TNode).isConnected();
  }

  asNode(value: unknown): HostNode {
    if (value instanceof TNode) return value;
    if (value instanceof View) return value.box;
    return null;
  }

  stringify(value: unknown) {
    if (typeof value !== "object" || value === null) return String(value);
    const toString = (value as { toString?: unknown }).toString;
    return typeof toString === "function" ? String(toString.call(value)) : "[object]";
  }

  setAttribute(el: HostNode, name: string, value: string) {
    (el as TElement).setProp(name, value);
  }

  removeAttribute(el: HostNode, name: string) {
    (el as TElement).setProp(name, null);
  }

  toggleAttribute(el: HostNode, name: string, on: boolean) {
    (el as TElement).setProp(name, on);
  }

  setProperty(el: HostNode, name: string, value: unknown) {
    const e = el as TElement;
    if (e.owner !== null && e.owner.$setProp(name, value)) return;
    e.props.set(name, value);
    if (e instanceof TInput && name === "value") {
      const text = typeof value === "string" ? value : value === null || value === undefined ? "" : typeof value === "number" ? String(value) : e.value();
      if (text !== e.value()) setValue(e, text);
      return;
    }
    if (value === null || value === undefined) e.setKnownExplicit(name, null);
    else if (typeof value === "string") e.setKnownExplicit(name, value);
    else if (typeof value === "number") e.setKnownExplicit(name, value);
    else if (typeof value === "boolean") e.setKnownExplicit(name, value);
  }

  setContent(el: HostNode, text: string) {
    const e = el as TElement;
    if (e instanceof TInput) {
      setValue(e, text);
      return;
    }
    e.clearChildren();
    push(e, new TRun(text));
    e.invalidate();
  }

  listenerOptions(handler: unknown) {
    if (handler === null || typeof handler !== "object") return null;
    const o = handler as { capture?: unknown, once?: unknown, passive?: unknown };
    return new ListenerOptions(o.capture === true, o.once === true, o.passive === true);
  }

  addListener(el: HostNode, name: string, binding: EventBinding, options: ListenerOptions | null) {
    (el as TElement).addHandler(name, binding, options !== null && options.once);
  }

  removeListener(el: HostNode, name: string, binding: EventBinding, _options: ListenerOptions | null) {
    (el as TElement).removeHandler(name, binding);
  }

  invokeListener(handler: unknown, event: unknown) {
    const h = handler as { handleEvent: (event: unknown) => unknown };
    return h.handleEvent(event);
  }

  parseMarkup(markup: string): HostNode {
    const fragment = new TFragment();
    cloneInto(tokenize(markup, HTML_KIND), fragment, false, null);
    return fragment;
  }

  scheduleFlush(flush: () => void) {
    if (!this.registered) {
      this.registered = true;
      frames.onFlush(flush, FLUSH_VIEWS);
    }
    frames.request();
  }

  reportError(error: unknown) {
    if (this.onError !== null) this.onError(error);
    else console.error(error);
  }
}
