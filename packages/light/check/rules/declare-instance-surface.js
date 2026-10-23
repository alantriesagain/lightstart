import { defineRule } from "../define.js";
import { collectExtendsNames, collectMixinNames, findUndeclaredInstanceFields } from "../parse/instance-surface.js";

export default defineRule({
  severity: "warn",
  description: "a component's `_`-prefixed instance field must be declared as a `props` entry (`T.object({ reactive: false, defaultValue: null })` for a plain handle); a field first assigned in a hook or method is not a declaration",
  why: "`defineComponent` types every `_`-prefixed field as `any`, so an undeclared scratch field is outside the component contract: no type, no per-instance default, and no reactive/plain distinction. A declared `reactive: false` property keeps the same private role with a type. `_` is the component author's namespace outright: everything the engine puts on the instance is `$`-prefixed, so this rule needs no list of names to excuse",
  check(ctx) {
    const selfPrefix = ctx.pkg?.name ? `${ctx.pkg.name}/` : "";
    for (const view of ctx.views()) {
      const { literal, sf, topLevelKeys } = view;
      if (!view.isComponent || !literal || !sf) continue;
      const declared = new Set([...topLevelKeys, ...view.propertyNames.map((p) => p.name)]);
      collectMixinNames(ctx.read, view.file, view.mixins, declared, selfPrefix);
      collectExtendsNames((tag) => ctx.componentIndex().sourceOf(tag), view.extends ?? null, declared);
      for (const { name, offset } of findUndeclaredInstanceFields({ literal, sf, declared, skip: (name) => !name.startsWith("_") }))
        ctx.report({
          file: view.file,
          offset,
          message: `instance field \`this.${name}\` is assigned or member-accessed but not declared; add it to \`properties\` as \`T.object({ reactive: false, defaultValue: null })\` (or the matching T.* type) so it is typed and per-instance`,
        });
    }
  },
});
