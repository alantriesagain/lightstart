/**
 * @lightstart/light/html/values: the values a template can hold besides
 * text, nodes and lists. `html` and `svg` (in `tags.js`) answer a `TemplateResult`; `key`,
 * `element` and `unsafeHTML` wrap a value in a `Keyed`, `ElementSpec` or
 * `Unsafe`. They are classes so the parts engine recognises them with
 * `instanceof`, which a native build dispatches on.
 */

import { nothing } from "./constants.js";

                                                                

/**
 * The result of an html`` or svg`` template: its strings, kind and values.
 * `strings` is the call site's `TemplateStringsArray`, held as `unknown`: the
 * engine caches prepared templates by its identity, and a native build keeps
 * that identity only while the value stays untyped.
 */
export class TemplateResult {
  strings         ;
  kind              ;
  values           ;

  constructor(strings         , kind              , values           ) {
    this.strings = strings;
    this.kind = kind;
    this.values = values;
  }
}

/** A child value keyed for identity-based reconciliation, from `key(k, value)`. */
export class Keyed {
  k         ;
  v         ;

  constructor(k         , v         ) {
    this.k = k;
    this.v = v;
  }
}

/** An element with a runtime tag name, from `element(tag, bindings, children)`. */
export class ElementSpec {
  tag        ;
  bindings                             ;
  children         ;

  constructor(tag        , bindings                             , children         ) {
    this.tag = tag;
    this.bindings = bindings;
    this.children = children;
  }
}

/** Raw markup to parse at commit time, from `unsafeHTML(value)`. */
export class Unsafe {
  s        ;

  constructor(s        ) {
    this.s = s;
  }
}

/**
 * Key a child value for identity-based reconciliation. A keyed array gets
 * move-based list diffing (reorders move DOM, never recreate it); a single
 * keyed value forces a fresh render when the key changes.
 */
export const key = (k         , value         )        => new Keyed(k, value);

/**
 * Render an element with a runtime tag name: the safe replacement for
 * lit's staticHTML/unsafeStatic. Binding keys mirror template syntax:
 * plain keys are attributes, `.prop` sets a property, `@click` an event,
 * `?disabled` a boolean attribute, and `ref` receives the element (and
 * later `null` on teardown).
 */
export const element = (tag        , bindings                  , children          )              => new ElementSpec(tag, bindings, children);

/**
 * Render a raw HTML string as parsed markup. The only way a string
 * reaches an HTML parser at runtime; everything else commits via
 * attributes and text nodes.
 */
export const unsafeHTML = (value         )         => new Unsafe(value == null || value === nothing ? "" : String(value));
