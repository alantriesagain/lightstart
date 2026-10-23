import { defineRule } from "../define.js";
import { elements } from "../parse/markup.js";

const SKIP_PREFIX = /^(?:data-|aria-|client:)/;

/** @param {string} prop */
const kebabOf = (prop) => prop.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

export default defineRule({
  severity: "warn",
  description: "Multi-word component attributes should use the kebab-case form",
  why: "the view layer binds both spellings, but kebab-case (use-system-preference) is the canonical reflected form and the readable house style; the collapsed lowercase form is legacy",
  check(ctx) {
    const index = ctx.componentIndex();
    for (const file of ctx.componentFiles())
      for (const template of ctx.markup(file))
        for (const el of elements(template)) {
          if (!el.tag.includes("-") || !index.has(el.tag)) continue;
          const props = index.propsOf(el.tag);
          if (!props) continue;
          const lowered = new Map([...props].map((p) => [p.toLowerCase(), p]));
          for (const attr of el.attrs) {
            if (attr.kind !== "attr" || attr.name.includes("-") || SKIP_PREFIX.test(attr.name)) continue;
            const prop = lowered.get(attr.name);
            if (!prop) continue;
            const kebab = kebabOf(prop);
            if (kebab !== attr.name)
              ctx.report({
                file,
                offset: el.offset,
                message: `attribute "${attr.name}" on <${el.tag}>: prefer the kebab form "${kebab}" (canonical reflected spelling of ${prop})`,
              });
          }
        }
  },
});
