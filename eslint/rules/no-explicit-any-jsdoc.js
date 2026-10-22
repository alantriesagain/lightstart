/**
 * `light/no-explicit-any-jsdoc`: no `any` in a JSDoc type. Light is typed
 * through JSDoc; an `any` there switches the checker off for whatever flows
 * through it, so a boundary that truly needs one says why in a disable line.
 *
 * The types are found by TypeScript's parser (the scanner `light check`'s
 * `light/no-any` uses), so nested braces, `@this {any}` and `{*}` count and
 * prose never does. `light/no-any` supersedes this rule; it stays for one
 * release.
 */

import * as ts from "typescript";
import { anyOffsets } from "../../check/parse/any.js";

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      forbidden:
        "Explicit `any` in JSDoc is banned. Use a specific type or `unknown` (and narrow). If this boundary genuinely needs `any`, prefix with `// eslint-disable-next-line light/no-explicit-any-jsdoc -- <reason>`.",
    },
  },
  create(context) {
    const { sourceCode } = context;
    return {
      Program() {
        const docs = sourceCode.getAllComments().filter((comment) => comment.type === "Block" && comment.value.startsWith("*") && comment.range && comment.loc);
        const sf = ts.createSourceFile(context.filename, sourceCode.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        const offsets = anyOffsets(sf);
        for (const comment of docs) {
          const [start, end] = /** @type {[number, number]} */ (comment.range);
          if (comment.loc && offsets.some((offset) => offset >= start && offset < end)) context.report({ loc: comment.loc, messageId: "forbidden" });
        }
      },
    };
  },
};

export default rule;
