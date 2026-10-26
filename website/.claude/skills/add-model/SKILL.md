---
name: add-model
description: Add a model to the project's models/schema.js and regenerate its types
user_invocable: true
---

<!-- Managed by Bootstrapp: generated from bootstrapp/model/skills/add-model.md. Edit the source, then run `bootstrapp types`. -->

# Add a model

## Steps

1. **Gather**: the model name (singular, kebab-case ids, matching the existing schema's convention) and its fields with types.

2. **Scaffold or edit**: `bootstrapp new:model <name> --fields "title:string,done:boolean"` appends a block to `models/schema.js`; edit the file directly for anything richer (hooks, relations, enums, indexes).

3. **Regenerate types**: `bootstrapp types`, then restart `bootstrapp serve`. `$APP.Model.<name>` is typed and `.bootstrapp/schemas.d.ts` exports `<Name>Record`, which `types.ts` re-exports.

4. **Reseed if the data is reference data**: seeds load once, on a fresh database, so bump `bootstrapp.database.version` in `package.json` (or clear site data) after changing what a model is seeded with.

## Schema file shape

```js
import T from "@bootstrapp/light/types";
import { slugHooks } from "@bootstrapp/light/model/slug";

export default {
  post: {
    $hooks: slugHooks("title", "slug"),
    title: T.string({ required: true }),
    slug: T.string({ index: true, immutable: true }),
    content: T.string({ defaultValue: "" }),
    status: T.string({ defaultValue: "draft", enum: ["draft", "published"] }),
    authorId: T.belongs("user"),
    tags: T.array({ defaultValue: [] }),
    createdAt: T.string({ index: true }),
  },
};
```

One default-exported object keyed by model name (`model/schema-shape` enforces it). `T` is imported; the file also loads in plain Node, which is how `bootstrapp types` reads it. No `export const version`: the database version lives in `package.json` under `bootstrapp.database.version`.

## Field types

| Need | Type |
|---|---|
| text | `T.string()` |
| number | `T.number()` |
| flag | `T.boolean({ defaultValue: false })` |
| list, json | `T.array({ defaultValue: [] })`, `T.object({ defaultValue: {} })` |
| date | `T.string({ index: true })`, stamped with `new Date().toISOString()` on write |
| required, indexed, immutable | `{ required: true }`, `{ index: true }`, `{ immutable: true }` |
| enum | `T.string({ enum: ["draft", "published"] })` |
| explicit id | `id: T.string({ required: true })` when the app needs the id before the row exists |

Relations: `T.belongs("user")` (reads `userId`), `T.many("post")`, `T.one("profile")`, `T.belongs_many("tag")`.

## Rules

- A `where` naming an `index: true` field becomes a key-range lookup; index what you filter or order by.
- A `defaultValue` applies on write only, and the generated row type marks the field optional: read it with `?? 0` at the use site or make it `required: true`.
- Hooks live on `$hooks` (`beforeAdd`, `afterAdd`, `beforeEdit` receives the patch, `afterEdit`, `beforeRemove`, `afterRemove`).
- Every method answers the value: `add`/`edit` resolve the stored row and reject on failure (a `ValidationError` carries `.errors`); `getAll` answers `Row[]`, `query` answers `{ rows, total }`.
- A controller keeps rows live by declaring them: `rows: T.array({ sync: $APP.Model.<name>, query: { where, order } })`.
- Every `$APP.Model` write lives in a controller, never in a view (`controller/no-model-writes-in-views`).
- Reference: `examples/centavo/models/schema.js`, `projects/bboxe/models/schema.js`.
