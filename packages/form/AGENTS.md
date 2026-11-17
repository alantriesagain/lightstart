# Working on @lightstart/form

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `model-fields.ts` | `fieldsForModel` and `formDefaults`: a `$form` block's fields |
| `infer-fields.ts` | `inferFields`, `inferInput`, `inputFromName`, `humanizeName`, `relationTargets`: what a schema with no block implies |
| `variable-fields.ts` | `variableFields` and its helpers: a variable spec's fields |
| `validate.ts` | `validateForm` over light's `validateRow`, and `validateRequired` |
| `schema.ts` | Reading a schema: its entries narrowed to field definitions, its `$form` block |
| `types.ts` | `ModelFormField` (extending `@lightstart/components`' `FormField`, a type-only edge), `ModelFieldDef`, `VariableSpec` and the rest |
| `test/` | Plain scripts on `@lightstart/test/assert.ts` through `test/check.ts`, run under node and natively, the outputs equal |
| `scripts/pack.js` | What npm gets: JavaScript with a `.d.ts` per module (`npm run pack`, into `dist/`) |

## Rules the sources keep

- A schema is any object, read through `schema.ts`: never require a narrower schema type, so a model's own `ModelSchema` passes.
- `@lightstart/components` is a type-only import: no runtime edge to the components.
- The functions are plain and synchronous, and compile natively: a fallback array is typed (`const names: string[] = … : []`), since an untyped `[]` cannot stand in for a typed one under scriptc.
