/**
 * Syntax colouring for `<lc-code-block>`. A host may hand in a tokenizer with
 * `configureHighlight`; without one the snippet is coloured by
 * `@lightstart/highlight`'s built-in languages, whose grammar is loaded the
 * first time the language is asked for, and a language it does not know stays
 * plain.
 */

/** @import { Run } from "../types.ts" */

import { hasLanguage, languageForFence, loadLanguage, tokenizeAll } from "@lightstart/highlight";

/** @type {{ lines: ((code: string, language?: string) => Run[][]) | null }} */
export const highlighter = { lines: null };

/** @param {Partial<typeof highlighter>} options */
export const configureHighlight = (options) => {
  Object.assign(highlighter, options);
};

/**
 * Load the grammar `language` names, calling `onReady` once it can colour. A
 * configured tokenizer, an unknown language, or one already loaded needs no
 * load.
 * @param {string} language
 * @param {() => void} onReady
 */
export const ensureLanguage = (language, onReady) => {
  if (highlighter.lines !== null || hasLanguage(language)) return;
  void loadLanguage(language).then(() => {
    if (hasLanguage(language)) onReady();
  });
};

/**
 * The runs for `code`, plain lines until the grammar has loaded.
 * @param {string} code
 * @param {string} [language]
 * @returns {Run[][]}
 */
export const highlightLines = (code, language) =>
  highlighter.lines?.(code, language) ?? builtIn(code, language) ?? code.split("\n").map((text) => [{ text, type: null }]);

/**
 * The built-in tokenizer's runs for `code`, or null when it does not know `language` or its grammar is not loaded.
 * @param {string} code
 * @param {string} [language]
 * @returns {Run[][] | null}
 */
const builtIn = (code, language) => {
  if (typeof language !== "string" || language.trim() === "") return null;
  if (!hasLanguage(language)) return null;
  const id = languageForFence(language);
  if (id === "") return null;
  const lines = code.split("\n");
  const tokens = tokenizeAll(id, lines);
  return lines.map((text, index) => {
    /** @type {Run[]} */
    const runs = [];
    let at = 0;
    for (const token of tokens[index]) {
      if (token.from > at) runs.push({ text: text.slice(at, token.from), type: null });
      runs.push({ text: text.slice(token.from, token.to), type: token.type });
      at = token.to;
    }
    if (at < text.length) runs.push({ text: text.slice(at), type: null });
    return runs;
  });
};
