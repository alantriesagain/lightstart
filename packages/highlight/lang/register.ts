/**
 * @file Register one built-in grammar from its entry and its line tokenizer,
 * the same way for every language module.
 */
import { grammarEntry } from "../grammar.ts";
import { addLanguage, Language } from "../registry.ts";
import { HlState, Token } from "../state.ts";
import type { Peek } from "../structure.ts";

/** Register grammar `id` with `tokenize`; an entry with no matching grammar is ignored. */
export const registerGrammar = (id: string, tokenize: (text: string, state: HlState, peek: Peek) => Token[]): void => {
  const entry = grammarEntry(id);
  if (entry === null) return;
  const language = new Language(entry.id, entry.extensions, entry.fences, tokenize);
  language.lookAhead = entry.lookAhead;
  language.indentAfter = entry.indentAfter;
  addLanguage(language);
};
