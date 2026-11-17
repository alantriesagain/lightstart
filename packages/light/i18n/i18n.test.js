import assert from "node:assert/strict";
import test from "node:test";
import { effect } from "../signals/index.ts";
import { configureTranslation, translation } from "./index.ts";
import { configureView, translate } from "../view/core.ts";

test("without a library a component keeps its own words, in the document's language", () => {
  configureTranslation({});
  assert.equal(translation.translate("hello"), undefined);
  assert.equal(translation.language(), "en");
  assert.deepEqual(translation.languages(), ["en"]);
});

test("a library answers the sentences, the language and the languages on offer", async () => {
  let current = "en";
  const listeners = new Set();
  const words = { en: { hello: "Hello" }, pt: { hello: "Olá" } };
  configureTranslation({
    translate: (key) => words[current][key],
    language: () => current,
    languages: () => ["en", "pt"],
    setLanguage: (next) => {
      current = next;
      for (const fn of listeners) fn();
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  });
  assert.equal(translate("hello"), "Hello", "the view's translate reads the library");
  const seen = [];
  const run = effect(() => {
    seen.push(translation.translate("hello"));
  });
  await translation.setLanguage("pt");
  assert.deepEqual(seen, ["Hello", "Olá"], "a read follows the change of language");
  assert.deepEqual(translation.languages(), ["en", "pt"]);
  run.dispose();
  configureTranslation({});
  assert.equal(listeners.size, 0, "a library replaced is unsubscribed");
});

test("configureView's translate is a library with sentences only", () => {
  configureView({ translate: (key) => (key === "hi" ? "Hi" : undefined) });
  assert.equal(translate("hi"), "Hi");
  assert.equal(translation.language(), "en");
  configureTranslation({});
});
