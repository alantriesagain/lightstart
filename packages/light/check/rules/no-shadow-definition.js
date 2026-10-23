import { defineRule } from "../define.js";

const FIX = {
  shadow: "every view renders light DOM and a <slot> in its template projects the host's children there; delete the key",
  css: "move the rules into the sibling .css file under :where(.tag, tag) and set style: true",
};

export default defineRule({
  severity: "error",
  description: "A view declares neither `shadow` nor `css`",
  why: "light renders every component into the light DOM: a <slot> projects the host's children in place, part names carry the tag, and the sibling .css file styles the whole component from the document. The two keys name a shadow root the engine no longer attaches, so a definition carrying them silently lost its styling",
  check(ctx) {
    for (const view of ctx.views()) {
      if (!view.isComponent) continue;
      for (const key of /** @type {const} */ (["shadow", "css"])) {
        if (!view.topLevelKeys.includes(key)) continue;
        ctx.report({
          file: view.file,
          offset: view.keyOffsets[key],
          message: `\`${key}:\` on <${view.tag}> names a shadow root the engine does not attach; ${FIX[key]}`,
        });
      }
    }
  },
});
