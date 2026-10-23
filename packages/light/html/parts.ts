import { MARKER_END, MARKER_START, ROOT_MARKER_END, ROOT_MARKER_START, nothing } from "./constants.ts";
import { currentHost } from "./host.ts";
import { Part } from "./part.ts";

import type { ListenerOptions } from "./host.ts";
import { ThunkHolder, disposeThunk, resolveEager, setThunk } from "./reactive.ts";
import { TemplateInstance, getTemplate } from "./template.ts";
import { ElementSpec, Keyed, TemplateResult, Unsafe } from "./values.ts";

import { EMPTY, ElementState, ItemsState, KeyedState, NodeState, PENDING, TemplateState, TextState, UnsafeState } from "./states.ts";
import type { ChildState } from "./states.ts";
import type { HostElement, HostNode, NothingValue, PartSpec, RenderOptions } from "./types.ts";

/** The uncommitted sentinel a part compares its first value against. */
export const NOT_SET = Symbol();
const VALID_TAG = /^[a-zA-Z][a-zA-Z0-9-]*$/;

let warnedMixedKeys = false;

/**
 * Adoption of prerendered content, installed by the host that supports it
 * (the DOM host's `dom/adopt.js`). Without it a pending part renders fresh.
 */
export type Adoption = {
  resolvePending: (part: ChildPart, value: unknown, bind: boolean) => void;
  rootPart: (container: unknown, options: RenderOptions) => ChildPart | null;
  adoptPart: (part: Part, values: unknown[], bind: boolean) => void;
};

let adoption: Adoption | null = null;

export const installAdoption = (a: Adoption) => {
  adoption = a;
};

export { Part };

const NO_KEYS: unknown[] = [];

export class EventBinding {
  el: unknown;
  name: string;
  owner: object | undefined;
  handler: unknown;
  options: ListenerOptions | null;
  attached: boolean;

  constructor(el: HostNode, name: string, owner: object | undefined) {
    this.el = el;
    this.name = name;
    this.owner = owner;
    this.handler = undefined;
    this.options = null;
    this.attached = false;
  }

  commit(value: unknown) {
    const next = value == null || value === nothing ? undefined : value;
    if (next === this.handler) return;
    const host = currentHost();
    const nextOpts = next === undefined ? null : host.listenerOptions(next);
    const optsChanged = nextOpts === null ? this.options !== null : !nextOpts.equals(this.options);
    if (this.attached && (next === undefined || optsChanged)) {
      host.removeListener(this.el, this.name, this, this.options);
      this.attached = false;
    }
    this.handler = next;
    this.options = nextOpts;
    if (next !== undefined && !this.attached) {
      host.addListener(this.el, this.name, this, nextOpts);
      this.attached = true;
    }
  }

  handleEvent(event: unknown): unknown {
    const h = this.handler;
    if (typeof h === "function") {
      const handler = h as (this: unknown, event: unknown) => unknown;
      return currentHost().bindsHandlerThis ? handler.call(this.owner ?? this.el, event) : handler(event);
    }
    if (h === undefined) return undefined;
    return currentHost().invokeListener(h, event);
  }

  dispose() {
    if (this.attached) {
      currentHost().removeListener(this.el, this.name, this, this.options);
      this.attached = false;
    }
    this.handler = undefined;
    this.options = null;
  }
}

export class EventPart extends Part {
  valueIndex: number;
  binding: EventBinding;

  constructor(spec: PartSpec, el: HostNode, owner: object | undefined) {
    super();
    this.valueIndex = spec.valueIndex;
    this.binding = new EventBinding(el, (spec.name as string), owner);
  }

  setFromValues(values: unknown[]) {
    this.binding.commit(values[this.valueIndex]);
  }

  dispose() {
    this.binding.dispose();
  }
}

export class PropertyPart extends Part {
  el: unknown;
  name: string;
  valueIndex: number;
  committed: unknown;

  constructor(spec: PartSpec, el: HostNode) {
    super();
    this.el = el;
    this.name = spec.name as string;
    this.valueIndex = spec.valueIndex;
    this.committed = NOT_SET;
  }

  setFromValues(values: unknown[]) {
    let value = values[this.valueIndex];
    if (value === nothing) value = undefined;
    if (value === this.committed) return;
    this.committed = value;
    currentHost().setProperty(this.el, this.name, value);
  }

  dispose() {}
}

export class BooleanAttributePart extends ThunkHolder {
  el: unknown;
  name: string;
  valueIndex: number;
  committed: unknown;

  constructor(spec: PartSpec, el: HostNode) {
    super();
    this.el = el;
    this.name = spec.name as string;
    this.valueIndex = spec.valueIndex;
    this.committed = NOT_SET;
  }
  _anchor() {
    return this.el;
  }

  setFromValues(values: unknown[]) {
    this.commit(values[this.valueIndex]);
  }

  commit(value: unknown) {
    if (typeof value === "function") return setThunk(this, value as () => unknown);
    disposeThunk(this);
    this._commitResolved(value);
  }

  _commitResolved(value: unknown) {
    const on = Boolean(value) && value !== nothing;
    if (on === this.committed) return;
    this.committed = on;
    currentHost().toggleAttribute(this.el, this.name, on);
  }

  dispose() {
    disposeThunk(this);
  }
}

export class AttributePart extends ThunkHolder {
  el: unknown;
  name: string;
  statics: string[];
  valueIndex: number;
  valueCount: number;
  single: boolean;
  committed: unknown;

  constructor(spec: PartSpec, el: HostNode) {
    super();
    this.el = el;
    this.name = spec.name as string;
    this.statics = spec.statics as string[];
    this.valueIndex = spec.valueIndex;
    this.valueCount = spec.valueCount;
    this.single = spec.valueCount === 1 && this.statics[0] === "" && this.statics[1] === "";
    this.committed = NOT_SET;
  }
  _anchor() {
    return this.el;
  }

  setFromValues(values: unknown[]) {
    if (this.single) return this.commit(values[this.valueIndex]);
    let out = this.statics[0];
    for (let i = 0; i < this.valueCount; i++) {
      const value = resolveEager(values[this.valueIndex + i]);
      if (value === nothing) return this._commitString(nothing);
      out += `${value ?? ""}` + this.statics[i + 1];
    }
    this._commitString(out);
  }

  commit(value: unknown) {
    if (typeof value === "function") return setThunk(this, value as () => unknown);
    disposeThunk(this);
    this._commitResolved(value);
  }

  _commitResolved(value: unknown) {
    this._commitString(value === nothing ? nothing : value == null ? "" : String(value));
  }

  _commitString(value: string | NothingValue) {
    if (value === this.committed) return;
    this.committed = value;
    if (value === nothing) currentHost().removeAttribute(this.el, this.name);
    else currentHost().setAttribute(this.el, this.name, value);
  }

  dispose() {
    disposeThunk(this);
  }
}

export class RawTextPart extends ThunkHolder {
  el: unknown;
  valueIndex: number;
  committed: unknown;

  constructor(spec: PartSpec, el: HostNode) {
    super();
    this.el = el;
    this.valueIndex = spec.valueIndex;
    this.committed = NOT_SET;
  }
  _anchor() {
    return this.el;
  }

  setFromValues(values: unknown[]) {
    this.commit(values[this.valueIndex]);
  }

  commit(value: unknown) {
    if (typeof value === "function") return setThunk(this, value as () => unknown);
    disposeThunk(this);
    this._commitResolved(value);
  }

  _commitResolved(value: unknown) {
    const text = value === nothing || value == null ? "" : String(value);
    if (text === this.committed) return;
    this.committed = text;
    currentHost().setContent(this.el, text);
  }

  dispose() {
    disposeThunk(this);
  }
}

export class ChildPart extends ThunkHolder {
  start: unknown;
  end: unknown;
  owner: object | undefined;
  valueIndex: number;
  state: ChildState;
  _bindNext: boolean;
  _settle: (() => Promise<unknown>) | null;
  _settled: boolean;
  _settleWaiting: boolean;
  _deferred: unknown;

  constructor(start: HostNode, end: HostNode, owner?: object | undefined) {
    super();
    this.start = start;
    this.end = end;
    this.owner = owner;
    this.valueIndex = 0;
    this.state = EMPTY;
    this._bindNext = false;
    this._settle = null;
    this._settled = false;
    this._settleWaiting = false;
    this._deferred = NOT_SET;
  }

  _anchor() {
    return this.start;
  }

  /**
   * A part for a range inside this one, sharing the host and the settle hook.
   */
  _child(start: HostNode, end: HostNode) {
    const part = new ChildPart(start, end, this.owner);
    part._settle = this._settle;
    part._settled = this._settled;
    return part;
  }

  setFromValues(values: unknown[]) {
    this.commit(values[this.valueIndex]);
  }

  commit(value: unknown) {
    if (typeof value === "function") return setThunk(this, value as () => unknown);
    disposeThunk(this);
    this._commitResolved(value);
  }

  _commitResolved(value: unknown) {
    if (this.state === PENDING) {
      const bind = this._bindNext;
      this._bindNext = false;
      if (adoption !== null) return adoption.resolvePending(this, value, bind);
      this._clearPending();
    }
    if (value === nothing || value == null) return this._clear();
    const t = typeof value;
    if (t === "string" || t === "number" || t === "bigint" || t === "boolean")
      return this._commitText(String(value));
    if (value instanceof TemplateResult) return this._commitTemplate(value);
    if (value instanceof Keyed) return this._commitKeyed(value);
    if (value instanceof ElementSpec) return this._commitElement(value);
    if (value instanceof Unsafe) return this._commitUnsafe(value);
    if (Array.isArray(value)) return this._commitItems(value);
    if (t === "object") {
      const host = currentHost();
      const node = host.asNode(value);
      if (node !== null) return this._commitNode(node);
      const list = host.toList(value);
      if (list !== null) return this._commitItems(list);
      return this._commitText(host.stringify(value));
    }
    return this._commitText(String(value));
  }

  _commitText(text: string) {
    const st = this.state;
    if (st instanceof TextState) {
      if (st.text !== text) {
        currentHost().setText(st.node, text);
        st.text = text;
      }
      return;
    }
    this._clear();
    const node = currentHost().createText(text);
    this._insert(node);
    this.state = new TextState(node, text);
  }

  _commitTemplate(result: TemplateResult) {
    const template = getTemplate(result.strings, result.kind);
    const st = this.state;
    if (st instanceof TemplateState && st.instance.template === template)
      return st.instance.commit(result.values);
    this._clear();
    const instance = new TemplateInstance(template, this.owner);
    const fragment = instance.clone();
    instance.commit(result.values);
    this._insert(fragment);
    this.state = new TemplateState(instance);
  }

  _commitNode(node: HostNode) {
    const st = this.state;
    if (st instanceof NodeState && st.node === node) return;
    this._clear();
    this._insert(node);
    this.state = new NodeState(node);
  }

  _commitUnsafe(wrap: Unsafe) {
    const st = this.state;
    if (st instanceof UnsafeState && st.s === wrap.s) return;
    this._clear();
    this._insert(currentHost().parseMarkup(wrap.s));
    this.state = new UnsafeState(wrap.s);
  }

  _commitKeyed(wrap: Keyed) {
    const st = this.state;
    if (st instanceof KeyedState && st.k === wrap.k) return st.inner.commit(wrap.v);
    this._clear();
    const inner = new ChildPart(this.start, this.end, this.owner);
    inner.commit(wrap.v);
    this.state = new KeyedState(wrap.k, inner);
  }

  _commitElement(spec: ElementSpec) {
    const st = this.state;
    if (st instanceof ElementState && st.tag === spec.tag) return this._updateElement(st, spec);
    if (!VALID_TAG.test(spec.tag))
      throw new Error(`[light/html] invalid element() tag: ${String(spec.tag)}`);
    this._clear();
    const el = currentHost().createElement(spec.tag);
    const next = new ElementState(spec.tag, el);
    const bindings = spec.bindings ?? {};
    for (const [rawKey, value] of Object.entries(bindings)) {
      if (rawKey === "ref") continue;
      this._applyElementBinding(next, rawKey, value);
    }
    if (spec.children !== undefined) this._ensureElementChildPart(next).commit(spec.children);
    this._insert(el);
    this.state = next;
    next.ref = typeof bindings.ref === "function" ? bindings.ref : null;
    next.ref?.(el as HostElement);
  }

  _updateElement(st: ElementState, spec: ElementSpec) {
    const bindings = spec.bindings ?? {};
    for (const rawKey of st.committed.keys())
      if (!(rawKey in bindings)) this._applyElementBinding(st, rawKey, nothing);
    for (const [rawKey, eventBinding] of st.events)
      if (!(rawKey in bindings)) eventBinding.commit(undefined);
    for (const [rawKey, value] of Object.entries(bindings)) {
      if (rawKey === "ref") continue;
      this._applyElementBinding(st, rawKey, value);
    }
    const ref = typeof bindings.ref === "function" ? bindings.ref : null;
    if (ref !== st.ref) {
      st.ref?.(null);
      st.ref = ref;
      ref?.(st.el as HostElement);
    }
    if (spec.children !== undefined || st.childPart)
      this._ensureElementChildPart(st).commit(spec.children === undefined ? nothing : spec.children);
  }

  _ensureElementChildPart(st: ElementState) {
    if (!st.childPart) {
      const host = currentHost();
      const start = host.createAnchor(MARKER_START);
      const end = host.createAnchor(MARKER_END);
      host.insertBefore(st.el, start, null);
      host.insertBefore(st.el, end, null);
      st.childPart = new ChildPart(start, end, this.owner);
    }
    return st.childPart;
  }

  _applyElementBinding(st: ElementState, rawKey: string, value: unknown) {
    const el = st.el;
    const prefix = rawKey[0];
    if (prefix === "@") {
      let eventBinding = st.events.get(rawKey);
      if (!eventBinding) {
        eventBinding = new EventBinding(el, rawKey.slice(1), this.owner);
        st.events.set(rawKey, eventBinding);
      }
      eventBinding.commit(value === nothing ? undefined : value);
      return;
    }
    if (st.committed.get(rawKey) === value) return;
    st.committed.set(rawKey, value);
    const host = currentHost();
    if (prefix === ".") {
      host.setProperty(el, rawKey.slice(1), value === nothing ? undefined : value);
      return;
    }
    if (prefix === "?") {
      host.toggleAttribute(el, rawKey.slice(1), Boolean(value) && value !== nothing);
      return;
    }
    if (value === nothing || value == null) host.removeAttribute(el, rawKey);
    else host.setAttribute(el, rawKey, String(value));
  }

  _commitItems(raw: unknown[]) {
    let keyed = raw.length > 0;
    let sawWrap = false;
    for (const item of raw)
      if (item instanceof Keyed) sawWrap = true;
      else keyed = false;
    if (!keyed && sawWrap && !warnedMixedKeys) {
      warnedMixedKeys = true;
      console.warn("[light/html] mixed key()/plain items in one list, falling back to index diff");
    }
    let st = this.state;
    if (!(st instanceof ItemsState)) {
      this._clear();
      st = new ItemsState([], NO_KEYS, false);
      this.state = st;
    }
    const values = raw.map((item) => (item instanceof Keyed ? item.v : item));
    const newKeys = keyed ? raw.map((item) => (item instanceof Keyed ? item.k : undefined)) : NO_KEYS;
    if (keyed && st.keyed) {
      let reconciled = false;
      try {
        st.parts = this._reconcileKeyed(st.parts.slice(), st.keys, values, newKeys);
        st.keys = newKeys;
        reconciled = true;
      } finally {
        if (!reconciled) this._clear();
      }
      return;
    }
    const parts = st.parts;
    const shared = Math.min(parts.length, values.length);
    for (let i = 0; i < shared; i++) parts[i].commit(values[i]);
    if (values.length > shared) {
      const host = currentHost();
      const fragment = host.createFragment();
      for (let i = shared; i < values.length; i++) {
        const start = host.createAnchor(MARKER_START);
        const end = host.createAnchor(MARKER_END);
        host.insertBefore(fragment, start, null);
        host.insertBefore(fragment, end, null);
        const part = new ChildPart(start, end, this.owner);
        part.commit(values[i]);
        parts.push(part);
      }
      this._insert(fragment);
    }
    while (parts.length > values.length) {
      const last = parts.pop();
      if (last !== undefined) this._removeItemPart(last);
    }
    st.keys = newKeys;
    st.keyed = keyed;
  }

  /**
   * Keyed list reconciliation: the head/tail two-pointer algorithm with
   * key-map fallback (same strategy as lit's repeat). Items move as whole
   * marker-delimited DOM ranges; a reordered item is never recreated, so
   * focus, selection, and input state survive shuffles. It nulls out the
   * entries of `oldParts` it moves, so the caller passes a copy: if an item's
   * commit throws, the part's own list still holds every part to clear.
   */
  _reconcileKeyed(oldParts: (ChildPart | null)[], oldKeys: unknown[], newValues: unknown[], newKeys: unknown[]) {
    const newParts: (ChildPart | null)[] = [];
    for (let i = 0; i < newValues.length; i++) newParts.push(null);
    let oldHead = 0;
    let oldTail = oldParts.length - 1;
    let newHead = 0;
    let newTail = newValues.length - 1;
    let oldKeyToIdx: Map<unknown, number> | null = null;
    let newKeyToIdx: Map<unknown, number> | null = null;
    while (oldHead <= oldTail && newHead <= newTail)
      if (oldParts[oldHead] === null) oldHead++;
      else if (oldParts[oldTail] === null) oldTail--;
      else if (oldKeys[oldHead] === newKeys[newHead]) {
        const part = oldParts[oldHead] as ChildPart;
        part.commit(newValues[newHead]);
        newParts[newHead] = part;
        oldHead++;
        newHead++;
      } else if (oldKeys[oldTail] === newKeys[newTail]) {
        const part = oldParts[oldTail] as ChildPart;
        part.commit(newValues[newTail]);
        newParts[newTail] = part;
        oldTail--;
        newTail--;
      } else if (oldKeys[oldHead] === newKeys[newTail]) {
        const part = oldParts[oldHead] as ChildPart;
        this._moveItemPart(part, newParts[newTail + 1] ?? null);
        part.commit(newValues[newTail]);
        newParts[newTail] = part;
        oldHead++;
        newTail--;
      } else if (oldKeys[oldTail] === newKeys[newHead]) {
        const part = oldParts[oldTail] as ChildPart;
        this._moveItemPart(part, oldParts[oldHead] as ChildPart);
        part.commit(newValues[newHead]);
        newParts[newHead] = part;
        oldTail--;
        newHead++;
      } else {
        if (oldKeyToIdx === null) {
          oldKeyToIdx = new Map();
          for (let i = oldHead; i <= oldTail; i++) oldKeyToIdx.set(oldKeys[i], i);
          newKeyToIdx = new Map();
          for (let i = newHead; i <= newTail; i++) newKeyToIdx.set(newKeys[i], i);
        }
        if (!((newKeyToIdx as Map<unknown, number>).has(oldKeys[oldHead]))) {
          this._removeItemPart(oldParts[oldHead] as ChildPart);
          oldHead++;
        } else if (!((newKeyToIdx as Map<unknown, number>).has(oldKeys[oldTail]))) {
          this._removeItemPart(oldParts[oldTail] as ChildPart);
          oldTail--;
        } else {
          const oldIndex = oldKeyToIdx.get(newKeys[newHead]);
          const oldPart = oldIndex !== undefined ? oldParts[oldIndex] : null;
          if (oldIndex === undefined || oldPart === null || oldPart === undefined) {
            const part = this._createItemPart((oldParts[oldHead] as ChildPart).start);
            part.commit(newValues[newHead]);
            newParts[newHead] = part;
          } else {
            this._moveItemPart(oldPart, oldParts[oldHead] as ChildPart);
            oldPart.commit(newValues[newHead]);
            newParts[newHead] = oldPart;
            oldParts[oldIndex] = null;
          }
          newHead++;
        }
      }
    while (newHead <= newTail) {
      const ref = newParts[newTail + 1] ?? null;
      const part = this._createItemPart(ref ? ref.start : this.end);
      part.commit(newValues[newHead]);
      newParts[newHead++] = part;
    }
    while (oldHead <= oldTail) {
      const part = oldParts[oldHead++];
      if (part !== null) this._removeItemPart(part);
    }
    for (const p of newParts) if (p === null) throw new Error("[light/html] keyed reconcile left a hole");
    return newParts as ChildPart[];
  }

  _createItemPart(refNode: HostNode) {
    const host = currentHost();
    const parent = host.parentOf(this.end);
    const start = host.createAnchor(MARKER_START);
    const end = host.createAnchor(MARKER_END);
    host.insertBefore(parent, start, refNode);
    host.insertBefore(parent, end, refNode);
    return new ChildPart(start, end, this.owner);
  }

  _removeItemPart(part: ChildPart) {
    part.dispose();
    const host = currentHost();
    let node: HostNode | null = part.start;
    while (node !== null && node !== undefined) {
      const next = node === part.end ? null : host.nextSibling(node);
      host.remove(node);
      node = next;
    }
  }

  _moveItemPart(part: ChildPart, refPart: ChildPart | null) {
    const refNode = refPart ? refPart.start : this.end;
    const host = currentHost();
    const parent = host.parentOf(this.end);
    const nodes: HostNode[] = [];
    let node: HostNode | null = part.start;
    while (node !== null && node !== undefined) {
      nodes.push(node);
      if (node === part.end) break;
      node = host.nextSibling(node);
    }
    for (const n of nodes) host.insertBefore(parent, n, refNode);
  }

  _insert(node: HostNode) {
    const host = currentHost();
    host.insertBefore(host.parentOf(this.end), node, this.end);
  }

  _removeRange() {
    const host = currentHost();
    let node = host.nextSibling(this.start);
    while (node !== null && node !== undefined && node !== this.end) {
      const next = host.nextSibling(node);
      host.remove(node);
      node = next;
    }
  }

  _disposeState() {
    const st = this.state;
    if (st instanceof TemplateState) st.instance.dispose();
    else if (st instanceof ItemsState) for (const part of st.parts) part?.dispose();
    else if (st instanceof KeyedState) st.inner.dispose();
    else if (st instanceof ElementState) {
      st.ref?.(null);
      st.childPart?.dispose();
      for (const eventBinding of st.events.values()) eventBinding.dispose();
    }
  }

  _clear() {
    if (this.state === EMPTY) return;
    this._disposeState();
    this._removeRange();
    this.state = EMPTY;
  }

  _clearPending() {
    this._removeRange();
    this.state = EMPTY;
  }

  dispose() {
    disposeThunk(this);
    this._disposeState();
    this.state = EMPTY;
  }
}

export const createPart = (spec: PartSpec, node: unknown, owner: object | undefined): Part => {
  switch (spec.kind) {
    case "child": {
      const part = new ChildPart(node, currentHost().nextSibling(node), owner);
      part.valueIndex = spec.valueIndex;
      return part;
    }
    case "attr":
      return new AttributePart(spec, node);
    case "prop":
      return new PropertyPart(spec, node);
    case "bool":
      return new BooleanAttributePart(spec, node);
    case "event":
      return new EventPart(spec, node, owner);
    case "slot":
      return currentHost().createSlotPart(spec, node, owner);
    default:
      return new RawTextPart(spec, node);
  }
};

const roots: WeakMap<object, ChildPart> = new WeakMap();


/**
 * Render a value into a container. The root part is cached per container,
 * so repeated renders diff in place. Accepts any child-position value:
 * templates, primitives, arrays, key()/element()/unsafeHTML() wrappers,
 * DOM nodes, thunks, and null/undefined/nothing (clears).
 */
export const render = (value: unknown, container: unknown, options: RenderOptions = {}) => {
  const key = container as object;
  let part = roots.get(key);
  if (!part) {
    if (options.adopt && adoption !== null) part = adoption.rootPart(container, options) ?? undefined;
    if (!part) {
      const host = currentHost();
      const start = host.createAnchor(ROOT_MARKER_START);
      const end = host.createAnchor(ROOT_MARKER_END);
      host.insertBefore(container, start, null);
      host.insertBefore(container, end, null);
      part = new ChildPart(start, end, options.host);
    }
    roots.set(key, part);
  }
  part.commit(value == null ? nothing : value);
  return part;
};

export const hasRootPart = (container: unknown) => roots.has(container as object);

/**
 * Dispose the part tree rendered into a container; tears down thunk
 * effects, event listeners, and ref callbacks. Rendered DOM is left in
 * place.
 */
export const disposeTree = (container: unknown) => {
  const key = container as object;
  const part = roots.get(key);
  if (!part) return;
  part.dispose();
  roots.delete(key);
};
