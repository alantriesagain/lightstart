/**
 * Value formatting for assertion messages. A deliberate subset of node's
 * `util.inspect`: enough structure to read a failure and diff two values, not
 * a byte-identical reimplementation (nothing asserts on message text).
 */

const QUOTE = "'";

/** @param {string} value @returns {string} */
const quote = (value) => {
  const escaped = value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/'/g, "\\'");
  return `${QUOTE}${escaped}${QUOTE}`;
};

/** @param {unknown} value @returns {string} */
const primitive = (value) => {
  if (typeof value === "string") return quote(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "number") return Object.is(value, -0) ? "-0" : String(value);
  return String(value);
};

/** @param {string|symbol} key @returns {string} */
const keyText = (key) =>
  typeof key === "symbol" ? `[${key.toString()}]`
    : /^[A-Za-z_$][\w$]*$/.test(key) ? key
      : quote(key);

/** @param {string} open @param {string[]} parts @param {string} close @param {number} indent @returns {string} */
const wrap = (open, parts, close, indent) => {
  if (parts.length === 0) return `${open}${close}`;
  const oneLine = `${open} ${parts.join(", ")} ${close}`;
  if (oneLine.length <= 72 && !oneLine.includes("\n")) return oneLine;
  const pad = " ".repeat(indent + 2);
  return `${open}\n${parts.map((part) => pad + part).join(",\n")}\n${" ".repeat(indent)}${close}`;
};

/**
 * @param {unknown} value
 * @param {{ depth?: number, indent?: number, seen?: Set<object> }} [options]
 * @returns {string}
 */
export const inspect = (value, { depth = 4, indent = 0, seen = new Set() } = {}) => {
  if (value === null || typeof value !== "object" && typeof value !== "function") return primitive(value);
  if (typeof value === "function") return value.name ? `[Function: ${value.name}]` : "[Function (anonymous)]";
  if (seen.has(value)) return "[Circular *1]";
  if (depth < 0) return Array.isArray(value) ? "[Array]" : "[Object]";

  seen.add(value);
  /** @param {unknown} child @returns {string} */
  const nested = (child) => inspect(child, { depth: depth - 1, indent: indent + 2, seen });
  try {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
    if (value instanceof RegExp) return String(value);
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      const typed = /** @type {{ constructor: Function, length: number } & Iterable<unknown>} */ (/** @type {unknown} */ (value));
      return `${typed.constructor.name}(${typed.length}) ${wrap("[", [...typed].map(primitive), "]", indent)}`;
    }
    if (value instanceof ArrayBuffer) return `ArrayBuffer { byteLength: ${value.byteLength} }`;
    if (value instanceof Map)
      return `Map(${value.size}) ${wrap("{", [.../** @type {Map<unknown, unknown>} */ (value)].map(([k, v]) => `${nested(k)} => ${nested(v)}`), "}", indent)}`;
    if (value instanceof Set)
      return `Set(${value.size}) ${wrap("{", [...value].map(nested), "}", indent)}`;
    if (Array.isArray(value)) return wrap("[", value.map(nested), "]", indent);

    const record = /** @type {Record<string|symbol, unknown>} */ (value);
    const name = value.constructor && value.constructor !== Object ? `${value.constructor.name} ` : "";
    const entries = [
      ...Object.keys(value).map((key) => `${keyText(key)}: ${nested(record[key])}`),
      ...Object.getOwnPropertySymbols(value)
        .filter((symbol) => Object.prototype.propertyIsEnumerable.call(value, symbol))
        .map((symbol) => `${keyText(symbol)}: ${nested(record[symbol])}`),
    ];
    return name + wrap("{", entries, "}", indent);
  } finally {
    seen.delete(value);
  }
};

/**
 * A line-oriented diff of two inspected values, in node's `+ actual`
 * `- expected` orientation. Common lines are prefixed with two spaces.
 * @param {unknown} actual
 * @param {unknown} expected
 * @returns {string[]}
 */
export const diffLines = (actual, expected) => {
  const left = inspect(actual).split("\n");
  const right = inspect(expected).split("\n");
  /** @type {string[]} */
  const out = [];
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) {
    const a = left[i];
    const b = right[i];
    if (a === b) out.push(`  ${a}`);
    else {
      if (a !== undefined) out.push(`+ ${a}`);
      if (b !== undefined) out.push(`- ${b}`);
    }
  }
  return out;
};
