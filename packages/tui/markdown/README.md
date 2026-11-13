# @light/markdown

Markdown as a terminal view draws it, in the palette's colors (`@light/ui`), over the one parser in `@lightstart/markdown`. `markdown.ts` draws the parser's tree as styled runs (headings, paragraphs, emphasis, inline code, links, images, wiki links, list marks, quotes, fenced code colored by `@light/highlight`'s tokenizers, raw HTML as text); `table.ts` lays a Markdown table out in columns at a width and re-exports the parser's `Table`, `cells` and `parseTable`.

Tests: `test/markdown.test.ts` (`light-native test @light/markdown`).
