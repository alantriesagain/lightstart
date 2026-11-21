# @lightstart/form

The fields a form shows, from a light model's schema, and the validation of what the form submits. `<lc-form>` in `@lightstart/components` draws a list of fields; this package says which fields: the ones a model's `$form` block names, the ones a schema without a block implies, or the ones a variable spec (a template's or a snippet's inputs) asks for. Then it validates a submit with the model's own rules, reporting only the fields the form showed.

| Function | What |
|---|---|
| `fieldsForModel(schema, { labels? })` | The fields `schema.$form.fields` names, in order; a field's `label`, `placeholder`, `input`, `rows` and `cmsType` come from its `T.*` definition, a `select`'s option labels from `labels`; an array field becomes `type: "array"`, its scalar item an `itemField` and an object item's props `itemFields`; a `nullable` field is optional and clearing it writes `null` |
| `formDefaults(schema)` | The payload defaults `schema.$form.defaults` declares |
| `inferFields(schema, { operation? })` | Every editable field of a schema with no `$form` block, in schema order: `id` and `updatedAt` never, `createdAt` and `immutable` fields only on `"add"` or `"edit"` as they allow; a `nullable` field is optional and clears to `null` |
| `inferInput(def)` | The control a field definition asks for: what it describes first, then what its name suggests |
| `inputFromName(name)`, `humanizeName(name)` | What a name suggests (`email`, `birthDate`, `bio`), and a name as a label (`createdAt` → "Created At") |
| `relationTargets(schema)` | Which model each `relationship` field's options come from |
| `variableFields(spec, options?)`, `variableDefaults(spec)`, `varKey(v)`, `varDefault(v)` | A variable spec as fields (a `list` variable's items as `itemFields`, an importer offered when `onImportClick` is given), its starting values, and a variable's name and default |
| `validateForm(models, model, data, fields, { operation? })` | The model's `validateRow` on the whole row, its errors narrowed to `fields` and keyed to their labels |
| `validateRequired(data, fields)` | The required fields a form checks without a model |

A schema is any object: a light `ModelSchema`, with its `$store` and hooks, or a plain record. Importing `@lightstart/form` also types a `ModelSchema`'s `$form` block, so a model's schema declares it without a cast.

```ts
import T from "@lightstart/light/types";
import { html } from "@lightstart/light/html";
import { fieldsForModel, formDefaults, validateForm } from "@lightstart/form";

const meetup = {
  $form: { fields: ["name", "category", "startsAt"], defaults: { city: "Rio de Janeiro" } },
  name: T.string({ required: true, label: "Meetup name" }),
  category: T.string({ enum: ["meetup", "party"] }),
  startsAt: T.string({ required: true, input: "datetime-local" }),
};
const fields = fieldsForModel(meetup);

/** `<lc-form>` emits `form-submit` with the values; a rejection goes back through its `setErrors`. */
const submit = (event: CustomEvent<Record<string, unknown>>): void => {
  const data = { ...formDefaults(meetup), ...event.detail };
  const { valid, errors } = validateForm({ meetup }, "meetup", data, fields);
  const form = event.currentTarget as HTMLElement & { setErrors(errors: Record<string, string>): void };
  if (!valid) form.setErrors(errors);
};

html`<lc-form .fields=${fields} @form-submit=${submit}></lc-form>`;
```

`validateForm` runs the model's rules on the whole row, so a cross-field validator still sees every field; a generated field the form never showed (`id`, a status) does not fail it. A model the schemas do not have is reported as `_model`.

## Tests

```bash
light test @lightstart/form     # under node and natively, the outputs equal
```
