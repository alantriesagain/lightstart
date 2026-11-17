/** @file variableFields: a variable spec's type words as the form's, a list's items one level down, an importer only when the caller handles one. */
import { assert, done, same, test } from "./check.ts";
import { varDefault, varKey, variableDefaults, variableFields } from "../index.ts";
import type { ModelFormField, VariableSpec } from "../index.ts";

const SPEC: VariableSpec[] = [
  { id: "title", label: "Title", type: "text", placeholder: "A name", required: true },
  { key: "body", label: "Body", type: "longtext", help: "Markdown is fine" },
  { id: "count", label: "Count", type: "number", default: 2, min: 1, max: 9, step: 1 },
  { id: "live", label: "Live", type: "boolean", defaultValue: false },
  { id: "tone", label: "Tone", type: "select", options: [{ value: "warm", label: "Warm" }] },
  { id: "places", label: "Places", type: "list", dataImporter: "csv", itemSchema: [{ id: "name", label: "Name", type: "text" }, { id: "note", type: "longtext" }] },
];

const byName = (fields: ModelFormField[]): Record<string, ModelFormField> => Object.fromEntries(fields.map((f) => [f.name, f]));

test("either spelling names the variable, and either gives its default", () => {
  assert.equal(varKey({ id: "a" }), "a");
  assert.equal(varKey({ key: "b" }), "b");
  assert.equal(varKey({}), "", "a variable with neither has no name");
  assert.equal(varDefault({ default: 1 }), 1);
  assert.equal(varDefault({ defaultValue: 2 }), 2);
  assert.equal(varDefault({ default: 1, defaultValue: 2 }), 2, "defaultValue wins when both are given");
});

test("the starting values a spec declares", () => {
  same(variableDefaults(SPEC), { title: undefined, body: undefined, count: 2, live: false, tone: undefined, places: undefined });
  same(variableDefaults(), {});
  same(variableDefaults([{ label: "no key" }]), {}, "a variable with no key has no value");
});

test("a spec's type words become the form's", () => {
  const by = byName(variableFields(SPEC));
  same(["title", "body", "count", "live", "tone", "places"].map((n) => by[n]?.type), ["text", "textarea", "number", "checkbox", "select", "array"]);
});

test("a list carries its item shape, which is the same translation one level down", () => {
  const places = variableFields(SPEC).find((f) => f.name === "places");
  same(places?.itemFields?.map((f) => [f.name, f.type]), [["name", "text"], ["note", "textarea"]]);
  assert.equal(places?.itemFields?.[1]?.label, "Note", "a variable with no label is drawn by its key");
  assert.equal(places?.emptyLabel, "No items yet. Click Add to begin.");
});

test("a media variable draws whatever is registered for a media reference", () => {
  const [field] = variableFields([{ id: "cover", label: "Cover", media: "image/*" }]);
  assert.equal(field?.type, "media-uri");
  assert.equal(field?.accept, "image/*");
});

test("everything a variable says about itself comes through", () => {
  const by = byName(variableFields(SPEC));
  assert.equal(by["title"]?.required, true);
  assert.equal(by["title"]?.placeholder, "A name");
  assert.equal(by["body"]?.help, "Markdown is fine");
  same([by["count"]?.min, by["count"]?.max, by["count"]?.step], [1, 9, 1]);
  assert.equal(by["count"]?.defaultValue, 2);
  same(by["tone"]?.options, [{ value: "warm", label: "Warm" }]);
});

test("an option with no label is labelled by its value", () => {
  const [field] = variableFields([{ id: "size", type: "select", options: ["s", { value: "m" }] }]);
  same(field?.options, ["s", { value: "m", label: "m" }]);
});

test("a list's max is how many entries it takes, not a number bound", () => {
  const [list] = variableFields([{ id: "items", label: "Items", type: "list", max: 3, itemSchema: [] }]);
  assert.equal(list?.max, undefined, "a list does not forward max as a control bound");
});

test("an importer is offered only when the caller can handle one", () => {
  assert.equal(variableFields(SPEC).find((f) => f.name === "places")?.actions === undefined, true);
  const seen: string[] = [];
  const withImport = variableFields(SPEC, { onImportClick: (id) => seen.push(id) });
  const action = withImport.find((f) => f.name === "places")?.actions?.[0];
  assert.equal(action?.label, "Import");
  assert.match(action?.title ?? "", /csv/);
  action?.onClick?.([]);
  same(seen, ["csv"]);
});

test("a variable with no key is not a field, and no spec is no fields", () => {
  same(variableFields([{ label: "nameless" }]), []);
  same(variableFields(), []);
});

done();
