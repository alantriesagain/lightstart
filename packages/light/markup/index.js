/**
 * @bootstrapp/light/markup: the renderer on an in-memory tree, for
 * rendering without a browser: server prerendering, whose output a page
 * adopts, and tests of the engine that any host must pass. Install the host
 * with `configure({ host: new MarkupHost(), effect })` from the html core.
 */
export { MarkupHost, MarkupPrepared, dispatch } from "./host.js";
export { MComment, MElement, MFragment, MListener, MNode, MRoot, MText, descendants, insertBefore, isConnected, nextSiblingOf, removeNode } from "./node.js";
export { markupOf, serialize, textContent } from "./serialize.js";
