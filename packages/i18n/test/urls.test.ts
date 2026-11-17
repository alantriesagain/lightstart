import { assert, done, same, test } from "./check.ts";
import { localizedUrl, translationsOf } from "../urls.ts";
import type { ModelApi, QueryOptions, Row } from "@lightstart/light/model/types.ts";

test("localizedUrl prefixes a path with a non-default locale", () => {
  assert.equal(localizedUrl("/content/place.json", "pt", "en"), "/pt/content/place.json");
});

test("localizedUrl answers the canonical path for the default locale, no locale, or one already there", () => {
  assert.equal(localizedUrl("/content/place.json", "en", "en"), "/content/place.json");
  assert.equal(localizedUrl("/content/place.json", "", "en"), "/content/place.json");
  assert.equal(localizedUrl("/pt/content/place.json", "pt", "en"), "/pt/content/place.json");
  assert.equal(localizedUrl("/", "pt", "en"), "/pt");
});

test("translationsOf reads every locale's row for a canonical id", async () => {
  const calls: QueryOptions[] = [];
  const rows: Row[] = [
    { id: "p1-pt", locale: "pt", canonicalId: "p1" },
    { id: "p1-en", locale: "en", canonicalId: "p1" },
  ];
  const model = {
    name: "posts",
    schema: undefined,
    getAll: async (opts?: QueryOptions): Promise<Row[]> => {
      calls.push(opts ?? {});
      return rows;
    },
  } as unknown as ModelApi;
  same(await translationsOf(model, "p1"), rows);
  same(calls, [{ where: { canonicalId: "p1" }, ignoreLocale: true }]);
  assert.equal((await translationsOf(model, "p1")).length, 2);
});

await done();
