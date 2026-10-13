import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hash } from "./url.js";

const fakeWindow = () => {
  /** @type {Array<[string, () => void]>} */
  const added = [];
  let current = "";
  const location = {
    get hash() {
      return current;
    },
    set hash(value) {
      const bare = String(value).replace(/^#/, "");
      current = bare ? `#${bare}` : "";
    },
  };
  return {
    added,
    location,
    /** @param {string} type @param {() => void} listener */
    addEventListener(type, listener) {
      added.push([type, listener]);
    },
  };
};

describe("@bootstrapp/light/controller/url: the hash adapter", () => {
  it("listens to navigation from its first subscriber, once, and reports keys a back step changed", () => {
    const win = fakeWindow();
    const global = /** @type {Record<string, unknown>} */ (globalThis);
    global.window = win;
    try {
      assert.equal(win.added.length, 0, "importing the adapter adds no listener");
      /** @type {unknown[]} */
      const tabs = [];
      hash.on("tab", (value) => tabs.push(value));
      hash.on("q", () => {});
      assert.deepEqual(win.added.map(([type]) => type), ["popstate"], "one listener, added by the first subscriber");

      hash.set("tab", "inbox");
      assert.equal(win.location.hash, "#tab=inbox");
      assert.equal(hash.get("tab"), "inbox");

      win.location.hash = "#tab=sent";
      win.added[0][1]();
      assert.deepEqual(tabs, ["inbox", "sent"]);
      win.location.hash = "";
      win.added[0][1]();
      assert.deepEqual(tabs, ["inbox", "sent", undefined], "a key gone from the hash is reported as undefined");
    } finally {
      delete global.window;
    }
  });
});
