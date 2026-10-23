import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupDocs, matchDocs } from "./search-match.js";

const docs = [
  { id: "1", group: "Guides", title: "Getting Started", href: "/g/start" },
  { id: "2", group: "Guides", title: "Routing", hint: "URL patterns" },
  { id: "3", group: "API", title: "defineComponent" },
  { id: "4", group: "API", title: "defineRoutes", hint: "route table" },
  { id: "5", group: "Guides", title: "Theming" },
];

describe("lc-search matching", () => {
  it("returns nothing for an empty or whitespace query", () => {
    assert.deepEqual(matchDocs(docs, "", 8), []);
    assert.deepEqual(matchDocs(docs, "   ", 8), []);
  });

  it("matches case-insensitively over title and hint", () => {
    assert.deepEqual(matchDocs(docs, "ROUT", 8).map((d) => d.id), ["2", "4"]);
    assert.deepEqual(matchDocs(docs, "url pat", 8).map((d) => d.id), ["2"]);
  });

  it("caps matches per group, not overall", () => {
    const many = [
      ...docs,
      { id: "6", group: "Guides", title: "Routing Deep Dive" },
    ];
    const capped = matchDocs(many, "e", 2);
    assert.equal(capped.filter((d) => d.group === "Guides").length, 2);
    assert.equal(capped.filter((d) => d.group === "API").length, 2);
  });
});

describe("lc-search grouping", () => {
  it("groups in first-seen order when no explicit order is given", () => {
    const grouped = groupDocs(matchDocs(docs, "e", 8), []);
    assert.deepEqual(grouped.map((g) => g.group), ["Guides", "API"]);
  });

  it("honours an explicit group order and drops empty groups", () => {
    const grouped = groupDocs(matchDocs(docs, "define", 8), ["Guides", "API"]);
    assert.deepEqual(grouped.map((g) => g.group), ["API"]);
    assert.deepEqual(grouped[0].docs.map((d) => d.id), ["3", "4"]);
  });
});
