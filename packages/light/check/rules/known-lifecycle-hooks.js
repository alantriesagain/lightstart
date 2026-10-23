import { LIFECYCLE_HOOKS } from "../../view/definition.js";
import { defineRule } from "../define.js";

const WRONG_NAMES = new Map([
  ["connectedCallback", "connected"],
  ["disconnectedCallback", "disconnected"],
  ["attributeChangedCallback", "willUpdate"],
  ["adoptedCallback", "connected"],
  ["mounted", "connected"],
  ["unmounted", "disconnected"],
  ["created", "connected"],
  ["destroyed", "disconnected"],
  ["beforeMount", "connected"],
  ["beforeUpdate", "willUpdate"],
  ["afterUpdate", "updated"],
  ["onConnected", "connected"],
  ["onDisconnected", "disconnected"],
  ["firstUpdate", "firstUpdated"],
]);

export default defineRule({
  severity: "warn",
  description: "Lifecycle hook names from other frameworks are silently dead code",
  why: "the engine only calls connected/disconnected/firstUpdated/updated/willUpdate, plus the hooks a host's plugins add; a Vue- or web-components-style name, or a lowercase spelling, is never invoked",
  check(ctx) {
    const hooks = [...LIFECYCLE_HOOKS, ...ctx.pluginHooks];
    const names = new Map([...WRONG_NAMES, ...hooks.map((hook) => /** @type {[string, string]} */ ([hook.toLowerCase(), hook]))]);
    for (const view of ctx.views()) {
      if (!view.isComponent) continue;
      for (const key of view.topLevelKeys) {
        const real = names.get(key);
        if (real && real !== key)
          ctx.report({
            file: view.file,
            offset: view.keyOffsets[key],
            message: `"${key}" is not a lifecycle hook, use "${real}" (hooks: ${hooks.join(", ")})`,
          });
      }
    }
  },
});
