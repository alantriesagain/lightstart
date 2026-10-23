import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { resetIds, uniqueId } from "./id.js";

describe("@bootstrapp/light - uniqueId", () => {
  beforeEach(() => resetIds());

  it("carries the prefix it was given", () => {
    assert.equal(uniqueId("lc-form-"), "lc-form-1");
    assert.equal(uniqueId("tabs-"), "tabs-2");
  });

  it("never repeats itself", () => {
    const seen = new Set();
    for (let i = 0; i < 1000; i++) seen.add(uniqueId("x-"));
    assert.equal(seen.size, 1000);
  });

  it("shares one counter across prefixes, so no two ids can ever match", () => {
    assert.notEqual(uniqueId("a-").slice(2), uniqueId("b-").slice(2));
  });

  it("produces an id a document accepts", () => {
    assert.match(uniqueId("lc-form-"), /^[A-Za-z][\w-]*$/);
  });
});
