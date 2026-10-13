import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDocumentAdapter } from "./document.js";
import { createStore } from "../../signals/store.js";
import { registerAdapter, bindStoreSync } from "../sync.js";

const fakeBacking = (stored = {}) => {
  /** @type {Array<Record<string, unknown>>} */
  const writes = [];
  let flushed = 0;
  return {
    writes,
    get flushed() { return flushed; },
    read: async () => stored,
    write: (/** @type {Record<string, unknown>} */ doc) => { writes.push(doc); },
    flush: async () => { flushed += 1; },
  };
};

describe("controller/adapters/document createDocumentAdapter", () => {
  it("attach loads the stored document and announces every stored key", async () => {
    const adapter = createDocumentAdapter("doc-a");
    /** @type {Array<[string, unknown]>} */
    const seen = [];
    adapter.on("theme", (value) => seen.push(["theme", value]));
    adapter.on("size", (value) => seen.push(["size", value]));
    await adapter.attach(fakeBacking({ theme: "dark", size: 3 }));
    assert.deepEqual(seen, [["theme", "dark"], ["size", 3]]);
    assert.equal(adapter.get("theme"), "dark");
    assert.equal(adapter.has("size"), true);
    assert.deepEqual(adapter.keys(), ["theme", "size"]);
  });

  it("set merges into the document and writes it whole, once per change", async () => {
    const adapter = createDocumentAdapter("doc-b");
    const backing = fakeBacking({ kept: true });
    await adapter.attach(backing);
    adapter.set("theme", "dark");
    adapter.set("size", 2);
    assert.deepEqual(backing.writes, [{ kept: true, theme: "dark" }, { kept: true, theme: "dark", size: 2 }]);
    adapter.remove("kept");
    assert.deepEqual(backing.writes.at(-1), { theme: "dark", size: 2 });
    assert.deepEqual(adapter.entries(), [["theme", "dark"], ["size", 2]]);
  });

  it("detach flushes the backing and later writes stop", async () => {
    const adapter = createDocumentAdapter("doc-c");
    const backing = fakeBacking({});
    await adapter.attach(backing);
    await adapter.detach();
    assert.equal(backing.flushed, 1);
    adapter.set("theme", "dark");
    assert.deepEqual(backing.writes, []);
    assert.equal(adapter.get("theme"), "dark");
  });

  it("an empty or missing document reads as no keys", async () => {
    const adapter = createDocumentAdapter("doc-d");
    await adapter.attach({ read: async () => undefined, write: () => {} });
    assert.deepEqual(adapter.keys(), []);
    adapter.set("a", 1);
    assert.equal(adapter.get("a"), 1);
  });

  it("a bound store keeps its default until attach, then takes the stored value and persists its changes", async () => {
    const adapter = createDocumentAdapter("doc-e");
    registerAdapter("doc-e", adapter);
    const store = createStore({ open: { default: [] }, active: { default: "files" } }, { name: "t", accessors: false });
    const unbind = [
      bindStoreSync({ store, key: "open", prop: /** @type {any} */ ({ sync: "doc-e" }) }),
      bindStoreSync({ store, key: "active", prop: /** @type {any} */ ({ sync: "doc-e" }) }),
    ];
    assert.deepEqual(store.get("open"), []);
    const backing = fakeBacking({ open: ["/a"] });
    await adapter.attach(backing);
    assert.deepEqual(store.get("open"), ["/a"]);
    assert.equal(store.get("active"), "files");
    store.set("active", "search");
    assert.deepEqual(backing.writes.at(-1), { open: ["/a"], active: "search" });
    await adapter.detach();
    store.reset("active");
    assert.deepEqual(backing.writes.length, 1);
    unbind.forEach((off) => off());
  });
});
