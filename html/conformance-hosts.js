/**
 * @bootstrapp/light/html/conformance-hosts: the hosts the engine's
 * conformance suite runs against, each behind the same small adapter (a
 * container, the markup and text rendered into it, the elements in it, a
 * way to fire an event), so one suite reads the same on every host.
 */
import { MRoot, MarkupHost, descendants, dispatch, markupOf, textContent } from "../markup/index.js";

/**
 * @typedef {{
 *   name: string,
 *   host: () => import("./host.js").Host & { onError: ((error: unknown) => void) | null },
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
  fire: (el, name, event) => dispatch(/** @type {import("../markup/index.js").MElement} */ (el), name, event),
  remove: (node) => {
    const n = /** @type {import("../markup/index.js").MNode} */ (node);
    const parent = n.parent;
    if (parent) parent.children.splice(parent.children.indexOf(n), 1);
    n.parent = null;
  },
  flush: () => new Promise((resolve) => setTimeout(resolve, 0)),
};

/** @type {HostAdapter[]} */
export const hosts = [markup];
