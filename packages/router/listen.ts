/**
 * @lightstart/router/listen: install the page's listeners a router needs: a
 * document-level click listener that hands internal links to the router, and
 * a `popstate` listener on the document's window that hands the browser's back
 * and forward to it. Answers the teardown of both. The document is read through
 * a structural shape because the package compiles without the DOM type library.
 */

import type { ClickEvent } from "./click.ts";
import type { RouterCore } from "./core.ts";

interface EventTarget {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

interface ClickTarget extends EventTarget {
  /** The document's window, where `popstate` fires; absent on a bare target. */
  defaultView?: EventTarget | null;
}

/**
 * Listen for clicks on `doc` and soft-navigate internal links through
 * `router`, and follow the browser's back and forward (`popstate` on the
 * document's window) through `router.handleHistoryNavigation()`.
 */
export const listen = (doc: ClickTarget, router: RouterCore): (() => void) => {
  const handler = (event: unknown): void => {
    router.click(event as ClickEvent);
  };
  const history = (): void => {
    router.handleHistoryNavigation();
  };
  const view = doc.defaultView ?? null;
  doc.addEventListener("click", handler);
  if (view !== null) view.addEventListener("popstate", history);
  return (): void => {
    doc.removeEventListener("click", handler);
    if (view !== null) view.removeEventListener("popstate", history);
  };
};
