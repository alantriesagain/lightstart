import assert from "node:assert/strict";
import test from "node:test";
import T from "./index.js";

test("createType: key and scope require sync", () => {
  assert.throws(() => T.string({ key: "app:name" }), /key\/scope only apply/);
  assert.throws(() => T.string({ scope: "mode" }), /key\/scope only apply/);
});

test("createType: key and scope ride along with sync", () => {
  const def = T.string({ sync: "local", key: "app:name", scope: "mode" });
  assert.equal(def.key, "app:name");
  assert.equal(def.scope, "mode");
});
