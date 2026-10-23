import assert from "node:assert/strict";
import test from "node:test";
import { createSlugger, slugify } from "./slug.js";

test("a heading becomes a lowercase hyphenated id, accents folded", () => {
  assert.equal(slugify("Theme variables"), "theme-variables");
  assert.equal(slugify("  Props & slots! "), "props-slots");
  assert.equal(slugify("Configuração"), "configuracao");
});

test("a slugger keeps ids unique within a document", () => {
  const slug = createSlugger();
  assert.equal(slug("Basic"), "basic");
  assert.equal(slug("Basic"), "basic-2");
  assert.equal(slug("Basic"), "basic-3");
  assert.equal(slug("!!!"), "section");
});
