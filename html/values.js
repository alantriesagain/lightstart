/**
 * @bootstrapp/light/html/values.js: the values a template can hold besides
 * text, nodes and lists. `html` and `svg` answer a `TemplateResult`; `key`,
 * `element` and `unsafeHTML` wrap a value in a `Keyed`, `ElementSpec` or
 * `Unsafe`. They are classes so the parts engine recognises them with
 * `instanceof`, which a native build dispatches on; the `TPL` and `WRAP`
 * symbol fields stay for anything that still duck-types a result.
 */

import { HTML_KIND, SVG_KIND, TPL, WRAP, nothing } from "./constants.js";

/** @import { ElementBindings, TemplateKind, TemplateValue } from "./types.ts" */

/** The result of an html`` or svg`` template: its strings identity, kind and values. */
export class TemplateResult {
  /**
   * @param {TemplateStringsArray} strings
   * @param {TemplateKind} kind
   * @param {unknown[]} values
   */
  constructor(strings, kind, values) {
    this.strings = strings;
    this.kind = kind;
    this.values = values;
    this[TPL] = strings;
  }
}

/** A child value keyed for identity-based reconciliation, from `key(k, value)`. */
export class Keyed {
  /**
   * @param {unknown} k
   * @param {unknown} v
   */
  constructor(k, v) {
    this.k = k;
    this.v = v;
    this[WRAP] = "key";
  }
}

/** An element with a runtime tag name, from `element(tag, bindings, children)`. */
export class ElementSpec {
  /**
   * @param {string} tag
   * @param {ElementBindings | undefined} bindings
   * @param {unknown} children
   */
  constructor(tag, bindings, children) {
    this.tag = tag;
    this.bindings = bindings;
    this.children = children;
    this[WRAP] = "el";
  }
}

/** Raw markup to parse at commit time, from `unsafeHTML(value)`. */
export class Unsafe {
  /** @param {string} s */
  constructor(s) {
    this.s = s;
    this[WRAP] = "unsafe";
  }
}

/**
 * HTML tagged template. Returns a cheap result object; the template is
 * prepared once (cached by strings identity) and diffed on re-render.
 *
 * @param {TemplateStringsArray} strings
 * @param {...TemplateValue} values
 * @returns {TemplateResult}
 */
export const html = (strings, ...values) => new TemplateResult(strings, HTML_KIND, values);

/**
 * SVG tagged template: same semantics as html`` but parsed in an SVG
 * namespace context. Use for fragments rendered inside an <svg> parent.
 *
 * @param {TemplateStringsArray} strings
 * @param {...TemplateValue} values
 * @returns {TemplateResult}
 */
export const svg = (strings, ...values) => new TemplateResult(strings, SVG_KIND, values);

/**
 * Key a child value for identity-based reconciliation. A keyed array gets
 * move-based list diffing (reorders move DOM, never recreate it); a single
 * keyed value forces a fresh render when the key changes.
 *
 * @param {unknown} k
 * @param {unknown} value
 * @returns {Keyed}
 */
export const key = (k, value) => new Keyed(k, value);

/**
 * Render an element with a runtime tag name: the safe replacement for
 * lit's staticHTML/unsafeStatic. Binding keys mirror template syntax:
 * plain keys are attributes, `.prop` sets a property, `@click` an event,
 * `?disabled` a boolean attribute, and `ref` receives the element (and
 * later `null` on teardown).
 *
 * @param {string} tag
 * @param {ElementBindings} [bindings]
 * @param {unknown} [children]
 * @returns {ElementSpec}
 */
export const element = (tag, bindings, children) => new ElementSpec(tag, bindings, children);

/**
 * Render a raw HTML string as parsed markup. The only way a string
 * reaches an HTML parser at runtime; everything else commits via
 * attributes and text nodes.
 *
 * @param {unknown} value
 * @returns {Unsafe}
 */
export const unsafeHTML = (value) => new Unsafe(value == null || value === nothing ? "" : String(value));
