import { defineRule } from "../define.js";
import { stripCssComments } from "../strip-comments.js";

const SHADOW_SELECTOR = /::part\(|::slotted\(|:host\b/g;

const FIX = {
  "::part(": "select a part as [part~=tag-name]",
  "::slotted(": "select a slotted child as slot > [slot=name]",
  ":host": "select the host as :where(.tag, tag)",
};

export default defineRule({
  severity: "error",
  description: "A stylesheet uses no `::part()`, `::slotted()` or `:host`",
  why: "those three selectors only match across a shadow boundary, and every view renders light DOM: a part is an element with a part attribute named by its tag, a slotted child is the slot element's child, and the host is an ordinary element. A rule written with them matches nothing, so the styling it carries is silently lost",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!file.endsWith(".css")) continue;
      const css = stripCssComments(ctx.read(file) || "");
      SHADOW_SELECTOR.lastIndex = 0;
      /** @type {RegExpExecArray | null} */
      let m;
      while ((m = SHADOW_SELECTOR.exec(css)) !== null) {
        const which = /** @type {keyof typeof FIX} */ (m[0]);
        ctx.report({
          file,
          offset: m.index,
          message: `${which === ":host" ? ":host" : `${which})`} matches nothing in light DOM; ${FIX[which]}`,
        });
      }
    }
  },
});
