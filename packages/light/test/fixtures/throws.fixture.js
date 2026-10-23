import test from "node:test";

test("a non-Error throw fails the test", () => {
  throw "just a string";
});

test("a falsy throw fails the test", () => {
  throw "";
});

test("a thrown object fails the test", () => {
  throw { code: "boom" };
});

test("a test that throws nothing passes", () => {});
