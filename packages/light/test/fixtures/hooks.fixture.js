import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

/** @type {string[]} */
const log = [];

describe("outer", () => {
  before(() => log.push("before:outer"));
  after(() => log.push("after:outer"));
  beforeEach(() => log.push("beforeEach:outer"));
  afterEach(() => log.push("afterEach:outer"));

  describe("middle", () => {
    before(() => log.push("before:middle"));
    afterEach(() => log.push("afterEach:middle"));

    describe("inner", () => {
      beforeEach(() => log.push("beforeEach:inner"));

      it("records the order", () => {
        log.push("test");
        assert.deepEqual(log.slice(0, 3), ["before:outer", "before:middle", "beforeEach:outer"]);
      });
    });
  });

  it("sees the parent hooks too", () => {
    assert.equal(log.includes("afterEach:outer"), true);
  });
});
