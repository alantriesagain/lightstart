import { defineRule } from "@lightstart/light/check/define.js";
import { elements } from "@lightstart/light/check/parse/markup.js";

/** @import { CheckContext } from "@lightstart/light/check/types.ts" */

export const RAW = { pre: "lc-code-block", table: "lc-table", kbd: "lc-kbd", details: "lc-accordion", dialog: "lc-modal" };
const PAGES = new Set(["catalogue", "component-doc", "preview", "property-editor", "css-editor", "sink", "theme-generator"].map((page) => `views/${page}.js`));

/**
 * Report every raw block lc has a component for, in the views `isPage` picks.
 * @param {CheckContext} ctx
 * @param {(file: string) => boolean} isPage
 */
export const reportRawBlocks = (ctx, isPage) => {
  for (const file of ctx.componentFiles()) {
    if (!isPage(file)) continue;
    for (const template of ctx.markup(file))
      for (const el of elements(template)) {
        if (!Object.hasOwn(RAW, el.tag)) continue;
        ctx.report({
          file,
          offset: el.offset,
          message: `<${el.tag}> drawn by hand in a documentation page; render <${RAW[/** @type {keyof typeof RAW} */ (el.tag)]}> instead, and extend it in the package if it lacks something`,
        });
      }
  }
};

export default defineRule({
  severity: "error",
  description: "the showcase's pages are composed from lc components, never from a raw block lc has a component for",
  why: "the showcase is the library's own documentation: a raw <pre>, <table>, <kbd>, <details> or <dialog> in one of its pages is a component lc should have had, drawn by hand instead, and every hand-drawn block is one more thing a theme cannot reach. The fix is in the package, a new component or an extended one, not in the page's markup",
  appliesTo: { when: (ctx) => ctx.pkg.name === "@lightstart/showcase" },
  check(ctx) {
    reportRawBlocks(ctx, (file) => PAGES.has(file));
  },
});
