import assert from "node:assert/strict";
import { describe, it } from "node:test";
import T, { validateType } from "./index.js";

describe("light/types: validateType", () => {
  it("answers a new object with the coerced values and the defaults, the input untouched", () => {
    const schema = { n: T.number(), kind: T.string("open"), done: T.boolean(false) };
    const input = { n: "4", done: true };
    const [errors, out] = validateType(input, { schema });
    assert.equal(errors, null);
    assert.deepEqual(out, { n: 4, done: true, kind: "open" });
    assert.notEqual(out, input);
    assert.deepEqual(input, { n: "4", done: true });
  });

  it("answers the errors and null when a required field is missing", () => {
    const [errors, out] = validateType({}, { schema: { title: T.string({ required: true }) } });
    assert.deepEqual(errors, { title: "required" });
    assert.equal(out, null);
  });

  it("undefinedProps false validates the keys the object has alone", () => {
    const schema = { n: T.number(), kind: T.string("open") };
    const [errors, out] = validateType({ n: "2" }, { schema, undefinedProps: false });
    assert.equal(errors, null);
    assert.deepEqual(out, { n: 2 });
  });

  it("a virtual field interpolates the row and the object, validated when asked", () => {
    const schema = { first: T.string(), last: T.string(), full: T.string({ virtual: "${first} ${last}" }) };
    const [, plain] = validateType({ first: "Ada" }, { schema, row: { last: "L" } });
    assert.equal(plain?.full, "Ada L");
    const [, checked] = validateType({ first: "Ada", last: "Lovelace" }, { schema, validateVirtual: true });
    assert.equal(checked?.full, "Ada Lovelace");
  });

  it("a timestamp field is stamped on a create and kept on an edit", () => {
    const schema = { addedAt: T.timestamp() };
    const [, added] = validateType({}, { schema, operation: "create" });
    assert.equal(typeof added?.addedAt, "number");
    const [, edited] = validateType({ addedAt: 5 }, { schema, operation: "edit" });
    assert.equal(edited?.addedAt, 5);
  });
});

describe("light/types: nullable", () => {
  it("keeps null as the value on every primitive factory", () => {
    for (const name of ["string", "number", "boolean", "date", "datetime", "array", "object"]) {
      const def = T[name]({ nullable: true });
      assert.deepEqual(def.validate(null), { valid: true, value: null, error: null, details: null }, name);
    }
  });

  it("a required field without nullable rejects null", () => {
    const [errors, out] = validateType({ title: null }, { schema: { title: T.string({ required: true }) } });
    assert.deepEqual(errors, { title: "required" });
    assert.equal(out, null);
  });

  it("required with nullable rejects undefined and the empty string but keeps null", () => {
    const title = T.string({ required: true, nullable: true });
    assert.equal(title.validate(undefined).error, "required");
    assert.equal(title.validate("").error, "required");
    const kept = title.validate(null);
    assert.equal(kept.valid, true);
    assert.equal(kept.value, null);
    const [errors, out] = validateType({ title: null }, { schema: { title } });
    assert.equal(errors, null);
    assert.equal(out?.title, null);
  });

  it("defaultValue fills undefined and the empty string but not null on a nullable field", () => {
    const title = T.string({ nullable: true, defaultValue: "untitled" });
    assert.equal(title.validate(null).value, null);
    assert.equal(title.validate(undefined).value, "untitled");
    assert.equal(title.validate("").value, "untitled");
  });
});
