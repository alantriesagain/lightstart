# @lightstart/markdown

One Markdown parser, in classes: `parse(text)` answers blocks and `parseInline(text)` the inline
nodes inside one. It does no rendering and touches no DOM, so the terminal renderer
(`@light/markdown`) and the browser component (`<lc-markdown>`) draw the same tree.

```js
import { Heading, List, parse } from "@lightstart/markdown";

const blocks = parse("# Title\n\n- one\n- two");
console.log(blocks[0] instanceof Heading); // true
console.log(blocks[1] instanceof List); // true
```

## Blocks

`Heading(level, children, text)`, `Paragraph(children)`, `Code(info, text)` for a fenced block,
`List(ordered, start, items, loose)` with `ListItem(blocks, task, checked)`, `Quote(blocks)`, `Rule`,
`Table(header, aligns, rows)` with cells as text, and `Html(text)` for a raw HTML block.

## Inlines

`Text`, `Strong`, `Em`, `Del`, `CodeSpan`, `Link(href, title, children)`,
`Image(href, title, alt)`, `SoftBreak`, `HardBreak`, `WikiLink(name, display)` and
`InlineHtml`. Every node is a class, so a renderer narrows it with `instanceof`.

## Grammar

CommonMark within a subset: ATX headings, paragraphs with lazy continuation in quotes and list
items, fenced code with three or more backticks or tildes (the closing fence at least as long as
the opening), ordered lists (`1.`, `1)`, `start` from the first item) and task items, nested quotes and lists, GFM pipe
tables, raw HTML blocks ending at a blank line, and link reference definitions collected
document-wide. Inline: backslash escapes, code spans in backtick runs of any length, CommonMark's
delimiter-run algorithm for `*` and `_`, `~~del~~`, links and images with optional titles,
references, `<scheme:...>` and `<email>` autolinks, inline HTML, wiki links, and hard and soft
breaks. Character references stay as written and URLs are not decoded.

Setext headings, indented code blocks, footnotes and bare-URL autolinks are out of scope: their
lines are paragraphs, except that a `---` under a line is a rule after it.

`safeUrl(href)` says whether a renderer may write a link or image address: a relative one, or
`http:`, `https:` or `mailto:`, after decoding character references and dropping whitespace and
control characters, so `java&#x09;script:` is refused. The parser keeps addresses as written.

Quotes and list items nest at most 100 deep (`MAX_NESTING`); past that a marker stays paragraph
text, and inline nesting is bounded by the same cap.

## Gates

```bash
node packages/native/cli/bin/light-native.js test @lightstart/markdown
node packages/native/cli/bin/light-native.js typecheck @lightstart/markdown
```
