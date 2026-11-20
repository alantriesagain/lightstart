/**
 * @file The TypeScript grammar, JavaScript's with its own keywords, registered when its module loads.
 */
import { jsToken } from "../javascript.ts";
import { registerGrammar } from "./register.ts";
import { streamLine } from "../line.ts";
import { HlState, Token } from "../state.ts";
import type { Peek } from "../structure.ts";

registerGrammar("typescript", (text: string, state: HlState, _peek: Peek): Token[] => streamLine(text, state, (stream, current) => jsToken(stream, current, true)));
