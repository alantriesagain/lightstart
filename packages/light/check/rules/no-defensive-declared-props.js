import { defineRule } from "../define.js";

export default defineRule({
  severity: "warn",
  description: "No defensive ?. on props with a non-null defaultValue, or on this.$emit",
  why: "the view state store seeds every declared defaultValue before first render, and $emit is a View base method; a ?. on either can never save a correct component, it only hides a real contract break. Props with defaultValue: null are the nullable idiom and stay exempt",
  check(ctx) {
    for (const file of ctx.componentFiles()) {
      const views = ctx.viewsIn(file).filter((view) => view.isComponent);
      if (!views.length) continue;
      const source = ctx.read(file) || "";
      const names = new Set(views.flatMap((view) => view.propertyNames.filter((p) => p.hasNonNullDefault).map((p) => p.name)));
      for (const name of names) {
        const pattern = new RegExp(String.raw`\bthis\.${name}\?\.`, "g");
        for (const match of source.matchAll(pattern))
          ctx.report({
            file,
            offset: match.index,
            message: `this.${name}?.: the prop declares a non-null defaultValue, so it is never nullish; read it plainly`,
          });
        const fallback = new RegExp(String.raw`\bthis\.${name}\s*\?\?(?!=)`, "g");
        for (const match of source.matchAll(fallback))
          ctx.report({
            file,
            offset: match.index,
            message: `this.${name} ??: the prop declares a non-null defaultValue, so the fallback never applies; read it plainly`,
          });
      }
      for (const match of source.matchAll(/\bthis\.\$emit\?\.\(/g))
        ctx.report({
          file,
          offset: match.index,
          message: "this.$emit?.(: $emit is a View base method, always present; call it plainly",
        });
    }
  },
});
