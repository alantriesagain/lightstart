/**
 * @file `@lightstart/form`: the fields a form shows, from a light model's `$form` block, from what
 * its schema implies, or from a variable spec, and the validation of what the form submits.
 */
export { humanizeName, inferFields, inferInput, inputFromName, relationTargets } from "./infer-fields.ts";
export { fieldsForModel, formDefaults } from "./model-fields.ts";
export { varDefault, varKey, variableDefaults, variableFields } from "./variable-fields.ts";
export { validateForm, validateRequired } from "./validate.ts";
export type { FieldErrors, ModelFieldDef, ModelFormBlock, ModelFormField, ModelFormSchema, OptionLabels, VariableFieldOptions, VariableSpec } from "./types.ts";
