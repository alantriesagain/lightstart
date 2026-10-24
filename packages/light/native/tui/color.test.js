import { COLOR_DEFAULT, TRUECOLOR_FLAG } from "./style.ts";
import { colorDepth, colorDepthOf, colorSgr, parseColor, setColorDepth, to256 } from "./color.ts";
import { done, eq, eqn } from "../assert.ts";

{
  eqn("a basic name", parseColor("red"), 1);
  eqn("bright plus a name", parseColor("brightblue"), 12);
  eqn("gray is the dark bright black", parseColor("gray"), 8);
  eqn("an index", parseColor("200"), 200);
  eqn("default", parseColor("default"), COLOR_DEFAULT);
  eqn("#rrggbb carries the flag", parseColor("#1a2b3c"), TRUECOLOR_FLAG | 0x1a2b3c);
}

{
  eq("a basic color as fg", colorSgr(1, true), "31");
  eq("a bright color as bg", colorSgr(12, false), "104");
  eq("an index", colorSgr(200, true), "38;5;200");
  eq("default fg", colorSgr(COLOR_DEFAULT, true), "39");
  eq("truecolor fg", colorSgr(TRUECOLOR_FLAG | 0x1a2b3c, true), "38;2;26;43;60");
  eq("truecolor bg", colorSgr(TRUECOLOR_FLAG | 0xffffff, false), "48;2;255;255;255");
}

{
  eqn("pure red is the cube's red", to256(0xff0000), 196);
  eqn("green", to256(0x00ff00), 46);
  eqn("blue", to256(0x0000ff), 21);
  eqn("black is the cube's first cell", to256(0x000000), 16);
  eqn("white its last", to256(0xffffff), 231);
  eqn("a mid gray is on the ramp", to256(0x808080), 244);
  eqn("a dark blue-gray is on the ramp too", to256(0x1a2b3c), 236);
  eqn("a sky blue is in the cube", to256(0x61afef), 75);
}

{
  eq("COLORTERM truecolor", colorDepthOf("truecolor", "xterm-256color", "", ""), "truecolor");
  eq("COLORTERM 24bit", colorDepthOf("24bit", "xterm", "", ""), "truecolor");
  eq("a TERM naming direct color", colorDepthOf("", "xterm-direct", "", ""), "truecolor");
  eq("kitty", colorDepthOf("", "xterm-kitty", "", ""), "truecolor");
  eq("a program known for it", colorDepthOf("", "tmux-256color", "iTerm.app", ""), "truecolor");
  eq("an old screen gets the palette", colorDepthOf("", "screen", "", ""), "256");
  eq("a terminal saying nothing gets the palette", colorDepthOf("", "xterm-256color", "Apple_Terminal", ""), "256");
  eq("LIGHT_COLORS=256 wins over COLORTERM", colorDepthOf("truecolor", "xterm", "", "256"), "256");
  eq("LIGHT_COLORS=truecolor wins over an old TERM", colorDepthOf("", "screen", "", "truecolor"), "truecolor");
  eq("an unknown LIGHT_COLORS is ignored", colorDepthOf("", "screen", "", "millions"), "256");
}

{
  eq("the default depth", colorDepth(), "truecolor");
  setColorDepth("256");
  eq("at 256 a #rrggbb is its nearest palette index", colorSgr(TRUECOLOR_FLAG | 0x1a2b3c, true), "38;5;236");
  eq("as a background too", colorSgr(TRUECOLOR_FLAG | 0x61afef, false), "48;5;75");
  eq("named and indexed colors are unchanged", colorSgr(200, true), "38;5;200");
  setColorDepth("truecolor");
  eq("back to 24-bit", colorSgr(TRUECOLOR_FLAG | 0x1a2b3c, true), "38;2;26;43;60");
}

done();
