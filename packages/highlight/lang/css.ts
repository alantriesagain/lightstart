/**
 * @file The CSS grammar, registered when its module loads.
 */
import { cssToken } from "../css.ts";
import { registerGrammar } from "./register.ts";
import { streamLine } from "../line.ts";
import { HlState, Token } from "../state.ts";
import type { Peek } from "../structure.ts";

registerGrammar("css", (text: string, state: HlState, _peek: Peek): Token[] => streamLine(text, state, cssToken));
