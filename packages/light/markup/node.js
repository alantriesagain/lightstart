/**
 * @bootstrapp/light/markup/node: an in-memory tree with the shape the
 * renderer's host seam needs and nothing a browser adds. Elements hold
 * attributes, properties and listeners as maps; a fragment's children move
 * into the parent it is inserted into; a root is the one container whose
 * descendants count as connected.
 */

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
}

export class MComment extends MNode {
  /** @param {string} data */
  constructor(data) {
    super();
    /** @type {string} */
    this.data = data;
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
  }
}

export class MElement extends MNode {
  /** @param {string} tag */
  constructor(tag) {
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
    this.children = [];
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

/** @param {MNode} node */
export const removeNode = (node) => {
  const parent = node.parent;
  if (parent === null) return;
  const at = parent.children.indexOf(node);
  if (at >= 0) parent.children.splice(at, 1);
  node.parent = null;
};

/**
 * Put `node` into `parent` before `ref` (at the end when `ref` is null),
 * taking it out of wherever it was; a fragment's children go in its place.
 * @param {MElement} parent
 * @param {MNode} node
 * @param {MNode | null} ref
 */
export const insertBefore = (parent, node, ref) => {
  const nodes = node instanceof MFragment ? node.children.splice(0, node.children.length) : [node];
  for (const n of nodes) removeNode(n);
  const at = ref === null ? parent.children.length : parent.children.indexOf(ref);
  if (at < 0) throw new Error("[light/markup] the reference node is not a child of the parent");
  parent.children.splice(at, 0, ...nodes);
  for (const n of nodes) n.parent = parent;
};

/** @param {MNode} node */
export const nextSiblingOf = (node) => {
  const parent = node.parent;
  if (parent === null) return null;
  const at = parent.children.indexOf(node);
  return at >= 0 && at + 1 < parent.children.length ? parent.children[at + 1] : null;
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
    for (const child of el.children)
      if (child instanceof MElement) {
        out.push(child);
        visit(child);
      }
  };
  visit(node);
  return out;
};
