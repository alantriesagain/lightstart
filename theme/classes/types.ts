/**
 * @bootstrapp/light/theme/classes: the shapes of the engine. A class parsed,
 * a rule compiled, the engine and its options, the scales a theme gives it.
 * Nothing of a document: the browser runtime's shapes are `../runtime-types.ts`.
 */

export interface ParsedClass {
  raw: string;
  variants: string[];
  important: boolean;
  negative: boolean;
  base: string;
  stem: string;
  modifier: string | null;
}

export interface CompiledRule {
  cls: string;
  selector: string;
  medias: string[];
  weight: number;
  decls: string[];
  order: number;
  important: boolean;
  keyframes?: string;
}

export interface GenerateResult {
  css: string;
  matched: string[];
  unknown: string[];
}

/** A theme scale: utility names to CSS values. A name the scale lacks reads as undefined. */
export type Scale = { [key: string]: string | undefined };

/** A scale whose entries may be lists: a font size with its line height. */
export type ValueScale = { [key: string]: string | string[] | undefined };

/** The scales `buildTheme` answers: utility names to CSS values, a colour to its shades where it has them, and a font size to its size and line height. */
export interface Theme {
  screens: Scale;
  colors: ColorScale;
  textColor: ColorScale;
  backgroundColor: ColorScale;
  borderColor: ColorScale;
  spacing: Scale;
  fontSize: ValueScale;
  fontWeight: Scale;
  fontFamily: Scale;
  borderRadius: Scale;
  boxShadow: Scale;
  dropShadow: Scale;
  lineHeight: Scale;
  letterSpacing: Scale;
  blur: Scale;
  zIndex: Scale;
  maxWidth: Scale;
  transitionTimingFunction: Scale;
}

export interface Engine {
  compile: (cls: string) => CompiledRule | null;
  generate: (classes?: Iterable<string>) => GenerateResult;
  stringify: (rules: CompiledRule[]) => string;
  theme: Theme;
}

export interface EngineOptions {
  theme?: Theme;
  safelist?: string[];
}

/** A colour's shades by name: `DEFAULT`, `dark`, `100`, ... */
export type Shades = { [key: string]: string | undefined };

/** A colour scale: a name to a colour, or to its shades. */
export type ColorScale = { [key: string]: string | Shades | undefined };

export type RuleInput = ParsedClass & { restBase: string; restStem: string };

/** What a rule answers for a match: the declarations alone, or with the child selector a `space-*`/`divide-*` rule adds and the keyframes an animation needs. */
export type RuleResult = string[] | { decls: string[]; childSelector: string | null; keyframes: string | null } | null;

/** A rule matched to a class: its declarations, the child selector and keyframes when it has them, and its place in the table. */
export interface MatchedRule {
  decls: string[];
  childSelector: string | null;
  keyframes: string | null;
  order: number;
}

/** The function of a dynamic rule: what a match compiles to. */
export type DynamicRuleFn = (r: RuleInput) => RuleResult;

export type SpacingOptions = {
  negative?: boolean;
  keywords?: Record<string, string>;
  fractions?: boolean;
  arbitraryTypes?: string[];
};

export * from "./index.js";
