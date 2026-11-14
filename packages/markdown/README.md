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

`Heading(level, children, text)`, `Paragraph(children)`, `Code(info, text)` for a fenced or
indented block, `List(ordered, start, items, loose)` with `ListItem(blocks, task, checked)`,
`Quote(blocks)`, `Rule`, `Table(header, aligns, rows)` with cells as text, `Html(text)` for a raw
HTML block, and `Footnotes(items)` with `FootnoteDefinition(label, number, blocks)` for the
referenced footnotes. `parse` appends that one `Footnotes` block last, in reference order, only
for definitions a `[^label]` reference actually reached; the renderers read it from there rather
than from a second map.

## Inlines

`Text`, `Strong`, `Em`, `Del`, `CodeSpan`, `Link(href, title, children)`,
`Image(href, title, alt)`, `SoftBreak`, `HardBreak`, `WikiLink(name, display)`,
`FootnoteRef(label, number)` and `InlineHtml`. Every node is a class, so a renderer narrows it
with `instanceof`.

## Grammar

CommonMark within a subset: ATX and setext headings, paragraphs with lazy continuation in quotes
and list items, fenced code with three or more backticks or tildes (the closing fence at least as
long as the opening), indented code blocks, ordered lists (`1.`, `1)`, `start` from the first
item) and task items, nested quotes and lists, GFM pipe tables, raw HTML blocks ending at a blank
line, link reference definitions collected document-wide, and GFM footnotes. Inline: backslash
escapes, code spans in backtick runs of any length, CommonMark's delimiter-run algorithm for `*`
and `_`, `~~del~~`, links and images with optional titles, references, `<scheme:...>` and
`<email>` autolinks, GFM extended autolinks for bare `http://`, `https://`, `www.` and email
addresses, inline HTML, wiki links, footnote references, and hard and soft breaks. Character
references stay as written and URLs are not decoded.

A setext underline turns the paragraph above it into a heading; `---` on its own after a blank
line is still a rule. Four spaces of indentation start a code block unless the line continues a
paragraph, and inside a list item indentation counts from the item's content. A footnote
definition is `[^label]: text`, its body continues on lines indented at least two spaces, and its
label is looked up case-insensitively; the first reference numbers it, and an undefined reference
stays text. Extended autolinks stop at whitespace or `<` and drop GFM's trailing punctuation.

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
