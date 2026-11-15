/**
 * @file The package's tests: `slugify` folds text into a slug, and `Slugger` numbers a slug it has
 * already answered.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Slugger, slugify } from "../index.ts";

describe("slugify", () => {
  it("lowercases words and joins them with a hyphen", () => {
    assert.equal(slugify("Hello, Light!"), "hello-light");
  });

  it("folds accents and trims the ends", () => {
    assert.equal(slugify("  Crème brûlée  "), "creme-brulee");
  });

  it("answers an empty string when nothing is left", () => {
    assert.equal(slugify("!!!"), "");
  });
});

describe("Slugger", () => {
  it("numbers a slug it has already answered", () => {
    const slugger = new Slugger();
    assert.equal(slugger.slug("Hello World"), "hello-world");
    assert.equal(slugger.slug("Hello, World!"), "hello-world-2");
    assert.equal(slugger.slug("hello world"), "hello-world-3");
  });
});
