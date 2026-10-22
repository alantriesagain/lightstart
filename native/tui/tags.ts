/**
 * @bootstrapp/light/native/tui/tags: the tags a terminal template may use. The
 * four node kinds have their own names (box, text, span, input) and the
 * HTML names map onto them, with the style the HTML name implies, so a
 * template reads like HTML: `div`, `section`, `ul` are boxes; `p`, `h1`,
 * `li`, `pre` are text; `b`, `em`, `code`, `a` are spans; `textarea` is an
 * input. A tag the app `define`d makes its view's box; any other tag
 * outside the table is a box. `class`, `id` and `style` are accepted and
 * kept inert.
 */
import { TBox, TElement, TInput, TRun, TSpan, TText } from "./node.ts";
import { ATTR_BOLD, ATTR_DIM, ATTR_INVERSE, ATTR_ITALIC, ATTR_STRIKE, ATTR_UNDERLINE } from "./style.ts";

/**
 * A tag the app defined: the function making its element, a view's box. A
 * class, since a Map's values are class instances natively, never bare
 * functions.
 */
export class TagDefinition {
  tag: string;
  makeElement: () => TElement;

  constructor(tag: string, makeElement: () => TElement) {
    this.tag = tag;
    this.makeElement = makeElement;
  }
}

const definitions = new Map<string, TagDefinition>();
let definedCount = 0;

/**
 * Register a definition. The tag is lowercase with a hyphen, as a custom
 * element's name is, and defined once.
 */
export const registerTag = (def: TagDefinition) => {
  const tag = def.tag;
  if (tag.indexOf("-") < 0) throw new Error("[tdom] define: \"" + tag + "\" needs a hyphen, as a custom element's name does");
  if (tag !== tag.toLowerCase()) throw new Error("[tdom] define: \"" + tag + "\" must be lowercase, as a template's tag names are");
  if (definitions.has(tag)) throw new Error("[tdom] define: \"" + tag + "\" is already defined");
  definitions.set(tag, def);
  definedCount++;
};

export const isDefinedTag = (tag: string) => definitions.has(tag);

const BLOCK = new Set(["box", "div", "section", "article", "main", "header", "footer", "nav", "aside", "ul", "ol", "form", "fieldset", "button", "hr", "details", "summary", "dialog", "table", "tr", "menu"]);
const TEXT = new Set(["text", "p", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "blockquote", "label", "li", "dt", "dd", "figcaption", "legend", "td", "th", "caption"]);
const INLINE = new Set(["span", "b", "strong", "i", "em", "u", "s", "del", "code", "kbd", "a", "small", "mark", "br", "q", "abbr", "sub", "sup", "time", "var"]);
const INPUT = new Set(["input", "textarea"]);

const COMMON_PROPS = ["fg", "bg", "bold", "dim", "italic", "underline", "inverse", "strike", "hidden", "class", "id", "style", "tabindex", "disabled"];
const BOX_PROPS = ["direction", "flex", "width", "height", "padding", "gap", "border", "title", "scroll", "scrollTop", "stickToBottom", "align"];
const TEXT_PROPS = ["wrap"];
const INPUT_PROPS = ["placeholder", "minLines", "maxLines", "value"];
export const EVENT_NAMES = ["key", "submit", "change", "click", "mousedown", "mouseup", "mousemove", "wheel", "focus", "blur"];

/**
 * The node kind a tag creates.
 */
export const kindOf = (tag: string) => {
  if (BLOCK.has(tag)) return "box";
  if (TEXT.has(tag)) return "text";
  if (INLINE.has(tag)) return "span";
  if (INPUT.has(tag)) return "input";
  return "box";
};

export const isKnownTag = (tag: string) => BLOCK.has(tag) || TEXT.has(tag) || INLINE.has(tag) || INPUT.has(tag);

/**
 * Whether an element of `tag` has a prop or attribute named `name`.
 */
export const isKnownProp = (tag: string, name: string) => {
  if (COMMON_PROPS.indexOf(name) >= 0) return true;
  const kind = kindOf(tag);
  if (kind === "box") return BOX_PROPS.indexOf(name) >= 0;
  if (kind === "text") return TEXT_PROPS.indexOf(name) >= 0;
  if (kind === "input") return INPUT_PROPS.indexOf(name) >= 0;
  return false;
};

const withAttr = (el: TElement, bit: number) => {
  el.style = el.style.withAttr(bit, true);
};

/**
 * An element for `tag`: a defined tag's view box, else an element styled as
 * the HTML name implies.
 */
export const createElement = (tag: string): TElement => {
  if (definedCount > 0) {
    const def = definitions.get(tag);
    if (def !== undefined) return def.makeElement();
  }
  const kind = kindOf(tag);
  if (kind === "text") {
    const text = new TText(tag);
    if (tag === "h1" || tag === "h2" || tag === "h3") withAttr(text, ATTR_BOLD);
    if (tag === "h1") withAttr(text, ATTR_UNDERLINE);
    if (tag === "pre") text.wrap = "none";
    return text;
  }
  if (kind === "span") {
    const span = new TSpan(tag);
    if (tag === "b" || tag === "strong") withAttr(span, ATTR_BOLD);
    if (tag === "i" || tag === "em" || tag === "var") withAttr(span, ATTR_ITALIC);
    if (tag === "u" || tag === "a") withAttr(span, ATTR_UNDERLINE);
    if (tag === "s" || tag === "del") withAttr(span, ATTR_STRIKE);
    if (tag === "small") withAttr(span, ATTR_DIM);
    if (tag === "mark" || tag === "kbd") withAttr(span, ATTR_INVERSE);
    if (tag === "br") span.append(new TRun("\n"));
    return span;
  }
  if (kind === "input") return new TInput(tag);
  const box = new TBox(tag);
  if (tag === "hr") box.rule = true;
  return box;
};
