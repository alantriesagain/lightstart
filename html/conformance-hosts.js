/**
 * @bootstrapp/light/html/conformance-hosts: the hosts the engine's
 * conformance suite runs against, each behind the same small adapter (a
 * container, the markup and text rendered into it, the elements in it, a
 * way to fire an event), so one suite reads the same on every host.
 */
import { MRoot, MarkupHost, descendants, dispatch, markupOf, textContent } from "../markup/index.js";
import { TAnchor, TElement, TNode, TRoot, TRun, TermHost, UIEvent, childNodes, frames, textOf } from "../tdom/index.ts";

/**
 * @typedef {{
 *   name: string,
 *   host: () => import("./host.ts").Host & { onError: ((error: unknown) => void) | null },
 *   container: () => unknown,
 *   markup: (container: unknown) => string,
 *   text: (container: unknown) => string,
 *   elements: (container: unknown) => unknown[],
 *   tagOf: (el: unknown) => string,
 *   attribute: (el: unknown, name: string) => string | null,
 *   property: (el: unknown, name: string) => unknown,
 *   listenerCount: (el: unknown, name: string) => number,
 *   fire: (el: unknown, name: string, event: unknown) => number,
 *   remove: (node: unknown) => void,
 *   flush: () => Promise<void>,
 *   iterables: boolean,
 *   handlerThis: boolean,
 *   rawText: boolean,
 * }} HostAdapter
 */

/** @type {HostAdapter} */
export const markup = {
  name: "markup",
  host: () => new MarkupHost(),
  container: () => new MRoot(),
  markup: (container) => markupOf(/** @type {MRoot} */ (container)),
  text: (container) => textContent(/** @type {MRoot} */ (container)),
  elements: (container) => descendants(/** @type {MRoot} */ (container)),
  tagOf: (el) => /** @type {import("../markup/index.js").MElement} */ (el).tag,
  attribute: (el, name) => /** @type {import("../markup/index.js").MElement} */ (el).attrs.get(name) ?? null,
  property: (el, name) => /** @type {import("../markup/index.js").MElement} */ (el).props.get(name),
  listenerCount: (el, name) => /** @type {import("../markup/index.js").MElement} */ (el).listeners.get(name)?.length ?? 0,
  fire: (el, name, event) => dispatch(/** @type {import("../markup/index.js").MElement} */ (el), name, Object.assign(/** @type {object} */ (event), { type: name })),
  remove: (node) => {
    const n = /** @type {import("../markup/index.js").MNode} */ (node);
    const parent = n.parent;
    if (parent) parent.children.splice(parent.children.indexOf(n), 1);
    n.parent = null;
  },
  flush: () => new Promise((resolve) => setTimeout(resolve, 0)),
  iterables: true,
  handlerThis: true,
  rawText: true,
};

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** @param {TNode} node */
const termMarkup = (node) => {
  if (node instanceof TRun) return node.text;
  if (node instanceof TAnchor || !(node instanceof TElement)) return "";
  let out = "";
  for (const child of childNodes(node)) out += termMarkup(child);
  if (node instanceof TRoot || node.kind === "fragment") return out;
  let attrs = "";
  for (const [name, value] of node.attrs) attrs += ` ${name}="${value}"`;
  return VOID_TAGS.has(node.tag) ? `<${node.tag}${attrs}>` : `<${node.tag}${attrs}>${out}</${node.tag}>`;
};

/** @param {TElement} node */
const termElements = (node) => {
  /** @type {TElement[]} */
  const out = [];
  for (const child of childNodes(node))
    if (child instanceof TElement) {
      out.push(child);
      out.push(...termElements(child));
    }
  return out;
};

/** @type {HostAdapter} */
export const tdom = {
  name: "tdom",
  host: () => new TermHost(),
  container: () => new TRoot(),
  markup: (container) => termMarkup(/** @type {TRoot} */ (container)),
  text: (container) => textOf(/** @type {TRoot} */ (container)),
  elements: (container) => termElements(/** @type {TRoot} */ (container)),
  tagOf: (el) => /** @type {TElement} */ (el).tag,
  attribute: (el, name) => /** @type {TElement} */ (el).attrs.get(name) ?? null,
  property: (el, name) => /** @type {TElement} */ (el).props.get(name),
  listenerCount: (el, name) => /** @type {TElement} */ (el).handlers.filter((entry) => entry.name === name).length,
  fire: (el, name, event) => {
    const element = /** @type {TElement} */ (el);
    const before = element.handlers.filter((entry) => entry.name === name).length;
    element.handle(Object.assign(new UIEvent(name), /** @type {object} */ (event)));
    return before;
  },
  remove: (node) => {
    const n = /** @type {TNode} */ (node);
    if (n.parent) n.parent.remove(n);
  },
  flush: () => frames.nextFrame(),
  iterables: false,
  handlerThis: false,
  rawText: false,
};

/** @type {HostAdapter[]} */
export const hosts = [markup, tdom];
