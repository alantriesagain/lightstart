/**
 * @lightstart/light/markup: the renderer on an in-memory tree, for
 * rendering without a browser: server prerendering, whose output a page
 * adopts, and tests of the engine that any host must pass. Install the host
 * with `configure({ host: new MarkupHost(), effect })` from the html core.
 * Import it before a program's views: it names the markup element and
 * registry to light's views off the browser (`install.js`).
 */
import "./install.js";
export { MarkupHost, MarkupPrepared, dispatch } from "./host.js";
export { MComment, MElement, MFragment, MListener, MNode, MRoot, MText, descendants, disconnectTree, insertBefore, isConnected, nextSiblingOf, removeNode } from "./node.js";
export { markupOf, serialize, textContent } from "./serialize.js";
export { renderToString, renderToStringAsync } from "./render.js";
