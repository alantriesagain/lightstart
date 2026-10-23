# @bootstrapp/light/types

`T`: the descriptors a component's `props`, a controller's state and a model's fields are declared with. A descriptor carries its type, whether it reads an attribute, its default, whether a model persists it, and a `validate` method; the shorthand a `props` block allows (`count: 0`, `items: []`) reads a descriptor off the default. `parse` coerces what an attribute, an input or a stored row holds into the declared type.

## Exports

- `T` (default): the factories below
- `parse`, `parsers`: the coercion per type, which a host extends (`parsers.money = ...`)
- `normalizeProperty`, `normalizeProperties`, `isDescriptor`: the shorthand
- `isReactive`, `cloneDefault`: a plain `reactive: false` field, and a field's starting value
- `validateType`: a whole object against a schema

## The `T.*` surface

| | |
|---|---|
| Primitives | `T.any`, `T.string`, `T.number`, `T.boolean`, `T.date`, `T.datetime`, `T.array`, `T.object` |
| Composites | `T.union({ types: [...] })`, `T.function` |
| Relationships | `T.one`, `T.many`, `T.belongs`, `T.belongs_many`, each `(targetModel, foreignKey?, options?)` |
| Registered extensions | `T.timestamp`, `T.file`, `T.files`, added through `registerTypes` like any other |
| Helpers | `T.createType(type, options)`, `T.parse`, `T.validateType`, `T.registerTypes` |

A relationship coerces an object value to its id on validation, so `{ id: "user_123" }` stores
as `"user_123"`. `belongs` and `one` hold one key; `many` and `belongs_many` hold an array.

Options every type takes: `defaultValue` (used when the input is `undefined`, `null` or `""`),
`required` (rejects those same three), and `customValidator`, a function returning `null` on
success or `[errorCode, details]` on failure. Per type: `format` on a string (`"email"` is the
one built-in name; a RegExp or a predicate function also works), `min`/`max` on a number, date
or datetime, `props` on an object (a schema for its own fields), and `itemType` on an
array (a schema each entry is coerced through). A primitive factory's type keeps the `required` and `defaultValue` it was given, which a model's row type reads.

## Validating

`typeDefinition.validate(value)` checks one value and answers
`{ valid, value, error, details }`, where `value` is the coerced result and `error` is a short
code (`"required"`, `"minimum"`, `"invalid"`). A component's property setter uses this one.

```js
T.number({ min: 18 }).validate(10);   // { valid: false, value: 10, error: "minimum", details: null }
```

`T.validateType(object, { schema, row, operation, undefinedProps, validateVirtual })` checks a
whole object against a `Record<string, TypeDefinition>` and answers the tuple
`[errors, validatedObject]`: `errors` is `null` on success, otherwise a field → code map, and
`validatedObject` is `null` on failure and otherwise a new object (the input is never written to). `row` carries the pre-edit state and `operation`
(`"add"`, `"edit"`) reaches a `customValidator` through its context argument. A
`T.timestamp()` field is stamped by `validateType` itself: `update: true` stamps it on every
call, and a `"create"` operation fills it when empty (`create: false` turns that off); a
`customValidator` on the field replaces the stamping;
`undefinedProps: false` validates only the keys the object actually carries, which is what a
partial edit wants. The model's store calls this on every write, and a rejection is the
`ValidationError` that carries `.errors` (`model/README.md`).

## Extending

`T.registerTypes({ types: { name: (options) => TypeDefinition } })` adds a factory to `T`.
This is not a side door: `timestamp`, `file` and `files` ship registered through it, so a new
type is written the same way they are.
