/**
 * @file The tokenizers the core has, by the name a languages plugin registers a language with:
 * "javascript", "typescript" (JavaScript's with types), "css", "html" (with the JavaScript and CSS
 * inside it) and "markdown" (its fenced code in the fence's language when one is registered). Each
 * colors one line and carries its state to the next.
 */
import { cssToken } from "./css.ts";
import { htmlToken } from "./html.ts";
import { jsToken } from "./javascript.ts";
import { markdownLine } from "./markdown.ts";
import { findLanguage, languageForFence } from "./registry.ts";
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

/** A fenced line in Markdown: in the fence's language when one is registered, else as code. */
const fencedLine = (fence: string, text: string, state: HlState): Token[] => {
  const l = findLanguage(languageForFence(fence));
  if (l !== null) return l.tokenizeText(text, state);
  const tokens: Token[] = [];
  pushToken(tokens, 0, text.length, "string");
  return tokens;
};

/** The tokenizer named `name`; null for none. */
export const tokenizerFor = (name: string): ((text: string, state: HlState) => Token[]) | null => {
  switch (name) {
    case "javascript":
      return (text: string, state: HlState) => streamLine(text, state, (s: Stream, st: HlState) => jsToken(s, st, false));
    case "typescript":
      return (text: string, state: HlState) => streamLine(text, state, (s: Stream, st: HlState) => jsToken(s, st, true));
    case "css":
      return (text: string, state: HlState) => streamLine(text, state, cssToken);
    case "html":
      return (text: string, state: HlState) => streamLine(text, state, htmlToken);
    case "markdown":
      return (text: string, state: HlState) => markdownLine(text, state, fencedLine);
  }
  return null;
};
