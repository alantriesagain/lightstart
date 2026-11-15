/**
 * @file The colors a terminal app draws with, by what they mean, and the one palette the process draws
 * with: the views of the packages read it when they render, and an app sets the fields it wants
 * otherwise at start (the defaults are widecode's look). A file's git marks have a color each.
 */

/** `a` mixed into `b` at `amount` (0 is `b`, 1 is `a`), both `#rrggbb`; `a` when either is not. */
export const mixHex = (a: string, b: string, amount: number): string => {
  const ok = (s: string): boolean => s.length === 7 && s[0] === "#" && !Number.isNaN(parseInt(s.slice(1), 16));
  if (!ok(a) || !ok(b)) return a;
  let out = "#";
  for (let i = 1; i < 7; i += 2) {
    const v = Math.round(parseInt(a.slice(i, i + 2), 16) * amount + parseInt(b.slice(i, i + 2), 16) * (1 - amount));
    out += (v < 16 ? "0" : "") + v.toString(16);
  }
  return out;
};

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

  /** Behind the panes, around their cell borders; a pane a dragged one would drop on. */
  screenBg = "#11111b";
  dropBg = "#2a3a4c";
  /** The panes' accents by id (their cell borders and active tabs), and the one for a pane not named. */
  accents = "chat=#5fd7af code=#7aa2f7 side=#e0af68 tools=#f7768e";
  accent = "#bb9af7";

  /** Pane `id`'s accent. */
  accentOf(id: string): string {
    for (const pair of this.accents.split(" ")) {
      const at = pair.indexOf("=");
      if (at > 0 && pair.slice(0, at) === id) return pair.slice(at + 1);
    }
    return this.accent;
  }

  /** Pane `id`'s background: its accent faintly over `screenBg`, a little stronger while active. */
  tintOf(id: string, active: boolean): string {
    return mixHex(this.accentOf(id), this.screenBg, active ? 0.16 : 0.1);
  }

  /** Pane `id`'s border: the accent while active, else the accent dimmed toward `screenBg`. */
  lineOf(id: string, active: boolean): string {
    return active ? this.accentOf(id) : mixHex(this.accentOf(id), this.screenBg, 0.4);
  }

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
