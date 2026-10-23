import { defineRule } from "../define.js";
import { elements } from "../parse/markup.js";

/** @param {string} prop */
const kebabOf = (prop) => prop.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/**
 * @param {string} source
 * @param {string} prop
 */
const booleanPropOptions = (source, prop) => {
  const decl = new RegExp(String.raw`(?:^|[{,\s])${prop}\s*:\s*(?:T\.boolean\s*\(|(true|false)\b)`).exec(source);
  if (!decl) return null;
  if (decl[1]) return decl[1];
  const open = decl.index + decl[0].length - 1;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
};

export default defineRule({
  severity: "error",
  description: "A T.boolean component property binds with the ?kebab-attribute form, not .prop",
  why: "boolean state belongs on the element as a toggled attribute: visible in the inspector, targetable from CSS ([is-streaming]), and the canonical reflected kebab spelling the component observes; exempt are attribute: false props (not bindable via attributes at all), sync props (not observed), and defaultValue: true booleans (?attr=${false} on a never-set attribute is a no-op, so the .prop form is the only way to express an initial false)",
  check(ctx) {
    const index = ctx.componentIndex();
    for (const file of ctx.files()) {
      if (!/\.(js|ts|html)$/.test(file) || /\.test\.(js|ts)$/.test(file)) continue;
      for (const template of ctx.markup(file))
        for (const el of elements(template)) {
          if (!el.tag.includes("-") || !index.has(el.tag)) continue;
          for (const attr of el.attrs) {
            if (attr.kind !== "prop" || !index.propsOf(el.tag)?.has(attr.name)) continue;
            const target = index.sourceOf(el.tag);
            if (!target) continue;
            const options = booleanPropOptions(target, attr.name);
            if (options === null) continue;
            if (/attribute\s*:\s*false/.test(options)) continue;
            if (/defaultValue\s*:\s*true/.test(options) || options.trim() === "true") continue;
            if (/\bsync\s*:/.test(options)) continue;
            ctx.report({
              file,
              offset: attr.offset,
              message: `.${attr.name} on <${el.tag}>: ${attr.name} is a T.boolean property; bind it as ?${kebabOf(attr.name)}=\${...}`,
            });
          }
        }
    }
  },
});
