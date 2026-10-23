/**
 * @file Probe M: the dispatch path typed `unknown` end to end. A subclass instance enters
 * `dispatch(e: unknown)`, is narrowed with instanceof to read its type, and the original value is
 * handed to a handler typed with the subclass; also the narrowed-to-base binding handed on, and
 * the same through a base-class-typed parameter, which probe I showed fails.
 */

class UIEvent {
  /** @param {string} type */
  constructor(type) {
    this.type = type;
    this.consumed = false;
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
  constructor() {
    /** @type {unknown} */
    this.handler = undefined;
  }

  /** @param {unknown} event */
  handleEvent(event) {
    const h = this.handler;
    if (typeof h === "function") return h(event);
    return undefined;
  }
}

/** @type {string[]} */
const seen = [];

/**
 * @param {unknown} e
 * @param {Binding} b
 */
const dispatchUnknown = (e, b) => {
  if (!(e instanceof UIEvent)) return "not-event";
  seen.push("type=" + e.type);
  return b.handleEvent(e);
};

/**
 * @param {unknown} e
 * @param {Binding} b
 */
const dispatchOriginal = (e, b) => {
  const typed = e instanceof UIEvent ? e.type : "?";
  seen.push("type=" + typed);
  return b.handleEvent(e);
};

/**
 * @param {UIEvent} e
 * @param {Binding} b
 */
const dispatchBase = (e, b) => b.handleEvent(e);

const b = new Binding();
b.handler = (/** @type {ChangeEvent} */ e) => {
  seen.push("got " + e.value);
};
try {
  dispatchUnknown(new ChangeEvent("narrowed"), b);
} catch (err) {
  seen.push("narrowed threw " + (err instanceof Error ? err.message : "?"));
}
try {
  dispatchOriginal(new ChangeEvent("original"), b);
} catch (err) {
  seen.push("original threw " + (err instanceof Error ? err.message : "?"));
}
try {
  dispatchBase(new ChangeEvent("base"), b);
} catch (err) {
  seen.push("base threw " + (err instanceof Error ? err.message : "?"));
}
console.log(seen.join(" | "));

export {};
