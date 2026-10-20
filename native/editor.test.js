import { EventBinding } from "../html/parts.ts";
import { ChangeEvent, KeyEvent, SubmitEvent, TInput, deleteWord, editorHandleKey, killToEnd, killToStart, lineEnd, lineStart, moveRow, newline, setValue, wordLeft } from "./index.ts";
import { done, eq, eqn, ok } from "./assert.js";

/**
 * @param {string} name
 * @param {string} text
 * @param {boolean} ctrl
 * @param {boolean} alt
 * @param {boolean} shift
 */
const key = (name, text, ctrl, alt, shift) => new KeyEvent(name, text, ctrl, alt, shift);
/**
 * @param {TInput} input
 * @param {string} s
 */
const type = (input, s) => {
  for (const ch of s) editorHandleKey(input, key("char", ch, false, false, false));
};
/** @param {TInput} input */
const state = (input) => JSON.stringify(input.lines) + " @" + String(input.row) + ":" + String(input.col);

const input = new TInput("input");
/** @type {string[]} */
const changes = [];
/** @type {string[]} */
const submits = [];
const onChange = new EventBinding(input, "change", undefined);
onChange.commit((/** @type {ChangeEvent} */ e) => {
  changes.push(e.value);
});
const onSubmit = new EventBinding(input, "submit", undefined);
onSubmit.commit((/** @type {SubmitEvent} */ e) => {
  submits.push(e.value);
});

type(input, "héllo");
eq("typing", state(input), '["héllo"] @0:5');
editorHandleKey(input, key("char", "\u{1F600}", false, false, false));
editorHandleKey(input, key("char", "é", false, false, false));
eq("graphemes count as one column", state(input), '["héllo\u{1F600}é"] @0:7');
editorHandleKey(input, key("backspace", "", false, false, false));
editorHandleKey(input, key("backspace", "", false, false, false));
eq("backspace removes whole graphemes", state(input), '["héllo"] @0:5');
editorHandleKey(input, key("left", "", false, false, false));
editorHandleKey(input, key("left", "", false, false, false));
type(input, "X");
eq("insert mid-line", state(input), '["hélXlo"] @0:4');
editorHandleKey(input, key("delete", "", false, false, false));
eq("delete forward", state(input), '["hélXo"] @0:4');
editorHandleKey(input, key("home", "", false, false, false));
eq("home", state(input), '["hélXo"] @0:0');
editorHandleKey(input, key("end", "", false, false, false));
eq("end", state(input), '["hélXo"] @0:5');
editorHandleKey(input, key("enter", "", false, true, false));
type(input, "second");
eq("alt+enter newline", state(input), '["hélXo","second"] @1:6');
editorHandleKey(input, key("char", "j", true, false, false));
eq("ctrl+j newline", state(input), '["hélXo","second",""] @2:0');
editorHandleKey(input, key("up", "", false, false, false));
eq("up keeps column clamped", state(input), '["hélXo","second",""] @1:0');
editorHandleKey(input, key("end", "", false, false, false));
editorHandleKey(input, key("up", "", false, false, false));
eq("up clamps to shorter line", state(input), '["hélXo","second",""] @0:5');
editorHandleKey(input, key("down", "", false, false, false));
editorHandleKey(input, key("down", "", false, false, false));
ok("down past last line is not consumed", !editorHandleKey(input, key("down", "", false, false, false)));
editorHandleKey(input, key("backspace", "", false, false, false));
eq("backspace at line start joins", state(input), '["hélXo","second"] @1:6');
editorHandleKey(input, key("char", "w", true, false, false));
eq("ctrl+w deletes word", state(input), '["hélXo",""] @1:0');
editorHandleKey(input, key("backspace", "", false, false, false));
editorHandleKey(input, key("char", "a", true, false, false));
type(input, "ab ");
eq("ctrl+a then insert", state(input), '["ab hélXo"] @0:3');
editorHandleKey(input, key("char", "k", true, false, false));
eq("ctrl+k kills to end", state(input), '["ab "] @0:3');
editorHandleKey(input, key("char", "u", true, false, false));
eq("ctrl+u kills to start", state(input), '[""] @0:0');
editorHandleKey(input, key("paste", "one\ntwo\r\nthree", false, false, false));
eq("paste with newlines", state(input), '["one","two\\r","three"] @2:5');
editorHandleKey(input, key("char", "e", true, false, false));
editorHandleKey(input, key("enter", "", false, false, false));
eq("submit clears", state(input), '[""] @0:0');
editorHandleKey(input, key("paste", "ab\ncd", false, false, false));
editorHandleKey(input, key("up", "", false, false, false));
editorHandleKey(input, key("char", "k", true, false, false));
eq("ctrl+k at a line's end joins the next", state(input), '["abcd"] @0:2');
editorHandleKey(input, key("char", "u", true, false, false));
editorHandleKey(input, key("char", "k", true, false, false));
eq("submitted value", submits.join("|"), "one\ntwo\r\nthree");
ok("change events fired", changes.length > 10);
eqn("value of empty", input.value().length, 0);
ok("unhandled key returns false", !editorHandleKey(input, key("f5", "", false, false, false)));
editorHandleKey(input, key("char", "x", false, true, false));
eq("alt+char ignored", state(input), '[""] @0:0');

editorHandleKey(input, key("paste", "git commit -m fix_bug\nnext", false, false, false));
input.row = 0;
input.col = 21;
/** @type {string[]} */
const at = [];
for (const name of ["left", "left", "left", "right", "right"]) {
  editorHandleKey(input, key(name, "", false, true, false));
  at.push(String(input.row) + ":" + String(input.col));
}
eq("alt+left and alt+right move by a word", at.join(" "), "0:14 0:12 0:4 0:10 0:13");
editorHandleKey(input, key("char", "b", false, true, false));
editorHandleKey(input, key("char", "b", false, true, false));
editorHandleKey(input, key("char", "f", false, true, false));
eq("alt+b and alt+f too", String(input.row) + ":" + String(input.col), "0:10");
input.col = 21;
editorHandleKey(input, key("right", "", true, false, false));
eq("ctrl+right at a line's end goes to the next line", String(input.row) + ":" + String(input.col), "1:0");
editorHandleKey(input, key("left", "", true, false, false));
eq("ctrl+left at a line's start goes to the end of the line before", String(input.row) + ":" + String(input.col), "0:21");
input.col = 10;
editorHandleKey(input, key("char", "d", true, false, false));
eq("ctrl+d deletes forward", input.lines[0], "git commit-m fix_bug");
input.col = 20;
editorHandleKey(input, key("char", "d", true, false, false));
eq("at a line's end it joins the next", JSON.stringify(input.lines), '["git commit-m fix_bugnext"]');

setValue(input, "one two three");
lineStart(input);
wordLeft(input);
eq("lineStart, wordLeft at the start stays", state(input), '["one two three"] @0:0');
lineEnd(input);
eq("killToEnd at the end of the last line kills nothing", killToEnd(input), "");
eq("deleteWord answers the word", deleteWord(input), "three");
eq("killToStart answers what it killed", killToStart(input) + " | " + state(input), 'one two  | [""] @0:0');
newline(input);
ok("newline, and moveRow is false past the edge", state(input) === '["",""] @1:0' && moveRow(input, -1) && !moveRow(input, -1));

done();
