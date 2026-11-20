/** @file fieldsForModel and formDefaults: a model's `$form` block as the fields `<lc-form>` draws. */
import { assert, done, same, test } from "./check.ts";
import { fieldsForModel, formDefaults } from "../index.ts";
import T from "@lightstart/light/types";
import type { ModelSchema } from "@lightstart/light/model";

const MODEL = {
  $adapter: "file",
  $form: {
    label: "Meetup",
    fields: ["name", "category", "startsAt", "excerpt", "ghost"],
    defaults: { city: "Rio de Janeiro" },
  },
  id: { $type: "string", required: true },
  name: { $type: "string", required: true, label: "Meetup name" },
  category: { $type: "string", enum: ["meetup", "party", "other"], label: "Kind" },
  startsAt: { $type: "string", required: true, label: "Starts", input: "datetime-local" },
  excerpt: { $type: "string", input: "textarea", rows: 4, placeholder: "What to bring" },
  members: { $type: "number" },
};

const labelsOf = (options: unknown): unknown[] => (Array.isArray(options) ? options.map((o: unknown) => (typeof o === "object" && o !== null && "label" in o ? o.label : o)) : []);

test("resolves the $form field list in order, dropping unknown names", () => {
  same(fieldsForModel(MODEL).map((f) => f.name), ["name", "category", "startsAt", "excerpt"]);
});

test("maps label, required, input override, rows and placeholder", () => {
  const [name, , startsAt, excerpt] = fieldsForModel(MODEL);
  assert.equal(name?.label, "Meetup name");
  assert.equal(name?.required, true);
  assert.equal(name?.type, "text");
  assert.equal(startsAt?.type, "datetime-local");
  assert.equal(excerpt?.type, "textarea");
  assert.equal(excerpt?.rows, 4);
  assert.equal(excerpt?.placeholder, "What to bring");
  assert.equal(excerpt?.required, false);
});

test("a widget named by cmsType rides the field, for the form to keep its value", () => {
  const [hours] = fieldsForModel({ $form: { label: "Place", fields: ["hours"] }, hours: { $type: "array", label: "Hours", cmsType: "week-hours" } });
  assert.equal(hours?.cmsType, "week-hours");
  assert.equal(fieldsForModel(MODEL)[0]?.cmsType, undefined);
});

test("enum becomes a select with humanized fallback labels", () => {
  const [, category] = fieldsForModel(MODEL);
  assert.equal(category?.type, "select");
  same(category?.options, [
    { value: "meetup", label: "Meetup" },
    { value: "party", label: "Party" },
    { value: "other", label: "Other" },
  ]);
});

test("labels map supports plain strings and {label} catalog objects", () => {
  const labels = { category: { meetup: "Encontro", party: { label: "Festa" } } };
  const [, category] = fieldsForModel(MODEL, { labels });
  same(labelsOf(category?.options), ["Encontro", "Festa", "Other"]);
});

test("humanizes camelCase field names without labels", () => {
  assert.equal(fieldsForModel({ $form: { fields: ["venueName"] }, venueName: { $type: "string" } })[0]?.label, "Venue Name");
});

test("number and boolean types map to their inputs", () => {
  const fields = fieldsForModel({ $form: { fields: ["members", "verified"] }, members: { $type: "number" }, verified: { $type: "boolean" } });
  same(fields.map((f) => f.type), ["number", "checkbox"]);
});

test("a file field renders a file input, and an array of them renders many", () => {
  const fields = fieldsForModel({
    $form: { fields: ["cover", "gallery", "chosen"] },
    cover: { $type: "string", fieldType: "file", label: "Cover" },
    gallery: { $type: "array", fieldType: "file", label: "Gallery" },
    chosen: { $type: "string", fieldType: "file", input: "url", label: "Chosen" },
  });
  same(fields.map((f) => f.type), ["file", "files", "url"]);
});

test("an array of strings gives an itemField named for the array", () => {
  const [tags] = fieldsForModel({ $form: { fields: ["tags"] }, tags: T.array({ itemType: T.string() }) });
  assert.equal(tags?.type, "array");
  assert.equal(tags?.itemField?.name, "tags");
  assert.equal(tags?.itemField?.type, "text");
});

test("an array of objects gives itemFields for the item's props", () => {
  const [links] = fieldsForModel({
    $form: { fields: ["links"] },
    links: T.array({ itemType: T.object({ props: { label: T.string(), count: T.number() } }) }),
  });
  assert.equal(links?.type, "array");
  same(links?.itemFields?.map((f) => [f.name, f.type]), [["label", "text"], ["count", "number"]]);
});

test("a nullable field is drawn optional and carries nullable, so clearing it gives null", () => {
  const [repoUrl] = fieldsForModel({ $form: { fields: ["repoUrl"] }, repoUrl: T.string({ required: true, nullable: true }) });
  assert.equal(repoUrl?.required, false);
  assert.equal(repoUrl?.nullable, true);
});

test("formDefaults returns $form.defaults and is empty-safe", () => {
  same(formDefaults(MODEL), { city: "Rio de Janeiro" });
  same(formDefaults({}), {});
  same(formDefaults(undefined), {});
});

test("multi-select without enum takes options from the labels map", () => {
  const labels = { themes: { food: { label: "Food" }, beaches: "Beaches" } };
  const fields = fieldsForModel({ $form: { fields: ["themes"] }, themes: { $type: "array", input: "multi-select", label: "Themes" } }, { labels });
  assert.equal(fields[0]?.type, "multi-select");
  assert.equal(fields[0]?.itemField, undefined);
  same(fields[0]?.options, [{ value: "food", label: "Food" }, { value: "beaches", label: "Beaches" }]);
});

const TYPED: ModelSchema = {
  $form: { fields: ["title"] },
  title: T.string({ label: "Title" }),
};

test("a ModelSchema declares $form without a cast", () => {
  const [title] = fieldsForModel(TYPED);
  assert.equal(title?.name, "title");
  assert.equal(title?.label, "Title");
});

test("empty-safe on missing $form", () => {
  same(fieldsForModel({}), []);
  same(fieldsForModel(undefined), []);
});

done();
