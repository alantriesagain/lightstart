import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import breadcrumbsDef from "../navigation/breadcrumbs.js";
import pageHeaderDef from "./page-header.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const rendered = async (el) => {
  await tick();
  await (el.$requestUpdate() ?? Promise.resolve());
};

describe("lc-page-header", () => {
  /** @type {any} */
  let el;

  before(async () => {
    const css = await (await fetch(new URL("./page-header.css", import.meta.url))).text();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    define("lc-breadcrumbs", breadcrumbsDef);
    define("lc-page-header", pageHeaderDef);
  });
  afterEach(() => el?.remove());

  /** @param {string} [inner] */
  const mount = async (inner = "") => {
    el = document.createElement("lc-page-header");
    el.title = "Overview";
    el.crumbs = [{ label: "Workspace", href: "#ws" }, { label: "Projects" }];
    el.innerHTML = inner;
    document.body.appendChild(el);
    await rendered(el);
    return el;
  };

  it("draws one 56px row with the crumbs before the title", async () => {
    const root = await mount();
    const row = root.querySelector("[part~=lc-page-header-row]");
    assert.equal(getComputedStyle(row).height, "56px");
    assert.equal(getComputedStyle(row).paddingLeft, "40px");
    const crumbs = root.querySelector("lc-breadcrumbs");
    await rendered(crumbs);
    assert.deepEqual(
      crumbs.items.map((item) => [item.text, item.href]),
      [["Workspace", "#ws"], ["Projects", null]],
    );
    assert.ok(crumbs.querySelector("lc-link"), "a crumb with an href is a link");
    assert.equal(crumbs.querySelector(".current").textContent.trim(), "Projects", "one without is plain text");
    const title = root.querySelector("[part~=lc-page-header-title]");
    assert.equal(title.textContent.trim(), "Overview");
    assert.equal(getComputedStyle(title).fontSize, "18px");
    assert.ok(crumbs.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("draws the divider only while the tools slot has content", async () => {
    const root = await mount('<button slot="controls">Filter</button>');
    assert.equal(root.querySelector("[part~=lc-page-header-divider]"), null);

    const tool = document.createElement("button");
    tool.slot = "tools";
    el.append(tool);
    await tick();
    await rendered(el);
    const divider = root.querySelector("[part~=lc-page-header-divider]");
    assert.ok(divider, "a slotted tool brings the divider");
    assert.equal(getComputedStyle(divider).width, "1px");
    assert.equal(getComputedStyle(divider).height, "22px");

    tool.remove();
    await tick();
    await rendered(el);
    assert.equal(root.querySelector("[part~=lc-page-header-divider]"), null, "and it leaves with the last one");
  });

  it("starts with the divider when tools are there from the first render", async () => {
    const root = await mount('<button slot="tools">New</button>');
    await rendered(el);
    assert.ok(root.querySelector("[part~=lc-page-header-divider]"));
  });

  it("lets the title slot replace the title text", async () => {
    const root = await mount('<span slot="title">Custom</span>');
    const slot = root.querySelector('slot[name="title"]');
    assert.deepEqual([...slot.children].map((node) => node.textContent), ["Custom"]);
  });
});
