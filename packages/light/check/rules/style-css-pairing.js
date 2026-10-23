import { defineRule } from "../define.js";

export default defineRule({
  severity: "warn",
  description: "style: true needs a sibling .css file, and a component's .css needs style: true",
  why: "a missing sibling silently loads nothing; a .css beside a component without style: true is never loaded",
  check(ctx) {
    const files = new Set(ctx.files());
    for (const file of ctx.componentFiles()) {
      if (!/\.(js|ts)$/.test(file)) continue;
      const views = ctx.viewsIn(file).filter((view) => view.isComponent);
      if (!views.length) continue;
      const cssFile = file.replace(/\.(js|ts)$/, ".css");
      for (const view of views)
        if (view.styleTrue && !files.has(cssFile))
          ctx.report({
            file,
            offset: view.keyOffsets.style,
            message: `style: true but ${cssFile} does not exist; the component loads no styles`,
          });
      if (files.has(cssFile) && views.every((view) => !view.styleTrue && view.styleKnown))
        ctx.report({
          file: cssFile,
          line: 1,
          col: 1,
          message: `${cssFile} is never loaded; add style: true to <${views[0].tag}> (${file})`,
        });
    }
  },
});
