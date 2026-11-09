/**
 * @lightstart/router/listen: install a document-level click listener that
 * hands internal links to the router. Answers the teardown. The document is
 * read through a structural shape because the package compiles without the
 * DOM type library.
 */

import type { ClickEvent } from "./click.ts";
import type { RouterCore } from "./core.ts";

interface ClickTarget {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

/** Listen for clicks on `doc` and soft-navigate internal links through `router`. */
export const listen = (doc: ClickTarget, router: RouterCore): (() => void) => {
  const handler = (event: unknown): void => {
    router.click(event as ClickEvent);
  };
  doc.addEventListener("click", handler);
  return (): void => {
    doc.removeEventListener("click", handler);
  };
};
