import { ASSIGNED_ATTR, MARKER_END, MARKER_START, ROOT_MARKER_END, ROOT_MARKER_START, UNSLOTTED_TAG } from "./constants.js";
import { ChildPart, createPart } from "./parts.js";
import { TemplateInstance, getTemplate } from "./template.js";

/** @import { ProjectedUnit, TemplateResult } from "./types.ts" */
/** @import { SlotPart } from "./slots.js" */

/** @param {Node} node */
const isSignificant = (node) => node.nodeType === 1 || node.nodeType === 8;

/**
 * @param {ChildNode | null} node
 * @param {Node | null} stop
 */
const nextSignificant = (node, stop) => {
  while (node && node !== stop && !isSignificant(node)) node = node.nextSibling;
  return node === stop ? null : node;
};

/**
 * @param {Node | null | undefined} node
 * @param {string} data
 */
const isMarker = (node, data) => node?.nodeType === 8 && /** @type {Comment} */ (node).data === data;

/**
 * The balanced end-marker partner of a start marker among its following
 * siblings; nested pairs of the same marker family are skipped by depth
 * counting.
 *
 * @param {Comment} start
 * @param {Node | null} stop
 * @param {string} [startData]
 * @param {string} [endData]
 */
export const balancedEnd = (start, stop, startData = MARKER_START, endData = MARKER_END) => {
  let depth = 0;
  let node = start.nextSibling;
  while (node && node !== stop) {
    if (isMarker(node, startData)) depth++;
    else if (isMarker(node, endData)) {
      if (depth === 0) return /** @type {Comment} */ (node);
      depth--;
    }
    node = node.nextSibling;
  }
  return null;
};

/**
 * The first top-level marker pair in a container. Component roots use the
 * distinct `$r`/`/r` markers so a root scan never mistakes a parent
 * template's part pair (light-DOM children) or an element() children pair
 * for the component's own render root.
 *
 * @param {Element | DocumentFragment} container
 * @param {boolean} [root]
 */
export const topLevelPair = (container, root = true) => {
  const startData = root ? ROOT_MARKER_START : MARKER_START;
  const endData = root ? ROOT_MARKER_END : MARKER_END;
  let node = container.firstChild;
  while (node) {
    if (isMarker(node, startData)) {
      const end = balancedEnd(/** @type {Comment} */ (node), null, startData, endData);
      if (end) return { start: /** @type {Comment} */ (node), end };
      return null;
    }
    node = node.nextSibling;
  }
  return null;
};

/**
 * The units a served host projected, as its parent's walker needs them: the
 * light units before the root range (an unslotted holder's children in its
 * place), then the children of every assigned slot the host owns in DOM
 * order, then the light units after the range. Null for an element that
 * projected nothing, which keeps the plain walk for every other element.
 *
 * @param {Element} host
 * @returns {ProjectedUnit[] | null}
 */
export const projectedUnits = (host) => {
  if (!host.localName.includes("-")) return null;
  const pair = topLevelPair(host);
  if (!pair) return null;
  /** @type {ProjectedUnit[]} */
  const units = [];
  let projected = false;
  /**
   * @param {ChildNode | null} first
   * @param {Node | null} stop
   * @param {string | null} slot
   */
  const pushUnits = (first, stop, slot) => {
    let n = nextSignificant(first, stop);
    while (n) {
      if (isMarker(n, MARKER_START)) {
        const end = balancedEnd(/** @type {Comment} */ (n), stop);
        if (!end) return false;
        units.push({ range: true, start: /** @type {Comment} */ (n), end, slot, taken: false });
        n = nextSignificant(end.nextSibling, stop);
        continue;
      }
      if (n.nodeType === 1) {
        const el = /** @type {Element} */ (n);
        if (el.localName === UNSLOTTED_TAG) {
          projected = true;
          if (!pushUnits(el.firstChild, null, null)) return false;
        } else units.push({ range: false, node: el, slot: slot ?? el.getAttribute("slot") ?? "", taken: false });
      }
      n = nextSignificant(n.nextSibling, stop);
    }
    return true;
  };
  /**
   * @param {ChildNode | null} first
   * @param {Node | null} stop
   */
  const collectSlots = (first, stop) => {
    for (let n = nextSignificant(first, stop); n; n = nextSignificant(n.nextSibling, stop)) {
      if (n.nodeType !== 1) continue;
      const el = /** @type {Element} */ (n);
      if (el.localName.includes("-") && topLevelPair(el)) continue;
      if (el.localName === "slot" && el.hasAttribute(ASSIGNED_ATTR)) {
        projected = true;
        if (!pushUnits(el.firstChild, null, el.getAttribute("name") ?? "")) return false;
      } else if (!collectSlots(el.firstChild, null)) return false;
    }
    return true;
  };
  if (!pushUnits(host.firstChild, pair.start, null)) return null;
  if (!collectSlots(pair.start.nextSibling, pair.end)) return null;
  if (!pushUnits(pair.end.nextSibling, null, null)) return null;
  return projected ? units : null;
};

/**
 * The children pair of a served `element()` host: its top-level pair, or
 * the one range the host projected into a slot.
 * @param {Element} el
 */
export const elementChildPair = (el) => {
  const pair = topLevelPair(el, false);
  if (pair) return pair;
  const units = projectedUnits(el);
  const ranges = units ? units.filter((u) => u.range) : [];
  return ranges.length === 1 ? { start: ranges[0].start, end: ranges[0].end } : null;
};

/**
 * The item part ranges of a serialized list: the range must contain only
 * marker pairs (plus insignificant whitespace) or the shape is not a list
 * and null is returned.
 *
 * @param {Comment} start
 * @param {Comment} end
 */
export const itemRanges = (start, end) => {
  const ranges = [];
  let node = nextSignificant(start.nextSibling, end);
  while (node) {
    if (!isMarker(node, MARKER_START)) return null;
    const itemEnd = balancedEnd(/** @type {Comment} */ (node), end);
    if (!itemEnd) return null;
    ranges.push({ start: /** @type {Comment} */ (node), end: itemEnd });
    node = nextSignificant(itemEnd.nextSibling, end);
  }
  return ranges;
};

/**
 * The single Text node of a range, when the range holds exactly one text
 * node and nothing significant.
 *
 * @param {Comment} start
 * @param {Comment} end
 * @returns {Text | null}
 */
export const singleTextIn = (start, end) => {
  /** @type {Text | null} */
  let text = null;
  let node = start.nextSibling;
  while (node && node !== end) {
    if (isSignificant(node)) return null;
    if (node.nodeType === 3) {
      if (text) return null;
      text = /** @type {Text} */ (node);
    }
    node = node.nextSibling;
  }
  return text;
};

/**
 * The single Element of a range, when the range holds exactly one element
 * and no other significant node.
 *
 * @param {Comment} start
 * @param {Comment} end
 */
export const singleElementIn = (start, end) => {
  let el = null;
  let node = start.nextSibling;
  while (node && node !== end) {
    if (node.nodeType === 8) return null;
    if (node.nodeType === 1) {
      if (el) return null;
      el = node;
    }
    node = node.nextSibling;
  }
  return /** @type {Element | null} */ (el);
};

/**
 * @param {string} a
 * @param {string} b
 */
export const normalizedEqual = (a, b) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/**
 * Walk the prepared template's static structure and the adopted DOM range
 * in parallel (pre-order over elements + comments, matching the prep
 * TreeWalker's node indexing) and collect the adopted node for every part
 * spec. A child part's committed content is skipped via its balanced end
 * marker. Static template comments missing from the adopted side are
 * tolerated; the prerender minifier strips non-marker comments. Any
 * structural disagreement returns null. A served host that projected its
 * children is matched through its slots, and an assigned slot's fallback,
 * which the served page lacks, gets its parts anchored on a fresh clone of
 * the template and handed to the slot part as its parked content.
 *
 * @param {import("./template.js").Template} template
 * @param {Comment} start
 * @param {Comment} end
 */
const matchTemplate = (template, start, end) => {
  const specs = template.parts;
  const targets = new Array(specs.length);
  /** @type {Set<number>} */
  const fresh = new Set();
  /** @type {Map<Element, DocumentFragment>} */
  const parked = new Map();
  let visitIndex = -1;
  let partIdx = 0;

  /** @param {unknown} adopted */
  const takeElementSpecs = (adopted) => {
    while (partIdx < specs.length && specs[partIdx].nodeIndex === visitIndex) {
      targets[partIdx] = adopted;
      partIdx++;
    }
  };

  /**
   * @param {ChildNode | null} a
   * @param {Node | null} aStop
   */
  const skipChildRoots = (a, aStop) => {
    while (isMarker(a, ROOT_MARKER_START)) {
      const rootEnd = balancedEnd(/** @type {Comment} */ (a), aStop, ROOT_MARKER_START, ROOT_MARKER_END);
      if (!rootEnd) return undefined;
      a = nextSignificant(rootEnd.nextSibling, aStop);
    }
    return a;
  };

  /**
   * @param {ChildNode | null} tFirst
   * @param {ChildNode | null} aFirst
   * @param {Node | null} aStop
   */
  const walkLevel = (tFirst, aFirst, aStop) => {
    let t = nextSignificant(tFirst, null);
    let a = skipChildRoots(nextSignificant(aFirst, aStop), aStop);
    if (a === undefined) return false;
    while (t) {
      if (t.nodeType === 8) {
        visitIndex++;
        if (/** @type {Comment} */ (t).data === MARKER_START) {
          if (!isMarker(a, MARKER_START)) return false;
          const aEnd = balancedEnd(/** @type {Comment} */ (a), aStop);
          if (!aEnd) return false;
          if (partIdx < specs.length && specs[partIdx].nodeIndex === visitIndex) {
            targets[partIdx] = { start: a, end: aEnd };
            partIdx++;
          }
          const tEnd = nextSignificant(t.nextSibling, null);
          if (!isMarker(tEnd, MARKER_END)) return false;
          visitIndex++;
          t = nextSignificant(/** @type {Comment} */ (tEnd).nextSibling, null);
          a = skipChildRoots(nextSignificant(aEnd.nextSibling, aStop), aStop);
          if (a === undefined) return false;
          continue;
        }
        if (a?.nodeType === 8 && /** @type {Comment} */ (a).data === /** @type {Comment} */ (t).data) {
          a = skipChildRoots(nextSignificant(a.nextSibling, aStop), aStop);
          if (a === undefined) return false;
        }
        t = nextSignificant(t.nextSibling, null);
        continue;
      }
      if (!a || a.nodeType !== 1 || /** @type {Element} */ (a).tagName !== /** @type {Element} */ (t).tagName)
        return false;
      visitIndex++;
      takeElementSpecs(a);
      if (!walkInto(/** @type {Element} */ (t), /** @type {Element} */ (a))) return false;
      t = nextSignificant(t.nextSibling, null);
      a = skipChildRoots(nextSignificant(a.nextSibling, aStop), aStop);
      if (a === undefined) return false;
    }
    return a === null;
  };

  /**
   * @param {Element} t
   * @param {Element} a
   */
  const walkInto = (t, a) => {
    if (t.localName === "slot") return walkSlot(t, a);
    const units = projectedUnits(a);
    return units ? walkUnits(t.firstChild, units) : walkLevel(t.firstChild, a.firstChild, null);
  };

  /**
   * @param {Element} t
   * @param {Element} a
   */
  const walkSlot = (t, a) => {
    if (!a.hasAttribute(ASSIGNED_ATTR)) return walkLevel(t.firstChild, a.firstChild, null);
    const clone = /** @type {Element} */ (document.importNode(t, true));
    const from = partIdx;
    if (!walkLevel(t.firstChild, clone.firstChild, null)) return false;
    for (let i = from; i < partIdx; i++) fresh.add(i);
    const fragment = document.createDocumentFragment();
    fragment.append(...clone.childNodes);
    parked.set(a, fragment);
    return true;
  };

  /**
   * @param {ChildNode | null} tFirst
   * @param {ProjectedUnit[]} units
   */
  const walkUnits = (tFirst, units) => {
    const rangeSlots = new Set(units.filter((u) => u.range).map((u) => u.slot));
    if (rangeSlots.size > 1) return false;
    /** @param {(u: ProjectedUnit) => boolean} pred */
    const take = (pred) => {
      const u = units.find((unit) => !unit.taken && pred(unit));
      if (u) u.taken = true;
      return u ?? null;
    };
    let t = nextSignificant(tFirst, null);
    while (t) {
      if (t.nodeType === 8) {
        visitIndex++;
        if (/** @type {Comment} */ (t).data === MARKER_START) {
          const u = take((unit) => unit.range);
          if (!u || !u.range) return false;
          if (partIdx < specs.length && specs[partIdx].nodeIndex === visitIndex) targets[partIdx++] = { start: u.start, end: u.end };
          const tEnd = nextSignificant(t.nextSibling, null);
          if (!isMarker(tEnd, MARKER_END)) return false;
          visitIndex++;
          t = nextSignificant(/** @type {Comment} */ (tEnd).nextSibling, null);
          continue;
        }
        t = nextSignificant(t.nextSibling, null);
        continue;
      }
      const el = /** @type {Element} */ (t);
      const u = take((unit) => !unit.range && unit.slot === (el.getAttribute("slot") ?? ""));
      if (!u || u.range || u.node.tagName !== el.tagName) return false;
      visitIndex++;
      takeElementSpecs(u.node);
      if (!walkInto(el, u.node)) return false;
      t = nextSignificant(t.nextSibling, null);
    }
    return units.every((u) => u.taken);
  };

  if (!walkLevel(template.el.content.firstChild, start.nextSibling, end)) return null;
  if (partIdx !== specs.length) return null;
  return { targets, fresh, parked };
};

/**
 * Adopt a template result into a part's existing prerendered range. Parts
 * are anchored to the adopted nodes and applied per stage: with
 * `bind` true (stage one) events and properties commit, attribute-like
 * parts seed their committed baseline from the DOM, and child parts stay
 * pending with their content preserved; with `bind` false (stage two)
 * every part commits, resolving pending content in place, a value the range
 * cannot adopt waiting for the part's settle hook first.
 *
 * @param {ChildPart} part
 * @param {TemplateResult} result
 * @param {boolean} bind
 */
export const adoptTemplateResult = (part, result, bind) => {
  const template = getTemplate(result.strings, result.kind);
  const match = matchTemplate(template, part.start, part.end);
  if (!match) return false;
  const { targets, fresh, parked } = match;
  const specs = template.parts;
  const instance = new TemplateInstance(template, part.host);
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    if (fresh.has(i)) {
      const p = createPart(spec, spec.kind === "child" ? targets[i].start : targets[i], part.host);
      p.setFromValues(result.values);
      instance.parts.push(p);
      continue;
    }
    if (spec.kind === "child") {
      const child = part._child(targets[i].start, targets[i].end);
      child.valueIndex = spec.valueIndex;
      child.state = { type: "pending" };
      instance.parts.push(child);
      continue;
    }
    const p = createPart(spec, targets[i], part.host);
    if (spec.kind === "slot" && parked.has(targets[i])) /** @type {SlotPart} */ (p).parked = parked.get(targets[i]) ?? null;
    instance.parts.push(p);
  }
  for (let i = 0; i < specs.length; i++) if (!fresh.has(i)) instance.parts[i].adopt(result.values, bind);
  part.state = { type: "template", instance };
  return true;
};
