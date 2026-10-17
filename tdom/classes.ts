/**
 * @bootstrapp/light/tdom/classes: the `class` attribute on the terminal. An
 * element's classes are inert until the app configures a styler
 * (`configureClasses`), the host's half of the utility classes: the styler
 * answers the props a class string means and the element takes them, under
 * the ones the template wrote itself. A prop the template writes with any
 * value is the template's, whatever the attribute order, and classes never
 * touch it; a removal hands it back to the classes; a class list that stops
 * implying a prop resets it to its default. Two bitmasks on the element keep
 * the books, one bit per prop name.
 */
import type { PropValue, TElement } from "./node.ts";

/** One prop a class string means: the prop's template name and its value. */
export class ClassProp {
  name: string;
  value: PropValue;

  constructor(name: string, value: PropValue) {
    this.name = name;
    this.value = value;
  }
}

/**
 * What turns a class string into props. A host's styler subclasses it and
 * answers `propsFor`; `apply` is the engine's side, the bookkeeping.
 */
export class ClassStyler {
  propsFor(_classes: string): ClassProp[] {
    return [];
  }

  apply(el: TElement, classes: string) {
    applyClassProps(el, this.propsFor(classes));
  }
}

let styler: ClassStyler | null = null;

/** Install the styler every element's `class` goes through, or null to make `class` inert again. */
export const configureClasses = (next: ClassStyler | null) => {
  styler = next;
};

/** The installed styler, or null. */
export const classStyler = () => styler;

const PROP_NAMES = ["fg", "bg", "bold", "dim", "italic", "underline", "inverse", "strike", "hidden", "direction", "flex", "width", "height", "padding", "gap", "border", "title", "scroll", "scrollTop", "stickToBottom", "align", "wrap", "placeholder", "minLines", "maxLines"];
const PROP_BITS = new Map<string, number>();
for (let i = 0; i < PROP_NAMES.length; i++) PROP_BITS.set(PROP_NAMES[i], 1 << i);

/** The bit of a prop name in an element's masks; 0 for a name that is not a prop. */
export const propBit = (name: string): number => {
  const bit = PROP_BITS.get(name);
  return bit === undefined ? 0 : bit;
};

/** The value a prop has on a fresh element, what a class list that dropped it goes back to. */
const defaultOf = (name: string): PropValue => {
  switch (name) {
    case "fg":
    case "bg":
    case "width":
    case "height":
    case "title":
      return null;
    case "flex":
    case "padding":
    case "gap":
    case "scrollTop":
      return 0;
    case "direction":
      return "column";
    case "align":
      return "stretch";
    case "wrap":
      return "word";
    case "placeholder":
      return "";
    case "minLines":
      return 1;
    case "maxLines":
      return 8;
    default:
      return false;
  }
};

/**
 * Give an element the props its classes mean, skipping the ones the template
 * wrote, and reset the props its previous classes meant and these do not.
 */
export const applyClassProps = (el: TElement, props: ClassProp[]) => {
  let bits = 0;
  for (const prop of props) {
    const bit = propBit(prop.name);
    if (bit === 0 || (el.explicitProps & bit) !== 0) continue;
    if (el.setKnownProp(prop.name, prop.value)) bits |= bit;
  }
  const stale = el.classProps & ~bits & ~el.explicitProps;
  if (stale !== 0) for (const name of PROP_NAMES) if ((stale & propBit(name)) !== 0) el.setKnownProp(name, defaultOf(name));
  el.classProps = bits;
};

/** An element's `class` attribute changed: hand it to the styler, a removal as an empty list. */
export const applyClasses = (el: TElement, v: PropValue) => {
  if (styler === null) return;
  styler.apply(el, typeof v === "string" ? v : "");
};

/**
 * The template wrote a prop (`on`) or removed it: record it, and on a
 * removal let the classes have the prop again.
 */
export const markExplicit = (el: TElement, name: string, on: boolean) => {
  const bit = propBit(name);
  if (bit === 0) return;
  if (on) {
    el.explicitProps |= bit;
    return;
  }
  el.explicitProps &= ~bit;
  if (styler === null) return;
  const classes = el.attrs.get("class");
  if (classes !== undefined) applyClasses(el, classes);
};
