/**
 * @bootstrapp/light/tdom/node: the terminal node tree, the DOM's
 * replacement. Elements are typed classes with closed prop tables for what
 * they lay out and paint; an attribute an element has no prop for is kept
 * as an attribute, inert. Mutations bump versions up the ancestor chain
 * and request a frame. A view that owns an element is attached when the
 * element joins a root's tree and detached when it leaves.
 */
import { parseColor } from "./color.js";
import { frames } from "./scheduler.js";
import { UIEvent } from "./events.js";
import { ATTR_BOLD, ATTR_DIM, ATTR_INVERSE, ATTR_ITALIC, ATTR_STRIKE, ATTR_UNDERLINE, DEFAULT_STYLE, Style } from "./style.js";

/** @import { ViewCore } from "../view/core.js" */
/** @import { EventBinding } from "../html/parts.js" */

/** @typedef {string | number | boolean | null} PropValue */

export class TNode {
  constructor() {
    /** @type {TElement | null} */
    this.parent = null;
    this.x = 0;
    this.y = 0;
    this.w = 0;
    this.h = 0;
    this.version = 0;
  }

  isConnected() {
    /** @type {TNode | null} */
    let n = this;
    while (n !== null) {
      if (n instanceof TRoot) return true;
      n = n.parent;
    }
    return false;
  }

  invalidate() {
    /** @type {TNode | null} */
    let n = this;
    while (n !== null) {
      n.version++;
      n = n.parent;
    }
    frames.request();
  }

  nextSibling() {
    const p = this.parent;
    if (p === null) return null;
    const i = p.children.indexOf(this);
    return i >= 0 && i + 1 < p.children.length ? p.children[i + 1] : null;
  }

  dispose() {
    this.parent = null;
  }
}

/** A zero-size marker; a child part owns the range between a start and an end anchor. */
export class TAnchor extends TNode {
  /** @param {string} label */
  constructor(label) {
    super();
    this.label = label;
  }
}

/** An inline text leaf. */
export class TRun extends TNode {
  /** @param {string} text */
  constructor(text) {
    super();
    this.text = text;
  }

  /** @param {string} t */
  setText(t) {
    if (t === this.text) return;
    this.text = t;
    this.invalidate();
  }
}

/** A listener an element holds: the engine's binding under an event name. */
export class HandlerEntry {
  /**
   * @param {string} name
   * @param {EventBinding} binding
   * @param {boolean} once
   */
  constructor(name, binding, once) {
    this.name = name;
    this.binding = binding;
    this.once = once;
  }
}

/**
 * @param {string} name
 * @param {PropValue} v
 */
export const asString = (name, v) => {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  throw new Error("[tdom] prop \"" + name + "\" expects a string, got " + (v === null ? "null" : typeof v));
};

/**
 * @param {string} name
 * @param {PropValue} v
 */
export const asNumber = (name, v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (v.trim().length > 0 && !Number.isNaN(n)) return n;
  }
  throw new Error("[tdom] prop \"" + name + "\" expects a number, got " + (v === null ? "null" : typeof v === "string" ? JSON.stringify(v) : typeof v));
};

/**
 * @param {string} name
 * @param {PropValue} v
 */
export const asNumberOrNull = (name, v) => {
  if (v === null) return null;
  if (typeof v === "string" && (v === "" || v === "auto")) return null;
  return asNumber(name, v);
};

/** @param {PropValue} v */
export const asBool = (v) => {
  if (typeof v === "boolean") return v;
  if (v === null) return false;
  if (typeof v === "number") return v !== 0;
  return v !== "false";
};

/**
 * @param {string} name
 * @param {PropValue} v
 * @param {string[]} allowed
 */
export const asEnum = (name, v, allowed) => {
  const s = asString(name, v);
  if (allowed.indexOf(s) < 0) throw new Error("[tdom] prop \"" + name + "\" must be one of " + allowed.join("|") + ", got " + JSON.stringify(s));
  return s;
};

export class TElement extends TNode {
  /**
   * @param {string} kind box, text, span, input or fragment
   * @param {string} tag the tag the template wrote
   */
  constructor(kind, tag) {
    super();
    this.kind = kind;
    this.tag = tag;
    /** @type {TNode[]} */
    this.children = [];
    this.style = DEFAULT_STYLE;
    this.hidden = false;
    /** @type {Map<string, string>} */
    this.attrs = new Map();
    /** @type {Map<string, unknown>} */
    this.props = new Map();
    /** @type {HandlerEntry[]} */
    this.handlers = [];
    /** @type {ViewCore | null} */
    this.owner = null;
    this.attached = false;
  }

  /**
   * @param {TNode} node
   * @param {TNode | null} ref
   */
  insertBefore(node, ref) {
    if (node.parent !== null) node.parent.remove(node);
    if (ref === null) this.children.push(node);
    else {
      const i = this.children.indexOf(ref);
      if (i < 0) throw new Error("[tdom] insertBefore: the reference node is not a child of <" + this.tag + ">");
      this.children.splice(i, 0, node);
    }
    node.parent = this;
    node.invalidate();
  }

  /** @param {TNode} node */
  append(node) {
    this.insertBefore(node, null);
  }

  /** @param {TNode} node */
  remove(node) {
    const i = this.children.indexOf(node);
    if (i < 0) return;
    this.children.splice(i, 1);
    node.parent = null;
    this.invalidate();
  }

  /** @param {TNode} node */
  indexOf(node) {
    return this.children.indexOf(node);
  }

  /**
   * Set a prop by its template name: a style prop, one of the element's
   * own, or an attribute kept inert.
   * @param {string} name
   * @param {PropValue} v
   */
  setProp(name, v) {
    if (this.setKnownProp(name, v)) return;
    if (v === null || v === false) {
      if (this.attrs.delete(name)) this.invalidate();
    } else {
      const s = v === true ? "" : typeof v === "number" ? String(v) : v;
      if (this.attrs.get(name) !== s) {
        this.attrs.set(name, s);
        this.invalidate();
      }
    }
  }

  /**
   * Set a style prop or one of the element's own; answers whether `name` is one.
   * @param {string} name
   * @param {PropValue} v
   */
  setKnownProp(name, v) {
    return this.setStyleProp(name, v) || this.setOwnProp(name, v);
  }

  /**
   * @param {string} _name
   * @param {PropValue} _v
   * @returns {boolean} whether the element has a prop of that name
   */
  setOwnProp(_name, _v) {
    return false;
  }

  /**
   * @param {string} name
   * @param {PropValue} v
   */
  setStyleProp(name, v) {
    switch (name) {
      case "fg":
        this.setStyle(this.style.withFg(v === null ? -1 : parseColor(asString(name, v))));
        return true;
      case "bg":
        this.setStyle(this.style.withBg(v === null ? -1 : parseColor(asString(name, v))));
        return true;
      case "bold":
        this.setStyle(this.style.withAttr(ATTR_BOLD, asBool(v)));
        return true;
      case "dim":
        this.setStyle(this.style.withAttr(ATTR_DIM, asBool(v)));
        return true;
      case "italic":
        this.setStyle(this.style.withAttr(ATTR_ITALIC, asBool(v)));
        return true;
      case "underline":
        this.setStyle(this.style.withAttr(ATTR_UNDERLINE, asBool(v)));
        return true;
      case "inverse":
        this.setStyle(this.style.withAttr(ATTR_INVERSE, asBool(v)));
        return true;
      case "strike":
        this.setStyle(this.style.withAttr(ATTR_STRIKE, asBool(v)));
        return true;
      case "hidden": {
        const h = asBool(v);
        if (h !== this.hidden) {
          this.hidden = h;
          this.invalidate();
        }
        return true;
      }
      default:
        return false;
    }
  }

  /** @param {Style} s */
  setStyle(s) {
    if (s.equals(this.style)) return;
    this.style = s;
    this.invalidate();
  }

  /**
   * @param {string} name
   * @param {EventBinding} binding
   * @param {boolean} once
   */
  addHandler(name, binding, once) {
    this.handlers.push(new HandlerEntry(name, binding, once));
  }

  /**
   * @param {string} name
   * @param {EventBinding} binding
   */
  removeHandler(name, binding) {
    const i = this.handlers.findIndex((e) => e.name === name && e.binding === binding);
    if (i >= 0) this.handlers.splice(i, 1);
  }

  /**
   * Run this element's handlers for the event's type; answers whether one
   * consumed it. The event travels as `unknown` so that a handler typed with
   * the event's own class receives it as such in a native build.
   * @param {unknown} e a UIEvent
   */
  handle(e) {
    if (!(e instanceof UIEvent)) return false;
    for (const entry of this.handlers.slice()) {
      if (entry.name !== e.type) continue;
      if (entry.once) this.removeHandler(entry.name, entry.binding);
      entry.binding.handleEvent(e);
      if (e.consumed) return true;
    }
    return false;
  }

  /**
   * Bubble from this element up to the root; answers whether a handler consumed it.
   * @param {unknown} e a UIEvent
   */
  dispatch(e) {
    /** @type {TElement | null} */
    let n = this;
    while (n !== null) {
      if (n.handle(e)) return true;
      n = n.parent;
    }
    return false;
  }

  /** @returns {string[]} the non-default prop values, for dumps and tests */
  propsSummary() {
    return [];
  }

  describe() {
    const props = this.propsSummary();
    for (const [name, value] of this.attrs) props.push(value === "" ? name : name + "=" + JSON.stringify(value));
    const style = this.style.describe();
    if (style.length > 0) props.push(style);
    if (this.hidden) props.push("hidden");
    return props.length > 0 ? this.tag + "[" + props.join(",") + "]" : this.tag;
  }

  dispose() {
    for (const c of this.children) c.dispose();
    this.children.length = 0;
    this.handlers.length = 0;
    super.dispose();
  }
}

/** A block container with a one-axis flex layout. */
export class TBox extends TElement {
  /** @param {string} tag */
  constructor(tag) {
    super("box", tag);
    this.direction = "column";
    this.flex = 0;
    /** @type {number | null} */
    this.width = null;
    /** @type {number | null} */
    this.height = null;
    this.padding = 0;
    this.gap = 0;
    this.border = false;
    /** @type {string | null} */
    this.title = null;
    this.scroll = false;
    this.scrollTop = 0;
    this.stickToBottom = false;
    this.align = "stretch";
    this.rule = false;
  }

  /**
   * @param {string} name
   * @param {PropValue} v
   */
  setOwnProp(name, v) {
    switch (name) {
      case "direction":
        this.setDirection(asEnum(name, v, ["column", "row"]));
        return true;
      case "flex":
        this.setFlex(asNumber(name, v));
        return true;
      case "width":
        this.setWidth(asNumberOrNull(name, v));
        return true;
      case "height":
        this.setHeight(asNumberOrNull(name, v));
        return true;
      case "padding":
        this.setPadding(asNumber(name, v));
        return true;
      case "gap":
        this.setGap(asNumber(name, v));
        return true;
      case "border":
        this.setBorder(asBool(v));
        return true;
      case "title":
        this.setTitle(v === null ? null : asString(name, v));
        return true;
      case "scroll":
        this.setScroll(asBool(v));
        return true;
      case "scrollTop":
        this.setScrollTop(asNumber(name, v));
        return true;
      case "stickToBottom":
        this.setStickToBottom(asBool(v));
        return true;
      case "align":
        this.setAlign(asEnum(name, v, ["stretch", "start", "end"]));
        return true;
      default:
        return false;
    }
  }

  /** @param {string} s */
  setDirection(s) {
    if (this.direction === s) return;
    this.direction = s;
    this.invalidate();
  }

  /** @param {string} s */
  setAlign(s) {
    if (this.align === s) return;
    this.align = s;
    this.invalidate();
  }

  /** @param {number} n */
  setFlex(n) {
    if (this.flex === n) return;
    this.flex = n;
    this.invalidate();
  }

  /** @param {number} n */
  setPadding(n) {
    if (this.padding === n) return;
    this.padding = n;
    this.invalidate();
  }

  /** @param {number} n */
  setGap(n) {
    if (this.gap === n) return;
    this.gap = n;
    this.invalidate();
  }

  /** @param {number} n */
  setScrollTop(n) {
    if (this.scrollTop === n) return;
    this.scrollTop = n;
    this.invalidate();
  }

  /** @param {number | null} n */
  setWidth(n) {
    if (this.width === n) return;
    this.width = n;
    this.invalidate();
  }

  /** @param {number | null} n */
  setHeight(n) {
    if (this.height === n) return;
    this.height = n;
    this.invalidate();
  }

  /** @param {boolean} b */
  setBorder(b) {
    if (this.border === b) return;
    this.border = b;
    this.invalidate();
  }

  /** @param {boolean} b */
  setScroll(b) {
    if (this.scroll === b) return;
    this.scroll = b;
    this.invalidate();
  }

  /** @param {boolean} b */
  setStickToBottom(b) {
    if (this.stickToBottom === b) return;
    this.stickToBottom = b;
    this.invalidate();
  }

  /** @param {string | null} s */
  setTitle(s) {
    if (this.title === s) return;
    this.title = s;
    this.invalidate();
  }

  propsSummary() {
    /** @type {string[]} */
    const p = [];
    if (this.direction !== "column") p.push("direction=" + this.direction);
    if (this.flex !== 0) p.push("flex=" + String(this.flex));
    if (this.width !== null) p.push("width=" + String(this.width));
    if (this.height !== null) p.push("height=" + String(this.height));
    if (this.padding !== 0) p.push("padding=" + String(this.padding));
    if (this.gap !== 0) p.push("gap=" + String(this.gap));
    if (this.border) p.push("border");
    if (this.title !== null) p.push("title=" + JSON.stringify(this.title));
    if (this.scroll) p.push("scroll");
    if (this.scrollTop !== 0) p.push("scrollTop=" + String(this.scrollTop));
    if (this.stickToBottom) p.push("stickToBottom");
    if (this.align !== "stretch") p.push("align=" + this.align);
    return p;
  }
}

/** The tree root: a box the renderer sizes to the terminal. */
export class TRoot extends TBox {
  constructor() {
    super("root");
  }
}

/** A holder whose children splice into the parent it is inserted into. */
export class TFragment extends TElement {
  constructor() {
    super("fragment", "#fragment");
  }
}

/** A block of inline content (runs and spans), wrapped to its width. */
export class TText extends TElement {
  /** @param {string} tag */
  constructor(tag) {
    super("text", tag);
    this.wrap = "word";
  }

  /**
   * @param {string} name
   * @param {PropValue} v
   */
  setOwnProp(name, v) {
    if (name !== "wrap") return false;
    const w = asEnum(name, v, ["word", "char", "none"]);
    if (w !== this.wrap) {
      this.wrap = w;
      this.invalidate();
    }
    return true;
  }

  propsSummary() {
    return this.wrap === "word" ? [] : ["wrap=" + this.wrap];
  }
}

/** An inline styled container inside a text. */
export class TSpan extends TElement {
  /** @param {string} tag */
  constructor(tag) {
    super("span", tag);
  }
}

/** A multi-line text editor; the editing itself lives in editor.js. */
export class TInput extends TElement {
  /** @param {string} tag */
  constructor(tag) {
    super("input", tag);
    /** @type {string[]} */
    this.lines = [""];
    this.row = 0;
    this.col = 0;
    this.placeholder = "";
    this.minLines = 1;
    this.maxLines = 8;
  }

  isEmpty() {
    return this.lines.length === 1 && this.lines[0].length === 0;
  }

  value() {
    return this.lines.join("\n");
  }

  /**
   * @param {string} name
   * @param {PropValue} v
   */
  setOwnProp(name, v) {
    switch (name) {
      case "placeholder": {
        const s = v === null ? "" : asString(name, v);
        if (s !== this.placeholder) {
          this.placeholder = s;
          this.invalidate();
        }
        return true;
      }
      case "minLines": {
        const n = asNumber(name, v);
        if (n !== this.minLines) {
          this.minLines = n;
          this.invalidate();
        }
        return true;
      }
      case "maxLines": {
        const n = asNumber(name, v);
        if (n !== this.maxLines) {
          this.maxLines = n;
          this.invalidate();
        }
        return true;
      }
      default:
        return false;
    }
  }

  propsSummary() {
    /** @type {string[]} */
    const p = [];
    if (this.placeholder.length > 0) p.push("placeholder=" + JSON.stringify(this.placeholder));
    if (this.minLines !== 1) p.push("minLines=" + String(this.minLines));
    if (this.maxLines !== 8) p.push("maxLines=" + String(this.maxLines));
    return p;
  }
}
