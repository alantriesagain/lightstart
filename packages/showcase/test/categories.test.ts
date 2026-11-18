/** @file categories: each is a folder that holds components, a component folder is a category or tooling, and humanize names one. */
import { assert, same, test, done } from "./check.ts";
import { CATEGORIES, categoryById, humanize } from "../lib/categories.ts";
import type { ComponentTag, ComponentTags } from "../lib/types.ts";

const tag = (module: string): ComponentTag => ({
  module,
  style: null,
  extends: null,
  uses: [],
});

const tags: ComponentTags = {
  "lc-input": tag("form/input.js"),
  "lc-button": tag("display/button.js"),
  "lc-card": tag("layout/card.js"),
  "lc-tabs": tag("navigation/tabs.js"),
  "lc-modal": tag("overlay/modal.js"),
  "lc-alert": tag("feedback/alert.js"),
  "lc-header": tag("app/header.js"),
  "lc-about-section": tag("page/about-section.js"),
  "lc-theme": tag("utility/theme.js"),
};

const directories = new Set(
  Object.values(tags).map((entry) => String(String(entry.module).split("/").at(-2))),
);

test("every category is a directory that holds components", () => {
  for (const category of CATEGORIES) {
    assert.ok(directories.has(category.id), `${category.id} holds no component`);
    assert.ok(
      Boolean(category.label && category.icon && category.description),
      `${category.id} is underdescribed`,
    );
    assert.equal(categoryById(category.id), category);
  }
});

test("every component directory is either a category or tooling", () => {
  const known = new Set([...CATEGORIES.map((category) => category.id), "docs", "theme", "views"]);
  const unclassified: string[] = [...directories]
    .filter((directory) => !known.has(directory))
    .sort();
  same(unclassified, [], `add ${unclassified.join(", ")} to CATEGORIES or to the tooling list`);
});

test("a category is named once", () => {
  const ids: string[] = CATEGORIES.map((category) => category.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("humanize turns a file name into a label", () => {
  assert.equal(humanize("bottom-sheet"), "Bottom Sheet");
  assert.equal(humanize("card"), "Card");
  assert.equal(humanize(""), "");
});
done();
