/**
 * @file The HTML grammar, registered when its module loads.
 */
import { htmlToken } from "../html.ts";
import { registerGrammar } from "./register.ts";
import { streamLine } from "../line.ts";
import { HlState, Token } from "../state.ts";
import type { Peek } from "../structure.ts";

registerGrammar("html", (text: string, state: HlState, _peek: Peek): Token[] => streamLine(text, state, htmlToken));
