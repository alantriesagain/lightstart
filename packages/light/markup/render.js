/**
 * @file A template as the markup a server sends: rendered on a markup host
 * into a fresh root, serialized with the engine's marker comments so a page
 * adopts it, and the root disposed. The host in use before the call is put
 * back, so a browser that renders a string for a moment keeps its own host.
 */
import { currentHost, disposeTree, render, setHost } from "../html/core.ts";
import { MarkupHost } from "./host.js";
import { MRoot } from "./node.js";
import { markupOf, serialize } from "./serialize.js";

let host = null;

/**
 * Render `template` to a string.
 * @param {unknown} template
 * @param {{ markers?: boolean }} [options] `markers: false` answers plain markup a page will not adopt
 * @returns {string}
 */
export const renderToString = (template, options) => {
  const markers = options?.markers ?? true;
  const previous = currentHost();
  if (host === null) host = new MarkupHost();
  setHost(host);
  const root = new MRoot();
  try {
    render(template, root);
    return markers ? serialize(root) : markupOf(root);
  } finally {
    disposeTree(root);
    setHost(previous);
  }
};
