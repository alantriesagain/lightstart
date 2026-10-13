/**
 * Light-DOM `<slot>` projection. A view renders its template with itself as
 * the host, so every `<slot>` the template clones knows which element it
 * projects from: the host's light children move into the slot element, which
 * stays in the DOM as their container (`display: contents` by the user-agent
 * stylesheet). A parent-owned child-part range (`<!--$-->...<!--/-->`) moves
 * as one block, so the parent's bindings inside it keep updating; the host's
 * own template never diffs a slot's children. Fallback content is parked while
 * anything is assigned and put back when the last unit leaves.
 */
import { balancedEnd, topLevelPair } from "./adopt.js";
import { ASSIGNED_ATTR, MARKER_START, UNSLOTTED_TAG } from "../html/constants.ts";

/** @import { PartSpec } from "../html/types.ts" */
/** @import { ProjectHooks, SlotHost } from "./types.ts" */

export { ASSIGNED_ATTR, UNSLOTTED_TAG };

/**
 * @param {unknown} host
 * @returns {host is SlotHost}
 */
export const isSlotHost = (host) => host instanceof Element && "$slotParts" in host && host.$slotParts instanceof Set;

/** @param {Node} node */
const isStart = (node) => node.nodeType === 8 && /** @type {Comment} */ (node).data === MARKER_START;

/**
 * The last node of the unit beginning at `first`: the balanced end marker of
 * a child-part range, or the node itself.
 * @param {ChildNode} first
 * @returns {ChildNode}
 */
export const unitEnd = (first) =>
  isStart(first) ? balancedEnd(/** @type {Comment} */ (first), null) ?? first : first;

/**
 * @param {ChildNode} first
 * @returns {ChildNode[]}
 */
export const unitNodes = (first) => {
  const end = unitEnd(first);
  /** @type {ChildNode[]} */
  const nodes = [];
  /** @type {ChildNode | null} */
  let node = first;
  while (node) {
    nodes.push(node);
    if (node === end) break;
    node = node.nextSibling;
  }
  return nodes;
};

/**
 * The slot a unit asks for: an element's `slot` attribute, a range's first
 * top-level element carrying one, the default slot otherwise.
 * @param {ChildNode} first
 */
export const unitName = (first) => {
  if (first.nodeType === 1) return /** @type {Element} */ (first).getAttribute("slot") ?? "";
  if (!isStart(first)) return "";
  const end = unitEnd(first);
  let node = first.nextSibling;
  while (node && node !== end) {
    if (node.nodeType === 1 && /** @type {Element} */ (node).hasAttribute("slot"))
      return /** @type {string} */ (/** @type {Element} */ (node).getAttribute("slot"));
    node = node.nextSibling;
  }
  return "";
};

let moving = 0;

/**
 * Move a unit before `ref` inside `parent`, through `moveBefore` when the
 * browser has it and both ends share a root, so a moved view keeps its state
 * and fires neither disconnect nor connect.
 * @param {ChildNode} first
 * @param {ParentNode} parent
 * @param {Node | null} ref
 */
export const moveUnit = (first, parent, ref) => {
  const nodes = unitNodes(first);
  const target = /** @type {ParentNode & { moveBefore?: (node: Node, ref: Node | null) => void }} */ (parent);
  const sameRoot = first.getRootNode() === parent.getRootNode();
  if (typeof target.moveBefore === "function" && sameRoot) {
    for (const node of nodes) target.moveBefore(node, ref);
    return;
  }
  if (sameRoot) moving++;
  try {
    for (const node of nodes) target.insertBefore(node, ref);
  } finally {
    if (sameRoot) moving--;
  }
};

/**
 * Whether a same-root projection move is in progress on a browser without
 * `moveBefore`. `insertBefore` fires disconnect and connect synchronously on
 * every custom element it moves; a view that reads this flag in those
 * callbacks treats the pair as the one move it is, the way
 * `connectedMoveCallback` does natively. A move across roots (a parked
 * fragment back into the document) is a real connect and never sets it.
 */
export const isMoving = () => moving > 0;

/**
 * @param {ChildNode | null} first
 * @param {{ start: unknown, end: unknown } | null} skip
 * @param {Element | null} holder
 * @returns {ChildNode[]}
 */
const collectUnits = (first, skip, holder) => {
  /** @type {ChildNode[]} */
  const units = [];
  let node = first;
  while (node) {
    if (skip && node === skip.start) {
      node = /** @type {Comment} */ (skip.end).nextSibling;
      continue;
    }
    if (holder && node === holder) {
      node = node.nextSibling;
      continue;
    }
    if (isStart(node)) {
      units.push(node);
      node = unitEnd(node).nextSibling;
      continue;
    }
    if (node.nodeType === 1 || node.nodeType === 3) units.push(node);
    node = node.nextSibling;
  }
  return units;
};

/**
 * The host's light children grouped into units: everything outside the
 * host's own root range and its holder of unassigned content, a child-part
 * range as one unit, non-marker comments skipped. Whitespace text moves
 * too, the way a shadow tree assigns it to the default slot, so two slotted
 * pieces keep the space between them.
 * @param {SlotHost} host
 */
export const lightUnits = (host) => collectUnits(host.firstChild, host.$root, host.$unslotted);

/** @param {ParentNode} parent */
export const unitsIn = (parent) => collectUnits(parent.firstChild, null, null);

/**
 * The hidden element that keeps a host's unassigned content connected but
 * unrendered, the way a shadow tree leaves a node no slot takes: created on
 * first need just before the root range, dropped once it empties.
 * @param {SlotHost} host
 * @param {Node | null} ref
 */
const holdUnslotted = (host, ref) => {
  const holder = document.createElement(UNSLOTTED_TAG);
  holder.hidden = true;
  host.insertBefore(holder, ref);
  host.$unslotted = holder;
  return holder;
};

export class SlotPart {
  /**
   * @param {PartSpec} spec
   * @param {Element} el
   * @param {object | undefined} host
   */
  constructor(spec, el, host) {
    this.el = el;
    /** @type {ChildNode[]} */
    this.units = [];
    /** @type {DocumentFragment | null} */
    this.parked = null;
    this.notify = false;
    this.pending = false;
    /** @type {SlotHost | null} */
    this.host = null;
    if (!isSlotHost(host) || !host.$slotParts) return;
    this.host = host;
    host.$slotParts.add(this);
    host.$queueProject();
  }

  get name() {
    return this.el.getAttribute("name") ?? "";
  }

  setFromValues() {}

  adopt() {
    if (!this.el.hasAttribute(ASSIGNED_ATTR)) {
      this.parked = null;
      return;
    }
    this.units = unitsIn(this.el);
    this.parked ??= document.createDocumentFragment();
  }

  park() {
    if (this.parked) return;
    const fragment = document.createDocumentFragment();
    fragment.append(...this.el.childNodes);
    this.parked = fragment;
    this.el.setAttribute(ASSIGNED_ATTR, "");
  }

  restore() {
    if (!this.parked) return;
    this.el.append(this.parked);
    this.parked = null;
    this.el.removeAttribute(ASSIGNED_ATTR);
  }

  release() {
    const host = this.host;
    if (!host) return;
    const rootStart = host.$root ? /** @type {Comment} */ (host.$root.start) : null;
    const ref = rootStart && rootStart.parentNode === host ? rootStart : null;
    for (const unit of this.units) if (unit.parentNode === this.el) moveUnit(unit, host, ref);
    this.units = [];
    this.restore();
  }

  dispose() {
    if (!this.host) return;
    this.release();
    this.host.$slotParts?.delete(this);
  }
}

/**
 * Distribute the host's units over the slots its templates currently render.
 * Slots are candidates in tree order and the first one per name wins; a unit
 * already in place is left alone, one that moved slots or just arrived is
 * moved, one naming a slot the host lacks stays where it is. Answers whether
 * a slot changed shape under another one, which asks for a second pass.
 *
 * @param {SlotHost} host
 * @param {ProjectHooks} hooks
 */
export const projectSlots = (host, hooks) => {
  if (!host.$slotParts) return false;
  const slots = [...host.$slotParts]
    .filter((part) => host.contains(part.el))
    .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  if (!slots.length) return false;
  /** @type {Map<string, SlotPart>} */
  const byName = new Map();
  for (const slot of slots) if (!byName.has(slot.name)) byName.set(slot.name, slot);
  /** @type {Map<SlotPart, ChildNode[]>} */
  const wanted = new Map(slots.map((slot) => [slot, []]));
  /** @type {ChildNode[]} */
  const stray = [];
  /** @param {ChildNode} unit */
  const route = (unit) => {
    const name = unitName(unit);
    const slot = byName.get(name);
    if (slot) /** @type {ChildNode[]} */ (wanted.get(slot)).push(unit);
    else {
      stray.push(unit);
      hooks.unknown(name);
    }
  };
  for (const slot of slots) for (const unit of slot.units) if (unit.parentNode === slot.el) route(unit);
  if (host.$unslotted) for (const unit of unitsIn(host.$unslotted)) route(unit);
  for (const unit of lightUnits(host)) route(unit);

  const rootStart = host.$root ? /** @type {Comment} */ (host.$root.start) : null;
  const ref = rootStart && rootStart.parentNode === host ? rootStart : null;
  if (stray.length) {
    const holder = host.$unslotted ?? holdUnslotted(host, ref);
    let cursor = holder.firstChild;
    for (const unit of stray) {
      if (unit === cursor) {
        cursor = unitEnd(unit).nextSibling;
        continue;
      }
      moveUnit(unit, holder, cursor);
    }
  }

  let again = false;
  for (const slot of slots) {
    const list = /** @type {ChildNode[]} */ (wanted.get(slot));
    if (list.length && !slot.parked) {
      for (const inner of slots)
        if (inner !== slot && inner.units.length && slot.el.contains(inner.el)) {
          inner.release();
          wanted.set(inner, []);
          again = true;
        }
      slot.park();
    }
    let cursor = slot.el.firstChild;
    for (const unit of list) {
      if (unit === cursor) {
        cursor = unitEnd(unit).nextSibling;
        continue;
      }
      moveUnit(unit, slot.el, cursor);
    }
    const changed = list.length !== slot.units.length || list.some((unit, i) => unit !== slot.units[i]);
    slot.units = list;
    if (!list.length) slot.restore();
    if (changed) slot.notify = true;
    hooks.watchSlot(slot.el);
    for (const unit of list)
      for (const node of unitNodes(unit)) if (node.nodeType === 1) hooks.watchUnit(/** @type {Element} */ (node));
  }

  if (host.$unslotted && !unitsIn(host.$unslotted).length) {
    host.$unslotted.remove();
    host.$unslotted = null;
  }

  for (const slot of slots) {
    if (!slot.notify || slot.pending) continue;
    slot.pending = true;
    queueMicrotask(() => {
      slot.pending = false;
      slot.notify = false;
      slot.el.dispatchEvent(new Event("slotchange"));
    });
  }
  return again;
};

/**
 * Move every unit a served host projected back before its root range, DOM
 * only, for a host about to throw its served render away: the parent's
 * content survives the wipe and the fresh render projects it again.
 * @param {Element} host
 */
export const unprojectUnits = (host) => {
  const pair = topLevelPair(host);
  if (!pair) return;
  /** @type {Element[]} */
  const owned = [];
  /** @param {ChildNode | null} first @param {Node | null} stop */
  const collect = (first, stop) => {
    for (let n = first; n && n !== stop; n = n.nextSibling) {
      if (n.nodeType !== 1) continue;
      const el = /** @type {Element} */ (n);
      if (el.localName.includes("-") && topLevelPair(el)) continue;
      if (el.localName === "slot" && el.hasAttribute(ASSIGNED_ATTR)) owned.push(el);
      else collect(el.firstChild, null);
    }
  };
  collect(pair.start.nextSibling, pair.end);
  for (const slot of owned) {
    for (const unit of unitsIn(slot)) moveUnit(unit, host, pair.start);
    slot.removeAttribute(ASSIGNED_ATTR);
  }
};
