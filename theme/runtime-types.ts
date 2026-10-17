/**
 * @bootstrapp/light/theme/runtime: the shapes of the browser runtime, the
 * ones that name a document. The engine's own shapes are `classes/types.ts`.
 */

/** A node the runtime scans for classes: the document, or an element with a class list and descendants. */
export type ScanRoot = Node & {
  classList?: DOMTokenList;
  querySelectorAll?: (selectors: string) => Iterable<Element>;
};

/** How the runtime reaches its document and its frame; a test hands it fakes. */
export interface RuntimeOptions {
  doc?: Document;
  raf?: (cb: () => void) => void;
  preflight?: boolean;
}

export * from "./runtime.js";
