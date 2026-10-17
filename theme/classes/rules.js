/**
 * The data-driven rule table. Two structures: STATIC exact-name utilities and
 * an ordered DYNAMIC prefix list. Table order is conflict-resolution order:
 * shorthand before longhand (`p` before `px` before `pt`): and the emitted
 * rule's sort index reproduces the later-wins semantics utility CSS relies on.
 */

import {
  looksLikeLength,
  resolveColor,
  resolveInteger,
  resolveLookup,
  resolvePercentNumber,
  resolveSpacing,
} from "./resolve.js";
import { parseArbitrary } from "./parse.js";
/** @import { ColorScale, DynamicRuleFn, MatchedRule, ParsedClass, RuleInput, RuleResult, SpacingOptions } from "./types.ts" */

/** @param {string} value */
const negate = (value) =>
  /^-?\d/.test(value) ? (value.startsWith("-") ? value.slice(1) : `-${value}`) : `calc(${value} * -1)`;

const STATIC_SPECS = {
  block: "display:block",
  "inline-block": "display:inline-block",
  inline: "display:inline",
  flex: "display:flex",
  "inline-flex": "display:inline-flex",
  grid: "display:grid",
  "inline-grid": "display:inline-grid",
  table: "display:table",
  "inline-table": "display:inline-table",
  "table-caption": "display:table-caption",
  "table-cell": "display:table-cell",
  "table-column": "display:table-column",
  "table-column-group": "display:table-column-group",
  "table-footer-group": "display:table-footer-group",
  "table-header-group": "display:table-header-group",
  "table-row-group": "display:table-row-group",
  "table-row": "display:table-row",
  "flow-root": "display:flow-root",
  contents: "display:contents",
  "list-item": "display:list-item",
  hidden: "display:none",
  visible: "visibility:visible",
  invisible: "visibility:hidden",
  collapse: "visibility:collapse",
  static: "position:static",
  fixed: "position:fixed",
  absolute: "position:absolute",
  relative: "position:relative",
  sticky: "position:sticky",
  isolate: "isolation:isolate",
  "isolation-auto": "isolation:auto",
  "float-left": "float:left",
  "float-right": "float:right",
  "float-none": "float:none",
  "float-start": "float:inline-start",
  "float-end": "float:inline-end",
  "clear-left": "clear:left",
  "clear-right": "clear:right",
  "clear-both": "clear:both",
  "clear-none": "clear:none",
  "box-border": "box-sizing:border-box",
  "box-content": "box-sizing:content-box",
  "sr-only":
    "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0, 0, 0, 0);white-space:nowrap;border-width:0",
  "not-sr-only":
    "position:static;width:auto;height:auto;padding:0;margin:0;overflow:visible;clip:auto;white-space:normal",

  "flex-row": "flex-direction:row",
  "flex-row-reverse": "flex-direction:row-reverse",
  "flex-col": "flex-direction:column",
  "flex-col-reverse": "flex-direction:column-reverse",
  "flex-wrap": "flex-wrap:wrap",
  "flex-wrap-reverse": "flex-wrap:wrap-reverse",
  "flex-nowrap": "flex-wrap:nowrap",
  "flex-1": "flex:1 1 0%",
  "flex-auto": "flex:1 1 auto",
  "flex-initial": "flex:0 1 auto",
  "flex-none": "flex:none",
  grow: "flex-grow:1",
  "grow-0": "flex-grow:0",
  shrink: "flex-shrink:1",
  "shrink-0": "flex-shrink:0",
  "flex-grow": "flex-grow:1",
  "flex-grow-0": "flex-grow:0",
  "flex-shrink": "flex-shrink:1",
  "flex-shrink-0": "flex-shrink:0",

  "grid-flow-row": "grid-auto-flow:row",
  "grid-flow-col": "grid-auto-flow:column",
  "grid-flow-dense": "grid-auto-flow:dense",
  "grid-flow-row-dense": "grid-auto-flow:row dense",
  "grid-flow-col-dense": "grid-auto-flow:column dense",
  "auto-cols-auto": "grid-auto-columns:auto",
  "auto-cols-min": "grid-auto-columns:min-content",
  "auto-cols-max": "grid-auto-columns:max-content",
  "auto-cols-fr": "grid-auto-columns:minmax(0, 1fr)",
  "auto-rows-auto": "grid-auto-rows:auto",
  "auto-rows-min": "grid-auto-rows:min-content",
  "auto-rows-max": "grid-auto-rows:max-content",
  "auto-rows-fr": "grid-auto-rows:minmax(0, 1fr)",

  "justify-normal": "justify-content:normal",
  "justify-start": "justify-content:flex-start",
  "justify-end": "justify-content:flex-end",
  "justify-center": "justify-content:center",
  "justify-between": "justify-content:space-between",
  "justify-around": "justify-content:space-around",
  "justify-evenly": "justify-content:space-evenly",
  "justify-stretch": "justify-content:stretch",
  "justify-items-start": "justify-items:start",
  "justify-items-end": "justify-items:end",
  "justify-items-center": "justify-items:center",
  "justify-items-stretch": "justify-items:stretch",
  "justify-self-auto": "justify-self:auto",
  "justify-self-start": "justify-self:start",
  "justify-self-end": "justify-self:end",
  "justify-self-center": "justify-self:center",
  "justify-self-stretch": "justify-self:stretch",
  "content-normal": "align-content:normal",
  "content-center": "align-content:center",
  "content-start": "align-content:flex-start",
  "content-end": "align-content:flex-end",
  "content-between": "align-content:space-between",
  "content-around": "align-content:space-around",
  "content-evenly": "align-content:space-evenly",
  "content-baseline": "align-content:baseline",
  "content-stretch": "align-content:stretch",
  "items-start": "align-items:flex-start",
  "items-end": "align-items:flex-end",
  "items-center": "align-items:center",
  "items-baseline": "align-items:baseline",
  "items-stretch": "align-items:stretch",
  "self-auto": "align-self:auto",
  "self-start": "align-self:flex-start",
  "self-end": "align-self:flex-end",
  "self-center": "align-self:center",
  "self-stretch": "align-self:stretch",
  "self-baseline": "align-self:baseline",
  "place-content-center": "place-content:center",
  "place-content-start": "place-content:start",
  "place-content-end": "place-content:end",
  "place-content-between": "place-content:space-between",
  "place-content-around": "place-content:space-around",
  "place-content-evenly": "place-content:space-evenly",
  "place-content-baseline": "place-content:baseline",
  "place-content-stretch": "place-content:stretch",
  "place-items-start": "place-items:start",
  "place-items-end": "place-items:end",
  "place-items-center": "place-items:center",
  "place-items-baseline": "place-items:baseline",
  "place-items-stretch": "place-items:stretch",
  "place-self-auto": "place-self:auto",
  "place-self-start": "place-self:start",
  "place-self-end": "place-self:end",
  "place-self-center": "place-self:center",
  "place-self-stretch": "place-self:stretch",

  "overflow-auto": "overflow:auto",
  "overflow-hidden": "overflow:hidden",
  "overflow-clip": "overflow:clip",
  "overflow-visible": "overflow:visible",
  "overflow-scroll": "overflow:scroll",
  "overflow-x-auto": "overflow-x:auto",
  "overflow-y-auto": "overflow-y:auto",
  "overflow-x-hidden": "overflow-x:hidden",
  "overflow-y-hidden": "overflow-y:hidden",
  "overflow-x-clip": "overflow-x:clip",
  "overflow-y-clip": "overflow-y:clip",
  "overflow-x-visible": "overflow-x:visible",
  "overflow-y-visible": "overflow-y:visible",
  "overflow-x-scroll": "overflow-x:scroll",
  "overflow-y-scroll": "overflow-y:scroll",
  "overscroll-auto": "overscroll-behavior:auto",
  "overscroll-contain": "overscroll-behavior:contain",
  "overscroll-none": "overscroll-behavior:none",
  "overscroll-x-auto": "overscroll-behavior-x:auto",
  "overscroll-x-contain": "overscroll-behavior-x:contain",
  "overscroll-x-none": "overscroll-behavior-x:none",
  "overscroll-y-auto": "overscroll-behavior-y:auto",
  "overscroll-y-contain": "overscroll-behavior-y:contain",
  "overscroll-y-none": "overscroll-behavior-y:none",
  "scroll-auto": "scroll-behavior:auto",
  "scroll-smooth": "scroll-behavior:smooth",

  truncate: "overflow:hidden;text-overflow:ellipsis;white-space:nowrap",
  "text-ellipsis": "text-overflow:ellipsis",
  "text-clip": "text-overflow:clip",
  "text-left": "text-align:left",
  "text-center": "text-align:center",
  "text-right": "text-align:right",
  "text-justify": "text-align:justify",
  "text-start": "text-align:start",
  "text-end": "text-align:end",
  "text-wrap": "text-wrap:wrap",
  "text-nowrap": "text-wrap:nowrap",
  "text-balance": "text-wrap:balance",
  "text-pretty": "text-wrap:pretty",
  uppercase: "text-transform:uppercase",
  lowercase: "text-transform:lowercase",
  capitalize: "text-transform:capitalize",
  "normal-case": "text-transform:none",
  italic: "font-style:italic",
  "not-italic": "font-style:normal",
  underline: "text-decoration-line:underline",
  overline: "text-decoration-line:overline",
  "line-through": "text-decoration-line:line-through",
  "no-underline": "text-decoration-line:none",
  "decoration-solid": "text-decoration-style:solid",
  "decoration-double": "text-decoration-style:double",
  "decoration-dotted": "text-decoration-style:dotted",
  "decoration-dashed": "text-decoration-style:dashed",
  "decoration-wavy": "text-decoration-style:wavy",
  "underline-offset-auto": "text-underline-offset:auto",
  antialiased: "-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale",
  "subpixel-antialiased": "-webkit-font-smoothing:auto;-moz-osx-font-smoothing:auto",
  "normal-nums": "font-variant-numeric:normal",
  ordinal: "font-variant-numeric:ordinal",
  "slashed-zero": "font-variant-numeric:slashed-zero",
  "lining-nums": "font-variant-numeric:lining-nums",
  "oldstyle-nums": "font-variant-numeric:oldstyle-nums",
  "proportional-nums": "font-variant-numeric:proportional-nums",
  "tabular-nums": "font-variant-numeric:tabular-nums",
  "diagonal-fractions": "font-variant-numeric:diagonal-fractions",
  "stacked-fractions": "font-variant-numeric:stacked-fractions",
  "whitespace-normal": "white-space:normal",
  "whitespace-nowrap": "white-space:nowrap",
  "whitespace-pre": "white-space:pre",
  "whitespace-pre-line": "white-space:pre-line",
  "whitespace-pre-wrap": "white-space:pre-wrap",
  "whitespace-break-spaces": "white-space:break-spaces",
  "break-normal": "overflow-wrap:normal;word-break:normal",
  "break-words": "overflow-wrap:break-word",
  "break-all": "word-break:break-all",
  "break-keep": "word-break:keep-all",
  "break-inside-avoid": "break-inside:avoid",
  "hyphens-none": "hyphens:none",
  "hyphens-manual": "hyphens:manual",
  "hyphens-auto": "hyphens:auto",
  "align-baseline": "vertical-align:baseline",
  "align-top": "vertical-align:top",
  "align-middle": "vertical-align:middle",
  "align-bottom": "vertical-align:bottom",
  "align-text-top": "vertical-align:text-top",
  "align-text-bottom": "vertical-align:text-bottom",
  "align-sub": "vertical-align:sub",
  "align-super": "vertical-align:super",
  "list-none": "list-style-type:none",
  "list-disc": "list-style-type:disc",
  "list-decimal": "list-style-type:decimal",
  "list-inside": "list-style-position:inside",
  "list-outside": "list-style-position:outside",
  "line-clamp-none": "overflow:visible;display:block;-webkit-box-orient:horizontal;-webkit-line-clamp:none",

  "bg-fixed": "background-attachment:fixed",
  "bg-local": "background-attachment:local",
  "bg-scroll": "background-attachment:scroll",
  "bg-auto": "background-size:auto",
  "bg-cover": "background-size:cover",
  "bg-contain": "background-size:contain",
  "bg-center": "background-position:center",
  "bg-top": "background-position:top",
  "bg-bottom": "background-position:bottom",
  "bg-left": "background-position:left",
  "bg-right": "background-position:right",
  "bg-left-top": "background-position:left top",
  "bg-left-bottom": "background-position:left bottom",
  "bg-right-top": "background-position:right top",
  "bg-right-bottom": "background-position:right bottom",
  "bg-repeat": "background-repeat:repeat",
  "bg-no-repeat": "background-repeat:no-repeat",
  "bg-repeat-x": "background-repeat:repeat-x",
  "bg-repeat-y": "background-repeat:repeat-y",
  "bg-repeat-round": "background-repeat:round",
  "bg-repeat-space": "background-repeat:space",
  "bg-clip-border": "background-clip:border-box",
  "bg-clip-padding": "background-clip:padding-box",
  "bg-clip-content": "background-clip:content-box",
  "bg-clip-text": "background-clip:text",
  "bg-origin-border": "background-origin:border-box",
  "bg-origin-padding": "background-origin:padding-box",
  "bg-origin-content": "background-origin:content-box",
  "bg-none": "background-image:none",
  "bg-gradient-to-t": "background-image:linear-gradient(to top, var(--tw-gradient-stops))",
  "bg-gradient-to-tr": "background-image:linear-gradient(to top right, var(--tw-gradient-stops))",
  "bg-gradient-to-r": "background-image:linear-gradient(to right, var(--tw-gradient-stops))",
  "bg-gradient-to-br": "background-image:linear-gradient(to bottom right, var(--tw-gradient-stops))",
  "bg-gradient-to-b": "background-image:linear-gradient(to bottom, var(--tw-gradient-stops))",
  "bg-gradient-to-bl": "background-image:linear-gradient(to bottom left, var(--tw-gradient-stops))",
  "bg-gradient-to-l": "background-image:linear-gradient(to left, var(--tw-gradient-stops))",
  "bg-gradient-to-tl": "background-image:linear-gradient(to top left, var(--tw-gradient-stops))",
  "bg-linear-to-t": "background-image:linear-gradient(to top, var(--tw-gradient-stops))",
  "bg-linear-to-tr": "background-image:linear-gradient(to top right, var(--tw-gradient-stops))",
  "bg-linear-to-r": "background-image:linear-gradient(to right, var(--tw-gradient-stops))",
  "bg-linear-to-br": "background-image:linear-gradient(to bottom right, var(--tw-gradient-stops))",
  "bg-linear-to-b": "background-image:linear-gradient(to bottom, var(--tw-gradient-stops))",
  "bg-linear-to-bl": "background-image:linear-gradient(to bottom left, var(--tw-gradient-stops))",
  "bg-linear-to-l": "background-image:linear-gradient(to left, var(--tw-gradient-stops))",
  "bg-linear-to-tl": "background-image:linear-gradient(to top left, var(--tw-gradient-stops))",

  "border-solid": "border-style:solid",
  "border-dashed": "border-style:dashed",
  "border-dotted": "border-style:dotted",
  "border-double": "border-style:double",
  "border-hidden": "border-style:hidden",
  "border-none": "border-style:none",
  "border-collapse": "border-collapse:collapse",
  "border-separate": "border-collapse:separate",
  "table-auto": "table-layout:auto",
  "table-fixed": "table-layout:fixed",
  "caption-top": "caption-side:top",
  "caption-bottom": "caption-side:bottom",

  "outline-none": "outline:2px solid transparent;outline-offset:2px",
  outline: "outline-style:solid",
  "outline-dashed": "outline-style:dashed",
  "outline-dotted": "outline-style:dotted",
  "outline-double": "outline-style:double",

  "object-contain": "object-fit:contain",
  "object-cover": "object-fit:cover",
  "object-fill": "object-fit:fill",
  "object-none": "object-fit:none",
  "object-scale-down": "object-fit:scale-down",
  "object-bottom": "object-position:bottom",
  "object-center": "object-position:center",
  "object-left": "object-position:left",
  "object-left-bottom": "object-position:left bottom",
  "object-left-top": "object-position:left top",
  "object-right": "object-position:right",
  "object-right-bottom": "object-position:right bottom",
  "object-right-top": "object-position:right top",
  "object-top": "object-position:top",

  "aspect-auto": "aspect-ratio:auto",
  "aspect-square": "aspect-ratio:1 / 1",
  "aspect-video": "aspect-ratio:16 / 9",

  "transition-none": "transition-property:none",
  grayscale: "filter:grayscale(100%)",
  "grayscale-0": "filter:grayscale(0)",
  invert: "filter:invert(100%)",
  "invert-0": "filter:invert(0)",
  sepia: "filter:sepia(100%)",
  "sepia-0": "filter:sepia(0)",
  "filter-none": "filter:none",
  "backdrop-grayscale": "backdrop-filter:grayscale(100%)",
  "backdrop-invert": "backdrop-filter:invert(100%)",
  "backdrop-filter-none": "backdrop-filter:none",

  "transform-none": "transform:none;translate:none;rotate:none;scale:none",
  "transform-gpu": "transform:translateZ(0)",
  "origin-center": "transform-origin:center",
  "origin-top": "transform-origin:top",
  "origin-top-right": "transform-origin:top right",
  "origin-right": "transform-origin:right",
  "origin-bottom-right": "transform-origin:bottom right",
  "origin-bottom": "transform-origin:bottom",
  "origin-bottom-left": "transform-origin:bottom left",
  "origin-left": "transform-origin:left",
  "origin-top-left": "transform-origin:top left",

  "select-none": "user-select:none",
  "select-text": "user-select:text",
  "select-all": "user-select:all",
  "select-auto": "user-select:auto",
  "pointer-events-none": "pointer-events:none",
  "pointer-events-auto": "pointer-events:auto",
  resize: "resize:both",
  "resize-none": "resize:none",
  "resize-x": "resize:horizontal",
  "resize-y": "resize:vertical",
  "touch-auto": "touch-action:auto",
  "touch-none": "touch-action:none",
  "touch-pan-x": "touch-action:pan-x",
  "touch-pan-y": "touch-action:pan-y",
  "touch-manipulation": "touch-action:manipulation",
  "will-change-auto": "will-change:auto",
  "will-change-scroll": "will-change:scroll-position",
  "will-change-contents": "will-change:contents",
  "will-change-transform": "will-change:transform",
  "appearance-none": "appearance:none",
  "appearance-auto": "appearance:auto",
  "content-none": "content:none",
  "fill-none": "fill:none",
  "stroke-none": "stroke:none",
};

const CURSOR_VALUES = new Set([
  "auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed",
  "none", "context-menu", "progress", "cell", "crosshair", "vertical-text",
  "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize",
  "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize",
  "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize",
  "nesw-resize", "nwse-resize", "zoom-in", "zoom-out",
]);

/** @param {string | string[]} value */
const asText = (value) => (Array.isArray(value) ? value.join(",") : value);

/**
 * @param {string[]} props
 * @param {string | string[]} value
 */
const decls = (props, value) => {
  const text = asText(value);
  return props.map((prop) => `${prop}:${text}`);
};

const CHILDREN = " > :not([hidden]) ~ :not([hidden])";

const ANIMATIONS = /** @type {Record<string, [string, string]>} */ ({
  spin: ["spin 1s linear infinite", "@keyframes spin{to{transform:rotate(360deg)}}"],
  ping: ["ping 1s cubic-bezier(0, 0, 0.2, 1) infinite", "@keyframes ping{75%,100%{transform:scale(2);opacity:0}}"],
  pulse: ["pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite", "@keyframes pulse{50%{opacity:.5}}"],
  bounce: ["bounce 1s infinite", "@keyframes bounce{0%,100%{transform:translateY(-25%);animation-timing-function:cubic-bezier(0.8,0,1,1)}50%{transform:none;animation-timing-function:cubic-bezier(0,0,0.2,1)}}"],
});

const TRANSITION_PROPERTIES = /** @type {Record<string, string>} */ ({
  DEFAULT:
    "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
  all: "all",
  colors: "color, background-color, border-color, text-decoration-color, fill, stroke",
  opacity: "opacity",
  shadow: "box-shadow",
  transform: "transform, translate, rotate, scale",
});

/** One dynamic rule of the table: its class prefix, the function that compiles a match, and its place in the table once built. */
export class DynamicRule {
  /**
   * @param {string} prefix
   * @param {DynamicRuleFn} fn
   */
  constructor(prefix, fn) {
    this.prefix = prefix;
    this.fn = fn;
    this.order = 0;
  }
}

/**
 * @param {string} prefix
 * @param {DynamicRuleFn} fn
 */
const rule = (prefix, fn) => new DynamicRule(prefix, fn);

/**
 * @param {import("./types.ts").Theme} theme
 * @returns {{match: (parsed: import("./types.ts").ParsedClass) => MatchedRule | null}}
 */
export const createRules = (theme) => {
  /**
   * @param {string[]} props
   * @param {SpacingOptions} options
   */
  const spacingRule = (props, options) => (/** @type {RuleInput} */ r) => {
    if (r.negative && !options.negative) return null;
    const value = resolveSpacing(r.restBase, theme.spacing, options);
    if (value === null) return null;
    return decls(props, r.negative ? negate(value) : value);
  };

  /**
   * @param {string[]} props
   * @param {ColorScale} extras
   */
  const colorRule = (props, extras) => (/** @type {RuleInput} */ r) => {
    if (r.negative) return null;
    const value = resolveColor(r.restStem, r.modifier, theme.colors, extras);
    if (value === null) return null;
    return decls(props, value);
  };

  /**
   * @param {string[]} props
   * @param {Record<string, string | string[]> | undefined} scale
   * @param {{ negative?: boolean }} options
   * @param {((value: string, type: string | null) => string | null) | null} arbitrary what an arbitrary value becomes, null to take it as written
   */
  const lookupRule = (props, scale, options, arbitrary) => (/** @type {RuleInput} */ r) => {
    if (r.negative && !options.negative) return null;
    const key = r.restBase === "" ? "DEFAULT" : r.restBase;
    const value = resolveLookup(key, scale, arbitrary);
    if (value === null) return null;
    if (!r.negative) return decls(props, value);
    return typeof value === "string" ? decls(props, negate(value)) : null;
  };

  /**
   * @param {string} prefix
   * @param {string} prop
   * @param {SpacingOptions} options
   * @returns {DynamicRule[]}
   */
  const sides = (prefix, prop, options) => [
    rule(prefix, spacingRule([prop], options)),
    rule(`${prefix}x`, spacingRule([`${prop}-left`, `${prop}-right`], options)),
    rule(`${prefix}y`, spacingRule([`${prop}-top`, `${prop}-bottom`], options)),
    rule(`${prefix}t`, spacingRule([`${prop}-top`], options)),
    rule(`${prefix}r`, spacingRule([`${prop}-right`], options)),
    rule(`${prefix}b`, spacingRule([`${prop}-bottom`], options)),
    rule(`${prefix}l`, spacingRule([`${prop}-left`], options)),
  ];

  /** @param {string[]} props */
  const borderWidth = (props) => (/** @type {RuleInput} */ r) => {
    if (r.negative) return null;
    if (r.restBase === "") return decls(props, "1px");
    if (/^\d+(?:\.\d+)?$/.test(r.restBase)) return decls(props, `${r.restBase}px`);
    const arb = parseArbitrary(r.restBase);
    if (arb && (arb.type === "length" || arb.type === "line-width" || (arb.type === null && looksLikeLength(arb.value))))
      return decls(props, arb.value);
    return null;
  };

  /**
   * @param {string} property
   * @param {string} fn
   * @param {boolean} percent whether a bare number is a 0-100 fraction
   */
  const filterFn = (property, fn, percent) => (/** @type {RuleInput} */ r) => {
    if (r.negative) return null;
    const value = percent ? resolvePercentNumber(r.restBase) : resolveInteger(r.restBase);
    if (value === null) return null;
    return [`${property}:${fn}(${value})`];
  };

  /**
   * @param {string} property
   * @param {string | null} fn
   */
  const angleRule = (property, fn) => (/** @type {RuleInput} */ r) => {
    let value = null;
    if (/^\d+(?:\.\d+)?$/.test(r.restBase)) value = `${r.restBase}deg`;
    else {
      const arb = parseArbitrary(r.restBase);
      if (arb && (arb.type === null || arb.type === "angle")) value = arb.value;
    }
    if (value === null) return null;
    if (r.negative) value = negate(value);
    return fn ? [`${property}:${fn}(${value})`] : [`${property}:${value}`];
  };

  const fontSize = (/** @type {RuleInput} */ r) => {
    const hit = theme.fontSize[r.restStem];
    if (hit !== undefined) {
      const [size, lineHeight] = Array.isArray(hit) ? hit : [hit, null];
      const overridden = r.modifier !== null ? resolveSpacing(r.modifier, theme.spacing) : null;
      const line = overridden ?? lineHeight;
      return line ? [`font-size:${size}`, `line-height:${line}`] : [`font-size:${size}`];
    }
    const arb = parseArbitrary(r.restBase);
    if (arb && (arb.type === "length" || arb.type === "absolute-size" || arb.type === "relative-size" ||
        (arb.type === null && looksLikeLength(arb.value))))
      return [`font-size:${arb.value}`];
    return null;
  };

  /** @param {string} variable */
  const gradientStop = (variable) => (/** @type {RuleInput} */ r) => {
    if (r.negative) return null;
    const value = resolveColor(r.restStem, r.modifier, theme.colors);
    if (value === null) return null;
    if (variable === "from")
      return [
        `--tw-gradient-from:${value}`,
        "--tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to, transparent)",
      ];
    if (variable === "via")
      return [
        `--tw-gradient-stops:var(--tw-gradient-from, transparent), ${value}, var(--tw-gradient-to, transparent)`,
      ];
    return [`--tw-gradient-to:${value}`];
  };

  /** @type {DynamicRule[]} */
  const DYNAMIC_HEAD = [
    rule("inset", spacingRule(["inset"], { negative: true, keywords: { auto: "auto", full: "100%" } })),
    rule("inset-x", spacingRule(["left", "right"], { negative: true, keywords: { auto: "auto", full: "100%" } })),
    rule("inset-y", spacingRule(["top", "bottom"], { negative: true, keywords: { auto: "auto", full: "100%" } })),
    rule("top", spacingRule(["top"], { negative: true, keywords: { auto: "auto", full: "100%" } })),
    rule("right", spacingRule(["right"], { negative: true, keywords: { auto: "auto", full: "100%" } })),
    rule("bottom", spacingRule(["bottom"], { negative: true, keywords: { auto: "auto", full: "100%" } })),
    rule("left", spacingRule(["left"], { negative: true, keywords: { auto: "auto", full: "100%" } })),
    rule("z", (/** @type {RuleInput} */ r) => {
      const value = resolveInteger(r.restBase, { keywords: { auto: "auto", ...theme.zIndex } });
      if (value === null) return null;
      return [`z-index:${r.negative ? negate(value) : value}`];
    }),
    rule("order", (/** @type {RuleInput} */ r) => {
      const value = resolveInteger(r.restBase, { keywords: { first: "-9999", last: "9999", none: "0" } });
      if (value === null) return null;
      return [`order:${r.negative ? negate(value) : value}`];
    }),

    rule("basis", spacingRule(["flex-basis"], { keywords: { auto: "auto", full: "100%" } })),
    rule("flex", (/** @type {RuleInput} */ r) => {
      const arb = parseArbitrary(r.restBase);
      return arb ? [`flex:${arb.value}`] : null;
    }),
    rule("grow", (/** @type {RuleInput} */ r) => {
      const value = resolveInteger(r.restBase);
      return value === null ? null : [`flex-grow:${value}`];
    }),
    rule("shrink", (/** @type {RuleInput} */ r) => {
      const value = resolveInteger(r.restBase);
      return value === null ? null : [`flex-shrink:${value}`];
    }),
    rule("grid-cols", (/** @type {RuleInput} */ r) => {
      if (r.restBase === "none") return ["grid-template-columns:none"];
      if (/^\d+$/.test(r.restBase)) return [`grid-template-columns:repeat(${r.restBase}, minmax(0, 1fr))`];
      const arb = parseArbitrary(r.restBase);
      return arb ? [`grid-template-columns:${arb.value}`] : null;
    }),
    rule("grid-rows", (/** @type {RuleInput} */ r) => {
      if (r.restBase === "none") return ["grid-template-rows:none"];
      if (/^\d+$/.test(r.restBase)) return [`grid-template-rows:repeat(${r.restBase}, minmax(0, 1fr))`];
      const arb = parseArbitrary(r.restBase);
      return arb ? [`grid-template-rows:${arb.value}`] : null;
    }),
    rule("col-span", (/** @type {RuleInput} */ r) => {
      if (r.restBase === "full") return ["grid-column:1 / -1"];
      if (/^\d+$/.test(r.restBase)) return [`grid-column:span ${r.restBase} / span ${r.restBase}`];
      return null;
    }),
    rule("col-start", (/** @type {RuleInput} */ r) => {
      const value = resolveInteger(r.restBase, { keywords: { auto: "auto" } });
      return value === null ? null : [`grid-column-start:${value}`];
    }),
    rule("col-end", (/** @type {RuleInput} */ r) => {
      const value = resolveInteger(r.restBase, { keywords: { auto: "auto" } });
      return value === null ? null : [`grid-column-end:${value}`];
    }),
    rule("col", (/** @type {RuleInput} */ r) => {
      if (r.restBase === "auto") return ["grid-column:auto"];
      const arb = parseArbitrary(r.restBase);
      return arb ? [`grid-column:${arb.value}`] : null;
    }),
    rule("row-span", (/** @type {RuleInput} */ r) => {
      if (r.restBase === "full") return ["grid-row:1 / -1"];
      if (/^\d+$/.test(r.restBase)) return [`grid-row:span ${r.restBase} / span ${r.restBase}`];
      return null;
    }),
    rule("row-start", (/** @type {RuleInput} */ r) => {
      const value = resolveInteger(r.restBase, { keywords: { auto: "auto" } });
      return value === null ? null : [`grid-row-start:${value}`];
    }),
    rule("row-end", (/** @type {RuleInput} */ r) => {
      const value = resolveInteger(r.restBase, { keywords: { auto: "auto" } });
      return value === null ? null : [`grid-row-end:${value}`];
    }),
    rule("row", (/** @type {RuleInput} */ r) => {
      if (r.restBase === "auto") return ["grid-row:auto"];
      const arb = parseArbitrary(r.restBase);
      return arb ? [`grid-row:${arb.value}`] : null;
    }),
    rule("gap", spacingRule(["gap"], {})),
    rule("gap-x", spacingRule(["column-gap"], {})),
    rule("gap-y", spacingRule(["row-gap"], {})),
    rule("space-x", (/** @type {RuleInput} */ r) => {
      const value = resolveSpacing(r.restBase, theme.spacing);
      if (value === null) return null;
      return { decls: [`margin-left:${r.negative ? negate(value) : value}`], childSelector: CHILDREN, keyframes: null };
    }),
    rule("space-y", (/** @type {RuleInput} */ r) => {
      const value = resolveSpacing(r.restBase, theme.spacing);
      if (value === null) return null;
      return { decls: [`margin-top:${r.negative ? negate(value) : value}`], childSelector: CHILDREN, keyframes: null };
    }),
    rule("divide-x", (/** @type {RuleInput} */ r) => {
      if (r.restBase === "") return { decls: ["border-left-width:1px"], childSelector: CHILDREN, keyframes: null };
      if (/^\d+$/.test(r.restBase)) return { decls: [`border-left-width:${r.restBase}px`], childSelector: CHILDREN, keyframes: null };
      return null;
    }),
    rule("divide-y", (/** @type {RuleInput} */ r) => {
      if (r.restBase === "") return { decls: ["border-top-width:1px"], childSelector: CHILDREN, keyframes: null };
      if (/^\d+$/.test(r.restBase)) return { decls: [`border-top-width:${r.restBase}px`], childSelector: CHILDREN, keyframes: null };
      return null;
    }),
    rule("divide", (/** @type {RuleInput} */ r) => {
      const value = resolveColor(r.restStem, r.modifier, theme.colors, theme.borderColor);
      if (value === null) return null;
      return { decls: [`border-color:${value}`], childSelector: CHILDREN, keyframes: null };
    }),
    rule("columns", (/** @type {RuleInput} */ r) => {
      const value = resolveInteger(r.restBase, { keywords: { auto: "auto" } });
      return value === null ? null : [`columns:${value}`];
    }),
  ];

  /** @type {DynamicRule[]} */
  const DYNAMIC = [];
  for (const entry of DYNAMIC_HEAD) DYNAMIC.push(entry);
  for (const entry of sides("p", "padding", {})) DYNAMIC.push(entry);
  for (const entry of sides("m", "margin", { negative: true, keywords: { auto: "auto" } })) DYNAMIC.push(entry);
  const DYNAMIC_TAIL = [
    rule("w", spacingRule(["width"], {
      keywords: {
        auto: "auto", full: "100%", screen: "100vw", svw: "100svw", lvw: "100lvw",
        dvw: "100dvw", min: "min-content", max: "max-content", fit: "fit-content",
      },
    })),
    rule("h", spacingRule(["height"], {
      keywords: {
        auto: "auto", full: "100%", screen: "100vh", svh: "100svh", lvh: "100lvh",
        dvh: "100dvh", min: "min-content", max: "max-content", fit: "fit-content",
      },
    })),
    rule("size", spacingRule(["width", "height"], {
      keywords: { auto: "auto", full: "100%", min: "min-content", max: "max-content", fit: "fit-content" },
    })),
    rule("min-w", spacingRule(["min-width"], {
      keywords: { full: "100%", min: "min-content", max: "max-content", fit: "fit-content" },
    })),
    rule("min-h", spacingRule(["min-height"], {
      keywords: {
        full: "100%", screen: "100vh", svh: "100svh", lvh: "100lvh", dvh: "100dvh",
        min: "min-content", max: "max-content", fit: "fit-content",
      },
    })),
    rule("max-w", (/** @type {RuleInput} */ r) => {
      if (r.negative) return null;
      const screen = /^screen-(.+)$/.exec(r.restBase);
      if (screen && theme.screens[screen[1]]) return [`max-width:${theme.screens[screen[1]]}`];
      const named = theme.maxWidth[r.restBase];
      if (named !== undefined) return [`max-width:${named}`];
      const value = resolveSpacing(r.restBase, theme.spacing, { keywords: { full: "100%", min: "min-content", max: "max-content", fit: "fit-content" } });
      return value === null ? null : [`max-width:${value}`];
    }),
    rule("max-h", spacingRule(["max-height"], {
      keywords: {
        none: "none", full: "100%", screen: "100vh", svh: "100svh", lvh: "100lvh",
        dvh: "100dvh", min: "min-content", max: "max-content", fit: "fit-content",
      },
    })),

    rule("text", fontSize),
    rule("text", colorRule(["color"], theme.textColor)),
    rule("font", lookupRule(["font-weight"], theme.fontWeight, {}, (value, type) =>
      type === "number" || (type === null && /^\d+$/.test(value)) ? value : null)),
    rule("font", lookupRule(["font-family"], theme.fontFamily, {}, (value, type) =>
      type === "family-name" || type === "generic-name" || type === null ? value : null)),
    rule("leading", (/** @type {RuleInput} */ r) => {
      const named = theme.lineHeight[r.restBase];
      if (named !== undefined) return [`line-height:${named}`];
      const value = resolveSpacing(r.restBase, theme.spacing, { fractions: false });
      return value === null ? null : [`line-height:${value}`];
    }),
    rule("tracking", lookupRule(["letter-spacing"], theme.letterSpacing, { negative: true }, null)),
    rule("line-clamp", (/** @type {RuleInput} */ r) => {
      const value = resolveInteger(r.restBase);
      if (value === null) return null;
      return [
        "overflow:hidden",
        "display:-webkit-box",
        "-webkit-box-orient:vertical",
        `-webkit-line-clamp:${value}`,
      ];
    }),
    rule("indent", spacingRule(["text-indent"], { negative: true })),
    rule("decoration", colorRule(["text-decoration-color"], {})),
    rule("decoration", (/** @type {RuleInput} */ r) => {
      if (r.restBase === "auto") return ["text-decoration-thickness:auto"];
      if (r.restBase === "from-font") return ["text-decoration-thickness:from-font"];
      if (/^\d+$/.test(r.restBase)) return [`text-decoration-thickness:${r.restBase}px`];
      const arb = parseArbitrary(r.restBase);
      if (arb && (arb.type === "length" || (arb.type === null && looksLikeLength(arb.value))))
        return [`text-decoration-thickness:${arb.value}`];
      return null;
    }),
    rule("underline-offset", (/** @type {RuleInput} */ r) => {
      if (/^\d+$/.test(r.restBase)) return [`text-underline-offset:${r.restBase}px`];
      const arb = parseArbitrary(r.restBase);
      return arb ? [`text-underline-offset:${arb.value}`] : null;
    }),

    rule("bg", colorRule(["background-color"], theme.backgroundColor)),
    rule("bg", (/** @type {RuleInput} */ r) => {
      const arb = parseArbitrary(r.restBase);
      if (!arb) return null;
      if (arb.type === "url" || arb.type === "image" || /^url\(/.test(arb.value))
        return [`background-image:${arb.value}`];
      if (arb.type === "length" || arb.type === "size") return [`background-size:${arb.value}`];
      if (arb.type === "position") return [`background-position:${arb.value}`];
      return null;
    }),
    rule("from", gradientStop("from")),
    rule("via", gradientStop("via")),
    rule("to", gradientStop("to")),

    rule("border", borderWidth(["border-width"])),
    rule("border", colorRule(["border-color"], theme.borderColor)),
    rule("border-x", borderWidth(["border-left-width", "border-right-width"])),
    rule("border-x", colorRule(["border-left-color", "border-right-color"], theme.borderColor)),
    rule("border-y", borderWidth(["border-top-width", "border-bottom-width"])),
    rule("border-y", colorRule(["border-top-color", "border-bottom-color"], theme.borderColor)),
    rule("border-t", borderWidth(["border-top-width"])),
    rule("border-t", colorRule(["border-top-color"], theme.borderColor)),
    rule("border-r", borderWidth(["border-right-width"])),
    rule("border-r", colorRule(["border-right-color"], theme.borderColor)),
    rule("border-b", borderWidth(["border-bottom-width"])),
    rule("border-b", colorRule(["border-bottom-color"], theme.borderColor)),
    rule("border-l", borderWidth(["border-left-width"])),
    rule("border-l", colorRule(["border-left-color"], theme.borderColor)),
    rule("border-spacing", spacingRule(["border-spacing"], {})),

    rule("rounded", lookupRule(["border-radius"], theme.borderRadius, {}, null)),
    rule("rounded-t", lookupRule(["border-top-left-radius", "border-top-right-radius"], theme.borderRadius, {}, null)),
    rule("rounded-r", lookupRule(["border-top-right-radius", "border-bottom-right-radius"], theme.borderRadius, {}, null)),
    rule("rounded-b", lookupRule(["border-bottom-right-radius", "border-bottom-left-radius"], theme.borderRadius, {}, null)),
    rule("rounded-l", lookupRule(["border-top-left-radius", "border-bottom-left-radius"], theme.borderRadius, {}, null)),
    rule("rounded-tl", lookupRule(["border-top-left-radius"], theme.borderRadius, {}, null)),
    rule("rounded-tr", lookupRule(["border-top-right-radius"], theme.borderRadius, {}, null)),
    rule("rounded-br", lookupRule(["border-bottom-right-radius"], theme.borderRadius, {}, null)),
    rule("rounded-bl", lookupRule(["border-bottom-left-radius"], theme.borderRadius, {}, null)),

    rule("outline", (/** @type {RuleInput} */ r) => {
      if (/^\d+$/.test(r.restBase)) return [`outline-width:${r.restBase}px`];
      const arb = parseArbitrary(r.restBase);
      if (arb && (arb.type === "length" || (arb.type === null && looksLikeLength(arb.value))))
        return [`outline-width:${arb.value}`];
      return null;
    }),
    rule("outline", colorRule(["outline-color"], {})),
    rule("outline-offset", (/** @type {RuleInput} */ r) => {
      let value = null;
      if (/^\d+$/.test(r.restBase)) value = `${r.restBase}px`;
      else {
        const arb = parseArbitrary(r.restBase);
        if (arb) value = arb.value;
      }
      if (value === null) return null;
      return [`outline-offset:${r.negative ? negate(value) : value}`];
    }),

    rule("shadow", lookupRule(["box-shadow"], theme.boxShadow, {}, (value, type) =>
      type === null || type === "shadow" ? value : null)),
    rule("ring", (/** @type {RuleInput} */ r) => {
      let width = null;
      if (r.restBase === "") width = "3px";
      else if (/^\d+$/.test(r.restBase)) width = `${r.restBase}px`;
      if (width === null) return null;
      return [`box-shadow:0 0 0 ${width} var(--tw-ring-color, rgb(59 130 246 / 0.5))`];
    }),
    rule("ring", colorRule(["--tw-ring-color"], {})),
    rule("opacity", (/** @type {RuleInput} */ r) => {
      const value = resolvePercentNumber(r.restBase);
      return value === null ? null : [`opacity:${value}`];
    }),

    rule("blur", (/** @type {RuleInput} */ r) => {
      const value = resolveLookup(r.restBase === "" ? "DEFAULT" : r.restBase, theme.blur, null);
      return value === null ? null : [`filter:blur(${asText(value)})`];
    }),
    rule("brightness", filterFn("filter", "brightness", true)),
    rule("contrast", filterFn("filter", "contrast", true)),
    rule("saturate", filterFn("filter", "saturate", true)),
    rule("hue-rotate", angleRule("filter", "hue-rotate")),
    rule("drop-shadow", (/** @type {RuleInput} */ r) => {
      const value = resolveLookup(r.restBase === "" ? "DEFAULT" : r.restBase, theme.dropShadow, null);
      return value === null ? null : [`filter:drop-shadow(${asText(value)})`];
    }),
    rule("backdrop-blur", (/** @type {RuleInput} */ r) => {
      const value = resolveLookup(r.restBase === "" ? "DEFAULT" : r.restBase, theme.blur, null);
      return value === null ? null : [`backdrop-filter:blur(${asText(value)})`];
    }),
    rule("backdrop-brightness", filterFn("backdrop-filter", "brightness", true)),
    rule("backdrop-contrast", filterFn("backdrop-filter", "contrast", true)),
    rule("backdrop-saturate", filterFn("backdrop-filter", "saturate", true)),
    rule("backdrop-opacity", filterFn("backdrop-filter", "opacity", true)),

    rule("transition", (/** @type {RuleInput} */ r) => {
      const property = TRANSITION_PROPERTIES[r.restBase === "" ? "DEFAULT" : r.restBase];
      if (property === undefined) {
        const arb = parseArbitrary(r.restBase);
        if (!arb) return null;
        return [
          `transition-property:${arb.value}`,
          `transition-timing-function:${theme.transitionTimingFunction.DEFAULT}`,
          "transition-duration:150ms",
        ];
      }
      return [
        `transition-property:${property}`,
        `transition-timing-function:${theme.transitionTimingFunction.DEFAULT}`,
        "transition-duration:150ms",
      ];
    }),
    rule("duration", (/** @type {RuleInput} */ r) => {
      if (/^\d+$/.test(r.restBase)) return [`transition-duration:${r.restBase}ms`];
      const arb = parseArbitrary(r.restBase);
      return arb ? [`transition-duration:${arb.value}`] : null;
    }),
    rule("delay", (/** @type {RuleInput} */ r) => {
      if (/^\d+$/.test(r.restBase)) return [`transition-delay:${r.restBase}ms`];
      const arb = parseArbitrary(r.restBase);
      return arb ? [`transition-delay:${arb.value}`] : null;
    }),
    rule("ease", lookupRule(["transition-timing-function"], theme.transitionTimingFunction, {}, null)),
    rule("animate", (/** @type {RuleInput} */ r) => {
      if (r.restBase === "none") return ["animation:none"];
      const animation = ANIMATIONS[r.restBase];
      if (animation) return { decls: [`animation:${animation[0]}`], childSelector: null, keyframes: animation[1] };
      const arb = parseArbitrary(r.restBase);
      return arb ? [`animation:${arb.value}`] : null;
    }),

    rule("translate-x", (/** @type {RuleInput} */ r) => {
      const value = resolveSpacing(r.restBase, theme.spacing, { keywords: { full: "100%" } });
      if (value === null) return null;
      return [
        `--tw-translate-x:${r.negative ? negate(value) : value}`,
        "translate:var(--tw-translate-x, 0) var(--tw-translate-y, 0)",
      ];
    }),
    rule("translate-y", (/** @type {RuleInput} */ r) => {
      const value = resolveSpacing(r.restBase, theme.spacing, { keywords: { full: "100%" } });
      if (value === null) return null;
      return [
        `--tw-translate-y:${r.negative ? negate(value) : value}`,
        "translate:var(--tw-translate-x, 0) var(--tw-translate-y, 0)",
      ];
    }),
    rule("rotate", angleRule("rotate", null)),
    rule("scale", (/** @type {RuleInput} */ r) => {
      const value = resolvePercentNumber(r.restBase);
      return value === null ? null : [`scale:${value}`];
    }),
    rule("scale-x", (/** @type {RuleInput} */ r) => {
      const value = resolvePercentNumber(r.restBase);
      return value === null ? null : [`scale:${value} 1`];
    }),
    rule("scale-y", (/** @type {RuleInput} */ r) => {
      const value = resolvePercentNumber(r.restBase);
      return value === null ? null : [`scale:1 ${value}`];
    }),
    rule("skew-x", angleRule("transform", "skewX")),
    rule("skew-y", angleRule("transform", "skewY")),

    rule("cursor", (/** @type {RuleInput} */ r) => {
      if (CURSOR_VALUES.has(r.restBase)) return [`cursor:${r.restBase}`];
      const arb = parseArbitrary(r.restBase);
      return arb ? [`cursor:${arb.value}`] : null;
    }),
    rule("will-change", (/** @type {RuleInput} */ r) => {
      const arb = parseArbitrary(r.restBase);
      return arb ? [`will-change:${arb.value}`] : null;
    }),
    rule("caret", colorRule(["caret-color"], {})),
    rule("accent", colorRule(["accent-color"], {})),
    rule("placeholder", colorRule(["color"], {})),
    rule("fill", colorRule(["fill"], {})),
    rule("stroke", colorRule(["stroke"], {})),
    rule("stroke", (/** @type {RuleInput} */ r) => {
      if (/^\d+$/.test(r.restBase)) return [`stroke-width:${r.restBase}`];
      const arb = parseArbitrary(r.restBase);
      if (arb && (arb.type === "length" || arb.type === "number" || (arb.type === null && looksLikeLength(arb.value))))
        return [`stroke-width:${arb.value}`];
      return null;
    }),

    rule("aspect", (/** @type {RuleInput} */ r) => {
      const arb = parseArbitrary(r.restBase);
      return arb ? [`aspect-ratio:${arb.value}`] : null;
    }),
    rule("object", (/** @type {RuleInput} */ r) => {
      const arb = parseArbitrary(r.restBase);
      return arb ? [`object-position:${arb.value}`] : null;
    }),
    rule("content", (/** @type {RuleInput} */ r) => {
      const arb = parseArbitrary(r.restBase);
      return arb ? [`content:${arb.value}`] : null;
    }),
    rule("align", (/** @type {RuleInput} */ r) => {
      const arb = parseArbitrary(r.restBase);
      return arb ? [`vertical-align:${arb.value}`] : null;
    }),
    rule("list", (/** @type {RuleInput} */ r) => {
      const arb = parseArbitrary(r.restBase);
      return arb ? [`list-style-type:${arb.value}`] : null;
    }),
  ];
  for (const entry of DYNAMIC_TAIL) DYNAMIC.push(entry);

  /** @type {Map<string, MatchedRule>} */
  const statics = new Map();
  let order = 0;
  for (const [name, body] of Object.entries(STATIC_SPECS))
    statics.set(name, { decls: body.split(";"), childSelector: null, keyframes: null, order: order++ });
  for (const entry of DYNAMIC) entry.order = order++;

  /** @param {string} base */
  const arbitraryProperty = (base) => {
    const match = /^\[(--[\w-]+|[a-z-]+):(.+)\]$/.exec(base);
    if (!match) return null;
    return { decls: [`${match[1]}:${match[2].replace(/_/g, " ")}`], childSelector: null, keyframes: null, order };
  };

  /** @param {ParsedClass} parsed */
  const match = (parsed) => {
    if (!parsed.negative && !parsed.modifier) {
      const hit = statics.get(parsed.base);
      if (hit) return hit;
    }
    for (const entry of DYNAMIC) {
      let restBase = null;
      if (parsed.base === entry.prefix) restBase = "";
      else if (parsed.base.startsWith(`${entry.prefix}-`)) restBase = parsed.base.slice(entry.prefix.length + 1);
      if (restBase === null) continue;
      const restStem = parsed.stem === entry.prefix ? "" :
        parsed.stem.startsWith(`${entry.prefix}-`) ? parsed.stem.slice(entry.prefix.length + 1) : restBase;
      const result = entry.fn({ raw: parsed.raw, variants: parsed.variants, important: parsed.important, negative: parsed.negative, base: parsed.base, stem: parsed.stem, modifier: parsed.modifier, restBase, restStem });
      if (result === null) continue;
      if (Array.isArray(result)) return { decls: result, childSelector: null, keyframes: null, order: entry.order };
      return { decls: result.decls, childSelector: result.childSelector, keyframes: result.keyframes, order: entry.order };
    }
    if (parsed.base.startsWith("[")) return arbitraryProperty(parsed.base);
    return null;
  };

  return { match };
};
