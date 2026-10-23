/**
 * @bootstrapp/light/native/tui/slots: light-DOM projection on the terminal. A
 * `<slot>` in a view's template is a part the engine hands the host
 * (`createSlotPart`). After each render the view projects the children a
 * parent's template wrote inside its tag, the units before the root range
 * of its box, into the first slot of their name; a slot holding units parks
 * its fallback and shows it again when it empties; units naming a slot the
 * render lacks wait in a hidden `unslotted` box until one appears. A unit
 * is one node, or a parent's whole child-part range (`$` to `/`), which
 * stays the parent's and keeps updating where it moved. Units move with the
 * node-level insertBefore, so a slotted view neither disconnects nor
 * reconnects.
 */
import { MARKER_END, MARKER_START, ROOT_MARKER_START } from "../../html/constants.ts";
import { Part } from "../../html/part.ts";
import { UIEvent } from "./events.ts";
import { TAnchor, TBox, TElement, TNode } from "./node.ts";

import type { View } from "./view.ts";

const UNSLOTTED_TAG = "unslotted";

/** The root start anchor of a rendered box, or null before its first render. */
export const rootStart = (box: TBox): TAnchor | null => {
  for (let c = box.firstChild; c !== null; c = c.next) if (c instanceof TAnchor && c.label === ROOT_MARKER_START) return c;
  return null;
};

/**
 * The last node of the unit beginning at `first`: the balanced end anchor
 * of a child-part range, or the node itself.
 */
const unitEnd = (first: TNode): TNode => {
  if (!(first instanceof TAnchor) || first.label !== MARKER_START) return first;
  let depth = 0;
  for (let n: TNode | null = first; n !== null; n = n.next) {
    if (!(n instanceof TAnchor)) continue;
    if (n.label === MARKER_START) depth++;
    else if (n.label === MARKER_END) {
      depth--;
      if (depth === 0) return n;
    }
  }
  return first;
};

/** The nodes from `first` to `last`, inclusive. */
const unitNodes = (first: TNode, last: TNode): TNode[] => {
  const out: TNode[] = [];
  for (let n: TNode | null = first; n !== null; n = n.next) {
    out.push(n);
    if (n === last) break;
  }
  return out;
};

/** The units among the siblings from `first` up to `until` (exclusive, or the end), each a list of nodes. */
const unitsFrom = (first: TNode | null, until: TNode | null, out: TNode[][]) => {
  for (let n = first; n !== null && n !== until;) {
    const last = unitEnd(n);
    out.push(unitNodes(n, last));
    n = last.next;
  }
  return out;
};

/** The slot a unit names: an element's `slot` attribute, or the first top-level element's inside a range; "" otherwise. */
const unitName = (unit: TNode[]): string => {
  const first = unit[0];
  if (first instanceof TElement) {
    const name = first.attrs.get("slot");
    return name === undefined ? "" : name;
  }
  if (!(first instanceof TAnchor)) return "";
  let depth = 0;
  for (const n of unit) {
    if (n instanceof TAnchor) {
      if (n.label === MARKER_START) depth++;
      else if (n.label === MARKER_END) depth--;
    } else if (depth === 1 && n instanceof TElement) {
      const name = n.attrs.get("slot");
      if (name !== undefined) return name;
    }
  }
  return "";
};


const contains = (ancestor: TElement, node: TNode) => {
  for (let p = node.parent; p !== null; p = p.parent) if (p === ancestor) return true;
  return false;
};

/** The part for a `<slot>` element of a view's template. */
export class TSlotPart extends Part {
  el: TBox;
  owner: View | null;
  units: TNode[][];
  parked: TNode[] | null;

  constructor(el: TBox, owner: View | null) {
    super();
    this.el = el;
    this.owner = owner;
    this.units = [];
    this.parked = null;
    if (owner !== null) {
      owner.$slots.push(this);
      owner.$queueProject();
    }
  }

  name(): string {
    const name = this.el.attrs.get("name");
    return name === undefined ? "" : name;
  }

  /** Take the fallback, the slot's own children, out and keep it for when the slot empties. */
  park() {
    if (this.parked !== null) return;
    const kept: TNode[] = [];
    for (let c = this.el.firstChild; c !== null; c = c.next) kept.push(c);
    for (const k of kept) this.el.remove(k);
    this.parked = kept;
    this.el.setProp("assigned", true);
  }

  restore() {
    if (this.parked === null) return;
    for (const k of this.parked) this.el.insertBefore(k, null);
    this.parked = null;
    this.el.setProp("assigned", null);
  }

  /** Put the units back before the root range of the owner's box, and the fallback back in. */
  release() {
    if (this.owner !== null) {
      const box = this.owner.box;
      const start = rootStart(box);
      for (const unit of this.units) for (const n of unit) box.insertBefore(n, start);
    }
    this.units = [];
    this.restore();
  }

  dispose() {
    this.release();
    if (this.owner === null) return;
    const i = this.owner.$slots.indexOf(this);
    if (i >= 0) this.owner.$slots.splice(i, 1);
  }
}

/** The registered slot parts whose element is under `node`, in document order. */
const slotsIn = (node: TElement, parts: TSlotPart[], out: TSlotPart[]) => {
  for (let c = node.firstChild; c !== null; c = c.next) {
    if (!(c instanceof TElement)) continue;
    for (const part of parts) if (part.el === c) out.push(part);
    slotsIn(c, parts, out);
  }
  return out;
};

const sameUnits = (a: TNode[][], b: TNode[][]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i][0] !== b[i][0] || a[i].length !== b[i].length) return false;
  return true;
};

/**
 * One projection pass over a view's box; answers whether another is needed
 * (an inner slot gave up units an outer one now takes).
 */
const projectOnce = (box: TBox, parts: TSlotPart[]): boolean => {
  const start = rootStart(box);
  const found: TSlotPart[] = [];
  const ordered = slotsIn(box, parts, found);
  const byName = new Map<string, TSlotPart>();
  for (const slot of ordered) if (!byName.has(slot.name())) byName.set(slot.name(), slot);
  let holder: TBox | null = null;
  for (let c = box.firstChild; c !== null && c !== start; c = c.next) if (c instanceof TBox && c.tag === UNSLOTTED_TAG) holder = c;

  const units: TNode[][] = [];
  for (const slot of ordered) if (slot.parked !== null) unitsFrom(slot.el.firstChild, null, units);
  if (holder !== null) unitsFrom(holder.firstChild, null, units);
  const light: TNode[][] = [];
  unitsFrom(box.firstChild, start, light);
  for (const unit of light) if (!(unit[0] instanceof TBox && unit[0].tag === UNSLOTTED_TAG)) units.push(unit);

  const wanted = new Map<TSlotPart, TNode[][]>();
  const stray: TNode[][] = [];
  for (const unit of units) {
    const slot = byName.get(unitName(unit));
    if (slot === undefined) {
      stray.push(unit);
      continue;
    }
    const list = wanted.get(slot);
    if (list === undefined) wanted.set(slot, [unit]);
    else list.push(unit);
  }

  let again = false;
  for (const slot of ordered) {
    const list = wanted.get(slot);
    const next: TNode[][] = list === undefined ? [] : list;
    if (next.length > 0 && slot.parked === null) {
      for (const inner of parts) {
        if (inner === slot || inner.units.length === 0 || !contains(slot.el, inner.el)) continue;
        inner.release();
        again = true;
      }
      slot.park();
    }
    for (const unit of next) for (const n of unit) slot.el.insertBefore(n, null);
    const changed = !sameUnits(slot.units, next);
    slot.units = next;
    if (next.length === 0) slot.restore();
    if (changed) slot.el.handle(new UIEvent("slotchange"));
  }

  if (stray.length > 0) {
    if (holder === null) {
      holder = new TBox(UNSLOTTED_TAG);
      holder.setProp("hidden", true);
      box.insertBefore(holder, start);
    }
    for (const unit of stray) for (const n of unit) holder.insertBefore(n, null);
  } else if (holder !== null) box.remove(holder);
  return again;
};

/** Project a view's light units into the slots of its rendered template, in at most three passes. */
export const projectSlots = (box: TBox, parts: TSlotPart[]) => {
  for (let pass = 0; pass < 3; pass++) if (!projectOnce(box, parts)) return;
};

