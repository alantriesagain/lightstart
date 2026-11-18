/**
 * @file Off the browser, name the markup tree's element class and registry to light's views
 * (`dom/view.js` reads them when there is no `HTMLElement`), so `View.define` registers a view
 * and the markup host builds it. Imported first by `@lightstart/light/markup`, which a server
 * program imports before its views.
 */
import { MElement } from "./node.js";
import * as registry from "./registry.js";

const key = Symbol.for("lightstart.markup");
const scope = /** @type {Record<symbol, unknown>} */ (/** @type {unknown} */ (globalThis));
if (scope[key] === undefined) scope[key] = { element: MElement, registry };
