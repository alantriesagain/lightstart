import { defineRule } from "../define.js";

const BUILTIN_METHODS = ["$own", "$attach", "$dispose"];
const escape = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default defineRule({
  severity: "warn",
  description: "No defensive ?. or ?? on a controller's own props with a non-null default, or ?.() on its own methods",
  why: "the controller store seeds every declared default when it builds the instance, and methods are on the instance before connected() runs; a ?. or ?? on either can never save a correct controller, it only hides a real contract break. Props defaulting to null are the nullable idiom and stay exempt",
  check(ctx) {
    for (const controller of ctx.controllers()) {
      const { file, literal, sf } = controller;
      const start = literal.getStart(sf);
      const body = controller.source.slice(start, literal.end);
      const report = (/** @type {number} */ index, /** @type {string} */ message) => ctx.report({ file, offset: start + index, message });
      for (const prop of controller.propertyNames) {
        if (!prop.hasNonNullDefault) continue;
        const name = escape(prop.name);
        for (const match of body.matchAll(new RegExp(String.raw`\bthis\.${name}\?\.`, "g")))
          report(match.index, `this.${prop.name}?.: the prop declares a non-null default, so it is never nullish; read it plainly`);
        for (const match of body.matchAll(new RegExp(String.raw`\bthis\.${name}\s*\?\?(?!=)`, "g")))
          report(match.index, `this.${prop.name} ??: the prop declares a non-null default, so the fallback never applies; read it plainly`);
      }
      const methods = [...controller.memberNames.filter((m) => m.kind === "method").map((m) => m.name), ...BUILTIN_METHODS];
      for (const method of methods)
        for (const match of body.matchAll(new RegExp(String.raw`\bthis\.${escape(method)}\?\.\(`, "g")))
          report(match.index, `this.${method}?.(: a method of this controller is always present; call it plainly`);
    }
  },
});
