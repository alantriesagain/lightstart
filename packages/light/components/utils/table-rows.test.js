import assert from "node:assert/strict";
import test from "node:test";
import { clampPage, pageCount, pageRows, rangeOf, sortRows } from "./table-rows.js";

const rows = [
  { id: "a", name: "Praia do Leme", views: 12, when: "2026-09-30" },
  { id: "b", name: "Bar Bip Bip", views: 90, when: "" },
  { id: "c", name: "beco do Rato", views: 9, when: "2026-09-28" },
  { id: "d", name: "Praia 10", views: 12, when: "2026-10-02" },
  { id: "e", name: "Praia 9", views: null, when: "2026-09-29" },
];
const columns = [{ name: "Name", sortValue: (/** @type {Record<string, unknown>} */ row) => row.name }, "views", "when"];
const ids = (list) => list.map((row) => row.id);

test("sorts by a column's sortValue or the field it names, numbers as numbers and text by its words", () => {
  assert.deepEqual(ids(sortRows(rows, columns, "Name", "asc")), ["b", "c", "e", "d", "a"], "case-blind, and 9 before 10");
  assert.deepEqual(ids(sortRows(rows, columns, "views", "desc")), ["b", "a", "d", "c", "e"], "ties keep their order, the empty last");
  assert.deepEqual(ids(sortRows(rows, columns, "when", "asc")), ["c", "e", "a", "d", "b"]);
  assert.deepEqual(ids(sortRows(rows, columns, "when", "desc")), ["d", "a", "e", "c", "b"], "the empty is last either way");
  assert.equal(sortRows(rows, columns, "", "asc"), rows, "no column leaves the rows as they are");
  assert.equal(sortRows(rows, columns, "nothing", "asc"), rows);
});

test("sorts by what a cell draws when it draws text, and not by markup", () => {
  const drawn = [{ name: "Views", render: (/** @type {unknown} */ _v, /** @type {Record<string, unknown>} */ row) => String(row.views ?? "") }, { name: "Tag", render: () => ({ strings: ["<b>"] }) }];
  assert.deepEqual(ids(sortRows(rows, drawn, "Views", "desc")), ["b", "a", "d", "c", "e"]);
  assert.deepEqual(ids(sortRows(rows, drawn, "Tag", "asc")), ["a", "b", "c", "d", "e"], "markup sorts as empty, so the order holds");
});

test("pages, clamps a page into range, and names the range", () => {
  assert.deepEqual([pageCount(68, 25), pageCount(0, 25), pageCount(25, 25)], [3, 1, 1]);
  assert.deepEqual([clampPage(5, 68, 25), clampPage(0, 68, 25), clampPage(2.7, 68, 25)], [3, 1, 2]);
  assert.deepEqual(ids(pageRows(rows, 2, 2)), ["c", "d"]);
  assert.deepEqual(rangeOf(3, 25, 68), { from: 51, to: 68, total: 68 });
  assert.deepEqual(rangeOf(1, 25, 0), { from: 0, to: 0, total: 0 });
});
