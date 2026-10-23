/**
 * @file Probe I: how a handler receives an event natively. A subclass instance passed as its base
 * class, boxed to unknown by the engine, then handed to a handler typed with the subclass: as an
 * arrow through `fn.call(owner, event)`, as a function expression through `fn.call`, and as a
 * direct call; and a `cond ? true : string` conditional boxed into a string | number | boolean | null
 * union.
 */

class UIEvent {
  /** @param {string} type */
  constructor(type) {
    this.type = type;
  }
}

class ChangeEvent extends UIEvent {
  /** @param {string} value */
  constructor(value) {
    super("change");
    this.value = value;
  }
}

class Binding {
  /** @param {object | undefined} owner */
  constructor(owner) {
    this.owner = owner;
    /** @type {unknown} */
    this.handler = undefined;
    this.el = { tag: "input" };
  }

  /** @param {unknown} event */
  handleEvent(event) {
    const h = this.handler;
    if (typeof h === "function") return h.call(this.owner ?? this.el, event);
    return undefined;
  }

  /** @param {unknown} event */
  handleDirect(event) {
    const h = this.handler;
    if (typeof h === "function") return h(event);
    return undefined;
  }
}

/** @param {UIEvent} e */
const dispatch = (e, /** @type {Binding} */ b) => b.handleEvent(e);

/** @type {string[]} */
const seen = [];
const arrow = new Binding({ name: "owner" });
arrow.handler = (/** @type {ChangeEvent} */ e) => {
  seen.push("arrow:" + e.value);
};
try {
  dispatch(new ChangeEvent("a"), arrow);
} catch (err) {
  seen.push("arrow threw " + (err instanceof Error ? err.message : "?"));
}

const fnExpr = new Binding({ name: "owner" });
fnExpr.handler = /** @param {ChangeEvent} e */ function (e) {
  seen.push("function:" + e.value);
};
try {
  dispatch(new ChangeEvent("b"), fnExpr);
} catch (err) {
  seen.push("function threw " + (err instanceof Error ? err.message : "?"));
}

const direct = new Binding(undefined);
direct.handler = (/** @type {ChangeEvent} */ e) => {
  seen.push("direct:" + e.value);
};
try {
  direct.handleDirect(new ChangeEvent("c"));
} catch (err) {
  seen.push("direct threw " + (err instanceof Error ? err.message : "?"));
}

const noOwner = new Binding(undefined);
noOwner.handler = (/** @type {ChangeEvent} */ e) => {
  seen.push("noowner:" + e.value);
};
try {
  dispatch(new ChangeEvent("d"), noOwner);
} catch (err) {
  seen.push("noowner threw " + (err instanceof Error ? err.message : "?"));
}

const base = new Binding({ name: "owner" });
base.handler = (/** @type {UIEvent} */ e) => {
  seen.push("base:" + e.type + ":" + (e instanceof ChangeEvent ? e.value : "-"));
};
try {
  dispatch(new ChangeEvent("e"), base);
} catch (err) {
  seen.push("base threw " + (err instanceof Error ? err.message : "?"));
}

const unknownParam = new Binding({ name: "owner" });
unknownParam.handler = (/** @type {unknown} */ e) => {
  seen.push("unknown:" + (e instanceof ChangeEvent ? e.value : "not-change"));
};
try {
  dispatch(new ChangeEvent("f"), unknownParam);
} catch (err) {
  seen.push("unknown threw " + (err instanceof Error ? err.message : "?"));
}
console.log(seen.join(" | "));

/** @typedef {string | number | boolean | null} PropValue */
/** @type {string[]} */
const kinds = [];
/** @param {PropValue} v */
const kindOf = (v) => kinds.push(v === null ? "null" : typeof v + ":" + String(v));
/** @param {string} value */
const viaTernary = (value) => kindOf(value === "" ? true : value);
/** @param {string} value */
const viaBranches = (value) => {
  if (value === "") kindOf(true);
  else kindOf(value);
};
viaTernary("2");
viaTernary("");
viaBranches("2");
viaBranches("");
console.log(kinds.join(" | "));

export {};
