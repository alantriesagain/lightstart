/**
 * @file A template as the markup a server sends: rendered on a markup host
 * into a fresh root, serialized with the engine's marker comments so a page
 * adopts it, and the root disposed. The host in use before the call is put
 * back, so a browser that renders a string for a moment keeps its own host.
 */
import { currentHost, disposeTree, render, setHost } from "../html/core.ts";
import { config, configureView } from "../view/core.ts";
import { MarkupHost } from "./host.js";
import { MRoot, disconnectTree, removeNode } from "./node.js";
import { markupOf, serialize } from "./serialize.js";

/** @type {MarkupHost | null} */
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
    disconnectTree(root);
    for (const child of [...root.childNodes]) removeNode(child);
    disposeTree(root);
    setHost(previous);
  }
};

/**
 * Render `template` to a string once every view it contains has rendered.
 * @param {unknown} template
 * @param {{ markers?: boolean, onError?: (error: unknown) => void }} [options]
 * @returns {Promise<string>}
 */
export const renderToStringAsync = async (template, options) => {
  const markers = options?.markers ?? true;
  const previous = currentHost();
  const markupHost = new MarkupHost();
  if (options?.onError !== undefined) markupHost.onError = options.onError;
  const previousWrap = config.wrap;
  configureView({
    wrap: (work, label) => {
      previousWrap(work, label);
      work.catch((error) => {
        markupHost.reportError(error);
      });
    },
  });
  setHost(markupHost);
  const root = new MRoot();
  try {
    render(template, root);
    await markupHost.settle();
    return markers ? serialize(root) : markupOf(root);
  } finally {
    configureView({ wrap: previousWrap });
    disconnectTree(root);
    for (const child of [...root.childNodes]) removeNode(child);
    disposeTree(root);
    setHost(previous);
  }
};
