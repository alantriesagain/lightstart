/**
 * A bounded cursor over one line of text, the surface a tokenizer reads
 * through. Anchored regexes are run sticky at the current position so a
 * long line stays linear.
 */

/** @import { Stream } from "../types.js" */

/** @type {WeakMap<RegExp, RegExp>} */
const sticky = new WeakMap();

/**
 * @param {RegExp} re
 * @returns {RegExp}
 */
const stickyOf = (re) => {
  let s = sticky.get(re);
  if (!s) {
    s = new RegExp(re.source.replace(/^\^/, ""), `${re.flags.replace(/[gy]/g, "")}y`);
    sticky.set(re, s);
  }
  return s;
};

/**
 * @param {string} string
 * @param {number} [start]
 * @param {number} [end]
 * @returns {Stream}
 */
export const createStream = (string, start = 0, end = string.length) => {
  /** @type {Stream} */
  const stream = {
    string,
    pos: start,
    start,
    end,
    next() {
      return stream.pos < end ? string[stream.pos++] : undefined;
    },
    peek() {
      return stream.pos < end ? string[stream.pos] : undefined;
    },
    eat(match) {
      if (stream.pos >= end) return undefined;
      const ch = string[stream.pos];
      const ok = typeof match === "string" ? ch === match : match.test(ch);
      if (!ok) return undefined;
      stream.pos++;
      return ch;
    },
    eatWhile(match) {
      const from = stream.pos;
      while (stream.eat(match) !== undefined);
      return stream.pos > from;
    },
    eatSpace() {
      return stream.eatWhile(/[ \t]/);
    },
    match(pattern, consume = true) {
      if (typeof pattern === "string") {
        if (stream.pos + pattern.length > end || !string.startsWith(pattern, stream.pos)) return null;
        if (consume) stream.pos += pattern.length;
        return pattern;
      }
      const re = stickyOf(pattern);
      re.lastIndex = stream.pos;
      const m = re.exec(string);
      if (!m || m.index + m[0].length > end) return null;
      if (consume) stream.pos += m[0].length;
      return m;
    },
    skipToEnd() {
      stream.pos = end;
    },
    sol() {
      return stream.pos === 0;
    },
    eol() {
      return stream.pos >= end;
    },
    current() {
      return string.slice(stream.start, stream.pos);
    },
    sub(subEnd) {
      return createStream(string, stream.pos, Math.min(end, subEnd));
    },
  };
  return stream;
};
