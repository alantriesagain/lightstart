/**
 * @file The colors a terminal app draws with, by what they mean, and the one palette the process draws
 * with: the views of the packages read it when they render, and an app sets the fields it wants
 * otherwise at start (the defaults are widecode's look). A file's git marks have a color each.
 */

export class Palette {
  /** Text that steps back: hints, sizes, what a call was given. */
  dim = "gray";
  /** Done and added; failed and removed; running, asking or changed. */
  ok = "#98c379";
  bad = "#e06c75";
  warn = "#e5c07b";
  /** The agent's own work and the session's marks: thinking, compacting, a subagent, a commit. */
  think = "#c678dd";
  /** What can be followed or is shown: headings, links, the shown tab, a renamed file. */
  link = "#61afef";
  /** Code in prose, a command, and a code block's band. */
  code = "#d19a66";
  codeBg = "#1b1d26";
  /** The user's message and its band. */
  promptFg = "#8fc8ff";
  promptBg = "#1a2433";
  /** A message's text (the user's and the agent's reply). */
  messageFg = "#ffffff";
  /** The name in a message's label ("<Me>", "<Claude>"), drawn bold. */
  name = "#61afef";
  /** A selected row, the shown tab, the open file; a row whose change the code column shows. */
  selectedBg = "#2a3550";
  shownBg = "#3a3f58";
  /** A file that changed a moment ago. */
  fresh = "#ffffff";
  /** The status band, and the code column's head and foot. */
  bandBg = "#1e1e2e";
  /** Text inside the columns, and a column's border: the active one's, the others'. */
  paneText = "#d4d4dc";
  activeBorder = "cyan";
  border = "gray";
  /** A change's rows: their bands, line numbers, and a removed line's text. */
  addedBg = "#13301f";
  removedBg = "#3a1c20";
  addedNumber = "#8fbf8f";
  removedNumber = "#b07a80";
  removedText = "#c8a0a4";
  lineNumber = "#7f848e";
  /** The scrollbar: its track, its thumb, the thumb while it is dragged. */
  track = "#4b5263";
  thumb = "#7f848e";
  held = "#abb2bf";

  /** A file's git mark and its color: modified, added, untracked, deleted, renamed, conflicted, and a folder holding changes. */
  markColors(): Map<string, string> {
    const out = new Map<string, string>();
    const marks = ["M", "A", "U", "D", "R", "!", "•"];
    const colors = [this.warn, this.ok, this.ok, this.bad, this.link, this.bad, this.warn];
    for (let i = 0; i < marks.length; i++) out.set(marks[i], colors[i]);
    return out;
  }
}

/** The palette the process draws with. */
export const palette = new Palette();

/** A color as light takes it: "" (inherit) is "default". */
export const colorOr = (c: string): string => (c.length > 0 ? c : "default");
