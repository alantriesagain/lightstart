/**
 * @file The built-in grammars' names and aliases, and the module each one loads
 * from. The table is static and imports no grammar, so a caller can ask for a
 * language without pulling every tokenizer into its bundle; `loadLanguage`
 * loads one grammar's module on first use, and that module registers it.
 */
import { findLanguage } from "./registry.ts";

/** A built-in grammar's names and traits, without its tokenizer. */
export interface GrammarEntry {
  id: string;
  extensions: string[];
  fences: string[];
  lookAhead: number;
  indentAfter: (textBeforeCursor: string) => number;
}

const afterBracket = (before: string): number => (/(?:[{([]|=>)\s*$/.test(before) ? 1 : 0);
const afterBrace = (before: string): number => (/\{\s*$/.test(before) ? 1 : 0);
const afterOpenTag = (before: string): number => (/<[a-zA-Z][^>]*[^/]>\s*$/.test(before) && !/<\/[a-zA-Z]+>\s*$/.test(before) ? 1 : 0);
const never = (_before: string): number => 0;

/** The built-in grammars, by id, with every name and extension that asks for one. */
export const GRAMMARS: readonly GrammarEntry[] = [
  { id: "javascript", extensions: ["js", "mjs", "cjs", "jsx", "json", "jsonc"], fences: ["javascript", "js", "jsx", "json", "mjs"], lookAhead: 0, indentAfter: afterBracket },
  { id: "typescript", extensions: ["ts", "mts", "cts", "tsx"], fences: ["typescript", "ts", "tsx"], lookAhead: 0, indentAfter: afterBracket },
  { id: "css", extensions: ["css", "scss", "less"], fences: ["css", "scss"], lookAhead: 0, indentAfter: afterBrace },
  { id: "html", extensions: ["html", "htm", "xhtml", "svg", "xml", "vue", "svelte"], fences: ["html", "xml", "svg", "vue"], lookAhead: 0, indentAfter: afterOpenTag },
  { id: "markdown", extensions: ["md", "markdown", "mdx"], fences: ["md", "markdown"], lookAhead: 1, indentAfter: never },
];

/** The entry named `id`; null for a grammar the core does not have. */
export const grammarEntry = (id: string): GrammarEntry | null => GRAMMARS.find((entry) => entry.id === id) ?? null;

/** The grammar id `name` asks for: an id, fence name or file extension, or a path's extension; "" for none. */
export const grammarFor = (name: string): string => {
  const pathExt = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  const word = pathExt.length > 0 ? pathExt : name.trim().split(/\s+/)[0].toLowerCase();
  for (const entry of GRAMMARS) {
    if (entry.id === word || entry.fences.includes(word) || entry.extensions.includes(word)) return entry.id;
  }
  return "";
};

type Loader = () => Promise<unknown>;

const loaders: Record<string, Loader> = {
  javascript: () => import("./lang/javascript.ts"),
  typescript: () => import("./lang/typescript.ts"),
  css: () => import("./lang/css.ts"),
  html: () => import("./lang/html.ts"),
  markdown: () => import("./lang/markdown.ts"),
};

/** Load the grammar `language` names, once; an unknown language resolves without one. */
export const loadLanguage = (language: string): Promise<void> => {
  const id = grammarFor(language);
  if (id === "" || findLanguage(id) !== null) return Promise.resolve();
  const loader = loaders[id];
  if (loader === undefined) return Promise.resolve();
  return loader().then((): void => undefined);
};

/** Whether the grammar `language` names is loaded and ready to tokenize synchronously. */
export const hasLanguage = (language: string): boolean => {
  const id = grammarFor(language);
  return id !== "" && findLanguage(id) !== null;
};
