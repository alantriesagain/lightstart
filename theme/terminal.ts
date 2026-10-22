/**
 * @bootstrapp/light/theme/terminal: the utility classes on the terminal
 * host. `TerminalClasses` is a `ClassStyler` over the classes engine: a
 * class compiles as it does for a page, and the declarations a terminal can
 * show become tdom props, colors resolved through the theme's tokens on one
 * side of the theme (`scheme`), lengths rounded to cells. `dark:` applies on
 * the dark scheme, `focus:` and `focus-within:` as the element's states say;
 * what a terminal cannot show (sizes, radii, margins, every other variant)
 * is ignored and listed in `ignored`, the dev aid.
 */
import { ClassProp, ClassStyler, STATE_FOCUS, STATE_FOCUS_WITHIN } from "../native/tui/classes.ts";
import { parseClass } from "./classes/parse.js";
import { createRules } from "./classes/rules.js";
import { buildTheme } from "./classes/scales.js";
import { cssColorToHex, variablesFor } from "./tokens.ts";

import type { MatchedRule, ParsedClass } from "./classes/types.ts";
import type { ThemeData } from "./tokens.ts";

const VAR = /^var\((--[\w-]+)(?:,\s*(.*))?\)$/;
const MIX = /^color-mix\(in srgb, (.+?) \d+(?:\.\d+)?%, transparent\)$/;
const LENGTH = /^(-?\d*\.?\d+)(rem|em|px|ch)$/;
const NUMBER = /^(\d+(?:\.\d+)?)/;

const prop = (name: string, value: string | number | boolean | null, state: number) => new ClassProp(name, value, state);

/** The number of state bits a class names: its layer, a state layer applying over the base as a pseudo-class does over a plain selector. */
const layerOf = (state: number) => {
  let n = 0;
  for (let bits = state; bits !== 0; bits >>= 1) n += bits & 1;
  return n;
};

/** A class the styler kept: its declarations, the states it applies in and the order it applies in, as a stylesheet would order it. */
class Kept {
  cls: string;
  decls: string[];
  state: number;
  order: number;
  important: boolean;

  constructor(cls: string, decls: string[], state: number, order: number, important: boolean) {
    this.cls = cls;
    this.decls = decls;
    this.state = state;
    this.order = order;
    this.important = important;
  }
}

export class TerminalClasses extends ClassStyler {
  rules: { match: (parsed: ParsedClass) => MatchedRule | null };
  vars: Map<string, string>;
  dark: boolean;
  memo: Map<string, ClassProp[]>;
  /** The classes that compiled to nothing a terminal shows, or to nothing at all. */
  ignored: Set<string>;

  /**
   * @param theme the theme object, `dark` block included
   * @param scheme `"light"` or `"dark"`: the side whose tokens the colors resolve through
   */
  constructor(theme: ThemeData, scheme: string) {
    super();
    if (scheme !== "light" && scheme !== "dark") throw new Error("[theme] a terminal scheme is \"light\" or \"dark\", got " + JSON.stringify(scheme));
    this.rules = createRules(buildTheme(theme as Record<string, Record<string, unknown>>));
    this.vars = new Map<string, string>();
    for (const [name, value] of Object.entries(variablesFor(theme, scheme))) this.vars.set(name, value);
    this.dark = scheme === "dark";
    this.memo = new Map<string, ClassProp[]>();
    this.ignored = new Set<string>();
  }

  override propsFor(classes: string): ClassProp[] {
    const hit = this.memo.get(classes);
    if (hit !== undefined) return hit;
    const rules: Kept[] = [];
    for (const token of classes.split(/\s+/)) {
      if (token.length === 0) continue;
      const parsed = parseClass(token);
      if (parsed === null) {
        this.ignored.add(token);
        continue;
      }
      let state = 0;
      let wanted = true;
      for (const variant of parsed.variants) {
        if (variant === "dark") wanted = wanted && this.dark;
        else if (variant === "focus" || variant === "focus-visible") state |= STATE_FOCUS;
        else if (variant === "focus-within") state |= STATE_FOCUS_WITHIN;
        else wanted = false;
      }
      const matched = wanted ? this.rules.match(parsed) : null;
      if (matched === null) {
        this.ignored.add(token);
        continue;
      }
      rules.push(new Kept(token, matched.decls, state, matched.order, parsed.important));
    }
    rules.sort((a: Kept, b: Kept) => (a.important !== b.important ? (a.important ? 1 : -1) : layerOf(a.state) !== layerOf(b.state) ? layerOf(a.state) - layerOf(b.state) : a.order - b.order));
    const byName = new Map<string, ClassProp>();
    for (const rule of rules) {
      let took = false;
      for (const decl of rule.decls) {
        const at = decl.indexOf(":");
        if (at < 0) continue;
        for (const mapped of this.mapDecl(decl.slice(0, at), decl.slice(at + 1), rule.state)) {
          byName.set(String(rule.state) + ":" + mapped.name, mapped);
          took = true;
        }
      }
      if (!took) this.ignored.add(rule.cls);
    }
    const list: ClassProp[] = [];
    for (const mapped of byName.values()) list.push(mapped);
    this.memo.set(classes, list);
    return list;
  }

  /** A declaration's value with its `var()` references followed through the tokens and a `color-mix` alpha dropped. */
  resolveValue(value: string, depth: number): string {
    const s = value.trim();
    const ref = VAR.exec(s);
    if (ref !== null) {
      const hit = this.vars.get(ref[1]);
      if (hit !== undefined) return depth < 8 ? this.resolveValue(hit, depth + 1) : hit;
      const fallback = ref[2];
      return fallback === undefined || fallback.length === 0 ? "" : this.resolveValue(fallback, depth + 1);
    }
    const mix = MIX.exec(s);
    if (mix !== null) return this.resolveValue(mix[1], depth + 1);
    return s;
  }

  /** A color value as the terminal takes it: `#rrggbb`, `"default"` for no color, or null when it is not a color. */
  colorOf(value: string): string | null {
    const s = this.resolveValue(value, 0);
    if (s === "transparent" || s === "inherit" || s === "currentColor" || s === "currentcolor") return "default";
    return cssColorToHex(s);
  }

  /** A length in cells: half a rem or eight pixels per cell, at least one when positive; null for a percentage, a keyword or a calc. */
  cellsOf(value: string): number | null {
    const s = this.resolveValue(value, 0);
    if (s === "0" || s === "0px" || s === "0rem") return 0;
    const m = LENGTH.exec(s);
    if (m === null) return null;
    const n = Number(m[1]);
    const cells = m[2] === "px" ? n / 8 : m[2] === "ch" ? n : n * 2;
    if (cells <= 0) return 0;
    return Math.max(1, Math.round(cells));
  }

  /** The tdom props one CSS declaration means on the terminal, in the states `state` names; none for what it cannot show. */
  mapDecl(name: string, raw: string, state: number): ClassProp[] {
    const value = raw.trim();
    switch (name) {
      case "display":
        return value === "none" ? [prop("hidden", true, state)] : [];
      case "visibility":
        return value === "hidden" ? [prop("hidden", true, state)] : value === "visible" ? [prop("hidden", false, state)] : [];
      case "flex-direction":
        return value === "row" || value === "column" ? [prop("direction", value, state)] : [];
      case "flex":
      case "flex-grow": {
        if (value === "none") return [prop("flex", 0, state)];
        const m = NUMBER.exec(value);
        return m === null ? [] : [prop("flex", Number(m[1]), state)];
      }
      case "padding":
      case "padding-left":
      case "padding-right":
      case "padding-top":
      case "padding-bottom": {
        const cells = this.cellsOf(value);
        return cells === null ? [] : [prop("padding", cells, state)];
      }
      case "gap":
      case "column-gap":
      case "row-gap": {
        const cells = this.cellsOf(value);
        return cells === null ? [] : [prop("gap", cells, state)];
      }
      case "width":
      case "height": {
        const cells = this.cellsOf(value);
        return cells === null ? [] : [prop(name, cells, state)];
      }
      case "color": {
        const color = this.colorOf(value);
        return color === null ? [] : [prop("fg", color, state)];
      }
      case "background-color": {
        const color = this.colorOf(value);
        return color === null ? [] : [prop("bg", color, state)];
      }
      case "font-weight": {
        const weight = Number(this.resolveValue(value, 0));
        return Number.isNaN(weight) ? [] : [prop("bold", weight >= 600, state)];
      }
      case "font-style":
        return value === "italic" ? [prop("italic", true, state)] : value === "normal" ? [prop("italic", false, state)] : [];
      case "text-decoration-line":
        return [prop("underline", value.includes("underline"), state), prop("strike", value.includes("line-through"), state)];
      case "opacity": {
        const n = Number(value);
        return Number.isNaN(n) ? [] : [prop("dim", n < 1, state)];
      }
      case "border-width": {
        const n = Number.parseFloat(value);
        return Number.isNaN(n) ? [] : [prop("border", n > 0, state)];
      }
      case "overflow":
      case "overflow-y":
        return [prop("scroll", value === "auto" || value === "scroll", state)];
      case "align-items":
        return value === "stretch" ? [prop("align", "stretch", state)] : value === "flex-end" || value === "end" ? [prop("align", "end", state)] : [prop("align", "start", state)];
      case "white-space":
        return value === "nowrap" ? [prop("wrap", "none", state)] : value === "normal" ? [prop("wrap", "word", state)] : [];
      default:
        return [];
    }
  }
}
