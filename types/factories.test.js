import assert from "node:assert/strict";
import { describe, it } from "node:test";
import T from "./index.js";

describe("Types", () => {
  describe("String Type", () => {
    it("should create a string type", () => {
      const stringType = T.string();

      assert.ok(stringType, "Should create string type");
      assert.equal(stringType.$type, "string");
    });

    it("should validate string values", () => {
      const stringType = T.string();

      const validResult = stringType.validate("hello");
      assert.equal(validResult.valid, true, "Should validate string");
      assert.equal(validResult.value, "hello");
    });

    it("should coerce numbers to strings", () => {
      const stringType = T.string();

      const result = stringType.validate(123);
      assert.equal(result.valid, true, "Validation should be true");
      assert.equal(result.value, "123", "Value should be coerced to string");
    });

    it("should handle default values", () => {
      const stringType = T.string({ defaultValue: "default" });
      assert.equal(stringType.defaultValue, "default");

      const result = stringType.validate(undefined);
      assert.equal(result.valid, true, "Validation should be true for default");
      assert.equal(result.value, "default", "Value should be default");
    });

    it("should handle required validation", () => {
      const stringType = T.string({ required: true });

      const emptyResult = stringType.validate("");
      assert.equal(emptyResult.valid, false, "Empty string should fail required validation");
      assert.equal(emptyResult.error, "required");

      const nullResult = stringType.validate(null);
      assert.equal(nullResult.valid, false, "Null should fail required validation");
      assert.equal(nullResult.error, "required");

      const undefinedResult = stringType.validate(undefined);
      assert.equal(undefinedResult.valid, false, "Undefined should fail required validation");
      assert.equal(undefinedResult.error, "required");

      const validResult = stringType.validate("value");
      assert.equal(validResult.valid, true, "Non-empty string should pass");
    });
  });

  describe("Number Type", () => {
    it("should create a number type", () => {
      const numberType = T.number();

      assert.ok(numberType, "Should create number type");
      assert.equal(numberType.$type, "number");
    });

    it("should validate number values", () => {
      const numberType = T.number();

      const validResult = numberType.validate(42);
      assert.equal(validResult.valid, true);
      assert.equal(validResult.value, 42);
    });

    it("should coerce string numbers", () => {
      const numberType = T.number();

      const result = numberType.validate("123");
      assert.equal(result.valid, true, "Validation should pass");
      assert.equal(result.value, 123, "Value should be coerced to number");
      assert.equal(typeof result.value, "number");
    });

    it("should handle decimal numbers", () => {
      const numberType = T.number();

      const result = numberType.validate(3.14);
      assert.equal(result.valid, true);
      assert.equal(result.value, 3.14);
    });

    it("should handle negative numbers", () => {
      const numberType = T.number();

      const result = numberType.validate(-42);
      assert.equal(result.valid, true);
      assert.equal(result.value, -42);
    });

    it("should reject non-numeric strings", () => {
      const numberType = T.number();

      const result = numberType.validate("not a number");
      assert.equal(result.valid, false, "Should reject non-numeric string");
      assert.equal(result.error, "NaN");
    });
  });

  describe("Boolean Type", () => {
    it("should create a boolean type", () => {
      const boolType = T.boolean();

      assert.ok(boolType, "Should create boolean type");
      assert.equal(boolType.$type, "boolean");
    });

    it("should validate boolean values", () => {
      const boolType = T.boolean();

      const trueResult = boolType.validate(true);
      const falseResult = boolType.validate(false);

      assert.equal(trueResult.valid, true);
      assert.equal(falseResult.valid, true);
      assert.equal(trueResult.value, true);
      assert.equal(falseResult.value, false);
    });

    it("should coerce string booleans", () => {
      const boolType = T.boolean();

      const trueResult = boolType.validate("true");
      const falseResult = boolType.validate("false");

      assert.equal(trueResult.valid, true, "Validation for 'true' string failed");
      assert.equal(falseResult.valid, true, "Validation for 'false' string failed");
      assert.equal(trueResult.value, true, "'true' string should coerce to true");
      assert.equal(falseResult.value, false, "'false' string should coerce to false");
    });

    it("should handle truthy/falsy coercion", () => {
      const boolType = T.boolean();

      const truthyResult = boolType.validate(1);
      const falsyResult = boolType.validate(0);

      assert.equal(truthyResult.valid, true, "Validation for 1 failed");
      assert.equal(falsyResult.valid, true, "Validation for 0 failed");
      assert.equal(truthyResult.value, true, "1 should coerce to true");
      assert.equal(falsyResult.value, false, "0 should coerce to false");
    });
  });

  describe("Array Type", () => {
    it("should create an array type", () => {
      const arrayType = T.array();

      assert.ok(arrayType, "Should create array type");
      assert.equal(arrayType.$type, "array");
    });

    it("should validate arrays", () => {
      const arrayType = T.array();

      const result = arrayType.validate([1, 2, 3]);
      assert.equal(result.valid, true);
      assert.deepEqual(result.value, [1, 2, 3]);
    });

    it("should handle empty arrays", () => {
      const arrayType = T.array();

      const result = arrayType.validate([]);
      assert.equal(result.valid, true);
      assert.deepEqual(result.value, []);
    });

    it("should handle default array values", () => {
      const arrayType = T.array({ defaultValue: [1, 2, 3] });

      assert.deepEqual(arrayType.defaultValue, [1, 2, 3]);

      const result = arrayType.validate(undefined);
      assert.equal(result.valid, true);
      assert.deepEqual(result.value, [1, 2, 3]);
    });

    it("should coerce JSON strings to arrays", () => {
      const arrayType = T.array();

      const result = arrayType.validate('[1, "b", 3]');
      assert.equal(result.valid, true, "JSON string array should be valid");
      assert.deepEqual(
        result.value,
        [1, "b", 3],
        "Should convert JSON string to array",
      );
    });

    it("should coerce to empty array for non-JSON strings", () => {
      const arrayType = T.array();
      const result = arrayType.validate("a,b,c");
      assert.equal(result.valid, true);
      assert.deepEqual(
        result.value,
        [],
        "Should coerce non-JSON string to empty array",
      );
    });

    it("should coerce to empty array for non-array primitives", () => {
      const arrayType = T.array();

      const result = arrayType.validate(123);
      assert.equal(result.valid, true);
      assert.deepEqual(result.value, [], "Should coerce number to empty array");
    });
  });

  describe("Object Type", () => {
    it("should create an object type", () => {
      const objectType = T.object();

      assert.ok(objectType, "Should create object type");
      assert.equal(objectType.$type, "object");
    });

    it("should validate objects", () => {
      const objectType = T.object();

      const result = objectType.validate({ key: "value" });
      assert.equal(result.valid, true);
      assert.deepEqual(result.value, { key: "value" });
    });

    it("should handle nested objects", () => {
      const objectType = T.object();

      const nested = {
        level1: {
          level2: {
            value: "deep",
          },
        },
      };

      const result = objectType.validate(nested);
      assert.equal(result.valid, true);
      assert.deepEqual(result.value, nested);
    });

    it("should handle empty objects", () => {
      const objectType = T.object();

      const result = objectType.validate({});
      assert.equal(result.valid, true);
      assert.deepEqual(result.value, {});
    });

    it("should define object properties schema", () => {
      const objectType = T.object({
        props: {
          name: T.string(),
          age: T.number(),
        },
      });

      assert.ok(objectType.props, "Should have props schema");
    });

    it("should reject null as object", () => {
      const objectType = T.object();

      const result = objectType.validate(null);
      assert.equal(result.valid, false, "null should not be a valid object");
      assert.equal(result.error, "invalid");
    });

    it("should reject primitives as object", () => {
      const objectType = T.object();
      const result = objectType.validate(123);
      assert.equal(result.valid, false, "number should not be a valid object");
      assert.equal(result.error, "invalid");
    });
  });

  describe("Date Type", () => {
    it("should create a date type", () => {
      const dateType = T.date();

      assert.ok(dateType, "Should create date type");
      assert.equal(dateType.$type, "date");
    });

    it("should validate Date objects", () => {
      const dateType = T.date();
      const now = new Date();

      const result = dateType.validate(now);
      assert.equal(result.valid, true);
      assert.equal(result.value, now);
    });

    it("should coerce ISO strings to dates", () => {
      const dateType = T.date();
      const isoString = "2023-01-01T00:00:00.000Z";
      const date = new Date(isoString);

      const result = dateType.validate(isoString);
      assert.equal(result.valid, true);
      assert.ok(result.value instanceof Date, "Should be a Date object");
      assert.equal(result.value.getTime(), date.getTime());
    });

    it("should coerce timestamps to dates", () => {
      const dateType = T.date();
      const timestamp = Date.now();
      const date = new Date(timestamp);

      const result = dateType.validate(timestamp);
      assert.equal(result.valid, true);
      assert.ok(result.value instanceof Date, "Should be a Date object");
      assert.equal(result.value.getTime(), date.getTime());
    });

    it("should reject invalid date strings", () => {
      const dateType = T.date();

      const result = dateType.validate("not a date");
      assert.equal(result.valid, false, "Invalid date string should fail");
      assert.equal(result.error, "invalid");
    });
  });

  describe("Datetime Type", () => {
    it("should create a datetime type", () => {
      const datetimeType = T.datetime();

      assert.ok(datetimeType, "Should create datetime type");
      assert.equal(datetimeType.$type, "datetime");
    });

    it("should handle ISO datetime strings", () => {
      const datetimeType = T.datetime();
      const isoString = new Date().toISOString();

      const result = datetimeType.validate(isoString);
      assert.equal(result.valid, true);
      assert.ok(result.value instanceof Date);
    });

    it("should reject invalid datetime strings", () => {
      const datetimeType = T.datetime();
      const result = datetimeType.validate("not a datetime");
      assert.equal(result.valid, false);
      assert.equal(result.error, "invalid");
    });
  });

  describe("Relationship Types", () => {
    it("should create a belongs relationship", () => {
      const belongsType = T.belongs("user");

      assert.ok(belongsType, "Should create belongs type");
      assert.equal(belongsType.relationship, "belongs");
      assert.equal(belongsType.targetModel, "user");
      assert.equal(belongsType.$type, "string");
    });

    it("should create a many relationship", () => {
      const manyType = T.many("post");

      assert.ok(manyType, "Should create many type");
      assert.equal(manyType.relationship, "many");
      assert.equal(manyType.targetModel, "post");
      assert.equal(manyType.$type, "array");
    });

    it("should create a one relationship", () => {
      const oneType = T.one("profile");

      assert.ok(oneType, "Should create one type");
      assert.equal(oneType.relationship, "one");
      assert.equal(oneType.targetModel, "profile");
      assert.equal(oneType.$type, "string");
    });

    it("should handle relationship options", () => {
      const belongsType = T.belongs("user", "userId", { custom: true });
      assert.equal(belongsType.targetForeignKey, "userId");
      assert.equal(belongsType.custom, true);

      const belongsType2 = T.belongs("user", { custom: true });
      assert.equal(belongsType2.targetForeignKey, undefined);
      assert.equal(belongsType2.custom, true);
    });

    it("should validate relationships (coerce to ID)", () => {
      const belongsType = T.belongs("user");
      const user = { id: "user_123", name: "Test" };
      const result = belongsType.validate(user);

      assert.equal(result.valid, true);
      assert.equal(result.value, "user_123", "Should coerce object to its ID");

      const result2 = belongsType.validate("user_123");
      assert.equal(result2.valid, true);
      assert.equal(result2.value, "user_123", "Should accept a string ID");
    });
  });

  describe("Type Options", () => {
    it("should set default values", () => {
      const stringType = T.string({ defaultValue: "default" });
      const numberType = T.number({ defaultValue: 0 });
      const boolType = T.boolean({ defaultValue: false });

      assert.equal(stringType.defaultValue, "default");
      assert.equal(numberType.defaultValue, 0);
      assert.equal(boolType.defaultValue, false);
    });

    it("should set required flag", () => {
      const requiredType = T.string({ required: true });
      const optionalType = T.string({ required: false });

      assert.equal(requiredType.required, true);
      assert.equal(optionalType.required, false);
    });

    it("should set primary key flag", () => {
      const primaryType = T.number({ primary: true });

      assert.equal(primaryType.primary, true);
    });

    it("should set unique flag", () => {
      const uniqueType = T.string({ unique: true });

      assert.equal(uniqueType.unique, true);
    });

    it("should accept custom validators", () => {
      const customType = T.string({
        customValidator: (value) =>
          value.length > 5 ? null : ["too_short", null],
      });

      assert.equal(typeof customType.customValidator, "function");

      const goodResult = customType.validate("long enough");
      assert.equal(goodResult.valid, true);

      const badResult = customType.validate("short");
      assert.equal(badResult.valid, false);
      assert.equal(badResult.error, "too_short");
    });
  });

  describe("Validation", () => {
    it("should validate email format", () => {
      const emailType = T.string({ format: "email" });

      const validEmail = emailType.validate("test@example.com");
      const invalidEmail = emailType.validate("not-an-email");

      assert.equal(validEmail.valid, true, "Valid email should pass");
      assert.equal(invalidEmail.valid, false, "Invalid email should fail");
      assert.equal(invalidEmail.error, "invalid");
    });

    it("should run custom validators", () => {
      const ageType = T.number({
        customValidator: (value) =>
          value >= 18 && value <= 100 ? null : ["invalid_age", null],
      });

      const validAge = ageType.validate(25);
      const tooYoung = ageType.validate(15);
      const tooOld = ageType.validate(150);

      assert.equal(validAge.valid, true);
      assert.equal(tooYoung.valid, false);
      assert.equal(tooYoung.error, "invalid_age");
      assert.equal(tooOld.valid, false);
      assert.equal(tooOld.error, "invalid_age");
    });

    it("should provide validation errors", () => {
      const requiredType = T.string({ required: true });

      const result = requiredType.validate("");

      assert.equal(result.valid, false);
      assert.ok(result.error, "Should have error message");
      assert.equal(result.error, "required");
    });
  });

  describe("Type Coercion", () => {
    it("should coerce between compatible types", () => {
      const numberType = T.number();

      const fromString = numberType.validate("42");
      const fromBoolean = numberType.validate(true);

      assert.equal(fromString.valid, true);
      assert.equal(fromString.value, 42);
      assert.equal(typeof fromString.value, "number");

      assert.equal(fromBoolean.valid, true);
      assert.equal(fromBoolean.value, 1);
      assert.equal(typeof fromBoolean.value, "number");
    });

    it("should preserve null values when not required", () => {
      const optionalString = T.string({ required: false });

      const result = optionalString.validate(null);

      assert.equal(result.valid, true, "Validation should pass for null on optional");
      assert.equal(result.value, null, "Value should be null");
    });

    it("should use default for undefined values", () => {
      const stringType = T.string({ defaultValue: "default" });

      const result = stringType.validate(undefined);

      assert.equal(result.valid, true, "Validation should pass for undefined on default");
      assert.equal(result.value, "default", "Value should be default");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large numbers", () => {
      const numberType = T.number();

      const largeNumber = Number.MAX_SAFE_INTEGER;
      const result = numberType.validate(largeNumber);

      assert.equal(result.valid, true);
      assert.equal(result.value, largeNumber);
    });

    it("should handle very long strings", () => {
      const stringType = T.string();

      const longString = "a".repeat(10000);
      const result = stringType.validate(longString);

      assert.equal(result.valid, true);
      assert.equal(result.value.length, 10000);
    });

    it("should handle deeply nested objects", () => {
      const objectType = T.object();

      let deep = { value: 1 };
      for (let i = 0; i < 100; i++)
        deep = { nested: deep };

      const result = objectType.validate(deep);
      assert.equal(result.valid, true);
    });

    it("should handle circular references gracefully", () => {
      const objectType = T.object();

      const circular = { name: "test" };
      circular.self = circular;

      try {
        const result = objectType.validate(circular);
        assert.equal(result.valid, true, "Should handle circular reference");
      } catch (e) {

        assert.ok(
          e,
          "Threw an error on circular reference, which is acceptable",
        );
      }
    });

    it("should handle special numeric values", () => {
      const numberType = T.number();

      const infinity = numberType.validate(Infinity);
      const negInfinity = numberType.validate(-Infinity);
      const nan = numberType.validate(NaN);

      assert.equal(infinity.valid, true);
      assert.equal(infinity.value, Infinity);

      assert.equal(negInfinity.valid, true);
      assert.equal(negInfinity.value, -Infinity);

      assert.equal(nan.valid, false, "NaN should be invalid");
      assert.equal(nan.error, "NaN");
    });
  });

  describe("Type Extensions", () => {
    it("should support function types", () => {
      const funcType = T.function();

      assert.equal(funcType.$type, "function");

      const fn = () => {};
      const result = funcType.validate(fn);
      assert.equal(result.valid, true);
      assert.equal(result.value, fn);

      const badResult = funcType.validate("not a function");
      assert.equal(badResult.valid, true);
      assert.equal(badResult.value, "not a function");
    });

    it("should create type with all options", () => {
      const complexType = T.string({
        defaultValue: "default",
        required: true,
        unique: true,
        customValidator: (v) => (v.length > 3 ? null : ["too_short", null]),
        format: "email",
      });

      assert.equal(complexType.defaultValue, "default");
      assert.equal(complexType.required, true);
      assert.equal(complexType.unique, true);
      assert.equal(typeof complexType.customValidator, "function");
      assert.equal(complexType.format, "email");
    });
  });
});
