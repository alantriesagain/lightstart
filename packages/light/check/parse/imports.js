/**
 * Import specifiers found in a source text, by regex over the
 * comment-stripped code so a specifier quoted in prose is not one.
 */

import { stripComments } from "../strip-comments.js";

/** @import { ParsedImport } from "../types.ts" */

const IMPORT_RE = /import\s+(?:[\w$]+\s*,?\s*)?(?:\{[^}]*\}\s*)?(?:\*\s+as\s+[\w$]+\s*)?(?:from\s*)?["']([^"']+)["']/g;
const REEXPORT_RE = /export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /(?<![.\w$])import\s*\(\s*["']?([^"')]*)["']?\s*\)?/g;
const TYPE_IMPORT_RE = /import\s+type\b[^"']*["']([^"']+)["']|@import\s*\{[^}]*\}\s*from\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)\s*\./g;

/**
 * Every runtime import statement and dynamic `import()` in a source text.
 * Type-only imports are skipped. Offsets index the original text.
 * @param {string} source
 * @returns {ParsedImport[]}
 */
export const parseImports = (source) => {
  const code = stripComments(source);
  /** @type {ParsedImport[]} */
  const out = [];
  IMPORT_RE.lastIndex = 0;
  /** @type {RegExpExecArray | null} */
  let m;
  while ((m = IMPORT_RE.exec(code)) !== null) {
    const stmt = m[0];
    if (/^import\s+type\b/.test(stmt)) continue;
    const kind = /\{|\*\s+as/.test(stmt) ? "named" : /import\s+[\w$]/.test(stmt) ? "default" : "side-effect";
    out.push({ spec: m[1], offset: m.index, kind });
  }
  REEXPORT_RE.lastIndex = 0;
  while ((m = REEXPORT_RE.exec(code)) !== null)
    if (!/^export\s+type\b/.test(m[0])) out.push({ spec: m[1], offset: m.index, kind: "reexport" });
  DYNAMIC_IMPORT_RE.lastIndex = 0;
  while ((m = DYNAMIC_IMPORT_RE.exec(code)) !== null)
    out.push({ spec: m[1] || "", offset: m.index, kind: "dynamic" });
  return out;
};

/**
 * The specifiers a file needs only for its types: `import type`, a JSDoc
 * `@import`, and `import("x").T`. Read on the raw source, since `@import`
 * lives in a comment.
 * @param {string} source
 * @returns {Array<{ spec: string, offset: number }>}
 */
export const typeImports = (source) => {
  const out = [];
  TYPE_IMPORT_RE.lastIndex = 0;
  /** @type {RegExpExecArray | null} */
  let m;
  while ((m = TYPE_IMPORT_RE.exec(source)) !== null) out.push({ spec: m[1] ?? m[2] ?? m[3], offset: m.index });
  return out;
};
