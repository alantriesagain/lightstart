import assert from "node:assert/strict";
import test from "node:test";
import { composeDefinition, mergeDefinitions } from "./definition.js";

test("a sync block unions across a merge, the incoming entry winning", () => {
  const merged = mergeDefinitions({ sync: { a: "local", b: "x" } }, { sync: { b: "y", c: "session" } });
  assert.deepEqual(merged.sync, { a: "local", b: "y", c: "session" });
  assert.equal("sync" in mergeDefinitions({ props: { a: 1 } }, { props: { b: 2 } }), false);
});

test("a mixin's sync entries reach the definition that lists it", () => {
  const withDraft = { props: { draft: "" }, sync: { draft: { to: "local", key: "app:draft" } } };
  const composed = composeDefinition({ mixins: [withDraft], props: { theme: "light" }, sync: { theme: "local" } });
  assert.deepEqual(composed.sync, { draft: { to: "local", key: "app:draft" }, theme: "local" });
  assert.deepEqual(Object.keys(composed.props), ["draft", "theme"]);
});
