import { DEFAULT_STYLE, InlineRun, graphemeWidth, graphemes, lineText, stringWidth, wrapRuns } from "./index.js";
import { done, eq, eqn } from "./assert.js";

eq("ascii graphemes", graphemes("ab c").join("|"), "a|b| |c");
eqn("combining mark is one grapheme", graphemes("éx").length, 2);
eqn("emoji + VS16", graphemes("❤️!").length, 2);
eqn("ZWJ family", graphemes("\u{1F468}‍\u{1F469}‍\u{1F467}").length, 1);
eqn("flag pair", graphemes("\u{1F1E7}\u{1F1F7}").length, 1);

eqn("ascii width", stringWidth("hello"), 5);
eqn("control is zero", stringWidth("a\tb"), 2);
eqn("accented latin", stringWidth("héllo"), 5);
eqn("combining mark", graphemeWidth("é"), 1);
eqn("cjk wide", stringWidth("日本"), 4);
eqn("hangul wide", stringWidth("한"), 2);
eqn("emoji wide", graphemeWidth("\u{1F600}"), 2);
eqn("heart + VS16 is wide", graphemeWidth("❤️"), 2);
eqn("bare heart is narrow", graphemeWidth("❤"), 1);
eqn("ZWJ family wide", graphemeWidth("\u{1F468}‍\u{1F469}‍\u{1F467}"), 2);
eqn("flag wide", graphemeWidth("\u{1F1E7}\u{1F1F7}"), 2);
eqn("skin tone", graphemeWidth("\u{1F44D}\u{1F3FD}"), 2);
eqn("fullwidth latin", stringWidth("Ａ"), 2);
eqn("box drawing narrow", stringWidth("─│"), 2);
eqn("mixed", stringWidth("a日b\u{1F600}"), 6);

const s = DEFAULT_STYLE;
/**
 * @param {string} text
 * @param {number} width
 * @param {string} mode
 */
const lines = (text, width, mode) => wrapRuns([new InlineRun(text, s)], width, mode).map(lineText).join("|");
eq("word wrap", lines("the quick brown fox", 9, "word"), "the quick|brown fox");
eq("word wrap drops break space", lines("aaa bbb", 3, "word"), "aaa|bbb");
eq("long word char-breaks", lines("abcdefghij", 4, "word"), "abcd|efgh|ij");
eq("char wrap", lines("abcdef", 4, "char"), "abcd|ef");
eq("newline breaks", lines("a\nb\n\nc", 10, "word"), "a|b||c");
eq("none mode keeps lines", lines("abcdefgh\nij", 3, "none"), "abcdefgh|ij");
eq("wide chars wrap by cells", lines("日本語", 4, "char"), "日本|語");
eq("space at boundary", lines("ab cd", 2, "word"), "ab|cd");
eq("trailing space kept inside width", lines("ab ", 5, "word"), "ab ");
eq("empty text", lines("", 5, "word"), "");
eq("multiple runs", wrapRuns([new InlineRun("hello ", s), new InlineRun("world", s)], 20, "word").map(lineText).join("|"), "hello world");
eqn("line width", wrapRuns([new InlineRun("a日", s)], 20, "word")[0].width, 3);
eq("width 0 wraps at 1", lines("abc", 0, "char"), "a|b|c");

done();
