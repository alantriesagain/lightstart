/**
 * Class tokenizer: splits a utility token into variants, base, negativity,
 * importance and the trailing `/modifier`: all bracket-aware, so arbitrary
 * values (`text-[11px]`), typed arbitraries (`border-[length:3px]`), arbitrary
 * variants (`[&:hover]:underline`) and url()/color-mix() payloads survive.
 */

/**
 * @param {string} input
 * @param {string} separator
 */
const splitOutsideBrackets = (input, separator) => {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    else if (ch === separator && depth === 0) {
      parts.push(input.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(input.slice(start));
  return parts;
};

/**
 * @param {string} raw a single class token, e.g. "hover:-translate-y-0.5"
 * @returns {{raw: string, variants: string[], important: boolean, negative: boolean, base: string, stem: string, modifier: string|null}|null}
 */
export const parseClass = (raw) => {
  if (typeof raw !== "string" || !raw) return null;
  const segments = splitOutsideBrackets(raw, ":");
  /** @type {string[]} */
  const merged = [];
  for (const segment of segments) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && prev.includes("[") && !balanced(prev))
      merged[merged.length - 1] = `${prev}:${segment}`;
    else merged.push(segment);
  }
  let base = merged.pop();
  const variants = merged;
  if (base === undefined || base === "") return null;

  let important = false;
  if (base.startsWith("!")) {
    important = true;
    base = base.slice(1);
  } else if (base.endsWith("!")) {
    important = true;
    base = base.slice(0, -1);
  }

  let negative = false;
  if (base.startsWith("-") && base.length > 1 && !base.startsWith("-[")) {
    negative = true;
    base = base.slice(1);
  }

  let stem = base;
  /** @type {string | null} */
  let modifier = null;
  const slashParts = splitOutsideBrackets(base, "/");
  if (slashParts.length > 1) {
    const last = slashParts[slashParts.length - 1];
    if (/^\d+(?:\.\d+)?$/.test(last) || /^\[.*\]$/.test(last)) {
      modifier = last.startsWith("[") ? last.slice(1, -1) : last;
      stem = slashParts.slice(0, -1).join("/");
    }
  }

  return { raw, variants, important, negative, base, stem, modifier };
};

/** @param {string} value */
const balanced = (value) => {
  let depth = 0;
  for (const ch of value)
    if (ch === "[") depth++;
    else if (ch === "]") depth--;

  return depth <= 0;
};

/** Underscores become spaces inside arbitrary values; `\_` stays a literal underscore; url() payloads are preserved. */
/** @param {string} inner */
export const arbitraryValue = (inner) => {
  let out = "";
  let urlDepth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inner.slice(i, i + 4).toLowerCase() === "url(") urlDepth++;
    if (urlDepth > 0 && ch === ")") urlDepth--;
    if (ch === "\\" && inner[i + 1] === "_") {
      out += "_";
      i++;
    } else if (ch === "_" && urlDepth === 0) out += " ";
    else out += ch;
  }
  return spaceCalcOperators(out);
};

/** @param {string} value */
const spaceCalcOperators = (value) => {
  if (!/(?:calc|min|max|clamp)\(/i.test(value)) return value;
  return value.replace(/(?:calc|min|max|clamp)\([^()]*(?:\([^()]*\)[^()]*)*\)/gi, (expr) =>
    expr
      .replace(/(?<=[\d%)])\+(?=[\d.(])/g, " + ")
      .replace(/(?<=[\d%)])-(?=[\d.(])/g, " - ")
      .replace(/(?<=[\d%)])([*/])(?=[\d.(])/g, " $1 "));
};

/** Extracts `[...]`'s inner text if the whole rest is one arbitrary bracket, with an optional `type:` tag. */
/** @param {string} rest */
export const parseArbitrary = (rest) => {
  if (!rest.startsWith("[") || !rest.endsWith("]")) return null;
  const inner = rest.slice(1, -1);
  if (!inner) return null;
  const typeMatch = /^([a-z-]+):(.+)$/.exec(inner);
  if (typeMatch && !typeMatch[1].startsWith("--") && KNOWN_TYPES.has(typeMatch[1]))
    return { type: typeMatch[1], value: arbitraryValue(typeMatch[2]) };
  return { type: null, value: arbitraryValue(inner) };
};

const KNOWN_TYPES = new Set([
  "length", "color", "size", "number", "angle", "percentage", "url", "image",
  "position", "family-name", "generic-name", "line-width", "absolute-size",
  "relative-size", "shadow",
]);
