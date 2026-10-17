/**
 * `light/no-non-jsdoc-comments`: code speaks for itself. Only JSDoc is a
 * comment, prose JSDoc belongs on module headers and exported symbols, JSDoc
 * that types is legal anywhere, and an html template carries no comment
 * node. Directive comments (`eslint-disable`, `@ts-`, ...) are allowed.
 */

const JSDOC_HISTORY_RE =
  /\b(previously|formerly|renamed|used to be|back[\s-]?compat|backwards?[\s-]?compat(?:ible|ibility)?|existing importers?)\b/i;

const JSDOC_TAG_RE =
  /@(param|returns?|type|typedef|template|property|prop|import|arg|argument|callback|deprecated|see|example|throws|yields|this|satisfies|overload|extends|augments|implements|module|namespace|enum|typeParam|link|fires|event|borrows)\b/;

const TEMPLATE_COMMENT_RE = /<!--[\s\S]*?-->/g;

/** @typedef {ReturnType<import("eslint").SourceCode["getAllComments"]>[number]} Comment */
/** @typedef {import("eslint").AST.SourceLocation} SourceLocation */

/**
 * Where a node or comment sits; eslint's parser always records it.
 * @param {{ loc?: SourceLocation | null }} node
 */
const locOf = (node) => /** @type {SourceLocation} */ (node.loc);

/**
 * @param {{ range?: [number, number] }} node
 * @returns {[number, number]}
 */
const rangeOf = (node) => /** @type {[number, number]} */ (node.range);

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "suggestion",
    fixable: "code",
    schema: [],
    messages: {
      forbidden:
        "Code carries no comments. Delete this one and let names and structure say what it said; do not rewrite it as /* */ or /** */, which is the same comment in another form. JSDoc types (@param/@returns/@type/@import) anywhere and describes only a module header or an exported symbol. Knowledge worth keeping goes in a README or AGENTS.md.",
      history:
        "JSDoc must describe what the code IS, not narrate what changed. Remove the history/changelog clause (previously / no longer / renamed / legacy / back-compat / \"existing importers unchanged\").",
      placeholder:
        "A /** */ comment is the only thing in this block: a statement-comment smuggled as JSDoc, not documentation. Handle the case in code or delete the comment.",
      internalProse:
        "Prose JSDoc describes only a module header or an exported symbol. Delete this one and let names say what it said; do not move it into // or /* */. JSDoc that types (@param/@returns/@type/@import) stays legal anywhere. Knowledge worth keeping goes in a README or AGENTS.md.",
      templateComment:
        "HTML comments in an html`` template ship to the DOM as comment nodes. The template must speak for itself; delete it.",
    },
  },
  create(context) {
    const { sourceCode } = context;
    const ALLOW_PREFIX =
      /^(\s*(eslint-disable|eslint-enable|eslint-env|global\s|globals\s|@ts-|biome-ignore|prettier-ignore|c8 ignore|istanbul ignore|v8 ignore)|\/\s*<)/;

    /** @param {Comment} comment */
    const isEmptyBlockComment = (comment) => {
      const before = sourceCode.getTokenBefore(comment, { includeComments: false });
      const after = sourceCode.getTokenAfter(comment, { includeComments: false });
      return before?.value === "{" && after?.value === "}";
    };

    /**
     * @param {import("eslint").Rule.RuleFixer} fixer
     * @param {[number, number]} range
     */
    const removeRangeWithWhitespace = (fixer, [start, end]) => {
      const text = sourceCode.getText();
      let from = start;
      while (from > 0 && (text[from - 1] === " " || text[from - 1] === "\t"))
        from--;
      let to = end;
      if (text[to] === "\n" && (from === 0 || text[from - 1] === "\n")) to++;
      else if (text[to] === "\r" && text[to + 1] === "\n" && (from === 0 || text[from - 1] === "\n")) to += 2;
      return fixer.removeRange([from, to]);
    };

    return {
      TaggedTemplateExpression(node) {
        if (node.tag.type !== "Identifier" || node.tag.name !== "html") return;
        const text = sourceCode.getText();
        for (const quasi of node.quasi.quasis) {
          const raw = quasi.value.raw;
          if (!raw.includes("<!--")) continue;
          const rawStart = rangeOf(quasi)[0] + 1;
          const anchored = text.slice(rawStart, rawStart + raw.length) === raw;
          for (const match of raw.matchAll(TEMPLATE_COMMENT_RE)) {
            const start = rawStart + match.index;
            const end = start + match[0].length;
            context.report({
              loc: anchored
                ? { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) }
                : locOf(quasi),
              messageId: "templateComment",
              fix: anchored
                ? (fixer) => removeRangeWithWhitespace(fixer, [start, end])
                : undefined,
            });
          }
        }
      },
      "Program:exit"(program) {
        const headerEnd = program.body[0] ? rangeOf(program.body[0])[0] : Infinity;
        const topLevelStarts = new Map(
          program.body.map((statement) => [rangeOf(statement)[0], statement]),
        );

        for (const comment of sourceCode.getAllComments()) {
          if (/** @type {string} */ (comment.type) === "Shebang") continue;
          if (ALLOW_PREFIX.test(comment.value)) continue;

          const isJsdoc =
            comment.type === "Block" && comment.value.startsWith("*");
          if (!isJsdoc) {
            context.report({
              loc: locOf(comment),
              messageId: "forbidden",
              fix: (fixer) => removeRangeWithWhitespace(fixer, rangeOf(comment)),
            });
            continue;
          }

          if (JSDOC_HISTORY_RE.test(comment.value)) {
            context.report({ loc: locOf(comment), messageId: "history" });
            continue;
          }
          if (isEmptyBlockComment(comment)) {
            context.report({ loc: locOf(comment), messageId: "placeholder" });
            continue;
          }

          if (JSDOC_TAG_RE.test(comment.value)) continue;
          if (rangeOf(comment)[1] <= headerEnd) continue;
          const afterToken = sourceCode.getTokenAfter(comment, { includeComments: false });
          const attached = afterToken && topLevelStarts.get(afterToken.range[0]);
          if (attached && attached.type.startsWith("Export")) continue;
          context.report({
            loc: locOf(comment),
            messageId: "internalProse",
            fix: (fixer) => removeRangeWithWhitespace(fixer, rangeOf(comment)),
          });
        }
      },
    };
  },
};

export default rule;
