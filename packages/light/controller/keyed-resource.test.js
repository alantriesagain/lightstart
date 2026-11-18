import assert from "node:assert/strict";
import test from "node:test";
import { event } from "../signals/index.ts";
import { keyedResource } from "./resource.ts";

test("a keyed filter receives the key, so one entry can refresh without the others", async () => {
  const changed = event();
  const loads = { "/a.json": 0, "/b.json": 0 };
  const keyed = keyedResource(
    (url) => { loads[url] += 1; return { url, at: loads[url] }; },
    {
      name: "index",
      ready: false,
      invalidateOn: changed,
      filter: (payload, key) => key === payload?.url,
    },
  );

  await keyed.get("/a.json").ensure();
  await keyed.get("/b.json").ensure();
  assert.deepEqual(loads, { "/a.json": 1, "/b.json": 1 });

  changed.emit({ url: "/a.json" });
  await keyed.get("/a.json").ensure();
  await keyed.get("/b.json").ensure();

  assert.equal(loads["/a.json"], 2, "the entry the payload names reloads");
  assert.equal(loads["/b.json"], 1, "its siblings are left alone");
});

test("a filter that matches nothing leaves every entry held", async () => {
  const changed = event();
  let loads = 0;
  const keyed = keyedResource(() => ++loads, {
    name: "index",
    ready: false,
    invalidateOn: changed,
    filter: (payload, key) => key === payload?.url,
  });

  await keyed.get("/a.json").ensure();
  changed.emit({ url: "/somewhere-else.json" });
  await keyed.get("/a.json").ensure();
  assert.equal(loads, 1);
});
