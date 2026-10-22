# @light/highlight

Syntax coloring for terminal views, with nothing of light in it: a tokenizer colors one line at a time and carries a state (`HlState`) into the next, so a view colors only the lines it draws. `tokenizeLine` and `tokenizeAll` (`index.ts`) answer tokens with a style each (`TOKEN_COLORS`, One Dark); the tokenizers (`javascript.ts`, `css.ts`, `html.ts`, `markdown.ts`) are found by id through `tokenizers.ts`; `registry.ts` maps file extensions and fence names to languages (`addLanguage`, `languageForPath`, `languageForFence`, `removeLanguages(owner)` for a plugin's), and `languages.ts` holds the built-in set an app registers at start (`registerLanguages`).

Tests: `test/highlight.test.ts`, under node and natively (`light-native test highlight`).
