import { LIFECYCLE_HOOKS } from "../../view/definition.js";
import { defineRule } from "../define.js";

const WRONG_NAMES = new Map([
  ["teardown", "disconnected() plus this.$own(...) for each disposable"],
  ["unmounted", "disconnected"],
  ["destroyed", "disconnected"],
  ["beforeDestroy", "disconnected"],
  ["componentWillUnmount", "disconnected"],
  ["ngOnDestroy", "disconnected"],
  ["connectedCallback", "connected"],
  ["disconnectedCallback", "disconnected"],
  ["mounted", "connected"],
  ["created", "connected"],
  ["beforeMount", "connected"],
  ["onConnected", "connected"],
  ["onDisconnected", "disconnected"],
]);
const CONTROLLER_HOOKS = new Set(["connected", "disconnected"]);

export default defineRule({
  severity: "warn",
  description: "a controller's lifecycle is connected/disconnected plus $own(); other hook names are silently dead code",
  why: "defineController calls connected() when it builds the instance and disconnected() when it retires it, then drains the $own() teardowns; a teardown(), destroyed() or view-only hook such as render() is never invoked, so its cleanup never runs",
  check(ctx) {
    const viewOnly = new Set(["render", ...LIFECYCLE_HOOKS, ...ctx.pluginHooks].filter((hook) => !CONTROLLER_HOOKS.has(hook)));
    for (const controller of ctx.controllers())
      for (const member of controller.memberNames) {
        const real = WRONG_NAMES.get(member.name);
        if (real)
          ctx.report({
            file: controller.file,
            offset: member.offset,
            message: `"${member.name}" is not a controller hook and is never called; use ${real} (hooks: connected, disconnected)`,
          });
        else if (viewOnly.has(member.name))
          ctx.report({
            file: controller.file,
            offset: member.offset,
            message: `"${member.name}" is a view hook and is never invoked on a controller; controllers have connected and disconnected only`,
          });
      }
  },
});
