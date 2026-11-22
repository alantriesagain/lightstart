# @lightstart/content

An app's texts as Markdown files rather than JavaScript strings. At build a folder of files
becomes rows: the frontmatter holds the fields, the body becomes plain JSON, and the page draws
that JSON with no Markdown parser and no `innerHTML`.

```ts
// src/models/note.ts
import T from "@lightstart/light/types";
import { defineModel } from "@lightstart/light/model";

export default defineModel("note", {
  title: T.string({ required: true }),
  body: T.array(),
});
```

```md
---
title: First note
tags: [intro, news]
periods:
  - period: 2024
    title: Started
summary: |
  One line,
  another.
---

# A heading

A paragraph with **strong** text.
```

The folder's name is the model's name (`content/note/` fills the `note` model), and one file
is one row. The file name without `.md` fills `slug` when the frontmatter has none. Declare the
body field as `T.array()`: a body is a JSON block list, not a string, and `T.array()` accepts it
while keeping the field in the model's schema.

## Frontmatter

Between two `---` fences, the YAML subset is:

- `key: value` scalars: a bare or quoted string, a number, `true`/`false` or `null`.
- an inline list: `tags: [one, two, three]`.
- a block list of scalars:

  ```md
  tags:
    - one
    - two
  ```

- a block list of flat maps:

  ```md
  periods:
    - period: 2024
      title: Started
    - period: 2025
      title: Continued
  ```

- a `|` literal string, its lines dedented by the first line's indentation.

A line the subset cannot read throws an error naming its line number. A file with no
frontmatter has an empty `data` and its whole text as the body.

## Build: `collect`

```ts
import { collect } from "@lightstart/content/collect";

const rows = collect("content/note", { model: note.schema });
```

`collect(dir, { model? })` reads every `.md` file in `dir`, sorted by name, and answers one row
per file: its frontmatter fields, its `slug`, and its `body` as `ContentBlock[]`. Given
`model`, each row is checked by light's model validation and a field the schema rejects throws,
naming the file and the field. `collectFile(path, { model? })` reads one file the same way.
`collect` and `collectFile` are node-only (`node:fs`); the package's other entries are safe on
the page.

## Page: `renderContent`

```ts
import { renderContent } from "@lightstart/content/render";
import { html } from "@lightstart/light/html";

const body = renderContent(row.body, {
  nodes: {
    code: (node) =>
      node.type === "code"
        ? html`<lc-code-block .code=${node.text} language=${node.info}></lc-code-block>`
        : html``,
  },
});
```

`renderContent(blocks, options?)` answers a light `html` template. It imports no Markdown
parser. Headings get unique slug ids, lists draw task checkboxes, code is
`<pre><code class="language-x">`, tables keep their alignments, footnote references link to the
trailing footnote list. A link or image address goes through `safeUrl`
(`@lightstart/markdown/url`); a refused one writes its text and no `href`/`src`.

- `html: true` writes raw HTML nodes as markup. Without it they are escaped text.
- `nodes` maps a node's `type` to a draw the app owns, as a component tag in the app's own
  source where the components generation sees it. A hook is tried before the default for that
  type.

## The JSON shape

Every node names its `type`. Blocks are `heading`, `paragraph`, `code`, `list`, `quote`,
`rule`, `table`, `html` and `footnotes`; inlines are `text`, `strong`, `em`, `del`, `codeSpan`,
`link`, `image`, `softBreak`, `hardBreak`, `wikiLink`, `footnoteRef` and `inlineHtml`; and a
footnote is `footnoteDefinition`. A table's `header` and `rows` are cells, each cell an inline
node list. A list item is `{ blocks, task, checked }`. The types are exported as `ContentBlock`
and `ContentInline` from the package's root, along with `parseFrontmatter`, `blocksToJson` and
`blockToJson`.

## In an app

An app whose `package.json` depends on `@lightstart/content` gets `.light/content.ts` (or
`.js`), exporting `{ <model>: [rows] }` for every `content/<model>/` folder whose model is in
another store, imported by `.light/app.ts` and seeded before `src/seed`. A folder naming a model
the app does not have is an error naming both. The dev server regenerates on a change under
`content/`.

Content seeds load before `src/seed`, and the two are additive: a model that moved to
`content` should drop its `src/seed` entry, or its rows load twice.

## A content store

For a large catalogue, put the model in a store whose adapter is `content` rather than seeding
it:

```js
// src/app.js
export default defineApp({
  name: "catalogue",
  host: "web",
  stores: {
    main: { adapter: "memory" },
    catalogue: { adapter: "content" },
  },
});
```

```js
// src/models/guide.js
export default defineModel("guide", {
  $store: "catalogue",
  $heavy: ["setup", "cues", "mistakes"],
  title: T.string({ required: true }),
  areas: T.array(),
  setup: T.array(),
  cues: T.array(),
  mistakes: T.array(),
  body: T.array(),
});
```

`@lightstart/content` declares the adapter type in its `package.json`'s
`light.adapters` table, so the generation imports it into the page's entry, or registers it in
a `worker: true` app's worker. The store fetches `<base>/content/<model>.json` once: every row
without the model's `$heavy` fields. It loads those rows into light's memory adapter and
answers every read (`query`, `get`, `count`, ...) through it, so `where`, `order`, `limit`,
`offset`, `fields` and `count` behave exactly as they do in memory. `get(id)` accepts an id or
a slug, fetches `<base>/content/<model>/<slug>.json` for the whole row, heavy fields included,
and caches it. The base is the app's own (`url`/`base`), or the store's `at` when it names
another path. Every write rejects with an error naming the model: the store is read-only.

A model in a `content` store is not seeded through `.light/content`. Instead `light build`
writes `content/<model>.json` and `content/<model>/<slug>.json` into the build folder from the
Markdown, and `light serve` answers the same paths on request, rebuilt from the Markdown each
time with `cache-control: no-store` (no cache, so an edit shows on the next read). Each row is
`collect`ed and validated against the model's schema, and carries `id` and `slug` (the id is the
slug when the frontmatter has none).

Choose the store for a catalogue queried with `where`, `order`, `fields` and `count`, and read
one entry whole by its slug; choose the seed path for a handful of rows a controller reads
whole. light's query language has no full-text search operator: `like` and `ilike` match a
substring, and any richer search belongs in the controller.

## Tests

```bash
light test @lightstart/content
light typecheck @lightstart/content
```
