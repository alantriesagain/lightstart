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

/** The scales `buildTheme` answers: colors, spacing, radii, shadows and the rest, each a map of names to CSS values or nested maps. */
export type Theme = Record<string, any>;

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

export type ColorScale = { [key: string]: string | ColorScale };

export type RuleInput = ParsedClass & { restBase: string; restStem: string };

export type RuleResult = string[] | { decls: string[]; keyframes?: string } | null;

/** One dynamic rule of the table: its class prefix and the function that compiles a match. */
export type DynamicRule = [prefix: string, fn: (r: RuleInput) => RuleResult];

export type SpacingOptions = {
  negative?: boolean;
  keywords?: Record<string, string>;
  fractions?: boolean;
  arbitraryTypes?: string[];
};

export * from "./index.js";
