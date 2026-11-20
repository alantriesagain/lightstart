/**
 * @file Syntax highlighting for the code column and the chat's code blocks: a line's tokens in the
 * language registered under its id (registry.ts); a browser loads one grammar at a time with
 * `loadLanguage`, while `all.ts` registers every built-in grammar for a synchronous caller. Each
 * token type's color and style are below. A line is tokenized with the state the previous line
 * left.
 */
import { findLanguage, markdownStructureHook } from "./registry.ts";
import { HlState, Token } from "./state.ts";
import { LineResult } from "./structure.ts";
import type { Peek } from "./structure.ts";

export { HlState, Token } from "./state.ts";
export { addLanguage, Language, languageForFence, languageForPath } from "./registry.ts";
export { grammarFor, hasLanguage, loadLanguage } from "./grammar.ts";
export { LineResult, MdBlock, MdLine, MdQuote, MdSpan, Range } from "./structure.ts";
export type { Peek } from "./structure.ts";

/** A line's tokens in `language`, advancing `state` to the next line's; [] for a language not registered (or not loaded yet). */
export const tokenizeLine = (language: string, text: string, state: HlState): Token[] => {
  const l = findLanguage(language);
  return l !== null ? l.tokenizeText(text, state, (_offset: number): string | null => null) : [];
};

/** Every line's tokens, the state carried from line to line, `peek` answering the lines below. */
export const tokenizeAll = (language: string, lines: string[]): Token[][] => {
  const state = new HlState();
  const out: Token[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = findLanguage(language);
    out.push(l !== null ? l.tokenizeText(lines[i], state, (offset: number): string | null => (i + offset >= 0 && i + offset < lines.length ? lines[i + offset] : null)) : []);
  }
  return out;
};

/**
 * A line's tokens and, for `markdown`, its structure; `md` is null for another language or while
 * the Markdown grammar is not loaded (await `loadLanguage("markdown")` first). Like `tokenizeLine`,
 * it advances `state` in place; `peek` answers the line `offset` after this one, null for none.
 */
export const tokenizeLineWithStructure = (language: string, text: string, state: HlState, peek: Peek): LineResult => {
  if (language === "markdown") {
    const structure = markdownStructureHook();
    if (structure !== null) return structure(text, state, peek);
  }
  const l = findLanguage(language);
  return new LineResult(l !== null ? l.tokenizeText(text, state, peek) : [], null);
};

/** The color of a token type (One Dark, as the editor's defaults); "" keeps the text color. */
export const TOKEN_COLORS = new Map<string, string>([
  ["keyword", "#c678dd"],
  ["atom", "#56b6c2"],
  ["number", "#d19a66"],
  ["string", "#98c379"],
  ["comment", "#7f848e"],
  ["property", "#61afef"],
  ["definition", "#e5c07b"],
  ["tag", "#e06c75"],
  ["attribute", "#d19a66"],
  ["regexp", "#56b6c2"],
  ["escape", "#56b6c2"],
  ["meta", "#7f848e"],
  ["heading", "#e06c75"],
  ["strong", "#d19a66"],
  ["emphasis", "#c678dd"],
  ["link", "#61afef"],
  ["url", "#56b6c2"],
  ["list", "#e5c07b"],
  ["quote", "#7f848e"],
  ["code", "#98c379"],
  ["strikethrough", "#7f848e"],
  ["hr", "#7f848e"],
  ["table", "#7f848e"],
]);

/** How a token type is drawn besides its color: "bold", "italic", "underline" or "". */
export const tokenStyle = (type: string): string =>
  type === "heading" || type === "strong"
    ? "bold"
    : type === "emphasis" || type === "quote" || type === "comment" || type === "strikethrough"
      ? "italic"
      : type === "url"
        ? "underline"
        : "";
