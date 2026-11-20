/**
 * @file The Markdown grammar, registered when its module loads, with the
 * structure reader a synchronous caller can use once it has.
 */
import { fencedLine } from "../line.ts";
import { markdownLine } from "../markdown.ts";
import { registerGrammar } from "./register.ts";
import { setMarkdownStructure } from "../registry.ts";
import { HlState, Token } from "../state.ts";
import type { LineResult, Peek } from "../structure.ts";

const structure = (text: string, state: HlState, peek: Peek): LineResult => markdownLine(text, state, fencedLine, peek);

registerGrammar("markdown", (text: string, state: HlState, peek: Peek): Token[] => structure(text, state, peek).tokens);
setMarkdownStructure(structure);
