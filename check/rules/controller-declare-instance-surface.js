import { defineRule } from "../define.js";
import { collectMixinNames, declaredPropertyNames, findUndeclaredInstanceFields } from "../parse/instance-surface.js";

const HOOKS = new Set(["connected", "disconnected"]);

export default defineRule({
  severity: "warn",
  description: "a controller instance field must be declared, as a `props` entry when views re-render on it or as a definition member when it is a plain field; a field first assigned in a method is not a declaration",
  why: "undeclared fields fall to ControllerInstance's `Record<string, unknown>` index signature and type as `unknown`, and a generator that types controllers from their definitions emits only the declared fields, so consumers see `unknown` too",
  check(ctx) {
    const selfPrefix = ctx.pkg?.name ? `${ctx.pkg.name}/` : "";
    for (const controller of ctx.controllers()) {
      const { literal, sf, topLevelKeys } = controller;
      const declared = new Set([...topLevelKeys, ...declaredPropertyNames(literal)]);
      collectMixinNames(ctx.read, controller.file, controller.mixins, declared, selfPrefix);
      for (const { name, offset } of findUndeclaredInstanceFields({ literal, sf, declared, skip: (name) => HOOKS.has(name) }))
        ctx.report({
          file: controller.file,
          offset,
          message: `instance field \`this.${name}\` is assigned or member-accessed but not declared; declare it as a member (\`${name}: /** @type {T} */ (value)\`) or, when views re-render on it, under \`props\`, so its type is generated instead of \`unknown\``,
        });
    }
  },
});
