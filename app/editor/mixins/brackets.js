/**
 * withBrackets: the pair at the cursor is marked, typing an opener inserts
 * its closer, typing a closer that is already there steps over it, and a
 * backspace between an empty pair removes both.
 */

/** @import { EditorMixinDefinition, Token } from "../types.js" */
import { defineMixin } from "/app/light/view/index.js";
import { autoClosePair, deletesPair, matchBracket, typesOverCloser } from "../brackets.js";
import { mark } from "../decorations.js";
import { lineAt } from "../document.js";

const NOT_CODE = new Set(["string", "comment", "regexp"]);

export const withBrackets = defineMixin(/** @satisfies {EditorMixinDefinition} */ ({
  props: {
    brackets: true,
  },

  connected() {
    this.$own(this.addDecorator(() => this.bracketDecorations()));
    this.$own(this.addInputHandler((/** @type {unknown} */ _editor, /** @type {string} */ text, /** @type {number} */ from, /** @type {number} */ to) => this.autoClose(text, from, to)));
    this.$own(this.addKeymap({ Backspace: () => this.deletePair() }));
  },

  /**
   * @param {number} pos
   * @returns {boolean}
   */
  isCode(pos) {
    const l = lineAt(this.doc, pos);
    const column = pos - l.from;
    const tokens = /** @type {Token[]} */ (this.syntaxLine(l.number).tokens);
    const token = tokens.find((t) => t.from <= column && column < t.to);
    return !token || !NOT_CODE.has(token.type);
  },

  bracketDecorations() {
    if (!this.brackets || !this.selection.empty || !this.hasFocus) return [];
    const match = matchBracket(this.doc, this.selection.head, (pos) => this.isCode(pos));
    if (!match || !match.matched) return [];
    return [mark(match.from, match.from + 1, { class: "ed-bracket" }), mark(match.to, match.to + 1, { class: "ed-bracket" })];
  },

  /**
   * @param {string} text
   * @param {number} from
   * @param {number} to
   * @returns {boolean}
   */
  autoClose(text, from, to) {
    if (!this.brackets || text.length !== 1) return false;
    if (from === to && typesOverCloser(this.doc, from, text)) {
      this.dispatch({ selection: { anchor: from + 1 }, origin: "input" });
      return true;
    }
    if (from !== to) {
      const pair = autoClosePair(this.doc, to, text, { isCode: (pos) => this.isCode(pos) });
      if (!pair) return false;
      const inner = this.sliceString(from, to);
      this.dispatch({ changes: { from, to, insert: pair[0] + inner + pair[1] }, selection: { anchor: from + 1, head: from + 1 + inner.length }, origin: "input" });
      return true;
    }
    const language = this.editorLanguage;
    const pair = autoClosePair(this.doc, from, text, { quotes: language?.name !== "markdown", isCode: (pos) => this.isCode(pos) });
    if (!pair) return false;
    this.dispatch({ changes: { from, insert: pair }, selection: { anchor: from + 1 }, origin: "input", scrollIntoView: true });
    return true;
  },

  /**
   * @returns {boolean}
   */
  deletePair() {
    if (!this.brackets || this.readonly || !this.selection.empty) return false;
    const pos = this.selection.head;
    if (!deletesPair(this.doc, pos) || !this.isCode(pos)) return false;
    this.dispatch({ changes: { from: pos - 1, to: pos + 1 }, selection: { anchor: pos - 1 }, origin: "delete" });
    return true;
  },
}));
