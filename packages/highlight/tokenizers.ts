/**
 * @file The tokenizers the core has, by the name a languages plugin registers a language with:
 * "javascript", "typescript" (JavaScript's with types), "css", "html" (with the JavaScript and CSS
 * inside it) and "markdown" (its fenced code in the fence's language when one is registered). Each
 * colors one line and carries its state to the next; Markdown also answers the line's structure.
 */
import { cssToken } from "./css.ts";
import { htmlToken } from "./html.ts";
import { jsToken } from "./javascript.ts";
import { markdownLine } from "./markdown.ts";
import type { LineResult, Peek } from "./markdown.ts";
import { findLanguage } from "./registry.ts";
import { HlState, pushToken, Token } from "./state.ts";
import { Stream } from "./stream.ts";

/** The names tokenizerFor knows. */
export const TOKENIZERS = ["javascript", "typescript", "css", "html", "markdown"];

/** A line through a token-at-a-time tokenizer (`step` answers the token type at the stream). */
const streamLine = (text: string, state: HlState, step: (stream: Stream, state: HlState) => string): Token[] => {
  const tokens: Token[] = [];
  const stream = new Stream(text, 0, text.length);
  while (!stream.eol()) {
    stream.start = stream.pos;
    const type = step(stream, state);
    if (stream.pos === stream.start) stream.pos++;
    if (type.length > 0) pushToken(tokens, stream.start, stream.pos, type);
  }
  return tokens;
};

/** A fenced line in its registered language, or as code when none answers to it. */
export const fencedLine = (language: string, text: string, state: HlState, peek: Peek): Token[] => {
  const l = findLanguage(language);
  if (l !== null) return l.tokenizeText(text, state, peek);
  const tokens: Token[] = [];
  pushToken(tokens, 0, text.length, "code");
  return tokens;
};

/** A Markdown line's tokens and structure. */
export const markdownStructure = (text: string, state: HlState, peek: Peek): LineResult => markdownLine(text, state, fencedLine, peek);

/** The tokenizer named `name`; null for none. */
export const tokenizerFor = (name: string): ((text: string, state: HlState, peek: Peek) => Token[]) | null => {
  switch (name) {
    case "javascript":
      return (text: string, state: HlState, _peek: Peek) => streamLine(text, state, (s: Stream, st: HlState) => jsToken(s, st, false));
    case "typescript":
      return (text: string, state: HlState, _peek: Peek) => streamLine(text, state, (s: Stream, st: HlState) => jsToken(s, st, true));
    case "css":
      return (text: string, state: HlState, _peek: Peek) => streamLine(text, state, cssToken);
    case "html":
      return (text: string, state: HlState, _peek: Peek) => streamLine(text, state, htmlToken);
    case "markdown":
      return (text: string, state: HlState, peek: Peek) => markdownStructure(text, state, peek).tokens;
  }
  return null;
};
