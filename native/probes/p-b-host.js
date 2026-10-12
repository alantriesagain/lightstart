/**
 * @file P-B: the Host seam shape. A base class whose methods throw, a subclass installed through
 * a module-level variable, opaque `unknown` nodes with identity, a typedef union in a class
 * field, nullable function fields, a Set of class instances, and an overridden getter.
 */

/** @typedef {unknown} HostNode */

/**
 * @param {string} what
 * @returns {never}
 */
const unsupported = (what) => {
  throw new Error("[host] " + what + " is not supported by this host");
};

class Host {
  /**
   * @param {string} tag
   * @returns {HostNode}
   */
  createElement(tag) {
    return unsupported("createElement " + tag);
  }

  /**
   * @param {HostNode} parent
   * @param {HostNode} node
   * @param {HostNode | null} ref
   */
  insertBefore(parent, node, ref) {
    unsupported("insertBefore" + String(parent === node && ref === null));
  }

  /**
   * @param {HostNode} node
   * @returns {HostNode | null}
   */
  parentOf(node) {
    return unsupported("parentOf " + String(node === null));
  }

  /**
   * @param {HostNode} node
   * @returns {boolean}
   */
  isConnected(node) {
    return unsupported("isConnected " + String(node === null));
  }

  /** @param {() => void} flush */
  scheduleFlush(flush) {
    unsupported("scheduleFlush " + String(flush === null));
  }

  get label() {
    return "host";
  }
}

class TNode {
  /** @param {string} tag */
  constructor(tag) {
    this.tag = tag;
    /** @type {TNode[]} */
    this.children = [];
    /** @type {TNode | null} */
    this.parent = null;
  }
}

class TermHost extends Host {
  /**
   * @param {string} tag
   * @returns {HostNode}
   */
  createElement(tag) {
    return new TNode(tag);
  }

  /**
   * @param {HostNode} parent
   * @param {HostNode} node
   * @param {HostNode | null} ref
   */
  insertBefore(parent, node, ref) {
    const p = /** @type {TNode} */ (parent);
    const n = /** @type {TNode} */ (node);
    if (ref === null) p.children.push(n);
    else {
      const i = p.children.indexOf(/** @type {TNode} */ (ref));
      p.children.splice(i < 0 ? p.children.length : i, 0, n);
    }
    n.parent = p;
  }

  /**
   * @param {HostNode} node
   * @returns {HostNode | null}
   */
  parentOf(node) {
    return /** @type {TNode} */ (node).parent;
  }

  /**
   * @param {HostNode} node
   * @returns {boolean}
   */
  isConnected(node) {
    let n = /** @type {TNode | null} */ (node);
    while (n !== null) {
      if (n.tag === "root") return true;
      n = n.parent;
    }
    return false;
  }

  /** @param {() => void} flush */
  scheduleFlush(flush) {
    setImmediate(flush);
  }

  get label() {
    return "term:" + super.label;
  }
}

let host = new Host();
/** @param {Host} h */
const setHost = (h) => {
  host = h;
};

/** @typedef {{ type: "empty" } | { type: "text", node: HostNode, text: string } | { type: "items", parts: Part[], keys: unknown[] | null }} ChildState */

class Part {
  constructor() {
    /** @type {ChildState} */
    this.state = { type: "empty" };
    /** @type {(() => void) | null} */
    this.cleanup = null;
  }

  describe() {
    const st = this.state;
    switch (st.type) {
      case "empty":
        return "empty";
      case "text":
        return "text(" + st.text + ")";
      case "items":
        return "items(" + String(st.parts.length) + (st.keys === null ? "" : ":" + st.keys.map(String).join("")) + ")";
      default:
        return "?";
    }
  }
}

/** @type {string[]} */
const out = [];
try {
  host.createElement("x");
  out.push("base did not throw");
} catch (e) {
  out.push("base throws: " + (e instanceof Error ? e.message.slice(0, 28) : "?"));
}
setHost(new TermHost());
const root = host.createElement("root");
const a = host.createElement("a");
const b = host.createElement("b");
host.insertBefore(root, b, null);
host.insertBefore(root, a, b);
out.push("parent identity " + String(host.parentOf(a) === root) + " " + String(host.parentOf(root) === null));
out.push("connected " + String(host.isConnected(a)) + " " + String(host.isConnected(host.createElement("loose"))));
out.push("order " + /** @type {TNode} */ (root).children.map((c) => c.tag).join(""));
out.push("label " + host.label);

const part = new Part();
out.push(part.describe());
part.state = /** @type {ChildState} */ ({ type: "text", node: a, text: "hi" });
out.push(part.describe());
part.state = /** @type {ChildState} */ ({ type: "items", parts: [new Part(), new Part()], keys: [1, "k"] });
out.push(part.describe());
let cleaned = 0;
part.cleanup = () => {
  cleaned++;
};
const c = part.cleanup;
if (c !== null) c();
part.cleanup = null;
out.push("cleanup " + String(cleaned) + " " + String(part.cleanup === null));

/** @type {Set<Part>} */
const parts = new Set();
parts.add(part);
parts.add(part);
parts.add(new Part());
out.push("set " + String(parts.size) + " " + String(parts.has(part)));
let flushed = false;
host.scheduleFlush(() => {
  flushed = true;
  console.log(out.join(" | ") + " | flushed " + String(flushed));
});

export {};
