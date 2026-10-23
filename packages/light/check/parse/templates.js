/** `html\`...\`` and `svg\`...\`` template extents in a source text. */

/** @import { Template } from "../types.ts" */

/**
 * Index of the backtick closing the template literal whose body starts at
 * `pos`, stepping over `${}` expressions and nested templates; -1 when
 * unterminated.
 * @param {string} src
 * @param {number} pos
 * @returns {number}
 */
export const scanTemplateEnd = (src, pos) => {
  let depth = 0;
  for (; pos < src.length; pos++) {
    const ch = src[pos];
    if (ch === "\\") {
      pos++;
      continue;
    }
    if (depth === 0) {
      if (ch === "`") return pos;
      if (ch === "$" && src[pos + 1] === "{") {
        depth = 1;
        pos++;
      }
    } else if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === "`") {
      const end = scanTemplateEnd(src, pos + 1);
      if (end === -1) return -1;
      pos = end;
    }
  }
  return -1;
};

const TAGGED = /(?<![\w$.])(?:html|svg)`/g;

/**
 * Every `html\`` and `svg\`` template in the source, outermost extents only.
 * @param {string} source
 * @returns {Template[]}
 */
export const htmlTemplates = (source) => {
  /** @type {Template[]} */
  const out = [];
  TAGGED.lastIndex = 0;
  /** @type {RegExpExecArray | null} */
  let m;
  while ((m = TAGGED.exec(source)) !== null) {
    const start = m.index + m[0].length;
    const end = scanTemplateEnd(source, start);
    if (end === -1) break;
    out.push({ content: source.slice(start, end), start });
    TAGGED.lastIndex = end + 1;
  }
  return out;
};
