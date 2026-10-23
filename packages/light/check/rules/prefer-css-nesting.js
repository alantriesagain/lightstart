import { defineRule } from "../define.js";
import { stripCssComments } from "../strip-comments.js";

/** @param {string} css */
const topLevelSelectors = (css) => {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      if (depth === 0) out.push({ selector: css.slice(start, i).trim(), offset: start });
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) start = i + 1;
    } else if (ch === ";" && depth === 0) start = i + 1;
  }
  return out.filter((s) => s.selector);
};

export default defineRule({
  severity: "warn",
  description: "One :where(.tag, tag) block per component css; use native nesting instead of repeating the prefix",
  why: "tens of repeated :where() prefixes obscure structure and drift apart; nesting keeps one scope root. @media/@container nest inside the block; only @keyframes/:root/::view-transition/ancestor selectors stay top-level (and carry no prefix)",
  check(ctx) {
    const files = new Set(ctx.files());
    for (const view of ctx.views()) {
      if (!view.isComponent || !view.styleTrue || !view.tag || !/\.(js|ts)$/.test(view.file)) continue;
      const cssFile = view.file.replace(/\.(js|ts)$/, ".css");
      if (!files.has(cssFile)) continue;
      const css = stripCssComments(ctx.read(cssFile) || "");
      const ownPrefix = new RegExp(`(?:^|,\\s*):where\\(\\s*\\.${view.tag}\\s*,\\s*${view.tag}\\s*\\)`);
      const prefixed = topLevelSelectors(css).filter((s) => ownPrefix.test(s.selector));
      if (prefixed.length > 1)
        ctx.report({
          file: cssFile,
          offset: prefixed[1].offset,
          message: `${prefixed.length} top-level :where(...${view.tag}...) blocks; merge into ONE :where(.${view.tag}, ${view.tag}) block with nested selectors (&:hover, &::part(), nested @media all work inside)`,
        });
    }
  },
});
