/**
 * @file P-A: the value model html/parts.js will use natively. Values are typed `unknown` and
 * dispatched by typeof, instanceof against module-level classes, Array.isArray, and Symbol.for
 * class fields written but never read through a narrowed value (scriptc 0.2.9 ICE SC9001 on that
 * read); thunks and handlers stay bare functions. Must print the same
 * under node and as a scriptc binary.
 */

const TPL = Symbol.for("light.html.template");
const WRAP = Symbol.for("light.html.wrap");
const nothing = Symbol.for("light.nothing");

class TemplateResult {
  /** @type {ReadonlyArray<string>} */
  [TPL];

  /**
   * @param {ReadonlyArray<string>} strings
   * @param {number} kind
   * @param {unknown[]} values
   */
  constructor(strings, kind, values) {
    this.strings = strings;
    this.kind = kind;
    this.values = values;
    this[TPL] = strings;
  }
}

class Keyed {
  /** @type {string} */
  [WRAP];

  /**
   * @param {unknown} k
   * @param {unknown} v
   */
  constructor(k, v) {
    this.k = k;
    this.v = v;
    this[WRAP] = "key";
  }
}

class Unsafe {
  /** @type {string} */
  [WRAP];

  /** @param {string} s */
  constructor(s) {
    this.s = s;
    this[WRAP] = "unsafe";
  }
}

/**
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 */
const html = (strings, ...values) => new TemplateResult(strings, 1, values);

/**
 * @param {unknown} k
 * @param {unknown} v
 */
const key = (k, v) => new Keyed(k, v);

/**
 * @param {unknown} value
 * @returns {string}
 */
const dispatch = (value) => {
  if (value === nothing || value == null) return "clear";
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return "text:" + String(value);
  if (typeof value === "function") return "thunk:" + dispatch(value());
  if (value instanceof TemplateResult) return "tpl" + String(value.strings.length) + "(" + value.values.map(dispatch).join(",") + ")";
  if (value instanceof Keyed) return "key(" + String(value.k) + ":" + dispatch(value.v) + ")";
  if (value instanceof Unsafe) return "unsafe(" + value.s + ")";
  if (Array.isArray(value)) return "[" + value.map(dispatch).join(",") + "]";
  return "str:object";
};

const sig = { value: 41 };
const result = html`<p>${1}${"two"}${true}${() => sig.value}${[1, [2, [3, "deep"]]]}${key(7, html`<b>${"x"}</b>`)}${new Unsafe("<i>")}${nothing}${null}${undefined}</p>`;
console.log("1:", dispatch(result));

/** @type {unknown} */
const u = result;
console.log("2: identity through unknown", u instanceof TemplateResult && u === result, u instanceof Keyed);

class Binding {
  /** @param {object} owner */
  constructor(owner) {
    this.owner = owner;
    /** @type {unknown} */
    this.handler = null;
    this.calls = 0;
  }

  /** @param {unknown} h */
  commit(h) {
    this.handler = h;
  }

  /** @param {{ type: string }} event */
  handleEvent(event) {
    const h = this.handler;
    this.calls++;
    if (typeof h === "function") return String(h.call(this.owner, event));
    return "no-handler";
  }
}
const owner = { name: "owner" };
const binding = new Binding(owner);
console.log("3: handler before", binding.handleEvent({ type: "click" }));
binding.commit(
  /**
   * @this {{ name: string }}
   * @param {{ type: string }} e
   */
  function (e) {
    return this.name + ":" + e.type;
  },
);
console.log("4: handler via call", binding.handleEvent({ type: "click" }), binding.calls);
binding.commit((/** @type {{ type: string }} */ e) => "arrow:" + e.type);
console.log("5: arrow handler", binding.handleEvent({ type: "key" }));

/** @type {Map<unknown, number>} */
const byKey = new Map();
byKey.set(7, 0);
byKey.set("seven", 1);
byKey.set(result, 2);
console.log("6: map unknown keys", byKey.get(7), byKey.get("seven"), byKey.get(result), byKey.has(8));

/** @type {unknown[]} */
const mixed = [result, key("k", [key(1, "a"), key(2, "b")]), 3, "s", null];
let keyed = mixed.length > 0;
for (const item of mixed) if (!(item instanceof Keyed)) keyed = false;
console.log("7: all keyed", keyed, mixed.filter((m) => m instanceof Keyed).length);

console.log("8: unknown object reaches the fallback", dispatch({ a: 1 }).length > 0 ? "handled" : "?");

export {};
