import assert from "node:assert/strict";
import test from "node:test";
import { deletePath, getPath, parsePath, setPath } from "./path.js";

test("a bracket index is a numeric segment, so a missing container knows its own shape", () => {
  assert.deepEqual(parsePath("links[0].url"), ["links", 0, "url"]);
  assert.deepEqual(parsePath("title"), ["title"]);
  assert.deepEqual(parsePath("a.b.c"), ["a", "b", "c"]);
  assert.deepEqual(parsePath(""), []);
});

test("reading walks the path and answers undefined rather than throwing", () => {
  const row = { title: "t", links: [{ url: "u" }], meta: { tags: ["a", "b"] } };
  assert.equal(getPath(row, "title"), "t");
  assert.equal(getPath(row, "links[0].url"), "u");
  assert.equal(getPath(row, "meta.tags[1]"), "b");
  assert.equal(getPath(row, "links[5].url"), undefined);
  assert.equal(getPath(row, "nothing.at.all"), undefined);
  assert.equal(getPath(null, "title"), undefined);
});

test("writing builds the containers the path implies", () => {
  const row = {};
  setPath(row, "links[0].url", "u");
  assert.deepEqual(row, { links: [{ url: "u" }] });
  setPath(row, "meta.tags[1]", "b");
  assert.deepEqual(row.meta.tags[1], "b");
  setPath(row, "title", "t");
  assert.equal(row.title, "t");
});

test("writing returns the same object, since the form holds one for its whole life", () => {
  const row = { a: 1 };
  assert.equal(setPath(row, "b", 2), row);
});

test("deleting an array entry closes the gap instead of leaving a hole", () => {
  const row = { links: [{ url: "a" }, { url: "b" }, { url: "c" }] };
  deletePath(row, "links[1]");
  assert.deepEqual(row.links.map((l) => l.url), ["a", "c"]);
});

test("deleting an object key removes it, and a path through nothing is a no-op", () => {
  const row = { meta: { keep: 1, drop: 2 } };
  deletePath(row, "meta.drop");
  assert.deepEqual(row.meta, { keep: 1 });
  assert.deepEqual(deletePath(row, "nothing.here"), row);
});
