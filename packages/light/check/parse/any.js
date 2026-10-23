/**
 * Where a file's types say `any`: TypeScript type nodes and JSDoc types alike,
 * found by parsing rather than by pattern, so a JSDoc tag with nested braces,
 * `@this {any}` and a `{*}` all count, and prose or strings never do. Also the
 * comments that switch type checking off (`@ts-ignore`, `@ts-nocheck`).
 */

import * as ts from "typescript";

/** @import { Node, SourceFile } from "typescript" */

/** @param {Node} node @returns {readonly Node[]} the JSDoc comments the parser attached to a node */
const jsDocOf = (node) => /** @type {{ jsDoc?: readonly Node[] }} */ (/** @type {unknown} */ (node)).jsDoc ?? [];

/**
 * The start offset of every `any` (and JSDoc `*`) in the file's types, in source order.
 * @param {SourceFile} sf
 * @returns {number[]}
 */
export const anyOffsets = (sf) => {
  /** @type {Set<number>} */
  const found = new Set();
  /** @param {Node} node */
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword || node.kind === ts.SyntaxKind.JSDocAllType) found.add(node.getStart(sf));
    for (const doc of jsDocOf(node)) visit(doc);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return [...found].sort((a, b) => a - b);
};

/**
 * The offset of every `@ts-ignore` and `@ts-nocheck` directive in the file's
 * comments, where TypeScript reads them: at the start of a `//` comment, or
 * (`@ts-ignore` only) at the start of a line of a block comment. Comments
 * are found from the syntax tree, so the same words in a string, or in prose
 * about them, are not reported.
 * @param {SourceFile} sf
 * @returns {number[]}
 */
export const suppressionOffsets = (sf) => {
  const text = sf.getFullText();
  /** @type {Set<number>} */
  const found = new Set();
  /** @param {readonly import("typescript").CommentRange[] | undefined} ranges */
  const scan = (ranges) => {
    for (const range of ranges ?? []) {
      const comment = text.slice(range.pos, range.end);
      if (range.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
        const match = /^\/\/\/?\s*(@ts-(?:ignore|nocheck))\b/.exec(comment);
        if (match) found.add(range.pos + comment.indexOf(match[1]));
        continue;
      }
      let lineStart = 0;
      for (const line of comment.split("\n")) {
        const match = /^\s*[/*]*\s*(@ts-ignore)\b/.exec(line);
        if (match) found.add(range.pos + lineStart + line.indexOf(match[1]));
        lineStart += line.length + 1;
      }
    }
  };
  /** @param {Node} node */
  const visit = (node) => {
    scan(ts.getLeadingCommentRanges(text, node.pos));
    scan(ts.getTrailingCommentRanges(text, node.end));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return [...found].sort((a, b) => a - b);
};
