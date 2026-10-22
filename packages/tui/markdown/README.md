# @light/markdown

Markdown as a terminal view draws it, in the palette's colors (`@light/ui`). `markdown.ts` turns a line of prose into styled runs (emphasis, inline code, links, headings, list marks, a code block's lines colored by `@light/highlight`'s tokenizers, carrying the block state between lines); `table.ts` lays a Markdown table out in columns at a width.

Tests: `test/markdown.test.ts` (`light-native test markdown`).
