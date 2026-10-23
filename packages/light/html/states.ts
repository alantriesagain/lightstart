/**
 * @bootstrapp/light/html/states: what a child part currently renders, one
 * class per kind. A part tells them apart with `instanceof`, which a native
 * build checks as a class where a string tag would be compared as a string,
 * and a part that renders nothing, or a served range awaiting adoption,
 * shares one instance instead of making a record each time it clears.
 */

import type { ChildPart, EventBinding } from "./parts.ts";
import type { TemplateInstance } from "./template.ts";
import type { HostElement, HostNode } from "./types.ts";

export class EmptyState {
  readonly empty = true;
}

export class PendingState {
  readonly pending = true;
}

/** The state of every part that renders nothing. */
export const EMPTY = new EmptyState();

/** The state of every part whose served range awaits adoption. */
export const PENDING = new PendingState();

export class TextState {
  node: HostNode;
  text: string;

  constructor(node: HostNode, text: string) {
    this.node = node;
    this.text = text;
  }
}

export class TemplateState {
  instance: TemplateInstance;

  constructor(instance: TemplateInstance) {
    this.instance = instance;
  }
}

/** A list's item parts and, for a list of `key()` items, each item's key; `keys` is empty for a list without keys. */
export class ItemsState {
  parts: ChildPart[];
  keys: unknown[];
  keyed: boolean;

  constructor(parts: ChildPart[], keys: unknown[], keyed: boolean) {
    this.parts = parts;
    this.keys = keys;
    this.keyed = keyed;
  }
}

export class KeyedState {
  k: unknown;
  inner: ChildPart;

  constructor(k: unknown, inner: ChildPart) {
    this.k = k;
    this.inner = inner;
  }
}

export class NodeState {
  node: HostNode;

  constructor(node: HostNode) {
    this.node = node;
  }
}

export class UnsafeState {
  s: string;

  constructor(s: string) {
    this.s = s;
  }
}

/** The state of a child part rendering an `element()`: the element, what each binding committed, its listeners and its own child part. */
export class ElementState {
  tag: string;
  el: HostNode;
  committed: Map<string, unknown>;
  events: Map<string, EventBinding>;
  ref: ((el: HostElement | null) => void) | null;
  childPart: ChildPart | null;

  constructor(tag: string, el: HostNode) {
    this.tag = tag;
    this.el = el;
    this.committed = new Map();
    this.events = new Map();
    this.ref = null;
    this.childPart = null;
  }
}

/** What a child part currently renders. */
export type ChildState = EmptyState | PendingState | TextState | TemplateState | ItemsState | KeyedState | NodeState | UnsafeState | ElementState;
