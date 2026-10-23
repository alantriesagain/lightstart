import { defineRule } from "../define.js";
import { elements } from "../parse/markup.js";

const NATIVE_EVENTS = new Set([
  "click", "dblclick", "input", "change", "submit", "reset", "focus", "blur",
  "focusin", "focusout", "keydown", "keyup", "keypress", "scroll", "wheel",
  "mousedown", "mouseup", "mousemove", "mouseenter", "mouseleave", "mouseover", "mouseout",
  "pointerdown", "pointerup", "pointermove", "pointerenter", "pointerleave", "pointercancel",
  "touchstart", "touchend", "touchmove", "touchcancel",
  "dragstart", "dragend", "dragover", "dragenter", "dragleave", "drop", "drag",
  "load", "error", "abort", "loadeddata", "loadedmetadata", "canplay", "ended",
  "play", "pause", "timeupdate", "volumechange", "seeked", "waiting",
  "animationend", "animationstart", "animationiteration", "transitionend",
  "contextmenu", "select", "toggle", "invalid", "paste", "copy", "cut",
  "compositionstart", "compositionend", "compositionupdate",
]);

const BUBBLY = /new CustomEvent\(\s*["']([\w-]+)["']\s*,\s*\{[^}]*bubbles:\s*true/g;

export default defineRule({
  severity: "warn",
  description: "An @event binding on a childless component tag names an event the target, or a fragment it lists under mixins, actually produces",
  why: "a listener for an event nothing dispatches is invisible dead code: the handler never runs and the feature silently does nothing (editor-code @change and admin-model-list @row-click both shipped this way); native events, the events a host's plugins make every component emit, names dispatched with bubbles:true in checkable files, and elements with children are exempt. Cross-package bubbling the check can't see would need the dispatcher in another package's internals, which no current binding relies on",
  check(ctx) {
    const index = ctx.componentIndex();
    /** @type {Set<string>} */
    const bubbly = new Set();
    for (const file of ctx.files()) {
      if (!/\.(js|html)$/.test(file) || file.endsWith(".test.js")) continue;
      for (const m of (ctx.code(file) || "").matchAll(BUBBLY)) bubbly.add(m[1]);
    }
    for (const file of ctx.files()) {
      if (!/\.(js|html)$/.test(file) || file.endsWith(".test.js")) continue;
      for (const template of ctx.markup(file))
        for (const el of elements(template)) {
          if (!el.tag.includes("-") || !index.has(el.tag)) continue;
          if (el.children.some((child) => child.kind !== "text" || child.text.trim())) continue;
          for (const attr of el.attrs) {
            if (attr.kind !== "event") continue;
            const event = attr.name;
            if (NATIVE_EVENTS.has(event) || ctx.pluginEvents.has(event) || bubbly.has(event)) continue;
            const target = index.sourceOf(el.tag);
            if (!target || target.includes(event) || index.mixinSourcesOf(el.tag).some((mixin) => mixin.includes(event))) continue;
            ctx.report({
              file,
              offset: attr.offset,
              message: `@${event} on <${el.tag}>: the component neither declares nor dispatches "${event}"; this handler can never run`,
            });
          }
        }
    }
  },
});
