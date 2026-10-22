/**
 * @bootstrapp/light/native/tui/ansi: the escape sequences the renderer writes.
 */
import { colorSgr } from "./color.ts";
import { ATTR_BOLD, ATTR_DIM, ATTR_INVERSE, ATTR_ITALIC, ATTR_STRIKE, ATTR_UNDERLINE, Style } from "./style.ts";

export const ESC = "\x1b";
export const CSI = "\x1b[";
export const ALT_SCREEN_ON = CSI + "?1049h";
export const ALT_SCREEN_OFF = CSI + "?1049l";
export const CURSOR_HIDE = CSI + "?25l";
export const CURSOR_SHOW = CSI + "?25h";
export const PASTE_ON = CSI + "?2004h";
export const PASTE_OFF = CSI + "?2004l";
export const MOUSE_ON = CSI + "?1000h" + CSI + "?1002h" + CSI + "?1006h";
export const MOUSE_OFF = CSI + "?1006l" + CSI + "?1002l" + CSI + "?1000l";
export const SYNC_START = CSI + "?2026h";
export const SYNC_END = CSI + "?2026l";
export const CLEAR = CSI + "2J";
export const RESET = CSI + "0m";
export const HOME = CSI + "H";
export const TITLE_PUSH = CSI + "22;0t";
export const TITLE_POP = CSI + "23;0t";
/** The sequence that names the terminal's window and tab `text`, its control characters as spaces. */
export const windowTitle = (text: string) => ESC + "]0;" + text.replace(/[\x00-\x1f\x7f]/g, " ") + "\x07";

/**
 * Move the cursor to column `x`, row `y`, both zero-based.
 */
export const cup = (x: number, y: number) => CSI + String(y + 1) + ";" + String(x + 1) + "H";

/**
 * The SGR sequence that turns `prev` into `next`, empty when nothing
 * changes; `prev` null means the terminal's state is unknown.
 */
export const sgrTransition = (prev: Style | null, next: Style) => {
  if (prev !== null && prev.equals(next)) return "";
  const params: string[] = [];
  let full = prev === null;
  if (prev !== null && (prev.attrs & ~next.attrs) !== 0) full = true;
  if (full) {
    params.push("0");
    if (next.has(ATTR_BOLD)) params.push("1");
    if (next.has(ATTR_DIM)) params.push("2");
    if (next.has(ATTR_ITALIC)) params.push("3");
    if (next.has(ATTR_UNDERLINE)) params.push("4");
    if (next.has(ATTR_INVERSE)) params.push("7");
    if (next.has(ATTR_STRIKE)) params.push("9");
    if (next.fg !== -1) params.push(colorSgr(next.fg, true));
    if (next.bg !== -1) params.push(colorSgr(next.bg, false));
  } else {
    const p = prev as Style;
    const added = next.attrs & ~p.attrs;
    if ((added & ATTR_BOLD) !== 0) params.push("1");
    if ((added & ATTR_DIM) !== 0) params.push("2");
    if ((added & ATTR_ITALIC) !== 0) params.push("3");
    if ((added & ATTR_UNDERLINE) !== 0) params.push("4");
    if ((added & ATTR_INVERSE) !== 0) params.push("7");
    if ((added & ATTR_STRIKE) !== 0) params.push("9");
    if (next.fg !== p.fg) params.push(colorSgr(next.fg, true));
    if (next.bg !== p.bg) params.push(colorSgr(next.bg, false));
  }
  return params.length === 0 ? "" : CSI + params.join(";") + "m";
};
