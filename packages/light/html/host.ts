/**
 * @bootstrapp/light/html/host: the renderer behind the parts engine. The
 * engine never touches a document; it asks the installed host to prepare and
 * clone templates, create and move nodes, write attributes, properties and
 * text, and bind listeners. The browser host is `dom/host.js`; a terminal or
 * string host implements the same class. `configure({ host })` installs one;
 * until then every method throws, so a page that renders without a host
 * fails at its first render rather than later.
 */

import type { Part } from "./part.ts";
import type { PartSpec } from "./types.ts";
import type { EventBinding } from "./parts.ts";

/** An opaque node of the active host; only the host reads it. */
export type HostNode = unknown;

const unsupported = (what: string): never => {
  throw new Error(`[light/html] the active host does not support ${what}`);
};

/** A template the host prepared: the part specs in document order, plus whatever the host keeps beside them. */
export class Prepared {
  parts: PartSpec[];

  constructor(parts: PartSpec[]) {
    this.parts = parts;
  }
}

/** A fresh copy of a prepared template: its root (a fragment or a list holder) and the node each part binds to, in `parts` order. */
export class Clone {
  root: unknown;
  targets: unknown[];

  constructor(root: HostNode, targets: HostNode[]) {
    this.root = root;
    this.targets = targets;
  }
}

/** Listener options as the engine compares them; a host reads them off a handler object it understands. */
export class ListenerOptions {
  capture: boolean;
  once: boolean;
  passive: boolean;

  constructor(capture: boolean, once: boolean, passive: boolean) {
    this.capture = capture;
    this.once = once;
    this.passive = passive;
  }

  equals(other: ListenerOptions | null) {
    return other !== null && other.capture === this.capture && other.once === this.once && other.passive === this.passive;
  }
}

/** The renderer interface. Every method throws here; a host overrides what it supports. */
export class Host {
  /**
   * Whether a handler function is called with the owner as `this`, as in a
   * browser; a host that cannot bind one calls it with the event alone.
   */
  bindsHandlerThis: boolean = true;

  prepare(strings: ReadonlyArray<string>, kind: number): Prepared {
    return unsupported(`templates (${String(strings.length)} strings, kind ${String(kind)})`);
  }

  clone(prepared: Prepared): Clone {
    return unsupported(`cloning templates (${String(prepared.parts.length)} parts)`);
  }

  createText(text: string): HostNode {
    return unsupported(`text nodes (${JSON.stringify(text)})`);
  }

  setText(node: HostNode, text: string) {
    unsupported(`text updates (${JSON.stringify(text)}, ${String(node === null)})`);
  }

  createAnchor(label: string): HostNode {
    return unsupported(`anchors (${label})`);
  }

  createElement(tag: string): HostNode {
    return unsupported(`elements (<${tag}>)`);
  }

  /** @returns a parent whose children move out of it when it is inserted */
  createFragment(): HostNode {
    return unsupported("fragments");
  }

  insertBefore(parent: HostNode, node: HostNode, ref: HostNode | null) {
    unsupported(`insertion (${String(parent === node)}, ${String(ref === null)})`);
  }

  /** @param node detach through the host's own primitive, never a method the node may override */
  remove(node: HostNode) {
    unsupported(`removal (${String(node === null)})`);
  }

  parentOf(node: HostNode): HostNode | null {
    return unsupported(`parent lookup (${String(node === null)})`);
  }

  nextSibling(node: HostNode): HostNode | null {
    return unsupported(`sibling lookup (${String(node === null)})`);
  }

  isConnected(node: HostNode): boolean {
    return unsupported(`connectivity (${String(node === null)})`);
  }

  /**
   * The node a child-position value stands for, or null when the value is not a node of this host.
   */
  asNode(value: unknown): HostNode | null {
    return value === null ? null : null;
  }

  /**
   * A non-array iterable as a list, or null when the value is not one.
   */
  toList(value: unknown): unknown[] | null {
    return value === null ? null : null;
  }

  /**
   * The text for a child value the engine cannot classify (an object).
   */
  stringify(value: unknown): string {
    return unsupported(`unknown child values (${typeof value})`);
  }

  setAttribute(el: HostNode, name: string, value: string) {
    unsupported(`attributes (${name}=${JSON.stringify(value)}, ${String(el === null)})`);
  }

  removeAttribute(el: HostNode, name: string) {
    unsupported(`attribute removal (${name}, ${String(el === null)})`);
  }

  toggleAttribute(el: HostNode, name: string, on: boolean) {
    unsupported(`boolean attributes (${name}=${String(on)}, ${String(el === null)})`);
  }

  setProperty(el: HostNode, name: string, value: unknown) {
    unsupported(`properties (.${name}, ${typeof value}, ${String(el === null)})`);
  }

  /**
   * The whole text content of a raw-text element (`<textarea>`, `<title>`, …).
   */
  setContent(el: HostNode, text: string) {
    unsupported(`raw text (${JSON.stringify(text)}, ${String(el === null)})`);
  }

  /**
   * The options a handler value carries, or null for a plain handler.
   */
  listenerOptions(handler: unknown): ListenerOptions | null {
    return handler === null ? null : null;
  }

  /**
   * @param binding the engine's binding; calling its `handleEvent(event)` runs the handler
   */
  addListener(el: HostNode, name: string, binding: EventBinding, options: ListenerOptions | null) {
    unsupported(`listeners (@${name}, ${String(binding === null)}, ${String(options === null)}, ${String(el === null)})`);
  }

  removeListener(el: HostNode, name: string, binding: EventBinding, options: ListenerOptions | null) {
    unsupported(`listener removal (@${name}, ${String(binding === null)}, ${String(options === null)}, ${String(el === null)})`);
  }

  /**
   * Invoke a handler that is not a function (a `handleEvent` object, say).
   */
  invokeListener(handler: unknown, event: unknown): unknown {
    return unsupported(`object handlers (${typeof handler}, ${typeof event})`);
  }

  /**
   * Parse markup into a fragment, for `unsafeHTML`.
   */
  parseMarkup(markup: string): HostNode {
    return unsupported(`unsafeHTML (${String(markup.length)} chars)`);
  }

  /**
   * The part for a `<slot>` element, when the host projects light children.
   */
  createSlotPart(spec: PartSpec, el: HostNode, owner: object | undefined): Part {
    return unsupported(`slots (${String(spec.valueIndex)}, ${String(el === null)}, ${String(owner === undefined)})`);
  }

  /**
   * Whether a template may use this tag.
   */
  knownTag(tag: string): boolean {
    return tag.length > 0;
  }

  /**
   * Whether an element of `tag` takes a prop or attribute named `name`.
   */
  knownProp(tag: string, name: string): boolean {
    return tag.length > 0 && name.length > 0;
  }

  /**
   * Run the view queue's flush once, on the host's next frame.
   */
  scheduleFlush(flush: () => void) {
    unsupported(`frame scheduling (${String(flush === null)})`);
  }

  /**
   * Report an error an update threw, without unwinding the flush.
   */
  reportError(error: unknown) {
    console.error(error);
  }
}

let host = new Host();

/** The installed host. */
export const currentHost = () => host;

export const setHost = (next: Host) => {
  host = next;
};
