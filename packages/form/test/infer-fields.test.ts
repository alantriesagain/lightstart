/** @file inferFields: what a schema with no `$form` block implies, a described field beating a guess from its name. */
import { assert, done, same, test } from "./check.ts";
import { humanizeName, inferFields, inferInput, inputFromName, relationTargets } from "../index.ts";
import type { ModelFormField } from "../index.ts";

const byName = (fields: ModelFormField[]): Record<string, ModelFormField> => Object.fromEntries(fields.map((f) => [f.name, f]));

test("a name becomes a label whichever case it was written in", () => {
  assert.equal(humanizeName("createdAt"), "Created At");
  assert.equal(humanizeName("user_name"), "User Name");
  assert.equal(humanizeName("title"), "Title");
  assert.equal(humanizeName(""), "");
});

test("what a name suggests, for a field nobody described", () => {
  const cases: Record<string, string> = {
    password: "password", passwordConfirm: "password",
    email: "email", contactEmail: "email",
    url: "url", websiteUrl: "url", permalink: "url",
    phone: "tel", tel: "tel",
    datetime: "datetime-local", startsAtDatetime: "datetime-local",
    date: "date", birthDate: "date", published_at: "date",
    time: "time", startTime: "time",
    description: "textarea", content: "textarea", bio: "textarea", body: "textarea", summary: "textarea",
    image: "url", avatar: "url", photo: "url", picture: "url",
    title: "text", name: "text", "": "text",
  };
  for (const [name, expected] of Object.entries(cases)) assert.equal(inputFromName(name), expected, name);
});

test("a described field beats a guess about its name", () => {
  assert.equal(inferInput({ name: "avatar", $type: "string" }), "url", "the guess, when nothing describes it");
  assert.equal(inferInput({ name: "avatar", $type: "string", fieldType: "file" }), "file", "a file is a file");
  assert.equal(inferInput({ name: "avatar", $type: "array", fieldType: "file" }), "files");
  assert.equal(inferInput({ name: "avatar", $type: "string", input: "textarea" }), "textarea", "an explicit input wins outright");
  assert.equal(inferInput({ name: "avatar", $type: "string", cmsType: "media" }), "media");
});

test("the declared kinds map to their controls", () => {
  assert.equal(inferInput({ name: "live", $type: "boolean" }), "checkbox");
  assert.equal(inferInput({ name: "count", $type: "number" }), "number");
  assert.equal(inferInput({ name: "meta", $type: "object" }), "textarea");
  assert.equal(inferInput({ name: "tags", $type: "array" }), "textarea");
  assert.equal(inferInput({ name: "kind", $type: "string", enum: ["a", "b"] }), "select");
  assert.equal(inferInput({ name: "owner", $type: "string", relationship: "belongs" }), "select");
  assert.equal(inferInput({ name: "tags", $type: "array", relationship: "belongs_many" }), "multi-select");
  assert.equal(inferInput({ name: "note", $type: "string", rows: 4 }), "textarea");
});

const MODEL = {
  $form: { fields: ["title"] },
  id: { $type: "string", required: true },
  createdAt: { $type: "string" },
  updatedAt: { $type: "string" },
  title: { $type: "string", required: true, label: "Headline" },
  slug: { $type: "string", immutable: true },
  kind: { $type: "string", enum: ["draft_post", "live"] },
  body: { $type: "string" },
  internal: { $type: "string", attribute: false },
  widget: { $type: "string", attribute: false, cmsType: "richText" },
  count: { $type: "number", defaultValue: 0 },
};

test("every editable field of a model, in schema order", () => {
  same(inferFields(MODEL).map((f) => f.name), ["title", "slug", "kind", "body", "widget", "count"]);
});

test("the generated fields are never editable, and createdAt only once the row exists", () => {
  assert.equal(inferFields(MODEL).some((f) => f.name === "createdAt"), false);
  assert.ok(inferFields(MODEL, { operation: "edit" }).some((f) => f.name === "createdAt"));
  for (const operation of ["add", "edit"] as const) {
    const names = inferFields(MODEL, { operation }).map((f) => f.name);
    assert.equal(names.includes("id"), false, operation);
    assert.equal(names.includes("updatedAt"), false, operation);
  }
});

test("an immutable field can be set once and not changed after", () => {
  assert.ok(inferFields(MODEL).some((f) => f.name === "slug"));
  assert.equal(inferFields(MODEL, { operation: "edit" }).some((f) => f.name === "slug"), false);
});

test("a field the store hides is skipped, unless a cmsType gives it a widget", () => {
  const names = inferFields(MODEL).map((f) => f.name);
  assert.equal(names.includes("internal"), false);
  assert.ok(names.includes("widget"));
  assert.equal(inferFields(MODEL).find((f) => f.name === "widget")?.cmsType, "richText");
});

test("labels, options, defaults and rows come through", () => {
  const by = byName(inferFields(MODEL));
  assert.equal(by["title"]?.label, "Headline", "a declared label wins");
  assert.equal(by["body"]?.label, "Body", "and a missing one is humanized");
  assert.equal(by["body"]?.rows, 3, "a textarea gets a default height");
  same(by["kind"]?.options, [{ value: "draft_post", label: "Draft Post" }, { value: "live", label: "Live" }]);
  assert.equal(by["count"]?.defaultValue, 0);
  assert.equal(by["title"]?.required, true);
  assert.equal(by["body"]?.required, false);
});

test("relation fields say which model their options come from", () => {
  same(
    relationTargets({ $form: {}, author: { relationship: "belongs", targetModel: "user" }, title: { $type: "string" }, tags: { relationship: "belongs_many", targetModel: "tag" } }),
    [{ name: "author", model: "user" }, { name: "tags", model: "tag" }],
  );
});

test("a model with nothing in it is an empty list, not a crash", () => {
  same(inferFields(), []);
  same(inferFields({}), []);
  same(inferFields({ $form: {}, broken: null, alsoBroken: "nope" }), []);
});

test("a secret field is a password input, and help travels with it", () => {
  const by = byName(inferFields({ apiKey: { $type: "string", secret: true, label: "API key", help: "From the console" }, endpoint: { $type: "string" } }));
  assert.equal(by["apiKey"]?.type, "password");
  assert.equal(by["apiKey"]?.help, "From the console");
  assert.equal(by["endpoint"]?.type, "text");
});

done();
