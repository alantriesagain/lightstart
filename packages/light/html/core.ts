/**
 * @bootstrapp/light/html/core: the renderer-agnostic html API. Everything
 * `@bootstrapp/light/html` exports except the browser pieces (the DOM host,
 * adoption and slot projection), so a native build can import the engine
 * without a document. A page uses `./index.js`, which installs the DOM host.
 */

export { ElementSpec, Keyed, TemplateResult, Unsafe, element, key, unsafeHTML } from "./values.ts";
export { html, svg } from "./tags.js";
export { nothing } from "./constants.ts";
export { disposeTree, hasRootPart, render } from "./parts.ts";
export { configure } from "./reactive.ts";
export { Clone, Host, ListenerOptions, Prepared, currentHost, setHost } from "./host.ts";
