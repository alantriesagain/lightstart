/**
 * @bootstrapp/light/html/core.js: the renderer-agnostic html API. Everything
 * `@bootstrapp/light/html` exports except the browser pieces (the DOM host,
 * adoption and slot projection), so a native build can import the engine
 * without a document. A page uses `./index.js`, which installs the DOM host.
 */

export { ElementSpec, Keyed, TemplateResult, Unsafe, element, html, key, svg, unsafeHTML } from "./values.js";
export { nothing } from "./constants.js";
export { disposeTree, hasRootPart, render } from "./parts.js";
export { configure } from "./reactive.js";
export { Clone, Host, ListenerOptions, Prepared, currentHost, setHost } from "./host.js";
