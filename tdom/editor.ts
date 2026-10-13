/**
 * @bootstrapp/light/tdom/editor: multi-line editing for an input node,
 * grapheme-aware: caret movement, insertion, deletion, the kill keys,
 * paste, and submit. Every edit dispatches a change event through the
 * tree; Enter dispatches submit with the content, cleared first.
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

const backspace = (input: TInput) => {
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

const del = (input: TInput) => {
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

const moveLeft = (input: TInput) => {
  if (input.col > 0) input.col--;
  else if (input.row > 0) {
    input.row--;
    input.col = gs(input.lines[input.row]).length;
  }
  input.invalidate();
};

const moveRight = (input: TInput) => {
  const len = gs(input.lines[input.row]).length;
  if (input.col < len) input.col++;
  else if (input.row + 1 < input.lines.length) {
    input.row++;
    input.col = 0;
  }
  input.invalidate();
};

const moveRow = (input: TInput, delta: number) => {
  const target = input.row + delta;
  if (target < 0 || target >= input.lines.length) return false;
  input.row = target;
  const len = gs(input.lines[input.row]).length;
  if (input.col > len) input.col = len;
  input.invalidate();
  return true;
};

const killToStart = (input: TInput) => {
  const line = gs(input.lines[input.row]);
  input.lines[input.row] = line.slice(input.col).join("");
  input.col = 0;
  notifyChanged(input);
};

const killToEnd = (input: TInput) => {
  const line = gs(input.lines[input.row]);
  input.lines[input.row] = line.slice(0, input.col).join("");
  notifyChanged(input);
};

const deleteWord = (input: TInput) => {
  const line = gs(input.lines[input.row]);
  if (input.col === 0) {
    backspace(input);
    return;
  }
  let i = input.col;
  while (i > 0 && line[i - 1] === " ") i--;
  while (i > 0 && line[i - 1] !== " ") i--;
  line.splice(i, input.col - i);
  input.lines[input.row] = line.join("");
  input.col = i;
  notifyChanged(input);
};

const submit = (input: TInput) => {
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
            input.col = 0;
            input.invalidate();
            return true;
          case "e":
            input.col = gs(input.lines[input.row]).length;
            input.invalidate();
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
          case "j":
            insertText(input, "\n");
            return true;
          default:
            return false;
        }

      if (e.alt) return false;
      insertText(input, e.text);
      return true;
    }
    case "paste":
      insertText(input, e.text);
      return true;
    case "enter":
      if (e.alt || e.shift) {
        insertText(input, "\n");
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
      moveLeft(input);
      return true;
    case "right":
      moveRight(input);
      return true;
    case "up":
      return moveRow(input, -1);
    case "down":
      return moveRow(input, 1);
    case "home":
      input.col = 0;
      input.invalidate();
      return true;
    case "end":
      input.col = gs(input.lines[input.row]).length;
      input.invalidate();
      return true;
    default:
      return false;
  }
};
