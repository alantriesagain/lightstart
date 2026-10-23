import { defineRule } from "../define.js";

const DOM_METHODS = new Set([
  "addEventListener", "after", "animate", "append", "appendChild", "ariaNotify", "attachInternals",
  "attachShadow", "before", "blur", "checkVisibility", "click", "cloneNode", "closest",
  "compareDocumentPosition", "computedStyleMap", "contains", "dispatchEvent", "focus", "getAnimations",
  "getAttribute", "getAttributeNS", "getAttributeNames", "getAttributeNode", "getAttributeNodeNS",
  "getBoundingClientRect", "getClientRects", "getElementsByClassName", "getElementsByTagName",
  "getElementsByTagNameNS", "getHTML", "getRootNode", "hasAttribute", "hasAttributeNS", "hasAttributes",
  "hasChildNodes", "hasPointerCapture", "hidePopover", "insertAdjacentElement", "insertAdjacentHTML",
  "insertAdjacentText", "insertBefore", "isDefaultNamespace", "isEqualNode", "isSameNode",
  "lookupNamespaceURI", "lookupPrefix", "matches", "moveBefore", "normalize", "prepend", "querySelector",
  "querySelectorAll", "releasePointerCapture", "remove", "removeAttribute", "removeAttributeNS",
  "removeAttributeNode", "removeChild", "removeEventListener", "replaceChild", "replaceChildren",
  "replaceWith", "requestFullscreen", "requestPointerLock", "scroll", "scrollBy", "scrollIntoView",
  "scrollIntoViewIfNeeded", "scrollTo", "setAttribute", "setAttributeNS", "setAttributeNode",
  "setAttributeNodeNS", "setHTML", "setHTMLUnsafe", "setPointerCapture", "showPopover",
  "startViewTransition", "toggleAttribute", "togglePopover", "when",
]);

export default defineRule({
  severity: "error",
  description: "a component may not name a property or a method after a method the element already has",
  why: "`View.define` installs properties as accessors and methods as values on the element's prototype, so either one silently replaces the DOM's. `lc-link` declared `click` and every link in every app lost `HTMLElement.click()`: callers got the component's own value, and during the window before it was assigned, nothing at all",
  check(ctx) {
    for (const view of ctx.views()) {
      if (!view.isComponent) continue;
      /** @type {(name: string, kind: "property" | "method") => void} */
      const report = (name, kind) => ctx.report({
        file: view.file,
        offset: view.keyOffsets[kind === "property" ? "props" : name],
        message: `${kind} "${name}" shadows the DOM's ${name}() on <${view.tag}>; rename it`,
      });
      for (const { name } of view.propertyNames)
        if (DOM_METHODS.has(name)) report(name, "property");
      for (const name of view.topLevelKeys)
        if (DOM_METHODS.has(name)) report(name, "method");
    }
  },
});
