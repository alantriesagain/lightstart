/**
 * @file The JavaScript grammar, registered when its module loads.
 */
import { jsToken } from "../javascript.ts";
import { registerGrammar } from "./register.ts";
import { streamLine } from "../line.ts";
import { HlState, Token } from "../state.ts";
import type { Peek } from "../structure.ts";

registerGrammar("javascript", (text: string, state: HlState, _peek: Peek): Token[] => streamLine(text, state, (stream, current) => jsToken(stream, current, false)));
