/**
 * The browser runtime: one MutationObserver watching the document, a
 * per-class memo, and one `<style data-tw-runtime>` tag rewritten at most
 * once per animation frame. A class is parsed once ever; childList mutations
 * walk only the added subtree; the document is never rescanned. The style
 * tag (rather than an adopted sheet) is deliberate: the build's DOM-scrape
 * safety net and the prerender pipeline read `style[data-tw-runtime]`
 * textContent.
 */

import { PREFLIGHT } from "./classes/preflight.js";
/** @import { CompiledRule } from "./classes/types.ts" */
/** @import { RuntimeOptions, ScanRoot } from "./runtime-types.ts" */

/**
 * @param {import("./classes/types.ts").Engine} engine
 * @param {RuntimeOptions} [options]
 */
export const createRuntime = (engine, options = {}) => {
  const doc = options.doc ?? globalThis.document;
  const raf = options.raf ?? ((cb) => requestAnimationFrame(cb));
  const preflight = options.preflight ?? true;

  const seen = new Set();
  /** @type {CompiledRule[]} */
  const rules = [];
  /** @type {HTMLStyleElement | null} */
  let styleEl = null;
  let scheduled = false;
  /** @type {MutationObserver | null} */
  let observer = null;

  const ensureStyle = () => {
    if (styleEl) return styleEl;
    styleEl = doc.querySelector("style[data-tw-runtime]");
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.setAttribute("data-tw-runtime", "");
      doc.head.appendChild(styleEl);
    }
    return styleEl;
  };

  const flush = () => {
    scheduled = false;
    const css = engine.stringify(rules);
    const text = preflight ? `${PREFLIGHT}\n${css}` : css;
    ensureStyle().textContent = text;
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    raf(flush);
  };

  /** @param {string} cls */
  const addClass = (cls) => {
    if (seen.has(cls)) return;
    seen.add(cls);
    const rule = engine.compile(cls);
    if (rule) {
      rules.push(rule);
      schedule();
    } else if (/[:[/]/.test(cls) && /[a-z]/i.test(cls) && !/^[a-z]+\/[a-z.+-]+$/.test(cls))
      console.warn(`[tw] unknown class: ${cls}`);
  };

  /** @param {Iterable<string>} list */
  const addClasses = (list) => {
    for (const cls of list) addClass(cls);
  };

  /** @param {Node & { classList?: DOMTokenList }} el */
  const scanElement = (el) => {
    if (el.classList) for (const cls of el.classList) addClass(cls);
  };

  /** @param {ScanRoot} root */
  const scanTree = (root) => {
    scanElement(root);
    if (root.querySelectorAll) for (const el of root.querySelectorAll("[class]")) scanElement(el);
  };

  /** @param {MutationRecord[]} mutations */
  const onMutations = (mutations) => {
    for (const mutation of mutations)
      if (mutation.type === "attributes") scanElement(mutation.target);
      else for (const node of mutation.addedNodes) if (node.nodeType === 1) scanTree(node);

  };

  const OBSERVE_OPTIONS = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"],
  };

  const observedRoots = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  /** @param {ScanRoot | null | undefined} root */
  const observeRoot = (root) => {
    if (!root || observedRoots?.has(root)) return;
    observedRoots?.add(root);
    scanTree(root);
    observer?.observe(root, OBSERVE_OPTIONS);
  };

  const start = () => {
    if (typeof MutationObserver !== "undefined")
      observer = new MutationObserver(onMutations);
    observeRoot(doc.documentElement);
    schedule();
  };

  const stop = () => {
    observer?.disconnect();
    observer = null;
  };

  return { start, stop, addClasses, flush, seen, unknown: () => [...seen].filter((cls) => !engine.compile(cls)) };
};
