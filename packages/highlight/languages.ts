/**
 * @file The built-in languages, each with the core tokenizer of its id and the file extensions and
 * fence names it answers to: what an app registers at start (widecode's languages plugin
 * registers the same list, and its plugins test checks the two agree).
 */
import { addLanguage, Language } from "./index.ts";
import { tokenizerFor } from "./tokenizers.ts";

export class LanguageEntry {
  id: string;
  extensions: string[];
  fences: string[];
  lookAhead: number;
  indentAfter: (textBeforeCursor: string) => number;

  constructor(id: string, extensions: string[], fences: string[], lookAhead: number, indentAfter: (textBeforeCursor: string) => number) {
    this.id = id;
    this.extensions = extensions;
    this.fences = fences;
    this.lookAhead = lookAhead;
    this.indentAfter = indentAfter;
  }
}

const afterBracket = (before: string): number => (/(?:[{([]|=>)\s*$/.test(before) ? 1 : 0);
const afterBrace = (before: string): number => (/\{\s*$/.test(before) ? 1 : 0);
const afterOpenTag = (before: string): number => (/<[a-zA-Z][^>]*[^/]>\s*$/.test(before) && !/<\/[a-zA-Z]+>\s*$/.test(before) ? 1 : 0);
const never = (_before: string): number => 0;

export const LANGUAGES = [
  new LanguageEntry("javascript", ["js", "mjs", "cjs", "jsx", "json", "jsonc"], ["javascript", "js", "jsx", "json", "mjs"], 0, afterBracket),
  new LanguageEntry("typescript", ["ts", "mts", "cts", "tsx"], ["typescript", "ts", "tsx"], 0, afterBracket),
  new LanguageEntry("css", ["css", "scss", "less"], ["css", "scss"], 0, afterBrace),
  new LanguageEntry("html", ["html", "htm", "xhtml", "svg", "xml", "vue", "svelte"], ["html", "xml", "svg", "vue"], 0, afterOpenTag),
  new LanguageEntry("markdown", ["md", "markdown", "mdx"], ["md", "markdown"], 1, never),
];

/** Register them, each with the core tokenizer of its id. */
export const registerLanguages = (): void => {
  for (const l of LANGUAGES) {
    const tokenize = tokenizerFor(l.id);
    if (tokenize === null) continue;
    const language = new Language(l.id, l.extensions, l.fences, tokenize);
    language.lookAhead = l.lookAhead;
    language.indentAfter = l.indentAfter;
    addLanguage(language);
  }
};
