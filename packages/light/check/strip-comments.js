/**
 * Comment strippers that keep offsets: every comment character becomes a
 * space (newlines stay), so a match found in the stripped text points at
 * the same position in the source.
 */

/**
 * The text with every character but a newline replaced by a space.
 * @param {string} text
 */
export const blank = (text) => text.replace(/[^\n]/g, " ");

const STRING_OR_BLOCK = /"(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`|\/\*[\s\S]*?\*\//g;

/**
 * Blank block comments (JSDoc `@example` blocks included) and whole-line
 * `//` comments in JavaScript. A string is read past whole, so a `//` (a URL)
 * or a `/*` (a MIME pattern such as `"image/*"`) inside one is left alone.
 * @param {string} source
 * @returns {string}
 */
export const stripComments = (source) =>
  source.replace(STRING_OR_BLOCK, (match) => (match.startsWith("/*") ? blank(match) : match)).replace(/^[^\S\n]*\/\/.*$/gm, blank);

/**
 * Blank block comments in CSS.
 * @param {string} css
 * @returns {string}
 */
export const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, blank);
