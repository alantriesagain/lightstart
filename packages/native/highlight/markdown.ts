/**
 * @file Markdown, a line at a time: a block's marker first (a heading's whole line, a quote, a list item's
 * bullet and task box, a rule, a table's pipes), then the inline marks of what follows (code spans,
 * strong and emphasis, links with their targets, bare URLs, HTML tags, escapes). Fenced code is
 * colored in the fence's language with a state of its own; front matter at the top reads as keys
 * and values. Underscores inside a word (snake_case) are not emphasis.
 */
import { HlState, pushToken, Token } from "./state.ts";

const FRONT = /^(---|\.\.\.)\s*$/;
const FRONT_KEY = /^(\s*[\w.-]+)(:)/;
const FENCE = /^(\s{0,3})(`{3,}|~{3,})\s*([^`\s]*)/;
const HEADING = /^\s{0,3}#{1,6}(\s|$)/;
const SETEXT = /^\s{0,3}(=+|-+)\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*[-*_]){2,}\s*$/;
const QUOTE = /^(\s{0,3}>+\s?)/;
const BULLET = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(\[[ xX]\]\s)?/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const CODE_SPAN = /``.*?``|`[^`]*`/y;
const STRONG = /\*\*[^*\s](?:[^*]*?[^*\s])?\*\*|__[^_\s](?:[^_]*?[^_\s])?__/y;
const EM_STAR = /\*[^*\s](?:[^*]*?[^*\s])?\*/y;
const EM_UNDER = /_[^_\s](?:[^_]*?[^_\s])?_/y;
const LINK_TEXT = /!?\[[^\]]*\]/y;
const LINK_TARGET = /\([^)\s]*(?:\s+"[^"]*")?\)|\[[^\]]*\]/y;
const AUTOLINK = /<(?:https?:|mailto:)[^>\s]*>/y;
const URL = /https?:\/\/[^\s<>()[\]]*[^\s<>()[\].,;:!?'"]/y;
const TAG = /<\/?[A-Za-z][\w-]*(?:\s[^<>]*)?\/?>/y;
const ESCAPE = /\\[\\`*_{}[\]()#+\-.!|>~]/y;
const WORD = /[\p{L}\p{N}]/u;

const at = (re: RegExp, text: string, pos: number): number => {
  re.lastIndex = pos;
  const m = re.exec(text);
  return m !== null ? pos + m[0].length : -1;
};

/** The inline marks of `text` from `from`, as tokens (a table's pipes too when `pipes`). */
const inline = (text: string, from: number, tokens: Token[], pipes: boolean): void => {
  let pos = from;
  while (pos < text.length) {
    const ch = text.charAt(pos);
    let end = -1;
    let type = "";
    if (ch === "`") {
      end = at(CODE_SPAN, text, pos);
      type = "string";
    } else if (ch === "\\") {
      end = at(ESCAPE, text, pos);
      type = "escape";
    } else if (ch === "*" || ch === "_") {
      const before = pos > 0 ? text.charAt(pos - 1) : " ";
      if (ch === "*" || !WORD.test(before)) {
        end = at(STRONG, text, pos);
        type = "strong";
        if (end < 0) {
          end = at(ch === "*" ? EM_STAR : EM_UNDER, text, pos);
          type = "emphasis";
        }
        if (end > 0 && ch === "_" && end < text.length && WORD.test(text.charAt(end))) end = -1;
      }
    } else if (ch === "[" || (ch === "!" && text.charAt(pos + 1) === "[")) {
      end = at(LINK_TEXT, text, pos);
      if (end > 0) {
        pushToken(tokens, pos, end, "link");
        const target = at(LINK_TARGET, text, end);
        if (target > 0) pushToken(tokens, end, target, "url");
        pos = target > 0 ? target : end;
        continue;
      }
    } else if (ch === "<") {
      end = at(AUTOLINK, text, pos);
      type = "url";
      if (end < 0) {
        end = at(TAG, text, pos);
        type = "tag";
      }
    } else if (ch === "h") {
      const before = pos > 0 ? text.charAt(pos - 1) : " ";
      if (!WORD.test(before)) {
        end = at(URL, text, pos);
        type = "url";
      }
    } else if (ch === "|" && pipes) {
      end = pos + 1;
      type = "meta";
    }
    if (end > pos) {
      pushToken(tokens, pos, end, type);
      pos = end;
    } else pos++;
  }
};

/**
 * One Markdown line's tokens, advancing `state` (front matter in `mode`, an open fence in `quote`
 * with its language in `rawLang` and that language's state in `inner`). `codeLine` tokenizes a
 * fenced line in its language.
 */
export const markdownLine = (text: string, state: HlState, codeLine: (language: string, text: string, state: HlState) => Token[]): Token[] => {
  const tokens: Token[] = [];
  const first = state.mode === "start";
  if (first) state.mode = "";
  if (state.mode === "front" || (first && FRONT.test(text) && text.startsWith("---"))) {
    if (state.mode === "front" && FRONT.test(text)) state.mode = "";
    else if (first) state.mode = "front";
    else {
      const key = FRONT_KEY.exec(text);
      if (key !== null) {
        pushToken(tokens, 0, key[1].length, "property");
        pushToken(tokens, key[1].length + 1, text.length, "string");
      }
      return tokens;
    }
    pushToken(tokens, 0, text.length, "meta");
    return tokens;
  }
  if (state.quote.length > 0) {
    const close = FENCE.exec(text);
    if (close !== null && close[3].length === 0 && close[2].charAt(0) === state.quote.charAt(0) && close[2].length >= state.quote.length && text.trim() === close[2]) {
      state.quote = "";
      state.inner = null;
      pushToken(tokens, 0, text.length, "meta");
      return tokens;
    }
    const inner = state.inner;
    if (state.rawLang.length > 0 && inner !== null) return codeLine(state.rawLang, text, inner);
    pushToken(tokens, 0, text.length, "string");
    return tokens;
  }
  const fence = FENCE.exec(text);
  if (fence !== null && !(fence[2].charAt(0) === "`" && text.slice(fence[1].length + fence[2].length).includes("`"))) {
    state.quote = fence[2];
    state.rawLang = fence[3].toLowerCase();
    state.inner = new HlState();
    const start = fence[1].length + fence[2].length;
    pushToken(tokens, 0, start, "meta");
    pushToken(tokens, start, text.length, "keyword");
    return tokens;
  }
  if (HEADING.test(text) || (SETEXT.test(text) && text.trim().length > 0 && text.trim().charAt(0) === "=")) {
    pushToken(tokens, 0, text.length, "heading");
    return tokens;
  }
  if (RULE.test(text)) {
    pushToken(tokens, 0, text.length, "meta");
    return tokens;
  }
  if (TABLE_RULE.test(text) && text.includes("|")) {
    pushToken(tokens, 0, text.length, "meta");
    return tokens;
  }
  let pos = 0;
  const quote = QUOTE.exec(text);
  if (quote !== null) {
    pushToken(tokens, 0, quote[1].length, "quote");
    pos = quote[1].length;
  }
  const bullet = BULLET.exec(text.slice(pos));
  if (bullet !== null) {
    const markStart = pos + bullet[1].length;
    const markEnd = markStart + bullet[2].length;
    pushToken(tokens, markStart, markEnd, "list");
    const box = bullet[4];
    const boxStart = markEnd + bullet[3].length;
    if (box !== undefined) pushToken(tokens, boxStart, boxStart + 3, "atom");
    pos = boxStart + (box !== undefined ? box.length : 0);
  }
  let pipes = 0;
  for (let i = pos; i < text.length; i++) if (text.charAt(i) === "|") pipes++;
  const before = tokens.length;
  inline(text, pos, tokens, pipes >= 2);
  if (quote !== null && tokens.length === before) pushToken(tokens, pos, text.length, "quote");
  return tokens;
};
