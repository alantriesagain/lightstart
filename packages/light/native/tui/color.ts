/**
 * @bootstrapp/light/native/tui/color: color names to numbers and numbers to SGR
 * parameters. A template's `fg="salmon"` fails at its first render rather
 * than painting the default.
 */
import { COLOR_DEFAULT, TRUECOLOR_FLAG } from "./style.ts";

const BASIC = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

const hexDigit = (ch: string) => {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 97 && c <= 102) return c - 87;
  if (c >= 65 && c <= 70) return c - 55;
  return -1;
};

/**
 * The number for a color written as "default", a basic name, "bright" plus
 * a name, "gray", "#rrggbb" or an index "0".."255". Throws on anything else.
 */
export const parseColor = (input: string) => {
  const s = input.trim().toLowerCase();
  if (s === "" || s === "default" || s === "none") return COLOR_DEFAULT;
  if (s === "gray" || s === "grey") return 8;
  const basic = BASIC.indexOf(s);
  if (basic >= 0) return basic;
  if (s.startsWith("bright")) {
    const b = BASIC.indexOf(s.slice(6));
    if (b >= 0) return b + 8;
  }
  if (s.startsWith("#") && s.length === 7) {
    let rgb = 0;
    for (let i = 1; i < 7; i++) {
      const d = hexDigit(s[i]);
      if (d < 0) throw new Error("[tdom] invalid color: " + input);
      rgb = rgb * 16 + d;
    }
    return TRUECOLOR_FLAG | rgb;
  }
  let n = 0;
  let digits = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) {
      digits = -1;
      break;
    }
    n = n * 10 + (c - 48);
    digits++;
  }
  if (digits > 0 && n <= 255) return n;
  throw new Error("[tdom] invalid color: " + input);
};

/**
 * The SGR parameters selecting color `c` as the foreground (`fg` true) or background.
 */
export const colorSgr = (c: number, fg: boolean) => {
  if (c === COLOR_DEFAULT) return fg ? "39" : "49";
  if ((c & TRUECOLOR_FLAG) !== 0) {
    const rgb = c & 0xffffff;
    return (fg ? "38;2;" : "48;2;") + String((rgb >> 16) & 255) + ";" + String((rgb >> 8) & 255) + ";" + String(rgb & 255);
  }
  if (c < 8) return String((fg ? 30 : 40) + c);
  if (c < 16) return String((fg ? 90 : 100) + (c - 8));
  return (fg ? "38;5;" : "48;5;") + String(c);
};
