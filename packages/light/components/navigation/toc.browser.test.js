/**
 * `<lc-toc>`: items become anchor links in order, a level indents, a
 * controlled `active` marks its link. Scroll-spy runs on an
 * IntersectionObserver the harness cannot drive synchronously, so it is
 * exercised by the pages that use it, not here.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import tocDef from "@bootstrapp/light/components/navigation/toc.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();

describe("lc-toc", () => {
  /** @type {any} */
  let el;

  before(async () => {
    define("lc-toc", tocDef);
    el = document.createElement("lc-toc");
    el.items = [
      { id: "examples", label: "Examples" },
      { id: "basic", label: "Basic", level: 2 },
      { id: "api", label: "API" },
      { id: "deep", label: "Deep", level: 4 },
    ];
    document.body.appendChild(el);
    await rendered(el);
  });

  after(() => el.remove());

  it("lists the items within depth as links to their ids", () => {
    const links = [...el.querySelectorAll(".toc-link")];
    assert.deepEqual(links.map((a) => a.getAttribute("href")), ["#examples", "#basic", "#api"]);
    assert.equal(el.querySelector('.toc-item[data-level="2"] .toc-link').textContent.trim(), "Basic");
  });

  it("names itself", () => {
    assert.equal(el.querySelector("nav").getAttribute("aria-label"), "On this page");
  });

  it("marks the controlled active item", async () => {
    el.active = "api";
    await rendered(el);
    const current = el.querySelector('.toc-link[aria-current="location"]');
    assert.ok(current, "one link is current");
    assert.equal(current.getAttribute("href"), "#api");
  });
});
