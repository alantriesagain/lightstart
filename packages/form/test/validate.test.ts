/** @file validateForm and validateRequired: the model's validator on the whole row, its report narrowed to the fields the form shows. */
import { assert, done, same, test } from "./check.ts";
import T from "@lightstart/light/types";
import type { ModelField, ModelSchema } from "@lightstart/light/model/types.ts";
import { validateForm, validateRequired } from "../index.ts";
import type { ModelFormField } from "../index.ts";

/** A `T` descriptor with the keys a test adds (a label, a format, a validator). */
const string = (more: Record<string, unknown> = {}): ModelField => ({ ...T.string(), ...more });
const number = (more: Record<string, unknown> = {}): ModelField => ({ ...T.number(), ...more });

const MODELS: Record<string, ModelSchema> = {
  place: {
    id: string({ required: true }),
    status: string({ required: true }),
    title: string({ required: true, label: "Title" }),
    email: string({ format: "email" }),
    capacity: number(),
    slug: string({ validator: (v: unknown) => String(v).length > 2 }),
  },
};

const FIELDS: ModelFormField[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "email", label: "Email address", type: "text", required: false },
  { name: "capacity", label: "Capacity", type: "number", required: false },
];

test("a generated field the form never showed does not fail the form", () => {
  const { valid, errors } = validateForm(MODELS, "place", { title: "A place" }, FIELDS);
  assert.equal(valid, true, JSON.stringify(errors));
  same(errors, {});
});

test("a declared field that is missing fails, with the label the person read", () => {
  const { valid, errors } = validateForm(MODELS, "place", {}, FIELDS);
  assert.equal(valid, false);
  same(errors, { title: "Title is required" });
});

test("format and type failures come through, keyed to the field", () => {
  const { errors } = validateForm(MODELS, "place", { title: "t", email: "nope", capacity: {} }, FIELDS);
  assert.equal(errors["email"], "Email address must be a valid email");
  assert.equal(errors["capacity"], "Capacity must be of type number");
});

test("a cross-field validator still sees the whole row, it is the report that narrows", () => {
  const models: Record<string, ModelSchema> = {
    place: { title: string(), slug: string({ validator: (v: unknown, row: Record<string, unknown>) => v === row["title"] }) },
  };
  const fields: ModelFormField[] = [{ name: "slug", label: "Slug", type: "text", required: false }];
  assert.equal(validateForm(models, "place", { title: "x", slug: "x" }, fields).valid, true);
  assert.equal(validateForm(models, "place", { title: "x", slug: "y" }, fields).valid, false);
});

test("a nullable field cleared to null passes the model's validation", () => {
  const models: Record<string, ModelSchema> = { repo: { repoUrl: string({ required: true, nullable: true }) } };
  const fields: ModelFormField[] = [{ name: "repoUrl", label: "Repository", type: "text", required: false, nullable: true }];
  const { valid, errors } = validateForm(models, "repo", { repoUrl: null }, fields);
  assert.equal(valid, true, JSON.stringify(errors));
  same(errors, {});
});

test("an unknown model is reported as one, not as a clean pass", () => {
  const { valid, errors } = validateForm(MODELS, "nothing", {}, FIELDS);
  assert.equal(valid, false);
  assert.match(errors["_model"] ?? "", /not found/);
});

test("a form with no model still refuses an empty required field", () => {
  const fields: ModelFormField[] = [
    { name: "name", label: "Your name", type: "text", required: true },
    { name: "themes", label: "Themes", type: "multi-select", required: true },
    { name: "note", label: "Note", type: "textarea", required: false },
  ];
  same(validateRequired({ name: "a", themes: ["x"] }, fields), { valid: true, errors: {} });
  same(validateRequired({ name: "", themes: [] }, fields).errors, { name: "Your name is required", themes: "Themes is required" });
});

done();
