# Working on @lightstart/content

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `frontmatter.ts` | `parseFrontmatter` and the YAML subset |
| `json.ts` | A parsed Markdown body as `ContentBlock[]` |
| `render.ts` | `renderContent`, the page's drawer with no parser |
| `collect.ts` | `collect` (a folder) and `collectFile` (one file) as rows, validated against a schema; node-only |
| `store.ts` | `ContentAdapterType`, the read-only `content` store over light's memory adapter, and `contentAdapterType`; the schema's `$heavy` fields are left out of the list file |
| `node.ts` | The build and dev side: `contentModels` (folders whose model's store names `content`), `contentList`, `contentRow` and `contentFiles` |
| `cli/extend/build.ts` | Writes `content/<model>.json` and `content/<model>/<slug>.json` into the build's outputs |
| `cli/extend/serve.ts` | Answers those paths from the Markdown on each request, `cache-control: no-store` |
| `test/fixtures/catalogue/` | A fixture app with a content store, a `$heavy` model, a folder in another store, and node_modules links |

## Rules

- `frontmatter.ts`, `json.ts`, `render.ts` and `index.ts` stay page-safe; `collect.ts` and `node.ts` may use `node:fs` and are never imported by the page's entry.
- The content adapter answers reads through `@lightstart/app`'s memory adapter; do not write a second query engine. Every write rejects, naming the model and saying the store is read-only.
- List files omit the schema's `$heavy` fields; whole-row files hold everything, and `id` is filled from `slug` when the frontmatter has none.
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
