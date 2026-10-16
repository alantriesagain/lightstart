import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationError, validateRow } from "./validate.js";

const models = {
  users: {
    name: { $type: "string", required: true },
    email: { $type: "string", format: "email" },
    site: { $type: "string", format: "url" },
    age: { $type: "number", validator: (v) => v >= 0 },
    tags: { $type: "array" },
    meta: { $type: "object" },
    active: { $type: "boolean" },
    avatar: { $type: "string", fieldType: "file" },
    posts: { relationship: "many", many: true },
    teamId: { relationship: "belongs", belongs: true, $type: "string" },
  },
};

describe("validateRow", () => {
  it("answers invalid for an unknown model", () => {
    const result = validateRow({}, "ghost", {});
    assert.equal(result.valid, false);
    assert.match(result.errors._model, /not found/);
  });

  it("requires on add, not on edit", () => {
    assert.deepEqual(validateRow(models, "users", {}).errors, { name: "name is required" });
    assert.equal(validateRow(models, "users", {}, { operation: "edit" }).valid, true);
    assert.equal(validateRow(models, "users", { name: "" }).valid, false);
  });

  it("checks types, letting a file field hold a blob and a many relation pass untouched", () => {
    const { errors } = validateRow(models, "users", { name: "n", meta: "x", tags: "no", active: 1, avatar: new Blob(["a"]), posts: "anything" });
    assert.deepEqual(Object.keys(errors).sort(), ["meta", "tags"]);
    assert.equal(errors.meta, "meta must be of type object");
    assert.equal(validateRow(models, "users", { name: "n", age: 3, tags: [] }).valid, true);
  });

  it("runs the field validator and reports a thrown message", () => {
    assert.deepEqual(validateRow(models, "users", { name: "n", age: -1 }).errors, { age: "age failed custom validation" });
    const throwing = { thing: { boom: { $type: "number", validator: () => { throw new Error("nope"); } } } };
    assert.deepEqual(validateRow(throwing, "thing", { boom: 1 }).errors, { boom: "nope" });
  });

  it("checks formats", () => {
    assert.deepEqual(validateRow(models, "users", { name: "n", email: "x", site: "ftp://y" }).errors, {
      email: "email must be a valid email",
      site: "site must be a valid url",
    });
    assert.equal(validateRow(models, "users", { name: "n", email: "a@b.co", site: "https://y" }).valid, true);
  });

  it("ValidationError names the model and carries the field map", () => {
    const error = new ValidationError("users", { name: "name is required", age: "bad" });
    assert.equal(error.name, "ValidationError");
    assert.match(error.message, /"users".*name is required; bad/);
    assert.deepEqual(error.errors, { name: "name is required", age: "bad" });
  });
});
