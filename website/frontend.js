/**
 * The lc catalogue has no boot work of its own: `@bootstrapp/theme` applies
 * the palette, `@bootstrapp/light` loads components by tag, `routes.js` names
 * the pages and `controllers/catalogue.js` keeps what they share.
 *
 * The renderer is shared on `globalThis` because the component demos are loaded
 * as separate modules (by the showcase, and mirrored by the static export); a
 * template built by a second copy of `html` is not one the app's renderer
 * recognizes, and prints as `[object Object]`.
 */
import { html, svg, render, key, element, nothing, unsafeHTML } from "@bootstrapp/light/html";

const renderer = { html, svg, render, key, element, nothing, unsafeHTML };
globalThis.__LIGHT_RENDERER__ = renderer;
if (globalThis.$APP) Object.assign(globalThis.$APP, renderer);
