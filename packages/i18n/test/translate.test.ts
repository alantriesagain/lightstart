/** @file translate: lookup, plural selection and interpolation over plain dictionaries. */
import { assert, done, same, test } from "./check.ts";
import { interpolate, lookup, pick, resolve, translate } from "../translate.ts";

const en = { notify: { online: "{name} is open to meet", nights: { one: "{count} night", other: "{count} nights" } }, activity: { beach: "Beach" } };
const ptBR = { notify: { online: "{name} está disponível" }, activity: { beach: "Praia" } };
const dicts = { en, "pt-BR": ptBR };

test("pick answers the exact tag, then a sibling of the same language, then the fallback", () => {
  assert.equal(pick(dicts, "pt-BR")?.locale, "pt-BR");
  assert.equal(pick(dicts, "pt")?.locale, "pt-BR", "a bare language reads the one dictionary that speaks it");
  assert.equal(pick(dicts, "pt-PT")?.locale, "pt-BR");
  assert.equal(pick(dicts, "fr")?.locale, "en", "a language nobody speaks reads the fallback");
  assert.equal(pick(dicts, "")?.locale, "en");
  assert.equal(pick(dicts, undefined)?.locale, "en");
  assert.equal(pick({}, "en"), null, "and no dictionaries at all is null, not a throw");
});

test("lookup walks a dotted path and answers undefined off the tree", () => {
  assert.equal(lookup(en, "activity.beach"), "Beach");
  assert.equal(lookup(en, "activity.nope"), undefined);
  assert.equal(lookup(en, "activity.beach.deeper"), undefined, "a string has no children");
  assert.equal(lookup(undefined, "a.b"), undefined);
});

test("translate speaks the wanted language and falls back per key, not per dictionary", () => {
  assert.equal(translate(dicts, "pt-BR", "notify.online", { name: "Mika" }), "Mika está disponível");
  assert.equal(translate(dicts, "pt", "activity.beach"), "Praia");
  assert.equal(translate(dicts, "pt-BR", "notify.nights", { count: 2 }), "2 nights", "a key pt-BR lacks reads English");
  assert.equal(translate(dicts, "fr", "notify.online", { name: "Mika" }), "Mika is open to meet");
});

test("a miss answers undefined, and resolve names why", () => {
  assert.equal(translate(dicts, "en", "notify.nope"), undefined);
  same(resolve(dicts, "en", "notify.nope"), { miss: "not_found" });
  same(resolve(dicts, "en", ""), { miss: "not_found" });
  same(resolve(dicts, "en", "notify"), { miss: "not_string" }, "a namespace is not a sentence");
  same(resolve(dicts, "en", "notify.nights"), { miss: "plural_missing_count" }, "a plural without a count is a miss, not a guess");
});

test("a plural selects by count under the locale that answered", () => {
  same(resolve(dicts, "en", "notify.nights", { count: 1 }), { value: "1 night", locale: "en" });
  same(resolve(dicts, "en", "notify.nights", { count: 3 }), { value: "3 nights", locale: "en" });
  same(resolve(dicts, "en", "notify.nights", { n: 3 }), { value: "{count} nights", locale: "en" }, "n picks the form; it does not fill a {count} hole");
  same(resolve(dicts, "pt-BR", "notify.nights", { count: 1 }), { value: "1 night", locale: "en" }, "found in the fallback, so counted there");
});

test("interpolate fills what it has and leaves the rest visible", () => {
  assert.equal(interpolate("{a} and {b}", { a: 1 }), "1 and {b}");
  assert.equal(interpolate("no holes"), "no holes");
  assert.equal(interpolate("{a}", { a: 0 }), "0", "zero is a value");
});

done();
