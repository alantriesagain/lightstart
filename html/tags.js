/**
 * @bootstrapp/light/html/tags: the `html` and `svg` template tags. They stay
 * JavaScript while the rest of the core is TypeScript: a tag takes its values
 * as a rest parameter of any value, which scriptc compiles from JavaScript
 * and has no static form for yet in TypeScript.
 */
import { HTML_KIND, SVG_KIND } from "./constants.ts";
import { TemplateResult } from "./values.ts";

/** @import { TemplateValue } from "./types.ts" */

/**
 * HTML tagged template. Returns a cheap result object; the template is
 * prepared once (cached by strings identity) and diffed on re-render.
 * @param {TemplateStringsArray} strings
 * @param {...TemplateValue} values
 * @returns {TemplateResult}
 */
export const html = (strings, ...values) => new TemplateResult(strings, HTML_KIND, values);

/**
 * SVG tagged template: same semantics as html`` but parsed in an SVG
 * namespace context. Use for fragments rendered inside an <svg> parent.
 * @param {TemplateStringsArray} strings
 * @param {...TemplateValue} values
 * @returns {TemplateResult}
 */
export const svg = (strings, ...values) => new TemplateResult(strings, SVG_KIND, values);
