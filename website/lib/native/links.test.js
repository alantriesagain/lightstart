import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STEPS } from "./overview.js";
import { NATIVE_PAGES } from "./pages.js";
import { runsOf } from "./prose.js";
import { TOPICS } from "./topics.js";

/** The sections of the pages with views of their own: the introduction and the comparison. */
const VIEW_SECTIONS = { "": ["native", "background"], comparison: ["comparison", "differences"] };

/** Every string a native page draws as words. @param {import("./topics.js").TopicPage} page */
const wordsOf = (page) => [
  page.lede,
  ...page.sections.flatMap((section) =>
    section.blocks.flatMap((block) => (block.kind === "text" || block.kind === "note" ? [block.text] : block.kind === "list" ? block.items : [])),
  ),
];

/** @param {string} href */
const resolves = (href) => {
  const [path, hash = ""] = href.split("#");
  const page = NATIVE_PAGES.find((entry) => entry.href === path);
  if (!page) return false;
  const sections = page.topic in VIEW_SECTIONS ? VIEW_SECTIONS[/** @type {keyof typeof VIEW_SECTIONS} */ (page.topic)] : TOPICS[page.topic].sections.map((section) => section.id);
  return !hash || sections.includes(hash);
};

describe("the native pages' links", () => {
  it("lists a page for every topic, and a topic for every page", () => {
    assert.deepEqual(NATIVE_PAGES.filter((page) => !(page.topic in VIEW_SECTIONS)).map((page) => page.topic).sort(), Object.keys(TOPICS).sort());
  });

  it("point every site link at a page and section that exist", () => {
    const links = [
      ...Object.values(TOPICS).flatMap(wordsOf),
      ...Object.values(STEPS).flatMap((step) => step.text),
    ]
      .flatMap((text) => runsOf(text))
      .flatMap((run) => (run.kind === "link" && run.href.startsWith("/") ? [run.href] : []));
    const more = Object.values(STEPS).flatMap((step) => (step.more ? [step.more.href] : []));
    const broken = [...links, ...more].filter((href) => !resolves(href));
    assert.deepEqual(broken, []);
  });
});
