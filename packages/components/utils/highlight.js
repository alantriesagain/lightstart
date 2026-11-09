/**
 * Syntax colouring for `<lc-code-block>`, handed in by the host. Light draws a
 * snippet as plain lines until something configures a tokenizer; in a
 * Bootstrapp app `@bootstrapp/editor` does at boot, so a snippet and the same
 * text open in `<editor-code>` colour identically.
 */

/** @import { Run } from "../types.ts" */

/** @type {{ lines: ((code: string, language?: string) => Run[][]) | null }} */
export const highlighter = { lines: null };

/** @param {Partial<typeof highlighter>} options */
export const configureHighlight = (options) => {
  Object.assign(highlighter, options);
};

/**
 * @param {string} code
 * @param {string} [language]
 * @returns {Run[][]}
 */
export const highlightLines = (code, language) =>
  highlighter.lines?.(code, language) ?? code.split("\n").map((text) => [{ text, type: null }]);
