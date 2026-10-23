import assert from "node:assert/strict";
import { describe, it, before, after, afterEach } from "node:test";
import View from "@bootstrapp/light";
import { configureIcons } from "@bootstrapp/light/theme/icons.js";
import { html } from "@bootstrapp/light/html";
import { maskRule } from "./icon-mask.js";

const ICON = "heart";
const ICON_ENTRY = { body: '<path fill="none" d="M12 21 3 12a5 5 0 0 1 9-3 5 5 0 0 1 9 3z"/>', width: 24, height: 24 };

const { default: iconDef } = await import("./icon.js");

const BASE = `:where(.lc-icon,lc-icon){display:inline-block;width:1rem;height:1rem;` +
  `--lc-icon-mask:initial;--lc-icon-paint:transparent;` +
  `-webkit-mask-image:var(--lc-icon-mask);mask-image:var(--lc-icon-mask);` +
  `-webkit-mask-size:contain;mask-size:contain;background-color:var(--lc-icon-paint)}`;
const rules = document.createElement("style");
rules.textContent = `${BASE}\n${maskRule(ICON, ICON_ENTRY)}\n${maskRule(ICON, ICON_ENTRY, { solid: true })}\n`;
document.head.appendChild(rules);

let counter = 0;
const uniqueTag = (prefix) => `${prefix}-${++counter}-${Math.floor(performance.now())}`;

const mounted = [];
const mount = (tag) => {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  mounted.push(el);
  return el;
};

const waitFor = async (predicate, label, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out waiting for ${label}`);
};

const maskOf = (el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage;

describe("@bootstrapp/light - lc-icon", () => {
  before(() => {
    View.define("lc-icon", iconDef);
  });

  after(() => {
    rules.remove();
  });

  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove();
  });

  it("draws the icon without putting any markup on the page", async () => {
    const el = mount("lc-icon");
    el.name = ICON;
    await waitFor(() => maskOf(el) !== "none", "the mask to resolve");
    assert.equal(el.children.length, 0, "an icon is a mask, so it has no children to serialize");
    assert.ok(!el.innerHTML.includes("<svg"));
    assert.match(maskOf(el), /^url\(/);
  });

  it("paints with the inherited colour", async () => {
    const el = mount("lc-icon");
    el.name = ICON;
    await waitFor(() => maskOf(el) !== "none", "the mask to resolve");
    assert.notEqual(getComputedStyle(el).backgroundColor, "rgba(0, 0, 0, 0)", "currentColor, not transparent");
  });

  it("an unknown name paints nothing rather than a block", async () => {
    const el = mount("lc-icon");
    el.name = "no-such-icon-here";
    await waitFor(() => el.getAttribute("name") === "no-such-icon-here", "the name to settle");
    assert.equal(maskOf(el), "none", "no rule matched");
    assert.equal(getComputedStyle(el).backgroundColor, "rgba(0, 0, 0, 0)", "so the box stays transparent");
  });

  it("solid resolves a different mask from the same name", async () => {
    const outline = mount("lc-icon");
    outline.name = ICON;
    const solid = mount("lc-icon");
    solid.name = ICON;
    solid.setAttribute("solid", "");
    await waitFor(() => maskOf(outline) !== "none" && maskOf(solid) !== "none", "both masks");
    assert.notEqual(maskOf(outline), maskOf(solid));
  });

  it("renders a name that is not an icon as text", async () => {
    const el = mount("lc-icon");
    el.name = "🌴";
    await waitFor(() => el.textContent.includes("🌴"), "text fallback");
    assert.equal(el.innerHTML.includes("<svg"), false);
    assert.equal(maskOf(el), "none", "and it is text, not a masked box");
  });

  it("asks the loader once per name and draws the solid rule only when an icon wants it", async () => {
    const asked = [];
    configureIcons({ load: async (name) => { asked.push(name); return ICON_ENTRY; } });
    try {
      const devRules = () => document.getElementById("lc-icon-rules")?.textContent ?? "";
      const outline = mount("lc-icon");
      outline.name = "dev-heart";
      const later = mount("lc-icon");
      later.name = "dev-heart";
      await waitFor(() => devRules().includes('[name="dev-heart"]{'), "the outline rule");
      assert.ok(!devRules().includes('[name="dev-heart"][solid]'), "nothing is solid yet, so no solid rule");
      later.setAttribute("solid", "");
      await waitFor(() => devRules().includes('[name="dev-heart"][solid]'), "the solid rule");
      assert.equal(asked.filter((name) => name === "dev-heart").length, 1, "one load for the name");
    } finally {
      configureIcons({ load: null });
    }
  });

  it("draws every icon of a list that mounts in one commit", async () => {
    const hostTag = uniqueTag("icon-host");
    View.define(hostTag, {
      props: { names: { $type: "array", defaultValue: [] } },
      render() {
        return html`${this.names.map((name) => html`<lc-icon name=${name}></lc-icon>`)}`;
      },
    });

    const host = mount(hostTag);
    host.names = Array.from({ length: 12 }, () => ICON);
    await waitFor(() => host.querySelectorAll("lc-icon").length === 12, "icons to mount");
    await waitFor(
      () => [...host.querySelectorAll("lc-icon")].every((el) => maskOf(el) !== "none"),
      "every icon to draw",
    );

    assert.equal(host.querySelectorAll("lc-icon svg").length, 0, "twelve icons, no svg anywhere");
  });
});
