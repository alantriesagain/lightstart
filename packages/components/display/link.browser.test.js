import assert from "node:assert/strict";
import { describe, it } from "node:test";
import View from "@lightstart/light";
import { configureNavigation } from "@lightstart/light/navigation";

const { default: linkDef } = await import("./link.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("@lightstart/light - lc-link", () => {
  it("resolves its URL again when the host's router is handed over after it drew", async () => {
    if (!customElements.get("lc-link")) View.define("lc-link", linkDef);
    const el = /** @type {any} */ (document.createElement("lc-link"));
    el.setAttribute("href", "/places/page/2");
    document.body.append(el);
    try {
      await tick();
      await el.$requestUpdate();
      assert.equal(el.querySelector("a")?.getAttribute("href"), "/places/page/2", "a plain anchor before any router");
      configureNavigation({ href: (/** @type {string} */ path) => `/pt${path}` });
      const href = () => el.querySelector("a")?.getAttribute("href");
      for (let left = 50; left > 0 && href() !== "/pt/places/page/2"; left--) await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(href(), "/pt/places/page/2", "the router's URL once it is configured");
    } finally {
      el.remove();
      configureNavigation({});
    }
  });
});
