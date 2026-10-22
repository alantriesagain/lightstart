/**
 * @bootstrapp/light/native/tui/editor: multi-line editing for an input node,
 * grapheme-aware: caret movement (by grapheme, and by word with Alt or Ctrl
 * and ←/→, or Alt+b and Alt+f), insertion, deletion (Ctrl+D forward), the
 * kill keys, paste, and submit. Every edit dispatches a change event through the
 * tree; Enter dispatches submit with the content, cleared first. The operations
 * are exported, so an app can bind its own keys to them; `editorHandleKey` is
 * the default table.
 */
import { ChangeEvent, KeyEvent, SubmitEvent } from "./events.ts";
import { TInput } from "./node.ts";
import { graphemes } from "./width.ts";

const gs = (line: string) => graphemes(line);

const notifyChanged = (input: TInput) => {
  input.invalidate();
  input.dispatch(new ChangeEvent(input.value()));
};

/**
 * Insert text at the caret; newlines split the line.
 */
export const insertText = (input: TInput, text: string) => {
  if (text.length === 0) return;
  const parts = text.split("\n");
  const line = gs(input.lines[input.row]);
  const before = line.slice(0, input.col).join("");
  const after = line.slice(input.col).join("");
  if (parts.length === 1) {
    input.lines[input.row] = before + parts[0] + after;
    input.col += gs(parts[0]).length;
  } else {
    const first = before + parts[0];
    const last = parts[parts.length - 1] + after;
    const middle = parts.slice(1, parts.length - 1);
    const newLines: string[] = [first];
    for (const m of middle) newLines.push(m);
    newLines.push(last);
    input.lines.splice(input.row, 1, ...newLines);
    input.row += parts.length - 1;
    input.col = gs(parts[parts.length - 1]).length;
  }
  notifyChanged(input);
};

export const setValue = (input: TInput, text: string) => {
  input.lines = text.split("\n");
  if (input.lines.length === 0) input.lines = [""];
  input.row = input.lines.length - 1;
  input.col = gs(input.lines[input.row]).length;
  notifyChanged(input);
};

export const clearInput = (input: TInput) => {
  input.lines = [""];
  input.row = 0;
  input.col = 0;
  notifyChanged(input);
};

/** Delete the grapheme before the caret; at a line's start, join the line before. */
export const backspace = (input: TInput) => {
  if (input.col > 0) {
    const line = gs(input.lines[input.row]);
    line.splice(input.col - 1, 1);
    input.lines[input.row] = line.join("");
    input.col--;
    notifyChanged(input);
  } else if (input.row > 0) {
    const prev = input.lines[input.row - 1];
    input.col = gs(prev).length;
    input.lines[input.row - 1] = prev + input.lines[input.row];
    input.lines.splice(input.row, 1);
    input.row--;
    notifyChanged(input);
  }
};

/** Delete the grapheme after the caret; at a line's end, join the next line. */
export const del = (input: TInput) => {
  const line = gs(input.lines[input.row]);
  if (input.col < line.length) {
    line.splice(input.col, 1);
    input.lines[input.row] = line.join("");
    notifyChanged(input);
  } else if (input.row + 1 < input.lines.length) {
    input.lines[input.row] = input.lines[input.row] + input.lines[input.row + 1];
    input.lines.splice(input.row + 1, 1);
    notifyChanged(input);
  }
};

export const moveLeft = (input: TInput) => {
  if (input.col > 0) input.col--;
  else if (input.row > 0) {
    input.row--;
    input.col = gs(input.lines[input.row]).length;
  }
  input.invalidate();
};

export const moveRight = (input: TInput) => {
  const len = gs(input.lines[input.row]).length;
  if (input.col < len) input.col++;
  else if (input.row + 1 < input.lines.length) {
    input.row++;
    input.col = 0;
  }
  input.invalidate();
};

/** Whether grapheme `g` is part of a word: anything but whitespace and ASCII punctuation (`_` is a word's). */
const inWord = (g: string) => {
  if (g.trim().length === 0) return false;
  const c = g.codePointAt(0) ?? 0;
  if (c === 95) return true;
  return !((c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126));
};

/** To the start of the word before the caret; at a line's start, to the end of the line before. */
export const wordLeft = (input: TInput) => {
  if (input.col === 0) return moveLeft(input);
  const line = gs(input.lines[input.row]);
  let i = input.col;
  while (i > 0 && !inWord(line[i - 1])) i--;
  while (i > 0 && inWord(line[i - 1])) i--;
  input.col = i;
  input.invalidate();
};

/** To the end of the word after the caret; at a line's end, to the start of the line after. */
export const wordRight = (input: TInput) => {
  const line = gs(input.lines[input.row]);
  if (input.col >= line.length) return moveRight(input);
  let i = input.col;
  while (i < line.length && !inWord(line[i])) i++;
  while (i < line.length && inWord(line[i])) i++;
  input.col = i;
  input.invalidate();
};

/** Move the caret `delta` lines; false at the first or last line. */
export const moveRow = (input: TInput, delta: number) => {
  const target = input.row + delta;
  if (target < 0 || target >= input.lines.length) return false;
  input.row = target;
  const len = gs(input.lines[input.row]).length;
  if (input.col > len) input.col = len;
  input.invalidate();
  return true;
};

/** The caret to the line's start. */
export const lineStart = (input: TInput) => {
  input.col = 0;
  input.invalidate();
};

/** The caret to the line's end. */
export const lineEnd = (input: TInput) => {
  input.col = gs(input.lines[input.row]).length;
  input.invalidate();
};

/** A new line at the caret. */
export const newline = (input: TInput) => insertText(input, "\n");

/** Kill to the line's start; answers what was killed. */
export const killToStart = (input: TInput) => {
  const line = gs(input.lines[input.row]);
  const killed = line.slice(0, input.col).join("");
  input.lines[input.row] = line.slice(input.col).join("");
  input.col = 0;
  notifyChanged(input);
  return killed;
};

/** Kill to the end of the line; at its end, join the next line (as emacs and bash do). Answers what was killed ("" for a join). */
export const killToEnd = (input: TInput) => {
  const line = gs(input.lines[input.row]);
  let killed = "";
  if (input.col >= line.length && input.row + 1 < input.lines.length) {
    input.lines[input.row] = line.join("") + input.lines[input.row + 1];
    input.lines.splice(input.row + 1, 1);
  } else {
    killed = line.slice(input.col).join("");
    input.lines[input.row] = line.slice(0, input.col).join("");
  }
  notifyChanged(input);
  return killed;
};

/** Delete the word before the caret (spaces separate words); at a line's start, a backspace. Answers what was deleted. */
export const deleteWord = (input: TInput) => {
  const line = gs(input.lines[input.row]);
  if (input.col === 0) {
    backspace(input);
    return "";
  }
  let i = input.col;
  while (i > 0 && line[i - 1] === " ") i--;
  while (i > 0 && line[i - 1] !== " ") i--;
  const deleted = line.slice(i, input.col).join("");
  line.splice(i, input.col - i);
  input.lines[input.row] = line.join("");
  input.col = i;
  notifyChanged(input);
  return deleted;
};

/** Submit the content: the input cleared, then a submit event with it. */
export const submit = (input: TInput) => {
  const v = input.value();
  clearInput(input);
  input.dispatch(new SubmitEvent(v));
};

/**
 * Handle one key; answers whether the editor consumed it.
 */
export const editorHandleKey = (input: TInput, e: KeyEvent) => {
  switch (e.key) {
    case "char": {
      if (e.ctrl)
        switch (e.text) {
          case "a":
            lineStart(input);
            return true;
          case "e":
            lineEnd(input);
            return true;
          case "u":
            killToStart(input);
            return true;
          case "k":
            killToEnd(input);
            return true;
          case "w":
            deleteWord(input);
            return true;
          case "h":
            backspace(input);
            return true;
          case "d":
            del(input);
            return true;
          case "j":
            newline(input);
            return true;
          default:
            return false;
        }

      if (e.alt) {
        if (e.text === "b") wordLeft(input);
        else if (e.text === "f") wordRight(input);
        else return false;
        return true;
      }
      insertText(input, e.text);
      return true;
    }
    case "paste":
      insertText(input, e.text);
      return true;
    case "enter":
      if (e.alt || e.shift) {
        newline(input);
        return true;
      }
      submit(input);
      return true;
    case "backspace":
      backspace(input);
      return true;
    case "delete":
      del(input);
      return true;
    case "left":
      if (e.alt || e.ctrl) wordLeft(input);
      else moveLeft(input);
      return true;
    case "right":
      if (e.alt || e.ctrl) wordRight(input);
      else moveRight(input);
      return true;
    case "up":
      return moveRow(input, -1);
    case "down":
      return moveRow(input, 1);
    case "home":
      lineStart(input);
      return true;
    case "end":
      lineEnd(input);
      return true;
    default:
      return false;
  }
};
