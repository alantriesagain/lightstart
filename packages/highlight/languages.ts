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

  constructor(id: string, extensions: string[], fences: string[]) {
    this.id = id;
    this.extensions = extensions;
    this.fences = fences;
  }
}

export const LANGUAGES = [
  new LanguageEntry("javascript", ["js", "mjs", "cjs", "jsx", "json", "jsonc"], ["javascript", "js", "jsx", "json", "mjs"]),
  new LanguageEntry("typescript", ["ts", "mts", "cts", "tsx"], ["typescript", "ts", "tsx"]),
  new LanguageEntry("css", ["css", "scss", "less"], ["css", "scss"]),
  new LanguageEntry("html", ["html", "htm", "xhtml", "svg", "xml", "vue", "svelte"], ["html", "xml", "svg", "vue"]),
  new LanguageEntry("markdown", ["md", "markdown", "mdx"], ["md", "markdown"]),
];

/** Register them, each with the core tokenizer of its id. */
export const registerLanguages = (): void => {
  for (const l of LANGUAGES) {
    const tokenize = tokenizerFor(l.id);
    if (tokenize !== null) addLanguage(new Language(l.id, l.extensions, l.fences, tokenize));
  }
};
