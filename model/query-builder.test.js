import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchesWhere,
  compileMatcher,
  applyPagination,
  buildQueryResult,
  validateQueryOptions,
} from "./query-builder.ts";

describe("Query Builder", () => {
  describe("matchesWhere", () => {
    it("should return true for empty where clause", () => {
      assert.equal(matchesWhere({ name: "test" }, null), true);
      assert.equal(matchesWhere({ name: "test" }, undefined), true);
      assert.equal(matchesWhere({ name: "test" }, {}), true);
    });

    it("should match direct equality", () => {
      assert.equal(matchesWhere({ name: "John" }, { name: "John" }), true);
      assert.equal(matchesWhere({ name: "John" }, { name: "Jane" }), false);
    });

    it("should match multiple conditions (AND)", () => {
      const record = { name: "John", age: 30 };
      assert.equal(matchesWhere(record, { name: "John", age: 30 }), true);
      assert.equal(matchesWhere(record, { name: "John", age: 25 }), false);
    });

    it("should handle id field with string coercion", () => {
      assert.equal(matchesWhere({ id: "123" }, { id: 123 }), true);
      assert.equal(matchesWhere({ id: 123 }, { id: "123" }), true);
    });

    it("should handle > operator", () => {
      assert.equal(matchesWhere({ age: 30 }, { age: { ">": 25 } }), true);
      assert.equal(matchesWhere({ age: 20 }, { age: { ">": 25 } }), false);
    });

    it("should handle >= operator", () => {
      assert.equal(matchesWhere({ age: 25 }, { age: { ">=": 25 } }), true);
      assert.equal(matchesWhere({ age: 30 }, { age: { ">=": 25 } }), true);
      assert.equal(matchesWhere({ age: 20 }, { age: { ">=": 25 } }), false);
    });

    it("should handle < operator", () => {
      assert.equal(matchesWhere({ age: 20 }, { age: { "<": 25 } }), true);
      assert.equal(matchesWhere({ age: 30 }, { age: { "<": 25 } }), false);
    });

    it("should handle <= operator", () => {
      assert.equal(matchesWhere({ age: 25 }, { age: { "<=": 25 } }), true);
      assert.equal(matchesWhere({ age: 20 }, { age: { "<=": 25 } }), true);
      assert.equal(matchesWhere({ age: 30 }, { age: { "<=": 25 } }), false);
    });

    it("should handle != operator", () => {
      assert.equal(matchesWhere({ status: "active" }, { status: { "!=": "deleted" } }), true);
      assert.equal(matchesWhere({ status: "deleted" }, { status: { "!=": "deleted" } }), false);
    });

    it("should handle <> operator", () => {
      assert.equal(matchesWhere({ status: "active" }, { status: { "<>": "deleted" } }), true);
    });

    it("should handle 'in' operator", () => {
      assert.equal(matchesWhere({ status: "active" }, { status: { in: ["active", "pending"] } }), true);
      assert.equal(matchesWhere({ status: "deleted" }, { status: { in: ["active", "pending"] } }), false);
    });

    it("should handle 'not in' operator", () => {
      assert.equal(matchesWhere({ status: "active" }, { status: { "not in": ["deleted", "archived"] } }), true);
      assert.equal(matchesWhere({ status: "deleted" }, { status: { "not in": ["deleted", "archived"] } }), false);
    });

    it("should handle 'like' operator", () => {
      assert.equal(matchesWhere({ name: "John Doe" }, { name: { like: "John" } }), true);
      assert.equal(matchesWhere({ name: "Jane Doe" }, { name: { like: "John" } }), false);
    });

    it("should handle 'ilike' operator (case insensitive)", () => {
      assert.equal(matchesWhere({ name: "JOHN DOE" }, { name: { ilike: "john" } }), true);
      assert.equal(matchesWhere({ name: "john doe" }, { name: { ilike: "JOHN" } }), true);
    });

    it("should handle 'is null' operator", () => {
      assert.equal(matchesWhere({ field: null }, { field: { "is null": true } }), true);
      assert.equal(matchesWhere({ field: undefined }, { field: { "is null": true } }), true);
      assert.equal(matchesWhere({ field: "value" }, { field: { "is null": true } }), false);
    });

    it("should handle 'is not null' operator", () => {
      assert.equal(matchesWhere({ field: "value" }, { field: { "is not null": true } }), true);
      assert.equal(matchesWhere({ field: null }, { field: { "is not null": true } }), false);
    });
  });

  describe("compileMatcher", () => {
    it("should return a constant-true matcher for empty where", () => {
      const match = compileMatcher(null);
      assert.equal(match({ name: "test" }), true);
      assert.equal(compileMatcher(undefined)({ name: "test" }), true);
      assert.equal(compileMatcher({})({ name: "test" }), true);
    });

    it("should match direct equality", () => {
      const match = compileMatcher({ name: "John" });
      assert.equal(match({ name: "John" }), true);
      assert.equal(match({ name: "Jane" }), false);
    });

    it("should match multiple conditions (AND)", () => {
      const match = compileMatcher({ name: "John", age: 30 });
      assert.equal(match({ name: "John", age: 30 }), true);
      assert.equal(match({ name: "John", age: 25 }), false);
    });

    it("should coerce id field to string", () => {
      const matchNum = compileMatcher({ id: 123 });
      assert.equal(matchNum({ id: "123" }), true);
      assert.equal(matchNum({ id: 123 }), true);
      const matchStr = compileMatcher({ id: "123" });
      assert.equal(matchStr({ id: 123 }), true);
    });

    it("should handle comparison operators", () => {
      assert.equal(compileMatcher({ age: { ">": 25 } })({ age: 30 }), true);
      assert.equal(compileMatcher({ age: { ">": 25 } })({ age: 20 }), false);
      assert.equal(compileMatcher({ age: { ">=": 25 } })({ age: 25 }), true);
      assert.equal(compileMatcher({ age: { "<": 25 } })({ age: 20 }), true);
      assert.equal(compileMatcher({ age: { "<=": 25 } })({ age: 25 }), true);
      assert.equal(compileMatcher({ status: { "!=": "deleted" } })({ status: "active" }), true);
      assert.equal(compileMatcher({ status: { "<>": "deleted" } })({ status: "active" }), true);
    });

    it("should use a Set for 'in' operator (O(1) lookup)", () => {
      const match = compileMatcher({ status: { in: ["active", "pending"] } });
      assert.equal(match({ status: "active" }), true);
      assert.equal(match({ status: "pending" }), true);
      assert.equal(match({ status: "deleted" }), false);
    });

    it("should use a Set for 'not in' operator", () => {
      const match = compileMatcher({ status: { "not in": ["deleted", "archived"] } });
      assert.equal(match({ status: "active" }), true);
      assert.equal(match({ status: "deleted" }), false);
    });

    it("should match a tagged array with 'has'", () => {
      const match = compileMatcher({ areas: { has: "chest" } });
      assert.equal(match({ areas: ["chest", "back"] }), true);
      assert.equal(match({ areas: ["legs"] }), false);
      assert.equal(match({ areas: [] }), false);
    });

    it("should treat 'has' with a list as any-of", () => {
      const match = compileMatcher({ areas: { has: ["push", "legs"] } });
      assert.equal(match({ areas: ["legs", "core"] }), true);
      assert.equal(match({ areas: ["pull"] }), false);
    });

    it("should fall back to equality when 'has' meets a scalar", () => {
      assert.equal(compileMatcher({ level: { has: 2 } })({ level: 2 }), true);
      assert.equal(compileMatcher({ level: { has: 2 } })({ level: 3 }), false);
    });

    it("should require every tag with 'has all'", () => {
      const match = compileMatcher({ muscles: { "has all": ["quads", "glutes"] } });
      assert.equal(match({ muscles: ["quads", "glutes", "lower-back"] }), true);
      assert.equal(match({ muscles: ["quads"] }), false);
      assert.equal(match({ muscles: "quads" }), false);
    });

    it("should intersect rather than compare when 'in' meets an array", () => {
      const match = compileMatcher({ areas: { in: ["pull", "legs"] } });
      assert.equal(match({ areas: ["legs", "core"] }), true);
      assert.equal(match({ areas: ["push"] }), false);
      assert.equal(match({ areas: "pull" }), true, "scalars still behave as membership");
    });

    it("should negate the intersection for 'not in' over an array", () => {
      const match = compileMatcher({ areas: { "not in": ["push"] } });
      assert.equal(match({ areas: ["pull"] }), true);
      assert.equal(match({ areas: ["push", "core"] }), false);
    });

    it("should reject non-array values for 'in'/'not in'", () => {
      assert.equal(compileMatcher({ status: { in: "active" } })({ status: "active" }), false);
      assert.equal(compileMatcher({ status: { "not in": "deleted" } })({ status: "active" }), false);
    });

    it("should pre-lower 'ilike' needle once at compile time", () => {
      const match = compileMatcher({ name: { ilike: "JOHN" } });
      assert.equal(match({ name: "john doe" }), true);
      assert.equal(match({ name: "JOHN DOE" }), true);
      assert.equal(match({ name: "Jane Doe" }), false);
    });

    it("should handle 'like' as case-sensitive substring", () => {
      const match = compileMatcher({ name: { like: "John" } });
      assert.equal(match({ name: "John Doe" }), true);
      assert.equal(match({ name: "JOHN DOE" }), false);
    });

    it("should handle 'is null' and 'is not null'", () => {
      assert.equal(compileMatcher({ field: { "is null": true } })({ field: null }), true);
      assert.equal(compileMatcher({ field: { "is null": true } })({ field: undefined }), true);
      assert.equal(compileMatcher({ field: { "is null": true } })({ field: "v" }), false);
      assert.equal(compileMatcher({ field: { "is not null": true } })({ field: "v" }), true);
      assert.equal(compileMatcher({ field: { "is not null": true } })({ field: null }), false);
    });

    it("should be reusable for many records", () => {
      const match = compileMatcher({ status: { in: ["a", "b", "c"] } });
      const records = Array.from({ length: 100 }, (_, i) => ({ status: ["a", "b", "c", "d"][i % 4] }));
      const passed = records.filter(match);
      assert.equal(passed.length, 75);
    });
  });

  describe("applyPagination", () => {
    it("should return empty array for falsy records", () => {
      assert.deepEqual(applyPagination(null), []);
      assert.deepEqual(applyPagination(undefined), []);
    });

    it("should return records unchanged when no limit or offset", () => {
      const records = [{ id: 1 }, { id: 2 }];
      assert.deepEqual(applyPagination(records), records);
    });

    it("should apply limit", () => {
      const records = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = applyPagination(records, 2);
      assert.equal(result.length, 2);
      assert.equal(result[0].id, 1);
      assert.equal(result[1].id, 2);
    });

    it("should apply offset", () => {
      const records = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = applyPagination(records, undefined, 1);
      assert.equal(result.length, 2);
      assert.equal(result[0].id, 2);
    });

    it("should apply limit and offset together", () => {
      const records = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const result = applyPagination(records, 2, 1);
      assert.equal(result.length, 2);
      assert.equal(result[0].id, 2);
      assert.equal(result[1].id, 3);
    });
  });

  describe("buildQueryResult", () => {
    const records = [
      { id: 1, name: "Alice", age: 30 },
      { id: 2, name: "Bob", age: 25 },
      { id: 3, name: "Charlie", age: 35 },
      { id: 4, name: "Diana", age: 28 },
    ];

    it("should return all records with empty options", () => {
      const result = buildQueryResult(records, {});
      assert.equal(result.items.length, 4);
      assert.equal(result.count, 4);
      assert.equal(result.total, 4);
    });

    it("should filter by where clause", () => {
      const result = buildQueryResult(records, { where: { age: { ">": 28 } } });
      assert.equal(result.items.length, 2);
      assert.equal(result.count, 2);
    });

    it("should sort results", () => {
      const result = buildQueryResult(records, { order: "name ASC" });
      assert.equal(result.items[0].name, "Alice");
      assert.equal(result.items[3].name, "Diana");
    });

    it("understands the -field prefix as descending", () => {
      const result = buildQueryResult(records, { order: "-name" });
      assert.equal(result.items[0].name, "Diana");
      assert.equal(result.items[3].name, "Alice");
    });

    it("mixes prefix and explicit forms across fields", () => {
      const result = buildQueryResult(records, { order: "-age, name ASC" });
      const ages = result.items.map((r) => r.age);
      for (let i = 1; i < ages.length; i++) assert.equal(ages[i - 1] >= ages[i], true);
    });

    it("should paginate results", () => {
      const result = buildQueryResult(records, { limit: 2, offset: 1 });
      assert.equal(result.items.length, 2);
      assert.equal(result.limit, 2);
      assert.equal(result.offset, 1);
      assert.equal(result.total, 4);
    });

    it("should combine filter, sort, and pagination", () => {
      const result = buildQueryResult(records, {
        where: { age: { ">=": 25 } },
        order: "age DESC",
        limit: 2,
      });
      assert.equal(result.items.length, 2);
      assert.equal(result.items[0].name, "Charlie");
      assert.equal(result.items[1].name, "Alice");
      assert.equal(result.total, 4);
    });
  });

  describe("validateQueryOptions", () => {
    it("should pass for empty options", () => {
      assert.equal(validateQueryOptions({}), true);
      assert.equal(validateQueryOptions(), true);
    });

    it("should pass for valid options", () => {
      assert.equal(validateQueryOptions({
        limit: 10,
        offset: 0,
        where: { name: "test" },
      }), true);
    });

    it("should throw for negative limit", () => {
      assert.throws(() => validateQueryOptions({ limit: -1 }), /limit must be a positive number/);
    });

    it("should throw for non-number limit", () => {
      assert.throws(() => validateQueryOptions({ limit: "10" }), /limit must be a positive number/);
    });

    it("should throw for negative offset", () => {
      assert.throws(() => validateQueryOptions({ offset: -1 }), /offset must be a non-negative number/);
    });

    it("should throw for non-object where", () => {
      assert.throws(() => validateQueryOptions({ where: "invalid" }), /where must be an object/);
    });

    it("should throw for null where", () => {
      assert.throws(() => validateQueryOptions({ where: null }), /where must be an object/);
    });
  });
});
