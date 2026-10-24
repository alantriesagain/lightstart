/**
 * @bootstrapp/light/native/tui/color: color names to numbers and numbers to SGR
 * parameters. A template's `fg="salmon"` fails at its first render rather
 * than painting the default. A `#rrggbb` paints as 24-bit color, or as the
 * nearest cell of the 256-color palette when the terminal announced no more.
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

/** What a `#rrggbb` color is emitted as: 24-bit SGR, or the nearest index of the 256-color palette. */
export type ColorDepth = "truecolor" | "256";

let depth: ColorDepth = "truecolor";

/** Set what `colorSgr` emits for a `#rrggbb`; `Terminal.enter()` sets it from the environment. */
export const setColorDepth = (d: ColorDepth): void => {
  depth = d;
};

export const colorDepth = (): ColorDepth => depth;

const TRUECOLOR_PROGRAMS = ["iTerm.app", "WezTerm", "ghostty", "vscode", "Hyper"];

/**
 * The depth a terminal announces. `forced` (`LIGHT_COLORS`) decides when it says "truecolor" or
 * "256"; else COLORTERM `truecolor` or `24bit`, a TERM naming `truecolor`, `direct` or `kitty`, or
 * a TERM_PROGRAM known to paint 24-bit color mean truecolor, and anything else the 256-color palette.
 */
export const colorDepthOf = (colorterm: string, term: string, termProgram: string, forced: string): ColorDepth => {
  if (forced === "truecolor" || forced === "256") return forced;
  if (colorterm === "truecolor" || colorterm === "24bit") return "truecolor";
  if (term.includes("truecolor") || term.includes("direct") || term.includes("kitty")) return "truecolor";
  if (TRUECOLOR_PROGRAMS.includes(termProgram)) return "truecolor";
  return "256";
};

const CUBE = [0, 95, 135, 175, 215, 255];

const cubeIndex = (v: number): number => {
  let best = 0;
  for (let i = 1; i < CUBE.length; i++) if (Math.abs(CUBE[i] - v) < Math.abs(CUBE[best] - v)) best = i;
  return best;
};

const square = (d: number): number => d * d;

/** The index of the 256-color palette nearest to `rgb`: a cell of the 6x6x6 cube or a step of the gray ramp, whichever is closer. */
export const to256 = (rgb: number): number => {
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;
  const ri = cubeIndex(r);
  const gi = cubeIndex(g);
  const bi = cubeIndex(b);
  const cubeDistance = square(r - CUBE[ri]) + square(g - CUBE[gi]) + square(b - CUBE[bi]);
  const step = Math.min(23, Math.max(0, Math.round(((r + g + b) / 3 - 8) / 10)));
  const gray = 8 + 10 * step;
  const grayDistance = square(r - gray) + square(g - gray) + square(b - gray);
  return grayDistance < cubeDistance ? 232 + step : 16 + 36 * ri + 6 * gi + bi;
};

/**
 * The SGR parameters selecting color `c` as the foreground (`fg` true) or background.
 */
export const colorSgr = (c: number, fg: boolean) => {
  if (c === COLOR_DEFAULT) return fg ? "39" : "49";
  if ((c & TRUECOLOR_FLAG) !== 0) {
    const rgb = c & 0xffffff;
    if (depth === "256") return (fg ? "38;5;" : "48;5;") + String(to256(rgb));
    return (fg ? "38;2;" : "48;2;") + String((rgb >> 16) & 255) + ";" + String((rgb >> 8) & 255) + ";" + String(rgb & 255);
  }
  if (c < 8) return String((fg ? 30 : 40) + c);
  if (c < 16) return String((fg ? 90 : 100) + (c - 8));
  return (fg ? "38;5;" : "48;5;") + String(c);
};
