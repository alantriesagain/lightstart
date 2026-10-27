/**
 * A per-line tokenizer cache. An edit marks lines from `line - lookAhead`
 * onward as possibly stale; a request re-tokenizes forward from there and,
 * as soon as a line's outgoing state equals what was cached for it, trusts
 * the cached lines after it again. `fill(deadline)` works ahead in idle time.
 */

/** @import { Language, LineResult, TokenCache } from "../types.js" */
import { equalState } from "./mode.js";

/**
 * @param {Language} language
 * @returns {TokenCache}
 */
export const createTokenCache = (language) => {
  /** @type {readonly string[]} */
  let lines = [];
  /** @type {Array<LineResult | undefined>} */
  let results = [];
  let valid = 0;

  const advance = () => {
    const index = valid;
    const previous = results[index];
    const before = index === 0 ? language.startState() : /** @type {LineResult} */ (results[index - 1]).state;
    const result = language.tokenizeLine(lines[index], before, (n) => lines[index + n] ?? null);
    results[index] = result;
    valid++;
    if (previous !== undefined && equalState(previous.state, result.state)) {
      let j = valid;
      while (j < lines.length && results[j] !== undefined) j++;
      valid = j;
    }
  };

  return {
    set(newLines) {
      lines = newLines;
      results = new Array(lines.length);
      valid = 0;
    },
    splice(from, removed, inserted) {
      const next = lines.slice();
      next.splice(from, removed, ...inserted);
      lines = next;
      results.splice(from, removed, ...new Array(inserted.length));
      const stale = Math.max(0, from - language.lookAhead);
      for (let i = stale; i < from; i++) results[i] = undefined;
      valid = Math.min(valid, stale);
    },
    line(n) {
      const index = n - 1;
      if (index < 0 || index >= lines.length) throw new RangeError(`line ${n} out of range 1..${lines.length}`);
      while (valid <= index) advance();
      return /** @type {LineResult} */ (results[index]);
    },
    ready(n) {
      return n - 1 < valid;
    },
    fill(deadline) {
      while (valid < lines.length) {
        if (!deadline()) return false;
        advance();
      }
      return true;
    },
    invalidateAll() {
      results = new Array(lines.length);
      valid = 0;
    },
  };
};
