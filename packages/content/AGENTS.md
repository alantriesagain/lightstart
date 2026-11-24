# Working on @lightstart/content

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `frontmatter.ts` | `parseFrontmatter` and the YAML subset |
| `json.ts` | A parsed Markdown body as `ContentBlock[]` |
| `render.ts` | `renderContent`, the page's drawer with no parser |
| `collect.ts` | `collect` (a folder), `collectFile` (one file) and `collectLocales` (per-locale overlays) as rows, validated against a schema; node-only |
| `store.ts` | `ContentAdapterType`, the read-only `content` store over light's memory adapter, and `contentAdapterType`; the schema's `$heavy` fields are left out of the list file and its `$private` fields out of every read, per locale through the query's `locale` option |
| `node.ts` | The build and dev side: `contentModels` (folders whose model's store names `content`), `contentList`, `contentRow`, `contentLocales` and `contentFiles` |
| `cli/extend/build.ts` | Writes `content/<model>.json`, `content/<model>/<slug>.json` and their `.<locale>` variants into the build's outputs |
| `cli/extend/serve.ts` | Answers those paths from the sources on each request, `cache-control: no-store` |
| `test/fixtures/catalogue/` | A fixture app with a content store, a `$heavy`/`$localized`/`$private` model, a JSON record with translations, a folder in another store, and node_modules links |

## Rules

- `frontmatter.ts`, `json.ts`, `render.ts` and `index.ts` stay page-safe; `collect.ts` and `node.ts` may use `node:fs` and are never imported by the page's entry.
- The content adapter answers reads through `@lightstart/app`'s memory adapter; do not write a second query engine. Every write rejects, naming the model and saying the store is read-only.
- List files omit the schema's `$heavy` fields; whole-row files hold everything else, `id` is filled from `slug` when the record has none, and both omit the schema's `$private` fields.
- A record is `<slug>.md` or `<slug>.json`; a folder may mix both and the same slug in two files is an error naming both. `<slug>.<locale>.md`/`.json` is a translation overlay (`locale` and `sourceUpdatedAt` are metadata) whose fields count only for the schema's `$localized`; a translation with no record is an error. `.md` translations are supported: frontmatter fields and, when present, the body.
- The build writes the default files and one `<model>.<locale>.json`/`<model>/<slug>.<locale>.json` per locale found, each holding every row overlaid; the store reads the variant matching `QueryOptions.locale` and falls back to the default files when a variant is missing. `get`, `query` and `count` accept the locale on the adapter; `count` has no locale slot in light's store yet, so its caller-facing answer counts default rows.
- A translation's field outside `$localized` is ignored, not an error. `$private` naming a field the model does not declare is an error.
- The base is the running app's `App.base` (so a worker app gets it too), or the store's `at` when it names another path.
- `package.json` declares the adapter with `"light": { "adapters": { "content": "./store.ts#ContentAdapterType" } }`, which the app generation reads. Keep that value in step with the export name.
- A model in a `content` store is never seeded through `.light/content`; `@lightstart/app`'s generation skips it.
- light has no full-text search operator; do not invent one here. `like`/`ilike` work through the memory adapter.
- TypeScript with erasable syntax only; no `any`; comments are a JSDoc module header and JSDoc on exported symbols only.

## Gates

From the repository root:

```bash
light typecheck @lightstart/content
light test @lightstart/content
npx eslint packages/content
```
